import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const workspaceId = body.workspace_id as string | undefined;
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();
  if (!member) return NextResponse.json({ error: "Forbidden workspace" }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.set("workspace_id", workspaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true });
}
