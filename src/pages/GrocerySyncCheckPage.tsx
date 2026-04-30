import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Radio,
  Wifi,
  WifiOff,
  Trash2,
} from "lucide-react";

/**
 * Modo de Verificação de Sincronização — Supermercado
 *
 * Abre uma segunda aba apontando para `/grocery/sync-check?mode=mirror`,
 * executa um roteiro de mudanças (insert / update / delete) na tabela
 * `grocery_items` e mede a latência até cada evento ser recebido tanto
 * via Supabase Realtime quanto via BroadcastChannel local.
 *
 * Os itens criados são marcados com kind='month' + month_key='9999-12'
 * para serem facilmente identificáveis e nunca aparecerem na lista real.
 */

const SYNC_CHANNEL = "lumy-grocery-sync";
const TEST_MONTH_KEY = "9999-12"; // sentinel month — nunca exibido em uso normal

type EventSource = "realtime" | "broadcast";
type StepKind = "insert" | "update" | "delete";
type StepStatus = "pending" | "running" | "ok" | "fail";

interface Step {
  id: string;
  kind: StepKind;
  label: string;
  status: StepStatus;
  startedAt?: number;
  realtimeMs?: number;
  broadcastMs?: number;
  error?: string;
}

interface IncomingEvent {
  source: EventSource;
  kind: StepKind;
  itemId: string;
  at: number;
  fromTab?: string;
}

const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function GrocerySyncCheckPage() {
  const [params] = useSearchParams();
  const isMirror = params.get("mode") === "mirror";

  if (isMirror) return <MirrorView />;
  return <ControllerView />;
}

