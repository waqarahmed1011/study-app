import { getRepo } from "@/lib/data";
import { TutorChat } from "@/components/kit/tutor-chat";

export const metadata = { title: "Tutor" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const messages = await repo.list("chat_messages", { kit_id: id }, { orderBy: "created_at" });
  return <TutorChat kitId={id} initial={messages.map((m) => ({ role: m.role, content: m.content }))} />;
}
