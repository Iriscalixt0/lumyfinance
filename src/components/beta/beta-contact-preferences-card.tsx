"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageCircle, MailCheck } from "lucide-react";
import {
  getBetaContactPreferences,
  saveBetaContactPreferences,
} from "@/actions/beta-conversion";

export function BetaContactPreferencesCard() {
  const t = useTranslations("beta");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const prefs = await getBetaContactPreferences();
      if (cancelled) return;
      if (prefs) {
        setWhatsapp(prefs.whatsapp_e164 ?? "");
        setEmailOptIn(!!prefs.marketing_email_opt_in);
        setWhatsappOptIn(!!prefs.marketing_whatsapp_opt_in);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const result = await saveBetaContactPreferences({
      whatsappE164: whatsapp.trim(),
      marketingEmailOptIn: emailOptIn,
      marketingWhatsappOptIn: whatsappOptIn,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t("contactPrefs.error"));
      return;
    }
    setSuccess(true);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle size={18} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("contactPrefs.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("contactPrefs.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          {t("contactPrefs.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="beta-whatsapp" className="block text-sm font-medium text-foreground mb-1">
              {t("contactPrefs.whatsappLabel")}
            </label>
            <input
              id="beta-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+5511999999999"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("contactPrefs.whatsappHint")}</p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground inline-flex items-center gap-2">
              <MailCheck size={15} />
              {t("contactPrefs.emailOptIn")}
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground inline-flex items-center gap-2">
              <MessageCircle size={15} />
              {t("contactPrefs.whatsappOptIn")}
            </span>
          </label>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{t("contactPrefs.success")}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-70"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {saving ? t("contactPrefs.saving") : t("contactPrefs.save")}
          </button>
        </div>
      )}
    </section>
  );
}
