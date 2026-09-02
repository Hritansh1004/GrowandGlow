import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type RoomRole = "owner" | "host" | "moderator" | "member";
export type RoomMemberStatus = "invited" | "joined" | "left" | "removed" | "banned";

export interface RoomMember {
  id: string; // study_room_members.id
  room_id: string;
  user_id: string;
  role: RoomRole;
  status: RoomMemberStatus;
  muted: boolean;
  joined_at?: string | null;
  profile: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
  } | null;
}

const ROLE_RANK: Record<RoomRole, number> = { owner: 3, host: 2, moderator: 1, member: 0 };

// One dedicated hook for room member roles/permissions/management actions,
// kept separate from useStudyRooms.ts (already ~1500 lines) so this
// feature doesn't require re-delivering that entire file. Everything here
// operates on study_room_members, guarded by the RLS/RPC added in the
// room-roles SQL migration — the app-level checks below (canManage etc.)
// are for UI purposes only; the database is the real enforcement layer.
export default function useRoomMembers(roomId: string | undefined | null, currentUserId: string | undefined | null) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!roomId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: memberRows, error: membersError } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("room_id", roomId)
      .in("status", ["joined", "invited", "banned"]);

    if (membersError) {
      console.error("Room members load error:", membersError);
      setMessage(membersError.message);
      setLoading(false);
      return;
    }

    const rows = memberRows || [];
    const userIds = [...new Set(rows.map((r: any) => r.user_id))];

    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.error("Room member profiles load error:", profilesError);
      }

      (profileRows || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }

    const merged: RoomMember[] = rows.map((r: any) => ({
      id: r.id,
      room_id: r.room_id,
      user_id: r.user_id,
      role: (r.role || "member") as RoomRole,
      status: r.status,
      muted: Boolean(r.muted),
      joined_at: r.joined_at,
      profile: profileMap[r.user_id] || null,
    }));

    // Sort by rank (owner first) then join time, so the member list reads
    // like a real app's staff-first roster instead of arbitrary DB order.
    merged.sort((a, b) => {
      const rankDiff = ROLE_RANK[b.role] - ROLE_RANK[a.role];
      if (rankDiff !== 0) return rankDiff;
      return (a.joined_at || "").localeCompare(b.joined_at || "");
    });

    setMembers(merged);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Realtime — fresh random suffix per mount, per the project's standing
  // fix for StrictMode double-invoke channel collisions.
  useEffect(() => {
    if (!roomId) return;

    const freshSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`room_members:${roomId}:${freshSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_room_members", filter: `room_id=eq.${roomId}` },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    // Safety-net poll, matching the pattern already in useStudyRooms.ts —
    // harmless if Realtime works, keeps this list live if it doesn't.
    const pollInterval = setInterval(loadMembers, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [roomId, loadMembers]);

  const myMembership = useMemo(
    () => members.find((m) => m.user_id === currentUserId) || null,
    [members, currentUserId]
  );

  const myRole: RoomRole = myMembership?.role || "member";
  const canManage = myRole === "owner" || myRole === "host"; // full room management
  const canModerate = canManage || myRole === "moderator"; // mute/remove plain members
  const isOwner = myRole === "owner";

  function canActOn(target: RoomMember): boolean {
    if (target.user_id === currentUserId) return false; // never act on yourself here
    if (target.role === "owner") return false; // owner is untouchable except via transfer
    if (target.role === "host") return isOwner; // only the owner can touch a host
    return canModerate; // moderators+ can touch plain members
  }

  async function runAction<T>(memberRowId: string, fn: () => Promise<{ error: any } & T>) {
    setActingOnId(memberRowId);
    setMessage("");
    const res = await fn();
    setActingOnId(null);

    if (res.error) {
      console.error("Room member action error:", res.error);
      setMessage(res.error.message || "That action could not be completed.");
      return { success: false, error: res.error.message };
    }

    await loadMembers();
    return { success: true };
  }

  async function promoteToHost(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ role: "host" })
        .eq("id", member.id);
      return { error };
    });
  }

  async function promoteToModerator(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ role: "moderator" })
        .eq("id", member.id);
      return { error };
    });
  }

  async function demoteToMember(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ role: "member" })
        .eq("id", member.id);
      return { error };
    });
  }

  async function toggleMute(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ muted: !member.muted })
        .eq("id", member.id);
      return { error };
    });
  }

  async function removeMember(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ status: "removed" })
        .eq("id", member.id);
      return { error };
    });
  }

  async function banMember(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ status: "banned" })
        .eq("id", member.id);
      return { error };
    });
  }

  async function unbanMember(member: RoomMember) {
    return runAction(member.id, async () => {
      const { error } = await supabase
        .from("study_room_members")
        .update({ status: "removed" }) // back to "removed" — they can rejoin via a fresh invite/code
        .eq("id", member.id);
      return { error };
    });
  }

  async function transferOwnership(member: RoomMember) {
    if (!roomId) return { success: false, error: "No active room." };
    return runAction(member.id, async () => {
      const { error } = await supabase.rpc("transfer_room_ownership", {
        p_room_id: roomId,
        p_new_owner_id: member.user_id,
      });
      return { error };
    });
  }

  return {
    members,
    loading,
    message,
    actingOnId,
    myMembership,
    myRole,
    canManage,
    canModerate,
    isOwner,
    canActOn,
    promoteToHost,
    promoteToModerator,
    demoteToMember,
    toggleMute,
    removeMember,
    banMember,
    unbanMember,
    transferOwnership,
    reloadMembers: loadMembers,
  };
}
