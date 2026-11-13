import { isDemoAI } from "@/lib/ai/provider";
import { useSupabase } from "@/lib/config";
import { PageTitle } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <PageTitle>Settings</PageTitle>
      <SettingsForm
        info={{
          storage: useSupabase ? "Supabase (synced across devices)" : "This server's local file store (single user)",
          ai: isDemoAI() ? "Demo mode (no GEMINI_API_KEY)" : `Google Gemini (${process.env.GEMINI_MODEL || "gemini-3.8-flash"})`,
        }}
      />
    </main>
  );
}
