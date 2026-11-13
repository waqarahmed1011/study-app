"use client";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Kit } from "@/lib/types";

export function KitHeader({ kit }: { kit: Kit }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(kit.title);

  async function save() {
    setEditing(false);
    if (title.trim() && title !== kit.title) {
      await api(`/api/kits/${kit.id}`, { method: "PATCH", body: { title } });
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`Delete "${kit.title}" and all its progress? This can't be undone.`)) return;
    await api(`/api/kits/${kit.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{kit.emoji}</div>
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          onBlur={save}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xl font-bold"
        />
      ) : (
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{kit.title}</h1>
      )}
      <button type="button" onClick={() => (editing ? save() : setEditing(true))} className="no-print grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label={editing ? "Save name" : "Rename kit"}>
        {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
      </button>
      <button type="button" onClick={remove} className="no-print grid size-9 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad" aria-label="Delete kit">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
