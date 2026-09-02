import { createClient } from "@supabase/supabase-js";

const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL || "https://rxqmkxhvxzuvpicyogus.supabase.co";
const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cW1reGh2eHp1dnBpY3lvZ3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDQ3NTcsImV4cCI6MjEwMTkyMDc1N30.R3IYmEx5KDiSaLcKluSthVzVs4DbE6XZHxfWhxBBNe4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
