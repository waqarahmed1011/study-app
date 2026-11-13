import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const NOTES = `# Cell Biology

## Organelles
The mitochondria produce energy for the cell through aerobic respiration. The nucleus stores genetic information as DNA and controls cell activity. Ribosomes build proteins from amino acids using instructions from messenger RNA.

## Membrane transport
Osmosis is the movement of water across a partially permeable membrane from a dilute to a concentrated solution. Diffusion is the net movement of particles from high to low concentration. Active transport moves substances against a concentration gradient and requires energy from respiration.

## Cell division
Mitosis produces two genetically identical daughter cells for growth and repair. Meiosis produces four genetically different gametes with half the chromosome number. Prophase, metaphase, anaphase and telophase are the stages of mitosis in order.`;

async function createKit(page: Page, title: string) {
  await page.goto("/kits/new");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Leave blank").fill(title);
  await page.getByPlaceholder("Paste notes").fill(NOTES);
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByText("Pasted notes")).toBeVisible();
  await page.getByRole("button", { name: "Build my kit" }).click();
  await expect(page.getByText("Building your study kit")).toBeVisible();
  await expect(page).toHaveURL(/\/kits\/[^/]+\/smart/, { timeout: 60_000 });
  await expect(page.getByText(/^Level \d+$/)).toBeVisible({ timeout: 60_000 });
}

/** Clicks a tab from the desktop row or the phone bottom bar / More menu. */
const SEGMENT: Record<string, string> = { Flashcards: "flashcards", Test: "test", "Study Guide": "guide", Tutor: "chat", History: "history", Diagrams: "diagrams", Materials: "materials" };

async function openTab(page: Page, desktop: string, mobile: string, inMore = false) {
  const isMobile = (page.viewportSize()?.width ?? 1000) < 640;
  const nav = page.getByRole("navigation", { name: "Kit sections" });
  if (!isMobile) {
    await nav.getByRole("link", { name: desktop }).click();
  } else {
    if (inMore) await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("link", { name: mobile, exact: true }).last().click();
  }
  // Next renders the new route's shell before the URL commits; wait for the real page
  await expect(page).toHaveURL(new RegExp(`/${SEGMENT[desktop]}(\\?|$)`));
  await page.waitForLoadState("networkidle");
}

test("build a kit from pasted notes and study it every way", async ({ page }) => {
  const title = `Biology ${test.info().project.name}`;
  await createKit(page, title);

  // --- Smart Study: answer 3 questions of whatever types come up
  let lastQid = "";
  for (let i = 0; i < 3; i++) {
    // wait for a new question to be on screen
    const question = page.getByTestId("question");
    await expect(question).toBeVisible();
    await expect.poll(async () => question.getAttribute("data-qid")).not.toBe(lastQid);
    lastQid = (await question.getAttribute("data-qid")) ?? "";
    const check = page.getByRole("button", { name: "Check answer" });
    const radios = page.getByRole("radio");
    if (await check.isVisible().catch(() => false)) {
      // multi-select / short answer / matching / ordering
      const box = page.getByLabel("Your answer");
      if (await box.isVisible().catch(() => false)) await box.fill("mitochondria produce energy through respiration");
      const boxes = page.getByRole("checkbox");
      if ((await boxes.count()) > 0) await boxes.first().click();
      // matching: pair each left item with some right item
      const leftButtons = page.getByTestId("match-left");
      const n = await leftButtons.count();
      for (let k = 0; k < n; k++) {
        await leftButtons.nth(k).click();
        await page.getByTestId("match-right").nth(k).click();
      }
      await check.click();
    } else {
      await radios.first().click();
    }
    await expect(page.getByText(/Correct!|Not quite|Partly right/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Next question" }).click();
  }

  // --- Flashcards: flip and rate
  await openTab(page, "Flashcards", "Cards");
  await expect(page.getByText("Reviewing")).toBeVisible();
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.getByRole("button", { name: /^Good, next in/ }).click();
  await expect(page.locator("text=/\\d+ due/")).toBeVisible();

  // --- Games tab renders
  await page.getByRole("tab", { name: "games" }).click();
  await page.getByRole("button", { name: "Play" }).first().click();
  await expect(page.getByText(/Best|0\.\d?s|\ds/).first()).toBeVisible();

  // --- Practice test
  await openTab(page, "Test", "Test");
  await page.getByRole("button", { name: /Create test/ }).click();
  await expect(page.getByRole("button", { name: "Submit test" })).toBeVisible({ timeout: 30_000 });
  for (const q of await page.getByRole("radiogroup").all()) await q.getByRole("radio").first().click();
  for (const box of await page.getByLabel("Your answer").all()) await box.fill("energy");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByText(/fully correct/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Review")).toBeVisible();

  // --- Study guide
  await openTab(page, "Study Guide", "Guide");
  await expect(page.getByRole("heading", { name: "Study guide" })).toBeVisible();
  await page.getByRole("tab", { name: "Summary" }).click();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();

  // --- Tutor chat streams a reply
  await openTab(page, "Tutor", "Tutor", true);
  await page.getByLabel("Message").fill("What does osmosis mean?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Good question/)).toBeVisible({ timeout: 20_000 });

  // --- History lists answers
  await openTab(page, "History", "History", true);
  await expect(page.getByText("Question history")).toBeVisible();
  await expect(page.getByText("Answer:").first()).toBeVisible();

  // --- Progress page shows the kit
  await page.goto("/progress");
  await expect(page.getByText(title)).toBeVisible();
});

test("diagram: detect, confirm, label quiz and tap quiz", async ({ page }) => {
  await createKit(page, `Anatomy ${test.info().project.name}`);
  await openTab(page, "Diagrams", "Diagrams", true);
  // Next keeps earlier pages mounted (hidden), so target the diagram uploader specifically
  await page.locator('input[data-testid="file-input"][accept="image/*"]').setInputFiles(path.join(__dirname, "fixtures/diagram.png"));
  await expect(page.getByRole("tab", { name: /Edit labels/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Structure 1", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Confirm all" }).click();
  await page.getByRole("button", { name: "Start studying" }).click();

  // label quiz: name the highlighted structure
  await expect(page.getByLabel("Structure name")).toBeVisible();
  await page.getByRole("button", { name: "Peek all" }).click();
  await page.getByRole("button", { name: "Hide all" }).click();
  await page.getByLabel("Structure name").fill("Structure 9");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/Answer: Structure \d/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // tap quiz: tap inside the target's box (mock boxes are at known places)
  await page.getByRole("tab", { name: /Tap to find/ }).click();
  const target = await page.locator("text=/^Structure \\d$/").first().innerText();
  const idx = Number(target.split(" ")[1]) - 1;
  const img = page.getByAltText("Diagram, tap the named structure");
  const box = (await img.boundingBox())!;
  // mock box i: x 0.25-0.6, y (120+200i)/1000 .. +150
  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * ((120 + idx * 200 + 75) / 1000));
  await expect(page.getByText("Correct!")).toBeVisible();

  // fact questions start unverified
  await page.getByRole("tab", { name: /Fact questions/ }).click();
  await page.getByRole("button", { name: /Write fact questions/ }).click();
  await expect(page.getByText("Unverified").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Looks right" }).first().click();
  await expect(page.getByText("Verified").first()).toBeVisible();
});
