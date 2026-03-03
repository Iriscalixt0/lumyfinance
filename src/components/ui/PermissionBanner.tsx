import { ShieldAlert, Crown } from "lucide-react";
import { Link } from "react-router-dom";

interface PermissionBannerProps {
  reason: string;
  hasPlan: boolean;
  isViewer: boolean;
}

export function PermissionBanner({ reason, hasPlan, isViewer }: PermissionBannerProps) {
  if (!reason) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
      {isViewer ? (
        <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      ) : (
        <Crown className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{reason}</p>
        {!hasPlan && !isViewer && (
          <Link
            to="/plan"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-primary hover:underline"
          >
            <Crown className="h-3.5 w-3.5" />
            Ver plano Pro
          </Link>
        )}
      </div>
    </div>
  );
}
