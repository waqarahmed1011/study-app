# study.ai

Turn your notes, PDFs, photos of handwritten pages and labelled diagrams into an adaptive study kit:
Smart Study, spaced-repetition flashcards, practice tests, a study guide and summary, a tutor that
answers from your own material, and diagram label quizzes (anatomy and anything else with parts to name).

Works in any browser on phone or laptop, and can be installed to your home screen (PWA).

## Features

| Area | What it does |
|---|---|
| **Upload** | PDF, images (photos of notes are OCR'd, handwriting included), pasted text. Camera button on phones. |
| **Smart Study** | Adaptive questions in 6 formats (multiple choice, select-all, true/false, short answer graded by AI, matching, ordering). Targets weak topics, adjusts difficulty, resurfaces mistakes, spaces reviews, tops up the question bank when you run low. Hints are Socratic: no answers given away. Thumbs-down removes a bad question. |
| **Flashcards** | FSRS spaced repetition (Again/Hard/Good/Easy with next-interval preview), swipe gestures, read-aloud, searchable list, two games (Match, Speed round). |
| **Practice tests** | Duration, enforced timer, per-type counts, difficulty, topic filter. Exam-style: no feedback until you submit. Score by topic and full review. |
| **Study guide / Summary** | Generated from your material; download as Markdown or print to PDF. |
| **Tutor** | Streaming chat grounded in the kit's material, cites sources, says when something isn't in your notes. |
| **Diagrams** | AI finds the labelled structures; you check and fix them in an editor (move/resize boxes, rename, add). Then: label quiz (labels hidden), tap-to-find, and AI fact questions (origin/insertion/action/innervation etc.) that stay out of studying until you verify each one. |
| **Progress** | Topic mastery, 14-day activity, accuracy, streak, question history. |

## Run it locally (no accounts needed)

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. With no keys set it runs on a local file store (`.data/`) with demo AI,
so every screen works. Add a Gemini key to `.env.local` for real AI:

```bash
cp .env.example .env.local
```

## Deploy (Supabase + Vercel, both free)

1. **Supabase**: create a project. In the SQL editor, paste and run `supabase/migrations/0001_init.sql`.
   It creates the tables, row-level security (each user only sees their own data) and a private
   `sources` storage bucket.
   - Authentication → Providers → Email: on. For personal use, sign up once, then turn off
     "Allow new users to sign up" so nobody else can use your AI quota.
   - Authentication → URL Configuration: set Site URL to your Vercel URL.
2. **Gemini**: get a free key at https://aistudio.google.com/apikey.
3. **Vercel**: import this repo, add the env vars from `.env.example`
   (`GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), deploy.
   Redeploy after changing env vars.
4. On your phone, open the site and use "Add to Home Screen".

## Costs and limits

- Gemini's free tier costs $0 but is rate-limited, and **Google may use free-tier inputs to improve
  its products**. Don't upload anything you'd mind them seeing. Big PDFs can take a few minutes to
  turn into a kit because the app backs off and retries when it hits the limit.
- Files up to 20 MB. In Supabase mode the browser uploads straight to storage (Vercel caps request
  bodies at 4.5 MB). Photos are shrunk in the browser before upload.
- AI-made content can be wrong. Diagram fact questions are unverified until you check them.

## Development

```bash
npm test
```

```bash
npm run e2e
```

```bash
node scripts/check-migration.mjs
```

- Unit tests (Vitest): grading, mastery, scheduler, FSRS, diagram geometry.
- E2E (Playwright): both main flows at phone and desktop sizes, on the local store with mock AI.
- `check-migration.mjs` applies the SQL to an in-memory Postgres and checks RLS isolation.

Layout: `lib/data` (Supabase + local repos behind one interface), `lib/ai` (Gemini/mock providers,
prompts, generation pipeline), `lib/study` (grading, mastery, scheduler, FSRS), `app/` (pages and API
routes), `components/`. `docs/reference/screens.md` is the UI reference spec.
