import { createClient } from "@supabase/supabase-js";

// A URL e a publishable key são públicas por design (vivem no bundle do
// navegador de qualquer forma) — a proteção real dos dados é a RLS.
// O .env.local sobrepõe em desenvolvimento; o fallback cobre o deploy.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || "https://wzrtvhrkdjagmawxdnrj.supabase.co";
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "sb_publishable_GKtkJZPfbzRoHqLpVEvxDA_N35i8uGD";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
