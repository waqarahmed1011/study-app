"use client";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { GEN_STEPS, type GenStep, type Kit, type StepStatus } from "@/lib/types";
import { Button, Card, ErrorNote } from "@/components/ui";

const LABELS: Record<GenStep, string> = {
  extract: "Reading your uploads",
  outline: "Finding the topics",
  flashcards: "Writing flashcards",
  questions: "Writing practice questions",
  guide: "Writing your study guide",
  summary: "Writing a summary",
};

/**
 * Drives kit generation one step at a time, so each request stays short and
 * the student sees progress. `all` re-runs every step (used after adding material).
 */
export function GenerationPanel({ kit, all = false, onDone }: { kit: Kit; all?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Partial<Record<GenStep, StepStatus>>>(all ? {} : kit.gen_steps);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  async function run(fromScratch: boolean) {
    if (running.current) return;
    running.current = true;
    setError(null);
    const status: Partial<Record<GenStep, StepStatus>> = fromScratch ? {} : { ...steps };
    // reading uploads and finding topics come first; then the four writing steps
    // don't depend on each other, so they run at the same time
    const runOne = async (step: GenStep) => {
      if (status[step] === "done") return;
      status[step] = "running";
      setSteps({ ...status });
      try {
        await api(`/api/kits/${kit.id}/generate`, { body: { step } });
        status[step] = "done";
      } catch (err) {
        status[step] = "error";
        throw err;
      } finally {
        setSteps({ ...status });
      }
    };
    try {
      await runOne("extract");
      await runOne("outline");
      const results = await Promise.allSettled((["flashcards", "questions", "guide", "summary"] as GenStep[]).map(runOne));
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) throw failed.reason;
      onDone?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      running.current = false;
    }
  }

  // generation starts as soon as the panel mounts
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = GEN_STEPS.filter((s) => steps[s] === "done").length;

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h2 className="text-xl font-bold">{all ? "Updating your kit" : "Building your study kit"}</h2>
      <p className="mt-1 text-sm text-muted">
        Usually 15–40 seconds. Big PDFs can take longer on the free AI tier. Keep this tab open.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(doneCount / GEN_STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-5 space-y-3">
        {GEN_STEPS.map((s) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            {steps[s] === "done" ? (
              <CheckCircle2 className="size-5 text-good" />
            ) : steps[s] === "running" ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : steps[s] === "error" ? (
              <AlertTriangle className="size-5 text-bad" />
            ) : (
              <Circle className="size-5 text-muted" />
            )}
            <span className={steps[s] === "running" ? "font-semibold" : steps[s] === "done" ? "text-muted" : ""}>{LABELS[s]}</span>
          </li>
        ))}
      </ol>
      {error && (
        <div className="mt-5 space-y-3">
          <ErrorNote>{error}</ErrorNote>
          <Button onClick={() => run(false)}>Retry</Button>
        </div>
      )}
    </Card>
  );
}
