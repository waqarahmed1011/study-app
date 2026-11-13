"use client";
import { Download, Palette, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/color-picker";
import { api } from "@/lib/client";
import { applyCustomVars, contrast, DEFAULT_CUSTOM, derivePalette, type CustomColors } from "@/lib/theme";
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
  const [customText, setCustomText] = useLocalSetting("customColors", JSON.stringify(DEFAULT_CUSTOM));
  let custom: CustomColors = DEFAULT_CUSTOM;
  try {
    custom = { ...DEFAULT_CUSTOM, ...JSON.parse(customText) };
  } catch {}
  const goal = Number(goalText) || 20;

  function pickTheme(id: string) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    if (id === "custom") saveCustom(custom);
    else applyCustomVars(null);
  }

  // every change is applied live and saved, so the next page load starts in your colours
  function saveCustom(next: CustomColors) {
    const vars = derivePalette(next);
    setCustomText(JSON.stringify(next));
    try {
      localStorage.setItem("themeVars", JSON.stringify(vars));
    } catch {}
    applyCustomVars(vars);
  }

  function updateCustom(key: keyof CustomColors, value: string) {
    if (theme !== "custom") {
      setTheme("custom");
      document.documentElement.setAttribute("data-theme", "custom");
    }
    saveCustom({ ...custom, [key]: value });
  }

  const lowContrast = contrast(custom.primary, custom.background) < 2.2;

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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <button type="button" onClick={() => pickTheme("custom")} className={cx("rounded-xl border-2 p-3 text-left", theme === "custom" ? "border-primary" : "border-border")} aria-pressed={theme === "custom"}>
            <div className="flex gap-1">
              {[custom.background, custom.primary, custom.accent].map((c, i) => (
                <span key={i} className="size-5 rounded-full border border-black/10" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm font-semibold"><Palette className="size-3.5" /> Custom</div>
          </button>
        </div>

        <div className={cx("mt-5 space-y-4 rounded-xl border border-border p-4", theme !== "custom" && "opacity-80")}>
          <div>
            <h3 className="text-sm font-bold">Your own colours</h3>
            <p className="text-xs text-muted">Pick any colours. Card shades and text adjust automatically so everything stays readable.</p>
          </div>
          <ColorPicker label="Background" value={custom.background} onChange={(v) => updateCustom("background", v)} />
          <ColorPicker label="Main colour" hint="Buttons, progress bars, active tabs" value={custom.primary} onChange={(v) => updateCustom("primary", v)} />
          <ColorPicker label="Highlight" hint="Streaks, stars, review badges" value={custom.accent} onChange={(v) => updateCustom("accent", v)} />
          {theme === "custom" && lowContrast && (
            <p className="rounded-lg bg-accent/15 px-3 py-2 text-xs text-accent">Your main colour is hard to see on this background. Try a lighter or darker shade.</p>
          )}
          {theme === "custom" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted">Preview:</span>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-ink">Button</span>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">Highlight</span>
              <span className="rounded-lg px-3 py-1 text-xs" style={{ background: "var(--opt-3)" }}>Answer card</span>
              <span className="rounded-lg bg-good-soft px-3 py-1 text-xs font-semibold text-good">Correct</span>
              <span className="rounded-lg bg-bad-soft px-3 py-1 text-xs font-semibold text-bad">Wrong</span>
            </div>
          )}
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
