"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getCategoriesForWorkspace = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("type")
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
});
