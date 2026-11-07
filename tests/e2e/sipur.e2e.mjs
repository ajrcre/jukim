// בדיקת קצה-לקצה לאפליקציית sipur/ בדפדפן אמיתי (Playwright + Chromium).
// לא רצה ב-CI (שם אין Playwright); הרצה ידנית:
//   node tests/e2e/sipur.e2e.mjs [תיקייה-לצילומי-מסך]
// הבדיקה עונה דרך הממשק (הקשות, גרירה בעכבר וגרירה במגע), ובודקת ניקוד, משוב, מבחן, שמירה, חזרה ואיפוס.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.resolve(here, "../../sipur/index.html")).href;
const SHOTS = process.argv[2] || null;

const log = (...a) => console.log("  •", ...a);

async function noOverflow(page, where) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(o <= 0, `${where}: horizontal overflow of ${o}px`);
}

async function currentItem(page, mode) {
  return page.evaluate((mode) => {
    const app = window.Sipur.app;
    const S = mode === "test" ? app.test : app.practice;
    const it = S.items[S.index];
    return { q: it.q, index: S.index, total: S.items.length };
  }, mode);
}

/** עונה על השאלה הנוכחית דרך הממשק. correct=false → בוחר תשובה שגויה. */
async function answer(page, q, correct) {
  const click = (fk) => page.click(`[data-fk="${fk}"]`);
  switch (q.type) {
    case "mcq":
      await click("opt-" + (correct ? q.answer : (q.answer + 1) % q.options.length));
      break;
    case "pick": {
      const wrongPara = Object.keys(q.wrong || {}).map(Number)[0] ?? (q.answer === 0 ? 1 : 0);
      await click("para-" + (correct ? q.answer : wrongPara));
      break;
    }
    case "match":
      for (let i = 0; i < q.pairs.length; i++) {
        // שגוי: מחליפים בין שני הראשונים
        const chip = correct ? i : i === 0 ? 1 : i === 1 ? 0 : i;
        await click("chip-" + chip);
        await click("slot-" + i);
      }
      break;
    case "order": {
      const seq = q.items.map((_, k) => k);
      if (!correct) [seq[0], seq[1]] = [seq[1], seq[0]];
      for (const k of seq) await click("chip-" + k); // מצב סידור: כל הקשה למקום הפנוי הבא
      break;
    }
    case "classify":
      for (let i = 0; i < q.items.length; i++) {
        const a = q.items[i].answer;
        await click(`cls-${i}-${correct || i > 0 ? a : (a + 1) % q.categories.length}`);
      }
      break;
  }
}

function expectedScore(q, correct) {
  if (correct) return 1;
  if (q.type === "match" || q.type === "order") return (q.type === "match" ? q.pairs.length - 2 : q.items.length - 2) / (q.type === "match" ? q.pairs.length : q.items.length);
  if (q.type === "classify") return (q.items.length - 1) / q.items.length;
  return 0;
}

async function runPractice(page, { wrongAt = [], hintAt = [] } = {}) {
  let full = 0;
  const ids = [];
  for (;;) {
    const { q, index, total } = await currentItem(page, "practice");
    ids.push(q.id);
    // כפתור הבדיקה חסום לפני מענה
    assert.equal(await page.isDisabled('[data-fk="check"]'), true, "check enabled before answering");
    if (hintAt.includes(index)) {
      await page.click('[data-fk="hint"]');
      const hint = await page.textContent(".hint");
      assert.ok(hint.includes(q.hint), "hint text");
    }
    const correct = !wrongAt.includes(index);
    await answer(page, q, correct);
    await page.click('[data-fk="check"]');
    const verdict = await page.textContent("#verdict");
    const fb = await page.textContent(".feedback");
    assert.ok(fb.includes(q.explain), `${q.id}: explanation shown`);
    if (correct) {
      full++;
      assert.ok(!verdict.includes("לא בדיוק") && !verdict.includes("חלק"), `${q.id}: verdict "${verdict}"`);
    } else {
      assert.ok(verdict.includes("לא בדיוק") || verdict.includes("חלק"), `${q.id}: wrong verdict "${verdict}"`);
      if ((q.type === "mcq" || q.type === "pick") && q.wrong) {
        const chosen = q.type === "mcq" ? (q.answer + 1) % q.options.length : Object.keys(q.wrong).map(Number)[0];
        if (q.wrong[chosen]) assert.ok(fb.includes(q.wrong[chosen]), `${q.id}: targeted wrong-answer explanation`);
      }
      if (q.type === "order") assert.ok(fb.includes("הסדר הנכון"), "order shows correct order");
    }
    const score = await page.evaluate(() => {
      const P = window.Sipur.app.practice;
      return P.items[P.index].result.score;
    });
    assert.ok(Math.abs(score - expectedScore(q, correct)) < 1e-9, `${q.id}: score ${score}`);
    await page.click('[data-fk="next"]');
    if (index === total - 1) {
      await page.waitForSelector("text=תוצאות לפי מושג");
      break;
    }
    await page.waitForFunction((i) => window.Sipur.app.practice.index === i, index + 1);
  }
  return { full, ids };
}

