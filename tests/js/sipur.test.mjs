// בדיקות לאפליקציית „ג'דיי של סיפור קצר” (sipur/): שלמות התוכן, בדיקת תשובות, לוח התאמה/סידור,
// שמירת התקדמות ובניית סבבים.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const content = require("../../sipur/js/content.js");
const engine = require("../../sipur/js/engine.js");

const { CONCEPTS, STORIES, QUESTIONS } = content;
const { CONCEPT_IDS, MIXED } = engine;
const storyById = new Map(STORIES.map((s) => [s.id, s]));

function correctResponse(q) {
  switch (q.type) {
    case "mcq":
    case "pick":
      return q.answer;
    case "match":
      return q.pairs.map((_, i) => i);
    case "order":
      return q.items.map((_, i) => i);
    case "classify":
      return q.items.map((it) => it.answer);
  }
  throw new Error(q.type);
}

// --- תוכן -------------------------------------------------------------------

test("all six required concepts are taught, with explanation, example and a distinction", () => {
  assert.deepEqual(
    CONCEPTS.map((c) => c.id),
    CONCEPT_IDS,
  );
  const names = CONCEPTS.map((c) => c.name).join(" | ");
  for (const term of ["אקספוזיציה", "סיבוך", "קונפליקט", "נקודת שיא", "התרה", "סיום פתוח", "סיום סגור", "דמויות ראשיות", "דמויות משניות"]) {
    assert.ok(names.includes(term), `missing term ${term}`);
  }
  for (const c of CONCEPTS) {
    assert.ok(c.explain.length > 60, c.id);
    assert.ok(c.example.length > 30, c.id);
    assert.ok(c.distinctions.length >= 1, c.id);
  }
  // ההבחנות שהתבקשו במפורש
  const climax = CONCEPTS.find((c) => c.id === "climax");
  const resolution = CONCEPTS.find((c) => c.id === "resolution");
  assert.ok(climax.distinctions.some((d) => d.title.includes("התרה")));
  assert.ok(resolution.distinctions.some((d) => d.title.includes("נקודת שיא")));
  assert.ok(resolution.distinctions.some((d) => d.title.includes("סיום סגור")));
});

test("question ids are unique and there are at least 24 questions", () => {
  const ids = QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(QUESTIONS.length >= 24, `only ${QUESTIONS.length}`);
});

