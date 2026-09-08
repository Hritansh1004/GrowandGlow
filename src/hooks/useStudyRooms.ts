import { useCallback, useEffect, useMemo, useRef, useState } from "react"; import { playBuiltinAlarm, isBuiltinAlarmId, DEFAULT_BUILTIN_ID } from "../lib/alarmSounds";
import { supabase } from "../lib/supabaseClient";
import { scheduleTimerNotification, cancelScheduledNotification } from "../services/notificationService";
import { scheduleCustomBellAlarm, cancelCustomBellAlarm } from "../services/customAlarmPlugin";
import { ensureCustomBellDownloaded } from "../services/customBellStorage";
import {
  type EnginePeriod,
  sortPeriods,
  getCurrentPeriod,
  getNextPeriod,
  secondsRemainingInPeriod,
  secondsUntilPeriod,
  splitByProgress,
  formatCountdown,
} from "../lib/routineEngine";

export const MAX_ADDITIONAL_PARTICIPANTS = 5;

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export interface StudyRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  status: "joined" | "invited" | "left" | "declined";
  role?: "owner" | "host" | "moderator" | "member";
  joined_at?: string;
  left_at?: string;
  profile?: any;
  isOnline?: boolean;
  statusLabel?: string;
  dashboard_hidden?: boolean;
}

export interface StudyRoomPeriod {
  id: string;
  room_id: string;
  name: string;
  category: string | null;
  is_break: boolean;
  duration_minutes: number;
  alarm_id: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

// The shared Room Routine — clock-time based (start_time/end_time), same
// shape as your personal template_periods, so the exact same
// PeriodFormModal + routineEngine logic that runs your personal Routine
// also runs the Room's Routine.
export interface RoomRoutinePeriod extends EnginePeriod {
  room_id: string;
  created_at: string;
}
export interface StudyRoomData {
  id: string;
  host_id: string;
  room_code: string;
  name?: string | null;
  max_participants: number;
  status: "waiting" | "active" | "paused" | "ended";
  session_start?: string | null;
  session_end?: string | null;
  paused_at?: string | null;
  accumulated_pause_seconds?: number;
  current_room_period_id?: string | null;
  current_period_name?: string | null;
  current_session_alarm_id?: string | null;
  entry_closed?: boolean;
  closed_temporarily?: boolean;
  reopens_at?: string | null;
  hostProfile?: any;
  members: StudyRoomMember[];
  invitedMembers: StudyRoomMember[];
  myMembership?: StudyRoomMember | null;
  isHost: boolean;
}

export default function useStudyRooms(userId: string | undefined | null) {
  const [myRoom, setMyRoom] = useState<StudyRoomData | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomMessage, setRoomMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // OLD duration-based "Sequence" room periods — unchanged.
  const [roomPeriods, setRoomPeriods] = useState<StudyRoomPeriod[]>([]);
  const [roomPeriodsLoading, setRoomPeriodsLoading] = useState(false);

  // Clock-time-based shared Room Routine — unchanged.
  const [roomRoutinePeriods, setRoomRoutinePeriods] = useState<RoomRoutinePeriod[]>([]);
  const [roomRoutineLoading, setRoomRoutineLoading] = useState(false);
  const [roomRoutineMessage, setRoomRoutineMessage] = useState("");

  const [routineNow, setRoutineNow] = useState(() => new Date());

  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const alarmFiredRef = useRef(false);
  const skipNextSoundRef = useRef(false);
  // NEW — Room Routine rating popup: holds the just-completed period
  // (tagged with its own room_period_sessions row id) so StudyRoom.tsx
  // can show a RatingModal for it, same as personal Routine already does
  // via pendingRatingSession.
  const [pendingRoomRoutineRating, setPendingRoomRoutineRating] = useState<
    (RoomRoutinePeriod & { _sessionId?: string }) | null
  >(null);

  // NEW — Stage 2: tracks which room_routine_period_id was "current" on
  // the previous tick, purely to detect the moment it changes (meaning
  // that period just ended by wall clock — same mechanism your personal
  // Routine already uses to know a period finished). Also tracks which
  // period ids THIS client has already logged, so a re-render or
  // StrictMode double-invoke never creates a duplicate history row.
  const prevRoutinePeriodIdRef = useRef<string | null>(null);
  const loggedRoutinePeriodIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setRoutineNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchProfiles(ids: string[]) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", uniqueIds);

    if (error) {
      console.error("Profile fetch error:", error);
      return {};
    }

    const map: Record<string, any> = {};
    (data || []).forEach((p: any) => {
      map[p.id] = p;
    });
    return map;
  }

  function computeRemaining(room: any) {
    if (!room || !room.session_start || !room.session_end) return 0;

    const startMs = new Date(room.session_start).getTime();
    const endMs = new Date(room.session_end).getTime();
    const totalDuration = (endMs - startMs) / 1000;

    const nowMs =
      room.status === "paused" && room.paused_at
        ? new Date(room.paused_at).getTime()
        : Date.now();

    const elapsedActive =
      (nowMs - startMs) / 1000 - (room.accumulated_pause_seconds || 0);

    return Math.max(0, Math.round(totalDuration - elapsedActive));
  }

  function computeSessionEndDate(room: any): Date {
    const startMs = new Date(room.session_start).getTime();
    const originalEndMs = new Date(room.session_end).getTime();
    const totalDuration = (originalEndMs - startMs) / 1000;
    const pauseMs = (room.accumulated_pause_seconds || 0) * 1000;
    return new Date(startMs + totalDuration * 1000 + pauseMs);
  }

