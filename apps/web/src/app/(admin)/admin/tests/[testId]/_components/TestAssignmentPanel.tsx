"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Trash2, Loader2, Globe, Building2, GitBranch, BookOpen } from "lucide-react";

interface Assignment {
  id: string;
  test_id: string;
  college: string | null;
  branch: string | null;
  section: string | null;
}

interface College {
  id: string;
  name: string;
  code: string;
}

interface ProfileRow {
  college: string | null;
  branch: string | null;
  section: string | null;
}

interface Props {
  testId: string;
  assignments: Assignment[];
  colleges: College[];
  profileData: ProfileRow[];
}

function assignmentLabel(a: Assignment) {
  const parts = [
    a.college ?? "All colleges",
    a.branch  ? `${a.branch}` : "All branches",
    a.section ? `Sec ${a.section}` : "All sections",
  ];
  return parts.join(" → ");
}

export default function TestAssignmentPanel({ testId, assignments, colleges, profileData }: Props) {
  const router = useRouter();
  const [college, setCollege] = useState("");
  const [branch, setBranch] = useState("");
  const [section, setSection] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive branch/section options from existing student data
  const branches = [...new Set(
    profileData
      .filter((r) => !college || r.college === college)
      .map((r) => r.branch).filter(Boolean) as string[]
  )].sort();

  const sections = [...new Set(
    profileData
      .filter((r) =>
        (!college || r.college === college) &&
        (!branch || r.branch === branch)
      )
      .map((r) => r.section).filter(Boolean) as string[]
  )].sort();

  async function addAssignment() {
    setAdding(true);
    setError(null);
    const res = await fetch("/api/admin/test-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        test_id: testId,
        college:  college  || null,
        branch:   branch   || null,
        section:  section  || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to add assignment");
    } else {
      setCollege(""); setBranch(""); setSection("");
      router.refresh();
    }
    setAdding(false);
  }

  async function removeAssignment(id: string) {
    setDeletingId(id);
    await fetch(`/api/admin/test-assignments/${id}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  const isAllStudents = assignments.length === 0;

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <div>
          <p className="font-semibold text-foreground text-sm">Test Visibility</p>
          <p className="text-xs text-muted-foreground">
            Control which college / branch / section can see this test
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Current state */}
        {isAllStudents ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <Globe className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Visible to all students</p>
              <p className="text-xs text-green-700">No restrictions set. Add an assignment below to restrict visibility.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Visible to ({assignments.length} group{assignments.length !== 1 ? "s" : ""})
            </p>
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-foreground">
                    {a.college ?? <span className="text-muted-foreground italic">Any college</span>}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">
                    {a.branch ?? <span className="text-muted-foreground italic">Any branch</span>}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">
                    {a.section ? `Section ${a.section}` : <span className="text-muted-foreground italic">Any section</span>}
                  </span>
                </div>
                <button
                  onClick={() => removeAssignment(a.id)}
                  disabled={deletingId === a.id}
                  className="ml-4 flex-shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-colors"
                >
                  {deletingId === a.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add assignment form */}
        <div className="border-t border-border pt-5">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-primary" />
            Add visibility group
          </p>

          <div className="grid grid-cols-3 gap-3">
            {/* College */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                College
                <span className="ml-1 text-muted-foreground/60 font-normal">(blank = any)</span>
              </label>
              <select
                value={college}
                onChange={(e) => { setCollege(e.target.value); setBranch(""); setSection(""); }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Any college</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Branch
                <span className="ml-1 text-muted-foreground/60 font-normal">(blank = any)</span>
              </label>
              {branches.length > 0 ? (
                <select
                  value={branch}
                  onChange={(e) => { setBranch(e.target.value); setSection(""); }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Any branch</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => { setBranch(e.target.value.toUpperCase()); setSection(""); }}
                  placeholder="e.g. CSE"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
            </div>

            {/* Section */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Section
                <span className="ml-1 text-muted-foreground/60 font-normal">(blank = any)</span>
              </label>
              {sections.length > 0 ? (
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Any section</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value.toUpperCase())}
                  placeholder="e.g. A"
                  maxLength={10}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={addAssignment}
              disabled={adding}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Group
            </button>
            <p className="text-xs text-muted-foreground">
              Leave all blank to target <strong>all students</strong> regardless of college.
            </p>
          </div>
        </div>

        {/* Example note */}
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
          <p className="text-xs font-semibold text-foreground mb-1">Example: CSE-A only</p>
          <p className="text-xs text-muted-foreground">
            Select <strong>your college</strong> → Branch: <strong>CSE</strong> → Section: <strong>A</strong>.
            Only students with exactly that combination will see this test.
            You can add multiple groups (e.g. CSE-A + CSE-B) — students matching <em>any</em> group will see it.
          </p>
        </div>
      </div>
    </div>
  );
}