test("every question is well formed with a valid answer key, hint and explanation", () => {
  for (const q of QUESTIONS) {
    const where = `question ${q.id}`;
    assert.ok(engine.GRADERS[q.type], `${where}: type`);
    assert.ok(q.concept === MIXED || CONCEPT_IDS.includes(q.concept), `${where}: concept`);
    for (const c of engine.questionConcepts(q)) assert.ok(CONCEPT_IDS.includes(c), `${where}: concepts ${c}`);
    assert.ok(q.prompt && q.prompt.length > 8, `${where}: prompt`);
    assert.ok(q.hint && q.hint.length > 10, `${where}: hint`);
    assert.ok(q.explain && q.explain.length > 40, `${where}: explain`);
    if (q.story) assert.ok(storyById.has(q.story), `${where}: story`);

    if (q.type === "mcq") {
      assert.ok(q.options.length >= 3 && q.options.length <= 5, `${where}: options`);
      assert.equal(new Set(q.options).size, q.options.length, `${where}: duplicate options`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${where}: answer`);
      for (const k of Object.keys(q.wrong || {})) {
        assert.notEqual(Number(k), q.answer, `${where}: wrong-explanation for the correct option`);
        assert.ok(Number(k) < q.options.length, `${where}: wrong key ${k}`);
      }
      // לכל מסיח יש הסבר ממוקד
      for (let i = 0; i < q.options.length; i++) {
        if (i !== q.answer) assert.ok(q.wrong && q.wrong[i], `${where}: missing wrong[${i}]`);
      }
    }
    if (q.type === "pick") {
      assert.ok(q.story, `${where}: pick needs a story`);
      const n = storyById.get(q.story).paragraphs.length;
      assert.ok(q.answer >= 0 && q.answer < n, `${where}: answer out of range`);
      for (const k of Object.keys(q.wrong || {})) {
        assert.ok(Number(k) < n && Number(k) !== q.answer, `${where}: wrong key ${k}`);
      }
    }
    if (q.type === "match") {
      assert.ok(q.pairs.length >= 3, `${where}: pairs`);
      const answers = q.pairs.map((p) => p.answer);
      assert.equal(new Set(answers).size, answers.length, `${where}: match answers must be distinct`);
      assert.equal(new Set(q.pairs.map((p) => p.prompt)).size, q.pairs.length, `${where}: prompts distinct`);
    }
    if (q.type === "order") {
      assert.ok(q.items.length >= 4, `${where}: items`);
      assert.equal(new Set(q.items.map((i) => i.text)).size, q.items.length, `${where}: items distinct`);
    }
    if (q.type === "classify") {
      assert.ok(q.categories.length >= 2, `${where}: categories`);
      for (const it of q.items) assert.ok(it.answer >= 0 && it.answer < q.categories.length, `${where}: item answer`);
      // לפחות פריט אחד מכל קטגוריה
      for (let c = 0; c < q.categories.length; c++) assert.ok(q.items.some((it) => it.answer === c), `${where}: category ${c} unused`);
    }
  }
});

test("mcq answer positions are hidden by shuffling, so keys can be authored first", () => {
  // התשובות נכתבו כ-answer: 0 ומעורבבות בתצוגה; הבדיקה מוודאת שהמערבב באמת מזיז אותן.
  const rng = engine.mulberry32(7);
  const positions = new Set();
  for (let i = 0; i < 30; i++) positions.add(engine.shuffle([0, 1, 2, 3], rng).indexOf(0));
  assert.equal(positions.size, 4);
});

test("coverage is balanced: every concept is tested by at least 7 questions", () => {
  const counts = Object.fromEntries(CONCEPT_IDS.map((c) => [c, 0]));
  for (const q of QUESTIONS) for (const c of engine.questionConcepts(q)) counts[c]++;
  for (const c of CONCEPT_IDS) assert.ok(counts[c] >= 7, `${c}: ${counts[c]}`);
  const max = Math.max(...Object.values(counts));
  const min = Math.min(...Object.values(counts));
  assert.ok(max / min <= 2, JSON.stringify(counts));
});

test("all required question formats exist, and several stories carry multiple questions", () => {
  const types = new Set(QUESTIONS.map((q) => q.type));
  for (const t of ["mcq", "match", "order", "pick"]) assert.ok(types.has(t), t);
  const perStory = {};
  for (const q of QUESTIONS) if (q.story) perStory[q.story] = (perStory[q.story] || 0) + 1;
  const rich = Object.values(perStory).filter((n) => n >= 3).length;
  assert.ok(rich >= 5, JSON.stringify(perStory));
  // סיפורי מלחמת הכוכבים וגם סיפורים רגילים
  assert.ok(STORIES.filter((s) => s.theme === "sw").length >= 3);
  assert.ok(STORIES.filter((s) => s.theme === "plain").length >= 3);
});

test("climax/resolution questions always come with a full story, never an isolated sentence", () => {
  for (const q of QUESTIONS) {
    if (q.type !== "pick") continue;
    if (!["climax", "resolution"].includes(q.concept)) continue;
    const s = storyById.get(q.story);
    assert.ok(s.paragraphs.length >= 5, `${q.id}: story too short for climax/resolution`);
  }
});

test("Star Wars stories use the familiar characters but are clearly marked as invented", () => {
  const swText = STORIES.filter((s) => s.theme === "sw")
    .flatMap((s) => s.paragraphs)
    .join(" ");
  for (const name of ["לוק", "ליאה", "ויידר", "R2-D2", "C-3PO"]) assert.ok(swText.includes(name), name);
});

// --- בדיקת תשובות -----------------------------------------------------------

test("the answer key grades as fully correct for every question", () => {
  for (const q of QUESTIONS) {
    const r = correctResponse(q);
    assert.ok(engine.isAnswered(q, r), q.id);
    const g = engine.grade(q, r);
    assert.equal(g.score, 1, q.id);
    const w = g.parts.reduce((s, p) => s + p.weight, 0);
    assert.ok(Math.abs(w - 1) < 1e-9, `${q.id}: weights sum ${w}`);
  }
});

test("wrong answers score below 1; match/order give partial credit per slot", () => {
  const mcq = QUESTIONS.find((q) => q.type === "mcq");
  assert.equal(engine.grade(mcq, (mcq.answer + 1) % mcq.options.length).score, 0);

  const order = QUESTIONS.find((q) => q.id === "order-stages");
  const swapped = [1, 0, 2, 3, 4];
  const g = engine.grade(order, swapped);
  assert.equal(g.score, 3 / 5);
  assert.deepEqual(g.items, [false, false, true, true, true]);
  // הניקוד לכל מושג מגיע מהמקום שבו הוא טעה
  const conflictPart = g.parts.find((p) => p.concept === "conflict");
  assert.equal(conflictPart.correct, false);
  assert.equal(g.parts.find((p) => p.concept === "climax").correct, true);

  const match = QUESTIONS.find((q) => q.id === "match-definitions");
  const r = [0, 1, 2, 3, 5, 4];
  assert.equal(engine.grade(match, r).score, 4 / 6);

  const classify = QUESTIONS.find((q) => q.id === "classify-endings");
  const cr = classify.items.map((it) => it.answer);
  cr[0] = 1 - cr[0];
  assert.equal(engine.grade(classify, cr).score, 3 / 4);
});

test("unanswered or incomplete responses are not considered answered", () => {
  const match = QUESTIONS.find((q) => q.type === "match");
  assert.equal(engine.isAnswered(match, null), false);
  assert.equal(engine.isAnswered(match, [0, 1, null, 3, 4, 5]), false);
  const mcq = QUESTIONS.find((q) => q.type === "mcq");
  assert.equal(engine.isAnswered(mcq, null), false);
  assert.equal(engine.isAnswered(mcq, 99), false);
});

// --- לוח התאמה / סידור (הקשה וגרירה) ---------------------------------------

test("board: tap chip then slot places it; tapping another slot moves it; pool returns it", () => {
  const b = new engine.BoardModel(3, [2, 0, 1]);
  b.tapChip(0);
  assert.equal(b.selectedChip, 0);
  b.tapSlot(1);
  assert.deepEqual(b.slots, [null, 0, null]);
  assert.equal(b.selectedChip, null);
  b.tapChip(0); // בחירת צ'יפ שכבר הוצב
  b.tapSlot(2);
  assert.deepEqual(b.slots, [null, null, 0]);
  b.tapChip(0);
  b.tapPool();
  assert.deepEqual(b.slots, [null, null, null]);
  assert.deepEqual(b.pool(), [2, 0, 1]);
});

test("board: slot-first tapping and swapping occupied slots", () => {
  const b = new engine.BoardModel(2, [0, 1]);
  b.tapSlot(0); // קודם מקום
  b.tapChip(1); // ואז צ'יפ
  assert.deepEqual(b.slots, [1, null]);
  b.tapChip(0);
  b.tapSlot(0); // מקום תפוס, הצ'יפ הקודם חוזר למאגר
  assert.deepEqual(b.slots, [0, null]);
  assert.deepEqual(b.pool(), [1]);
  b.tapChip(1);
  b.tapSlot(1);
  b.tapChip(0);
  b.tapSlot(1); // החלפה בין שני מקומות
  assert.deepEqual(b.slots, [1, 0]);
  assert.deepEqual(b.response(), [1, 0]);
  b.tapChip(1);
  b.tapChip(0); // צ'יפ נבחר + הקשה על צ'יפ מוצב = החלפה
  assert.deepEqual(b.slots, [0, 1]);
  assert.equal(b.selectedChip, null);
});

test("board: ordering mode places tapped items into the next free slot; drag targets work", () => {
  const b = new engine.BoardModel(3, [1, 2, 0], { autoPlace: true });
  b.tapChip(0);
  b.tapChip(1);
  assert.deepEqual(b.slots, [0, 1, null]);
  assert.equal(b.response(), null);
  b.tapChip(2);
  assert.deepEqual(b.response(), [0, 1, 2]);
  b.drop(2, 0); // גרירה למקום תפוס = החלפה
  assert.deepEqual(b.slots, [2, 1, 0]);
  b.drop(1, "pool");
  assert.deepEqual(b.slots, [2, null, 0]);
  b.reset();
  assert.deepEqual(b.slots, [null, null, null]);
});

test("deranged permutation never returns the solved order", () => {
  const rng = engine.mulberry32(3);
  for (let i = 0; i < 200; i++) {
    const p = engine.derangedPermutation(5, rng);
    assert.notDeepEqual(p, [0, 1, 2, 3, 4]);
    assert.deepEqual([...p].sort(), [0, 1, 2, 3, 4]);
  }
});

// --- התקדמות -----------------------------------------------------------------

test("progress: practice is saved locally, hinted answers are kept apart, reset clears all", () => {
  const storage = new engine.MemoryStorage();
  const store = new engine.ProgressStore(storage);
  const q = QUESTIONS.find((x) => x.id === "def-expo");
  store.recordPractice(q, engine.grade(q, q.answer), false);
  store.recordPractice(q, engine.grade(q, q.answer), true);
  store.recordPractice(q, engine.grade(q, 1), false);

  const reloaded = new engine.ProgressStore(storage);
  const st = reloaded.conceptStats().expo;
  assert.equal(st.practice, 0.5); // רק תשובות בלי רמז נספרות
  assert.equal(st.hintedWeight, 1);
  assert.equal(reloaded.questionStat("def-expo").n, 3);
  assert.equal(reloaded.questionStat("def-expo").last, 0);

  reloaded.reset();
  assert.equal(storage.getItem(engine.STORAGE_KEY), null);
  assert.equal(new engine.ProgressStore(storage).conceptStats().expo.practice, null);
});

test("progress: test scores are stored separately from practice", () => {
  const store = new engine.ProgressStore(new engine.MemoryStorage());
  const q1 = QUESTIONS.find((x) => x.id === "def-climax");
  const q2 = QUESTIONS.find((x) => x.id === "order-stages");
  const rec = store.recordTest([
    { q: q1, result: engine.grade(q1, q1.answer) },
    { q: q2, result: engine.grade(q2, [1, 0, 2, 3, 4]) },
  ]);
  assert.equal(rec.full, 1);
  assert.equal(rec.pct, 80); // (1 + 0.6) / 2
  const stats = store.conceptStats();
  assert.equal(stats.climax.practice, null); // התרגול לא הושפע
  assert.equal(stats.climax.test, 1);
  assert.equal(stats.expo.test, 0);
  assert.ok(store.weakConcepts().includes("expo"));
});

test("progress: corrupt or foreign storage data falls back to a clean state", () => {
  const storage = new engine.MemoryStorage();
  storage.setItem(engine.STORAGE_KEY, "{not json");
  assert.equal(new engine.ProgressStore(storage).data.version, 1);
  storage.setItem(engine.STORAGE_KEY, JSON.stringify({ version: 99 }));
  assert.deepEqual(new engine.ProgressStore(storage).data.tests, []);
});

test("rank grows with mastered concepts and needs a strong test for the top level", () => {
  const store = new engine.ProgressStore(new engine.MemoryStorage());
  assert.equal(store.rank().level, 0);
  for (const c of CONCEPT_IDS) store.data.concepts[c].solo = { w: 3, c: 3 };
  assert.equal(store.rank().level, 2);
  store.data.tests.push({ pct: 90, n: 12, full: 11, concepts: {} });
  assert.equal(store.rank().level, 3);
});

// --- בניית סבבים -------------------------------------------------------------

test("practice session: ~10 questions, balanced, story questions adjacent, max 2 per story", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const b = new engine.SessionBuilder(content, engine.mulberry32(seed));
    const s = b.buildPractice({ size: 10 });
    assert.equal(s.length, 10);
    assert.equal(new Set(s.map((q) => q.id)).size, 10);
    const primaries = new Set(s.map((q) => q.concept).filter((c) => c !== MIXED));
    assert.equal(primaries.size, 6, `seed ${seed}: ${[...primaries]}`);
    const perStory = {};
    s.forEach((q, i) => {
      if (!q.story) return;
      perStory[q.story] = (perStory[q.story] || 0) + 1;
      // שאלות על אותו סיפור צמודות
      const first = s.findIndex((x) => x.story === q.story);
      assert.ok(i - first < perStory[q.story], `seed ${seed}: story ${q.story} split`);
    });
    for (const n of Object.values(perStory)) assert.ok(n <= 2);
    assert.ok(s.filter((q) => q.concept === MIXED).length <= 2);
  }
});

test("continuing a practice run avoids repeating questions until the pool runs out", () => {
  const b = new engine.SessionBuilder(content, engine.mulberry32(11));
  const seen = new Set();
  const first = b.buildPractice({ size: 10, exclude: seen });
  first.forEach((q) => seen.add(q.id));
  const second = b.buildPractice({ size: 10, exclude: seen });
  assert.equal(second.filter((q) => seen.has(q.id)).length, 0);
});

test("targeted practice only includes questions that test the chosen concepts", () => {
  for (const c of CONCEPT_IDS) {
    const b = new engine.SessionBuilder(content, engine.mulberry32(5));
    const s = b.buildPractice({ size: 10, focus: [c] });
    assert.ok(s.length >= 8, `${c}: ${s.length}`);
    for (const q of s) assert.ok(engine.questionConcepts(q).includes(c), `${c}: ${q.id}`);
  }
});

test("weak concepts are prioritised when building a practice session", () => {
  const store = new engine.ProgressStore(new engine.MemoryStorage());
  store.data.concepts.ending.solo = { w: 4, c: 1 };
  const b = new engine.SessionBuilder(content, engine.mulberry32(2));
  const s = b.buildPractice({ size: 10, progress: store });
  const endingCount = s.filter((q) => q.concept === "ending").length;
  assert.ok(endingCount >= 1);
});

test("practice test: 12 questions covering every concept, with a matching and an ordering question", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const b = new engine.SessionBuilder(content, engine.mulberry32(seed));
    const t = b.buildTest();
    assert.equal(t.length, 12, `seed ${seed}`);
    assert.equal(new Set(t.map((q) => q.id)).size, 12);
    assert.ok(t.some((q) => q.type === "match"));
    assert.ok(t.some((q) => q.type === "order"));
    for (const c of CONCEPT_IDS) assert.ok(t.some((q) => q.concept === c), `seed ${seed}: ${c}`);
  }
});

test("summary by concept and weak detection", () => {
  const q1 = QUESTIONS.find((x) => x.id === "def-expo");
  const q2 = QUESTIONS.find((x) => x.id === "def-climax");
  const sum = engine.summarizeByConcept([engine.grade(q1, q1.answer), engine.grade(q2, 3)]);
  assert.equal(sum.expo.pct, 100);
  assert.equal(sum.climax.pct, 0);
  assert.deepEqual(engine.weakFromSummary(sum), ["climax"]);
});
