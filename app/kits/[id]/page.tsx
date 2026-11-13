import { redirect } from "next/navigation";

export default async function KitIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/kits/${id}/smart`);
}
