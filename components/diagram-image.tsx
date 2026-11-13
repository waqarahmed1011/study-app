"use client";
import { useEffect, useRef, useState } from "react";
import type { Box, ImageRef } from "@/lib/types";
import { cx } from "@/components/ui";

const pct = (b: Box) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

/**
 * Shows an ImageRef: an uploaded picture, or a diagram with printed labels
 * covered and one structure outlined, either whole or zoomed in on the target.
 */
export function DiagramImage({ image, maxHeight = 320, className, alt = "" }: { image: ImageRef; maxHeight?: number; className?: string; alt?: string }) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // a cached image can finish loading before React attaches onLoad, so also check on mount
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth) setNat({ w: el.naturalWidth, h: el.naturalHeight });
  }, [image.path]);
  const src = `/api/files/${image.path}`;
  const hl = image.highlight ?? null;

  const overlays = (
    <>
      {image.covers?.map((c, i) => (
        <span key={i} className="absolute rounded-sm bg-slate-600" style={pct(c)} />
      ))}
      {hl && (
        <span
          className="absolute rounded-md border-[3px] border-[var(--accent)] shadow-[0_0_0_3px_rgba(0,0,0,0.25),0_0_18px_var(--accent)]"
          style={pct({ x: hl.x - 0.006, y: hl.y - 0.006, w: hl.w + 0.012, h: hl.h + 0.012 })}
        />
      )}
    </>
  );

  // zoomed crop around the highlight, computed in pixels so the crop isn't stretched
  if (image.zoom && hl && nat) {
    const W = nat.w;
    const H = nat.h;
    const bw = hl.w * W;
    const bh = hl.h * H;
    const side = Math.max(bw, bh) * 2.4;
    const cropW = Math.min(W, Math.max(side, bw * 1.5, 0.3 * W));
    const cropH = Math.min(H, Math.max(side, bh * 1.5, 0.3 * H));
    const cx0 = (hl.x + hl.w / 2) * W;
    const cy0 = (hl.y + hl.h / 2) * H;
    const left = Math.min(Math.max(0, cx0 - cropW / 2), W - cropW);
    const top = Math.min(Math.max(0, cy0 - cropH / 2), H - cropH);
    const aspect = cropW / cropH;
    return (
      <div className={cx("relative mx-auto overflow-hidden rounded-xl bg-white", className)} style={{ width: `min(100%, ${Math.round(maxHeight * aspect)}px)`, aspectRatio: String(aspect) }}>
        <div className="absolute" style={{ width: `${(W / cropW) * 100}%`, height: `${(H / cropH) * 100}%`, left: `${(-left / cropW) * 100}%`, top: `${(-top / cropH) * 100}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="block size-full" draggable={false} />
          {overlays}
        </div>
      </div>
    );
  }

  // a zoomed card measures the image first; keep it hidden until the crop can be drawn
  const measuring = Boolean(image.zoom && hl && !nat);
  return (
    <div className={cx("flex justify-center", measuring && "invisible", className)}>
      <div className="relative inline-block max-w-full overflow-hidden rounded-xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className="block max-w-full"
          style={{ maxHeight }}
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        {overlays}
      </div>
    </div>
  );
}
