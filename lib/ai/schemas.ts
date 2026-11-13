import { z } from "zod";

// Shapes we ask the model for. Kept flat (no unions) because flat JSON schemas
// are what free-tier models follow most reliably. We normalise them afterwards.

export const OutlineSchema = z.object({
  title: z.string().describe("Short kit title, max 60 chars"),
  emoji: z.string().describe("One emoji that fits the subject"),
  topics: z
    .array(
      z.object({
        name: z.string().describe("Topic name, 2-6 words"),
        description: z.string().describe("One sentence on what this topic covers"),
      }),
    )
    .min(1)
    .max(12),
});
export type Outline = z.infer<typeof OutlineSchema>;

export const FlashcardsSchema = z.object({
  cards: z.array(
    z.object({
      topic: z.string().describe("Exact topic name from the list"),
      front: z.string().describe("Term or question, short"),
      back: z.string().describe("Definition or answer, 1-3 sentences"),
    }),
  ),
});

export const RawQuestionSchema = z.object({
  topic: z.string().describe("Exact topic name from the list"),
  type: z.enum(["mcq", "multi_select", "true_false", "short_answer", "matching", "ordering"]),
  prompt: z.string().describe("The question. Use LaTeX in $...$ for math."),
  difficulty: z.number().int().min(1).max(3).describe("1 easy, 2 medium, 3 hard"),
  options: z
    .array(z.string())
    .describe("mcq: 4 options. multi_select: 4-6 options. true_false: ['True','False']. Otherwise empty."),
  correct_indices: z
    .array(z.number().int())
    .describe("Indices into options that are correct. mcq/true_false: exactly one."),
  answer_text: z.string().describe("short_answer: a concise model answer. Otherwise empty."),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .describe("matching: 3-5 correct pairs. Otherwise empty."),
  order: z
    .array(z.string())
    .describe("ordering: 3-6 items in the CORRECT order. Otherwise empty."),
  explanation: z
    .string()
    .describe("Why the answer is right and common mistakes, 1-4 sentences, grounded in the material."),
});
export type RawQuestion = z.infer<typeof RawQuestionSchema>;

export const QuestionsSchema = z.object({ questions: z.array(RawQuestionSchema) });

export const GradeSchema = z.object({
  score: z.number().min(0).max(1).describe("0 wrong, 0.5 partly right, 1 fully right"),
  feedback: z.string().describe("1-3 sentences to the student: what was right, what was missing"),
});
export type Grade = z.infer<typeof GradeSchema>;

export const BatchGradeSchema = z.object({
  grades: z.array(
    z.object({ id: z.string(), score: z.number().min(0).max(1), feedback: z.string() }),
  ),
});

export const HintSchema = z.object({
  hint: z.string().describe("A guiding question or nudge that does not reveal the answer"),
});

export const DiagramDetectSchema = z.object({
  title: z.string().describe("What the diagram shows, e.g. 'Anterior muscles of the arm'"),
  structures: z.array(
    z.object({
      label: z.string().describe("Real name of the structure, never just a number or letter"),
      marker: z
        .string()
        .describe("If the diagram points to this structure with a printed number or letter instead of a name (a quiz diagram), that number/letter, e.g. '2'. Otherwise empty."),
      box_2d: z
        .array(z.number())
        .describe("[ymin, xmin, ymax, xmax] of the structure itself, normalised 0-1000"),
      label_box_2d: z
        .array(z.number())
        .describe(
          "[ymin, xmin, ymax, xmax] of the printed label text for this structure, 0-1000. Empty array if the image has no printed label for it.",
        ),
    }),
  ),
});
export type DiagramDetect = z.infer<typeof DiagramDetectSchema>;
