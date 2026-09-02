import { useEffect, useState, useRef, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors, getColorGradient } from "../styles/theme";
import useStudyRooms from "../hooks/useStudyRooms";
import { useDragReorder } from "../hooks/useDragReorder";
import useFriends from "../hooks/useFriends";
import useAlarms from "../hooks/useAlarms";
import useRoomMembers, { type RoomMember, type RoomRole } from "../hooks/useRoomMembers";
import PeriodFormModal, { type PeriodFormValues } from "../components/PeriodFormModal"; import AlarmSelector from "../components/AlarmSelector";
import ColorSelector from "../components/ColorSelector";
import RatingModal from "../components/RatingModal";
import AvatarDisplay from "../components/AvatarDisplay";
import type { RoomRoutinePeriod, StudyRoomPeriod } from "../hooks/useStudyRooms";
import {
  ArrowLeftIcon,
  SendIcon,
  CopyIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  ClockIcon,
  CoffeeIcon,
  BookIcon,
  CalendarIcon,
  MoreIcon,
  CrownIcon,
  UserCheckIcon,
  DoorOpenIcon,
  DragHandleIcon,
} from "../components/Icons";

interface StudyRoomProps {
  user: any;
  roomId: string | null;
  onLeave: () => void;
  styles: AppStyles;
}

const CLASSROOM_PRESETS = [
  {
    name: "Classic Pomodoro (25/5)",
    description: "4 cycles of 25m Focus + 5m Short Break, then 15m Long Break",
    periods: [
      { name: "Period 1 — Focus", subject: "Deep Work", durationMinutes: 25, is_break: false },
      { name: "Break 1", subject: "Rest & Hydrate", durationMinutes: 5, is_break: true },
      { name: "Period 2 — Focus", subject: "Deep Work", durationMinutes: 25, is_break: false },
      { name: "Break 2", subject: "Rest & Stretch", durationMinutes: 5, is_break: true },
      { name: "Period 3 — Focus", subject: "Deep Work", durationMinutes: 25, is_break: false },
      { name: "Long Break", subject: "Recharge", durationMinutes: 15, is_break: true },
    ],
  },
  {
    name: "Deep Study Block (50/10)",
    description: "2 intense 50m study periods with a 10m break",
    periods: [
      { name: "Period 1 — Intensive Study", subject: "Core Subject", durationMinutes: 50, is_break: false },
      { name: "Break", subject: "Walk & Refresh", durationMinutes: 10, is_break: true },
      { name: "Period 2 — Practice & Review", subject: "Exercises / Notes", durationMinutes: 50, is_break: false },
    ],
  },
  {
    name: "Standard School (40/5)",
    description: "3 classroom periods with short interval transitions",
    periods: [
      { name: "Period 1", subject: "Lecture / Reading", durationMinutes: 40, is_break: false },
      { name: "Short Break", subject: "Interval", durationMinutes: 5, is_break: true },
      { name: "Period 2", subject: "Problem Solving", durationMinutes: 40, is_break: false },
      { name: "Recess Break", subject: "Snack & Rest", durationMinutes: 15, is_break: true },
      { name: "Period 3", subject: "Revision & Notes", durationMinutes: 40, is_break: false },
    ],
  },
];

const QUICK_REACTIONS = [
  "In the zone",
  "Break time",
  "Question",
  "Goal done",
  "Keep pushing",
];

function formatClockTime(time: string) {
  if (!time) return "";
  const [hours, minutes] = time.slice(0, 5).split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

// Small role badge shown next to a member's name in the Benchmates tab.
// Owner gets a crown, Host gets a checkmark badge, Moderator gets a plain
// text tag, Member gets nothing (matches how most real apps only visually
// flag staff, not every regular participant).
function RoleBadge({ role, colors }: { role: RoomRole; colors: any }) {
  if (role === "owner") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "10px",
          fontWeight: 800,
          color: "#e8c468",
          padding: "2px 6px",
          borderRadius: "6px",
          background: "rgba(232, 196, 104, 0.14)",
        }}
      >
        <CrownIcon width={11} height={11} />
        OWNER
      </span>
    );
  }
  if (role === "host") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "10px",
          fontWeight: 800,
          color: colors.accent,
          padding: "2px 6px",
          borderRadius: "6px",
          background: colors.accentDim,
        }}
      >
        <UserCheckIcon width={11} height={11} />
        HOST
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span
        style={{
          fontSize: "10px",
          fontWeight: 800,
          color: colors.textDim,
          padding: "2px 6px",
          borderRadius: "6px",
          background: colors.cardAlt,
          border: `1px solid ${colors.border}`,
        }}
      >
        MOD
      </span>
    );
  }
  return null;
}

