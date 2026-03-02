"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground font-sans">
        <h1 className="text-xl font-semibold mb-2">Algo deu errado</h1>
        <p className="text-muted-foreground text-center mb-6">
          O erro foi registrado. Tente novamente.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
