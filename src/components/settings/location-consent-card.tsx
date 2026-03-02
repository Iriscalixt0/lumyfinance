"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { saveLocationConsent, reverseGeocode } from "@/actions/profile-preferences";

export function LocationConsentCard() {
  const t = useTranslations("settings.location");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const localeHint = useMemo(() => {
    if (typeof navigator === "undefined") return null;
    return navigator.language || null;
  }, []);

  async function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setMessage(t("geoUnavailable"));
      return;
    }

    setLoading(true);
    setStatus("idle");

    const geoOptions: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000,
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
        const geo = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        );
        const result = await saveLocationConsent({
          consent: true,
          permissionState: "granted",
          timezone,
          localeHint,
          countryHint: geo.ok ? geo.country ?? null : null,
          regionHint: geo.ok ? geo.region ?? null : null,
          cityHint: geo.ok ? geo.city ?? null : null,
        });

        setLoading(false);
        if (!result.ok) {
          setStatus("error");
          setMessage(result.error ?? t("saveError"));
          return;
        }

        setStatus("ok");
        const locParts = geo.ok && (geo.city || geo.region || geo.country)
          ? [geo.city, geo.region, geo.country].filter(Boolean).join(", ")
          : null;
        setMessage(
          locParts
            ? t("locationGrantedDetail", {
                lat: position.coords.latitude.toFixed(2),
                lon: position.coords.longitude.toFixed(2),
              }) + ` (${locParts})`
            : t("locationGrantedDetail", {
                lat: position.coords.latitude.toFixed(2),
                lon: position.coords.longitude.toFixed(2),
              })
        );
      },
      async (err: GeolocationPositionError) => {
        setLoading(false);
        setStatus("error");
        const code = err?.code ?? 2;
        if (code === 1) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
          await saveLocationConsent({
            consent: false,
            permissionState: "denied",
            timezone,
            localeHint,
            countryHint: null,
            regionHint: null,
            cityHint: null,
          });
          setMessage(t("permissionDenied"));
        } else if (code === 3) {
          setMessage(t("geoTimeout"));
        } else {
          setMessage(t("positionUnavailable"));
        }
      },
      geoOptions
    );
  }

  async function denyLocation() {
    setLoading(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    const result = await saveLocationConsent({
      consent: false,
      permissionState: "denied",
      timezone,
      localeHint,
      countryHint: null,
      regionHint: null,
      cityHint: null,
    });
    setLoading(false);

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error ?? t("saveError"));
      return;
    }
    setStatus("ok");
    setMessage(t("preferenceSaved"));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("desc")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={requestLocation}
          className="rounded-xl bg-hero-gradient px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-70"
        >
          {loading ? t("saving") : t("allow")}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={denyLocation}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-70"
        >
          {t("deny")}
        </button>
      </div>
      {status !== "idle" && (
        <p className={`mt-3 text-sm ${status === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
