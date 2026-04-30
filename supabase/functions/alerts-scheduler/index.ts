import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function runAlerts() {
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all accepted workspace members
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .not("accepted_at", "is", null);

  if (error) {
    console.error("Failed to fetch workspace members:", error.message);
    return;
  }
  if (!members || members.length === 0) {
    console.log("No active workspace members found.");
    return;
  }

  // Group users by workspace
  const byWorkspace = new Map<string, string[]>();
  for (const m of members) {
    if (!byWorkspace.has(m.workspace_id)) byWorkspace.set(m.workspace_id, []);
    byWorkspace.get(m.workspace_id)!.push(m.user_id);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  let totalCreated = 0;

  for (const [workspaceId, userIds] of byWorkspace) {
    // Budgets for current month with category name
    const { data: budgets } = await supabase
      .from("budgets")
      .select("id, category_id, limit_amount, year, month, categories(name, icon)")
      .eq("workspace_id", workspaceId)
      .eq("year", currentYear)
      .eq("month", currentMonth);

    // All expense transactions this month for spent calculation
    const { data: expenseTxns } = await supabase
      .from("transactions")
      .select("category_id, amount, date")
      .eq("workspace_id", workspaceId)
      .eq("type", "expense");

    // Goals with contributions totals
    const { data: goals } = await supabase
      .from("goals")
      .select("id, title, target_amount, deadline, status, goal_contributions(amount)")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    const notifications: {
      user_id: string;
      workspace_id: string;
      type: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
    }[] = [];

    for (const userId of userIds) {
      // ── Budget alerts ──
      if (budgets) {
        for (const b of budgets) {
          if (b.limit_amount <= 0) continue;

          const spent = (expenseTxns || [])
            .filter((t) => {
              const d = new Date(t.date);
              return (
                t.category_id === b.category_id &&
                d.getFullYear() === b.year &&
                d.getMonth() + 1 === b.month
              );
            })
            .reduce((s: number, t: { amount: number }) => s + t.amount, 0);

          const pct = spent / b.limit_amount;
          const cat = b.categories as { name: string; icon: string } | null;
          const categoryLabel = cat ? `${cat.icon} ${cat.name}` : "Sem categoria";

          if (pct >= 1) {
            notifications.push({
              user_id: userId, workspace_id: workspaceId, type: "budget_warning",
              title: `Orçamento estourado: ${categoryLabel}`,
              body: `Seu orçamento de "${categoryLabel}" atingiu 100% do limite.`,
              data: { budget_id: b.id, threshold: 100, dedup_key: `budget_100_${b.id}_${userId}` },
            });
          } else if (pct >= 0.8) {
            notifications.push({
              user_id: userId, workspace_id: workspaceId, type: "budget_warning",
              title: `Orçamento em alerta: ${categoryLabel}`,
              body: `Seu orçamento de "${categoryLabel}" atingiu 80% do limite.`,
              data: { budget_id: b.id, threshold: 80, dedup_key: `budget_80_${b.id}_${userId}` },
            });
          }
        }
      }

      // ── Goal alerts ──
      if (goals) {
        for (const g of goals) {
          if (g.target_amount <= 0) continue;
          const contributions = g.goal_contributions as { amount: number }[] | null;
          const contributionsTotal = (contributions || []).reduce((s, c) => s + c.amount, 0);
          const pct = contributionsTotal / g.target_amount;

          const thresholds = [
            { value: 1, label: 100 },
            { value: 0.9, label: 90 },
            { value: 0.75, label: 75 },
          ];

          for (const t of thresholds) {
            if (pct >= t.value) {
              notifications.push({
                user_id: userId, workspace_id: workspaceId,
                type: t.label === 100 ? "goal_completed" : "goal_milestone",
                title: t.label === 100 ? `Meta concluída: ${g.title}! 🎉` : `Meta ${t.label}%: ${g.title}`,
                body: t.label === 100
                  ? `Parabéns! Você atingiu 100% da meta "${g.title}".`
                  : `Você já alcançou ${t.label}% da meta "${g.title}". Continue assim!`,
                data: { goal_id: g.id, threshold: t.label, dedup_key: `goal_${t.label}_${g.id}_${userId}` },
              });
              break;
            }
          }

          if (g.deadline && pct < 1) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil(
              (new Date(g.deadline + "T00:00:00").getTime() - today.getTime()) / 86400000
            );
            if (diffDays === 1 || diffDays === 0) {
              notifications.push({
                user_id: userId, workspace_id: workspaceId, type: "goal_deadline",
                title: diffDays === 1 ? `⏰ Meta vence amanhã: ${g.title}` : `⚠️ Meta vence hoje: ${g.title}`,
                body: `Sua meta "${g.title}" vence ${diffDays === 1 ? "amanhã" : "hoje"}! Você está em ${Math.round(pct * 100)}% do objetivo.`,
                data: { goal_id: g.id, dedup_key: `goal_deadline_${diffDays}d_${g.id}_${userId}` },
              });
            }
          }
        }
      }
    }

    // ── Deduplicate and insert ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const notif of notifications) {
      const dedupKey = (notif.data as Record<string, unknown>).dedup_key as string;
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", notif.user_id)
        .eq("workspace_id", workspaceId)
        .contains("data", { dedup_key: dedupKey })
        .gte("created_at", thirtyDaysAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;
      await supabase.from("notifications").insert(notif);
      totalCreated++;
    }
  }

  console.log(
    `alerts-scheduler: processed ${byWorkspace.size} workspaces, created ${totalCreated} notifications`
  );
}

// Roda toda hora automaticamente
Deno.cron("alerts-hourly", "0 * * * *", runAlerts);

// HTTP handler para trigger manual e health check
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await runAlerts();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ status: "alerts-scheduler running", schedule: "every hour at :00" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
