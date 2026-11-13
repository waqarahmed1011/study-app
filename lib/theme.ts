// Turns three user-picked colours into the full set of theme variables used in
// globals.css. Pure functions so they can be unit tested and used anywhere.

export interface CustomColors {
  background: string; // page background
  primary: string; // buttons, progress, active tabs
  accent: string; // streaks, stars, highlights
}

type RGB = [number, number, number];

export function isHex(s: string) {
  return /^#[0-9a-f]{6}$/i.test(s.trim());
}

export function hexToRgb(hex: string): RGB {
  const h = hex.trim().replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB) {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Mix a toward b by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(hex: string) {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio, 1 .. 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Rotate a colour's hue by `deg` degrees (used to make the 4 answer-card tints). */
export function rotateHue(hex: string, deg: number) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]);
}

/** Black or white, whichever reads better on `bg`. */
export function inkFor(bg: string) {
  return contrast(bg, "#000000") >= contrast(bg, "#ffffff") ? "#0b0f19" : "#ffffff";
}

/** Every CSS variable the app's theme uses, derived from the three picks. */
export function derivePalette({ background, primary, accent }: CustomColors): Record<string, string> {
  // "dark" means white text reads better than black on this background
  const dark = inkFor(background) === "#ffffff";
  const base = dark ? "#ffffff" : "#000000";
  const text = dark ? "#f4f6fb" : "#0f172a";
  const good = dark ? "#22c55e" : "#16a34a";
  const bad = dark ? "#f05252" : "#dc2626";
  const tint = (c: string) => (dark ? rgba(c, 0.2) : mix(background, c, 0.18));

  return {
    "--bg": background,
    "--surface": dark ? mix(background, base, 0.05) : mix(background, "#ffffff", 0.75),
    "--surface-2": dark ? mix(background, base, 0.1) : mix(background, "#000000", 0.04),
    "--border": dark ? mix(background, base, 0.18) : mix(background, "#000000", 0.12),
    "--text": text,
    "--muted": mix(text, background, 0.4),
    "--primary": primary,
    "--primary-ink": inkFor(primary),
    "--accent": accent,
    "--good": good,
    "--good-soft": rgba(good, dark ? 0.16 : 0.12),
    "--bad": bad,
    "--bad-soft": rgba(bad, dark ? 0.16 : 0.1),
    "--opt-1": tint(primary),
    "--opt-2": tint(accent),
    "--opt-3": tint(rotateHue(primary, 120)),
    "--opt-4": tint(rotateHue(primary, -120)),
    "--shadow": dark
      ? "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.25)"
      : "0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)",
    "color-scheme": dark ? "dark" : "light",
  };
}

export const DEFAULT_CUSTOM: CustomColors = { background: "#1a1033", primary: "#c084fc", accent: "#f472b6" };

/** Apply (or clear) custom variables on <html>. Inline styles override the preset themes. */
export function applyCustomVars(vars: Record<string, string> | null) {
  const el = document.documentElement;
  for (const p of Array.from(el.style)) if (p.startsWith("--") || p === "color-scheme") el.style.removeProperty(p);
  if (vars) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", vars?.["--bg"] ?? "#0b1120");
}
