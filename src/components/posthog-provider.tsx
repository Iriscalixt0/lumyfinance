"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Só carrega em produção; em dev evita ERR_BLOCKED_BY_CLIENT (ad blockers).
    if (
      typeof window !== "undefined" &&
      key &&
      host &&
      process.env.NODE_ENV === "production"
    ) {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
      });
    }
  }, []);

  return <>{children}</>;
}
