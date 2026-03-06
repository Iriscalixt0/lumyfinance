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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-stretch justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              <span>{t(item.labelKey)}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
