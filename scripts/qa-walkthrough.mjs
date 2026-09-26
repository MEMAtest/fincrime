import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3107";
const TOKEN = "af12f1f7aaa74b4507ac8e698918b6ca9fc5c6166df14124e4c42ebb6a313d54";
const SHOT_DIR = "/tmp/pra-shots";
mkdirSync(SHOT_DIR, { recursive: true });
const issues = [];
function note(msg) { issues.push(msg); console.log("ISSUE:", msg); }
function log(msg) { console.log(msg); }

async function withCookie(context) {
  await context.addCookies([{ name: "fincrime_session", value: TOKEN, url: BASE, httpOnly: true }]);
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}

async function dumpText(page) {
  return (await page.locator("body").innerText()).trim();
}

async function selectByOptionText(select, substring) {
  const value = await select.evaluate((el, sub) => {
    const opt = Array.from(el.options).find((o) => o.textContent.includes(sub));
    return opt ? opt.value : null;
  }, substring);
  if (!value) throw new Error(`No <option> containing "${substring}"`);
  await select.selectOption(value);
}

function checkDashes(text, where) {
  if (/[–—]/.test(text)) note(`Dash (em/en) found in ${where}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await withCookie(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // Home
  await page.goto(`${BASE}/drafter`, { waitUntil: "networkidle" });
  let text = await dumpText(page);
  checkDashes(text, "drafter home");
  await shot(page, "01-home");
  log("HOME TEXT:\n" + text.slice(0, 1500));

  // Documents: upload approved-pra.docx + style-brief.md + register-rehearsal.xlsx
  await page.goto(`${BASE}/drafter/documents`, { waitUntil: "networkidle" });
  const fileInput = page.locator('input[type="file"]');
  const uploads = [
    "test/fixtures/drafter/approved-pra.docx",
    "test/fixtures/drafter/style-brief.md",
    "test/fixtures/drafter-rehearsal/register-rehearsal.xlsx",
  ];
  let bodyText = await dumpText(page);
  for (const f of uploads) {
    const base = f.split("/").pop();
    if (bodyText.includes(base)) { log(`skip re-upload of ${base} (already present)`); continue; }
    await fileInput.setInputFiles(f);
    await page.getByRole("button", { name: /upload/i }).first().click();
    await page.waitForTimeout(1500);
  }
  // Confirm document types: approved-pra.docx -> Approved PRA, style-brief.md -> Style brief,
  // register-rehearsal.xlsx -> Register (already suggested/auto?)
  async function confirmNear(filename, label) {
    const container = page.locator(".glass-card", { hasText: filename }).first();
    const btn = container.getByRole("button", { name: label });
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  }
  await confirmNear("approved-pra.docx", "Confirm: Approved PRA");
  await confirmNear("style-brief.md", "Confirm: Style brief");
  await confirmNear("register-rehearsal.xlsx", "Confirm: Register");
  text = await dumpText(page);
  checkDashes(text, "documents page");
  await shot(page, "02-documents");
  log("\nDOCUMENTS TEXT (after confirm):\n" + text.slice(0, 3000));

  // Templates: select the style brief, create a StylePack; select the approved PRA doc, extract skeleton
  await page.goto(`${BASE}/drafter/templates`, { waitUntil: "networkidle" });
  const hasStylepack = (await dumpText(page)).includes("StylePack ·") || (await page.locator("select").count()) < 2;
  const briefSelect = page.locator("select").first();
  await selectByOptionText(briefSelect, "style-brief.md");
  const stylepackBtn = page.getByRole("button", { name: "New StylePack (seeded)" });
  if (await stylepackBtn.count()) {
    await stylepackBtn.click();
    await page.waitForTimeout(1000);
  }

  const docSelect = page.locator("select").filter({ hasText: "Choose a confirmed approved PRA document" });
  if (await docSelect.count()) {
    await selectByOptionText(docSelect, "approved-pra.docx");
    await page.getByRole("button", { name: "Extract" }).click();
    await page.waitForTimeout(1500);
  }
  text = await dumpText(page);
  checkDashes(text, "templates page after extract");
  await shot(page, "03-templates-extracted");
  log("\nTEMPLATES AFTER EXTRACT:\n" + text.slice(0, 4000));

  // Confirm the template (createAndConfirm button says something like "Confirm template")
  const confirmBtn = page.locator("button", { hasText: /confirm/i }).last();
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
  }
  text = await dumpText(page);
  await shot(page, "04-templates-confirmed");
  log("\nTEMPLATES AFTER CONFIRM:\n" + text.slice(0, 4000));

  // Register: import the rehearsal register
  await page.goto(`${BASE}/drafter/register`, { waitUntil: "networkidle" });
  text = await dumpText(page);
  log("\nREGISTER PAGE (before import):\n" + text.slice(0, 2000));
  const regDocSelect = page.locator("select").first();
  await selectByOptionText(regDocSelect, "register-rehearsal.xlsx");
  await page.getByRole("button", { name: "List sheets" }).click();
  await page.waitForTimeout(1000);
  text = await dumpText(page);
  log("\nAFTER LIST SHEETS:\n" + text.slice(0, 1500));
  await page.getByRole("button", { name: "Import" }).click();
  await page.waitForURL(/\/drafter\/register\/.+/, { timeout: 10000 });
  await page.waitForTimeout(3000);
  text = await dumpText(page);
  checkDashes(text, "register import validation page");
  await shot(page, "05-register-import");
  log("\nREGISTER IMPORT VALIDATION TEXT (tail):\n" + text.slice(-6000));
  log("URL: " + page.url());

  // Try to find blocking rows and resolve/override them
  const blockingCards = page.locator("text=blocking").locator("xpath=ancestor::*[self::div or self::li][1]");
  const blockCount = await page.locator("text=blocking").count();
  log(`\nblocking-label count on page: ${blockCount}`);
  const overrideButtons = await page.getByRole("button", { name: /override/i }).count();
  const resolveButtons = await page.getByRole("button", { name: /resolve/i }).count();
  log(`override buttons: ${overrideButtons}, resolve buttons: ${resolveButtons}`);
  page.on("dialog", async (d) => { await d.accept("QA rehearsal override: accepted risk for synthetic data, tested deliberately."); });
  // ISSUE-01: Override/Mark-resolved buttons never disappear or change state
  // after a successful resolution (server-side is_blocked correctly flips,
  // but the per-issue buttons keep rendering) -> clicking "first override"
  // repeatedly re-overrides the SAME row. Work around it here by targeting
  // each currently-"Blocked" row card once, re-querying between clicks.
  let guard = 0;
  while (guard++ < 10) {
    // Row cards are the smallest div with class "rounded-lg" that also contains a Blocked badge
    const blockedCard = page.locator("div.rounded-lg", { has: page.getByText("Blocked", { exact: true }) }).first();
    if (!(await blockedCard.count())) break;
    const overrideBtn = blockedCard.getByRole("button", { name: "Override" }).first();
    if (!(await overrideBtn.count())) break;
    await overrideBtn.click();
    await page.waitForTimeout(1200);
  }
  log(`Blocked rows remaining after resolution loop: ${await page.getByText("Blocked", { exact: true }).count()}`);
  text = await dumpText(page);
  await shot(page, "06-register-after-override");
  const acceptBtn = page.getByRole("button", { name: "Accept version" });
  log(`Accept version button enabled: ${await acceptBtn.isEnabled().catch(() => "n/a")}`);
  await acceptBtn.click({ timeout: 5000 }).catch((e) => log("Accept click failed: " + e.message));
  await page.waitForTimeout(2000);
  text = await dumpText(page);
  checkDashes(text, "register accepted page");
  await shot(page, "07-register-accepted");
  log("\nAFTER ACCEPT:\n" + text.slice(-3000));

  await page.goto(`${BASE}/drafter/library`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  text = await dumpText(page);
  checkDashes(text, "library page");
  await shot(page, "08-library");
  log("\nLIBRARY TEXT (head):\n" + text.slice(0, 1500));

  async function suggestTagsFor(marker) {
    const card = page.locator(".glass-card", { hasText: marker }).first();
    if (!(await card.count())) { note(`Library: no control card found for marker ${marker}`); return; }
    await card.getByRole("button", { name: "Suggest tags" }).click();
    await page.waitForTimeout(1200);
    const cardText = await card.innerText();
    log(`\n--- ${marker} card after Suggest tags ---\n${cardText}`);
  }
  await suggestTagsFor("RQTGOODMK");
  await suggestTagsFor("RQTOOLMK");
  await suggestTagsFor("RQTMALMK");

  // Start a PRA: correspondent banking, legal person only
  await page.goto(`${BASE}/drafter/pras`, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Correspondent banking"]').fill("Correspondent Banking");
  await page.getByText("Legal person", { exact: true }).click();
  await selectByOptionText(page.locator("select").nth(0), "Approved PRA template");
  await selectByOptionText(page.locator("select").nth(1), "House style");
  await page.getByRole("button", { name: "Start PRA" }).click();
  await page.waitForURL(/\/drafter\/pras\/.+/, { timeout: 10000 });
  await page.waitForTimeout(2000);
  text = await dumpText(page);
  checkDashes(text, "PRA candidates page");
  await shot(page, "09-pra-start");
  log("\nPRA START PAGE:\n" + text.slice(0, 4000));
  log("URL: " + page.url());

  // Select every candidate checkbox, then confirm selection to build sections/enhancements
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  log(`candidate checkboxes: ${cbCount}`);
  for (let i = 0; i < cbCount; i++) await checkboxes.nth(i).check({ force: true });
  await page.getByRole("button", { name: "Confirm selection and build sections" }).click();
  await page.waitForTimeout(4000);
  text = await dumpText(page);
  checkDashes(text, "PRA page after candidate selection");
  await shot(page, "10-pra-sections-built");
  const unassignedCount = (text.match(/were NOT assigned/) || [])[0]
    ? text.match(/(\d+) selected control\(s\) were NOT assigned/)?.[1]
    : "0";
  log(`\nUnassigned count: ${unassignedCount}`);
  log("\nSection 2.4 present: " + text.includes("2.4"));
  log("Markers present in page: " + ["REQ-0001-BAD-NUMBER", "RQJPASSMK", "RQTGOODMK"].filter((m) => text.includes(m)).join(", "));

  // Draft all remaining, then judge all
  await page.getByRole("button", { name: "Draft all remaining" }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Working..."), { timeout: 120000 }).catch(() => note("Draft all remaining did not finish within 120s (still showing 'Working...')"));
  await page.waitForTimeout(1000);
  text = await dumpText(page);
  checkDashes(text, "PRA page after draft all");
  await shot(page, "11-pra-drafted");
  log("\nAfter draft-all, page length: " + text.length);
  log("Contains 'Working...': " + text.includes("Working..."));

  await page.getByRole("button", { name: "Judge all drafted" }).click().catch(async () => {
    const btns = await page.locator("button").allInnerTexts();
    note("Could not find 'Judge all drafted' button. Buttons seen: " + JSON.stringify(btns.filter((b) => /judge/i.test(b))));
  });
  await page.waitForFunction(() => !document.body.innerText.includes("Working..."), { timeout: 120000 }).catch(() => note("Judge all drafted did not finish within 120s"));
  await page.waitForTimeout(1000);
  text = await dumpText(page);
  checkDashes(text, "PRA page after judge all");
  await shot(page, "12-pra-judged");

  // Inspect enhancement statuses
  const statusWords = ["Pass", "Minor issues", "Critical issues", "Not reviewed", "not reviewed", "critical", "minor"];
  for (const w of statusWords) {
    const c = (text.match(new RegExp(w, "g")) || []).length;
    log(`status word "${w}": ${c} occurrences`);
  }
  writeFileSync("/tmp/pra-page-after-judge.txt", text);
  log("Full page dumped to /tmp/pra-page-after-judge.txt");

  // Approve + promote one clean enhancement as exemplar (use RQJPASSMK, minor/no critical)
  const passCard = page.locator("div.border-border.rounded-lg", { hasText: "RQJPASSMK" }).first();
  if (await passCard.count()) {
    await passCard.getByRole("button", { name: "Approve + promote as exemplar" }).click();
    await page.waitForTimeout(1500);
    log("Approved+promoted RQJPASSMK: " + (await passCard.innerText()).slice(0, 300));
  } else {
    note("Could not find an Approve+promote button scoped to RQJPASSMK's card");
  }

  // Export: expect blocked (critical/not_reviewed items exist), then override
  await page.getByRole("button", { name: "Export to Word" }).click();
  await page.waitForTimeout(2000);
  text = await dumpText(page);
  await shot(page, "13-pra-export-blocked");
  const blockedExport = text.includes("Export blocked");
  log(`\nExport blocked as expected: ${blockedExport}`);
  if (blockedExport) {
    await page.getByPlaceholder("Reason for exporting with unresolved issues (logged with your account)").fill("QA rehearsal: exporting with known outstanding issues to prove the override path.");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10000 }).catch(() => null),
      page.getByRole("button", { name: "Override and export anyway" }).click(),
    ]);
    if (download) {
      await download.saveAs("/tmp/pra-export.docx");
      log("Export downloaded to /tmp/pra-export.docx");
    } else {
      note("Export override click did not trigger a file download within 10s");
    }
    await page.waitForTimeout(1500);
  }
  text = await dumpText(page);
  await shot(page, "14-pra-export-final");
  log("\nAfter export attempt:\n" + text.slice(-1500));

  const praUrl = page.url();
  await browser.close();

  // Viewport checks: mobile (390), wide (1920), ultrawide (3840x1080)
  for (const vp of [{ w: 390, h: 844, name: "mobile-390" }, { w: 1920, h: 1080, name: "wide-1920" }, { w: 3840, h: 1080, name: "ultrawide-3840" }]) {
    const b2 = await chromium.launch({ headless: true });
    const ctx2 = await b2.newContext({ viewport: { width: vp.w, height: vp.h } });
    await withCookie(ctx2);
    const p2 = await ctx2.newPage();
    p2.setDefaultTimeout(15000);
    await p2.goto(praUrl, { waitUntil: "networkidle" });
    await p2.waitForTimeout(1000);
    const hasHorizScroll = await p2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    log(`\n${vp.name}: horizontal overflow = ${hasHorizScroll}`);
    if (hasHorizScroll) note(`Horizontal overflow at ${vp.name} on PRA page`);
    await p2.screenshot({ path: `${SHOT_DIR}/viewport-${vp.name}-pra.png`, fullPage: true });
    await p2.goto(`${BASE}/drafter/library`, { waitUntil: "networkidle" });
    await p2.waitForTimeout(1000);
    const hasHorizScroll2 = await p2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (hasHorizScroll2) note(`Horizontal overflow at ${vp.name} on library page`);
    await p2.screenshot({ path: `${SHOT_DIR}/viewport-${vp.name}-library.png`, fullPage: true });
    await b2.close();
  }
}

main().then(() => {
  console.log("\n--- ISSUES SO FAR ---");
  issues.forEach((i) => console.log("- " + i));
});
