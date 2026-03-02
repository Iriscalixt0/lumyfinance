"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Quando o usuário volta do Stripe com ?checkout=success, revalida a árvore de
 * server components para que o layout e as páginas leiam o workspace atualizado
 * (stripe_subscription_id) e escondam botões "Assinar Pro" / banner.
 */
export function CheckoutSuccessRefresher() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    const sessionId = searchParams.get("session_id");

    if (sessionId) {
      fetch("/api/checkout/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .catch(() => null)
        .finally(() => router.refresh());
    } else {
      router.refresh();
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    const cleanUrl = url.pathname + url.search;
    window.history.replaceState(null, "", cleanUrl);
  }, [searchParams, router]);

  return null;
}
