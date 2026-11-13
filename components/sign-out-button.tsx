"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      aria-label="Sign out"
      title="Sign out"
      onClick={async () => {
        await createSupabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-5" />
    </button>
  );
}
