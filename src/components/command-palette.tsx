"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Receipt,
  Target,
  PiggyBank,
  Repeat,
  FileText,
  Settings,
  Plus,
  CreditCard,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tCommand = useTranslations("commandPalette");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50" onClick={() => setOpen(false)}>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label={tCommand("label")}
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          placeholder={tCommand("placeholder")}
          className="w-full px-4 py-3 bg-transparent border-b border-border outline-none text-foreground placeholder:text-muted-foreground"
        />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">{tCommand("empty")}</Command.Empty>
          <Command.Group heading={tCommand("navigation")}>
            <Command.Item
              onSelect={() => { router.push("/dashboard"); setOpen(false); }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary"
            >
              <LayoutDashboard className="h-4 w-4" />
              {tNav("overview")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/transactions"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <ArrowLeftRight className="h-4 w-4" />
              {tNav("transactions")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/investments"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <TrendingUp className="h-4 w-4" />
              {tNav("investments")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/cobrancas"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Receipt className="h-4 w-4" />
              {tNav("cobrancas")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/goals"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Target className="h-4 w-4" />
              {tNav("goals")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/budgets"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <PiggyBank className="h-4 w-4" />
              {tNav("budgets")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/recurring"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Repeat className="h-4 w-4" />
              {tNav("recurring")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/reports"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <FileText className="h-4 w-4" />
              {tNav("reports")}
            </Command.Item>
          </Command.Group>
          <Command.Group heading={tCommand("actions")}>
            <Command.Item onSelect={() => { router.push("/dashboard/transactions"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Plus className="h-4 w-4" />
              {tCommand("newTransaction")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/goals"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Plus className="h-4 w-4" />
              {tCommand("newGoal")}
            </Command.Item>
          </Command.Group>
          <Command.Group heading={tCommand("system")}>
            <Command.Item onSelect={() => { router.push("/dashboard/plan"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <CreditCard className="h-4 w-4" />
              {tNav("plan")}
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/dashboard/settings"); setOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected]:bg-secondary">
              <Settings className="h-4 w-4" />
              {tNav("settings")}
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}
