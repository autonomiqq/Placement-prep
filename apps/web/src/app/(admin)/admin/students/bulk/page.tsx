"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Download, CheckCircle, XCircle, Loader2 } from "lucide-react";

const CSV_TEMPLATE = `email,full_name,college,branch,graduation_year
student1@example.com,Rahul Sharma,NIT Warangal,CSE,2026
student2@example.com,Priya Patel,BITS Pilani,ECE,2025
student3@example.com,Arun Kumar,VIT Vellore,IT,2026`;

type RowResult = { email: string; full_name: string; status: "success" | "error"; message: string };

export default function BulkImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      const lines = text.trim().split("\n").slice(0, 6); // preview first 5 rows
      setPreview(lines.map((l) => l.split(",")));
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.csv";
    a.click();
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/admin/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([{ email: "", full_name: "", status: "error", message: "Network error" }]);
    } finally {
      setLoading(false);
    }
  }

  const successCount = results?.filter((r) => r.status === "success").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/students" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk Import Students</h1>
          <p className="text-sm text-muted-foreground">Upload a CSV to create multiple accounts at once</p>
        </div>
      </div>

      {/* Template */}
      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">CSV Format</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Required columns: email, full_name. Optional: college, branch, graduation_year</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" /> Template
          </button>
        </div>

        <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto">{CSV_TEMPLATE}</pre>

        <p className="text-xs text-muted-foreground">
          Passwords are auto-generated as <code className="bg-muted px-1 rounded">PP@XXXXXXXX</code> and returned in the results. Each student uses their email to log in.
        </p>
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Upload CSV</h2>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Click to upload or drag & drop</p>
          <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {/* Or paste */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Or paste CSV directly</label>
          <textarea
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setPreview(e.target.value.trim().split("\n").slice(0, 6).map((l) => l.split(","))); }}
            rows={5}
            placeholder="email,full_name,college,branch,graduation_year&#10;student@college.edu,Name,College,Branch,2026"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Preview */}
        {preview.length > 1 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Preview ({preview.length - 1} rows)</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {preview[0].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">{h.trim()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-foreground">{cell.trim()}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleImport} disabled={!csvText.trim() || loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Import Students
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-foreground">Import Results</h2>
            <span className="text-sm text-green-600 font-medium">{successCount} created</span>
            {errorCount > 0 && <span className="text-sm text-destructive font-medium">{errorCount} failed</span>}
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg p-3 text-sm ${r.status === "success" ? "bg-green-50" : "bg-destructive/5"}`}>
                {r.status === "success" ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-foreground">{r.full_name} ({r.email})</p>
                  <p className={`text-xs mt-0.5 ${r.status === "success" ? "text-green-700" : "text-destructive"}`}>
                    {r.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
