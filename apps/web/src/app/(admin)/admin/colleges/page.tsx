"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Loader2, Users, Hash } from "lucide-react";

interface College {
  id: string;
  name: string;
  code: string;
  student_count: number;
  created_at: string;
}

export default function CollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/colleges");
    const data = await res.json();
    setColleges(data.colleges ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addCollege(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const res = await fetch("/api/admin/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to add college");
    } else {
      setName("");
      setCode("");
      await load();
    }
    setAdding(false);
  }

  async function deleteCollege(id: string) {
    if (!confirm("Delete this college? Students assigned to it will not be deleted.")) return;
    setDeletingId(id);
    await fetch(`/api/admin/colleges/${id}`, { method: "DELETE" });
    setDeletingId(null);
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">College Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage colleges and use them when assigning tests to specific groups
        </p>
      </div>

      {/* Add college form */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Add College
        </h2>
        <form onSubmit={addCollege} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-foreground mb-1.5">College Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="National Institute of Technology Trichy"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-foreground mb-1.5">Short Code *</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="NIT-T"
              maxLength={20}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !name.trim() || !code.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* College list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20">
          <p className="text-sm font-semibold text-foreground">{colleges.length} College{colleges.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : colleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No colleges added yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Add a college above to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">College</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Students</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => deleteCollege(c.id)}
                      disabled={deletingId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === c.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">How college management works</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc pl-4">
          <li>Add colleges here to make them available as targets when assigning tests.</li>
          <li>When creating a student, set their College, Branch, and Section (e.g. CSE, A).</li>
          <li>On a test's detail page, use <strong>Assign Visibility</strong> to restrict it to a specific college → branch → section.</li>
          <li>A test with no assignments is visible to <strong>all students</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
