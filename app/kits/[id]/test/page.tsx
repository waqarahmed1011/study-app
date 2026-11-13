import { getRepo } from "@/lib/data";
import { TestSetup } from "@/components/test/test-setup";
import type { QuestionType } from "@/lib/types";

export const metadata = { title: "Practice test" };

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [kit, tests, topics, questions] = await Promise.all([
    repo.get("kits", id),
    repo.list("tests", { kit_id: id }, { orderBy: "created_at", ascending: false }),
    repo.list("topics", { kit_id: id }, { orderBy: "created_at" }),
    repo.list("questions", { kit_id: id }),
  ]);
  const bank: Partial<Record<QuestionType, number>> = {};
  for (const q of questions) if (q.verified && q.rating >= 0) bank[q.type] = (bank[q.type] ?? 0) + 1;
  return (
    <TestSetup
      kitId={id}
      kitTitle={kit?.title ?? ""}
      bank={bank}
      topics={topics.map((t) => ({ id: t.id, name: t.name }))}
      tests={tests.map((t) => ({ id: t.id, title: t.title, status: t.status, score: t.score, count: t.question_ids.length, created_at: t.created_at }))}
    />
  );
}
