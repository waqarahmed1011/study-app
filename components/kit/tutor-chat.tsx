"use client";
import { Loader2, MessageCircle, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Markdown } from "@/components/markdown";
import { Button, cx } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["Explain the hardest idea in my notes simply", "Quiz me on the key terms", "What should I focus on before the exam?", "Give me a memory trick for this material"];

export function TutorChat({ kitId, initial }: { kitId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(`/api/kits/${kitId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: t }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "The tutor is unavailable.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `_${(err as Error).message}_` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm("Clear this conversation?")) return;
    await api(`/api/kits/${kitId}/chat`, { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">Your tutor answers from this kit&apos;s material and says when something isn&apos;t in your notes.</p>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear conversation">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="min-h-[40vh] space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <MessageCircle className="size-10 text-primary" />
            <p className="font-semibold">Ask anything about your material</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-text">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[88%] rounded-2xl px-4 py-2.5", m.role === "user" ? "bg-primary text-primary-ink" : "border border-border bg-surface")}>
              {m.role === "assistant" ? (
                m.content ? <Markdown className="text-sm">{m.content}</Markdown> : <Loader2 className="size-4 animate-spin text-muted" />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-20 flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card sm:bottom-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask your tutor…"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 outline-none"
          aria-label="Message"
        />
        <Button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
