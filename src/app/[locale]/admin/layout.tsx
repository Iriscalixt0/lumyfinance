import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-foreground font-bold tracking-tight"
          >
            <Logo size="sm" />
            <span className="text-gradient-hero">Lumyf</span>
          </Link>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Admin Beta
          </span>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
