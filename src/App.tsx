import { useState, useEffect, useMemo, type FormEvent } from "react";
import useStyles from "./hooks/useStyles";
import useAuth from "./hooks/useAuth";
import useAudioUnlock from "./hooks/useAudioUnlock";
import useTimer from "./hooks/useTimer";
import useRoutine from "./hooks/useRoutine";
import usePlanner from "./hooks/usePlanner";
import { ensureAllBellChannels } from "./services/notificationService";
import useDailyReview from "./hooks/useDailyReview";
import useStudyRooms from "./hooks/useStudyRooms";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { useLenis } from "./hooks/useLenis";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Routine from "./pages/Routine";
import Timer from "./pages/Timer";
import Planner from "./pages/Planner";
import TemplateBuilder from "./pages/TemplateBuilder";
import SequenceBuilder from "./pages/SequenceBuilder";
import WeeklySchedule from "./pages/WeeklySchedule";
import Calendar from "./pages/Calendar";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Friends from "./pages/Friends";
import StudyRoom from "./pages/StudyRoom";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";

import BottomNav from "./components/BottomNav";
import DailyReviewModal from "./components/DailyReviewModal";

export default function App() {
  const styles = useStyles();
  useAudioUnlock();
  useLenis();
  useEffect(() => {
    ensureAllBellChannels();
  }, []);

  const [page, setPage] = useState("home");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSequenceTemplateId, setSelectedSequenceTemplateId] = useState<string | null>(null);
  const [activeStudyRoomId, setActiveStudyRoomId] = useState<string | null>(null);

  // "onboarding" is the original forced first-time setup screen (shown
  // whenever profileIsComplete is false, regardless of `page`).
  // "edit" is the new revisitable Account & Profile screen opened from
  // Settings — it reuses the same Profile.tsx component but prefills the
  // existing bio/avatar and returns to Settings on save/cancel instead of
  // forcing the user back into onboarding.
  const [profileMode, setProfileMode] = useState<"onboarding" | "edit">("onboarding");

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    user,
    profile,
    profileError,
    loading: authLoading,
    isPasswordRecovery,
    login,
    signup,
    saveProfile,
    logout,
    sendPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    uploadAvatar,
    refreshProfile,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Forgot Password / Set New Password local form state, kept separate
  // from the login email/password fields above so switching between
  // Login <-> Forgot Password never clobbers what the user typed into
  // either form.
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newPasswordMessage, setNewPasswordMessage] = useState("");
  const [newPasswordSubmitting, setNewPasswordSubmitting] = useState(false);

  // A profile row existing isn't enough on its own — it also needs a
  // real username, since some accounts can end up with an auto-created
  // row (see diagnostic SQL in the handoff notes) that only has a
  // display name derived from the email and no username at all. Those
  // should still be routed to Profile.tsx to finish setup.
  const profileIsComplete = Boolean(profile && profile.username);

  useEffect(() => {
    // Password recovery takes priority over every other redirect. It is
    // checked directly in the render logic below (before the !user
    // check), so this effect deliberately leaves `page` alone while it's
    // true instead of racing it.
    if (isPasswordRecovery) return;

    if (
      user &&
      profileIsComplete &&
      (page === "home" || page === "login" || page === "signup" || page === "forgot-password")
    ) {
      setPage("dashboard");
    } else if (user && !profileIsComplete && !profileError && !authLoading) {
      setProfileMode("onboarding");
      setPage("profile");
    } else if (
      !user &&
      !authLoading &&
      page !== "login" &&
      page !== "signup" &&
      page !== "forgot-password"
    ) {
      setPage("home");
    }
  }, [user, profileIsComplete, profileError, authLoading, isPasswordRecovery]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthMessage("");
    setFormSubmitting(true);
    const res = await login(email, password);
    setFormSubmitting(false);
    if (res?.error) {
      setAuthMessage(res.error.message || "Failed to log in.");
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setAuthMessage("");
    setFormSubmitting(true);
    const res = await signup(email, password);
    setFormSubmitting(false);
    if (res?.error) {
      setAuthMessage(res.error.message || "Failed to sign up.");
    } else if (res?.needsEmailConfirmation) {
      setAuthMessage("Almost there — we sent a confirmation link to your email. Click it to activate your account, then come back and log in.");
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setAuthMessage("");
    setFormSubmitting(true);
    const res = await saveProfile({ displayName, username, bio, avatarUrl });
    setFormSubmitting(false);
    if (res?.error) {
      setAuthMessage(res.error.message || "Failed to save profile.");
    } else if (profileMode === "edit") {
      setPage("settings");
    } else {
      setPage("dashboard");
    }
  }

  // Opens Profile.tsx in revisitable "edit" mode from Settings, prefilling
  // the form with whatever is already saved so the user isn't staring at
  // blank fields for a profile that's already set up.
  function handleOpenProfileEditor() {
    setDisplayName(profile?.display_name || "");
    setUsername(profile?.username || "");
    setBio(profile?.bio || "");
    setAvatarUrl(profile?.avatar_url || null);
    setAuthMessage("");
    setProfileMode("edit");
    setPage("profile");
  }

  function handleCancelProfileEdit() {
    setAuthMessage("");
    setPage("settings");
  }

  async function handleSendPasswordReset(e: FormEvent) {
    e.preventDefault();
    setResetMessage("");
    setResetSubmitting(true);
    const res = await sendPasswordReset(resetEmail);
    setResetSubmitting(false);
    if (res?.error) {
      setResetEmailSent(false);
      setResetMessage(res.error.message || "Failed to send reset email.");
    } else {
      setResetEmailSent(true);
      setResetMessage("Check your email for a link to reset your password.");
    }
  }

  function handleBackToLoginFromReset() {
    setResetMessage("");
    setResetEmailSent(false);
    setPage("login");
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault();
    setNewPasswordMessage("");

    if (newPassword !== confirmNewPassword) {
      setNewPasswordMessage("Passwords do not match.");
      return;
    }

    setNewPasswordSubmitting(true);
    const res = await updatePassword(newPassword);
    setNewPasswordSubmitting(false);

    if (res?.error) {
      setNewPasswordMessage(res.error.message || "Failed to update password.");
    } else {
      setNewPassword("");
      setConfirmNewPassword("");
      // updatePassword already clears isPasswordRecovery internally, but
      // the redirect effect above only re-runs on user/profileIsComplete/
      // authLoading changes — none of which change at this exact moment —
      // so `page` is set explicitly here rather than left to that effect.
      setPage(profileIsComplete ? "dashboard" : "profile");
    }
  }

  // Lets the user back out of the recovery "Set New Password" screen
  // without changing their password. Supabase already created a real
  // logged-in session the moment the recovery link was opened (see the
  // comment on isPasswordRecovery in useAuth.ts), so backing out returns
  // them into the app rather than to a logged-out state.
  function handleCancelPasswordRecovery() {
    setNewPasswordMessage("");
    clearPasswordRecovery();
    setPage(profileIsComplete ? "dashboard" : "profile");
  }
  const {
    routine,
    routineSource,
    routineLabel,
    routineLoading,
    routineMessage,
    currentRoutineItem,
    nextRoutineItem,
    currentRoutineSeconds,
    nextRoutineSeconds,
    completedRoutine,
    remainingRoutine,
    pendingRatingSession,
    submitPeriodRating,
    dismissPeriodRating,
    pendingPlannerRating,
    dismissPlannerRating,
    togglePlannerItemInRoutine,
    submitPlannerRatingInRoutine,
    editRoutineItem,
    deleteRoutineItem,
    formatRemaining,
    timeToMinutes,
  } = useRoutine(user?.id);

  const {
    activeTimer,
    remainingSeconds,
    timerLoading,
    timerMessage,
    pendingRatingTimer,
    submitTimerRating,
    dismissRating,
    pendingNextPhase,
    startNextPomodoroPhase,
    skipPomodoroPhase,
    startPomodoroCycle,
    stopPomodoroCycle,
    recentTimers,
    startCustomTimer,
    pauseCustomTimer,
    resumeCustomTimer,
    stopCustomTimer,
    formatTimer,
  } = useTimer(user?.id);

  const {
    plannerTasks,
    plannerTitle,
    plannerSubject,
    plannerDate,
    plannerStartTime,
    plannerEndTime,
    plannerAlarmId,
    plannerColor,
    setPlannerTitle,
    setPlannerSubject,
    setPlannerDate,
    setPlannerStartTime,
    setPlannerEndTime,
    setPlannerAlarmId,
    setPlannerColor,
    plannerLoading,
    plannerMessage,
    editingTask,
    addPlannerTask,
    editPlannerTask,
    updatePlannerTask,
    togglePlannerTask,
    deletePlannerTask,
    clearPlannerForm,
    todayTasks,
    completedTodayTasks,
    remainingTodayTasks,
    nextPlannerTask,
    plannerItems,
    plannerItemsLoading,
    plannerItemsMessage,
    editPlannerItem,
    deletePlannerItem,
    togglePlannerItemComplete,
    submitPlannerItemRatingAction,
  } = usePlanner(user?.id);

  const {
    pendingReview,
    submitDailyReview,
    dismissDailyReview,
    saving: reviewSaving,
    reviewMessage,
  } = useDailyReview(user?.id, routine, routineLoading, routineSource);

  const { joinRoomByCode, roomMessage: inviteLinkMessage } = useStudyRooms(user?.id);
  const [inviteLinkHandled, setInviteLinkHandled] = useState(false);

  function handleOpenTemplateBuilder(templateId: string) {
    setSelectedTemplateId(templateId);
    setPage("template-builder");
  }

  function handleOpenSequenceBuilder(templateId: string) {
    setSelectedSequenceTemplateId(templateId);
    setPage("sequence-builder");
  }

  function handleOpenStudyRoom(roomId: string) {
    setActiveStudyRoomId(roomId);
    setPage("study-room");
  }

  useEffect(() => {
    if (inviteLinkHandled) return;
    if (!user || !profileIsComplete) return;

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    if (!roomCode) {
      setInviteLinkHandled(true);
      return;
    }

    setInviteLinkHandled(true);

    (async () => {
      const res = await joinRoomByCode(roomCode);

      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      if (res.success && res.room) {
        handleOpenStudyRoom(res.room.id);
      } else {
        setAuthMessage(res.error || "Could not join that study room.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileIsComplete, inviteLinkHandled]);

  const totalFocusMinutesToday = useMemo(() => {
    const todayStr = new Date().toDateString();

    const routineMinutes = (completedRoutine || [])
      .filter((item: any) => item.type === "Study")
      .reduce((sum: number, item: any) => {
        const startMin = timeToMinutes ? timeToMinutes(item.time) : 0;
        const endMin = timeToMinutes ? timeToMinutes(item.end) : 0;
        return sum + Math.max(0, endMin - startMin);
      }, 0);

    const timerMinutes = (recentTimers || [])
      .filter(
        (t: any) =>
          t.status === "completed" &&
          t.start_timestamp &&
          new Date(t.start_timestamp).toDateString() === todayStr
      )
      .reduce((sum: number, t: any) => sum + (t.duration_seconds || 0) / 60, 0);

    return Math.round(routineMinutes + timerMinutes);
  }, [completedRoutine, recentTimers, timeToMinutes]);

  if (authLoading) {
    return (
      <div style={styles.page}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <p style={styles.cardText}>Loading Benchmate...</p>
        </div>
      </div>
    );
  }

  // Password recovery overrides everything else, including a completed
  // profile and normal dashboard access — the user must set a new
  // password before doing anything else in the app.
  if (isPasswordRecovery) {
    return (
      <ResetPassword
        newPassword={newPassword}
        confirmNewPassword={confirmNewPassword}
        setNewPassword={setNewPassword}
        setConfirmNewPassword={setConfirmNewPassword}
        onSubmit={handleSetNewPassword}
        onCancel={handleCancelPasswordRecovery}
        loading={newPasswordSubmitting}
        message={newPasswordMessage}
        styles={styles}
      />
    );
  }

  if (!user) {
    if (page === "login") {
      return (
        <Login
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          login={handleLogin}
          loading={formSubmitting}
          message={authMessage}
          setMessage={setAuthMessage}
          setPage={setPage}
          styles={styles}
        />
      );
    }

    if (page === "signup") {
      return (
        <Signup
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          signup={handleSignup}
          loading={formSubmitting}
          message={authMessage}
          setMessage={setAuthMessage}
          setPage={setPage}
          styles={styles}
        />
      );
    }

    if (page === "forgot-password") {
      return (
        <ForgotPassword
          email={resetEmail}
          setEmail={setResetEmail}
          onSubmit={handleSendPasswordReset}
          loading={resetSubmitting}
          message={resetMessage}
          emailSent={resetEmailSent}
          onBackToLogin={handleBackToLoginFromReset}
          setPage={setPage}
          styles={styles}
        />
      );
    }

    return (
      <Home
        onGetStarted={() => setPage("signup")}
        onLogin={() => setPage("login")}
      />
    );
  }

  if (!profileIsComplete && profileError) {
    return (
      <div style={styles.page}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "12px", textAlign: "center", padding: "24px" }}>
          <p style={styles.cardText}>
            We couldn't load your profile ({profileError}). This is usually temporary.
          </p>
          <button type="button" style={styles.primary} onClick={() => refreshProfile()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!profileIsComplete) {
    return (
      <Profile
        mode="onboarding"
        displayName={displayName}
        username={username}
        bio={bio}
        avatarUrl={avatarUrl}
        setDisplayName={setDisplayName}
        setUsername={setUsername}
        setBio={setBio}
        setAvatarUrl={setAvatarUrl}
        uploadAvatar={uploadAvatar}
        saveProfile={handleSaveProfile}
        loading={formSubmitting}
        message={authMessage}
        styles={styles}
      />
    );
  }

  const showBottomNav =
    page !== "study-room" &&
    page !== "template-builder" &&
    page !== "sequence-builder" &&
    page !== "profile";

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {page === "dashboard" && (
        <Dashboard
          profile={profile}
          user={user}
          currentTime={currentTime}
          currentRoutineItem={currentRoutineItem}
          nextRoutineItem={nextRoutineItem}
          todayTasks={todayTasks}
          completedTodayTasks={completedTodayTasks}
          remainingTodayTasks={remainingTodayTasks}
          nextPlannerTask={nextPlannerTask}
          setPage={setPage}
          setMessage={setAuthMessage}
          logout={logout}
          message={authMessage}
          styles={styles}
        />
      )}

      {page === "routine" && (
        <Routine
          user={user}
          routine={routine}
          routineSource={routineSource}
          routineLabel={routineLabel}
          routineLoading={routineLoading}
          routineMessage={routineMessage}
          currentTime={currentTime}
          currentRoutineItem={currentRoutineItem}
          nextRoutineItem={nextRoutineItem}
          currentRoutineSeconds={currentRoutineSeconds}
          nextRoutineSeconds={nextRoutineSeconds}
          completedRoutine={completedRoutine}
          remainingRoutine={remainingRoutine}
          formatRemaining={formatRemaining}
          pendingRatingSession={pendingRatingSession}
          submitPeriodRating={submitPeriodRating}
          dismissPeriodRating={dismissPeriodRating}
          pendingPlannerRating={pendingPlannerRating}
          dismissPlannerRating={dismissPlannerRating}
          togglePlannerItemInRoutine={togglePlannerItemInRoutine}
          submitPlannerRatingInRoutine={submitPlannerRatingInRoutine}
          editRoutineItem={editRoutineItem}
          deleteRoutineItem={deleteRoutineItem}
          setPage={setPage}
          styles={styles}
        />
      )}

      {page === "timer" && (
        <Timer
          user={user}
          activeTimer={activeTimer}
          remainingSeconds={remainingSeconds}
          timerLoading={timerLoading}
          timerMessage={timerMessage}
          pendingRatingTimer={pendingRatingTimer}
          submitTimerRating={submitTimerRating}
          dismissRating={dismissRating}
          pendingNextPhase={pendingNextPhase}
          startNextPomodoroPhase={startNextPomodoroPhase}
          skipPomodoroPhase={skipPomodoroPhase}
          startPomodoroCycle={startPomodoroCycle}
          stopPomodoroCycle={stopPomodoroCycle}
          recentTimers={recentTimers}
          startCustomTimer={startCustomTimer}
          pauseCustomTimer={pauseCustomTimer}
          resumeCustomTimer={resumeCustomTimer}
          stopCustomTimer={stopCustomTimer}
          formatTimer={formatTimer}
          setPage={setPage}
          openSequenceBuilder={handleOpenSequenceBuilder}
          styles={styles}
        />
      )}

      {page === "planner" && (
        <Planner
          user={user}
          plannerTasks={plannerTasks}
          plannerTitle={plannerTitle}
          plannerSubject={plannerSubject}
          plannerDate={plannerDate}
          plannerStartTime={plannerStartTime}
          plannerEndTime={plannerEndTime}
          plannerAlarmId={plannerAlarmId}
          plannerColor={plannerColor}
          setPlannerTitle={setPlannerTitle}
          setPlannerSubject={setPlannerSubject}
          setPlannerDate={setPlannerDate}
          setPlannerStartTime={setPlannerStartTime}
          setPlannerEndTime={setPlannerEndTime}
          setPlannerAlarmId={setPlannerAlarmId}
          setPlannerColor={setPlannerColor}
          plannerLoading={plannerLoading}
          plannerMessage={plannerMessage}
          editingTask={editingTask}
          addPlannerTask={addPlannerTask}
          editPlannerTask={editPlannerTask}
          updatePlannerTask={updatePlannerTask}
          togglePlannerTask={togglePlannerTask}
          deletePlannerTask={deletePlannerTask}
          clearPlannerForm={clearPlannerForm}
          setPage={setPage}
          openTemplateBuilder={handleOpenTemplateBuilder}
          styles={styles}
          plannerItems={plannerItems}
          plannerItemsLoading={plannerItemsLoading}
          plannerItemsMessage={plannerItemsMessage}
          editPlannerItem={editPlannerItem}
          deletePlannerItem={deletePlannerItem}
          togglePlannerItemComplete={togglePlannerItemComplete}
          submitPlannerItemRatingAction={submitPlannerItemRatingAction}
        />
      )}

      {page === "template-builder" && (
        <TemplateBuilder
          user={user}
          templateId={selectedTemplateId}
          onBack={() => setPage("planner")}
          styles={styles}
        />
      )}

      {page === "sequence-builder" && (
        <SequenceBuilder
          user={user}
          templateId={selectedSequenceTemplateId}
          onBack={() => setPage("timer")}
          startCustomTimer={startCustomTimer}
          onStarted={() => setPage("timer")}
          styles={styles}
        />
      )}

      {page === "weekly-schedule" && (
        <WeeklySchedule
          user={user}
          onBack={() => setPage("planner")}
          styles={styles}
        />
      )}

      {page === "calendar" && (
        <Calendar
          user={user}
          onBack={() => setPage("planner")}
          styles={styles}
        />
      )}

      {page === "history" && (
        <History
          user={user}
          setPage={setPage}
          styles={styles}
        />
      )}

      {page === "analytics" && (
        <Analytics
          user={user}
          setPage={setPage}
          styles={styles}
        />
      )}

      {page === "friends" && (
        <Friends
          user={user}
          setPage={setPage}
          openStudyRoom={handleOpenStudyRoom}
          styles={styles}
        />
      )}

      {page === "study-room" && (
        <StudyRoom
          user={user}
          roomId={activeStudyRoomId}
          onLeave={() => setPage("friends")}
          styles={styles}
        />
      )}

      {page === "notifications" && (
        <Notifications
          user={user}
          setPage={setPage}
          openStudyRoom={handleOpenStudyRoom}
          styles={styles}
        />
      )}

      {page === "profile" && (
        <Profile
          mode="edit"
          displayName={displayName}
          username={username}
          bio={bio}
          avatarUrl={avatarUrl}
          setDisplayName={setDisplayName}
          setUsername={setUsername}
          setBio={setBio}
          setAvatarUrl={setAvatarUrl}
          uploadAvatar={uploadAvatar}
          saveProfile={handleSaveProfile}
          onCancel={handleCancelProfileEdit}
          loading={formSubmitting}
          message={authMessage}
          styles={styles}
        />
      )}

      {page === "settings" && (
        <Settings
          user={user}
          profile={profile}
          setPage={setPage}
          logout={logout}
          openProfileEditor={handleOpenProfileEditor}
          updatePassword={updatePassword}
          styles={styles}
        />
      )}

      {showBottomNav && (
        <BottomNav page={page} setPage={setPage} styles={styles} />
      )}

      {pendingReview && (
        <DailyReviewModal
          stats={pendingReview.stats}
          totalFocusMinutes={totalFocusMinutesToday}
          onSubmit={submitDailyReview}
          onSkip={dismissDailyReview}
          saving={reviewSaving}
          message={reviewMessage}
          styles={styles}
        />
      )}
    </div>
  );
}