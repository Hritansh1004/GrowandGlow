import { useState } from "react";
import { AppStyles } from "../hooks/useStyles";
import useNotifications from "../hooks/useNotifications";
import useFriends from "../hooks/useFriends";
import useStudyRooms from "../hooks/useStudyRooms";
import { ArrowLeftIcon, BellIcon, TrashIcon, CheckIcon } from "../components/Icons";
import AvatarDisplay from "../components/AvatarDisplay";

interface NotificationsProps {
  user: any;
  setPage: (page: string) => void;
  openStudyRoom?: (roomId: string) => void;
  styles: AppStyles;
}

export default function Notifications({ user, setPage, openStudyRoom, styles }: NotificationsProps) {
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    markActioned,
    deleteNotification,
  } = useNotifications(user?.id);

  const { acceptFriendRequest, declineFriendRequest } = useFriends(user?.id);
  const { respondToInvite, reloadMyRoom } = useStudyRooms(user?.id);

  const [actingId, setActingId] = useState<string | null>(null);

  async function handleAcceptFriend(n: any) {
    setActingId(n.id);
    const requestId = n.payload?.request_id;
    if (requestId) {
      await acceptFriendRequest(requestId);
    }
    await markActioned(n.id, "accepted");
    setActingId(null);
  }

  async function handleDeclineFriend(n: any) {
    setActingId(n.id);
    const requestId = n.payload?.request_id;
    if (requestId) {
      await declineFriendRequest(requestId);
    }
    await markActioned(n.id, "declined");
    setActingId(null);
  }

  async function handleJoinRoom(n: any) {
    setActingId(n.id);
    const membershipId = n.payload?.membership_id;
    const roomId = n.payload?.room_id;
    if (!membershipId || !roomId) {
      setActingId(null);
      return;
    }

    const res = await respondToInvite(membershipId, true);
    setActingId(null);

    if (res.success) {
      await markActioned(n.id, "joined");
      await reloadMyRoom();
      if (openStudyRoom) {
        openStudyRoom(roomId);
      } else {
        setPage("friends");
      }
    }
  }

  async function handleDeclineRoom(n: any) {
    setActingId(n.id);
    const membershipId = n.payload?.membership_id;
    if (membershipId) {
      await respondToInvite(membershipId, false);
    }
    await markActioned(n.id, "declined");
    setActingId(null);
  }

  function statusLabelFor(result: string) {
    if (result === "accepted") return { text: "Accepted", color: "#58d8c4" };
    if (result === "joined") return { text: "Joined", color: "#58d8c4" };
    return { text: "Declined", color: "#829096" };
  }

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        {/* BACK BUTTON */}
        <button
          type="button"
          style={{ ...styles.backButton, display: "inline-flex", alignItems: "center", gap: "8px" }}
          onClick={() => setPage("dashboard")}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        <div style={styles.timerHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={styles.eyebrow}>INBOX</p>
              <h1 style={styles.routineTitle}>Notifications</h1>
              <p style={styles.cardText}>
                Friend requests, study room invites, and reminders.
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                style={{
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid #202c30",
                  background: "#11191c",
                  color: "#58d8c4",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={styles.timerInfoCard}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "#63d8c7" }}>
              <BellIcon width={28} height={28} />
            </div>
            <p style={{ ...styles.cardText, textAlign: "center" }}>No notifications right now.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notifications.map((n) => {
              const isFriendRequest = n.type === "friend_request_received";
              const isFriendAccepted = n.type === "friend_request_accepted";
              const isRoomInvite = n.type === "room_invite_received";
              const actioned = n.action_result;
              const isActingOnThis = actingId === n.id;

              return (
                <div
                  key={n.id}
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    background: n.is_read ? "#11191c" : "#19322f",
                    border: n.is_read ? "1px solid #202c30" : "1px solid #2f6f67",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "10px" }}
                      onClick={() => !n.is_read && markRead(n.id)}
                    >
                      {(isFriendRequest || isFriendAccepted || isRoomInvite) && (
                        <AvatarDisplay
                          avatarUrl={n.fromProfile?.avatar_url}
                          name={n.fromProfile?.display_name}
                          size={32}
                          radius="rounded"
                          background="#19322f"
                          color="#58d8c4"
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: "14px" }}>
                          {isFriendRequest
                            ? `${n.fromProfile?.display_name || "Someone"} sent you a Benchmate request`
                            : isFriendAccepted
                            ? `${n.fromProfile?.display_name || "Someone"} accepted your Benchmate request`
                            : isRoomInvite
                            ? `${n.fromProfile?.display_name || "Someone"} invited you to "${n.payload?.room_name || "a study room"}"`
                            : "New Notification"}
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#829096" }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                          {isRoomInvite && n.payload?.room_code ? ` · Code: ${n.payload.room_code}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        background: "transparent",
                        border: "none",
                        color: "#829096",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => deleteNotification(n.id)}
                      aria-label="Delete notification"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>

                  {/* ACTION ROW — persisted via action_result, so this
                      survives reloads instead of re-showing live buttons
                      on something already handled. */}
                  {isFriendRequest && n.payload?.request_id && (
                    <>
                      {actioned ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "10px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.04)",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: statusLabelFor(actioned).color,
                          }}
                        >
                          {actioned === "accepted" && <CheckIcon width={12} height={12} />}
                          {statusLabelFor(actioned).text}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <button
                            type="button"
                            onClick={() => handleAcceptFriend(n)}
                            disabled={isActingOnThis}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "10px",
                              border: "none",
                              background: "#58d8c4",
                              color: "#071012",
                              fontSize: "12px",
                              fontWeight: 800,
                              cursor: isActingOnThis ? "default" : "pointer",
                              opacity: isActingOnThis ? 0.6 : 1,
                            }}
                          >
                            {isActingOnThis ? "..." : "Accept"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineFriend(n)}
                            disabled={isActingOnThis}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "10px",
                              border: "1px solid #293438",
                              background: "transparent",
                              color: "#9ba8ad",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: isActingOnThis ? "default" : "pointer",
                              opacity: isActingOnThis ? 0.6 : 1,
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {isRoomInvite && n.payload?.membership_id && (
                    <>
                      {actioned ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "10px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.04)",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: statusLabelFor(actioned).color,
                          }}
                        >
                          {actioned === "joined" && <CheckIcon width={12} height={12} />}
                          {statusLabelFor(actioned).text}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <button
                            type="button"
                            onClick={() => handleJoinRoom(n)}
                            disabled={isActingOnThis}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "10px",
                              border: "none",
                              background: "#58d8c4",
                              color: "#071012",
                              fontSize: "12px",
                              fontWeight: 800,
                              cursor: isActingOnThis ? "default" : "pointer",
                              opacity: isActingOnThis ? 0.6 : 1,
                            }}
                          >
                            {isActingOnThis ? "..." : "Join Room"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRoom(n)}
                            disabled={isActingOnThis}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "10px",
                              border: "1px solid #293438",
                              background: "transparent",
                              color: "#9ba8ad",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: isActingOnThis ? "default" : "pointer",
                              opacity: isActingOnThis ? 0.6 : 1,
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}