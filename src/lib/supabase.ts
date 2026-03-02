import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mbijojessqyzcklsyjre.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iaWpvamVzc3F5emNrbHN5anJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDQ4NTksImV4cCI6MjA4NjAyMDg1OX0.zY9W15Px1oRW7HHIRiKG5Jw8S0NDCkGg060aCf96wkU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
