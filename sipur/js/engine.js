/*
 * לוגיקה טהורה (ללא DOM): בדיקת תשובות, מודל לוח התאמה/סידור, שמירת התקדמות ובניית סבבים.
 * תבניות: Strategy (GRADERS לפי סוג שאלה), Repository (ProgressStore מעל מתאם אחסון),
 * Builder (SessionBuilder), Model (BoardModel — מצב לוח ההתאמה/הסידור).
 */
(function (root) {
  "use strict";

  const CONCEPT_IDS = ["expo", "conflict", "climax", "resolution", "ending", "characters"];
  const MIXED = "mixed";
  const WEAK_THRESHOLD = 0.7;
  const MASTERY_THRESHOLD = 0.8;

  // ---------------------------------------------------------------------------
  // אקראיות דטרמיניסטית (כדי שאפשר יהיה לבדוק)
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function range(n) {
    return Array.from({ length: n }, (_, i) => i);
  }

  /** ערבוב שאינו משאיר את הסדר המקורי (לשאלות סידור ולמאגר ההתאמה). */
  function derangedPermutation(n, rng) {
    if (n < 2) return range(n);
    for (let tries = 0; tries < 20; tries++) {
      const p = shuffle(range(n), rng);
      if (p.some((v, i) => v !== i)) return p;
    }
    return range(n).reverse();
  }

  // ---------------------------------------------------------------------------
  // בדיקת תשובות — Strategy לפי סוג שאלה
  // כל grader מחזיר { score: 0..1, parts: [{concept, weight, correct}], items: [bool] }
  // ---------------------------------------------------------------------------
  function questionConcepts(q) {
    if (q.concepts && q.concepts.length) return q.concepts.slice();
    if (q.concept !== MIXED) return [q.concept];
    const fromParts = (q.pairs || q.items || []).map((p) => p.concept).filter(Boolean);
    return Array.from(new Set(fromParts));
  }

  function singleAnswer(q, isCorrect) {
    const cs = questionConcepts(q);
    return {
      score: isCorrect ? 1 : 0,
      parts: cs.map((c) => ({ concept: c, weight: 1 / cs.length, correct: isCorrect })),
      items: [isCorrect],
    };
  }

  function slotted(slotConcepts, itemsCorrect) {
    const n = itemsCorrect.length;
    const good = itemsCorrect.filter(Boolean).length;
    return {
      score: n ? good / n : 0,
      parts: itemsCorrect.map((ok, i) => ({ concept: slotConcepts[i], weight: 1 / n, correct: ok })),
      items: itemsCorrect,
    };
  }

  const isInt = (v) => Number.isInteger(v);

  const GRADERS = {
    mcq: {
      isAnswered: (q, r) => isInt(r) && r >= 0 && r < q.options.length,
      grade: (q, r) => singleAnswer(q, r === q.answer),
    },
    pick: {
      isAnswered: (q, r) => isInt(r) && r >= 0,
      grade: (q, r) => singleAnswer(q, r === q.answer),
    },
    // r: מערך באורך מספר השורות; r[i] = אינדקס הצ'יפ שהוצב בשורה i. הצ'יפ הנכון לשורה i הוא i.
    match: {
      isAnswered: (q, r) => Array.isArray(r) && r.length === q.pairs.length && r.every(isInt),
      grade: (q, r) =>
        slotted(
          q.pairs.map((p) => p.concept || q.concept),
          q.pairs.map((_, i) => Array.isArray(r) && r[i] === i),
        ),
    },
    // r: מערך באורך מספר הפריטים; r[k] = אינדקס הפריט שהוצב במקום k. הסדר הנכון: 0,1,2...
    order: {
      isAnswered: (q, r) => Array.isArray(r) && r.length === q.items.length && r.every(isInt),
      grade: (q, r) =>
        slotted(
          q.items.map((it) => it.concept || q.concept),
          q.items.map((_, k) => Array.isArray(r) && r[k] === k),
        ),
    },
    // r: מערך באורך מספר הפריטים; r[i] = אינדקס הקטגוריה שנבחרה לפריט i.
    classify: {
      isAnswered: (q, r) => Array.isArray(r) && r.length === q.items.length && r.every(isInt),
      grade: (q, r) =>
        slotted(
          q.items.map((it) => it.concept || q.concept),
          q.items.map((it, i) => Array.isArray(r) && r[i] === it.answer),
        ),
    },
  };

  function graderFor(q) {
    const g = GRADERS[q.type];
    if (!g) throw new Error("Unknown question type: " + q.type);
    return g;
  }
  const isAnswered = (q, r) => graderFor(q).isAnswered(q, r);
  const grade = (q, r) => graderFor(q).grade(q, r);

  // ---------------------------------------------------------------------------
  // מודל לוח — התאמה וסידור (משותף להקשה ולגרירה)
  // ---------------------------------------------------------------------------
  class BoardModel {
    /**
     * @param {number} nSlots מספר המקומות
     * @param {number[]} chipIds מזהי הצ'יפים לפי סדר התצוגה במאגר
     * @param {{autoPlace?: boolean, slots?: (number|null)[]}} opts
     *   autoPlace — בהקשה על צ'יפ מהמאגר הוא נכנס למקום הפנוי הבא (מתאים לסידור).
     */
    constructor(nSlots, chipIds, opts = {}) {
      this.chipIds = chipIds.slice();
      this.slots = opts.slots && opts.slots.length === nSlots ? opts.slots.slice() : Array(nSlots).fill(null);
      this.autoPlace = !!opts.autoPlace;
      this.selectedChip = null;
      this.selectedSlot = null;
    }
    locate(chip) {
      return this.slots.indexOf(chip);
    }
    pool() {
      return this.chipIds.filter((c) => this.locate(c) === -1);
    }
    isComplete() {
      return this.slots.every((s) => s !== null);
    }
    clearSelection() {
      this.selectedChip = null;
      this.selectedSlot = null;
    }
    /** מציב צ'יפ במקום; אם המקום תפוס — מחליף (הצ'יפ הקודם עובר למקום שממנו הגיע הצ'יפ החדש, או למאגר). */
    place(chip, slot) {
      if (slot < 0 || slot >= this.slots.length) return;
      const from = this.locate(chip);
      if (from === slot) return;
      const occupant = this.slots[slot];
      this.slots[slot] = chip;
      if (from >= 0) this.slots[from] = occupant;
    }
    unplace(chip) {
      const from = this.locate(chip);
      if (from >= 0) this.slots[from] = null;
    }
    tapChip(chip) {
      if (this.selectedSlot !== null) {
        this.place(chip, this.selectedSlot);
        this.clearSelection();
        return;
      }
      if (this.selectedChip === chip) {
        this.selectedChip = null;
        return;
      }
      // צ'יפ נבחר + הקשה על צ'יפ שכבר מוצב = הצבה במקום שלו (החלפה)
      if (this.selectedChip !== null && this.locate(chip) >= 0) {
        this.place(this.selectedChip, this.locate(chip));
        this.clearSelection();
        return;
      }
      if (this.autoPlace && this.selectedChip === null && this.locate(chip) === -1) {
        const empty = this.slots.indexOf(null);
        if (empty >= 0) {
          this.place(chip, empty);
          return;
        }
      }
      this.selectedChip = chip;
    }
    tapSlot(slot) {
      if (this.selectedChip !== null) {
        this.place(this.selectedChip, slot);
        this.clearSelection();
        return;
      }
      this.selectedSlot = this.selectedSlot === slot ? null : slot;
    }
    tapPool() {
      if (this.selectedChip !== null && this.locate(this.selectedChip) >= 0) this.unplace(this.selectedChip);
      this.clearSelection();
    }
    /** גרירה: target הוא מספר מקום או "pool". */
    drop(chip, target) {
      if (target === "pool") this.unplace(chip);
      else if (Number.isInteger(target)) this.place(chip, target);
      this.clearSelection();
    }
    reset() {
      this.slots = this.slots.map(() => null);
      this.clearSelection();
    }
    /** התשובה בפורמט של GRADERS (או null אם הלוח לא מלא). */
    response() {
      return this.isComplete() ? this.slots.slice() : null;
    }
  }

  // ---------------------------------------------------------------------------
  // אחסון — Repository מעל מתאם (localStorage בדפדפן, זיכרון בבדיקות)
  // ---------------------------------------------------------------------------
  class MemoryStorage {
    constructor() {
      this.map = new Map();
    }
    getItem(k) {
      return this.map.has(k) ? this.map.get(k) : null;
    }
    setItem(k, v) {
      this.map.set(k, String(v));
    }
    removeItem(k) {
      this.map.delete(k);
    }
  }

  const STORAGE_KEY = "sipur-jedi-progress-v1";
  const MAX_TESTS = 20;

  function emptyConceptStat() {
    return { w: 0, c: 0 };
  }

  function emptyProgress() {
    const concepts = {};
    for (const id of CONCEPT_IDS) concepts[id] = { solo: emptyConceptStat(), hinted: emptyConceptStat() };
    return { version: 1, concepts, questions: {}, tests: [], learned: {}, practiceAnswered: 0, sessions: 0 };
  }

  class ProgressStore {
    constructor(storage, key = STORAGE_KEY) {
      this.storage = storage;
      this.key = key;
      this.data = this.load();
    }
    load() {
      try {
        const raw = this.storage.getItem(this.key);
        if (!raw) return emptyProgress();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1) return emptyProgress();
        // השלמת שדות חסרים (למשל אחרי שינוי גרסה)
        const base = emptyProgress();
        const merged = Object.assign(base, parsed);
        for (const id of CONCEPT_IDS) {
          if (!merged.concepts[id]) merged.concepts[id] = base.concepts[id];
        }
        return merged;
      } catch (e) {
        return emptyProgress();
      }
    }
    save() {
      try {
        this.storage.setItem(this.key, JSON.stringify(this.data));
        return true;
      } catch (e) {
        return false;
      }
    }
    reset() {
      this.data = emptyProgress();
      try {
        this.storage.removeItem(this.key);
      } catch (e) {
        /* אין מה לעשות */
      }
    }
    markLearned(conceptId) {
      if (!this.data.learned[conceptId]) {
        this.data.learned[conceptId] = true;
        this.save();
      }
    }
    noteSessionStarted() {
      this.data.sessions += 1;
      this.save();
    }
    /** תרגול: תשובות עם רמז נשמרות בנפרד ואינן נספרות בדיוק „בלי רמז”. */
    recordPractice(q, result, hinted) {
      const bucket = hinted ? "hinted" : "solo";
      for (const p of result.parts) {
        if (!this.data.concepts[p.concept]) continue;
        const s = this.data.concepts[p.concept][bucket];
        s.w += p.weight;
        if (p.correct) s.c += p.weight;
      }
      const qs = this.data.questions[q.id] || { n: 0, ok: 0, last: null };
      qs.n += 1;
      if (result.score === 1) qs.ok += 1;
      qs.last = result.score === 1 ? 1 : 0;
      this.data.questions[q.id] = qs;
      this.data.practiceAnswered += 1;
      this.save();
    }
    /** מבחן: נשמר בנפרד לגמרי מהתרגול. */
    recordTest(entries, when) {
      const concepts = {};
      let total = 0;
      for (const { result } of entries) {
        total += result.score;
        for (const p of result.parts) {
          concepts[p.concept] = concepts[p.concept] || emptyConceptStat();
          concepts[p.concept].w += p.weight;
          if (p.correct) concepts[p.concept].c += p.weight;
        }
      }
      const rec = {
        at: when || new Date().toISOString(),
        n: entries.length,
        full: entries.filter((e) => e.result.score === 1).length,
        pct: entries.length ? Math.round((total / entries.length) * 100) : 0,
        concepts,
      };
      this.data.tests.push(rec);
      if (this.data.tests.length > MAX_TESTS) this.data.tests = this.data.tests.slice(-MAX_TESTS);
      this.save();
      return rec;
    }
    lastTest() {
      return this.data.tests.length ? this.data.tests[this.data.tests.length - 1] : null;
    }
    questionStat(id) {
      return this.data.questions[id] || null;
    }
    /** סטטיסטיקה לכל מושג: תרגול בלי רמז, תרגול עם רמז, מבחן אחרון, ושליטה משוקללת. */
    conceptStats() {
      const last = this.lastTest();
      const out = {};
      for (const id of CONCEPT_IDS) {
        const { solo, hinted } = this.data.concepts[id];
        const practice = solo.w > 0 ? solo.c / solo.w : null;
        const t = last && last.concepts[id] && last.concepts[id].w > 0 ? last.concepts[id] : null;
        const test = t ? t.c / t.w : null;
        let mastery = null;
        if (practice !== null && test !== null) mastery = (practice + test) / 2;
        else if (practice !== null) mastery = practice;
        else if (test !== null) mastery = test;
        const evidence = solo.w >= 2 || !!t;
        out[id] = { practice, practiceWeight: solo.w, hintedWeight: hinted.w, test, mastery, evidence };
      }
      return out;
    }
    weakConcepts() {
      const stats = this.conceptStats();
      return CONCEPT_IDS.filter((id) => {
        const s = stats[id];
        return (s.practice !== null && s.practice < WEAK_THRESHOLD) || (s.test !== null && s.test < WEAK_THRESHOLD);
      });
    }
    untriedConcepts() {
      const stats = this.conceptStats();
      return CONCEPT_IDS.filter((id) => stats[id].mastery === null);
    }
    rank() {
      const stats = this.conceptStats();
      const mastered = CONCEPT_IDS.filter((id) => stats[id].evidence && stats[id].mastery >= MASTERY_THRESHOLD).length;
      const bestTest = this.data.tests.reduce((m, t) => Math.max(m, t.pct), 0);
      let level;
      if (mastered === CONCEPT_IDS.length && bestTest >= 80) level = 3;
      else if (mastered >= 3) level = 2;
      else if (mastered >= 1) level = 1;
      else level = 0;
      return { level, mastered, total: CONCEPT_IDS.length, bestTest };
    }
  }

  // ---------------------------------------------------------------------------
  // בניית סבבים — Builder
  // ---------------------------------------------------------------------------
  class SessionBuilder {
    constructor(content, rng) {
      this.content = content;
      this.rng = rng || Math.random;
    }

    /** האם השאלה רלוונטית לאחד המושגים שנבחרו */
    touches(q, focus) {
      if (!focus || !focus.length) return true;
      return questionConcepts(q).some((c) => focus.includes(c));
    }

    priority(q, progress) {
      const st = progress ? progress.questionStat(q.id) : null;
      let p = this.rng();
      if (!st) p += 1.5;
      else if (st.last === 0) p += 2;
      else if (st.ok >= 2) p -= 0.5;
      return p;
    }

    /**
     * בחירה מאוזנת: מעבר סבבי בין „דליים” (מושג מרכזי / mixed), עם הגבלה על מספר השאלות מכל סיפור.
     */
    pickBalanced({ pool, size, bucketOrder, storyCap, progress, caps = {} }) {
      const buckets = new Map(bucketOrder.map((b) => [b, []]));
      for (const q of pool) {
        const key = buckets.has(q.concept) ? q.concept : null;
        if (key) buckets.get(key).push({ q, p: this.priority(q, progress) });
      }
      for (const list of buckets.values()) list.sort((a, b) => b.p - a.p);
      const chosen = [];
      const perStory = new Map();
      const perBucket = new Map();
      // סבב ראשון מכבד את המכסות (למשל מעט שאלות mixed); השני משלים אם חסר.
      for (const useCaps of [true, false]) {
        let progressMade = true;
        while (chosen.length < size && progressMade) {
          progressMade = false;
          for (const b of bucketOrder) {
            if (chosen.length >= size) break;
            if (useCaps && caps[b] !== undefined && (perBucket.get(b) || 0) >= caps[b]) continue;
            const list = buckets.get(b);
            const idx = list.findIndex(({ q }) => !q.story || (perStory.get(q.story) || 0) < storyCap);
            if (idx === -1) continue;
            const [{ q }] = list.splice(idx, 1);
            chosen.push(q);
            perBucket.set(b, (perBucket.get(b) || 0) + 1);
            if (q.story) perStory.set(q.story, (perStory.get(q.story) || 0) + 1);
            progressMade = true;
          }
        }
      }
      return chosen;
    }

    /** שאלות על אותו סיפור יופיעו ברצף ובסדר המקורי; היחידות עצמן מעורבבות. */
    groupByStory(questions) {
      const order = new Map(this.content.QUESTIONS.map((q, i) => [q.id, i]));
      const units = [];
      const byStory = new Map();
      for (const q of questions) {
        if (q.story) {
          if (!byStory.has(q.story)) {
            const unit = [];
            byStory.set(q.story, unit);
            units.push(unit);
          }
          byStory.get(q.story).push(q);
        } else units.push([q]);
      }
      for (const u of units) u.sort((a, b) => order.get(a.id) - order.get(b.id));
      return shuffle(units, this.rng).flat();
    }

    /**
     * סבב תרגול.
     * @param {{size?:number, focus?:string[]|null, exclude?:Set<string>, progress?:ProgressStore}} opts
     */
    buildPractice({ size = 10, focus = null, exclude = new Set(), progress = null } = {}) {
      const all = this.content.QUESTIONS.filter((q) => this.touches(q, focus));
      let pool = all.filter((q) => !exclude.has(q.id));
      if (pool.length < size) {
        // השאלות החדשות נגמרו — משלימים משאלות שכבר הופיעו.
        const fill = all.filter((q) => exclude.has(q.id));
        pool = pool.concat(fill);
      }
      const focusList = focus && focus.length ? focus.filter((c) => CONCEPT_IDS.includes(c)) : CONCEPT_IDS;
      // מושגים חלשים קודם, אחר כך השאר; mixed נכנס כדלי נוסף.
      const weak = progress ? progress.weakConcepts().filter((c) => focusList.includes(c)) : [];
      const rest = shuffle(
        focusList.filter((c) => !weak.includes(c)),
        this.rng,
      );
      const bucketOrder = weak.concat(rest);
      bucketOrder.splice(Math.min(3, bucketOrder.length), 0, MIXED);
      // בתרגול ממוקד: שאלות שה„מושג המרכזי” שלהן אחר אבל הן נוגעות במושג — נכנסות לדלי של המושג הממוקד.
      const normalized = pool.map((q) => {
        if (q.concept === MIXED || focusList.includes(q.concept)) return q;
        const hit = questionConcepts(q).find((c) => focusList.includes(c));
        return hit ? Object.assign(Object.create(q), { concept: hit, id: q.id }) : q;
      });
      const caps = { [MIXED]: focus && focus.length ? 1 : 2 };
      const picked = this.pickBalanced({ pool: normalized, size, bucketOrder, storyCap: 2, progress, caps });
      const originals = picked.map((q) => this.content.QUESTIONS.find((o) => o.id === q.id));
      return this.groupByStory(originals);
    }

    /** מבחן תרגול: 12 שאלות — שאלת התאמה, שאלת סידור, ולפחות שאלה אחת לכל מושג. */
    buildTest({ size = 12 } = {}) {
      const qs = this.content.QUESTIONS;
      const matches = shuffle(
        qs.filter((q) => q.type === "match"),
        this.rng,
      );
      const orders = shuffle(
        qs.filter((q) => q.type === "order"),
        this.rng,
      );
      const chosen = [matches[0], orders[0]].filter(Boolean);
      const used = new Set(chosen.map((q) => q.id));
      const perStory = new Map();
      for (const q of chosen) if (q.story) perStory.set(q.story, (perStory.get(q.story) || 0) + 1);
      const remaining = size - chosen.length;
      const conceptOrder = shuffle(CONCEPT_IDS, this.rng);
      const targets = conceptOrder.map((c, i) => ({ c, n: 1 + (i < remaining - CONCEPT_IDS.length ? 1 : 0) }));
      for (const { c, n } of targets) {
        const candidates = shuffle(
          qs.filter((q) => q.concept === c && !used.has(q.id) && q.type !== "match" && q.type !== "order"),
          this.rng,
        );
        let got = 0;
        for (const q of candidates) {
          if (got >= n) break;
          if (q.story && (perStory.get(q.story) || 0) >= 2) continue;
          chosen.push(q);
          used.add(q.id);
          if (q.story) perStory.set(q.story, (perStory.get(q.story) || 0) + 1);
          got++;
        }
      }
      return this.groupByStory(chosen);
    }
  }

  // ---------------------------------------------------------------------------
  // סיכום תוצאות לפי מושג (לסבב תרגול או למבחן)
  // ---------------------------------------------------------------------------
  function summarizeByConcept(results) {
    const out = {};
    for (const r of results) {
      if (!r) continue;
      for (const p of r.parts) {
        out[p.concept] = out[p.concept] || { w: 0, c: 0 };
        out[p.concept].w += p.weight;
        if (p.correct) out[p.concept].c += p.weight;
      }
    }
    for (const k of Object.keys(out)) out[k].pct = out[k].w ? Math.round((out[k].c / out[k].w) * 100) : 0;
    return out;
  }

  function weakFromSummary(summary) {
    return CONCEPT_IDS.filter((c) => summary[c] && summary[c].w > 0 && summary[c].c / summary[c].w < WEAK_THRESHOLD);
  }

  const engine = {
    CONCEPT_IDS,
    MIXED,
    WEAK_THRESHOLD,
    MASTERY_THRESHOLD,
    STORAGE_KEY,
    mulberry32,
    shuffle,
    derangedPermutation,
    questionConcepts,
    GRADERS,
    isAnswered,
    grade,
    BoardModel,
    MemoryStorage,
    ProgressStore,
    SessionBuilder,
    summarizeByConcept,
    weakFromSummary,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = engine;
  } else {
    root.Sipur = root.Sipur || {};
    root.Sipur.engine = engine;
  }
})(typeof window !== "undefined" ? window : globalThis);
