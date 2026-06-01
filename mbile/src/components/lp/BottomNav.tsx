import { Link, useLocation } from "@tanstack/react-router";
import { BarChart3, House, ShieldAlert, Store, User } from "lucide-react";

const tabs = [
  { to: "/home", label: "Dashboard", icon: House },
  { to: "/social", label: "Stores", icon: Store },
  { to: "/control", label: "Control", icon: ShieldAlert },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/profile", label: "Me", icon: User },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-2">
      <div className="glass-strong mx-auto flex max-w-md items-center justify-between rounded-full px-2.5 py-2.5">
        {tabs.map((t) => {
          const active = pathname === t.to || (t.to === "/home" && pathname === "/");
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="relative flex-1 rounded-full px-1 py-1.5 transition-colors"
            >
              {active && (
                <div className="absolute inset-0 rounded-full border border-foreground/10 bg-foreground/5" />
              )}
              <div className="relative flex flex-col items-center gap-1.5">
                <Icon
                  className={`h-5 w-5 transition-all ${
                    active 
                      ? "text-foreground" 
                      : "text-muted-foreground"
                  }`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span className={`text-[10px] font-medium tracking-wide transition-colors ${
                  active 
                    ? "text-foreground" 
                    : "text-muted-foreground"
                }`}>
                  {t.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
