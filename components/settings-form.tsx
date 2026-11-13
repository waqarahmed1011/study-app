"use client";
import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useLocalSetting } from "@/lib/use-local-setting";
import { Button, Card, cx } from "@/components/ui";

const THEMES = [
  { id: "midnight", name: "Midnight", swatch: ["#0b1120", "#2dd4bf", "#fbbf24"] },
  { id: "daylight", name: "Daylight", swatch: ["#f5f7fb", "#0d9488", "#b45309"] },
  { id: "forest", name: "Forest", swatch: ["#0d1712", "#a3e635", "#fb923c"] },
];

export function SettingsForm({ info }: { info: { storage: string; ai: string } }) {
  const router = useRouter();
  const [theme, setTheme] = useLocalSetting("theme", "midnight");
  const [goalText, setGoalText] = useLocalSetting("dailyGoal", "20");
  const goal = Number(goalText) || 20;

  function pickTheme(id: string) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
  }

  function saveGoal(n: number) {
    setGoalText(String(n));
  }

  async function wipe() {
    if (!confirm("Delete ALL your kits, uploads and progress? This can't be undone.")) return;
    if (prompt('Type "delete" to confirm') !== "delete") return;
    await api("/api/account", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-bold">Colour mode</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button key={t.id} type="button" onClick={() => pickTheme(t.id)} className={cx("rounded-xl border-2 p-3 text-left", theme === t.id ? "border-primary" : "border-border")} aria-pressed={theme === t.id}>
              <div className="flex gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="size-5 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <div className="mt-2 text-sm font-semibold">{t.name}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold">Daily goal</h2>
        <p className="text-sm text-muted">Questions and cards per day.</p>
        <div className="mt-3 flex items-center gap-3">
          <input type="range" min={5} max={100} step={5} value={goal} onChange={(e) => saveGoal(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" aria-label="Daily goal" />
          <span className="w-10 text-right font-bold">{goal}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold">Your data</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Storage</dt><dd className="text-right">{info.storage}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">AI</dt><dd className="text-right">{info.ai}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/account" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 text-sm font-semibold">
            <Download className="size-4" /> Export JSON
          </a>
          <Button variant="danger" onClick={wipe}>
            <Trash2 className="size-4" /> Delete everything
          </Button>
        </div>
      </Card>
    </div>
  );
}
