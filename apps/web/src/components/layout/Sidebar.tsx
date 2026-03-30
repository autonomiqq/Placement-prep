"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, LayoutDashboard, BookOpen, BarChart2,
  Trophy, MessageSquare, User, Sparkles, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tests",       icon: BookOpen,         label: "Practice Tests" },
  { href: "/analytics",   icon: BarChart2,        label: "Analytics" },
  { href: "/leaderboard", icon: Trophy,           label: "Leaderboard" },
  { href: "/tutor",       icon: MessageSquare,    label: "AI Tutor" },
  { href: "/agent",       icon: Bot,              label: "AI Agent" },
  { href: "/profile",     icon: User,             label: "Profile" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col sidebar-gradient border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center ring-1 ring-primary/30">
          <Brain className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <span className="gradient-text font-bold text-base tracking-tight">PlacementPrep</span>
          <p className="text-[10px] text-white/30 font-medium tracking-widest uppercase mt-0.5">
            AI Platform
          </p>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-4 pt-5 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Navigation
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom card */}
      <div className="px-3 pb-5 pt-2 border-t border-white/5 mt-2">
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold text-primary">AI-Powered</p>
          </div>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Local LLM — your data never leaves this machine
          </p>
        </div>
      </div>
    </aside>
  );
}
