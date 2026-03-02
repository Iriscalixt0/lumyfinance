"use client";

import { useEffect, useRef } from "react";
import { saveLocationConsent, reverseGeocode } from "@/actions/profile-preferences";

const STORAGE_KEY = "nf_location_request_done";
const PENDING_KEY = "nf_location_pending";
const TRIGGER_KEY = "nf_show_location_request";

export function setLocationModalTrigger() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TRIGGER_KEY, "1");
  }
}

type PendingPayload = {
  consent: boolean;
  permissionState: "granted" | "denied";
  timezone: string | null;
  localeHint: string | null;
  countryHint: string | null;
  regionHint: string | null;
  cityHint: string | null;
};

function savePending(payload: PendingPayload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function getPending(): PendingPayload | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPayload;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function requestBrowserLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  const localeHint = navigator.language || null;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      const geo = await reverseGeocode(
        position.coords.latitude,
        position.coords.longitude
      );
      await saveLocationConsent({
        consent: true,
        permissionState: "granted",
        timezone,
        localeHint,
        countryHint: geo.ok ? geo.country ?? null : null,
        regionHint: geo.ok ? geo.region ?? null : null,
        cityHint: geo.ok ? geo.city ?? null : null,
      });
    },
    async () => {
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
    }
  );
}

/**
 * Na landing (sem login): dispara o prompt do browser e guarda a resposta em localStorage.
 * Após login, o dashboard persiste com saveLocationConsent.
 */
function requestBrowserLocationLanding() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  const localeHint = navigator.language || null;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      const geo = await reverseGeocode(
        position.coords.latitude,
        position.coords.longitude
      );
      savePending({
        consent: true,
        permissionState: "granted",
        timezone,
        localeHint,
        countryHint: geo.ok ? geo.country ?? null : null,
        regionHint: geo.ok ? geo.region ?? null : null,
        cityHint: geo.ok ? geo.city ?? null : null,
      });
    },
    () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      savePending({
        consent: false,
        permissionState: "denied",
        timezone,
        localeHint,
        countryHint: null,
        regionHint: null,
        cityHint: null,
      });
    }
  );
}

/**
 * Na landing: pede localização uma vez (prompt nativo do browser) e marca que já pedimos.
 * Resposta fica em localStorage para ser guardada no backend após login.
 */
export function useLandingLocationRequest() {
  const done = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    if (done.current) return;

    function doRequest() {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      if (done.current) return;
      done.current = true;
      localStorage.setItem(STORAGE_KEY, "1");
      requestBrowserLocationLanding();
    }

    const timer = setTimeout(doRequest, 1500);
    return () => clearTimeout(timer);
  }, []);
}

/**
 * No dashboard: se houve pedido na landing, persiste os dados (agora com login). Senão, pede aqui uma vez.
 */
export function useBrowserLocationRequest() {
  const done = useRef(false);
  const pendingFlushed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function flushPending() {
      if (pendingFlushed.current) return;
      const pending = getPending();
      if (!pending) return;
      pendingFlushed.current = true;
      saveLocationConsent(pending).then(() => clearPending());
    }

    if (localStorage.getItem(STORAGE_KEY) === "1") {
      flushPending();
      return;
    }
    if (done.current) return;

    function maybeRequest() {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        flushPending();
        return;
      }
      if (done.current) return;
      done.current = true;
      localStorage.setItem(STORAGE_KEY, "1");
      requestBrowserLocation();
    }

    if (sessionStorage.getItem(TRIGGER_KEY) === "1") {
      sessionStorage.removeItem(TRIGGER_KEY);
      maybeRequest();
      return;
    }

    const timer = setTimeout(maybeRequest, 2500);

    return () => {
      clearTimeout(timer);
    };
  }, []);
}

/** Colocar na landing page; não renderiza nada, só pede localização ao entrar no site. */
export function LandingLocationRequest() {
  useLandingLocationRequest();
  return null;
}
