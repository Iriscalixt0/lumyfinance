import { NextResponse } from "next/server";
import { processEndedBetaPrograms } from "@/actions/beta-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processEndedBetaPrograms();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: msg,
        processed: 0,
        notificationsSent: 0,
        blockedParticipants: 0,
        campaignsSent: 0,
        campaignsFailed: 0,
        campaignsSkipped: 0,
        cleanedWorkspaces: 0,
        errors: [msg],
      },
      { status: 500 }
    );
  }
}
