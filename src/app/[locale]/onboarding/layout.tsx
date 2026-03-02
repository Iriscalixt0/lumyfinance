import { Suspense } from "react";
import { CheckoutSuccessRefresher } from "@/components/checkout-success-refresher";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <Suspense fallback={null}>
        <CheckoutSuccessRefresher />
      </Suspense>
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(160 45% 30%) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      {children}
    </div>
  );
}
