import { notFound } from "next/navigation";
import { getRepo } from "@/lib/data";
import { publicQuestion } from "@/lib/api";
import { describeAnswer } from "@/lib/study/questions";
import { TakeTest } from "@/components/test/take-test";
import type { Question } from "@/lib/types";

export default async function TestRunPage({ params }: { params: Promise<{ id: string; testId: string }> }) {
  const { id, testId } = await params;
  const repo = await getRepo();
  const test = await repo.get("tests", testId);
  if (!test || test.kit_id !== id) notFound();
  const questions = (await Promise.all(test.question_ids.map((q) => repo.get("questions", q)))).filter(Boolean) as Question[];
  const topics = await repo.list("topics", { kit_id: id });
  const submitted = test.status === "submitted";
  return (
    <TakeTest
      kitId={id}
      test={{ id: test.id, title: test.title, config: test.config, started_at: test.started_at, status: test.status, score: test.score, results: test.results, responses: test.responses }}
      questions={questions.map((q) => ({
        ...publicQuestion(q),
        // the answer key only goes to the browser after submission
        review: submitted ? { answer: q.answer, explanation: q.explanation, correctAnswer: describeAnswer(q) } : null,
      }))}
      topics={topics.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
