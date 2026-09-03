import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export interface UserProfile {
  id: string;
  display_name: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  default_alarm_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function useAuth() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set to true the moment Supabase fires the PASSWORD_RECOVERY event —
  // this happens when the user lands back in the app from a "reset your
  // password" email link. Critically, Supabase also creates a REAL,
  // logged-in session at that same moment. Without this flag, App.tsx's
  // existing "user is logged in -> go to dashboard" redirect would fire
  // first and the user would never see the Set New Password screen at
  // all. App.tsx must check this flag BEFORE its normal dashboard
  // redirect. It's cleared once the user successfully sets a new
  // password (clearPasswordRecovery) or logs out.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(userId: string) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Profile loading error:", error);
        setProfileError(error.message);
        return;
      }

      setProfileError(null);
      setProfile(data || null);
    }

    // FIX: previously this file had TWO independent code paths both
    // setting user/profile/loading — a manual init() that called
    // getSession() + loadProfile() directly, AND this onAuthStateChange
    // listener doing the same thing on its own initial fire. Whichever
    // finished first could set loading=false while the other's profile
    // fetch was still in flight, causing the UI to briefly (or not so
    // briefly) treat a real, already-set-up profile as missing and show
    // the Profile setup screen incorrectly. Supabase's onAuthStateChange
    // fires once immediately with the current session on subscribe, so
    // a separate manual getSession() call is redundant — this is now the
    // single source of truth, eliminating the race entirely.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (_event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
      } else {
        setProfile(null);
        setProfileError(null);
        setIsPasswordRecovery(false);
      }

      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile refresh error:", error);
      setProfileError(error.message);
      return null;
    }

    setProfileError(null);
    if (data) {
      setProfile(data);
      return data;
    }
    return null;
  }

  async function signup(email: string, password: string) {
    const res = await supabase.auth.signUp({ email, password });

    if (res.error) {
      return res;
    }

    if (res.data?.user && !res.data?.session) {
      return {
        data: res.data,
        error: null,
        needsEmailConfirmation: true,
      };
    }

    if (res.data?.session?.user) {
      setUser(res.data.session.user);
    }

    return res;
  }

  async function login(email: string, password: string) {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
    }
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setIsPasswordRecovery(false);
    return true;
  }

  // Sends the "reset your password" email. redirectTo uses the current
  // origin so this works unchanged on localhost:3000 (Termux/Vite dev)
  // and on the deployed Vercel URL without any hardcoded domain.
  async function sendPasswordReset(email: string) {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { error: { message: "Please enter your email address." } };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      console.error("Password reset email error:", error);
      return { error: { message: error.message } };
    }

    return { error: null };
  }

  // Called from the "Set New Password" screen, both for the recovery-link
  // flow and for a logged-in user changing their password from Settings.
  async function updatePassword(newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      return { error: { message: "Password must be at least 6 characters." } };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error("Password update error:", error);
      return { error: { message: error.message } };
    }

    setIsPasswordRecovery(false);
    return { error: null };
  }

  // Clears the recovery flag without changing the password — used if the
  // user backs out of the Set New Password screen but is still on a
  // valid recovery session (e.g. they navigate elsewhere in the app).
  function clearPasswordRecovery() {
    setIsPasswordRecovery(false);
  }

  // Uploads an avatar image to the "avatars" bucket under a path scoped
  // to the user's own id (required by the storage RLS policies), then
  // returns its public URL. Does not itself save the URL to the profile
  // row — call saveProfile/updateProfile with the returned url after.
  async function uploadAvatar(file: File) {
    if (!user) {
      return { url: null, error: { message: "You are not logged in." } };
    }

    const fileExt = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return { url: null, error: { message: uploadError.message } };
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Cache-bust so the new avatar shows immediately even though the
    // path/filename didn't change (upsert overwrote the same file).
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;

    return { url: bustedUrl, error: null };
  }

  // Handles both the original onboarding save (displayName + username
  // only) and the fuller Edit Profile save (bio + avatarUrl too). Fields
  // left undefined are simply not included in the update, so calling
  // this from onboarding with only displayName/username never wipes out
  // bio/avatar_url that might already be set.
  async function saveProfile({
    displayName,
    username,
    bio,
    avatarUrl,
  }: {
    displayName: string;
    username: string;
    bio?: string;
    avatarUrl?: string | null;
  }) {
    if (!user) {
      return { error: { message: "You are not logged in." } };
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "_");

    if (!cleanUsername) {
      return { error: { message: "Please choose a username." } };
    }

    const payload: Record<string, unknown> = {
      id: user.id,
      display_name: displayName.trim(),
      username: cleanUsername,
    };

    if (bio !== undefined) {
      payload.bio = bio.trim();
    }
    if (avatarUrl !== undefined) {
      payload.avatar_url = avatarUrl;
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Profile save error:", error);
      if (error.code === "23505") {
        return { error: { message: "That username is already taken." } };
      }
      return { error: { message: error.message } };
    }

    setProfile(data);
    return { data, error: null };
  }

  return {
    user,
    profile,
    profileError,
    loading,
    isPasswordRecovery,
    signup,
    login,
    logout,
    refreshProfile,
    saveProfile,
    sendPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    uploadAvatar,
  };
}
