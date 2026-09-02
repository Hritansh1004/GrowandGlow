import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface FriendItem {
  friendshipId: string;
  profile: FriendProfile;
  since?: string;
  isOnline?: boolean;
}

export interface FriendRequestItem {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  profile?: FriendProfile;
}

export default function useFriends(userId: string | undefined | null) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsMessage, setRequestsMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const loadFriends = useCallback(async () => {
    if (!userId) {
      setFriends([]);
      setFriendsLoading(false);
      return;
    }

    setFriendsLoading(true);

    try {
      const { data: rows, error } = await supabase
        .from("friends")
        .select("*")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`);

      if (error || !rows || rows.length === 0) {
        setFriends([]);
        setFriendsLoading(false);
        return;
      }

      const otherIds = rows.map((r: any) => (r.user_a === userId ? r.user_b : r.user_a));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", otherIds);

      const profileMap: Record<string, FriendProfile> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      const merged = rows
        .map((r: any) => {
          const otherId = r.user_a === userId ? r.user_b : r.user_a;
          const profile = profileMap[otherId];
          if (!profile) return null;
          return { friendshipId: r.id, profile, since: r.created_at };
        })
        .filter(Boolean) as FriendItem[];

      setFriends(
        merged.sort((a, b) =>
          (a.profile.display_name || "").localeCompare(b.profile.display_name || "")
        )
      );
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const loadRequests = useCallback(async () => {
    if (!userId) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setRequestsLoading(false);
      return;
    }

    setRequestsLoading(true);

    try {
      const [{ data: incoming }, { data: outgoing }] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("*")
          .eq("receiver_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("friend_requests")
          .select("*")
          .eq("sender_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      const involvedIds = [
        ...(incoming || []).map((r: any) => r.sender_id),
        ...(outgoing || []).map((r: any) => r.receiver_id),
      ];

      const profileMap: Record<string, FriendProfile> = {};
      if (involvedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", involvedIds);

        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      setIncomingRequests(
        (incoming || [])
          .map((r: any) => ({ ...r, profile: profileMap[r.sender_id] }))
          .filter((r: any) => r.profile)
      );

      setOutgoingRequests(
        (outgoing || [])
          .map((r: any) => ({ ...r, profile: profileMap[r.receiver_id] }))
          .filter((r: any) => r.profile)
      );
    } catch {
      setIncomingRequests([]);
      setOutgoingRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function refreshAll() {
    await Promise.all([loadFriends(), loadRequests()]);
  }

  async function searchUsers() {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearchMessage("");
      return;
    }
    if (!userId) return;

    setSearching(true);
    setSearchMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .ilike("username", `%${term}%`)
        .neq("id", userId)
        .limit(20);

      if (error) {
        setSearchMessage(error.message);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
        if ((data || []).length === 0) {
          setSearchMessage("No users found with that username.");
        }
      }
    } catch (err: any) {
      setSearchMessage(err?.message || "Search failed");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const friendIdSet = useMemo(() => new Set(friends.map((f) => f.profile.id)), [friends]);
  const outgoingIdSet = useMemo(() => new Set(outgoingRequests.map((r) => r.receiver_id)), [outgoingRequests]);
  const incomingByIdMap = useMemo(() => {
    const map: Record<string, FriendRequestItem> = {};
    incomingRequests.forEach((r) => {
      map[r.sender_id] = r;
    });
    return map;
  }, [incomingRequests]);

  function getRelationStatus(otherUserId: string): "friends" | "pending_outgoing" | "pending_incoming" | "none" {
    if (friendIdSet.has(otherUserId)) return "friends";
    if (outgoingIdSet.has(otherUserId)) return "pending_outgoing";
    if (incomingByIdMap[otherUserId]) return "pending_incoming";
    return "none";
  }

  async function sendFriendRequest(receiverId: string) {
    if (!userId) return { success: false, error: "You are not logged in." };
    setRequestsMessage("");

    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .insert({ sender_id: userId, receiver_id: receiverId, status: "pending" })
        .select()
        .single();

      if (error) {
        const msg = error.code === "23505" ? "A request is already pending." : error.message;
        setRequestsMessage(msg);
        return { success: false, error: msg };
      }

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: receiverId,
        type: "friend_request_received",
        payload: { from_user_id: userId, request_id: data.id },
      });

      if (notifError) {
        console.error("Friend request notification error:", notifError);
        setRequestsMessage(
          "Request sent, but the notification couldn't be delivered. They may not see an alert until they check Benchmates directly."
        );
      }

      await loadRequests();
      return { success: true, data };
    } catch (err: any) {
      setRequestsMessage(err?.message || "Request failed");
      return { success: false, error: err?.message };
    }
  }

  async function acceptFriendRequest(requestId: string) {
    if (!userId) return { success: false };
    setRequestsMessage("");

    const requestRow = incomingRequests.find((r) => r.id === requestId);

    try {
      const { error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
      if (error) {
        // Fallback direct insert if RPC not present in DB
        if (requestRow) {
          await supabase.from("friends").insert({ user_a: requestRow.sender_id, user_b: userId });
          await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);
        }
      }

      if (requestRow?.sender_id) {
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: requestRow.sender_id,
          type: "friend_request_accepted",
          payload: { from_user_id: userId },
        });

        if (notifError) {
          console.error("Friend accept notification error:", notifError);
        }
      }

      await refreshAll();
      return { success: true };
    } catch {
      await refreshAll();
      return { success: true };
    }
  }

  async function declineFriendRequest(requestId: string) {
    if (!userId) return { success: false };
    setRequestsMessage("");

    try {
      await supabase.rpc("decline_friend_request", { request_id: requestId });
      await supabase.from("friend_requests").update({ status: "declined" }).eq("id", requestId);
    } catch {}

    await loadRequests();
    return { success: true };
  }

  async function cancelSentRequest(requestId: string) {
    if (!userId) return { success: false };

    try {
      await supabase.from("friend_requests").delete().eq("id", requestId).eq("sender_id", userId);
    } catch {}

    await loadRequests();
    return { success: true };
  }

  async function removeFriend(friendshipId: string) {
    if (!userId) return { success: false };

    try {
      await supabase.from("friends").delete().eq("id", friendshipId);
    } catch {}

    await loadFriends();
    return { success: true };
  }

  useEffect(() => {
    if (!userId) return;

    try {
      const channel = supabase.channel("presence:online", {
        config: { presence: { key: userId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {}
  }, [userId]);

  const friendsWithPresence = useMemo(
    () =>
      friends.map((f) => ({
        ...f,
        isOnline: onlineIds.has(f.profile.id) || true,
      })),
    [friends, onlineIds]
  );

  return {
    friends: friendsWithPresence,
    friendsLoading,
    reloadFriends: loadFriends,
    incomingRequests,
    outgoingRequests,
    requestsLoading,
    requestsMessage,
    setRequestsMessage,
    searchTerm,
    setSearchTerm,
    searchResults,
    searching,
    searchMessage,
    searchUsers,
    getRelationStatus,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelSentRequest,
    removeFriend,
    refreshAll,
  };
}