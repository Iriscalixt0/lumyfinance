import { createClient } from "@supabase/supabase-js";

// Public Supabase config — anon key is safe to expose (protected by RLS).
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zoajcpbuldrolqtkwppf.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvYWpjcGJ1bGRyb2xxdGt3cHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MDIyODEsImV4cCI6MjA5MzA3ODI4MX0.cNtkkNlwbd-OUfNpdqxrQYg8q2q2RygSFgABXSsV72s";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
