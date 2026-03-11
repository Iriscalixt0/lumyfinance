import { Link, useLocation } from "react-router-dom";
import { useTranslations } from "@/lib/i18n";
import { LayoutDashboard, ArrowLeftRight, Bot, Mic, TrendingUp } from "lucide-react";

export function BottomNav() {
  const t = useTranslations("nav");
  const location = useLocation();

  const leftItems = [
    { labelKey: "overview", href: "/dashboard", icon: LayoutDashboard },
    { labelKey: "transactions", href: "/transactions", icon: ArrowLeftRight },
  ] as const;

  const rightItems = [
    { labelKey: "investments", href: "/investments", icon: TrendingUp },
    { labelKey: "lumy", href: "/lumy", icon: Bot },
  ] as const;

  const renderItem = (item: { labelKey: string; href: string; icon: typeof LayoutDashboard }) => {
    const active = location.pathname === item.href;
    return (
      <Link
        key={item.href}
        to={item.href}
        className={`flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-semibold transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
        <span className="leading-none">{t(item.labelKey)}</span>
      </Link>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-bottom">
      {/* Dark bar */}
      <div className="bg-[#1a1a2e] flex items-center justify-around h-[56px] relative">
        {leftItems.map(renderItem)}

        {/* Center FAB — elevated green mic circle */}
        <div className="flex flex-col items-center justify-center flex-1">
          <button
            onClick={() => {
              // Dispatch custom event to trigger VoiceFAB
              window.dispatchEvent(new CustomEvent("lumyf:voice-start"));
            }}
            className="relative -mt-7 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Voice input"
          >
            <Mic className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>

        {rightItems.map(renderItem)}
      </div>
    </nav>
  );
}
