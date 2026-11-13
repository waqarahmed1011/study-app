"use client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { Button, PageTitle } from "@/components/ui";
import { Uploader } from "@/components/kit/uploader";

export default function NewKitPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState(0);
  const kitPromise = useRef<Promise<string> | null>(null);

  // the kit is created on the first upload so empty kits don't pile up
  const getKitId = () => {
    kitPromise.current ??= api<{ id: string }>("/api/kits", { body: { title } }).then((k) => k.id);
    return kitPromise.current;
  };

  async function build() {
    const id = await getKitId();
    if (title.trim()) await api(`/api/kits/${id}`, { method: "PATCH", body: { title } });
    router.push(`/kits/${id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <PageTitle sub="Add everything for one course, unit or exam. You can add more later.">New study kit</PageTitle>
      <label className="mb-5 block">
        <span className="text-sm font-semibold">Kit name</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leave blank and we'll name it from your material"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5"
        />
      </label>
      <Uploader getKitId={getKitId} onChange={(n) => setAdded((a) => a + n)} />
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button size="lg" onClick={build} disabled={added === 0} className="shadow-card">
          Build my kit <ArrowRight className="size-5" />
        </Button>
      </div>
    </main>
  );
}
