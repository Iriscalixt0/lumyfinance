import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifications: {
      user_id: string;
      workspace_id: string;
      type: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
    }[] = [];

    // ── Budget alerts (80% and 100%) ──
    const { data: budgets } = await supabase
      .from("budgets")
      .select("id, category, limit_amount, spent_amount")
      .eq("workspace_id", workspace_id);

    if (budgets) {
      for (const b of budgets) {
        if (b.limit_amount <= 0) continue;
        const pct = b.spent_amount / b.limit_amount;

        if (pct >= 1) {
          notifications.push({
            user_id: user.id,
            workspace_id,
            type: "budget_warning",
            title: `Orçamento estourado: ${b.category}`,
            body: `Seu orçamento de "${b.category}" atingiu 100% do limite.`,
            data: { budget_id: b.id, threshold: 100, dedup_key: `budget_100_${b.id}` },
          });
        } else if (pct >= 0.8) {
          notifications.push({
            user_id: user.id,
            workspace_id,
            type: "budget_warning",
            title: `Orçamento em alerta: ${b.category}`,
            body: `Seu orçamento de "${b.category}" atingiu 80% do limite.`,
            data: { budget_id: b.id, threshold: 80, dedup_key: `budget_80_${b.id}` },
          });
        }
      }
    }

    // ── Goal milestones (75%, 90%, 100%) ──
    const { data: goals } = await supabase
      .from("goals")
      .select("id, title, target_amount, contributions_total, deadline, status")
      .eq("workspace_id", workspace_id)
      .eq("status", "active");

    if (goals) {
      for (const g of goals) {
        if (g.target_amount <= 0) continue;
        const pct = (g.contributions_total ?? 0) / g.target_amount;

        // Milestone notifications
        const thresholds = [
          { value: 1, label: 100 },
          { value: 0.9, label: 90 },
          { value: 0.75, label: 75 },
        ];

        for (const t of thresholds) {
          if (pct >= t.value) {
            notifications.push({
              user_id: user.id,
              workspace_id,
              type: t.label === 100 ? "goal_completed" : "goal_milestone",
              title:
                t.label === 100
                  ? `Meta concluída: ${g.title}! 🎉`
                  : `Meta ${t.label}%: ${g.title}`,
              body:
                t.label === 100
                  ? `Parabéns! Você atingiu 100% da meta "${g.title}".`
                  : `Você já alcançou ${t.label}% da meta "${g.title}". Continue assim!`,
              data: { goal_id: g.id, threshold: t.label, dedup_key: `goal_${t.label}_${g.id}` },
            });
            break; // only highest threshold
          }
        }

        // ── Deadline approaching: 1 day before ──
        if (g.deadline && pct < 1) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const deadlineDate = new Date(g.deadline + "T00:00:00");
          const diffMs = deadlineDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            notifications.push({
              user_id: user.id,
              workspace_id,
              type: "goal_deadline",
              title: `⏰ Meta vence amanhã: ${g.title}`,
              body: `Sua meta "${g.title}" vence amanhã! Você está em ${Math.round(pct * 100)}% do objetivo.`,
              data: { goal_id: g.id, dedup_key: `goal_deadline_1d_${g.id}` },
            });
          } else if (diffDays === 0) {
            notifications.push({
              user_id: user.id,
              workspace_id,
              type: "goal_deadline",
              title: `⚠️ Meta vence hoje: ${g.title}`,
              body: `Sua meta "${g.title}" vence hoje! Você está em ${Math.round(pct * 100)}% do objetivo.`,
              data: { goal_id: g.id, dedup_key: `goal_deadline_0d_${g.id}` },
            });
          }
        }
      }
    }

    // ── Deduplicate: skip if notification with same dedup_key exists recently ──
    let created = 0;
    for (const notif of notifications) {
      const dedupKey = (notif.data as Record<string, unknown>).dedup_key as string;

      // Check if already exists in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("workspace_id", workspace_id)
        .contains("data", { dedup_key: dedupKey })
        .gte("created_at", thirtyDaysAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("notifications").insert(notif);
      created++;
    }

    return new Response(
      JSON.stringify({ checked_budgets: budgets?.length ?? 0, checked_goals: goals?.length ?? 0, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
