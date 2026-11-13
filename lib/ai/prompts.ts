// All prompt text in one place. Material is wrapped in <material> tags so the
// model (and the mock) can find it.

export const SYSTEM_TUTOR = `You are a study coach inside a study app. You build study material ONLY from the student's own uploaded material.
Rules:
- Stay faithful to the material. Do not add facts that contradict it. You may add widely accepted background only when it helps understanding.
- Write in the same language as the material.
- Use Markdown. Use LaTeX inside $...$ (inline) or $$...$$ (block) for math and chemistry.
- Be clear and concise, like a great teaching assistant.`;

export const MAX_MATERIAL_CHARS = 300_000;

export function wrapMaterial(material: string) {
  const m = material.length > MAX_MATERIAL_CHARS ? material.slice(0, MAX_MATERIAL_CHARS) + "\n\n[material truncated]" : material;
  return `<material>\n${m}\n</material>`;
}

export const extractPrompt = (kind: string) =>
  kind === "diagram"
    ? `This image is a study diagram (for example an anatomy figure). Transcribe it into Markdown study notes:
- a heading saying what the diagram shows,
- a bullet list of every labelled structure and, if visible, what the label points to,
- any captions or other text on the image.
Do not invent labels that are not visible.`
    : kind === "image"
      ? `This is a photo or screenshot of study notes (possibly handwritten, possibly slides or a textbook page).
Transcribe ALL of the content into clean Markdown: keep headings, lists, tables and equations (use LaTeX for math).
Fix obvious OCR noise but do not change the meaning. If there are figures, describe each one in a short italic line.
If a word is unreadable write [illegible]. Output only the Markdown.`
      : `Convert this document into clean Markdown study notes, preserving ALL of the content in order: headings, lists, tables (as Markdown tables), equations (LaTeX), and key figures (one short italic description each). Drop page numbers, headers/footers and references. Output only the Markdown.`;

export const outlinePrompt = (material: string, existing: string[], titleHint: string) =>
  `${wrapMaterial(material)}
<title>${titleHint}</title>
Split this material into study topics (4-10 for a normal-sized set of notes, fewer for short notes).
${existing.length ? `These topics already exist in the kit; reuse their exact names where they fit and only add new topics for material they don't cover: ${JSON.stringify(existing)}` : ""}
Return a short title for the whole kit${titleHint ? ` (the student called it "${titleHint}"; keep that unless it's empty)` : ""}, one emoji, and the topics.`;

export const flashcardsPrompt = (material: string, topics: string[]) =>
  `${wrapMaterial(material)}
<topics>${JSON.stringify(topics)}</topics>
Make flashcards covering every key term, definition, fact, formula and process in the material.
Aim for roughly 1 card per 60-120 words of material (minimum 8, maximum 60).
Front: a term or a short cue. Back: the definition/answer in 1-3 sentences. Each card's topic must be one of the topic names exactly.`;

export const questionsPrompt = (material: string, topics: string[], count: number, focus?: string) =>
  `${wrapMaterial(material)}
<topics>${JSON.stringify(topics)}</topics>
<count>${count}</count>
Write ${count} practice questions that test understanding of the material, spread across ALL topics${focus ? `, with extra focus on: ${focus}` : ""}.
Mix of types (roughly): 40% mcq, 10% true_false, 15% multi_select, 15% short_answer, 10% matching, 10% ordering. Only use ordering when the material has a real sequence (a process, timeline, steps). Only use matching when there are 3+ related term/definition pairs.
Mix difficulties: about a third each of 1 (recall), 2 (understanding), 3 (application/analysis).
MCQ distractors must be plausible and similar in length to the right answer. Never use "all of the above".
Each explanation should say why the right answer is right AND why a tempting wrong answer is wrong.
Fill the fields that don't apply to a type with empty arrays/strings.`;

export const guidePrompt = (material: string, topics: string[]) =>
  `${wrapMaterial(material)}
<topics>${JSON.stringify(topics)}</topics>
Write a comprehensive study guide for this material in Markdown.
Structure: a one-paragraph overview; then one "##" section per topic with the key ideas as bullets, **bold** key terms, definitions, formulas, and short worked examples where relevant; a "## Key terms" glossary table; and a "## Check yourself" list of 5-8 self-test questions (no answers).`;

export const summaryPrompt = (material: string, topics: string[]) =>
  `${wrapMaterial(material)}
<topics>${JSON.stringify(topics)}</topics>
Write a concise summary of this material in Markdown: a 2-3 sentence TL;DR, then the core concepts as a short bullet list per topic. At most about 400 words.`;

export const gradePrompt = (question: string, model: string, answer: string) =>
  `Grade a student's short answer.
<question>${question}</question>
<model_answer>${model}</model_answer>
<student_answer>${answer}</student_answer>
Score 1 if it captures the essential idea (wording can differ), 0.5 if partly right or missing a key part, 0 if wrong or empty.
Feedback speaks to the student directly, is encouraging but honest, and says what's missing without lecturing.`;

export const batchGradePrompt = (items: { id: string; question: string; model: string; answer: string }[]) =>
  `Grade each short answer in this practice test.
<items>${JSON.stringify(items)}</items>
For each id: score 1 if the answer captures the essential idea of the model answer, 0.5 if partly right, 0 if wrong/empty; plus one sentence of feedback.`;

export const hintPrompt = (question: string, answer: string) =>
  `A student is stuck on this question and asked for a hint.
<question>${question}</question>
<answer_for_you_only>${answer}</answer_for_you_only>
Give a Socratic hint: a guiding question or a nudge toward the right line of thinking. Do NOT reveal or paraphrase the answer, and do not eliminate options. One or two sentences.`;

export const tutorSystem = (material: string, sources: string[]) =>
  `${SYSTEM_TUTOR}
You are now chatting with the student as their tutor for this study kit.
- Answer using the material below. When you use it, cite the source name in brackets like [${sources[0] ?? "notes"}].
- If the answer isn't in the material, say so, then give a brief general explanation clearly marked as "Not from your notes".
- Prefer teaching over telling: for "what's the answer" style questions, guide with a question first unless they ask you to just explain.
- Keep replies short (under ~200 words) unless asked for more.
Sources: ${sources.join(", ")}
${wrapMaterial(material)}`;

export const diagramDetectPrompt = `Detect every labelled structure in this study diagram.
For each structure return:
- label: its name exactly as printed (or the standard name if the image is unlabelled),
- box_2d: a tight box around the structure itself,
- label_box_2d: a tight box around its printed label text (empty array if there is none).
Boxes are [ymin, xmin, ymax, xmax] normalised to 0-1000. Return at most 25 structures. Prefer precision over quantity.`;

export const diagramFactsPrompt = (title: string, labels: string[], notes: string) =>
  `${wrapMaterial(notes)}
<topics>${JSON.stringify([title])}</topics>
<labels>${JSON.stringify(labels)}</labels>
The student is learning the diagram "${title}" with these labelled structures. Write 1-2 questions per structure (max 20) about what a student would need to know: e.g. for muscles origin, insertion, action and innervation; for organs function and location.
Use mcq and short_answer types. Use the topic name exactly as given. Fill unused fields with empty arrays/strings.
Be accurate. If a fact is commonly disputed or varies between textbooks, say so in the explanation.`;
