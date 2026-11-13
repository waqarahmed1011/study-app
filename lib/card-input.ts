import type { ImageRef } from "@/lib/types";
import { HttpError } from "@/lib/api";
import { clampBox } from "@/lib/diagram/geometry";

/** Validate an image reference coming from the browser: only files inside this kit's folder. */
export function cleanImage(v: unknown, kitId: string): ImageRef | null {
  if (!v) return null;
  const img = v as ImageRef;
  if (typeof img.path !== "string" || !img.path.startsWith(`${kitId}/`) || img.path.includes("..")) {
    throw new HttpError(400, "Bad image reference");
  }
  return {
    path: img.path,
    highlight: img.highlight ? clampBox(img.highlight) : null,
    covers: Array.isArray(img.covers) ? img.covers.slice(0, 50).map(clampBox) : [],
    zoom: Boolean(img.zoom),
  };
}

export function cleanText(v: unknown, max = 2000) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
