"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardList, BarChart3,
  Brain, ChevronRight, LogOut, Database, Sparkles, Building2,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/admin",                label: "Overview",      icon: LayoutDashboard },
  { href: "/admin/students",       label: "Students",      icon: Users },
  { href: "/admin/colleges",       label: "Colleges",      icon: Building2 },
  { href: "/admin/tests",          label: "Tests",         icon: ClipboardList },
  { href: "/admin/question-bank",  label: "Question Bank", icon: Database },
  { href: "/admin/analytics",      label: "Analytics",     icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(250 30% 97%)" }}>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col sidebar-gradient border-r border-white/5">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center ring-1 ring-primary/30">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="gradient-text font-bold text-base tracking-tight">PlacementPrep</span>
              <p className="text-[10px] text-white/30 font-medium tracking-widest uppercase mt-0.5">
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <div className="px-4 pt-5 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
            Management
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary/20 text-white nav-active-glow"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-primary/30" : "bg-white/5 group-hover:bg-white/10"
                )}>
                  <Icon className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    active ? "text-primary" : "text-white/40 group-hover:text-white/60"
                  )} />
                </div>
                <span>{label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 pt-2 border-t border-white/5 space-y-2">
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <p className="text-[11px] font-semibold text-primary">Admin Mode</p>
            </div>
            <p className="text-[10px] text-white/30 leading-relaxed">Full access to all platform data</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 group-hover:bg-red-900/30">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center px-6 bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">Admin</span>
            {pathname !== "/admin" && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-border" />
                <span className="capitalize font-semibold text-foreground">
                  {pathname.split("/").filter(Boolean).slice(1).join(" / ")}
                </span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
