// @ts-nocheck
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Leaderboard" };

const rankColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-slate-400",
  3: "text-amber-600",
};

const rankIcons: Record<number, React.ReactNode> = {
  1: <Trophy className="h-5 w-5 text-yellow-500" />,
  2: <Medal className="h-5 w-5 text-slate-400" />,
  3: <Medal className="h-5 w-5 text-amber-600" />,
};

export default async function LeaderboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: leaders } = await supabase
    .from("leaderboard")
    .select("*")
    .limit(50);

  const { data: myRank } = await supabase
    .from("leaderboard")
    .select("rank, total_points")
    .eq("id", user!.id)
    .single();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Top performers on PlacementPrep</p>
        </div>
        {myRank && (
          <div className="rounded-xl border border-border bg-card px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground">Your rank</p>
            <p className="text-2xl font-bold text-primary">#{myRank.rank}</p>
            <p className="text-xs text-muted-foreground">{myRank.total_points} pts</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rank</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">College</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Points</th>
            </tr>
          </thead>
          <tbody>
            {leaders?.map((leader) => {
              const isMe = leader.id === user!.id;
              return (
                <tr
                  key={leader.id}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    isMe ? "bg-primary/5" : "hover:bg-muted/40"
                  )}
                >
                  <td className="px-6 py-4 w-16">
                    <div className="flex items-center gap-2">
                      {rankIcons[leader.rank] ?? (
                        <span className={cn("text-sm font-bold", rankColors[leader.rank] ?? "text-muted-foreground")}>
                          #{leader.rank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(leader.full_name ?? leader.username)?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {leader.full_name ?? leader.username}
                          {isMe && (
                            <span className="text-xs font-normal text-primary bg-primary/10 rounded-full px-2 py-0.5">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">@{leader.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <p className="text-sm text-muted-foreground">{leader.college ?? "—"}</p>
                    {leader.branch && (
                      <p className="text-xs text-muted-foreground">{leader.branch}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-foreground">{leader.total_points}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!leaders || leaders.length === 0) && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            No scores yet. Be the first to take a test!
          </div>
        )}
      </div>
    </div>
  );
}
