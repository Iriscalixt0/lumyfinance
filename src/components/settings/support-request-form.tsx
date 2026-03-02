"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SUPPORT_CONFIG } from "@/lib/product-config";
import type { Workspace } from "@/types/database";
import { Mail, Phone, MessageCircle, Instagram } from "lucide-react";

export function SupportRequestForm({
  workspaces,
  currentWorkspaceId,
  defaultEmail,
}: {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  defaultEmail: string;
}) {
  const t = useTranslations("settings");
  const [workspaceId, setWorkspaceId] = useState<string>(currentWorkspaceId ?? "");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"bug" | "billing" | "feature" | "account" | "other">("bug");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [message, setMessage] = useState("");

  const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name ?? t("supportForm.workspaceNone");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullSubject = subject.trim()
      ? `[${category.toUpperCase()}] [${priority.toUpperCase()}] ${subject}`
      : `[${category.toUpperCase()}] [${priority.toUpperCase()}] Suporte - ${workspaceName}`;

    const bodyLines = [
      `Workspace: ${workspaceName}`,
      `E-mail de contato: ${contactEmail}`,
      `Categoria: ${category}`,
      `Prioridade: ${priority}`,
      "",
      "--- Mensagem ---",
      message.trim() || "(Sem mensagem adicional)",
    ];
    const body = bodyLines.join("\n");

    const mailto = `mailto:${SUPPORT_CONFIG.email}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-secondary/20 p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("supportForm.directContact")}
        </p>
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <a
              href={`tel:${SUPPORT_CONFIG.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary whitespace-nowrap"
            >
              <Phone size={16} className="shrink-0" />
              {SUPPORT_CONFIG.phone}
            </a>
            <a
              href={`mailto:${SUPPORT_CONFIG.email}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary min-w-0 break-all"
            >
              <Mail size={16} className="shrink-0" />
              <span className="break-all">{SUPPORT_CONFIG.email}</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
            <span className="text-xs text-muted-foreground mr-1">{t("supportForm.social")}</span>
            <a
              href={SUPPORT_CONFIG.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
            <a
              href={SUPPORT_CONFIG.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              aria-label="Instagram"
            >
              <Instagram size={14} />
              Instagram
            </a>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("supportForm.instructions")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {t("supportForm.workspaceLabel")}
            </span>
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">{t("supportForm.workspaceNone")}</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("supportForm.emailLabel")}
            </span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              placeholder="seu@email.com"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {t("supportForm.subjectLabel")}
            </span>
            <input
              type="text"
              maxLength={160}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              placeholder={t("supportForm.subjectPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {t("supportForm.categoryLabel")}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="bug">{t("supportForm.categoryBug")}</option>
              <option value="billing">{t("supportForm.categoryBilling")}</option>
              <option value="feature">{t("supportForm.categoryFeature")}</option>
              <option value="account">{t("supportForm.categoryAccount")}</option>
              <option value="other">{t("supportForm.categoryOther")}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {t("supportForm.messageLabel")}
            </span>
            <textarea
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-y"
              placeholder={t("supportForm.messagePlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 sm:max-w-[200px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              {t("supportForm.priorityLabel")}
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="low">{t("supportForm.priorityLow")}</option>
              <option value="medium">{t("supportForm.priorityMedium")}</option>
              <option value="high">{t("supportForm.priorityHigh")}</option>
              <option value="urgent">{t("supportForm.priorityUrgent")}</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-hero-gradient px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          <Mail size={18} />
          {t("supportForm.sendButton")}
        </button>
      </form>
    </div>
  );
}
