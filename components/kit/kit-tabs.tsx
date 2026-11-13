"use client";
import { BookOpen, ClipboardCheck, FolderOpen, History, Layers, MessageCircle, MoreHorizontal, Shapes, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";

const TABS = [
  { seg: "smart", label: "Smart Study", short: "Smart", icon: Sparkles },
  { seg: "flashcards", label: "Flashcards", short: "Cards", icon: Layers },
  { seg: "test", label: "Test", short: "Test", icon: ClipboardCheck },
  { seg: "guide", label: "Study Guide", short: "Guide", icon: BookOpen },
  { seg: "diagrams", label: "Diagrams", short: "Diagrams", icon: Shapes },
  { seg: "chat", label: "Tutor", short: "Tutor", icon: MessageCircle },
  { seg: "history", label: "History", short: "History", icon: History },
  { seg: "materials", label: "Materials", short: "Materials", icon: FolderOpen },
] as const;

const MOBILE_MAIN = ["smart", "flashcards", "test", "guide"];

export function KitTabs({ kitId }: { kitId: string }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const active = TABS.find((t) => path.startsWith(`/kits/${kitId}/${t.seg}`))?.seg;
  const href = (seg: string) => `/kits/${kitId}/${seg}`;

  return (
    <>
      {/* desktop / tablet: tab row */}
      <nav className="no-print hidden gap-1 overflow-x-auto border-b border-border sm:flex" aria-label="Kit sections">
        {TABS.map((t) => (
          <Link
            key={t.seg}
            href={href(t.seg)}
            className={cx(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold",
              active === t.seg ? "border-primary text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </Link>
        ))}
      </nav>

      {/* phone: bottom bar like a native app */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label="Kit sections">
        <div className="grid grid-cols-5">
          {TABS.filter((t) => MOBILE_MAIN.includes(t.seg)).map((t) => (
            <Link key={t.seg} href={href(t.seg)} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active === t.seg ? "text-primary" : "text-muted")}>
              <t.icon className="size-5" />
              {t.short}
            </Link>
          ))}
          <button type="button" onClick={() => setMore((m) => !m)} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active && !MOBILE_MAIN.includes(active) ? "text-primary" : "text-muted")} aria-expanded={more}>
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
        {more && (
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            {TABS.filter((t) => !MOBILE_MAIN.includes(t.seg)).map((t) => (
              <Link key={t.seg} href={href(t.seg)} onClick={() => setMore(false)} className={cx("flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm font-semibold", active === t.seg && "text-primary")}>
                <t.icon className="size-4" /> {t.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
