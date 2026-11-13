"use client";
import { ArrowDown, ArrowUp, GripHorizontal, ImageIcon, Loader2, MoreVertical, Plus, Search, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { bucketOf } from "@/lib/study/fsrs";
import type { Flashcard, ImageRef } from "@/lib/types";
import { DiagramImage } from "@/components/diagram-image";
import { compressImage } from "@/components/kit/uploader";
import { Badge, Button, cx } from "@/components/ui";


/** Edit cards like a card-set builder: term + definition, a picture on either side, reorder, add, delete. */
export function CardEditor({ kitId, cards, setCards, topics }: { kitId: string; cards: Flashcard[]; setCards: (fn: (c: Flashcard[]) => Flashcard[]) => void; topics: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const filtering = Boolean(q || topic);
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const shown = cards.filter((c) => (!topic || c.topic_id === topic) && (!q || (c.front + " " + c.back).toLowerCase().includes(q.toLowerCase())));

  const replace = (card: Flashcard) => setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));

  async function saveOrder(next: Flashcard[]) {
    setCards(() => next);
    await api(`/api/kits/${kitId}/flashcards/order`, { body: { ids: next.map((c) => c.id) } }).catch(() => {});
  }

  function move(id: string, dir: -1 | 1) {
    const i = cards.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cards.length) return;
    const next = [...cards];
    [next[i], next[j]] = [next[j], next[i]];
    saveOrder(next);
  }

  async function addCard() {
    setAdding(true);
    try {
      const card = await api<Flashcard>(`/api/kits/${kitId}/flashcards`, { body: { front: "", back: "", topic_id: topic || null } });
      setCards((cs) => [...cs, card]);
      setTimeout(() => document.getElementById(`term-${card.id}`)?.focus(), 50);
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this card?")) return;
    setCards((cs) => cs.filter((c) => c.id !== id));
    await api(`/api/flashcards/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" className="w-full bg-transparent py-2 outline-none" />
        </label>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-sm text-muted">
        {shown.length} cards{filtering ? " · clear the search to reorder" : " · drag ≡ or use ⋮ to reorder"}
      </p>

      <ol className="space-y-3">
        {shown.map((c) => (
          <li
            key={c.id}
            onDragOver={(e) => {
              if (!dragId || dragId === c.id || filtering) return;
              e.preventDefault();
              const from = cards.findIndex((x) => x.id === dragId);
              const to = cards.findIndex((x) => x.id === c.id);
              if (from < 0 || to < 0) return;
              const next = [...cards];
              next.splice(to, 0, next.splice(from, 1)[0]);
              setCards(() => next);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) saveOrder(cards);
              setDragId(null);
            }}
            className={cx("transition-opacity", dragId === c.id && "opacity-50")}
          >
            <CardRow
              kitId={kitId}
              card={c}
              index={cards.findIndex((x) => x.id === c.id) + 1}
              topicName={c.topic_id ? names.get(c.topic_id) : undefined}
              onSaved={replace}
              onDelete={() => remove(c.id)}
              onMove={(dir) => move(c.id, dir)}
              canReorder={!filtering}
              onDragStart={() => setDragId(c.id)}
              onDragEnd={() => {
                if (dragId) saveOrder(cards);
                setDragId(null);
              }}
            />
          </li>
        ))}
      </ol>

      <div className="mt-4 flex justify-center">
        <Button variant="secondary" onClick={addCard} disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add card
        </Button>
      </div>
    </div>
  );
}

function CardRow(props: {
  kitId: string;
  card: Flashcard;
  index: number;
  topicName?: string;
  onSaved: (c: Flashcard) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  canReorder: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { kitId, card, index, onSaved } = props;
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<Flashcard>) {
    setSaving(true);
    try {
      onSaved(await api<Flashcard>(`/api/flashcards/${card.id}`, { method: "PATCH", body: patch }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{index}</span>
          {props.topicName && <Badge>{props.topicName}</Badge>}
          <Badge tone={bucketOf(card) === "mastered" ? "good" : bucketOf(card) === "learning" ? "accent" : "muted"}>{bucketOf(card)}</Badge>
          {saving && <Loader2 className="size-3.5 animate-spin text-muted" />}
        </div>
        {props.canReorder && (
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              props.onDragStart();
            }}
            onDragEnd={props.onDragEnd}
            className="hidden cursor-grab rounded-lg p-1 text-muted hover:text-text sm:block"
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            <GripHorizontal className="size-5" />
          </span>
        )}
      </div>

      <SideEditor
        id={`term-${card.id}`}
        label="Term"
        placeholder="Enter term"
        value={front}
        onChange={setFront}
        onBlur={() => front !== card.front && save({ front })}
        image={card.front_image}
        kitId={kitId}
        onImage={(img) => save({ front_image: img })}
      />
      <div className="h-3" />
      <SideEditor
        id={`def-${card.id}`}
        label="Definition"
        placeholder="Enter definition"
        value={back}
        onChange={setBack}
        onBlur={() => back !== card.back && save({ back })}
        image={card.back_image}
        kitId={kitId}
        onImage={(img) => save({ back_image: img })}
      />

      <div className="relative mt-2 flex justify-end">
        <button type="button" onClick={() => setMenu((m) => !m)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Card options" aria-expanded={menu}>
          <MoreVertical className="size-4" />
        </button>
        {menu && (
          <div className="absolute right-0 bottom-9 z-10 w-44 overflow-hidden rounded-xl border border-border bg-surface shadow-card" onMouseLeave={() => setMenu(false)}>
            {props.canReorder && (
              <>
                <MenuItem icon={<ArrowUp className="size-4" />} onClick={() => { setMenu(false); props.onMove(-1); }}>Move up</MenuItem>
                <MenuItem icon={<ArrowDown className="size-4" />} onClick={() => { setMenu(false); props.onMove(1); }}>Move down</MenuItem>
              </>
            )}
            <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => { setMenu(false); props.onDelete(); }}>Delete card</MenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2", danger && "text-bad")}>
      {icon} {children}
    </button>
  );
}

function SideEditor(props: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  image: ImageRef | null;
  kitId: string;
  onImage: (img: ImageRef | null) => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File) {
    setUploading(true);
    try {
      const small = await compressImage(file, 1600);
      const form = new FormData();
      form.set("file", small);
      const img = await api<ImageRef>(`/api/kits/${props.kitId}/card-images`, { form });
      await props.onImage(img);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <textarea
          id={props.id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          rows={1}
          placeholder={props.placeholder}
          className="field-sizing-content min-h-12 w-full resize-none rounded-xl border border-transparent bg-bg px-4 py-3 font-semibold outline-none focus:border-primary"
          aria-label={props.label}
        />
        <div className="mt-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">{props.label}</div>
      </div>
      {props.image ? (
        <div className="relative w-24 shrink-0 sm:w-28">
          <DiagramImage image={props.image} maxHeight={84} alt={`${props.label} picture`} />
          <button type="button" onClick={() => props.onImage(null)} className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-bad text-white shadow-card" aria-label={`Remove ${props.label.toLowerCase()} picture`}>
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-[72px] w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted hover:border-primary hover:text-text sm:w-28"
          aria-label={`Add ${props.label.toLowerCase()} picture`}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
          Image
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="card-image-input" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
    </div>
  );
}
