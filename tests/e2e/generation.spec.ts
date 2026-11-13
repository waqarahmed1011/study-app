import { expect, test } from "@playwright/test";

// A generation step can be retried (after a hiccup or a timeout that actually
// finished). Re-running must not create duplicate cards or questions.
test("re-running generation steps does not duplicate cards or questions", async ({ request }) => {
  test.skip(test.info().project.name !== "desktop", "API-level test, run once");
  const kit = await (await request.post("/api/kits", { data: { title: "Retry check" } })).json();
  await request.post(`/api/kits/${kit.id}/sources`, {
    data: {
      name: "Notes",
      text: "# Cells\n\n## Organelles\nThe mitochondria produce energy for the cell through respiration. The nucleus stores genetic information as DNA. Ribosomes build proteins from amino acids.\n\n## Transport\nOsmosis is the movement of water across a partially permeable membrane. Diffusion is the movement of particles from high to low concentration.",
    },
  });
  const run = (step: string) => request.post(`/api/kits/${kit.id}/generate`, { data: { step } });
  const counts = async () => {
    const all = await (await request.get("/api/account")).json();
    const mine = (rows: { kit_id: string }[]) => rows.filter((r) => r.kit_id === kit.id).length;
    return { cards: mine(all.flashcards), questions: mine(all.questions), docs: mine(all.documents) };
  };

  for (const step of ["extract", "outline", "flashcards"]) expect((await run(step)).ok()).toBe(true);
  const afterCards = await counts();
  expect(afterCards.cards).toBeGreaterThan(0);

  // a retry of flashcards while the questions step hasn't finished yet (uploads still "new")
  expect((await run("flashcards")).ok()).toBe(true);
  expect((await counts()).cards).toBe(afterCards.cards);

  for (const step of ["questions", "guide", "summary"]) expect((await run(step)).ok()).toBe(true);
  const first = await counts();
  expect(first.questions).toBeGreaterThan(0);

  // and re-running every writing step after the kit is built changes nothing
  for (const step of ["flashcards", "questions", "guide", "summary"]) expect((await run(step)).ok()).toBe(true);
  expect(await counts()).toEqual(first);
});
