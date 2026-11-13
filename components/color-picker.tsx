"use client";
import { useState } from "react";
import { isHex } from "@/lib/theme";

const SWATCHES = ["#0b1120", "#ffffff", "#1a1033", "#fdf6e3", "#2dd4bf", "#c084fc", "#f472b6", "#fbbf24", "#60a5fa", "#4ade80", "#f87171", "#fb923c"];

/** Native colour wheel + hex text field + quick swatches. */
export function ColorPicker({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  // keep the text field in sync when the colour changes from the wheel or a swatch
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  const id = label.toLowerCase().replace(/\W+/g, "-");

  return (
    <div>
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-border" style={{ background: value }}>
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label} colour`} />
        </label>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{label}</div>
          {hint && <div className="text-xs text-muted">{hint}</div>}
        </div>
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
            setDraft(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
          maxLength={7}
          spellCheck={false}
          className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm uppercase"
          aria-label={`${label} hex code`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-13">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} className="size-6 rounded-full border border-black/15 ring-offset-2 ring-offset-[var(--surface)] hover:ring-2 hover:ring-[var(--primary)]" style={{ background: c }} aria-label={`Use ${c}`} />
        ))}
      </div>
    </div>
  );
}
