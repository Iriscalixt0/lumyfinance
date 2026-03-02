import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative px-5 py-12">
      <div className="absolute top-4 right-4 z-10">
        <LocaleSwitcher />
      </div>
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