async function dragTouch(cdp, from, to) {
  const pt = (b) => ({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  const a = pt(from);
  const b = pt(to);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
  await new Promise((r) => setTimeout(r, 500)); // לחיצה ארוכה
  for (let i = 1; i <= 8; i++) {
    const p = { x: Math.round(a.x + ((b.x - a.x) * i) / 8), y: Math.round(a.y + ((b.y - a.y) * i) / 8) };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await new Promise((r) => setTimeout(r, 30));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function scenario(browser, name, contextOpts) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => {
    if (!/^(file|data):/.test(r.url())) errors.push("external request: " + r.url());
  });
  const shot = async (label) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}-${label}.png`, fullPage: true });

  await page.goto(URL + "#/");
  // RTL ועברית
  assert.equal(await page.getAttribute("html", "dir"), "rtl");
  assert.equal(await page.getAttribute("html", "lang"), "he");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("main")).direction), "rtl");
  await noOverflow(page, "home");
  if (contextOpts.isMobile) {
    const nav = await page.locator(".mainnav").boundingBox();
    const vh = page.viewportSize().height;
    assert.ok(nav.y + nav.height >= vh - 2 && nav.y > vh - 120, `bottom nav at y=${nav.y}`);
    log("bottom tab bar is pinned to the bottom");
  }
  log("RTL + Hebrew + no horizontal overflow");

  // ---------- לימוד ----------
  await page.click('[data-nav="learn"]');
  await page.click('a[href="#/learn/climax"]');
  await page.waitForSelector("text=נקודת שיא או התרה?");
  await noOverflow(page, "learn/climax");
  await page.click('a[href="#/learn/resolution"]');
  await page.waitForSelector("text=התרה או סיום סגור?");
  log("learning pages show explanation, example and distinctions");

  // ---------- תרגול ----------
  await page.click('[data-nav="practice"]');
  await page.click("text=תרגול מעורב — 10 שאלות");
  await page.waitForSelector('[data-fk="check"]');
  await shot("practice-q1");
  const run1 = await runPractice(page, { wrongAt: [1, 4, 7], hintAt: [0, 2] });
  assert.equal(run1.ids.length, 10);
  const sumText = await page.textContent("main");
  assert.ok(sumText.includes(`${run1.full}/10`), `summary shows ${run1.full}/10`);
  assert.ok(sumText.includes("תוצאות לפי מושג"));
  await noOverflow(page, "practice summary");
  await shot("practice-summary");
  log(`practice round 1: ${run1.full}/10 as expected, feedback + targeted explanations verified`);

  // נשמר במכשיר
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sipur-jedi-progress-v1")));
  assert.equal(stored.practiceAnswered, 10);
  const hintedW = Object.values(stored.concepts).reduce((s, c) => s + c.hinted.w, 0);
  assert.ok(Math.abs(hintedW - 2) < 1e-6, `hinted weight ${hintedW}`);

  // חזרה על הטעויות
  const retryBtn = page.locator("button", { hasText: "לנסות שוב את" });
  assert.equal(await retryBtn.count(), 1);
  await retryBtn.click();
  await page.waitForSelector('[data-fk="check"]');
  const retryIds = await page.evaluate(() => window.Sipur.app.practice.items.map((it) => it.q.id));
  const wrongIds = [1, 4, 7].map((i) => run1.ids[i]);
  assert.deepEqual([...retryIds].sort(), [...wrongIds].sort());
  const retry = await runPractice(page);
  assert.equal(retry.full, 3);
  log("retrying mistakes replays exactly the missed questions");

  // המשך: סבב חדש בלי חזרות
  await page.click('[data-nav="practice"]');
  await page.click("text=תרגול מעורב — 10 שאלות");
  await page.waitForSelector('[data-fk="check"]');
  const runA = await runPractice(page);
  await page.click("text=המשך — עוד 10 שאלות");
  await page.waitForSelector('[data-fk="check"]');
  const runB = await runPractice(page);
  assert.equal(runA.ids.filter((id) => runB.ids.includes(id)).length, 0, "continue repeats questions");
  log("'continue' gives a fresh set of 10");

  // ---------- גרירה ----------
  // מוצאים שאלת התאמה/סידור בתרגול ממוקד ובודקים גרירה
  await page.evaluate(() => {
    const app = window.Sipur.app;
    const q = window.Sipur.content.QUESTIONS.find((x) => x.id === "match-definitions");
    app.startPractice({ questions: [q], label: "בדיקת גרירה" });
  });
  await page.waitForSelector('[data-fk="chip-2"]');
  await page.locator('[data-fk="slot-2"]').scrollIntoViewIfNeeded();
  if (contextOpts.hasTouch) {
    const cdp = await ctx.newCDPSession(page);
    await dragTouch(cdp, await page.locator('[data-fk="chip-2"]').boundingBox(), await page.locator('[data-fk="slot-2"]').boundingBox());
    log("touch long-press drag");
  } else {
    await page.dragAndDrop('[data-fk="chip-2"]', '[data-fk="slot-2"]');
    log("mouse drag");
  }
  const placed = await page.evaluate(() => window.Sipur.app.practice.items[0].board.slots[2]);
  assert.equal(placed, 2, "drag placed chip into slot");
  // גרירה חזרה למאגר
  if (!contextOpts.hasTouch) {
    await page.dragAndDrop('[data-fk="chip-2"]', ".board-pool");
    assert.equal(await page.evaluate(() => window.Sipur.app.practice.items[0].board.slots[2]), null);
  }
  await shot("drag");

  // ---------- המשך אחרי טעינה מחדש ----------
  await page.goto(URL + "#/");
  await page.reload();
  await page.waitForSelector("text=ההתקדמות שלי");
  const home = await page.textContent("main");
  assert.ok(/\d+%/.test(home), "home shows saved mastery after reload");
  log("progress survives a reload");
  const practiceBefore = await page.evaluate(() => JSON.stringify(window.Sipur.app.progress.data.concepts));

  // ---------- מבחן ----------
  await page.click('[data-nav="test"]');
  await page.click("text=התחלת המבחן");
  await page.waitForSelector(".qdots");
  await shot("test-q1");
  const wrongTest = new Set([0, 3]);
  let expectedTotal = 0;
  let expectedFull = 0;
  for (let i = 0; i < 12; i++) {
    const { q, index } = await currentItem(page, "test");
    assert.equal(index, i);
    assert.equal(await page.locator(".feedback").count(), 0, "no feedback during test");
    assert.equal(await page.locator('[data-fk="hint"]').count(), 0, "no hints during test");
    const correct = !wrongTest.has(i);
    await answer(page, q, correct);
    const s = expectedScore(q, correct);
    expectedTotal += s;
    if (s === 1) expectedFull++;
    if (i < 11) {
      await page.click("text=הבאה ←");
      await page.waitForFunction((n) => window.Sipur.app.test.index === n, i + 1);
    }
  }
  // חזרה לשאלה קודמת ושינוי לא מאבדים תשובות
  await page.click('.qdots button >> nth=5');
  assert.equal((await currentItem(page, "test")).index, 5);
  await page.click('.qdots button >> nth=11');
  await page.click('[data-fk="submit"]');
  await page.click('[data-fk="confirm-submit"]');
  await page.waitForSelector("text=תוצאות לפי מושג");
  const res = await page.textContent("main");
  const expectedPct = Math.round((expectedTotal / 12) * 100);
  assert.ok(res.includes(expectedPct + "%"), `test pct ${expectedPct}%`);
  assert.ok(res.includes(`${expectedFull} מתוך 12`), `test full ${expectedFull}`);
  assert.ok(res.includes("הטעויות שלכם (2)"), "mistakes grouped");
  assert.equal(await page.locator(".review-card .feedback").count() >= 2, true);
  await noOverflow(page, "test results");
  await shot("test-results");
  const practiceAfter = await page.evaluate(() => JSON.stringify(window.Sipur.app.progress.data.concepts));
  assert.equal(practiceAfter, practiceBefore, "test must not change practice stats");
  const tests = await page.evaluate(() => window.Sipur.app.progress.data.tests.length);
  assert.equal(tests, 1);
  log(`test: ${expectedPct}% scored correctly, answers hidden until submit, mistakes reviewed, stored separately`);

  // מבחן עם שאלות לא נענות
  await page.click("text=מבחן חדש");
  await page.waitForSelector(".qdots");
  await page.click("text=הגשת המבחן עכשיו");
  assert.ok((await page.textContent(".notice")).includes("נשארו 12 שאלות"));
  await page.click('[data-fk="confirm-submit"]');
  await page.waitForSelector("text=תוצאות לפי מושג");
  assert.ok((await page.textContent("main")).includes("0%"));
  log("submitting an empty test asks for confirmation and scores 0%");

  // ---------- איפוס ----------
  await page.goto(URL + "#/about");
  await page.click('[data-fk="reset"]');
  await page.click('[data-fk="reset-yes"]');
  assert.equal(await page.evaluate(() => localStorage.getItem("sipur-jedi-progress-v1")), null);
  await page.goto(URL + "#/");
  await page.waitForSelector("text=ההתקדמות שלי");
  assert.ok((await page.textContent("main")).includes("עוד לא תרגלתם"));
  log("reset clears all saved progress");

  assert.deepEqual(errors, [], "page errors");
  await ctx.close();
}

/** כל שאלה במאגר: תשובה נכונה דרך הממשק = ניקוד מלא; תשובה שגויה = פחות, עם הסבר. */
async function everyQuestion(browser) {
  console.log("\n== every question through the UI ==");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL + "#/");
  const ids = await page.evaluate(() => window.Sipur.content.QUESTIONS.map((q) => q.id));
  for (const id of ids) {
    for (const correct of [true, false]) {
      await page.evaluate((id) => {
        const q = window.Sipur.content.QUESTIONS.find((x) => x.id === id);
        window.Sipur.app.startPractice({ questions: [q], label: "בדיקה" });
      }, id);
      await page.waitForFunction((id) => window.Sipur.app.practice.items[0].q.id === id && document.querySelector('[data-fk="check"]'), id);
      const { q } = await currentItem(page, "practice");
      await answer(page, q, correct);
      await page.click('[data-fk="check"]');
      const score = await page.evaluate(() => window.Sipur.app.practice.items[0].result.score);
      assert.ok(Math.abs(score - expectedScore(q, correct)) < 1e-9, `${id} (${correct}): score ${score}`);
      const fb = await page.textContent(".feedback");
      assert.ok(fb.includes(q.explain), `${id}: explanation`);
      await noOverflow(page, id);
    }
  }
  assert.deepEqual(errors, []);
  log(`${ids.length} questions: correct answers score 100%, wrong answers score lower, all show explanations, no overflow at 390px`);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await everyQuestion(browser);
  await scenario(browser, "phone", { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await scenario(browser, "desktop", { viewport: { width: 1280, height: 860 } });
  console.log("\nALL E2E CHECKS PASSED");
} finally {
  await browser.close();
}
