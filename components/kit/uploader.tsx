"use client";
import { Camera, CheckCircle2, FileText, ImageIcon, Loader2, Shapes, Upload, XCircle } from "lucide-react";
import { nanoid } from "nanoid";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button, cx } from "@/components/ui";

const USE_SUPABASE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const ACCEPT = "application/pdf,image/*,.txt,.md,text/plain,text/markdown";

interface Item {
  key: string;
  name: string;
  kind: "pdf" | "image" | "diagram" | "text";
  state: "uploading" | "done" | "error";
  error?: string;
}

/** Shrink big photos before upload: faster on mobile data and well within AI limits. */
async function compressImage(file: File, maxSide: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC on browsers that can't decode it; upload as-is
  }
}

async function uploadOne(kitId: string, file: File, diagram: boolean) {
  if (USE_SUPABASE) {
    const sb = createSupabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5);
    const path = `${kitId}/${nanoid()}.${ext}`;
    const { error } = await sb.storage.from("sources").upload(`${data.user.id}/${path}`, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return api(`/api/kits/${kitId}/sources`, { body: { name: file.name, diagram, uploaded: { path, mime: file.type, size: file.size } } });
  }
  const form = new FormData();
  form.set("file", file);
  if (diagram) form.set("diagram", "1");
  return api(`/api/kits/${kitId}/sources`, { form });
}

export function Uploader({
  getKitId,
  onChange,
  onUploaded,
  diagramOnly,
}: {
  getKitId: () => Promise<string>;
  onChange?: (count: number) => void;
  onUploaded?: (source: { id: string }) => void;
  diagramOnly?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [diagramMode, setDiagramMode] = useState(Boolean(diagramOnly));
  const [text, setText] = useState("");
  const [textName, setTextName] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const setItem = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length) return;
    const kitId = await getKitId();
    for (const original of files) {
      const isImage = original.type.startsWith("image/");
      const diagram = isImage && diagramMode;
      const key = nanoid();
      const kind: Item["kind"] = original.type === "application/pdf" ? "pdf" : diagram ? "diagram" : isImage ? "image" : "text";
      setItems((xs) => [...xs, { key, name: original.name, kind, state: "uploading" }]);
      try {
        // diagrams keep more resolution so small labels stay readable
        const file = await compressImage(original, diagram ? 3000 : 2200);
        const src = (await uploadOne(kitId, file, diagram)) as { id: string };
        setItem(key, { state: "done" });
        onUploaded?.(src);
      } catch (err) {
        setItem(key, { state: "error", error: (err as Error).message });
      }
    }
    onChange?.(files.length);
  }

  async function addText() {
    if (!text.trim()) return;
    const kitId = await getKitId();
    const key = nanoid();
    const name = textName.trim() || "Pasted notes";
    setItems((xs) => [...xs, { key, name, kind: "text", state: "uploading" }]);
    try {
      await api(`/api/kits/${kitId}/sources`, { body: { name, text } });
      setItem(key, { state: "done" });
      setText("");
      setTextName("");
      onChange?.(1);
    } catch (err) {
      setItem(key, { state: "error", error: (err as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      {!diagramOnly && <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Upload type">
        <button
          type="button"
          role="radio"
          aria-checked={!diagramMode}
          onClick={() => setDiagramMode(false)}
          className={cx("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold", !diagramMode ? "border-primary bg-primary/15 text-primary" : "border-border text-muted")}
        >
          <FileText className="size-4" /> Notes, slides & PDFs
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={diagramMode}
          onClick={() => setDiagramMode(true)}
          className={cx("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold", diagramMode ? "border-primary bg-primary/15 text-primary" : "border-border text-muted")}
        >
          <Shapes className="size-4" /> Diagram to label (anatomy etc.)
        </button>
      </div>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cx("rounded-2xl border-2 border-dashed p-6 text-center transition", drag ? "border-primary bg-primary/10" : "border-border bg-surface")}
      >
        <Upload className="mx-auto size-8 text-muted" />
        <p className="mt-2 font-semibold">{diagramMode ? "Drop a diagram image" : "Drop PDFs, photos of notes or text files"}</p>
        <p className="text-sm text-muted">
          {diagramMode
            ? "Labelled or unlabelled figures. You'll check the labels before studying."
            : "Handwritten notes work too. Up to 20 MB per file."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Choose files
          </Button>
          <Button variant="secondary" onClick={() => camRef.current?.click()}>
            <Camera className="size-4" /> Take photo
          </Button>
        </div>
        <input ref={fileRef} type="file" multiple accept={diagramMode ? "image/*" : ACCEPT} className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} data-testid="file-input" />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>

      {!diagramMode && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-sm font-semibold" htmlFor="paste">Or paste text</label>
          <input
            value={textName}
            onChange={(e) => setTextName(e.target.value)}
            placeholder="Name (optional), e.g. Lecture 4 notes"
            className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />
          <textarea
            id="paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste notes, a transcript, a textbook section…"
            className="mt-2 w-full resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button variant="secondary" onClick={addText} disabled={!text.trim()}>
              Add text
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              {it.kind === "diagram" ? <Shapes className="size-4 text-accent" /> : it.kind === "image" ? <ImageIcon className="size-4 text-muted" /> : <FileText className="size-4 text-muted" />}
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              {it.state === "uploading" && <Loader2 className="size-4 animate-spin text-muted" />}
              {it.state === "done" && <CheckCircle2 className="size-4 text-good" />}
              {it.state === "error" && (
                <span className="flex items-center gap-1 text-bad" title={it.error}>
                  <XCircle className="size-4" /> <span className="max-w-48 truncate">{it.error}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
