import Link from "next/link";
import { BarChart3, Home, Plus, Settings } from "lucide-react";
import { isDemoAI } from "@/lib/ai/provider";
import { useSupabase } from "@/lib/config";
import { SignOutButton } from "./sign-out-button";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight" aria-label="study.ai home">
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
        <rect width="64" height="64" rx="16" fill="var(--surface-2)" />
        <path d="M20 40c0-9 6-16 14-16 5 0 9 3 10 7" fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="44" cy="42" r="5" fill="var(--accent)" />
      </svg>
      <span>
        study<span className="text-primary">.ai</span>
      </span>
    </Link>
  );
}

const iconLink = "grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text";

export function TopBar() {
  const demo = isDemoAI();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur pt-[env(safe-area-inset-top)]">
      {demo && (
        <div className="bg-accent/15 px-4 py-1.5 text-center text-xs font-medium text-accent">
          Demo AI: no GEMINI_API_KEY is set, so kits are built from canned logic. Add a key to use real AI.
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/" className={iconLink} aria-label="Home" title="Home">
            <Home className="size-5" />
          </Link>
          <Link href="/kits/new" className={iconLink} aria-label="New study kit" title="New study kit">
            <Plus className="size-5" />
          </Link>
          <Link href="/progress" className={iconLink} aria-label="Progress" title="Progress">
            <BarChart3 className="size-5" />
          </Link>
          <Link href="/settings" className={iconLink} aria-label="Settings" title="Settings">
            <Settings className="size-5" />
          </Link>
          {useSupabase && <SignOutButton className={iconLink} />}
        </nav>
      </div>
    </header>
  );
}