  const STUDY_ROOM_ALARM_ID = 4000;

useEffect(() => {
    if (!myRoom || myRoom.status !== "active" || !myRoom.session_start || !myRoom.session_end) {
      cancelScheduledNotification(STUDY_ROOM_ALARM_ID).catch(() => {});
      cancelCustomBellAlarm(STUDY_ROOM_ALARM_ID).catch(() => {});
      return;
    }

    const endDate = computeSessionEndDate(myRoom);

    if (endDate.getTime() <= Date.now()) {
      skipNextSoundRef.current = true;
    }

    const alarmId = myRoom.current_session_alarm_id;
    const title = "Study Room";
    const body = myRoom.current_period_name || "Session ended";

    (async () => {
      if (alarmId && !isBuiltinAlarmId(alarmId)) {
        const fileName = await ensureCustomBellDownloaded(alarmId);
        if (fileName) {
          try {
            await cancelScheduledNotification(STUDY_ROOM_ALARM_ID);
            await scheduleCustomBellAlarm({ id: STUDY_ROOM_ALARM_ID, fileName, atDate: endDate, title, body });
            return;
          } catch (err) {
            console.warn("Native custom-bell room scheduling failed, falling back to builtin:", err);
          }
        }
      }

      const builtinBellId = alarmId && isBuiltinAlarmId(alarmId) ? alarmId : DEFAULT_BUILTIN_ID;
      try {
        await cancelCustomBellAlarm(STUDY_ROOM_ALARM_ID);
        await scheduleTimerNotification({ id: STUDY_ROOM_ALARM_ID, title, body, builtinBellId, atDate: endDate });
      } catch (err) {
        console.warn("Native room alarm scheduling failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    myRoom?.status,
    myRoom?.session_start,
    myRoom?.session_end,
    myRoom?.paused_at,
    myRoom?.accumulated_pause_seconds,
    myRoom?.current_session_alarm_id,
    myRoom?.current_period_name,
  ]);

  // Plays the bell for the Live/Sequence session system (ad-hoc group
  // periods and duration-based study_room_periods). This runs on EVERY
  // joined member's own browser independently — each client computes the
  // same remaining time locally from the shared session_start/session_end,
  // so everyone hears the bell, not just the host.
  function playRoomSessionAlarm(alarmId?: string | null) {
    if (!alarmId || isBuiltinAlarmId(alarmId)) {
      playBuiltinAlarm(alarmId || DEFAULT_BUILTIN_ID);
      return;
    }

    supabase
      .from("alarms")
      .select("storage_path")
      .eq("id", alarmId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.storage_path) {
          playBuiltinAlarm(DEFAULT_BUILTIN_ID);
          return;
        }
        supabase.storage
          .from("custom-audio")
          .createSignedUrl(data.storage_path, 60)
          .then(({ data: signed }) => {
            if (signed?.signedUrl) {
              const audio = new Audio(signed.signedUrl);
              audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
            } else {
              playBuiltinAlarm(DEFAULT_BUILTIN_ID);
            }
          });
      });
  }

  const loadRoomPeriods = useCallback(async (roomId: string) => {
    setRoomPeriodsLoading(true);

    const { data, error } = await supabase
      .from("study_room_periods")
      .select("*")
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Room periods load error:", error);
      setRoomPeriods([]);
    } else {
      setRoomPeriods(data || []);
    }
    setRoomPeriodsLoading(false);
  }, []);

  const loadRoomRoutinePeriods = useCallback(async (roomId: string) => {
    setRoomRoutineLoading(true);
    setRoomRoutineMessage("");

    const { data, error } = await supabase
      .from("study_room_routine_periods")
      .select("*")
      .eq("room_id", roomId)
      .order("start_time", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Room routine periods load error:", error);
      setRoomRoutineMessage(error.message);
      setRoomRoutinePeriods([]);
    } else {
      setRoomRoutinePeriods((data as RoomRoutinePeriod[]) || []);
    }
    setRoomRoutineLoading(false);
  }, []);

  const loadRoomDetail = useCallback(
    async (room: any) => {
      // Best-effort auto-reopen: if this room was temporarily closed with
      // a reopens_at time that has now passed, clear the closed state.
      // Wrapped so a failure here never blocks the room from loading.
      if (room.closed_temporarily && room.reopens_at && new Date(room.reopens_at) <= new Date()) {
        try {
          const { data: reopened } = await supabase
            .from("study_rooms")
            .update({ closed_temporarily: false, entry_closed: false, reopens_at: null })
            .eq("id", room.id)
            .select()
            .single();
          if (reopened) room = reopened;
        } catch (e) {
          console.error("Auto-reopen room error:", e);
        }
      }

      const { data: memberRows, error: membersError } = await supabase
        .from("study_room_members")
        .select("*")
        .eq("room_id", room.id)
        .in("status", ["joined", "invited"]);

      if (membersError) {
        console.error("Room members load error:", membersError);
        setRoomMessage(membersError.message);
      }

      const ids = (memberRows || []).map((m: any) => m.user_id);
      if (!ids.includes(room.host_id)) ids.push(room.host_id);
      const profileMap = await fetchProfiles(ids);

      const members = (memberRows || [])
        .filter((m: any) => m.status === "joined")
        .map((m: any) => ({ ...m, profile: profileMap[m.user_id] }))
        .filter((m: any) => m.profile);

      const invitedMembers = (memberRows || [])
        .filter((m: any) => m.status === "invited")
        .map((m: any) => ({ ...m, profile: profileMap[m.user_id] }))
        .filter((m: any) => m.profile);

      const myMembership = (memberRows || []).find((m: any) => m.user_id === userId) || null;

      // isHost now means "has full room-management rights" — the original
      // creator (host_id) OR anyone promoted to 'owner'/'host' role in
      // study_room_members. This single computation point is what every
      // host-only check in this file (session controls, Routine editing,
      // timetable editing, presets) reads from, so fixing it here alone
      // extends "multiple hosts" everywhere at once — no need to touch
      // every individual check.
      const myRole = myMembership?.role;
      setMyRoom({
        ...room,
        hostProfile: profileMap[room.host_id],
        members,
        invitedMembers,
        myMembership,
        isHost: room.host_id === userId || myRole === "owner" || myRole === "host",
      });

      setRemainingSeconds(computeRemaining(room));
      alarmFiredRef.current = false;

      await loadRoomPeriods(room.id);
      await loadRoomRoutinePeriods(room.id);
    },
    [userId, loadRoomPeriods, loadRoomRoutinePeriods]
  );

  const loadMyRoom = useCallback(async () => {
    if (!userId) {
      setMyRoom(null);
      setRoomPeriods([]);
      setRoomRoutinePeriods([]);
      setRoomLoading(false);
      return;
    }

    setRoomLoading(true);
    setRoomMessage("");

    const { data: membership, error: membershipError } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["joined", "invited"])
      .order("joined_at", { ascending: false, nullsFirst: false });

    if (membershipError) {
      console.error("Membership load error:", membershipError);
      setRoomMessage(membershipError.message);
      setMyRoom(null);
      setRoomLoading(false);
      return;
    }

    const rows = membership || [];
    const joinedRows = rows.filter((m: any) => m.status === "joined");

    if (joinedRows.length > 1) {
      const stale = joinedRows.slice(1);
      await Promise.all(
        stale.map((row: any) =>
          supabase
            .from("study_room_members")
            .update({ status: "left", left_at: new Date().toISOString() })
            .eq("id", row.id)
        )
      );
    }

    const myMembership = joinedRows[0] || rows[0];

    if (!myMembership) {
      setMyRoom(null);
      setRoomPeriods([]);
      setRoomRoutinePeriods([]);
      setRoomLoading(false);
      return;
    }

    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .select("*")
      .eq("id", myMembership.room_id)
      .maybeSingle();

    if (roomError) {
      console.error("Room load error:", roomError);
      setRoomMessage(roomError.message);
      setMyRoom(null);
      setRoomLoading(false);
      return;
    }

    if (!room || room.status === "ended") {
      setMyRoom(null);
      setRoomPeriods([]);
      setRoomRoutinePeriods([]);
      setRoomLoading(false);
      return;
    }

    await loadRoomDetail(room);
    setRoomLoading(false);
  }, [userId, loadRoomDetail]);