// Plain full-width menu row used inside the per-member action menu.
function MenuButton({
  label,
  onClick,
  colors,
  danger,
}: {
  label: string;
  onClick: () => void;
  colors: any;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "9px 12px",
        borderRadius: "10px",
        border: "none",
        background: "transparent",
        color: danger ? colors.danger : colors.text,
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default function StudyRoom({
  user,
  roomId,
  onLeave,
  styles,
}: StudyRoomProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const {
    myRoom,
    remainingSeconds,
    formatRoomTimer,
    roomPeriods,
    roomPeriodsLoading,
    addRoomPeriod,
    updateRoomPeriod,
    deleteRoomPeriod,
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
    inviteFriendToRoom,
    reloadMyRoom,

    // Clock-time Room Routine
    roomRoutinePeriods,
    roomRoutineLoading,
    roomRoutineMessage,
    currentRoomRoutinePeriod,
    nextRoomRoutinePeriod,
    currentRoomRoutineSeconds,
    nextRoomRoutineSeconds,
    completedRoomRoutine,
    addRoomRoutinePeriod,
    updateRoomRoutinePeriod,
    deleteRoomRoutinePeriod,
    copyTemplateIntoRoomRoutine,
    formatRoutineRemaining,

    // Room Routine rating popup
    pendingRoomRoutineRating,
    submitRoomRoutineRating,
    dismissRoomRoutineRating,

    // Room lifecycle controls
    closeRoomPermanently,
    setRoomEntryClosed,
    closeRoomTemporarily,
    reopenRoom,
  } = useStudyRooms(user?.id);

  const { friends } = useFriends(user?.id);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  const {
    members: roomMembers,
    loading: membersLoading,
    message: membersMessage,
    actingOnId,
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
    transferOwnership,
  } = useRoomMembers(myRoom?.id, user?.id);

  // Drag-to-reorder for the room's shared Sequence timetable — host-only
  // in practice (the drag handle itself is only rendered when isHost
  // below), mirroring the personal SequenceBuilder.tsx pattern.
  const {
    draggingIndex: roomPeriodDraggingIndex,
    getHandleProps: getRoomPeriodHandleProps,
    getRowStyle: getRoomPeriodRowStyle,
  } = useDragReorder<StudyRoomPeriod>({
    items: roomPeriods,
    onReorder: async (newItems) => {
      await reorderRoomPeriods(newItems);
    },
  });

  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    kind: "remove" | "ban" | "transfer" | "demote";
    member: RoomMember;
  } | null>(null);

  const [participants, setParticipants] = useState<any[]>([]);
  // Lets the realtime chat handler and handleSendMessage look up a room
  // member's profile without needing "participants" in their effect's
  // dependency array — adding it there would force the chat channel to
  // resubscribe (and briefly drop messages) every time anyone's
  // participant data refreshes.
  const participantsRef = useRef<any[]>([]);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatLoadError, setChatLoadError] = useState<string>("");
  const [chatDebugCount, setChatDebugCount] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [sequenceTemplates, setSequenceTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "session" | "routine" | "timetable" | "chat" | "benchmates"
  >("session");

  // Host ad-hoc custom timer state
  const [adhocName, setAdhocName] = useState("Maths Revision");
  const [adhocMins, setAdhocMins] = useState(25);
  const [adhocType, setAdhocType] = useState<"Study" | "Break">("Study");
  const [adhocAlarmId, setAdhocAlarmId] = useState<string | null>(null);

  // Duration-based room period builder form state
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState("");
  const [periodCategory, setPeriodCategory] = useState("");
  const [periodIsBreak, setPeriodIsBreak] = useState(false);
  const [periodDuration, setPeriodDuration] = useState(25);
  const [periodAlarmId, setPeriodAlarmId] = useState<string | null>(null);
  const [periodColor, setPeriodColor] = useState<string | null>(null);
  const [periodSaving, setPeriodSaving] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [loadingSequenceTemplateId, setLoadingSequenceTemplateId] = useState<string | null>(null);

  // Clock-time Room Routine builder modal state
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [editingRoutinePeriod, setEditingRoutinePeriod] = useState<RoomRoutinePeriod | null>(null);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineFormError, setRoutineFormError] = useState("");
  const [loadingRoutineTemplateId, setLoadingRoutineTemplateId] = useState<string | null>(null);

  // Invite modal & Copy state
  // Invite modal & Copy state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Room lifecycle controls modal state
  const [showRoomControlsModal, setShowRoomControlsModal] = useState(false);
  const [showPermanentCloseConfirm, setShowPermanentCloseConfirm] = useState(false);
  const [reopenAtInput, setReopenAtInput] = useState("");
  const [roomControlsSaving, setRoomControlsSaving] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Load user saved templates
  useEffect(() => {
    if (!user?.id) return;
    async function loadUserTemplates() {
      try {
        const { data } = await supabase
          .from("timetable_templates")
          .select("*")
          .eq("user_id", user.id);
        if (data) setTemplates(data);
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      }
    }
    loadUserTemplates();
  }, [user?.id]);

  // Load user saved Sequence templates (Custom Room parity counterpart —
  // same fetch pattern as the Routine templates above, just pointed at
  // sequence_templates instead of timetable_templates).
  useEffect(() => {
    if (!user?.id) return;
    async function loadUserSequenceTemplates() {
      try {
        const { data } = await supabase
          .from("sequence_templates")
          .select("*")
          .eq("user_id", user.id);
        if (data) setSequenceTemplates(data);
      } catch (err) {
        console.error("Failed to fetch sequence templates:", err);
      }
    }
    loadUserSequenceTemplates();
  }, [user?.id]);

  // Load room data and subscribe
  useEffect(() => {
    if (!roomId || !user?.id) return;

    async function fetchRoomDetails() {
      try {
        let profileMap: Record<string, any> = {};
        const { data: memberRows, error: membersError } = await supabase
          .from("study_room_members")
          .select("*")
          .eq("room_id", roomId)
          .in("status", ["joined", "invited"]);

        if (membersError) {
          console.error("Room members fetch error:", membersError);
        }

        if (memberRows) {
          const joinedRows = memberRows.filter((p: any) => p.status === "joined");
          const profileIds = [...new Set(joinedRows.map((p: any) => p.user_id))];

          if (profileIds.length > 0) {
            const { data: profileRows, error: profilesError } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", profileIds);

            if (profilesError) {
              console.error("Room member profiles fetch error:", profilesError);
            }

            (profileRows || []).forEach((prof: any) => {
              profileMap[prof.id] = prof;
            });
          }

          setParticipants(
            joinedRows.map((p: any) => ({ ...p, profile: profileMap[p.user_id] || null }))
          );
        }

        // Fetch the most RECENT 60 messages, not the oldest 60 — ordering
        // ascending with limit(60) always returned the earliest messages
        // ever sent, and since this poll fully replaces `messages` every
        // 4 seconds, any room past 60 total messages had every new
        // message erased on the next poll cycle.
        //
        // This deliberately does NOT use an embedded "sender:profiles(...)"
        // join. That join requires PostgREST to recognize a foreign key
        // between study_room_messages.sender_id and profiles.id, and it
        // currently doesn't (confirmed live: "Could not find a
        // relationship..."), which is why chat has never displayed
        // anything for anyone, regardless of realtime or polling.
        // profileMap is already built above for the member roster — using
        // it here sidesteps the missing-relationship problem entirely
        // instead of just working around a schema issue that could
        // resurface elsewhere.
        const { data: mData, error: messagesError } = await supabase
          .from("study_room_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(60);

        if (messagesError) {
          console.error("Room messages fetch error:", messagesError);
          setChatLoadError(messagesError.message);
        } else {
          setChatLoadError("");
        }

        if (mData) {
          setChatDebugCount(mData.length);
          setMessages(
            [...mData].reverse().map((m: any) => ({
              ...m,
              sender: profileMap[m.sender_id] || null,
            }))
          );
        } else {
          setChatDebugCount(null);
        }
      } catch (err) {
        console.error("fetchRoomDetails unexpected error:", err);
      }
    }

    fetchRoomDetails();

    const interval = setInterval(fetchRoomDetails, 4000);

    // IMPORTANT: this topic name must be unique per mount. A fixed topic
    // name here (e.g. just `room_${roomId}`) causes a duplicate-topic
    // join conflict on Supabase's shared Realtime socket every time this
    // component re-mounts (navigating in/out of the room, StrictMode
    // double-invoke, etc.), which can silently stop postgres_changes
    // delivery for EVERY channel on the connection, not just this one —
    // this is why Live/Sequence and even the Routine tab could both stop
    // syncing without a refresh. The other two room channels in
    // useStudyRooms.ts already use this random-suffix pattern and work
    // correctly; this channel now matches that pattern.
    const freshSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`room_detail:${roomId}:${freshSuffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_room_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              // postgres_changes payloads carry only the raw row — no
              // joined "sender" relation — so payload.new.sender is
              // always undefined here. The sender's profile is already
              // loaded in this room's participant list, so use that
              // instead of showing a nameless "Benchmate" until the next
              // poll happens to refresh it.
              const senderParticipant = participantsRef.current.find(
                (p) => p.user_id === payload.new.sender_id
              );
              return [
                ...prev,
                { ...payload.new, sender: senderParticipant?.profile || null },
              ];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_rooms", filter: `id=eq.${roomId}` },
        () => {
          reloadMyRoom();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, reloadMyRoom]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  function handleCopyCode() {
    if (!myRoom?.room_code) return;
    navigator.clipboard.writeText(myRoom.room_code);
    setCopiedCode(true);
    showToast(`Room code ${myRoom.room_code} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyLink() {
    if (!myRoom?.room_code) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${myRoom.room_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast("Study room invite link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleSendMessage(textToSend?: string) {
    const content = (textToSend || chatInput).trim();
    if (!content || !roomId || !user?.id) return;

    if (!textToSend) setChatInput("");

    const tempId = `msg_${Date.now()}`;
    const myProfile = participantsRef.current.find((p) => p.user_id === user.id)?.profile;
    const newMsg: any = {
      id: tempId,
      room_id: roomId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      sender: myProfile || {
        id: user.id,
        display_name: "You",
        username: user.email?.split("@")[0] || "user",
      },
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      // .select().single() reads back the actual saved row (real id,
      // server timestamp) so the temp placeholder below can be
      // reconciled with it — previously .insert() read nothing back, so
      // the placeholder's fake id never matched the realtime echo's real
      // id, and the sender briefly saw their own message twice.
      const { data: inserted, error } = await supabase
        .from("study_room_messages")
        .insert({ room_id: roomId, sender_id: user.id, content })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        // If realtime already delivered this same row (by real id)
        // before this insert() resolved, just drop the placeholder
        // instead of adding a second copy.
        if (withoutTemp.some((m) => m.id === inserted.id)) return withoutTemp;
        return [...withoutTemp, { ...inserted, sender: newMsg.sender }];
      });
    } catch (err) {
      console.error("Message send error:", err);
      // Roll back the optimistic message — otherwise a failed send still
      // looks like it went through, with no way to tell it didn't.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }

  async function handleStartAdhoc() {
    if (!myRoom?.isHost) return;
    const prefix = adhocType === "Break" ? "Break" : "Study";
    const title = `${prefix}: ${adhocName.trim() || (adhocType === "Break" ? "Break Time" : "Focus Session")}`;
    await startSessionAdhoc({
      taskName: title,
      durationMinutes: Number(adhocMins) || 25,
      alarmId: adhocAlarmId,
    });
    showToast(`Started ${adhocMins}m ${adhocType.toLowerCase()} session for all benchmates!`);
  }

  function resetPeriodForm() {
    setEditingPeriodId(null);
    setPeriodName("");
    setPeriodCategory("");
    setPeriodIsBreak(false);
    setPeriodDuration(25);
    setPeriodAlarmId(null);
    setPeriodColor(null);
  }

  function handleOpenAddPeriod() {
    resetPeriodForm();
    setShowPeriodForm(true);
  }

  function handleOpenEditPeriod(p: any) {
    setEditingPeriodId(p.id);
    setPeriodName(p.name || "");
    setPeriodCategory(p.category || "");
    setPeriodIsBreak(Boolean(p.is_break));
    setPeriodDuration(p.duration_minutes || 25);
    setPeriodAlarmId(p.alarm_id || null);
    setPeriodColor(p.color || null);
    setShowPeriodForm(true);
  }

 const payload = {
      name: periodName.trim(),
      category: periodCategory.trim(),
      isBreak: periodIsBreak,
      durationMinutes: Math.max(1, Number(periodDuration) || 1),
      alarmId: periodAlarmId,
      color: periodColor,
    };

  async function handleSavePeriod(e: FormEvent) {
    e.preventDefault();
    if (!periodName.trim()) return;

    setPeriodSaving(true);

const payload = {
      name: periodName.trim(),
      category: periodCategory.trim(),
      isBreak: periodIsBreak,
      durationMinutes: Math.max(1, Number(periodDuration) || 1),
      alarmId: periodAlarmId,
      color: periodColor,
    };

    const res = editingPeriodId
      ? await updateRoomPeriod(editingPeriodId, payload)
      : await addRoomPeriod(payload);

    setPeriodSaving(false);

    if (res.success) {
      setShowPeriodForm(false);
      resetPeriodForm();
      showToast(editingPeriodId ? "Period updated for everyone." : "Period added to the shared timetable.");
    }
  }

  async function handleDeletePeriod(periodId: string) {
    await deleteRoomPeriod(periodId);
  }

  async function handleApplyPreset(preset: typeof CLASSROOM_PRESETS[0]) {
    if (!myRoom?.isHost) return;
    setLoadingPreset(true);

    const res = await copyPresetIntoRoom(preset.periods);

    if (res.success) {
      const { data: freshPeriods } = await supabase
        .from("study_room_periods")
        .select("*")
        .eq("room_id", myRoom.id)
        .order("sort_order", { ascending: true });

      if (freshPeriods && freshPeriods[0]) {
        await startRoomPeriod(freshPeriods[0] as any);
      }
      showToast(`Loaded "${preset.name}" into the shared classroom!`);
    }

    setLoadingPreset(false);
  }

  async function handleLoadSavedTemplate(tmplId: string) {
    if (!tmplId || !myRoom?.isHost) return;
    setLoadingTemplateId(tmplId);

    const res = await copyTemplateIntoRoom(tmplId);

    if (res.success) {
      const { data: freshPeriods } = await supabase
        .from("study_room_periods")
        .select("*")
        .eq("room_id", myRoom.id)
        .order("sort_order", { ascending: true });

      if (freshPeriods && freshPeriods[0]) {
        await startRoomPeriod(freshPeriods[0] as any);
      }
      showToast("Classroom timetable loaded for everyone!");
    } else if (res.error) {
      showToast(res.error);
    }

    setLoadingTemplateId(null);
  }

  async function handleLoadSavedSequenceTemplate(tmplId: string) {
    if (!tmplId || !myRoom?.isHost) return;
    setLoadingSequenceTemplateId(tmplId);

    const res = await copySequenceTemplateIntoRoom(tmplId);

    if (res.success) {
      const { data: freshPeriods } = await supabase
        .from("study_room_periods")
        .select("*")
        .eq("room_id", myRoom.id)
        .order("sort_order", { ascending: true });

      if (freshPeriods && freshPeriods[0]) {
        await startRoomPeriod(freshPeriods[0] as any);
      }
      showToast("Sequence loaded for everyone!");
    } else if (res.error) {
      showToast(res.error);
    }

    setLoadingSequenceTemplateId(null);
  }

  async function handleStartPeriodByClick(period: any) {
    if (!myRoom?.isHost) return;
    await startRoomPeriod(period);
    showToast(`Switched classroom to ${period.name}!`);
  }

  function handleOpenAddRoutinePeriod() {
    setEditingRoutinePeriod(null);
    setRoutineFormError("");
    setShowRoutineModal(true);
  }

  function handleOpenEditRoutinePeriod(p: RoomRoutinePeriod) {
    setEditingRoutinePeriod(p);
    setRoutineFormError("");
    setShowRoutineModal(true);
  }

  async function handleSaveRoutinePeriod(values: PeriodFormValues) {
    setRoutineSaving(true);
    setRoutineFormError("");

    const res = editingRoutinePeriod
      ? await updateRoomRoutinePeriod(editingRoutinePeriod.id, values)
      : await addRoomRoutinePeriod(values);

    setRoutineSaving(false);

    if (!res.success) {
      setRoutineFormError(res.error || "Could not save this period.");
      return;
    }

    setShowRoutineModal(false);
    setEditingRoutinePeriod(null);
    showToast(editingRoutinePeriod ? "Routine period updated for everyone." : "Added to the shared Routine.");
  }

  async function handleDeleteRoutinePeriod(periodId: string) {
    await deleteRoomRoutinePeriod(periodId);
    showToast("Removed from the shared Routine.");
  }

  async function handleLoadTemplateIntoRoutine(tmplId: string) {
    if (!tmplId || !myRoom?.isHost) return;
    setLoadingRoutineTemplateId(tmplId);

    const res = await copyTemplateIntoRoomRoutine(tmplId);

    if (res.success) {
      showToast("Your timetable was loaded into the Room Routine!");
    } else if (res.error) {
      showToast(res.error);
    }

    setLoadingRoutineTemplateId(null);
  }

  const isHost = Boolean(myRoom?.isHost || myRoom?.host_id === user?.id);
  const isActive = myRoom?.status === "active";
  const isPaused = myRoom?.status === "paused";

  const currentPeriodIdx = roomPeriods.findIndex((p) => p.id === myRoom?.current_room_period_id);
  const currentPeriodName = myRoom?.current_period_name || (isActive ? "Focus Session" : "Standby");
  const isCurrentBreak = currentPeriodName.toLowerCase().includes("break");
  const hasNextPeriod = currentPeriodIdx >= 0 && currentPeriodIdx < roomPeriods.length - 1;

  // If the active Live session was started from a colored Sequence
  // period, its color should show up in the Live card's border/glow too
  // — an ad-hoc session started without a period keeps the existing
  // fixed break/focus look, since there's no color to reflect.
  const currentLivePeriodColor =
    currentPeriodIdx >= 0 ? (roomPeriods[currentPeriodIdx] as any)?.color || null : null;
  const liveColorTreatment = currentLivePeriodColor
    ? getColorGradient(currentLivePeriodColor, theme, 150)
    : null;

  // Closing the room must affect everyone ALREADY inside, immediately —
  // not just block new joins. Only Owner/Host still see and use the room
  // while it's closed. myRoom updates live (realtime + polling), so this
  // clears itself the instant the host reopens — no rejoin needed.
  const isLockedOut = !isHost && Boolean(myRoom?.closed_temporarily || myRoom?.entry_closed);

  function describeMyRoleLabel(): string {
    const role = myRoom?.myMembership?.role;
    if (role === "owner" || myRoom?.host_id === user?.id) return "You created this room";
    if (role === "host") return "You're a co-host here";
    if (role === "moderator") return `Hosted by ${myRoom?.hostProfile?.display_name || "someone else"} — you're a moderator`;
    if (isHost) return "You're hosting";
    return `Hosted by ${myRoom?.hostProfile?.display_name || "Host"}`;
  }

  function describeRoomStatusChip(): { label: string; danger: boolean } {
    if (myRoom?.closed_temporarily) {
      return {
        label: myRoom?.reopens_at
          ? `Closed — reopens ${new Date(myRoom.reopens_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
          : "Closed — waiting for host",
        danger: true,
      };
    }
    if (myRoom?.entry_closed) return { label: "Entry Closed", danger: true };
    return { label: "Open", danger: false };
  }

  if (isLockedOut) {
    return (
      <div style={{ ...styles.page, background: colors.bg, minHeight: "100vh", color: colors.text }}>
        <main style={{ ...styles.dashboard, maxWidth: "480px", margin: "0 auto", padding: "16px 16px 80px", textAlign: "center" }}>
          <button
            type="button"
            style={{
              ...styles.backButton,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              marginBottom: "40px",
            }}
            onClick={onLeave}
          >
            <ArrowLeftIcon />
            Leave Room
          </button>

          <div style={{ padding: "40px 24px", borderRadius: "24px", background: colors.card, border: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px", color: colors.danger }}>
              <DoorOpenIcon width={36} height={36} />
            </div>
            <h2 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 800, color: colors.text }}>
              This room is closed right now
            </h2>
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: colors.textDim }}>
              {myRoom?.hostProfile?.display_name || "The host"} has closed this room
              {myRoom?.closed_temporarily ? " temporarily." : " to new activity."}
            </p>
            {myRoom?.closed_temporarily && myRoom?.reopens_at && (
              <p style={{ margin: "10px 0 0", fontSize: "13px", fontWeight: 700, color: colors.accent }}>
                Reopens {new Date(myRoom.reopens_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            {myRoom?.closed_temporarily && !myRoom?.reopens_at && (
              <p style={{ margin: "10px 0 0", fontSize: "13px", fontWeight: 700, color: colors.textDim }}>
                Wait for the host to reopen it, or check back later.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, background: colors.bg, minHeight: "100vh", color: colors.text }}>
      <main style={{ ...styles.dashboard, maxWidth: "680px", margin: "0 auto", padding: "16px 16px 80px" }}>
        {/* TOP BAR / LEAVE BUTTON */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <button
            type="button"
            style={{
              ...styles.backButton,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={onLeave}
          >
            <ArrowLeftIcon />
            Leave Room
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "12px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.accent,
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title="Copy Room Code"
            >
              {copiedCode ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
              <span>{myRoom?.room_code || "CODE"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "12px",
                background: colors.accentDim,
                border: `1px solid ${colors.accent}`,
                color: colors.accent,
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {copiedLink ? <CheckIcon width={14} height={14} /> : <PlusIcon width={14} height={14} />}
              <span>Invite Link</span>
            </button>
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: "14px",
              borderRadius: "12px",
              background: colors.accentDim,
              border: `1px solid ${colors.accent}`,
              color: colors.accent,
              fontSize: "13px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* ROOM HEADER CARD */}
        <div
          style={{
            padding: "20px 22px",
            borderRadius: "22px",
            background: colors.card,
            border: `1px solid ${colors.border}`,
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: isHost ? colors.accentDim : colors.cardAlt,
                    border: `1px solid ${isHost ? colors.accent : colors.border}`,
                    color: isHost ? colors.accent : colors.textDim,
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {describeMyRoleLabel()}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: describeRoomStatusChip().danger ? "rgba(255, 143, 143, 0.14)" : colors.cardAlt,
                    color: describeRoomStatusChip().danger ? colors.danger : colors.textDim,
                    border: `1px solid ${describeRoomStatusChip().danger ? "rgba(255,143,143,0.3)" : colors.border}`,
                  }}
                >
                  {describeRoomStatusChip().label}
                </span>
                <span style={{ fontSize: "12px", color: colors.textDim }}>
                  {roomMembers.filter((m) => m.status === "joined").length} Studying Together
                </span>
              </div>
              <h1 style={{ margin: "4px 0 2px", fontSize: "22px", fontWeight: 800, color: colors.text }}>
                {myRoom?.name || "Live Classroom & Study Room"}
              </h1>
              <p style={{ margin: 0, fontSize: "13px", color: colors.textDim }}>
                {isHost
                  ? "You are hosting. Build the Routine, control periods and timers for everyone."
                  : `Hosted by ${myRoom?.hostProfile?.display_name || "Host"}. Synchronized with the shared Routine.`}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              {isHost && (
                <button
                  type="button"
                  onClick={() => setShowRoomControlsModal(true)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "12px",
                    background: (myRoom?.entry_closed || myRoom?.closed_temporarily)
                      ? "rgba(255, 143, 143, 0.1)"
                      : colors.cardAlt,
                    border: (myRoom?.entry_closed || myRoom?.closed_temporarily)
                      ? "1px solid rgba(255, 143, 143, 0.3)"
                      : `1px solid ${colors.border}`,
                    color: (myRoom?.entry_closed || myRoom?.closed_temporarily) ? colors.danger : colors.text,
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {(myRoom?.entry_closed || myRoom?.closed_temporarily) ? "Room Closed" : "Room Controls"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "12px",
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <UsersIcon width={14} height={14} />
                <span>+ Mates</span>
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto", paddingBottom: "2px" }}>
          {[
            { id: "session", label: "Live", icon: <ClockIcon width={15} height={15} /> },
            { id: "routine", label: "Routine", icon: <CalendarIcon width={15} height={15} /> },
            { id: "timetable", label: "Sequence Timer", icon: <BookIcon width={15} height={15} /> },
            { id: "benchmates", label: `Mates (${roomMembers.filter((m) => m.status === "joined").length})`, icon: <UsersIcon width={15} height={15} /> },
            { id: "chat", label: `Chat (${messages.length})`, icon: <SendIcon width={15} height={15} /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                flex: "1 0 auto",
                minWidth: "84px",
                padding: "10px 6px",
                borderRadius: "12px",
                border: activeTab === t.id ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: activeTab === t.id ? colors.accentDim : colors.card,
                color: activeTab === t.id ? colors.accent : colors.textDim,
                fontWeight: 800,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TAB: LIVE SESSION */}

        {activeTab === "session" && (
          <div>
            <div
              style={{
                padding: "32px 24px",
                borderRadius: "26px",
                background: isActive
                  ? isCurrentBreak
                    ? "linear-gradient(150deg, #1b2f29 0%, #11191c 70%)"
                    : "linear-gradient(150deg, #13332e 0%, #11191c 70%)"
                  : colors.card,
                border: isActive
                  ? liveColorTreatment
                    ? `1px solid ${liveColorTreatment.border}`
                    : isCurrentBreak
                    ? "1px solid #3c8273"
                    : `1px solid ${colors.accent}`
                  : `1px solid ${colors.border}`,
                boxShadow: isActive
                  ? liveColorTreatment
                    ? `0 18px 50px ${liveColorTreatment.shadowColor}`
                    : "0 18px 50px rgba(88, 216, 196, 0.12)"
                  : "none",
                textAlign: "center",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: isActive ? colors.accent : isPaused ? colors.warning : colors.textDim,
                    boxShadow: isActive ? `0 0 8px ${colors.accent}` : "none",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: 800, color: isActive ? colors.accent : colors.textDim }}>
                  {isActive
                    ? isCurrentBreak
                      ? "CLASSROOM BREAK IN PROGRESS"
                      : "CLASSROOM FOCUS SESSION ACTIVE"
                    : isPaused
                    ? "CLASSROOM SESSION PAUSED"
                    : "CLASSROOM STANDBY — READY"}
                </span>
              </div>

              <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: colors.text }}>
                {currentPeriodName}
              </h2>

              <div
                style={{
                  fontSize: "64px",
                  fontWeight: 900,
                  letterSpacing: "-3px",
                  fontVariantNumeric: "tabular-nums",
                  margin: "12px 0 16px",
                  color: isActive ? colors.accent : colors.text,
                }}
              >
                {isActive || isPaused ? formatRoomTimer(remainingSeconds) : "00:00"}
              </div>

              {isHost ? (
                <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => pauseSession()}
                      style={{
                        padding: "12px 20px",
                        borderRadius: "14px",
                        background: colors.cardAlt,
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        fontWeight: 800,
                        fontSize: "14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <PauseIcon width={16} height={16} />
                      Pause Room
                    </button>
                  ) : isPaused ? (
                    <button
                      type="button"
                      onClick={() => resumeSession()}
                      style={{
                        padding: "12px 20px",
                        borderRadius: "14px",
                        background: colors.accent,
                        border: "none",
                        color: colors.accentText,
                        fontWeight: 800,
                        fontSize: "14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <PlayIcon width={16} height={16} />
                      Resume Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartAdhoc}
                      style={{
                        padding: "12px 22px",
                        borderRadius: "14px",
                        background: colors.accent,
                        border: "none",
                        color: colors.accentText,
                        fontWeight: 800,
                        fontSize: "14px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <PlayIcon width={16} height={16} />
                      Start Group Session
                    </button>
                  )}

                  {(isActive || isPaused) && (
                    <>
                      <button
                        type="button"
                        onClick={() => extendSession(5)}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "14px",
                          background: colors.cardAlt,
                          border: `1px solid ${colors.border}`,
                          color: colors.text,
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        +5 Mins
                      </button>

                      {hasNextPeriod && (
                        <button
                          type="button"
                          onClick={() => startNextRoomPeriod()}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "14px",
                            background: colors.cardAlt,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          Next Period →
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => stopSession()}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "14px",
                          background: "rgba(255, 143, 143, 0.1)",
                          border: "1px solid rgba(255, 143, 143, 0.4)",
                          color: colors.danger,
                          fontWeight: 700,
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <StopIcon width={14} height={14} />
                        Stop Early
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: "12px", color: colors.textDim, fontSize: "13px" }}>
                  {isActive
                    ? "Study session in progress. Stay focused with your benchmates!"
                    : "Waiting for host to start or change period."}
                </div>
              )}
            </div>

            {isHost && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "12px" }}>
                  START CUSTOM GROUP PERIOD
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setAdhocType("Study")}
                    style={{
                      padding: "10px",
                      borderRadius: "12px",
                      border: adhocType === "Study" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                      background: adhocType === "Study" ? colors.accentDim : colors.cardAlt,
                      color: adhocType === "Study" ? colors.accent : colors.textDim,
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <BookIcon width={15} height={15} />
                    Study Period
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdhocType("Break")}
                    style={{
                      padding: "10px",
                      borderRadius: "12px",
                      border: adhocType === "Break" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                      background: adhocType === "Break" ? colors.accentDim : colors.cardAlt,
                      color: adhocType === "Break" ? colors.accent : colors.textDim,
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <CoffeeIcon width={15} height={15} />
                    Group Break
                  </button>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ ...styles.label, color: colors.textDim }}>Period Title / Subject</label>
                  <input
                    type="text"
                    value={adhocName}
                    onChange={(e) => setAdhocName(e.target.value)}
                    placeholder={adhocType === "Break" ? "Break & Refresh" : "Mathematics, Physics, Essay..."}
                    style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ ...styles.label, color: colors.textDim }}>Duration (Minutes)</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[5, 10, 15, 25, 40, 50, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAdhocMins(m)}
                        style={{
                          flex: 1,
                          minWidth: "42px",
                          padding: "8px",
                          borderRadius: "10px",
                          border: adhocMins === m ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          background: adhocMins === m ? colors.accentDim : colors.cardAlt,
                          color: adhocMins === m ? colors.accent : colors.textDim,
                          fontWeight: 800,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <AlarmSelector
                    allAlarms={allAlarms}
                    value={adhocAlarmId}
                    onChange={setAdhocAlarmId}
                    onPreview={playAlarm}
                    styles={styles}
                    label="BELL WHEN THIS ENDS"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStartAdhoc}
                  style={{
                    ...styles.primary,
                    width: "100%",
                    background: colors.accent,
                    color: colors.accentText,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontWeight: 800,
                  }}
                >
                  <PlayIcon width={16} height={16} />
                  Start {adhocMins}m {adhocType} For Classroom
                </button>
              </div>
            )}

            {roomPeriods.length > 0 && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
                    SHARED SEQUENCE TIMETABLE
                  </p>
                  <span style={{ fontSize: "12px", color: colors.textDim }}>
                    {roomPeriods.length} Periods Total
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {roomPeriods.map((p, idx) => {
                    const isCur = p.id === myRoom?.current_room_period_id;
                    const isPast = currentPeriodIdx >= 0 && idx < currentPeriodIdx;
                    // Color-coded left border: custom color if the host
                    // picked one for this Sequence period, otherwise the
                    // existing default (amber for breaks, teal for study) —
                    // same fallback pattern used everywhere else in the app.
                    const accentColor = (p as any).color || (p.is_break ? colors.warning : colors.accent);

                    return (
                      <div
                        key={p.id}
                        onClick={() => isHost && handleStartPeriodByClick(p)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: isCur ? colors.accentDim : colors.cardAlt,
                          border: isCur ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          borderLeft: `4px solid ${accentColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: isHost ? "pointer" : "default",
                          opacity: isPast ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              background: p.is_break ? "rgba(232, 196, 104, 0.15)" : colors.accentDim,
                              color: p.is_break ? colors.warning : colors.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            {p.is_break ? <CoffeeIcon width={14} height={14} /> : <BookIcon width={14} height={14} />}
                          </div>

                          <div>
                            <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "14px", color: colors.text }}>
                              {p.name}
                            </p>
                            <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                              {p.category} · {p.duration_minutes}m
                            </p>
                          </div>
                        </div>

                        {isCur ? (
                          <span style={{ fontSize: "11px", fontWeight: 800, color: colors.accent, padding: "4px 8px", borderRadius: "6px", background: colors.card }}>
                            ACTIVE NOW
                          </span>
                        ) : isHost ? (
                          <span style={{ fontSize: "12px", color: colors.textDim }}>Tap to start →</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ROUTINE */}
        {activeTab === "routine" && (
          <div>
            <div
              style={{
                padding: "24px",
                borderRadius: "22px",
                background: currentRoomRoutinePeriod
                  ? getColorGradient((currentRoomRoutinePeriod as any)?.color, theme, 145).background
                  : colors.card,
                border: currentRoomRoutinePeriod
                  ? `1px solid ${getColorGradient((currentRoomRoutinePeriod as any)?.color, theme, 145).border}`
                  : `1px solid ${colors.border}`,
                marginBottom: "16px",
              }}
            >
              <p style={{ ...styles.cardLabel, color: colors.textDim }}>
                {currentRoomRoutinePeriod ? "HAPPENING NOW" : "ROOM ROUTINE"}
              </p>

              {currentRoomRoutinePeriod ? (
                <>
                  <h2 style={{ margin: "8px 0 4px", fontSize: "22px", color: colors.text }}>
                    {currentRoomRoutinePeriod.name}
                  </h2>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 800, color: colors.accent, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {currentRoomRoutinePeriod.category}
                  </p>
                  <p style={{ margin: "0 0 14px", color: colors.textDim, fontSize: "13px" }}>
                    {formatClockTime(currentRoomRoutinePeriod.start_time)} – {formatClockTime(currentRoomRoutinePeriod.end_time)}
                  </p>
                  <div style={{ padding: "14px 16px", borderRadius: "14px", background: colors.cardAlt, border: `1px solid ${colors.border}` }}>
                    <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: 800, letterSpacing: "1px", color: colors.textDim }}>
                      TIME REMAINING
                    </p>
                    <strong style={{ fontSize: "22px", color: colors.text }}>
                      {formatRoutineRemaining(currentRoomRoutineSeconds)}
                    </strong>
                  </div>
                </>
              ) : nextRoomRoutinePeriod ? (
                <>
                  <h2 style={{ margin: "8px 0 4px", fontSize: "20px", color: colors.text }}>
                    Next: {nextRoomRoutinePeriod.name}
                  </h2>
                  <p style={{ margin: "0 0 4px", color: colors.textDim, fontSize: "13px" }}>
                    Starts at {formatClockTime(nextRoomRoutinePeriod.start_time)} · in {formatRoutineRemaining(nextRoomRoutineSeconds)}
                  </p>
                </>
              ) : (
                <p style={{ ...styles.cardText, marginTop: "8px", color: colors.textDim }}>
                  {roomRoutinePeriods.length === 0
                    ? "No Routine set up for this room yet."
                    : "Nothing scheduled right now."}
                </p>
              )}
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
                  SHARED ROOM ROUTINE
                </p>
                {isHost && (
                  <button
                    type="button"
                    onClick={handleOpenAddRoutinePeriod}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "10px",
                      background: colors.accentDim,
                      border: `1px solid ${colors.accent}`,
                      color: colors.accent,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <PlusIcon width={13} height={13} />
                    Add Period
                  </button>
                )}
              </div>
              <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 14px" }}>
                {isHost
                  ? "This is a real clock-time Routine, same as your personal one — everyone in the room sees it live."
                  : "This is the room's shared Routine. Only the host can edit it."}
              </p>

              {roomRoutineMessage && (
                <p style={{ color: colors.danger, fontSize: "13px", fontWeight: 700, margin: "0 0 10px" }}>
                  {roomRoutineMessage}
                </p>
              )}

              {roomRoutineLoading ? (
                <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
                  Loading Routine...
                </p>
              ) : roomRoutinePeriods.length === 0 ? (
                <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                  No periods yet.{" "}
                  {isHost ? "Add one above, or load one of your saved timetables below." : "Waiting for the host to build one."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {roomRoutinePeriods.map((p) => {
                    const isCur = currentRoomRoutinePeriod?.id === p.id;
                    const isDone = completedRoomRoutine.some((c) => c.id === p.id);
                    // Color-coded left border: custom color if the host
                    // picked one for this Room Routine period, otherwise
                    // the existing default (amber for breaks, teal for
                    // study) — same fallback pattern used everywhere else
                    // (Routine.tsx, Planner.tsx, TemplateBuilder.tsx).
                    const accentColor = (p as any).color || (p.is_break ? colors.warning : colors.accent);

                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: isCur ? colors.accentDim : colors.cardAlt,
                          border: isCur ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          borderLeft: `4px solid ${accentColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          opacity: isDone ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              background: p.is_break ? "rgba(232, 196, 104, 0.15)" : colors.accentDim,
                              color: p.is_break ? colors.warning : colors.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {p.is_break ? <CoffeeIcon width={14} height={14} /> : <BookIcon width={14} height={14} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "14px", color: colors.text }}>
                              {p.name}
                            </p>
                            <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                              {formatClockTime(p.start_time)} – {formatClockTime(p.end_time)}
                              {p.category ? ` · ${p.category}` : ""}
                            </p>
                          </div>
                        </div>

                        {isCur && (
                          <span style={{ fontSize: "11px", fontWeight: 800, color: colors.accent, flexShrink: 0 }}>
                            NOW
                          </span>
                        )}

                        {isHost && (
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditRoutinePeriod(p)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.text,
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoutinePeriod(p.id)}
                              style={{
                                padding: "6px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.danger,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                              }}
                              aria-label="Delete period"
                            >
                              <TrashIcon width={13} height={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isHost && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "6px" }}>
                  LOAD YOUR SAVED TIMETABLE
                </p>
                <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
                  Copies one of your personal timetables' clock-times into this room's shared Routine.
                  Your original timetable stays untouched.
                </p>

                {templates.length === 0 ? (
                  <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                    No saved timetables found. Create one in the Planner first.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          background: colors.cardAlt,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: colors.text }}>
                          {t.name}
                        </h4>

                        <button
                          type="button"
                          onClick={() => handleLoadTemplateIntoRoutine(t.id)}
                          disabled={loadingRoutineTemplateId === t.id}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "12px",
                            background: colors.accentDim,
                            border: `1px solid ${colors.accent}`,
                            color: colors.accent,
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                            opacity: loadingRoutineTemplateId === t.id ? 0.6 : 1,
                          }}
                        >
                          {loadingRoutineTemplateId === t.id ? "Loading..." : "Load into Room"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* TAB: TIMETABLE */}
        {activeTab === "timetable" && (
          <div>
            <div
              style={{
                padding: "20px",
                borderRadius: "20px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
                  SHARED SEQUENCE TIMETABLE
                </p>
                {isHost && (
                  <button
                    type="button"
                    onClick={handleOpenAddPeriod}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "10px",
                      background: colors.accentDim,
                      border: `1px solid ${colors.accent}`,
                      color: colors.accent,
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <PlusIcon width={13} height={13} />
                    Add Period
                  </button>
                )}
              </div>
              <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 14px" }}>
                Duration-based blocks (e.g. Pomodoro). For a real clock-time schedule, use the Routine tab instead.
              </p>

              {roomPeriodsLoading ? (
                <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
                  Loading timetable...
                </p>
              ) : roomPeriods.length === 0 ? (
                <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                  No periods yet.{" "}
                  {isHost ? "Add one above, or load a preset/saved timetable below." : "Waiting for the host to set one up."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {roomPeriods.map((p, idx) => {
                    const isCur = p.id === myRoom?.current_room_period_id;
                    // Color-coded left border: same fallback pattern used
                    // everywhere else in the app (amber for breaks, teal
                    // for study, or the host's own custom color).
                    const accentColor = (p as any).color || (p.is_break ? colors.warning : colors.accent);
                    const isDragging = isHost && roomPeriodDraggingIndex === idx;
                    const handleProps = isHost ? getRoomPeriodHandleProps(idx) : null;
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: isCur ? colors.accentDim : colors.cardAlt,
                          border: isCur ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          borderLeft: `4px solid ${accentColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          opacity: isDragging ? 0.92 : 1,
                          ...(isHost ? getRoomPeriodRowStyle(idx) : {}),
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                          {isHost && handleProps && (
                            <span
                              {...handleProps}
                              style={{ ...handleProps.style, color: colors.textDim, display: "flex", flexShrink: 0 }}
                              aria-label="Drag to reorder"
                            >
                              <DragHandleIcon width={16} height={16} />
                            </span>
                          )}
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              background: p.is_break ? "rgba(232, 196, 104, 0.15)" : colors.accentDim,
                              color: p.is_break ? colors.warning : colors.accent,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {p.is_break ? <CoffeeIcon width={14} height={14} /> : <BookIcon width={14} height={14} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "14px", color: colors.text }}>
                              {p.name}
                            </p>
                            <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                              {p.category} · {p.duration_minutes}m
                            </p>
                          </div>
                        </div>

                        {isHost && (
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPeriod(p)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.text,
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePeriod(p.id)}
                              style={{
                                padding: "6px",
                                borderRadius: "8px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.danger,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                              }}
                              aria-label="Delete period"
                            >
                              <TrashIcon width={13} height={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {showPeriodForm && isHost && (
                <form
                  onSubmit={handleSavePeriod}
                  style={{
                    marginTop: "14px",
                    padding: "14px",
                    borderRadius: "14px",
                    background: colors.cardAlt,
                    border: `1px dashed ${colors.border}`,
                  }}
                >
                  <p style={{ ...styles.cardLabel, marginBottom: "10px" }}>
                    {editingPeriodId ? "EDIT PERIOD" : "NEW PERIOD"}
                  </p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setPeriodIsBreak(false)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "10px",
                        border: !periodIsBreak ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                        background: !periodIsBreak ? colors.accentDim : colors.card,
                        color: !periodIsBreak ? colors.accent : colors.textDim,
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Study Period
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodIsBreak(true)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "10px",
                        border: periodIsBreak ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                        background: periodIsBreak ? colors.accentDim : colors.card,
                        color: periodIsBreak ? colors.accent : colors.textDim,
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Break
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Period name (e.g. Physics Revision, Lunch Break)"
                    value={periodName}
                    onChange={(e) => setPeriodName(e.target.value)}
                    style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                    required
                  />

                  {!periodIsBreak && (
                    <input
                      type="text"
                      placeholder="Subject (e.g. Physics, History)"
                      value={periodCategory}
                      onChange={(e) => setPeriodCategory(e.target.value)}
                      style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                    />
                  )}

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ ...styles.label, color: colors.textDim }}>Duration (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={periodDuration}
                      onChange={(e) => setPeriodDuration(Math.max(1, Number(e.target.value) || 1))}
                      style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <AlarmSelector
                      allAlarms={allAlarms}
                      value={periodAlarmId}
                      onChange={setPeriodAlarmId}
                      onPreview={playAlarm}
                      styles={styles}
                      label="COMPLETION ALARM"
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <ColorSelector
                      value={periodColor}
                      onChange={setPeriodColor}
                      disabled={periodSaving}
                      styles={styles}
                      label="PERIOD COLOR"
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="submit"
                      disabled={periodSaving}
                      style={{
                        ...styles.primary,
                        flex: 1,
                        background: colors.accent,
                        color: colors.accentText,
                        fontWeight: 800,
                      }}
                    >
                      {periodSaving ? "Saving..." : editingPeriodId ? "Save Changes" : "Add to Timetable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPeriodForm(false);
                        resetPeriodForm();
                      }}
                      disabled={periodSaving}
                      style={{
                        ...styles.secondary,
                        background: colors.card,
                        color: colors.textDim,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {isHost && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "6px" }}>
                  CLASSROOM PRESET ROUTINES
                </p>
                <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
                  Replaces the room's current Sequence timetable with a ready-made routine for everyone.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {CLASSROOM_PRESETS.map((preset, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "16px",
                        borderRadius: "16px",
                        background: colors.cardAlt,
                        border: `1px solid ${colors.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: colors.text }}>
                          {preset.name}
                        </h3>
                        <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                          {preset.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        disabled={loadingPreset}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "12px",
                          background: colors.accent,
                          color: colors.accentText,
                          border: "none",
                          fontWeight: 800,
                          fontSize: "12px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          opacity: loadingPreset ? 0.6 : 1,
                        }}
                      >
                        {loadingPreset ? "Loading..." : "Load Preset"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isHost && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "6px" }}>
                  YOUR SAVED TIMETABLE TEMPLATES
                </p>
                <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
                  Copies one of your personal timetables into this room's Sequence schedule as durations.
                </p>

                {templates.length === 0 ? (
                  <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                    No saved templates found. Create one in the Planner to use here!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          background: colors.cardAlt,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: colors.text }}>
                          {t.name}
                        </h4>

                        <button
                          type="button"
                          onClick={() => handleLoadSavedTemplate(t.id)}
                          disabled={loadingTemplateId === t.id}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "12px",
                            background: colors.accentDim,
                            border: `1px solid ${colors.accent}`,
                            color: colors.accent,
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                            opacity: loadingTemplateId === t.id ? 0.6 : 1,
                          }}
                        >
                          {loadingTemplateId === t.id ? "Loading..." : "Load into Room"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isHost && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  marginBottom: "16px",
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "6px" }}>
                  YOUR SAVED SEQUENCE TEMPLATES
                </p>
                <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
                  Copies one of your personal Sequences (built in the Sequence tab) into this room's shared
                  timetable for everyone.
                </p>

                {sequenceTemplates.length === 0 ? (
                  <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                    No saved Sequences found. Create one in the Timer tab's Sequence section to use here!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {sequenceTemplates.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "14px",
                          background: colors.cardAlt,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: colors.text }}>
                          {t.name}
                        </h4>

                        <button
                          type="button"
                          onClick={() => handleLoadSavedSequenceTemplate(t.id)}
                          disabled={loadingSequenceTemplateId === t.id}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "12px",
                            background: colors.accentDim,
                            border: `1px solid ${colors.accent}`,
                            color: colors.accent,
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                            opacity: loadingSequenceTemplateId === t.id ? 0.6 : 1,
                          }}
                        >
                          {loadingSequenceTemplateId === t.id ? "Loading..." : "Load into Room"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: BENCHMATES */}
        {activeTab === "benchmates" && (
          <div
            style={{
              padding: "20px",
              borderRadius: "20px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <p style={{ ...styles.cardLabel, color: colors.accent, margin: "0 0 2px" }}>
                  ACTIVE BENCHMATES
                </p>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: colors.text }}>
                  {roomMembers.filter((m) => m.status === "joined").length} Studying in Room
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "12px",
                  background: colors.accent,
                  color: colors.accentText,
                  border: "none",
                  fontWeight: 800,
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <PlusIcon width={14} height={14} />
                Invite Friends
              </button>
            </div>

            {membersMessage && (
              <p style={{ color: colors.danger, fontSize: "13px", fontWeight: 700, margin: "0 0 12px" }}>
                {membersMessage}
              </p>
            )}

            {membersLoading ? (
              <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>
                Loading members...
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {roomMembers
                  .filter((m) => m.status === "joined")
                  .map((member) => {
                    const isMe = member.user_id === user?.id;
                    const label = member.profile?.display_name || "Grow & Glow";
                    const showMenuFor = openMemberMenuId === member.id;
                    const actable = !isMe && canActOn(member);
                    const isActingOnThis = actingOnId === member.id;

                    return (
                      <div
                        key={member.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: isMe ? colors.accentDim : colors.cardAlt,
                          border: isMe ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <AvatarDisplay
                              avatarUrl={member.profile?.avatar_url}
                              name={label}
                              size={36}
                              radius="circle"
                              background={isMe ? colors.accent : colors.card}
                              color={isMe ? colors.accentText : colors.accent}
                              border={isMe ? "none" : `1px solid ${colors.border}`}
                            />

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: "14px", color: colors.text }}>
                                  {label}
                                  {isMe && " (You)"}
                                </p>
                                <RoleBadge role={member.role} colors={colors} />
                                {member.muted && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      color: colors.danger,
                                      padding: "2px 6px",
                                      borderRadius: "6px",
                                      background: "rgba(255, 143, 143, 0.12)",
                                    }}
                                  >
                                    MUTED
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: "2px 0 0", fontSize: "12px", color: colors.textDim }}>
                                @{member.profile?.username || "user"}
                              </p>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: colors.accent,
                              }}
                            />
                            {actable && (
                              <button
                                type="button"
                                onClick={() => setOpenMemberMenuId(showMenuFor ? null : member.id)}
                                disabled={isActingOnThis}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: showMenuFor ? colors.accentDim : "transparent",
                                  color: colors.text,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                aria-label="Member actions"
                              >
                                <MoreIcon width={15} height={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MANAGEMENT MENU */}
                        {showMenuFor && actable && (
                          <div
                            style={{
                              marginTop: "10px",
                              paddingTop: "10px",
                              borderTop: `1px solid ${colors.border}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            {canManage && member.role === "member" && (
                              <MenuButton
                                colors={colors}
                                label="Promote to Moderator"
                                onClick={async () => {
                                  await promoteToModerator(member);
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {canManage && (member.role === "member" || member.role === "moderator") && (
                              <MenuButton
                                colors={colors}
                                label="Promote to Host"
                                onClick={async () => {
                                  await promoteToHost(member);
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {canManage && member.role === "moderator" && (
                              <MenuButton
                                colors={colors}
                                label="Demote to Member"
                                onClick={async () => {
                                  await demoteToMember(member);
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {isOwner && member.role === "host" && (
                              <MenuButton
                                colors={colors}
                                label="Demote to Member"
                                onClick={() => {
                                  setConfirmAction({ kind: "demote", member });
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {isOwner && member.role === "host" && (
                              <MenuButton
                                colors={colors}
                                label="Transfer Ownership to This Member"
                                onClick={() => {
                                  setConfirmAction({ kind: "transfer", member });
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {canModerate && (
                              <MenuButton
                                colors={colors}
                                label={member.muted ? "Unmute" : "Mute"}
                                onClick={async () => {
                                  await toggleMute(member);
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {canModerate && (
                              <MenuButton
                                colors={colors}
                                label="Remove from Room"
                                danger
                                onClick={() => {
                                  setConfirmAction({ kind: "remove", member });
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                            {canModerate && (
                              <MenuButton
                                colors={colors}
                                label="Ban from Room"
                                danger
                                onClick={() => {
                                  setConfirmAction({ kind: "ban", member });
                                  setOpenMemberMenuId(null);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* MEMBER ACTION CONFIRMATION DIALOG */}
        {confirmAction && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              zIndex: 1100,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "400px",
                padding: "24px",
                borderRadius: "20px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 800 }}>
                {confirmAction.kind === "remove" && "Remove this member?"}
                {confirmAction.kind === "ban" && "Ban this member?"}
                {confirmAction.kind === "transfer" && "Transfer ownership?"}
                {confirmAction.kind === "demote" && "Demote this host?"}
              </h3>
              <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 20px" }}>
                {confirmAction.kind === "remove" &&
                  `${confirmAction.member.profile?.display_name} will be removed from the room. They can rejoin with a new invite or the room code.`}
                {confirmAction.kind === "ban" &&
                  `${confirmAction.member.profile?.display_name} will be permanently banned from this room and cannot rejoin.`}
                {confirmAction.kind === "transfer" &&
                  `You will become a Host and ${confirmAction.member.profile?.display_name} will become the new Owner of this room. This cannot be undone by you alone.`}
                {confirmAction.kind === "demote" &&
                  `${confirmAction.member.profile?.display_name} will lose Host permissions and become a regular Member.`}
              </p>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={async () => {
                    const m = confirmAction.member;
                    if (confirmAction.kind === "remove") await removeMember(m);
                    if (confirmAction.kind === "ban") await banMember(m);
                    if (confirmAction.kind === "transfer") await transferOwnership(m);
                    if (confirmAction.kind === "demote") await demoteToMember(m);
                    setConfirmAction(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: confirmAction.kind === "transfer" ? colors.accent : colors.danger,
                    color: confirmAction.kind === "transfer" ? colors.accentText : "#fff",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.textDim,
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CHAT */}
        {activeTab === "chat" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "460px",
              borderRadius: "22px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <p style={{ ...styles.cardLabel, color: colors.accent, margin: 0 }}>
                CLASSROOM CHAT & MOTIVATION
              </p>
              <span style={{ fontSize: "11px", color: colors.textDim }}>
                {messages.length} messages
              </span>
            </div>

            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", marginBottom: "8px" }}>
              {QUICK_REACTIONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(r)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "8px 0",
              }}
            >
       {chatLoadError ? (
                <p style={{ color: "#ff6b6b", fontSize: "13px", textAlign: "center", margin: "auto" }}>
                  Chat failed to load: {chatLoadError}
                </p>
              ) : messages.length === 0 ? (
                <p style={{ color: colors.textDim, fontSize: "13px", textAlign: "center", margin: "auto" }}>
                  No messages yet. Send a greeting or cheer your benchmates!
                  <br />
                  <span style={{ fontSize: "10px", opacity: 0.6 }}>
                    debug: room={roomId} user={user?.id} rows={chatDebugCount === null ? "not fetched" : chatDebugCount}
                  </span>
                </p>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user?.id;

                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isMe ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        padding: "10px 14px",
                        borderRadius: "16px",
                        background: isMe ? colors.accentDim : colors.cardAlt,
                        border: isMe ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                      }}
                    >
                      {!isMe && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                          <AvatarDisplay
                            avatarUrl={m.sender?.avatar_url}
                            name={m.sender?.display_name}
                            size={16}
                            radius="circle"
                          />
                          <p style={{ margin: 0, fontSize: "11px", color: colors.accent, fontWeight: 800 }}>
                            {m.sender?.display_name || "Benchmate"}
                          </p>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: "13px", color: colors.text, wordBreak: "break-word" }}>
                        {m.content}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ display: "flex", gap: "8px", marginTop: "8px" }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message classroom..."
                style={{
                  ...styles.input,
                  marginBottom: 0,
                  flex: 1,
                  background: colors.cardAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              />
              <button
                type="submit"
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  border: "none",
                  background: colors.accent,
                  color: colors.accentText,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="Send Message"
              >
                <SendIcon width={18} height={18} />
              </button>
            </form>
          </div>
        )}

        {/* INVITE BENCHMATES MODAL */}
        {showInviteModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "460px",
                padding: "24px",
                borderRadius: "22px",
                background: colors.card,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Invite Benchmates</h3>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: colors.textDim,
                    fontSize: "18px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 16px" }}>
                Send instant invites to your benchmates or share the room code <strong>{myRoom?.room_code}</strong>.
              </p>

              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    background: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Copy Code ({myRoom?.room_code})
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    background: colors.accentDim,
                    border: `1px solid ${colors.accent}`,
                    color: colors.accent,
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Copy Invite Link
                </button>
              </div>

              <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>YOUR BENCHMATES</p>
              {friends.length === 0 ? (
                <p style={{ fontSize: "13px", color: colors.textDim, textAlign: "center", padding: "12px 0" }}>
                  No friends added yet. Add friends on the Benchmates page to invite them with one tap!
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
                  {friends.map((f: any) => (
                    <div
                      key={f.friendshipId}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: colors.cardAlt,
                        border: `1px solid ${colors.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <AvatarDisplay
                          avatarUrl={f.profile?.avatar_url}
                          name={f.profile?.display_name}
                          size={32}
                          radius="rounded"
                          background={colors.card}
                          color={colors.accent}
                        />
                        <div>
                          <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "14px", color: colors.text }}>
                            {f.profile?.display_name}
                          </p>
                          <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                            @{f.profile?.username}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await inviteFriendToRoom(f.profile.id);
                          showToast(`Invited ${f.profile?.display_name}!`);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "10px",
                          background: colors.accent,
                          color: colors.accentText,
                          border: "none",
                          fontWeight: 800,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ROOM CONTROLS MODAL — Owner/Host only: close entry, temporarily
          close (with optional reopen time), reopen, or (Owner only)
          permanently close the room. */}
      {showRoomControlsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              borderRadius: "22px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Room Controls</h3>
              <button
                type="button"
                onClick={() => setShowRoomControlsModal(false)}
                style={{ background: "transparent", border: "none", color: colors.textDim, fontSize: "18px", fontWeight: 700, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 18px" }}>
              Control whether new people can join this room.
            </p>

            {(myRoom?.closed_temporarily || myRoom?.entry_closed) && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(255, 143, 143, 0.1)",
                  border: "1px solid rgba(255, 143, 143, 0.3)",
                  color: colors.danger,
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "16px",
                }}
              >
                {myRoom?.closed_temporarily
                  ? myRoom?.reopens_at
                    ? `Temporarily closed — reopens ${new Date(myRoom.reopens_at).toLocaleString()}`
                    : "Temporarily closed — no auto-reopen time set"
                  : "Entry closed — no new members can join or be invited"}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {!myRoom?.closed_temporarily && (
                <button
                  type="button"
                  disabled={roomControlsSaving}
                  onClick={async () => {
                    setRoomControlsSaving(true);
                    await setRoomEntryClosed(!myRoom?.entry_closed);
                    setRoomControlsSaving(false);
                  }}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: `1px solid ${colors.border}`,
                    background: colors.cardAlt,
                    color: colors.text,
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {myRoom?.entry_closed ? "Reopen Entry (allow new joins)" : "Close Entry Only (block new joins)"}
                </button>
              )}

              {!myRoom?.closed_temporarily ? (
                <div style={{ padding: "12px", borderRadius: "12px", border: `1px dashed ${colors.border}` }}>
                  <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: colors.textDim }}>
                    TEMPORARILY CLOSE ROOM
                  </p>
                  <input
                    type="datetime-local"
                    value={reopenAtInput}
                    onChange={(e) => setReopenAtInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: `1px solid ${colors.border}`,
                      background: colors.cardAlt,
                      color: colors.text,
                      fontSize: "13px",
                      marginBottom: "8px",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ margin: "0 0 10px", fontSize: "11px", color: colors.textDim }}>
                    Optional — leave blank to close indefinitely until manually reopened.
                  </p>
                  <button
                    type="button"
                    disabled={roomControlsSaving}
                    onClick={async () => {
                      setRoomControlsSaving(true);
                      const iso = reopenAtInput ? new Date(reopenAtInput).toISOString() : null;
                      await closeRoomTemporarily(iso);
                      setRoomControlsSaving(false);
                      setReopenAtInput("");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background: colors.warning,
                      color: "#071012",
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Temporarily Close Room
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={roomControlsSaving}
                  onClick={async () => {
                    setRoomControlsSaving(true);
                    await reopenRoom();
                    setRoomControlsSaving(false);
                  }}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: colors.accent,
                    color: colors.accentText,
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Reopen Room Now
                </button>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setShowRoomControlsModal(false);
                    setShowPermanentCloseConfirm(true);
                  }}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 143, 143, 0.4)",
                    background: "rgba(255, 143, 143, 0.1)",
                    color: colors.danger,
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                    marginTop: "8px",
                  }}
                >
                  Permanently Close Room
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT CLOSE CONFIRMATION — Owner only, irreversible */}
      {showPermanentCloseConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1300,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "24px",
              borderRadius: "20px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 800 }}>
              Permanently close this room?
            </h3>
            <p style={{ fontSize: "13px", color: colors.textDim, margin: "0 0 20px" }}>
              This ends the room for everyone immediately and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={roomControlsSaving}
                onClick={async () => {
                  setRoomControlsSaving(true);
                  const res = await closeRoomPermanently();
                  setRoomControlsSaving(false);
                  setShowPermanentCloseConfirm(false);
                  if (res.success) onLeave();
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: colors.danger,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Permanently Close
              </button>
              <button
                type="button"
                onClick={() => setShowPermanentCloseConfirm(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${colors.border}`,
                  background: "transparent",
                  color: colors.textDim,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <PeriodFormModal
        open={showRoutineModal}
        title={editingRoutinePeriod ? "Edit Room Routine Period" : "Add Room Routine Period"}
        initialValues={
          editingRoutinePeriod
            ? {
                name: editingRoutinePeriod.name,
                category: editingRoutinePeriod.category || "",
                isBreak: Boolean(editingRoutinePeriod.is_break),
                startTime: editingRoutinePeriod.start_time?.slice(0, 5),
                endTime: editingRoutinePeriod.end_time?.slice(0, 5),
                alarmId: editingRoutinePeriod.alarm_id || null,
              }
            : undefined
        }
        allAlarms={allAlarms}
        onPreviewAlarm={playAlarm}
        onSave={handleSaveRoutinePeriod}
        onCancel={() => {
          setShowRoutineModal(false);
          setEditingRoutinePeriod(null);
          setRoutineFormError("");
        }}
        saving={routineSaving}
        errorMessage={routineFormError}
        styles={styles}
      />

      {/* ROOM ROUTINE RATING POPUP — same parity as personal Routine's
          pendingRatingSession, just backed by room_period_sessions */}
      {pendingRoomRoutineRating && (
        <RatingModal
          title="How was your focus?"
          subtitle={pendingRoomRoutineRating.name}
          onSubmit={async (rating, note) => {
            await submitRoomRoutineRating(pendingRoomRoutineRating, rating, note);
          }}
          onSkip={dismissRoomRoutineRating}
          styles={styles}
        />
      )}
    </div>
  );
}