"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Star, Crown } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

interface Profile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number | null;
  rank: number | null;
}

function formatPoints(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default function Topbar({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  const rank = profile?.rank ?? null;
  const points = profile?.total_points ?? 0;

  return (
    <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-5 gap-4 sticky top-0 z-10">
      {/* Left: Points + Rank pills */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1">
          <Star className="h-3 w-3 text-primary fill-primary" />
          <span className="text-xs font-bold text-primary">{formatPoints(points)}</span>
          <span className="text-[11px] text-primary/60">pts</span>
        </div>

        {rank && rank <= 50 && (
          <div className={cn(
            "flex items-center gap-1 rounded-full border px-2.5 py-1",
            rank === 1 ? "bg-amber-50 border-amber-200 text-amber-700" :
            rank <= 3  ? "bg-slate-50 border-slate-200 text-slate-600" :
                         "bg-muted border-border text-muted-foreground"
          )}>
            <Crown className="h-2.5 w-2.5" />
            <span className="text-xs font-bold">#{rank}</span>
          </div>
        )}
      </div>

      {/* Right: User + Logout */}
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-muted transition-colors group"
        >
          <div className="relative h-7 w-7 shrink-0">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-violet-400 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border-2 border-card" />
          </div>
          <span className="hidden sm:block text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {profile?.full_name?.split(" ")[0] ?? profile?.username ?? "User"}
          </span>
        </Link>

        <div className="h-5 w-px bg-border" />

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:block text-xs font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
}