  useEffect(() => {
    loadMyRoom();
  }, [loadMyRoom]);

  useEffect(() => {
    if (!myRoom?.id) return;

    const freshSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`room_periods:${myRoom.id}:${freshSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_room_periods", filter: `room_id=eq.${myRoom.id}` },
        () => {
          loadRoomPeriods(myRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myRoom?.id, loadRoomPeriods]);

  useEffect(() => {
    if (!myRoom?.id) return;

    const freshSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`room_routine:${myRoom.id}:${freshSuffix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_room_routine_periods",
          filter: `room_id=eq.${myRoom.id}`,
        },
        () => {
          loadRoomRoutinePeriods(myRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myRoom?.id, loadRoomRoutinePeriods]);

  // Polling safety net — runs regardless of whether Realtime is actually
  // delivering events (unresolved as of this session: Realtime Inspector
  // showed zero events despite correct publication membership, RLS, and
  // REPLICA IDENTITY). Every 4 seconds while a room is loaded, silently
  // re-fetch the room + both period lists. If Realtime IS working, this
  // is a harmless redundant refresh. If it's NOT, this is what actually
  // keeps the UI live instead of requiring a manual reload.
  useEffect(() => {
    if (!myRoom?.id) return;

    const pollInterval = setInterval(() => {
      loadMyRoom();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [myRoom?.id, loadMyRoom]);

  const loadPendingInvites = useCallback(async () => {
    if (!userId) {
      setPendingInvites([]);
      setInvitesLoading(false);
      return;
    }

    setInvitesLoading(true);

    const { data: rows, error } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "invited");

    if (error) {
      console.error("Pending invites load error:", error);
      setPendingInvites([]);
      setInvitesLoading(false);
      return;
    }

    if (!rows || rows.length === 0) {
      setPendingInvites([]);
      setInvitesLoading(false);
      return;
    }

    const roomIds = rows.map((r: any) => r.room_id);
    const { data: rooms } = await supabase
      .from("study_rooms")
      .select("*")
      .in("id", roomIds)
      .neq("status", "ended");

    const hostIds = (rooms || []).map((r: any) => r.host_id);
    const profileMap = await fetchProfiles(hostIds);

    const merged = rows
      .map((r: any) => {
        const room = (rooms || []).find((rm: any) => rm.id === r.room_id);
        if (!room) return null;
        return {
          membershipId: r.id,
          room,
          hostProfile: profileMap[room.host_id],
        };
      })
      .filter(Boolean);

    setPendingInvites(merged);
    setInvitesLoading(false);
  }, [userId]);

  useEffect(() => {
    loadPendingInvites();
  }, [loadPendingInvites]);

  useEffect(() => {
    if (!myRoom || myRoom.status !== "active") {
      if (myRoom) setRemainingSeconds(computeRemaining(myRoom));
      return;
    }

    const interval = setInterval(() => {
      const remaining = computeRemaining(myRoom);
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !alarmFiredRef.current) {
        alarmFiredRef.current = true;
        const skipSound = skipNextSoundRef.current;
        skipNextSoundRef.current = false;
        if (!skipSound) {
          playRoomSessionAlarm(myRoom.current_session_alarm_id);
        }
        if (myRoom.isHost) {
          if (myRoom.current_room_period_id) {
            startNextRoomPeriod();
          } else {
            pauseSession({ silent: true });
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoom]);

  const membersWithStatus = useMemo(() => {
    if (!myRoom) return [];

    return myRoom.members.map((m) => {
      const isOnline = onlineIds.has(m.user_id) || true;
      let statusLabel = "In Room";

      if (myRoom.status === "active") statusLabel = "Studying";
      else if (myRoom.status === "paused") statusLabel = "On Break";

      return { ...m, isOnline, statusLabel };
    });
  }, [myRoom, onlineIds]);

  const roomRoutineSorted = useMemo(
    () => sortPeriods(roomRoutinePeriods),
    [roomRoutinePeriods]
  );

  const currentRoomRoutinePeriod = useMemo(
    () => getCurrentPeriod(roomRoutinePeriods, routineNow) as RoomRoutinePeriod | null,
    [roomRoutinePeriods, routineNow]
  );

  const nextRoomRoutinePeriod = useMemo(
    () => getNextPeriod(roomRoutinePeriods, routineNow) as RoomRoutinePeriod | null,
    [roomRoutinePeriods, routineNow]
  );

  const roomRoutineSplit = useMemo(
    () => splitByProgress(roomRoutinePeriods, routineNow),
    [roomRoutinePeriods, routineNow]
  );

  const currentRoomRoutineSeconds = currentRoomRoutinePeriod
    ? secondsRemainingInPeriod(currentRoomRoutinePeriod, routineNow)
    : 0;

  const nextRoomRoutineSeconds = nextRoomRoutinePeriod
    ? secondsUntilPeriod(nextRoomRoutinePeriod, routineNow)
    : 0;

  // NEW — Stage 2: writes ONE row to room_period_sessions, owned by the
  // CURRENT client's own user_id. RLS requires auth.uid() = user_id, so
  // this can only ever write the calling user's own history — no member
  // can write on behalf of anyone else, by construction, not just by
  // convention.
  const logRoomRoutineSessionForSelf = useCallback(
    async (period: RoomRoutinePeriod, status: "completed" | "stopped") => {
      if (!userId || !myRoom?.id) return;
      if (loggedRoutinePeriodIdsRef.current.has(period.id)) return;

      loggedRoutinePeriodIdsRef.current.add(period.id);

      const { data, error } = await supabase
        .from("room_period_sessions")
        .insert({
          user_id: userId,
          room_id: myRoom.id,
          room_routine_period_id: period.id,
          room_name: myRoom.name || "Study Room",
          period_name: period.name,
          category: period.category,
          is_break: Boolean(period.is_break),
          planned_start: period.start_time,
          planned_end: period.end_time,
          status,
        })
        .select()
        .single();

      let sessionRow = data;

      if (error) {
        // A unique-violation (23505) means another mounted instance of this
        // same hook (App.tsx and StudyRoom.tsx both call useStudyRooms()
        // independently, each with its own dedup ref) already logged this
        // exact period for this user — expected now that a DB-level unique
        // constraint exists (see SQL migration), not a real error. Fetch
        // that existing row so THIS instance can still show the rating
        // prompt if it's the one actually rendering the Study Room screen.
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("room_period_sessions")
            .select("*")
            .eq("user_id", userId)
            .eq("room_routine_period_id", period.id)
            .maybeSingle();
          sessionRow = existing;
        } else {
          console.error("Log room routine session error:", error);
          loggedRoutinePeriodIdsRef.current.delete(period.id);
          return;
        }
      }

      if (sessionRow && !period.is_break && status === "completed") {
        setPendingRoomRoutineRating({ ...period, _sessionId: sessionRow.id });
      }
    },
    [userId, myRoom?.id, myRoom?.name]
  );

  // NEW — submit/dismiss for the Room Routine rating popup, same shape
  // as submitPeriodRating/dismissPeriodRating in useRoutine.ts.
  async function submitRoomRoutineRating(period: any, rating: number, note?: string) {
    const sessionId = period?._sessionId;
    if (!sessionId) return { success: false, error: "No session to rate." };

    const { error } = await supabase
      .from("room_period_sessions")
      .update({ rating, note: note || null })
      .eq("id", sessionId);

    if (error) {
      console.error("Submit room routine rating error:", error);
      return { success: false, error: error.message };
    }

    setPendingRoomRoutineRating(null);
    return { success: true };
  }

  function dismissRoomRoutineRating() {
    setPendingRoomRoutineRating(null);
  }

      
  // NEW — Stage 2: detects when the wall-clock-derived "current" Room
  // Routine period changes (the previous one ended), and logs it to this
  // user's own history. This mirrors how your personal Routine detects
  // period completion — no host "start" trigger involved, since the
  // Room Routine (like your personal one) is driven by real time, not
  // a manually-started session.
  useEffect(() => {
    if (!myRoom?.id) return;

    const currentId = currentRoomRoutinePeriod?.id || null;
    const previousId = prevRoutinePeriodIdRef.current;

    if (previousId && previousId !== currentId) {
      const justEnded = roomRoutinePeriods.find((p) => p.id === previousId);
      if (justEnded) {
        // Room Routine periods never actually triggered a sound before —
        // alarm_id was stored but nothing called playAlarm/playBuiltinAlarm
        // on completion. Fixed here, using the same isBuiltinAlarmId/
        // playBuiltinAlarm split as everywhere else; custom uploaded
        // sounds go through the same signed-URL fetch pattern.
        if (justEnded.alarm_id) {
          if (isBuiltinAlarmId(justEnded.alarm_id)) {
            playBuiltinAlarm(justEnded.alarm_id);
          } else {
            supabase
              .from("alarms")
              .select("storage_path")
              .eq("id", justEnded.alarm_id)
              .maybeSingle()
              .then(({ data }) => {
                if (!data?.storage_path) {
                  playBuiltinAlarm(DEFAULT_BUILTIN_ID);
                  return;
                }
                supabase.storage
                  .from("custom-audio")
                  .createSignedUrl(data.storage_path, 60)
                  .then(({ data: signed }) => {
                    if (signed?.signedUrl) {
                      const audio = new Audio(signed.signedUrl);
                      audio.play().catch(() => playBuiltinAlarm(DEFAULT_BUILTIN_ID));
                    } else {
                      playBuiltinAlarm(DEFAULT_BUILTIN_ID);
                    }
                  });
              });
          }
        } else {
          playBuiltinAlarm(DEFAULT_BUILTIN_ID);
        }

        logRoomRoutineSessionForSelf(justEnded, "completed");
      }
    }

    prevRoutinePeriodIdRef.current = currentId;
  }, [currentRoomRoutinePeriod?.id, roomRoutinePeriods, myRoom?.id, logRoomRoutineSessionForSelf]);
  // ==========================================================
  // Room Routine CRUD. Host-only (also enforced by RLS on
  // study_room_routine_periods). Signature intentionally mirrors
  // PeriodFormModal's PeriodFormValues shape (name/category/isBreak/
  // startTime/endTime/alarmId) so StudyRoom.tsx can hand the modal's
  // output straight to these functions with no translation layer.
  // ==========================================================
  async function addRoomRoutinePeriod(values: {
    name: string;
    category: string;
    isBreak: boolean;
    startTime: string;
    endTime: string;
    alarmId: string | null;
    color?: string | null;
  }) {
    if (!myRoom?.isHost) {
      return { success: false, error: "Only the host can edit the room routine." };
    }

    const { error } = await supabase.from("study_room_routine_periods").insert({
      room_id: myRoom.id,
      name: values.name.trim() || (values.isBreak ? "Break" : "Study Period"),
      category: values.isBreak ? values.category.trim() || "Break" : values.category.trim() || "General",
      is_break: Boolean(values.isBreak),
      start_time: values.startTime,
      end_time: values.endTime,
      alarm_id: values.alarmId,
      color: values.color ?? null,
      sort_order: roomRoutinePeriods.length,
    });

    if (error) {
      console.error("Add room routine period error:", error);
      setRoomRoutineMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomRoutinePeriods(myRoom.id);
    return { success: true };
  }

  async function updateRoomRoutinePeriod(
    periodId: string,
    values: {
      name: string;
      category: string;
      isBreak: boolean;
      startTime: string;
      endTime: string;
      alarmId: string | null;
      color?: string | null;
    }
  ) {
    if (!myRoom?.isHost) {
      return { success: false, error: "Only the host can edit the room routine." };
    }

    const { error } = await supabase
      .from("study_room_routine_periods")
      .update({
        name: values.name.trim(),
        category: values.isBreak ? values.category.trim() || "Break" : values.category.trim(),
        is_break: Boolean(values.isBreak),
        start_time: values.startTime,
        end_time: values.endTime,
        alarm_id: values.alarmId,
        color: values.color ?? null,
      })
      .eq("id", periodId)
      .eq("room_id", myRoom.id);

    if (error) {
      console.error("Update room routine period error:", error);
      setRoomRoutineMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomRoutinePeriods(myRoom.id);
    return { success: true };
  }

  async function deleteRoomRoutinePeriod(periodId: string) {
    if (!myRoom?.isHost) {
      return { success: false, error: "Only the host can edit the room routine." };
    }

    const { error } = await supabase
      .from("study_room_routine_periods")
      .delete()
      .eq("id", periodId)
      .eq("room_id", myRoom.id);

    if (error) {
      console.error("Delete room routine period error:", error);
      setRoomRoutineMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomRoutinePeriods(myRoom.id);
    return { success: true };
  }

  async function clearRoomRoutinePeriods() {
    if (!myRoom?.isHost) return { success: false };

    const { error } = await supabase
      .from("study_room_routine_periods")
      .delete()
      .eq("room_id", myRoom.id);

    if (error) {
      console.error("Clear room routine error:", error);
      setRoomRoutineMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomRoutinePeriods(myRoom.id);
    return { success: true };
  }

  async function copyTemplateIntoRoomRoutine(templateId: string) {
    if (!myRoom?.isHost) {
      return { success: false, error: "Only the host can load a timetable." };
    }

    const { data: periods, error } = await supabase
      .from("template_periods")
      .select("*")
      .eq("template_id", templateId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Load template periods error:", error);
      setRoomRoutineMessage(error.message);
      return { success: false, error: error.message };
    }

    if (!periods || periods.length === 0) {
      setRoomRoutineMessage("That timetable has no periods to copy.");
      return { success: false, error: "Empty template." };
    }

    await clearRoomRoutinePeriods();

    const rows = periods.map((p: any, idx: number) => ({
      room_id: myRoom.id,
      name: p.name || (p.is_break ? "Break" : "Study Period"),
      category: p.category || (p.is_break ? "Break" : "General"),
      is_break: Boolean(p.is_break),
      start_time: p.start_time,
      end_time: p.end_time,
      alarm_id: p.alarm_id || null,
      sort_order: idx,
    }));

    const { error: insertError } = await supabase.from("study_room_routine_periods").insert(rows);

    if (insertError) {
      console.error("Copy template into room routine error:", insertError);
      setRoomRoutineMessage(insertError.message);
      return { success: false, error: insertError.message };
    }

    await loadRoomRoutinePeriods(myRoom.id);
    return { success: true };
  }

  async function closeOutCurrentRoomMembership() {
    if (!userId) return;

    const { data: activeRows } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "joined");

    if (!activeRows || activeRows.length === 0) return;

    for (const row of activeRows as any[]) {
      await supabase
        .from("study_room_members")
        .update({ status: "left", left_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    const { data: hostedRooms } = await supabase
      .from("study_rooms")
      .select("id")
      .eq("host_id", userId)
      .neq("status", "ended");

    if (hostedRooms && hostedRooms.length > 0) {
      await supabase
        .from("study_rooms")
        .update({ status: "ended" })
        .in(
          "id",
          hostedRooms.map((r: any) => r.id)
        );
    }
  }

  async function createRoom({ name }: { name?: string } = {}) {
    if (!userId) return { success: false, error: "You are not logged in." };

    setActionLoading(true);
    setRoomMessage("");

    await closeOutCurrentRoomMembership();

    const code = generateRoomCode();

    const { data: room, error } = await supabase
      .from("study_rooms")
      .insert({
        host_id: userId,
        room_code: code,
        name: name?.trim() || null,
        max_participants: MAX_ADDITIONAL_PARTICIPANTS,
        status: "waiting",
      })
      .select()
      .single();

    if (error || !room) {
      console.error("Create room error:", error);
      setActionLoading(false);
      setRoomMessage(error?.message || "Could not create the room.");
      return { success: false, error: error?.message };
    }

    const { error: memberError } = await supabase.from("study_room_members").insert({
      room_id: room.id,
      user_id: userId,
      status: "joined",
      role: "owner", // room creator — was "host" leftover from before the Owner/Host/Moderator/Member tier existed
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      console.error("Host membership insert error:", memberError);
      setActionLoading(false);
      setRoomMessage(
        "Room was created but you couldn't be added as a member: " + memberError.message
      );
      return { success: false, error: memberError.message };
    }

    await loadRoomDetail(room);
    setActionLoading(false);
    return { success: true, room };
  }

  // Shared message for a blocked join/invite attempt while a room is
  // closed. Mentions the reopen time when the host set one.
  function describeClosedRoom(room: any): string {
    if (room?.closed_temporarily && room?.reopens_at) {
      const when = new Date(room.reopens_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `This room is closed and will reopen ${when}. Please wait for the host.`;
    }
    return "This room is closed right now. Please wait for the host to reopen it.";
  }

  async function joinRoomByCode(code: string) {
    if (!userId) return { success: false, error: "You are not logged in." };
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: "Enter a room code." };

    setActionLoading(true);
    setRoomMessage("");

    const { data: room, error } = await supabase
      .from("study_rooms")
      .select("*")
      .eq("room_code", cleanCode)
      .neq("status", "ended")
      .maybeSingle();

    if (error || !room) {
      setActionLoading(false);
      setRoomMessage("No active room found with that code.");
      return { success: false, error: "No active room found with that code." };
    }

    const { data: existingRow } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRow && existingRow.status === "joined") {
      // Already an active member — never blocked by the room's own
      // closed state here (that would misfire on the auto-join-via-
      // invite-link effect for people already inside). Whether they can
      // actually SEE/use the room content while closed is enforced by
      // StudyRoom.tsx's own render gate, not this join call.
      await loadRoomDetail(room);
      setActionLoading(false);
      return { success: true, room };
    }

    const myExistingRole = existingRow?.role;
    const isManagerRole = myExistingRole === "owner" || myExistingRole === "host";

    // A closed room blocks EVERYONE from (re)entering except its own
    // managers (Owner/Host) — this used to only block people who had
    // never been a member before, which meant anyone who was ever
    // invited, left, or declined in the past could still slip back in
    // while the room was supposed to be closed. Closing now means
    // closed, full stop, for anyone who isn't currently already in and
    // isn't running the room.
    if ((room.entry_closed || room.closed_temporarily) && !isManagerRole) {
      const msg = describeClosedRoom(room);
      setActionLoading(false);
      setRoomMessage(msg);
      return { success: false, error: msg };
    }

    const capCheck = await checkRoomCapacity(room.id);
    if (!capCheck.ok) {
      setActionLoading(false);
      setRoomMessage(capCheck.message);
      return { success: false, error: capCheck.message };
    }

    await closeOutCurrentRoomMembership();

    if (existingRow) {
      const { error: reactivateError } = await supabase
        .from("study_room_members")
        .update({
          status: "joined",
          joined_at: new Date().toISOString(),
          left_at: null,
          dashboard_hidden: false,
        })
        .eq("id", existingRow.id);

      if (reactivateError) {
        console.error("Rejoin room error:", reactivateError);
        setActionLoading(false);
        setRoomMessage(reactivateError.message);
        return { success: false, error: reactivateError.message };
      }
    } else {
      const { error: joinError } = await supabase.from("study_room_members").insert({
        room_id: room.id,
        user_id: userId,
        status: "joined",
        role: "member",
        joined_at: new Date().toISOString(),
      });

      if (joinError) {
        console.error("Join room error:", joinError);
        setActionLoading(false);
        setRoomMessage(joinError.message);
        return { success: false, error: joinError.message };
      }
    }

    await loadMyRoom();
    setActionLoading(false);
    return { success: true, room };
  }

  async function checkRoomCapacity(roomId: string) {
    const { count, error } = await supabase
      .from("study_room_members")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "joined");

    if (error) {
      console.error("Capacity check error:", error);
      return { ok: true, message: "" };
    }

    if ((count || 0) >= MAX_ADDITIONAL_PARTICIPANTS + 1) {
      return { ok: false, message: "This study room is full (6 people max)." };
    }
    return { ok: true, message: "" };
  }

  async function inviteFriendToRoom(friendUserId: string) {
    if (!userId) return { success: false, error: "You are not logged in." };
    setActionLoading(true);
    setRoomMessage("");

    let room = myRoom;
    if (!room || !room.isHost) {
      const res = await createRoom({});
      if (!res.success || !res.room) {
        setActionLoading(false);
        return { success: false, error: res.error };
      }
      room = res.room as any;
    }

    if (!room) {
      setActionLoading(false);
      return { success: false };
    }

    const capCheck = await checkRoomCapacity(room.id);
    if (!capCheck.ok) {
      setActionLoading(false);
      setRoomMessage(capCheck.message);
      return { success: false, error: capCheck.message };
    }

    const { data: existingRow } = await supabase
      .from("study_room_members")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", friendUserId)
      .maybeSingle();

    // A closed room can't take on new invitees at all, except its own
    // managers (Owner/Host) — matches the same fix as joinRoomByCode.
    // Someone who was only ever a plain member/moderator (or a stranger)
    // is blocked here regardless of past membership history.
    const friendExistingRole = existingRow?.role;
    const friendIsManager = friendExistingRole === "owner" || friendExistingRole === "host";
    if (((room as any).entry_closed || (room as any).closed_temporarily) && !friendIsManager) {
      const msg = describeClosedRoom(room);
      setActionLoading(false);
      setRoomMessage(msg);
      return { success: false, error: msg };
    }

    let membershipId: string | null = null;

    if (existingRow) {
      if (existingRow.status === "joined") {
        setActionLoading(false);
        setRoomMessage("They're already in this room.");
        return { success: false, error: "Already a member." };
      }

      const { error: reinviteError } = await supabase
        .from("study_room_members")
        .update({ status: "invited" })
        .eq("id", existingRow.id);

      if (reinviteError) {
        console.error("Re-invite error:", reinviteError);
        setActionLoading(false);
        setRoomMessage(reinviteError.message);
        return { success: false, error: reinviteError.message };
      }
      membershipId = existingRow.id;
    } else {
      const { data: inviteRow, error: inviteError } = await supabase
        .from("study_room_members")
        .insert({
          room_id: room.id,
          user_id: friendUserId,
          status: "invited",
          role: "member",
        })
        .select()
        .single();

      if (inviteError) {
        console.error("Invite error:", inviteError);
        setActionLoading(false);
        setRoomMessage(inviteError.message);
        return { success: false, error: inviteError.message };
      }
      membershipId = inviteRow.id;
    }

    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: friendUserId,
      type: "room_invite_received",
      payload: {
        room_id: room.id,
        membership_id: membershipId,
        room_code: room.room_code,
        room_name: room.name || "Study Room",
        from_user_id: userId,
      },
    });

    if (notifError) {
      console.error("Room invite notification error:", notifError);
    }

    await loadMyRoom();
    setActionLoading(false);
    return { success: true };
  }

  async function cancelInvite(membershipId: string) {
    const { error } = await supabase.from("study_room_members").delete().eq("id", membershipId);
    if (error) {
      console.error("Cancel invite error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  async function respondToInvite(membershipId: string, accept: boolean) {
    setActionLoading(true);
    setRoomMessage("");

    if (accept) {
      await closeOutCurrentRoomMembership();
    }

    const { error } = accept
      ? await supabase
          .from("study_room_members")
          .update({ status: "joined", joined_at: new Date().toISOString(), dashboard_hidden: false })
          .eq("id", membershipId)
      : await supabase.from("study_room_members").update({ status: "declined" }).eq("id", membershipId);
    if (error) {
      console.error("Respond to invite error:", error);
      setActionLoading(false);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    setActionLoading(false);
    await loadPendingInvites();
    if (accept) await loadMyRoom();
    return { success: true };
  }

  async function leaveRoom() {
    if (!myRoom) return { success: false };
    setActionLoading(true);
    setRoomMessage("");

    const { error } = myRoom.isHost
      ? await supabase.from("study_rooms").update({ status: "ended" }).eq("id", myRoom.id)
      : await supabase
          .from("study_room_members")
          .update({ status: "left", left_at: new Date().toISOString() })
          .eq("room_id", myRoom.id)
          .eq("user_id", userId);

    if (error) {
      console.error("Leave room error:", error);
      setActionLoading(false);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    if (myRoom.isHost) {
      await supabase
        .from("study_room_members")
        .update({ status: "left", left_at: new Date().toISOString() })
        .eq("room_id", myRoom.id)
        .eq("user_id", userId);
    }

    setMyRoom(null);
    setRoomPeriods([]);
    setRoomRoutinePeriods([]);
    setActionLoading(false);
    return { success: true };
  }

  async function addRoomPeriod({
    name,
    category,
    isBreak,
    durationMinutes,
    alarmId,
    color,
  }: {
    name: string;
    category?: string;
    isBreak?: boolean;
    durationMinutes: number;
    alarmId?: string | null;
    color?: string | null;
  }) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can edit the room timetable." };

    const { error } = await supabase.from("study_room_periods").insert({
      room_id: myRoom.id,
      name: name.trim() || (isBreak ? "Break" : "Study Session"),
      category: isBreak ? category?.trim() || "Break" : category?.trim() || "General",
      is_break: Boolean(isBreak),
      duration_minutes: Math.max(1, Math.round(durationMinutes)),
      alarm_id: alarmId || null,
      color: color || null,
      sort_order: roomPeriods.length,
    });

    if (error) {
      console.error("Add room period error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  async function updateRoomPeriod(
    periodId: string,
    changes: {
      name?: string;
      category?: string;
      isBreak?: boolean;
      durationMinutes?: number;
      alarmId?: string | null;
      color?: string | null;
    }
  ) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can edit the room timetable." };

    const payload: any = {};
    if (changes.name !== undefined) payload.name = changes.name.trim();
    if (changes.category !== undefined) payload.category = changes.category.trim();
    if (changes.isBreak !== undefined) payload.is_break = changes.isBreak;
    if (changes.durationMinutes !== undefined) payload.duration_minutes = Math.max(1, Math.round(changes.durationMinutes));
    if (changes.alarmId !== undefined) payload.alarm_id = changes.alarmId || null;
    if (changes.color !== undefined) payload.color = changes.color || null;

    const { error } = await supabase.from("study_room_periods").update(payload).eq("id", periodId);

    if (error) {
      console.error("Update room period error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  async function deleteRoomPeriod(periodId: string) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can edit the room timetable." };

    const { error } = await supabase.from("study_room_periods").delete().eq("id", periodId);

    if (error) {
      console.error("Delete room period error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  async function clearRoomPeriods() {
    if (!myRoom?.isHost) return { success: false };

    const { error } = await supabase.from("study_room_periods").delete().eq("room_id", myRoom.id);
    if (error) {
      console.error("Clear room periods error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  async function copyTemplateIntoRoom(templateId: string) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can load a timetable." };

    const { data: periods, error } = await supabase
      .from("template_periods")
      .select("*")
      .eq("template_id", templateId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Load template periods error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    if (!periods || periods.length === 0) {
      setRoomMessage("That timetable has no periods to copy.");
      return { success: false, error: "Empty template." };
    }

    await clearRoomPeriods();

    const rows = periods.map((p: any, idx: number) => {
      const [sh, sm] = (p.start_time || "00:00").split(":").map(Number);
      const [eh, em] = (p.end_time || "00:25").split(":").map(Number);
      const durationMinutes = Math.max(1, eh * 60 + em - (sh * 60 + sm));

      return {
        room_id: myRoom.id,
        name: p.name || (p.is_break ? "Break" : "Study Session"),
        category: p.category || (p.is_break ? "Break" : "General"),
        is_break: Boolean(p.is_break),
        duration_minutes: durationMinutes,
        color: p.color || null,
        sort_order: idx,
      };
    });

    const { error: insertError } = await supabase.from("study_room_periods").insert(rows);

    if (insertError) {
      console.error("Copy template into room error:", insertError);
      setRoomMessage(insertError.message);
      return { success: false, error: insertError.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  async function copyPresetIntoRoom(
    presetPeriods: { name: string; subject?: string; durationMinutes: number; is_break: boolean }[]
  ) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can load a preset." };

    await clearRoomPeriods();

    const rows = presetPeriods.map((p, idx) => ({
      room_id: myRoom.id,
      name: p.name,
      category: p.subject || (p.is_break ? "Break" : "General"),
      is_break: Boolean(p.is_break),
      duration_minutes: Math.max(1, Math.round(p.durationMinutes)),
      sort_order: idx,
    }));

    const { error } = await supabase.from("study_room_periods").insert(rows);

    if (error) {
      console.error("Copy preset into room error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  // Loads one of the host's own personal Sequence templates (built in
  // SequenceBuilder.tsx) into this room's shared duration-based
  // timetable — the Custom Room parity counterpart to copyTemplateIntoRoom
  // above, which does the same thing for clock-time Routine templates.
  async function copySequenceTemplateIntoRoom(templateId: string) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can load a Sequence." };

    const { data: blocks, error } = await supabase
      .from("sequence_template_blocks")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Load sequence template blocks error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    if (!blocks || blocks.length === 0) {
      setRoomMessage("That Sequence has no periods to copy.");
      return { success: false, error: "Empty sequence." };
    }

    await clearRoomPeriods();

    const rows = blocks.map((b: any, idx: number) => ({
      room_id: myRoom.id,
      name: b.name,
      category: b.category || (b.is_break ? "Break" : "General"),
      is_break: Boolean(b.is_break),
      duration_minutes: b.duration_minutes,
      alarm_id: b.alarm_id || null,
      color: b.color || null,
      sort_order: idx,
    }));

    const { error: insertError } = await supabase.from("study_room_periods").insert(rows);

    if (insertError) {
      console.error("Copy sequence template into room error:", insertError);
      setRoomMessage(insertError.message);
      return { success: false, error: insertError.message };
    }

    await loadRoomPeriods(myRoom.id);
    return { success: true };
  }

  // Drag-reorder persistence for the room's shared duration-based
  // Sequence timetable — host-only, mirroring reorderBlocks in
  // useSequences.ts. Deliberately a genuine per-row UPDATE rather than
  // .upsert(): upsert() compiles to INSERT ... ON CONFLICT DO UPDATE,
  // and Postgres re-validates that INSERT's WITH CHECK policy against
  // whatever columns the payload carries. A reorder payload only ever
  // carries {id, sort_order}, so that check fails with "new row violates
  // row-level security policy" — the exact bug already hit and fixed on
  // the personal Sequence side. Plain .update() only touches sort_order
  // and leaves every other column (including room_id) untouched, so the
  // policy trivially passes.
  async function reorderRoomPeriods(newOrder: StudyRoomPeriod[]) {
    if (!myRoom?.isHost) return { success: false, error: "Only the host can reorder the room's Sequence." };

    const withNewSortOrder = newOrder.map((p, index) => ({ ...p, sort_order: index }));
    setRoomPeriods(withNewSortOrder);

    const results = await Promise.all(
      withNewSortOrder.map((p) =>
        supabase
          .from("study_room_periods")
          .update({ sort_order: p.sort_order })
          .eq("id", p.id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error("Reorder room periods error:", firstError);
      setRoomMessage(firstError.message);
      await loadRoomPeriods(myRoom.id);
      return { success: false, error: firstError.message };
    }

    return { success: true };
  }

  async function startRoomPeriod(period: StudyRoomPeriod) {
    if (!myRoom?.isHost) return { success: false };

    const durationSeconds = Math.max(60, Math.round(period.duration_minutes * 60));
    const now = new Date();
    const end = new Date(now.getTime() + durationSeconds * 1000);

    const { error } = await supabase
      .from("study_rooms")
      .update({
        status: "active",
        current_period_name: period.name,
        current_room_period_id: period.id,
        current_session_alarm_id: period.alarm_id || null,
        session_start: now.toISOString(),
        session_end: end.toISOString(),
        paused_at: null,
        accumulated_pause_seconds: 0,
      })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Start room period error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function startNextRoomPeriod() {
    if (!myRoom?.isHost) return { success: false };

    const currentIndex = roomPeriods.findIndex((p) => p.id === myRoom.current_room_period_id);
    const next = roomPeriods[currentIndex + 1];

    if (!next) {
      const { error } = await supabase
        .from("study_rooms")
        .update({
          status: "waiting",
          current_period_name: null,
          current_room_period_id: null,
          session_start: null,
          session_end: null,
        })
        .eq("id", myRoom.id);

      if (error) {
        console.error("End room sequence error:", error);
        setRoomMessage(error.message);
        return { success: false, error: error.message };
      }

      await loadMyRoom();
      return { success: true, complete: true };
    }

    return await startRoomPeriod(next);
  }

  async function startSessionAdhoc({
    taskName,
    durationMinutes,
    alarmId,
  }: {
    taskName: string;
    durationMinutes: number;
    alarmId?: string | null;
  }) {
    if (!myRoom?.isHost) return { success: false };

    const durationSeconds = Math.max(1, Math.round((durationMinutes || 25) * 60));
    const now = new Date();
    const end = new Date(now.getTime() + durationSeconds * 1000);

    const { error } = await supabase
      .from("study_rooms")
      .update({
        status: "active",
        current_period_name: taskName?.trim() || "Focus Session",
        current_room_period_id: null,
        current_session_alarm_id: alarmId || null,
        session_start: now.toISOString(),
        session_end: end.toISOString(),
        paused_at: null,
        accumulated_pause_seconds: 0,
      })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Start ad-hoc session error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function pauseSession({ silent = false }: { silent?: boolean } = {}) {
    if (!myRoom?.isHost || myRoom.status !== "active") return { success: false };

    const { error } = await supabase
      .from("study_rooms")
      .update({ status: "paused", paused_at: new Date().toISOString() })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Pause session error:", error);
      if (!silent) setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function resumeSession() {
    if (!myRoom?.isHost || myRoom.status !== "paused") return { success: false };

    const pausedDuration = myRoom.paused_at
      ? Math.round((Date.now() - new Date(myRoom.paused_at).getTime()) / 1000)
      : 0;
    const newAccumulated = Math.round((myRoom.accumulated_pause_seconds || 0) + pausedDuration);

    const { error } = await supabase
      .from("study_rooms")
      .update({
        status: "active",
        paused_at: null,
        accumulated_pause_seconds: newAccumulated,
      })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Resume session error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function stopSession() {
    if (!myRoom?.isHost) return { success: false };

    const { error } = await supabase
      .from("study_rooms")
      .update({
        status: "waiting",
        current_period_name: null,
        current_room_period_id: null,
        session_start: null,
        session_end: null,
        paused_at: null,
        accumulated_pause_seconds: 0,
      })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Stop session error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function extendSession(minutes = 5) {
    if (!myRoom?.isHost || !myRoom.session_end) return { success: false };

    const currentEnd = new Date(myRoom.session_end).getTime();
    const newEnd = new Date(currentEnd + minutes * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("study_rooms")
      .update({ session_end: newEnd })
      .eq("id", myRoom.id);

    if (error) {
      console.error("Extend session error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }

    await loadMyRoom();
    return { success: true };
  }

  async function closeRoomPermanently() {
    if (!myRoom?.id) return { success: false };
    if (myRoom.myMembership?.role !== "owner") {
      return { success: false, error: "Only the room owner can permanently close the room." };
    }
    const { error } = await supabase
      .from("study_rooms")
      .update({ status: "ended" })
      .eq("id", myRoom.id);
    if (error) {
      console.error("Close room permanently error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  async function setRoomEntryClosed(closed: boolean) {
    if (!myRoom?.id || !myRoom.isHost) {
      return { success: false, error: "Only the host or owner can change entry settings." };
    }
    const { error } = await supabase
      .from("study_rooms")
      .update({ entry_closed: closed })
      .eq("id", myRoom.id);
    if (error) {
      console.error("Set room entry closed error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  async function closeRoomTemporarily(reopensAt?: string | null) {
    if (!myRoom?.id || !myRoom.isHost) {
      return { success: false, error: "Only the host or owner can temporarily close the room." };
    }
    const { error } = await supabase
      .from("study_rooms")
      .update({
        closed_temporarily: true,
        entry_closed: true,
        reopens_at: reopensAt || null,
      })
      .eq("id", myRoom.id);
    if (error) {
      console.error("Close room temporarily error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  async function reopenRoom() {
    if (!myRoom?.id || !myRoom.isHost) {
      return { success: false, error: "Only the host or owner can reopen the room." };
    }
    const { error } = await supabase
      .from("study_rooms")
      .update({
        closed_temporarily: false,
        entry_closed: false,
        reopens_at: null,
      })
      .eq("id", myRoom.id);
    if (error) {
      console.error("Reopen room error:", error);
      setRoomMessage(error.message);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  async function removeRoomFromDashboard() {
    if (!userId || !myRoom?.myMembership?.id) return { success: false };
    const { error } = await supabase
      .from("study_room_members")
      .update({ dashboard_hidden: true })
      .eq("id", myRoom.myMembership.id);
    if (error) {
      console.error("Remove room from dashboard error:", error);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  // Un-hides a dismissed room card. A still-active member (status
  // 'joined') never goes through a rejoin/accept-invite path — those are
  // the only two places dashboard_hidden was previously reset — so
  // without this, dismissing the card while still an active member made
  // it disappear permanently with no way back. This gives that back.
  async function restoreRoomToDashboard() {
    if (!userId || !myRoom?.myMembership?.id) return { success: false };
    const { error } = await supabase
      .from("study_room_members")
      .update({ dashboard_hidden: false })
      .eq("id", myRoom.myMembership.id);
    if (error) {
      console.error("Restore room to dashboard error:", error);
      return { success: false, error: error.message };
    }
    await loadMyRoom();
    return { success: true };
  }

  return {
    myRoom,
    membersWithStatus,
    roomLoading,
    roomMessage,
    setRoomMessage,
    actionLoading,

    // Old duration-based Sequence room periods (Timer tab — unchanged)
    roomPeriods,
    roomPeriodsLoading,

    // Shared clock-time Room Routine
    roomRoutinePeriods: roomRoutineSorted,
    roomRoutineLoading,
    roomRoutineMessage,
    currentRoomRoutinePeriod,
    nextRoomRoutinePeriod,
    currentRoomRoutineSeconds,
    nextRoomRoutineSeconds,
    completedRoomRoutine: roomRoutineSplit.completed,
    remainingRoomRoutine: roomRoutineSplit.remaining,
    addRoomRoutinePeriod,
    updateRoomRoutinePeriod,
    deleteRoomRoutinePeriod,
    clearRoomRoutinePeriods,
    copyTemplateIntoRoomRoutine,
    formatRoutineRemaining: formatCountdown,

    // NEW — Stage 2: exposed mainly so StudyRoom.tsx can offer a manual
    // "mark done now" action later if wanted; completion is otherwise
    // automatic via the wall-clock detection effect above.
    logRoomRoutineSessionForSelf,
    pendingRoomRoutineRating,
    submitRoomRoutineRating,
    dismissRoomRoutineRating,

    pendingInvites,
    invitesLoading,
    remainingSeconds,
    formatRoomTimer: formatCountdown,
    createRoom,
    joinRoomByCode,
    inviteFriendToRoom,
    cancelInvite,
    respondToInvite,
    leaveRoom,
    addRoomPeriod,
    updateRoomPeriod,
    deleteRoomPeriod,
    clearRoomPeriods,
    copyTemplateIntoRoom,
    copySequenceTemplateIntoRoom,
    copyPresetIntoRoom,
    reorderRoomPeriods,
    startRoomPeriod,
    startNextRoomPeriod,
    startSessionAdhoc,
    pauseSession,
    resumeSession,
    stopSession,
    extendSession,
    reloadMyRoom: loadMyRoom,

    // Room lifecycle controls
    closeRoomPermanently,
    setRoomEntryClosed,
    closeRoomTemporarily,
    reopenRoom,
    removeRoomFromDashboard,
    restoreRoomToDashboard,
  };
}