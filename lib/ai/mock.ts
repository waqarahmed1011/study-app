import "server-only";
import type { AIProvider } from "./provider";
import type { RawQuestion } from "./schemas";

// Deterministic stand-in for the LLM. Used by tests, and as a demo when no
// GEMINI_API_KEY is set. It builds content from the material's own sentences,
// so the app is fully clickable without any API.

function between(s: string, tag: string) {
  const m = s.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : "";
}

function sentences(material: string) {
  return material
    .replace(/^## Source:.*$/gm, "")
    .replace(/^#+ .*$/gm, "")
    .replace(/[#*_>`]/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4);
}

function topicNames(prompt: string): string[] {
  try {
    return JSON.parse(between(prompt, "topics")) as string[];
  } catch {
    return ["Key ideas"];
  }
}

function keyTerm(sentence: string) {
  // first capitalised word or first noun-ish word
  const words = sentence.replace(/[^\w\s-]/g, "").split(/\s+/).filter(Boolean);
  return words.find((w, i) => i > 0 && /^[A-Z]/.test(w)) ?? words.find((w) => w.length > 5) ?? words[0];
}

function mockQuestions(topics: string[], material: string, count: number): RawQuestion[] {
  const sents = sentences(material);
  const pick = (i: number) => sents[i % Math.max(sents.length, 1)] ?? "Practice makes recall stronger.";
  const types: RawQuestion["type"][] = ["mcq", "true_false", "short_answer", "multi_select", "matching", "ordering"];
  const out: RawQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    const type = types[i % types.length];
    const s = pick(i);
    const term = keyTerm(s);
    const base = {
      topic,
      type,
      difficulty: ((i % 3) + 1) as 1 | 2 | 3,
      options: [] as string[],
      correct_indices: [] as number[],
      answer_text: "",
      pairs: [] as { left: string; right: string }[],
      order: [] as string[],
      explanation: `From your material: "${s}"`,
    };
    if (type === "mcq") {
      out.push({ ...base, prompt: `Which term best completes this idea: "${s.replace(term, "____")}"`, options: [term, pick(i + 1).split(" ")[0], pick(i + 2).split(" ")[1] ?? "None", "Not stated"], correct_indices: [0] });
    } else if (type === "true_false") {
      out.push({ ...base, prompt: `True or false: ${s}`, options: ["True", "False"], correct_indices: [0] });
    } else if (type === "short_answer") {
      out.push({ ...base, prompt: `In your own words, explain: ${s.split(" ").slice(0, 8).join(" ")}…`, answer_text: s });
    } else if (type === "multi_select") {
      out.push({ ...base, prompt: `Select every statement that appears in your notes about ${topic}.`, options: [pick(i), pick(i + 3), "The material says the opposite of this.", "This topic is never mentioned."], correct_indices: [0, 1] });
    } else if (type === "matching") {
      const pairs = [0, 1, 2].map((k) => ({ left: keyTerm(pick(i + k)) + (k ? ` ${k + 1}` : ""), right: pick(i + k).slice(0, 60) }));
      out.push({ ...base, prompt: `Match each term to its description (${topic}).`, pairs });
    } else {
      out.push({ ...base, prompt: `Put these points from ${topic} in the order they appear in your notes.`, order: [pick(i), pick(i + 1), pick(i + 2)].map((x) => x.slice(0, 70)) });
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockProvider(): AIProvider {
  return {
    name: "demo (no API key)",

    async json({ task, prompt }) {
      await sleep(150);
      const material = between(prompt, "material");
      const topics = topicNames(prompt);
      switch (task) {
        case "outline": {
          const headings = [...material.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim()).filter((h) => !h.startsWith("Source:"));
          const names = (headings.length >= 2 ? headings : ["Core concepts", "Key processes", "Applications"]).slice(0, 8);
          const title = between(prompt, "title") || headings[0] || "My study kit";
          return { title: title.slice(0, 60), emoji: "📘", topics: names.map((n) => ({ name: n, description: `Everything in your notes about ${n.toLowerCase()}.` })) } as never;
        }
        case "flashcards": {
          const sents = sentences(material);
          const cards = sents.slice(0, 24).map((s, i) => ({ topic: topics[i % topics.length], front: keyTerm(s), back: s }));
          return { cards: cards.length ? cards : [{ topic: topics[0], front: "Active recall", back: "Retrieving information from memory to strengthen it." }] } as never;
        }
        case "questions":
        case "more_questions": {
          const n = Number(between(prompt, "count")) || 18;
          return { questions: mockQuestions(topics, material, n) } as never;
        }
        case "grade": {
          const model = between(prompt, "model_answer").toLowerCase();
          const ans = between(prompt, "student_answer").toLowerCase();
          const words = new Set(model.split(/\W+/).filter((w) => w.length > 3));
          const hit = ans.split(/\W+/).filter((w) => words.has(w)).length;
          const score = words.size ? Math.min(1, hit / Math.max(2, words.size * 0.4)) : 0;
          const s = score >= 0.75 ? 1 : score >= 0.35 ? 0.5 : 0;
          return { score: s, feedback: s === 1 ? "That covers the key idea." : s ? "Partly right. Look again at the model answer for what's missing." : "Not quite. Compare with the model answer." } as never;
        }
        case "grade_batch": {
          const items = JSON.parse(between(prompt, "items") || "[]") as { id: string; model: string; answer: string }[];
          return { grades: items.map((it) => { const w = new Set(it.model.toLowerCase().split(/\W+/).filter((x) => x.length > 3)); const hit = it.answer.toLowerCase().split(/\W+/).filter((x) => w.has(x)).length; const score = hit >= Math.max(2, w.size * 0.3) ? 1 : hit > 0 ? 0.5 : 0; return { id: it.id, score, feedback: score === 1 ? "Good." : "Compare with the model answer." }; }) } as never;
        }
        case "hint":
          return { hint: "What does the key term in the question remind you of from your notes? Try to recall the sentence it came from." } as never;
        case "diagram_detect": {
          const n = 4;
          return {
            title: "Diagram",
            structures: Array.from({ length: n }, (_, i) => {
              const y = 120 + i * 200;
              return { label: `Structure ${i + 1}`, box_2d: [y, 250, y + 150, 600], label_box_2d: [y + 40, 700, y + 100, 950] };
            }),
          } as never;
        }
        case "diagram_facts": {
          const labels = JSON.parse(between(prompt, "labels") || "[]") as string[];
          return { questions: labels.slice(0, 6).map((l) => ({ topic: topics[0], type: "short_answer", prompt: `What is the main function of the ${l}?`, difficulty: 2, options: [], correct_indices: [], answer_text: `The ${l} (demo answer — check against your notes).`, pairs: [], order: [], explanation: "Demo content. Verify against your notes." })) } as never;
        }
        default:
          throw new Error(`mock: unknown task ${task}`);
      }
    },

    async text({ task, prompt, files }) {
      await sleep(150);
      const material = between(prompt, "material");
      if (task === "extract") {
        const f = files?.[0];
        return `# Notes from upload\n\nDemo mode transcribed a ${f?.mimeType ?? "file"} of ${f?.data.length ?? 0} bytes. Add a GEMINI_API_KEY to read real content.\n\n## Cell structure\nThe mitochondria produce energy for the cell through respiration. The nucleus stores genetic information in DNA.\n\n## Transport\nOsmosis is the movement of water across a partially permeable membrane. Active transport moves substances against a concentration gradient using energy.`;
      }
      const sents = sentences(material);
      if (task === "guide") {
        return `# Study guide\n\n${topicNames(prompt).map((t, i) => `## ${t}\n\n${sents.slice(i * 3, i * 3 + 3).map((s) => `- ${s}`).join("\n") || "- Review your notes on this topic."}`).join("\n\n")}\n\n## Check yourself\n\n1. Can you explain each heading above without looking?\n2. Which topic felt least familiar?`;
      }
      if (task === "summary") {
        return `# Summary\n\n${sents.slice(0, 6).join(" ")}`;
      }
      return sents.slice(0, 3).join(" ");
    },

    async *stream({ messages }) {
      const last = messages[messages.length - 1]?.content ?? "";
      const reply = `Good question. In demo mode I can't read your material properly, but here's how to approach "${last.slice(0, 80)}": find where your notes define the key term, then try to explain it in one sentence without looking. What do you think the first step is?`;
      for (const word of reply.split(/(?<= )/)) {
        await sleep(15);
        yield word;
      }
    },
  };
}
