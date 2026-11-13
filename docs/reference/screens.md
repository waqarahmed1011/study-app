# Reference spec (from the public Thea surface)

Sources studied: the public Smart Study trial kits (captured with craft-anything `web_site_capture` in clean-room mode, plus Playwright),
the marketing pages (features, how-it-works, tutorials), and the 18 App Store screenshots (phone + tablet), which show the signed-in app.
Only layout and behaviour are recorded here. No text, logos or images were copied into this repo.

## Global shell (signed in)
- Top bar: logo (left); icons on the right for home, upload/new kit, tutor chat, avatar with level badge + menu.
- Study kit pages have a **bottom tab bar** with 5 tabs: Materials, Study Guide, Smart Study, Flashcards, Test.
  On desktop the same tabs sit under the kit header.
- The app is dark by default (deep navy with violet accents). Light mode exists. Fonts are a geometric sans.

## Smart Study (the core screen)
- Header: a level progress bar ("Level N: x%") with 3 sparkle "stars" and a settings gear (session settings).
- Question text, then answer options:
  - desktop/tablet: 2×2 grid of cards, each with a numbered circle (1–4) on the left. Keys 1–4 select.
  - phone: a vertical list of full-width cards.
- After answering, the chosen card turns **green (correct)** or **red (wrong)** and the correct one is shown in green.
  An explanation panel appears under the question (bulleted text, math rendered with LaTeX). Wrong answers get the
  "why you were wrong" explanation in a framed box.
- Row under the answers: "Question History" pill (left), thumbs up / thumbs down question rating (right),
  then a centred "Next question" pill button.
- Question formats seen: multiple choice, matching (left items with coloured symbol markers, right column options,
  "Show answer" button), short answer, numeric/math answer lists.
- The adaptive behaviour (per the marketing copy): it targets weak topics, gets harder as mastery rises, and resurfaces
  items via spaced repetition. It's Socratic: no direct answers, it guides with questions.

## Test (practice test)
- Setup card: **Time** (test duration with −/+ stepper, est. time shown, "Enforce time limit" checkbox),
  **Questions** (count inputs for Multiple choice and Short answer, each with an est. minutes caption),
  **Difficulty** slider Easy → Hard, a "Create test" button.
- Below: a list titled with the kit name + "tests", with an empty state when none exist yet.

## Flashcards
- Sub-tabs: List / Deck / Games.
- Deck: a stats row with 4 counters (new/learning, reviewing, known, mastered) + a settings gear, then a big card with the
  term (tap to flip), and 3 round rating buttons (red / yellow / green) + a text-to-speech speaker button.
- Games: e.g. a "Stacker" game. Stack blocks by tapping the term that matches a shown definition in a 2×2 grid.

## Study Guide / Summaries
- Generated document from the kit materials, downloadable. Summaries are shorter digests.

## Materials
- The list of uploaded sources for the kit, plus add more.

## Gamification
- Profile / Achievements tabs. **Daily challenges** (e.g. answer N correct, get X consecutive right in Smart Study,
  score 90%+ on a practice test) with progress bars and a refresh countdown. **Level rewards** track (crown + level number).

## Public trial kit page (signed out)
- Centered header (icon + mode name), subtitle "Personalized practice questions for <kit>", the question with 4 numbered
  pastel option cards in a 2×2 grid, a ">" next arrow, a row of 3 outlined mode cards (Study Guide, Flashcards, Test), related kits.
- Answering opens a sign-up modal (Google / Apple / email). Feedback states aren't visible signed out.
- Tokens captured: font DM Sans; text #120537; accent #0075ff; option backgrounds are pastel tints; radius 10px; content max width 1000px.

## Onboarding flow
- Sign up → upload material → land directly in Smart Study ("under 10 seconds").

## study.ai decisions
- Same information architecture (top bar + 5 kit tabs + Smart Study first), our own palette, name, icons and copy.
- Additions not in Thea: notes-photo OCR as a first-class input, and **Diagrams** (image occlusion, tap-to-identify,
  AI fact questions) as a 6th kit tab.
- Deferred to later versions: podcasts, YouTube/audio/video, educator features, avatars/levels shop.
