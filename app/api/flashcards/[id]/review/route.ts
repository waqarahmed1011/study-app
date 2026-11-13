import { HttpError, must, route } from "@/lib/api";
import { review, RATINGS, type RatingName } from "@/lib/study/fsrs";
import { applyToTopic } from "@/lib/study/service";
import type { IdCtx } from "@/lib/route-types";

const SCORE: Record<RatingName, number> = { again: 0, hard: 0.5, good: 1, easy: 1 };

export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const card = await must(repo.get("flashcards", id));
  const { rating } = (await req.json()) as { rating: RatingName };
  if (!(rating in RATINGS)) throw new HttpError(400, "Bad rating");
  const fsrs = review(card.fsrs, rating);
  const updated = await repo.update("flashcards", id, { fsrs });
  await repo.insert("attempts", {
    kit_id: card.kit_id, question_id: null, topic_id: card.topic_id, session_id: null, mode: "flashcards",
    correct: SCORE[rating] >= 1, score: SCORE[rating], response: rating, feedback: null,
  });
  // flashcards nudge mastery gently (treated as easy recall)
  await applyToTopic(repo, card.topic_id, 1, SCORE[rating]);
  return updated;
});
