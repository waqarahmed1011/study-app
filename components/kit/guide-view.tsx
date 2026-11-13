"use client";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Markdown } from "@/components/markdown";
import { Button, Card, cx, EmptyState, ErrorNote } from "@/components/ui";

export function GuideView({ kitId, title, guide, summary }: { kitId: string; title: string; guide: string | null; summary: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<"guide" | "summary">("guide");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = tab === "guide" ? guide : summary;

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/kits/${kitId}/generate`, { body: { step: tab } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([content ?? ""], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}-${tab}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm" role="tablist">
          {(["guide", "summary"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-full px-4 py-1.5 font-semibold", tab === t ? "bg-surface text-text shadow-card" : "text-muted")}>
              {t === "guide" ? "Study guide" : "Summary"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={regenerate} disabled={busy} title="Regenerate">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} <span className="hidden sm:inline">Regenerate</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={download} disabled={!content} title="Download Markdown">
            <Download className="size-4" /> <span className="hidden sm:inline">Download</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} disabled={!content} title="Print or save as PDF">
            <Printer className="size-4" /> <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {content ? (
        <Card className="p-5 sm:p-8">
          <Markdown>{content}</Markdown>
        </Card>
      ) : (
        <EmptyState title={`No ${tab} yet`}>
          <Button className="mt-2" onClick={regenerate} disabled={busy}>Generate it</Button>
        </EmptyState>
      )}
    </div>
  );
}
