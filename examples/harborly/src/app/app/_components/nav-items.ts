import { ChartColumn, LayoutDashboard, type LucideIcon, Settings, SquareKanban, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: SquareKanban },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/reports", label: "Reports", icon: ChartColumn },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Header title for the current /app route. */
export function titleForPath(pathname: string): string {
  const match = NAV_ITEMS.find((item) => item.href !== "/app" && isActivePath(pathname, item.href));
  return match?.label ?? "Dashboard";
}
