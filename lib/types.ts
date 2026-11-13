// Shared domain types. Column names match the SQL schema in supabase/migrations.

export type ISODate = string;

export type GenStep =
  | "extract"
  | "outline"
  | "flashcards"
  | "questions"
  | "guide"
  | "summary";

export const GEN_STEPS: GenStep[] = [
  "extract",
  "outline",
  "flashcards",
  "questions",
  "guide",
  "summary",
];

export type StepStatus = "pending" | "running" | "done" | "error";

export interface Kit {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  status: "draft" | "generating" | "ready" | "error";
  gen_steps: Partial<Record<GenStep, StepStatus>>;
  gen_error: string | null;
  created_at: ISODate;
  updated_at: ISODate;
}

export type SourceKind = "pdf" | "image" | "text" | "diagram";

export interface Source {
  id: string;
  user_id: string;
  kit_id: string;
  kind: SourceKind;
  name: string;
  storage_path: string | null;
  mime: string | null;
  extracted_md: string | null;
  status: "pending" | "done" | "error";
  error: string | null;
  generated: boolean; // true once flashcards/questions were made from it
  created_at: ISODate;
}

export interface Topic {
  id: string;
  user_id: string;
  kit_id: string;
  name: string;
  description: string;
  mastery: number; // 0..1
  attempts: number;
  correct: number;
  created_at: ISODate;
}

export interface FsrsState {
  due: ISODate;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum
  last_review?: ISODate;
}

/**
 * A picture on a card or question. Either an uploaded image, or a diagram with
 * one structure highlighted and every printed label covered.
 */
export interface ImageRef {
  path: string; // storage path, served at /api/files/<path>
  highlight?: Box | null; // structure to outline
  covers?: Box[]; // printed labels/numbers to hide
  zoom?: boolean; // crop around the highlight instead of showing the whole image
}

/** How a diagram-generated card or question was made, so re-syncing updates it in place. */
export type DiagramGenKind = "img_to_name" | "name_to_img" | "fact" | "identify" | "which_image";

export interface Flashcard {
  id: string;
  user_id: string;
  kit_id: string;
  topic_id: string | null;
  front: string;
  back: string;
  front_image: ImageRef | null;
  back_image: ImageRef | null;
  position: number;
  diagram_id: string | null;
  region_id: string | null;
  gen_kind: DiagramGenKind | null;
  fsrs: FsrsState;
  created_at: ISODate;
}

export type QuestionType =
  | "mcq"
  | "multi_select"
  | "true_false"
  | "short_answer"
  | "matching"
  | "ordering";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  multi_select: "Select all that apply",
  true_false: "True / false",
  short_answer: "Short answer",
  matching: "Matching",
  ordering: "Ordering",
};

// payload = what the student sees, answer = what grading needs.
export type QuestionPayload =
  | { options: string[]; optionImages?: ImageRef[] } // mcq, multi_select, true_false (optionImages: pick-the-picture)
  | { left: string[]; right: string[] } // matching (right is shuffled)
  | { items: string[] } // ordering (shuffled)
  | Record<string, never>; // short_answer

export type QuestionAnswer =
  | { correct: number[] } // indices into options
  | { pairs: number[] } // pairs[i] = index in right for left[i]
  | { order: number[] } // order[k] = index in items of the k-th item
  | { text: string }; // model answer for short_answer

export interface Question {
  id: string;
  user_id: string;
  kit_id: string;
  topic_id: string | null;
  type: QuestionType;
  prompt: string;
  payload: QuestionPayload;
  answer: QuestionAnswer;
  explanation: string;
  difficulty: 1 | 2 | 3;
  origin: "kit" | "diagram";
  diagram_id: string | null;
  image: ImageRef | null; // shown above the prompt
  region_id: string | null;
  gen_kind: DiagramGenKind | null;
  verified: boolean;
  rating: number; // thumbs: -1, 0, 1
  created_at: ISODate;
}

export type StudyMode = "smart" | "test" | "flashcards" | "diagram";

export interface Attempt {
  id: string;
  user_id: string;
  kit_id: string;
  question_id: string | null;
  topic_id: string | null;
  session_id: string | null;
  mode: StudyMode;
  correct: boolean;
  score: number; // 0..1, partial credit
  response: unknown;
  feedback: string | null;
  created_at: ISODate;
}

export interface TestConfig {
  minutes: number;
  enforceTime: boolean;
  counts: Partial<Record<QuestionType, number>>;
  difficulty: 1 | 2 | 3;
  topicIds: string[]; // empty = all
}

export interface TestResultItem {
  question_id: string;
  correct: boolean;
  score: number;
  feedback: string | null;
}

export interface PracticeTest {
  id: string;
  user_id: string;
  kit_id: string;
  title: string;
  config: TestConfig;
  question_ids: string[];
  status: "ready" | "submitted";
  score: number | null;
  results: TestResultItem[] | null;
  responses: Record<string, unknown> | null;
  started_at: ISODate | null;
  submitted_at: ISODate | null;
  created_at: ISODate;
}

export interface KitDocument {
  id: string;
  user_id: string;
  kit_id: string;
  kind: "guide" | "summary";
  content_md: string;
  created_at: ISODate;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  kit_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: ISODate;
}

export interface Box {
  x: number; // all 0..1, relative to image size
  y: number;
  w: number;
  h: number;
}

export interface DiagramRegion {
  id: string;
  label: string;
  marker?: string; // number/letter printed on a quiz diagram ("2"), if any
  box: Box; // the structure itself (tap target)
  labelBox: Box | null; // where the printed label sits (covered in hide mode)
  confirmed: boolean;
  seen: number;
  correct: number;
}

export interface Diagram {
  id: string;
  user_id: string;
  kit_id: string;
  source_id: string;
  topic_id: string | null;
  title: string;
  regions: DiagramRegion[];
  status: "draft" | "confirmed";
  created_at: ISODate;
}

export interface TableMap {
  kits: Kit;
  sources: Source;
  topics: Topic;
  flashcards: Flashcard;
  questions: Question;
  attempts: Attempt;
  tests: PracticeTest;
  documents: KitDocument;
  chat_messages: ChatMessage;
  diagrams: Diagram;
}

export type TableName = keyof TableMap;
