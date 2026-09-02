import { useState, type FormEvent } from "react";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import useFriends from "../hooks/useFriends";
import useStudyRooms from "../hooks/useStudyRooms";
import AvatarDisplay from "../components/AvatarDisplay";
import {
  ArrowLeftIcon,
  UsersIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
} from "../components/Icons";

interface FriendsProps {
  user: any;
  setPage: (page: string) => void;
  openStudyRoom: (roomId: string) => void;
  styles: AppStyles;
}

export default function Friends({
  user,
  setPage,
  openStudyRoom,
  styles,
}: FriendsProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const {
    friends,
    friendsLoading,
    incomingRequests,
    requestsMessage,
    searchTerm,
    setSearchTerm,
    searchResults,
    searching,
    searchUsers,
    getRelationStatus,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useFriends(user?.id);

  const {
    myRoom,
    roomMessage,
    actionLoading,
    createRoom,
    joinRoomByCode,
    removeRoomFromDashboard,
    restoreRoomToDashboard,
  } = useStudyRooms(user?.id);

  const [activeTab, setActiveTab] = useState<"benchmates" | "rooms">("benchmates");
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [dismissingRoom, setDismissingRoom] = useState(false);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    searchUsers();
  }

  async function handleCreateRoom(e: FormEvent) {
    e.preventDefault();
    if (!roomNameInput.trim()) return;
    const res = await createRoom({ name: roomNameInput.trim() });
    if (res.success && res.room?.id) {
      setRoomNameInput("");
      setShowCreateRoom(false);
      openStudyRoom(res.room.id);
    }
  }

  async function handleJoinByCode(e: FormEvent) {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    const res = await joinRoomByCode(roomCodeInput.trim());
    if (res.success && res.room?.id) {
      setRoomCodeInput("");
      openStudyRoom(res.room.id);
    }
  }

  // Hides this room's card from this user's own dashboard/Friends view
  // only. Does not touch their membership, history, or standing in the
  // room — if they rejoin later (code, invite, etc.), dashboard_hidden is
  // reset to false automatically and the card reappears.
  async function handleDismissRoomCard() {
    const confirmed = window.confirm(
      "Remove from your dashboard? You'll stay a member — this just hides the card."
    );
    if (!confirmed) return;
    setDismissingRoom(true);
    await removeRoomFromDashboard();
    setDismissingRoom(false);
  }

  // Un-hides a dismissed room card. Needed because a still-active member
  // never goes through a rejoin/accept-invite path (the only two places
  // that reset dashboard_hidden) — without this the "X" was a one-way
  // door.
  async function handleRestoreRoomCard() {
    await restoreRoomToDashboard();
  }

  const showActiveRoomCard = Boolean(myRoom) && !myRoom?.myMembership?.dashboard_hidden;
  const showHiddenRoomBanner = Boolean(myRoom) && myRoom?.myMembership?.dashboard_hidden;

  // Plain-language "which room is this to me" label, so it's obvious at
  // a glance whether this is a room the user created, a room they were
  // promoted to co-host in, or someone else's room they simply joined.
  function describeMyRoomRole(): string {
    const role = myRoom?.myMembership?.role;
    if (role === "owner" || myRoom?.host_id === user?.id) return "You created this room";
    if (role === "host") return "You're a co-host here";
    if (role === "moderator") return `Hosted by ${myRoom?.hostProfile?.display_name || "someone else"} — you're a moderator`;
    return `Hosted by ${myRoom?.hostProfile?.display_name || "someone else"}`;
  }

  function describeRoomStatus(): { label: string; danger: boolean } {
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

  return (
    <div style={{ ...styles.page, background: colors.bg, minHeight: "100vh", color: colors.text }}>
      <main style={{ ...styles.dashboard, maxWidth: "680px", margin: "0 auto", padding: "16px 16px 80px" }}>
        {/* BACK TO DASHBOARD */}
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
          onClick={() => setPage("dashboard")}
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>SOCIAL & GROUP STUDY</p>
          <h1 style={{ ...styles.routineTitle, color: colors.text }}>Benchmates & Rooms</h1>
          <p style={{ ...styles.cardText, color: colors.textDim }}>
            Study together, sync classroom timetables, keep each other accountable, and join live rooms.
          </p>
        </div>

        {(requestsMessage || roomMessage) && (
          <p style={{ ...styles.message, color: colors.accent }}>{requestsMessage || roomMessage}</p>
        )}

        {/* TABS */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("benchmates")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "14px",
              border: activeTab === "benchmates" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
              background: activeTab === "benchmates" ? colors.accentDim : colors.card,
              color: activeTab === "benchmates" ? colors.accent : colors.textDim,
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Benchmates ({friends.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "14px",
              border: activeTab === "rooms" ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
              background: activeTab === "rooms" ? colors.accentDim : colors.card,
              color: activeTab === "rooms" ? colors.accent : colors.textDim,
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Study Rooms {showActiveRoomCard ? "(1 Active)" : ""}
          </button>
        </div>

        {/* =====================
            TAB 1: BENCHMATES
        ===================== */}
        {activeTab === "benchmates" && (
          <>
            {/* FIND / SEARCH BENCHMATES */}
            <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}` }}>
              <p style={{ ...styles.cardLabel, color: colors.accent }}>FIND BENCHMATES</p>
              <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  type="text"
                  placeholder="Search by username or name..."
                  style={{ ...styles.input, marginBottom: 0, flex: 1, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={searching}
                  style={{
                    padding: "0 18px",
                    borderRadius: "14px",
                    border: "none",
                    background: colors.accent,
                    color: colors.accentText,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <SearchIcon width={16} height={16} />
                  {searching ? "..." : "Search"}
                </button>
              </form>

              {/* SEARCH RESULTS */}
              {searchResults.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {searchResults.map((userRes) => {
                    const status = getRelationStatus(userRes.id);

                    return (
                      <div
                        key={userRes.id}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "12px",
                          background: colors.cardAlt,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <AvatarDisplay
                            avatarUrl={userRes.avatar_url}
                            name={userRes.display_name}
                            size={32}
                            radius="rounded"
                            background={colors.card}
                            color={colors.accent}
                          />
                          <div>
                            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "13px", color: colors.text }}>
                              {userRes.display_name}
                            </p>
                            <p style={{ margin: 0, fontSize: "11px", color: colors.textDim }}>
                              @{userRes.username}
                            </p>
                          </div>
                        </div>

                        {status === "friends" ? (
                          <span style={{ fontSize: "11px", color: colors.accent, fontWeight: 700 }}>
                            Benchmates
                          </span>
                        ) : status === "pending_outgoing" ? (
                          <span style={{ fontSize: "11px", color: colors.warning, fontWeight: 700 }}>
                            Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "none",
                              background: colors.accent,
                              color: colors.accentText,
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            onClick={() => sendFriendRequest(userRes.id)}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* INCOMING REQUESTS */}
            {incomingRequests.length > 0 && (
              <section style={{ marginTop: "16px" }}>
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "8px" }}>
                  INCOMING REQUESTS ({incomingRequests.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "16px",
                        background: colors.accentDim,
                        border: `1px solid ${colors.accent}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <AvatarDisplay
                          avatarUrl={req.profile?.avatar_url}
                          name={req.profile?.display_name}
                          size={36}
                          radius="rounded"
                          background={colors.card}
                          color={colors.accent}
                        />
                        <div>
                          <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "14px", color: colors.text }}>
                            {req.profile?.display_name || req.profile?.username}
                          </p>
                          <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                            @{req.profile?.username}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          style={{
                            padding: "8px 14px",
                            borderRadius: "10px",
                            border: "none",
                            background: colors.accent,
                            color: colors.accentText,
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                          onClick={() => acceptFriendRequest(req.id)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: `1px solid ${colors.border}`,
                            background: "transparent",
                            color: colors.textDim,
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          onClick={() => declineFriendRequest(req.id)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* BENCHMATES LIST */}
            <section style={{ marginTop: "20px" }}>
              <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "10px" }}>
                YOUR BENCHMATES ({friends.length})
              </p>

              {friendsLoading ? (
                <div style={{ ...styles.timerInfoCard, background: colors.card, border: `1px solid ${colors.border}` }}>
                  <p style={{ ...styles.cardText, color: colors.textDim }}>Loading benchmates...</p>
                </div>
              ) : friends.length === 0 ? (
                <div style={{ ...styles.timerInfoCard, background: colors.card, border: `1px solid ${colors.border}` }}>
                  <p style={{ ...styles.cardText, color: colors.text }}>No benchmates added yet.</p>
                  <p style={{ ...styles.tipText, color: colors.textDim }}>
                    Search for your study partners above to see their activity and invite them to study rooms.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {friends.map((f) => (
                    <div
                      key={f.friendshipId}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "16px",
                        background: colors.card,
                        border: `1px solid ${colors.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <AvatarDisplay
                          avatarUrl={f.profile?.avatar_url}
                          name={f.profile?.display_name}
                          size={36}
                          radius="rounded"
                          background={colors.accentDim}
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
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: "transparent",
                          color: colors.danger,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => removeFriend(f.friendshipId)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* =====================
            TAB 2: STUDY ROOMS
        ===================== */}
        {activeTab === "rooms" && (
          <>
            {/* ACTIVE ROOM CARD IF USER IS ALREADY IN A ROOM AND HASN'T
                DISMISSED IT FROM THEIR OWN DASHBOARD VIEW */}
            {showActiveRoomCard && (
              <section
                style={{
                  position: "relative",
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.accentDim,
                  border: `1px solid ${colors.accent}`,
                  marginBottom: "16px",
                }}
              >
                {/* DISMISS ("X") — hides this card from just this user's
                    dashboard. Does not leave the room or affect anyone
                    else; reappears automatically if they rejoin later. */}
                <button
                  type="button"
                  onClick={handleDismissRoomCard}
                  disabled={dismissingRoom}
                  aria-label="Remove from dashboard"
                  title="Remove from dashboard (you'll stay a member)"
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    width: "26px",
                    height: "26px",
                    borderRadius: "8px",
                    border: "none",
                    background: "rgba(0,0,0,0.12)",
                    color: colors.textDim,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: dismissingRoom ? "default" : "pointer",
                    opacity: dismissingRoom ? 0.6 : 1,
                  }}
                >
                  <XIcon width={13} height={13} />
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingRight: "30px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: colors.accent, fontWeight: 800, letterSpacing: "1px" }}>
                        ACTIVE ROOM
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          background: describeRoomStatus().danger ? "rgba(255, 143, 143, 0.14)" : colors.card,
                          color: describeRoomStatus().danger ? colors.danger : colors.textDim,
                          border: `1px solid ${describeRoomStatus().danger ? "rgba(255,143,143,0.3)" : colors.border}`,
                        }}
                      >
                        {describeRoomStatus().label}
                      </span>
                    </div>
                    <h2 style={{ margin: "0 0 2px", fontSize: "18px", color: colors.text }}>
                      {myRoom?.name || "Focus Study Room"}
                    </h2>
                    <p style={{ margin: "0 0 2px", fontSize: "12px", color: colors.accent, fontWeight: 700 }}>
                      {describeMyRoomRole()}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                      Room Code: <strong style={{ color: colors.text }}>{myRoom?.room_code}</strong> · {myRoom?.members?.length || 1} member(s)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    marginTop: "14px",
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: colors.accent,
                    color: colors.accentText,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onClick={() => myRoom && openStudyRoom(myRoom.id)}
                >
                  Enter Room
                </button>
              </section>
            )}

            {/* HIDDEN ROOM RESTORE — the "X" dismiss on the card above only
                hides it from view; it never actually removes membership.
                Since a still-active member has no other way back to a
                dismissed card, this small banner is the way back. */}
            {showHiddenRoomBanner && (
              <section
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: colors.card,
                  border: `1px dashed ${colors.border}`,
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                  You have a room you're still a member of, hidden from this view.
                </p>
                <button
                  type="button"
                  onClick={handleRestoreRoomCard}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: `1px solid ${colors.accent}`,
                    background: colors.accentDim,
                    color: colors.accent,
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Show It Again
                </button>
              </section>
            )}

            {/* JOIN ROOM BY CODE */}
            <section style={{ ...styles.timerCard, background: colors.card, border: `1px solid ${colors.border}`, marginBottom: "16px" }}>
              <p style={{ ...styles.cardLabel, color: colors.accent }}>JOIN WITH ROOM CODE</p>
              <form onSubmit={handleJoinByCode} style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  type="text"
                  placeholder="Enter 6-character code"
                  style={{
                    ...styles.input,
                    marginBottom: 0,
                    flex: 1,
                    textTransform: "uppercase",
                    background: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: "0 18px",
                    borderRadius: "14px",
                    border: "none",
                    background: colors.accent,
                    color: colors.accentText,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Join
                </button>
              </form>
            </section>

            {/* CREATE ROOM BUTTON & MODAL / FORM */}
            {!showCreateRoom ? (
              <button
                type="button"
                style={{
                  ...styles.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: colors.accent,
                  color: colors.accentText,
                  fontWeight: 800,
                }}
                onClick={() => setShowCreateRoom(true)}
              >
                <PlusIcon width={18} height={18} />
                Create New Study Room
              </button>
            ) : (
              <form
                onSubmit={handleCreateRoom}
                style={{
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p style={{ ...styles.cardLabel, color: colors.accent, marginBottom: "12px" }}>CREATE STUDY ROOM</p>
                <input
                  type="text"
                  placeholder="Room Name (e.g. Deep Work Classroom)"
                  style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  required
                />

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="submit"
                    style={{
                      ...styles.primary,
                      flex: 1,
                      background: colors.accent,
                      color: colors.accentText,
                      fontWeight: 800,
                    }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Creating..." : "Launch Room"}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.secondary,
                      background: colors.cardAlt,
                      color: colors.textDim,
                      border: `1px solid ${colors.border}`,
                    }}
                    onClick={() => setShowCreateRoom(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}