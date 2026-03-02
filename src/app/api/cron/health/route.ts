import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type HealthCheckResult = {
  name: string;
  ok: boolean;
  details: string;
};

async function notifyDiscord(results: HealthCheckResult[], checkedAt: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_HEALTH_WEBHOOK_URL ?? process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("Webhook URL nAo configurada");
  }

  const failures = results.filter((item) => !item.ok);
  const overallOk = failures.length === 0;

  const fields = results.map((item) => ({
    name: item.ok ? `OK ${item.name}` : `FAIL ${item.name}`,
    value: item.details,
    inline: false,
  }));

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Lumyf Monitor",
      embeds: [
        {
          title: overallOk ? "Sistema de produCAo OK" : "Falha detectada no sistema",
          description: overallOk
            ? "Todos os checks passaram."
            : `${failures.length} check(s) com falha.`,
          color: overallOk ? 0x2ecc71 : 0xe74c3c,
          fields,
          footer: { text: "Monitor de saUde · executa a cada 10 minutos" },
          timestamp: checkedAt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed: HTTP ${response.status} ${body}`);
  }
}

async function checkAppUrl(baseUrl: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        name: "App",
        ok: false,
        details: `HTTP ${response.status} em ${baseUrl}`,
      };
    }

    return {
      name: "App",
      ok: true,
      details: `HTTP ${response.status} em ${baseUrl}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return {
      name: "App",
      ok: false,
      details: `Erro ao acessar ${baseUrl}: ${msg}`,
    };
  }
}

async function checkSupabase(): Promise<HealthCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      name: "Supabase",
      ok: false,
      details: "Credenciais do Supabase nAo configuradas",
    };
  }

  const client = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await client
      .from("workspaces")
      .select("id")
      .limit(1);

    if (error) {
      return {
        name: "Supabase",
        ok: false,
        details: error.message,
      };
    }

    return {
      name: "Supabase",
      ok: true,
      details: "Consulta de leitura executada com sucesso",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return {
      name: "Supabase",
      ok: false,
      details: msg,
    };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const results: HealthCheckResult[] = [];

  if (!baseUrl) {
    results.push({
      name: "ConfiguraCAo",
      ok: false,
      details: "NEXT_PUBLIC_APP_URL nAo configurada",
    });
  } else {
    results.push(await checkAppUrl(baseUrl));
  }

  results.push(await checkSupabase());

  try {
    await notifyDiscord(results, checkedAt);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao enviar alerta";
    return NextResponse.json(
      { ok: false, checkedAt, results, error: msg },
      { status: 500 }
    );
  }

  const hasFailure = results.some((item) => !item.ok);
  return NextResponse.json(
    { ok: !hasFailure, checkedAt, results },
    { status: hasFailure ? 500 : 200 }
  );
}
