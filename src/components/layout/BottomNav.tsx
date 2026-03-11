import { Link, useLocation } from "react-router-dom";
import { useTranslations } from "@/lib/i18n";
import { LayoutDashboard, ArrowLeftRight, Bot } from "lucide-react";

const NAV_ITEMS = [
  { labelKey: "overview", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "transactions", href: "/transactions", icon: ArrowLeftRight },
  { labelKey: "lumy", href: "/lumy", icon: Bot },
] as const;

export function BottomNav() {
  const t = useTranslations("nav");
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/60 safe-area-bottom shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch justify-around h-[56px]">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-semibold transition-all duration-200 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground active:scale-95"
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200 ${
                active ? "bg-primary/10" : ""
              }`}>
                <item.icon className={`h-[18px] w-[18px] transition-all duration-200 ${active ? "text-primary" : ""}`} />
              </div>
              <span className="leading-none">{t(item.labelKey)}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] rounded-b-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