// ============================================================
// MIRROR — passive view shown in the second tab
// ============================================================
function MirrorView() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const [events, setEvents] = useState<IncomingEvent[]>([]);
  const [rtConnected, setRtConnected] = useState(false);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const bc = new BroadcastChannel(SYNC_CHANNEL);
    bcRef.current = bc;

    bc.onmessage = (e) => {
      const data = e.data;
      if (data?.type === "test-event" && data.workspaceId === workspaceId) {
        const evt: IncomingEvent = {
          source: "broadcast",
          kind: data.kind,
          itemId: data.itemId,
          at: Date.now(),
          fromTab: data.fromTab,
        };
        setEvents((prev) => [evt, ...prev].slice(0, 50));
        // ack so controller can measure latency
        bc.postMessage({
          type: "ack",
          source: "broadcast",
          itemId: data.itemId,
          kind: data.kind,
          at: Date.now(),
          fromTab: TAB_ID,
        });
      }
    };

    const channel = supabase
      .channel(`grocery-sync-mirror-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (row?.month_key !== TEST_MONTH_KEY) return; // only count test rows
          const kind: StepKind =
            payload.eventType === "INSERT" ? "insert" : payload.eventType === "UPDATE" ? "update" : "delete";
          const evt: IncomingEvent = { source: "realtime", kind, itemId: row.id, at: Date.now() };
          setEvents((prev) => [evt, ...prev].slice(0, 50));
          bc.postMessage({
            type: "ack",
            source: "realtime",
            itemId: row.id,
            kind,
            at: Date.now(),
            fromTab: TAB_ID,
          });
        },
      )
      .subscribe((status) => setRtConnected(status === "SUBSCRIBED"));

    // announce presence
    bc.postMessage({ type: "mirror-ready", workspaceId, fromTab: TAB_ID });

    return () => {
      bc.close();
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return (
    <div className="animate-fade space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" /> Aba Espelho
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Esta aba está escutando alterações. Mantenha-a aberta enquanto a verificação roda na aba principal.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${
            rtConnected
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          {rtConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          Realtime {rtConnected ? "conectado" : "conectando..."}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tab: {TAB_ID}</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Eventos recebidos ({events.length})
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aguardando eventos...</p>
        ) : (
          <ul className="space-y-1 max-h-96 overflow-y-auto">
            {events.map((e, i) => (
              <li
                key={i}
                className="text-xs font-mono flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    e.source === "realtime"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                      : "bg-violet-500/15 text-violet-600 dark:text-violet-300"
                  }`}
                >
                  {e.source}
                </span>
                <span className="text-foreground font-semibold">{e.kind}</span>
                <span className="text-muted-foreground truncate">{e.itemId}</span>
                <span className="text-muted-foreground ml-auto">
                  {new Date(e.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CONTROLLER — main tab orchestrating the test
// ============================================================
function ControllerView() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const { user } = useAuth();
  const { toast } = useToast();

  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(initialSteps());
  const [mirrorReady, setMirrorReady] = useState(false);
  const [rtConnected, setRtConnected] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);
  const [autoCleanup, setAutoCleanup] = useState(true);

  const bcRef = useRef<BroadcastChannel | null>(null);
  const pendingRef = useRef<
    Map<string, { stepId: string; startedAt: number; gotRealtime: boolean; gotBroadcast: boolean }>
  >(new Map());

  // ---- Setup channels ----
  useEffect(() => {
    if (!workspaceId) return;

    const bc = new BroadcastChannel(SYNC_CHANNEL);
    bcRef.current = bc;
    bc.onmessage = (e) => {
      const d = e.data;
      if (d?.type === "mirror-ready" && d.workspaceId === workspaceId) {
        setMirrorReady(true);
      }
      if (d?.type === "ack") {
        recordAck(d.source as EventSource, d.itemId, d.at);
      }
    };

    const channel = supabase
      .channel(`grocery-sync-controller-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (row?.month_key !== TEST_MONTH_KEY) return;
          // Controller acts as its own ack source for realtime — confirms the event hit Supabase realtime
          recordAck("realtime", row.id, Date.now());
        },
      )
      .subscribe((status) => setRtConnected(status === "SUBSCRIBED"));

    return () => {
      bc.close();
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  function recordAck(source: EventSource, itemId: string, at: number) {
    const p = pendingRef.current.get(itemId);
    if (!p) return;
    const latency = at - p.startedAt;
    setSteps((prev) =>
      prev.map((s) =>
        s.id === p.stepId
          ? {
              ...s,
              [source === "realtime" ? "realtimeMs" : "broadcastMs"]: latency,
            }
          : s,
      ),
    );
    if (source === "realtime") p.gotRealtime = true;
    else p.gotBroadcast = true;
  }

  function openMirror() {
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
    const w = window.open(
      "/grocery/sync-check?mode=mirror",
      "lumy-grocery-mirror",
      "width=560,height=720,left=80,top=80",
    );
    if (!w) {
      toast("Popup bloqueado. Permita popups para este site e tente de novo.");
      return;
    }
    setPopup(w);
  }

  async function runScenario() {
    if (!workspaceId || !user) return;
    if (!mirrorReady) {
      toast("Abra a aba espelho primeiro.");
      return;
    }
    setRunning(true);
    setSteps(initialSteps());
    pendingRef.current = new Map();

    const itemId = crypto.randomUUID();

    // helper to update a step
    const update = (stepId: string, patch: Partial<Step>) =>
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));

    // ---- Step 1: INSERT ----
    update("insert", { status: "running", startedAt: Date.now() });
    const tInsert = Date.now();
    pendingRef.current.set(itemId, { stepId: "insert", startedAt: tInsert, gotRealtime: false, gotBroadcast: false });

    bcRef.current?.postMessage({
      type: "test-event",
      kind: "insert",
      itemId,
      workspaceId,
      fromTab: TAB_ID,
    });
    const ins = await supabase.from("grocery_items").insert({
      id: itemId,
      workspace_id: workspaceId,
      created_by: user.id,
      name: `[sync-check ${new Date().toISOString().slice(11, 19)}]`,
      qty: null,
      kind: "month",
      month_key: TEST_MONTH_KEY,
    });
    if (ins.error) {
      update("insert", { status: "fail", error: ins.error.message });
      setRunning(false);
      return;
    }
    await waitForEvent(itemId, 5000);
    finalizeStep("insert", itemId);

    // ---- Step 2: UPDATE ----
    update("update", { status: "running", startedAt: Date.now() });
    pendingRef.current.set(itemId, { stepId: "update", startedAt: Date.now(), gotRealtime: false, gotBroadcast: false });
    bcRef.current?.postMessage({ type: "test-event", kind: "update", itemId, workspaceId, fromTab: TAB_ID });
    const upd = await supabase
      .from("grocery_items")
      .update({ qty: "verificado" })
      .eq("id", itemId);
    if (upd.error) {
      update("update", { status: "fail", error: upd.error.message });
    } else {
      await waitForEvent(itemId, 5000);
      finalizeStep("update", itemId);
    }

    // ---- Step 3: DELETE ----
    update("delete", { status: "running", startedAt: Date.now() });
    pendingRef.current.set(itemId, { stepId: "delete", startedAt: Date.now(), gotRealtime: false, gotBroadcast: false });
    bcRef.current?.postMessage({ type: "test-event", kind: "delete", itemId, workspaceId, fromTab: TAB_ID });
    const del = await supabase.from("grocery_items").delete().eq("id", itemId);
    if (del.error) {
      update("delete", { status: "fail", error: del.error.message });
    } else {
      await waitForEvent(itemId, 5000);
      finalizeStep("delete", itemId);
    }

    // Cleanup any lingering test rows
    if (autoCleanup) {
      await supabase
        .from("grocery_items")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("month_key", TEST_MONTH_KEY);
    }

    setRunning(false);
    toast("Verificação concluída");
  }

  function finalizeStep(stepId: string, itemId: string) {
    const p = pendingRef.current.get(itemId);
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const ok = !!p?.gotRealtime; // realtime is the source of truth
        return { ...s, status: ok ? "ok" : "fail", error: ok ? undefined : "Timeout aguardando evento realtime" };
      }),
    );
  }

  function waitForEvent(itemId: string, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => {
        const p = pendingRef.current.get(itemId);
        if (p?.gotRealtime || Date.now() - start > timeoutMs) return resolve();
        setTimeout(tick, 80);
      };
      tick();
    });
  }

  async function cleanupNow() {
    if (!workspaceId) return;
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("month_key", TEST_MONTH_KEY);
    toast(error ? `Erro: ${error.message}` : "Itens de teste removidos");
  }

  const summary = useMemo(() => {
    const done = steps.filter((s) => s.status === "ok").length;
    const fail = steps.filter((s) => s.status === "fail").length;
    return { done, fail, total: steps.length };
  }, [steps]);

  return (
    <div className="animate-fade space-y-6">
      <div>
        <Link
          to="/grocery"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o Supermercado
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" /> Verificação de Sincronização
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Abre uma segunda aba e executa um roteiro de mudanças no Supermercado para confirmar que a sincronização em
          tempo real está funcionando entre dispositivos.
        </p>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatusCard
          ok={rtConnected}
          okLabel="Realtime conectado"
          failLabel="Aguardando Realtime"
          icon={rtConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        />
        <StatusCard
          ok={mirrorReady}
          okLabel="Aba espelho pronta"
          failLabel="Espelho não detectado"
          icon={<Radio className="h-4 w-4" />}
        />
        <StatusCard
          ok={!!workspaceId}
          okLabel={`Workspace: ${activeWorkspace?.name ?? ""}`}
          failLabel="Sem workspace"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-wrap items-center gap-3">
        <button
          onClick={openMirror}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/70 text-foreground text-sm font-semibold transition-colors"
        >
          <ExternalLink className="h-4 w-4" /> Abrir aba espelho
        </button>
        <button
          onClick={runScenario}
          disabled={running || !mirrorReady || !rtConnected}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {running ? <Square className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
          {running ? "Rodando..." : "Iniciar verificação"}
        </button>
        <button
          onClick={() => setSteps(initialSteps())}
          disabled={running}
          className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Limpar
        </button>
        <button
          onClick={cleanupNow}
          className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-sm font-medium transition-colors ml-auto"
          title="Remove qualquer item de teste deixado para trás"
        >
          <Trash2 className="h-4 w-4" /> Limpar testes órfãos
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto">
          <input
            type="checkbox"
            checked={autoCleanup}
            onChange={(e) => setAutoCleanup(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Limpeza automática após cada rodada
        </label>
      </div>

      {/* Steps */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Roteiro</h2>
          <span className="text-xs text-muted-foreground">
            {summary.done}/{summary.total} ok
            {summary.fail > 0 && <span className="text-destructive font-bold"> · {summary.fail} falhas</span>}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {steps.map((s) => (
            <li key={s.id} className="py-3 flex items-center gap-3">
              <StepIcon status={s.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                {s.error && <p className="text-xs text-destructive mt-0.5">{s.error}</p>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <LatencyBadge label="RT" ms={s.realtimeMs} />
                <LatencyBadge label="BC" ms={s.broadcastMs} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1">
        <p>
          <span className="font-semibold">RT</span> = latência do Supabase Realtime (cross-device).{" "}
          <span className="font-semibold">BC</span> = latência do BroadcastChannel local (entre abas do mesmo
          navegador).
        </p>
        <p>
          Itens criados usam <code className="font-mono">month_key={TEST_MONTH_KEY}</code> e nunca aparecem na lista
          real do Supermercado.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// helpers / sub-components
// ============================================================
function initialSteps(): Step[] {
  return [
    { id: "insert", kind: "insert", label: "Inserir item de teste", status: "pending" },
    { id: "update", kind: "update", label: "Atualizar item de teste", status: "pending" },
    { id: "delete", kind: "delete", label: "Excluir item de teste", status: "pending" },
  ];
}

function StatusCard({
  ok,
  okLabel,
  failLabel,
  icon,
}: {
  ok: boolean;
  okLabel: string;
  failLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
      }`}
    >
      {icon}
      <span className="text-sm font-semibold truncate">{ok ? okLabel : failLabel}</span>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (status === "fail") return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  if (status === "running")
    return <Clock className="h-5 w-5 text-primary animate-pulse shrink-0" />;
  return <div className="h-5 w-5 rounded-full border-2 border-border shrink-0" />;
}

function LatencyBadge({ label, ms }: { label: string; ms?: number }) {
  if (ms === undefined) {
    return (
      <span className="font-mono text-muted-foreground/50 px-1.5 py-0.5 rounded bg-muted/30">
        {label} —
      </span>
    );
  }
  const tone =
    ms < 300
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : ms < 1500
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  return (
    <span className={`font-mono px-1.5 py-0.5 rounded font-bold ${tone}`}>
      {label} {ms}ms
    </span>
  );
}
