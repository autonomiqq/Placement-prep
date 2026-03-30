"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteTestButton({
  testId,
  isPublished,
}: {
  testId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (isPublished) {
      alert("Unpublish the test before deleting it.");
      return;
    }
    if (!confirm("Delete this test and all its questions? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/admin/tests/${testId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to delete test.");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading || isPublished}
      title={isPublished ? "Unpublish before deleting" : "Delete test"}
      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 p-1"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
