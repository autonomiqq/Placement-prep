"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return "PP@" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CreateStudentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "", full_name: "", college: "", branch: "", section: "",
    graduation_year: "", password: generatePassword(),
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          graduation_year: form.graduation_year ? parseInt(form.graduation_year) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, message: data.error ?? "Failed to create student" });
      } else {
        setResult({ success: true, message: `Account created! Temporary password: ${form.password}` });
        setForm({ email: "", full_name: "", college: "", branch: "", section: "", graduation_year: "", password: generatePassword() });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/students" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Student</h1>
          <p className="text-sm text-muted-foreground">Create a single student account</p>
        </div>
      </div>

      {result && (
        <div className={`rounded-lg p-4 text-sm flex items-start gap-3 ${result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
          {result.success && <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <p className="font-medium">{result.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
            <input
              type="email" required value={form.email} onChange={(e) => set("email", e.target.value)}
              placeholder="student@college.edu"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Full Name *</label>
            <input
              type="text" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)}
              placeholder="Rahul Sharma"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">College</label>
              <input
                type="text" value={form.college} onChange={(e) => set("college", e.target.value)}
                placeholder="NIT Warangal"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch</label>
              <input
                type="text" value={form.branch} onChange={(e) => set("branch", e.target.value)}
                placeholder="CSE"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Section
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(e.g. A, B, C)</span>
              </label>
              <input
                type="text" value={form.section} onChange={(e) => set("section", e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={10}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Graduation Year</label>
              <input
                type="number" value={form.graduation_year} onChange={(e) => set("graduation_year", e.target.value)}
                placeholder="2026" min="2024" max="2030"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Temporary Password *</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"} required value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Share this with the student. They can change it after logging in.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
          <Link href="/admin/students" className="rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </Link>
          <Link href="/admin/students/bulk" className="ml-auto rounded-lg border border-dashed border-border px-5 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            Bulk import instead →
          </Link>
        </div>
      </form>
    </div>
  );
}
