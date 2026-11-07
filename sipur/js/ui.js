/*
 * ממשק המשתמש: נתב (hash), מסכים ורכיבי שאלה.
 * תבניות: Front Controller (App.route), Strategy (WIDGETS — רכיב תצוגה לכל סוג שאלה),
 * Facade (App מרכז את ההתקדמות, הסבבים והניווט).
 */
(function (root) {
  "use strict";

  const S = root.Sipur;
  const C = S.content;
  const E = S.engine;

  const conceptById = new Map(C.CONCEPTS.map((c) => [c.id, c]));
  const storyById = new Map(C.STORIES.map((s) => [s.id, s]));
  const LETTERS = ["א", "ב", "ג", "ד", "ה"];
  const TYPE_LABELS = { mcq: "שאלת בחירה", pick: "זיהוי בסיפור", match: "התאמה", order: "סידור", classify: "מיון" };
  const SW_LABEL = "סיפור תרגול מומצא בהשראת מלחמת הכוכבים — לא סצנה מהסרטים";
  const PLAIN_LABEL = "סיפור קצר לתרגול";
  const PRACTICE_SIZE = 10;

  const RANKS = [
    { name: "חניך/ה", hint: "כשתגיעו ל־80% ומעלה במושג אחד (בתרגול בלי רמז או במבחן) — תהפכו לפדאוואן." },
    { name: "פדאוואן", hint: "שלטו בשלושה מושגים כדי להפוך לאבירי ג'דיי." },
    { name: "אביר/ת ג'דיי", hint: "שלטו בכל ששת המושגים, והשיגו 80% ומעלה במבחן תרגול — כדי להגיע לדרגת מאסטר." },
    { name: "מאסטר/ית ג'דיי", hint: "שליטה מלאה בכל המושגים. המשיכו לתרגל כדי לשמור על הכושר." },
  ];

  // ---------------------------------------------------------------------------
  // עזר DOM
  // ---------------------------------------------------------------------------
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "style" && typeof v === "object") {
          // משתני CSS (--x) חייבים setProperty; השמה רגילה מתעלמת מהם בשקט.
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith("--")) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        }
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "disabled" || k === "open" || k === "checked") el[k] = !!v;
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    appendKids(el, children);
    return el;
  }
  function appendKids(el, kids) {
    for (const k of kids) {
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) appendKids(el, k);
      else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }

  function hashCode(str) {
    let x = 0;
    for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(x);
  }

  function pct(x) {
    return Math.round(x * 100);
  }

  function saberBar(value, color, label) {
    const has = value !== null && value !== undefined;
    const p = has ? Math.max(0, Math.min(100, pct(value))) : 0;
    return h(
      "div",
      {
        class: "saber" + (has ? "" : " empty"),
        style: { "--pct": p + "%", "--blade": color || "var(--saber)" },
        role: "img",
        "aria-label": label || (has ? `${p}%` : "אין עדיין נתונים"),
      },
      h("span", { class: "hilt" }),
      h("span", { class: "track" }, h("span", { class: "blade" })),
    );
  }

  function conceptTag(id, asLink) {
    const c = conceptById.get(id);
    if (!c) return null;
    return h(asLink ? "a" : "span", { class: "concept-tag", href: asLink ? `#/learn/${id}` : null, style: { "--c": c.color } }, c.name);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  // ---------------------------------------------------------------------------
  // גרירה (עכבר: מיד; מגע: לחיצה ארוכה) — ההקשה נשארת הדרך הראשית
  // ---------------------------------------------------------------------------
  const DragController = (() => {
    let active = null;
    let justDragged = false;

    document.addEventListener(
      "touchmove",
      (e) => {
        if (active && active.dragging) e.preventDefault();
      },
      { passive: false },
    );

    function dropTargetAt(x, y) {
      const el = document.elementFromPoint(x, y);
      return el ? el.closest("[data-drop]") : null;
    }
    function setHover(el) {
      if (active.over === el) return;
      if (active.over) active.over.classList.remove("drop-hover");
      active.over = el;
      if (el) el.classList.add("drop-hover");
    }
    function moveGhost(x, y) {
      active.ghost.style.left = x + "px";
      active.ghost.style.top = y + "px";
    }
    function begin(x, y) {
      active.dragging = true;
      const g = active.chip.cloneNode(true);
      g.classList.add("chip-ghost");
      g.removeAttribute("data-chip");
      g.removeAttribute("data-fk");
      g.setAttribute("aria-hidden", "true");
      g.style.width = active.chip.offsetWidth + "px";
      document.body.append(g);
      active.ghost = g;
      active.chip.classList.add("dragging-src");
      active.lastX = x;
      active.lastY = y;
      moveGhost(x, y);
      active.raf = requestAnimationFrame(autoScroll);
    }
    // גלילה אוטומטית כשגוררים ליד קצה המסך, כדי להגיע למקומות שמחוץ לתצוגה
    function autoScroll() {
      if (!active || !active.dragging) return;
      const edge = 70;
      const vh = window.innerHeight;
      let dy = 0;
      if (active.lastY < edge) dy = -Math.ceil((edge - active.lastY) / 6);
      else if (active.lastY > vh - edge) dy = Math.ceil((active.lastY - (vh - edge)) / 6);
      if (dy) {
        window.scrollBy(0, dy);
        setHover(dropTargetAt(active.lastX, active.lastY));
      }
      active.raf = requestAnimationFrame(autoScroll);
    }
    function cleanup() {
      if (!active) return;
      clearTimeout(active.timer);
      if (active.raf) cancelAnimationFrame(active.raf);
      if (active.ghost) active.ghost.remove();
      if (active.over) active.over.classList.remove("drop-hover");
      if (active.chip) active.chip.classList.remove("dragging-src");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      active = null;
    }
    function onMove(e) {
      if (!active || e.pointerId !== active.pid) return;
      const dist = Math.hypot(e.clientX - active.x0, e.clientY - active.y0);
      if (!active.dragging) {
        if (active.touch) {
          if (dist > 10) cleanup(); // תנועה לפני לחיצה ארוכה = גלילה
        } else if (dist > 6) begin(e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      active.lastX = e.clientX;
      active.lastY = e.clientY;
      moveGhost(e.clientX, e.clientY);
      setHover(dropTargetAt(e.clientX, e.clientY));
    }
    function onUp(e) {
      if (!active || e.pointerId !== active.pid) return;
      if (active.dragging) {
        const target = dropTargetAt(e.clientX, e.clientY);
        const { id, onDrop } = active;
        justDragged = true;
        setTimeout(() => (justDragged = false), 0);
        cleanup();
        if (target) onDrop(id, target.dataset.drop === "pool" ? "pool" : Number(target.dataset.drop));
        return;
      }
      cleanup();
    }
    function onCancel() {
      cleanup();
    }

    return {
      attach(rootEl, onDrop) {
        rootEl.addEventListener("contextmenu", (e) => {
          if (e.target.closest("[data-chip]")) e.preventDefault();
        });
        rootEl.addEventListener("pointerdown", (e) => {
          const chip = e.target.closest("[data-chip]");
          if (!chip || chip.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
          cleanup();
          active = {
            chip,
            id: Number(chip.dataset.chip),
            x0: e.clientX,
            y0: e.clientY,
            pid: e.pointerId,
            touch: e.pointerType === "touch",
            dragging: false,
            ghost: null,
            over: null,
            onDrop,
            timer: null,
          };
          if (active.touch) {
            const x = e.clientX;
            const y = e.clientY;
            active.timer = setTimeout(() => active && begin(x, y), 350);
          }
          window.addEventListener("pointermove", onMove, { passive: false });
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onCancel);
        });
      },
      consumeClick() {
        return justDragged;
      },
    };
  })();

  // ---------------------------------------------------------------------------
  // סיפור
  // ---------------------------------------------------------------------------
  function storyUnit(story) {
    return story.unit || "פסקה";
  }

  function renderStory(story, opts = {}) {
    const { pick, collapsible, item } = opts;
    const body = h("div", { class: "story-body" });
    story.paragraphs.forEach((text, i) => {
      const num = h("span", { class: "num", "aria-hidden": "true" }, i + 1);
      if (!pick) {
        body.append(h("p", { class: "para" }, num, h("span", null, text)));
        return;
      }
      const { item: pItem, ctx } = pick;
      const chosen = pItem.response === i;
      let cls = "para";
      let mark = null;
      if (ctx.showResult) {
        if (i === pItem.q.answer) {
          cls += " is-correct";
          mark = h("span", { class: "mark good" }, chosen ? " ✓ נכון" : " ✓ התשובה הנכונה");
        } else if (chosen) {
          cls += " is-wrong";
          mark = h("span", { class: "mark bad" }, " ✗ הבחירה שלכם");
        }
      }
      body.append(
        h(
          "button",
          {
            type: "button",
            class: cls,
            role: "radio",
            "aria-checked": String(chosen),
            "aria-label": `${storyUnit(story)} ${i + 1}: ${text}`,
            "data-fk": "para-" + i,
            disabled: !ctx.interactive,
            onclick: () => {
              pItem.response = i;
              ctx.onChange();
            },
          },
          num,
          h("span", null, text, mark),
        ),
      );
    });
    if (pick) body.setAttribute("role", "radiogroup");

    const head = h(
      "div",
      { class: "story-head" },
      h("div", { class: "story-title" }, story.title),
      h("span", { class: "story-label" + (story.theme === "sw" ? " sw" : "") }, story.theme === "sw" ? SW_LABEL : PLAIN_LABEL),
    );
    if (collapsible) {
      const det = h(
        "details",
        { open: item ? item.storyOpen !== false : true },
        h("summary", null, "הסיפור (אפשר להסתיר/להציג)"),
        body,
      );
      if (item) det.addEventListener("toggle", () => (item.storyOpen = det.open));
      return h("section", { class: "story", "aria-label": `הסיפור: ${story.title}` }, head, det);
    }
    return h("section", { class: "story", "aria-label": `הסיפור: ${story.title}` }, head, body);
  }

  // ---------------------------------------------------------------------------
  // רכיבי תשובה — Strategy לפי סוג שאלה
  // ctx: { interactive, showResult, onChange }
  // ---------------------------------------------------------------------------
  function ensureBoard(item) {
    const q = item.q;
    if (!item.board) {
      const n = q.type === "match" ? q.pairs.length : q.items.length;
      item.board = new E.BoardModel(n, item.perm, {
        autoPlace: q.type === "order",
        slots: Array.isArray(item.response) ? item.response : null,
      });
    }
    return item.board;
  }
  function chipText(q, id) {
    return q.type === "match" ? q.pairs[id].answer : q.items[id].text;
  }

  const WIDGETS = {
    mcq(item, ctx) {
      const q = item.q;
      const group = h("div", { class: "options", role: "radiogroup", "aria-label": "אפשרויות תשובה" });
      item.perm.forEach((oi, di) => {
        const chosen = item.response === oi;
        let cls = "option";
        let mark = null;
        if (ctx.showResult) {
          if (oi === q.answer) {
            cls += " is-correct";
            mark = h("span", { class: "mark good" }, chosen ? "✓ נכון" : "✓ התשובה הנכונה");
          } else if (chosen) {
            cls += " is-wrong";
            mark = h("span", { class: "mark bad" }, "✗ הבחירה שלכם");
          }
        }
        group.append(
          h(
            "button",
            {
              type: "button",
              class: cls,
              role: "radio",
              "aria-checked": String(chosen),
              "data-fk": "opt-" + oi,
              disabled: !ctx.interactive,
              onclick: () => {
                item.response = oi;
                ctx.onChange();
              },
            },
            h("span", { class: "letter", "aria-hidden": "true" }, LETTERS[di]),
            h("span", { class: "otext" }, q.options[oi]),
            mark,
          ),
        );
      });
      return group;
    },

    pick(item, ctx) {
      const story = storyById.get(item.q.story);
      return h(
        "div",
        null,
        ctx.interactive ? h("p", { class: "qhelp" }, `הקישו על ה${storyUnit(story)} שבחרתם. אפשר לשנות בחירה עד שבודקים.`) : null,
        renderStory(story, { pick: { item, ctx } }),
      );
    },

    match(item, ctx) {
      return renderBoard(item, ctx);
    },
    order(item, ctx) {
      return renderBoard(item, ctx);
    },

    classify(item, ctx) {
      const q = item.q;
      if (!Array.isArray(item.response)) item.response = q.items.map(() => null);
      const wrap = h("div", { class: "classify" });
      q.items.forEach((it, i) => {
        const chosen = item.response[i];
        let cls = "classify-item";
        if (ctx.showResult) cls += chosen === it.answer ? " is-correct" : " is-wrong";
        const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": `סיווג פריט ${i + 1}` });
        q.categories.forEach((cat, ci) => {
          seg.append(
            h(
              "button",
              {
                type: "button",
                role: "radio",
                "aria-checked": String(chosen === ci),
                "data-fk": `cls-${i}-${ci}`,
                disabled: !ctx.interactive,
                onclick: () => {
                  item.response[i] = ci;
                  ctx.onChange();
                },
              },
              cat,
            ),
          );
        });
        let res = null;
        if (ctx.showResult) {
          const ok = chosen === it.answer;
          res = h(
            "div",
            { class: "small", style: { marginTop: "8px" } },
            h("span", { class: "mark " + (ok ? "good" : "bad") }, ok ? "✓ נכון. " : `✗ התשובה הנכונה: ${q.categories[it.answer]}. `),
            it.why,
          );
        }
        wrap.append(h("div", { class: cls }, h("div", { class: "text" }, it.text), seg, res));
      });
      return wrap;
    },
  };

  function renderBoard(item, ctx) {
    const q = item.q;
    const isOrder = q.type === "order";
    const board = ensureBoard(item);
    const update = () => {
      item.response = board.slots.slice();
      ctx.onChange();
    };
    const hasSel = board.selectedChip !== null || board.selectedSlot !== null;
    const root = h("div", { class: `board ${q.type}${hasSel ? " has-selection" : ""}` });

    const chipBtn = (id, slotIdx) =>
      h(
        "button",
        {
          type: "button",
          class: "chip" + (isOrder ? " long" : ""),
          "data-chip": ctx.interactive ? id : null,
          "data-fk": "chip-" + id,
          "aria-pressed": ctx.interactive ? String(board.selectedChip === id) : null,
          "aria-label": slotIdx === undefined ? chipText(q, id) : `${chipText(q, id)} (במקום ${slotIdx + 1})`,
          disabled: !ctx.interactive,
          onclick: () => {
            if (DragController.consumeClick()) return;
            board.tapChip(id);
            update();
          },
        },
        chipText(q, id),
      );

    if (ctx.interactive) {
      root.append(
        h(
          "p",
          { class: "qhelp" },
          isOrder
            ? "הקישו על האירועים לפי הסדר — כל הקשה מכניסה אירוע למקום הפנוי הבא. לתיקון: הקישו על אירוע שכבר הוצב ואז על מקום אחר, או על המאגר כדי להחזיר אותו."
            : "הקישו על פריט מהמאגר ואז על המקום המתאים לו (או קודם על המקום ואז על הפריט). לתיקון: הקישו על פריט שהוצב ואז על מקום אחר, או על המאגר כדי להחזיר אותו.",
          " אפשר גם לגרור (בטלפון: לחיצה ארוכה על פריט ואז גרירה).",
        ),
      );
      const poolIds = board.pool();
      const pool = h(
        "div",
        {
          class: "board-pool" + (!isOrder ? " sticky" : "") + (poolIds.length ? "" : " empty-pool"),
          "data-drop": "pool",
          role: "group",
          "aria-label": "מאגר הפריטים",
          onclick: (e) => {
            if (e.target.closest("[data-chip]")) return;
            board.tapPool();
            update();
          },
        },
        h("div", { class: "pool-title" }, isOrder ? "אירועים לסידור" : "מאגר"),
        poolIds.map((id) => chipBtn(id)),
      );
      root.append(pool);
    }

    const list = h("ol", { class: "slots" });
    board.slots.forEach((chip, i) => {
      const label = isOrder
        ? h("span", { class: "slot-num", "aria-hidden": "true" }, i + 1)
        : h("div", { class: "slot-label" }, q.pairs[i].prompt);
      const slotEl = h("div", { class: "slot" + (chip !== null ? " filled" : ""), "data-drop": ctx.interactive ? i : null });
      if (chip !== null) slotEl.append(chipBtn(chip, i));
      else if (ctx.interactive)
        slotEl.append(
          h(
            "button",
            {
              type: "button",
              class: "slot-empty",
              "aria-pressed": String(board.selectedSlot === i),
              "aria-label": isOrder ? `מקום ${i + 1} — ריק` : `מקום ריק עבור: ${q.pairs[i].prompt}`,
              "data-fk": "slot-" + i,
              onclick: () => {
                board.tapSlot(i);
                update();
              },
            },
            board.selectedChip !== null ? "הציבו כאן" : "ריק — הקישו לבחירה",
          ),
        );
      else slotEl.append(h("span", { class: "muted small", style: { padding: "8px" } }, "לא נבחרה תשובה"));

      let fix = null;
      if (ctx.showResult) {
        const ok = chip === i;
        slotEl.classList.add(ok ? "is-correct" : "is-wrong");
        fix = h(
          "div",
          { class: "slot-fix" },
          h("span", { class: "mark " + (ok ? "good" : "bad") }, ok ? "✓ נכון" : "✗ "),
          ok ? null : isOrder ? "לא במקום הנכון" : `התשובה הנכונה: ${q.pairs[i].answer}`,
        );
      }
      list.append(h("li", { class: "slot-row" }, label, h("div", null, slotEl, fix)));
    });
    root.append(list);

    if (ctx.interactive && board.slots.some((s) => s !== null)) {
      root.append(
        h(
          "div",
          { class: "row end", style: { marginTop: "10px" } },
          h(
            "button",
            {
              type: "button",
              class: "linkbtn",
              "data-fk": "board-reset",
              onclick: () => {
                board.reset();
                update();
              },
            },
            "ניקוי הלוח",
          ),
        ),
      );
    }
    if (ctx.interactive) DragController.attach(root, (id, target) => {
      board.drop(id, target);
      update();
    });
    return root;
  }

  /** גוף השאלה: ניסוח, סיפור (אם יש) ורכיב התשובה. */
  function renderQuestionBody(item, ctx, opts = {}) {
    const q = item.q;
    const parts = [];
    if (q.type === "order" && q.title) {
      parts.push(
        h(
          "div",
          { class: "story-head" },
          h("div", { class: "story-title" }, q.title),
          h("span", { class: "story-label" + (q.theme === "sw" ? " sw" : "") }, q.theme === "sw" ? SW_LABEL : PLAIN_LABEL),
        ),
      );
    }
    parts.push(h(opts.headingTag || "h2", { class: "qprompt", id: "qprompt" }, q.prompt));
    if (q.story && q.type !== "pick") parts.push(renderStory(storyById.get(q.story), { collapsible: true, item }));
    parts.push(WIDGETS[q.type](item, ctx));
    return h("div", { class: "qbody" }, parts);
  }

  function verdictFor(item) {
    const r = item.result;
    if (r.score === 1) {
      const options = ["נכון! 🎯", "בדיוק!", "פגיעה מדויקת!", "מצוין — תשובה נכונה!"];
      return { kind: "good", text: options[hashCode(item.q.id) % options.length] };
    }
    if (!E.isAnswered(item.q, item.response) && (item.response === null || item.response === undefined)) {
      return { kind: "bad", text: "לא נבחרה תשובה" };
    }
    if (r.score > 0) return { kind: "partial", text: "חלק מהתשובה נכון — הנה מה שכדאי לתקן" };
    return { kind: "bad", text: "לא בדיוק — בואו נבין למה" };
  }

  function correctAnswerText(q) {
    if (q.type === "mcq") return q.options[q.answer];
    if (q.type === "pick") {
      const st = storyById.get(q.story);
      return `${storyUnit(st)} ${q.answer + 1}`;
    }
    return null;
  }

  function renderFeedback(item, opts = {}) {
    const q = item.q;
    const r = item.result;
    const v = verdictFor(item);
    const blocks = [];
    if ((q.type === "mcq" || q.type === "pick") && r.score < 1 && Number.isInteger(item.response)) {
      const why =
        (q.wrong && q.wrong[item.response]) ||
        "התשובה שבחרתם לא מתאימה כאן. קראו את ההסבר כדי לראות מה מבדיל בין האפשרויות.";
      blocks.push(h("div", { class: "block" }, h("span", { class: "label" }, "למה הבחירה הזאת לא מתאימה:"), why));
    }
    if ((q.type === "mcq" || q.type === "pick") && r.score < 1) {
      blocks.push(h("div", { class: "block" }, h("span", { class: "label" }, "התשובה הנכונה:"), correctAnswerText(q)));
    }
    if (q.type === "match" || q.type === "order" || q.type === "classify") {
      const good = r.items.filter(Boolean).length;
      if (r.score < 1)
        blocks.push(h("div", { class: "block" }, `${good} מתוך ${r.items.length} במקום הנכון. הסימונים למעלה מראים מה לתקן.`));
      if (q.type === "order" && r.score < 1) {
        blocks.push(
          h(
            "div",
            { class: "block" },
            h("span", { class: "label" }, "הסדר הנכון:"),
            h(
              "ol",
              { class: "correct-order" },
              q.items.map((it) => h("li", null, it.text, " ", conceptTag(it.concept))),
            ),
          ),
        );
      }
    }
    blocks.push(h("div", { class: "block" }, h("span", { class: "label" }, "הסבר:"), q.explain));
    if (opts.hinted) {
      blocks.push(
        h("p", { class: "small muted block" }, "נעזרתם ברמז, ולכן התשובה נשמרת בנפרד ולא נספרת בציון „בלי רמז”. זה בסדר גמור — ככה לומדים."),
      );
    }
    const cs = E.questionConcepts(q);
    blocks.push(h("div", { class: "chips-inline" }, h("span", { class: "small muted" }, "לחזרה על המושג:"), cs.map((c) => conceptTag(c, true))));
    return h(
      "section",
      { class: "feedback " + v.kind, "aria-label": "משוב" },
      h("div", { class: "verdict", tabindex: "-1", id: "verdict" }, v.text),
      blocks,
    );
  }

  // ---------------------------------------------------------------------------
  // האפליקציה
  // ---------------------------------------------------------------------------
  class App {
    constructor({ progress, persistent, rng }) {
      this.progress = progress;
      this.persistent = persistent;
      this.rng = rng || Math.random;
      this.builder = new E.SessionBuilder(C, this.rng);
      this.practice = null;
      this.test = null;
      this.testReview = null;
      this.focusDraft = new Set();
      this.confirmReset = false;
      this.main = document.getElementById("main");
      this.toastEl = document.getElementById("toast");
      this.live = document.getElementById("sr-live");
    }

    start() {
      window.addEventListener("hashchange", () => this.route());
      this.route();
    }

    go(path) {
      if (location.hash === "#" + path) this.route();
      else location.hash = path;
    }

    path() {
      return (location.hash || "#/").slice(1) || "/";
    }

    route(opts = {}) {
      const p = this.path();
      const routes = [
        [/^\/?$/, () => this.viewHome()],
        [/^\/learn\/?$/, () => this.viewLearn()],
        [/^\/learn\/([a-z]+)$/, (m) => this.viewConcept(m[1])],
        [/^\/practice\/?$/, () => this.viewPracticeSetup()],
        [/^\/practice\/run$/, () => this.viewPracticeRun()],
        [/^\/practice\/summary$/, () => this.viewPracticeSummary()],
        [/^\/test\/?$/, () => this.viewTestIntro()],
        [/^\/test\/run$/, () => this.viewTestRun()],
        [/^\/test\/results$/, () => this.viewTestResults()],
        [/^\/about$/, () => this.viewAbout()],
      ];
      let view = null;
      for (const [re, fn] of routes) {
        const m = p.match(re);
        if (m) {
          view = fn(m);
          break;
        }
      }
      if (!view) view = this.viewHome();
      this.mount(view, opts);
    }

    /** רינדור מחדש של המסך הנוכחי בלי לאבד גלילה ופוקוס (אחרי בחירת תשובה וכד'). */
    refresh() {
      this.route({ preserve: true });
    }

    mount(view, { preserve } = {}) {
      const y = window.scrollY;
      const fk = document.activeElement && document.activeElement.getAttribute("data-fk");
      this.main.replaceChildren(view);
      const section = this.path().split("/")[1] || "home";
      document.querySelectorAll("[data-nav]").forEach((a) => {
        if (a.dataset.nav === section) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      if (preserve) {
        window.scrollTo(0, y);
        if (fk) {
          const el = this.main.querySelector(`[data-fk="${fk}"]`);
          if (el && !el.disabled) el.focus({ preventScroll: true });
        }
      } else {
        window.scrollTo(0, 0);
        const h1 = this.main.querySelector("h1");
        if (h1) {
          h1.setAttribute("tabindex", "-1");
          h1.focus({ preventScroll: true });
        }
      }
    }

    toast(msg) {
      this.toastEl.textContent = msg;
      this.toastEl.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastEl.classList.remove("show"), 2600);
    }

    announce(msg) {
      this.live.textContent = "";
      setTimeout(() => (this.live.textContent = msg), 30);
    }

    // ----- סבבים -----
    newItem(q) {
      let perm = null;
      if (q.type === "mcq") perm = E.shuffle(
        q.options.map((_, i) => i),
        this.rng,
      );
      if (q.type === "match") perm = E.derangedPermutation(q.pairs.length, this.rng);
      if (q.type === "order") perm = E.derangedPermutation(q.items.length, this.rng);
      return { q, perm, response: null, hinted: false, hintOpen: false, checked: false, result: null, board: null, storyOpen: true };
    }

    startPractice({ focus = null, continueRun = false, questions = null, label = null } = {}) {
      const seen = continueRun && this.practice ? this.practice.seen : new Set();
      let qs = questions;
      if (!qs) {
        qs = this.builder.buildPractice({ size: PRACTICE_SIZE, focus, exclude: seen, progress: this.progress });
        if (qs.some((q) => seen.has(q.id))) seen.clear(); // סיבוב חדש על המאגר
      }
      qs.forEach((q) => seen.add(q.id));
      const round = continueRun && this.practice ? this.practice.round + 1 : 1;
      this.practice = {
        focus,
        label: label || (focus && focus.length ? "תרגול ממוקד: " + focus.map((c) => conceptById.get(c).name).join(", ") : "תרגול מעורב"),
        items: qs.map((q) => this.newItem(q)),
        index: 0,
        seen,
        round,
        finished: false,
      };
      this.progress.noteSessionStarted();
      this.go("/practice/run");
    }

    startTest() {
      const qs = this.builder.buildTest();
      this.test = { items: qs.map((q) => this.newItem(q)), index: 0, confirming: false };
      this.testReview = null;
      this.go("/test/run");
    }

    // =========================================================================
    // מסכים
    // =========================================================================
    viewHome() {
      const rank = this.progress.rank();
      const r = RANKS[rank.level];
      const stats = this.progress.conceptStats();
      const weak = this.progress.weakConcepts();
      const anyData = Object.values(stats).some((s) => s.mastery !== null);

      const hero = h(
        "section",
        { class: "card hero" },
        h("div", { class: "eyebrow" }, "אימון לקראת ההערכה בספרות"),
        h("h1", null, "ג'דיי של סיפור קצר"),
        h(
          "p",
          { class: "sub" },
          "לומדים ומתרגלים את מאפייני הסיפור הקצר — עם סיפורים קצרים מגלקסיה רחוקה, רחוקה, וגם מהחיים כאן. המטרה: לזהות כל מושג בכל סיפור.",
        ),
        h("div", { class: "rank" }, "הדרגה שלך: ", r.name, h("small", null, ` · ${rank.mastered}/${rank.total} מושגים בשליטה`)),
        h("p", { class: "small muted", style: { marginTop: "10px", marginBottom: 0 } }, r.hint),
      );

      const mode = (href, title, tag, text, accent) =>
        h("a", { class: "mode", href, style: { "--accent": accent } }, h("h2", null, title), h("div", { class: "tag" }, tag), h("p", null, text));
      const modes = h(
        "div",
        { class: "modes" },
        mode("#/learn", "לימוד", "ארכיון הג'דיי", "הסבר קצר, דוגמה והבחנות חשובות לכל מושג.", "#4fc3ff"),
        mode("#/practice", "תרגול", "אימון עם משוב ורמזים", "סבבים של 10 שאלות, עם הסבר אחרי כל תשובה.", "#4ade80"),
        mode("#/test", "מבחן תרגול", "בלי רמזים, תשובות בסוף", "12 שאלות מעורבות. הציון נשמר בנפרד מהתרגול.", "#b07cff"),
      );

      const rows = C.CONCEPTS.map((c) => {
        const s = stats[c.id];
        const val = s.mastery === null ? "—" : pct(s.mastery) + "%";
        const details = [];
        if (s.practice !== null) details.push(`תרגול בלי רמז: ${pct(s.practice)}%`);
        if (s.hintedWeight > 0) details.push(`עם רמז: ${Math.round(s.hintedWeight * 10) / 10} שאלות`);
        if (s.test !== null) details.push(`מבחן אחרון: ${pct(s.test)}%`);
        return h(
          "div",
          { class: "concept-row" },
          h("a", { class: "name", href: `#/learn/${c.id}`, style: { color: "inherit", textDecoration: "none" } }, c.name),
          saberBar(s.mastery, c.color, `${c.name}: ${val === "—" ? "אין עדיין נתונים" : val}`),
          h("div", { class: "val" }, val),
          h("div", { class: "detail" }, details.length ? details.join(" · ") : "עוד לא תרגלתם"),
        );
      });

      let recommendation;
      if (!anyData) {
        recommendation = h(
          "div",
          { class: "row" },
          h("a", { class: "btn primary", href: "#/learn" }, "להתחיל בלימוד"),
          h("button", { type: "button", class: "btn", onclick: () => this.startPractice() }, "ישר לתרגול מעורב"),
        );
      } else if (weak.length) {
        recommendation = h(
          "div",
          null,
          h("p", { class: "small" }, "כדאי לחזק: ", weak.map((c) => conceptById.get(c).name).join(", ")),
          h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice({ focus: weak }) }, "תרגול ממוקד במושגים האלה"),
        );
      } else {
        recommendation = h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice() }, "עוד סבב תרגול"),
          h("a", { class: "btn", href: "#/test" }, "לנסות מבחן תרגול"),
        );
      }

      const progressCard = h(
        "section",
        { class: "card" },
        h("h2", null, "ההתקדמות שלי"),
        h("p", { class: "small muted" }, "„שליטה” מחושבת מהתרגול בלי רמז ומהמבחן האחרון. הכול נשמר רק במכשיר הזה."),
        h("div", { class: "concept-grid" }, rows),
        h("div", { style: { marginTop: "14px" } }, recommendation),
      );

      const tests = this.progress.data.tests.slice(-5).reverse();
      const testsCard = tests.length
        ? h(
            "section",
            { class: "card soft" },
            h("h2", null, "מבחני תרגול אחרונים"),
            h(
              "ul",
              { class: "result-list" },
              tests.map((t) =>
                h("li", null, h("span", null, "📜"), h("span", null, `${formatDate(t.at)} — ${t.pct}% (${t.full} מתוך ${t.n} שאלות נכונות במלואן)`)),
              ),
            ),
          )
        : null;

      return h(
        "div",
        null,
        hero,
        this.persistent ? null : h("p", { class: "notice" }, "שימו לב: הדפדפן חוסם שמירה מקומית, ולכן ההתקדמות לא תישמר אחרי סגירת הדף."),
        modes,
        progressCard,
        testsCard,
        h(
          "footer",
          { class: "page-foot" },
          h("a", { href: "#/about" }, "הוראות, פרטיות ואיפוס התקדמות"),
          h("div", null, "אפליקציית תרגול לא רשמית. הסיפורים מומצאים. אין קשר ל־Lucasfilm או ל־Disney."),
        ),
      );
    }

    viewLearn() {
      const learned = this.progress.data.learned;
      const colorOf = (id) => conceptById.get(id).color;
      const svg = this.plotMap();
      const stageName = {
        expo: "אקספוזיציה",
        conflict: "סיבוך / קונפליקט",
        climax: "נקודת שיא",
        resolution: "התרה",
        ending: "סיום",
      };
      return h(
        "div",
        null,
        h(
          "section",
          { class: "card" },
          h("div", { class: "eyebrow" }, "ארכיון הג'דיי"),
          h("h1", null, "לימוד: מאפייני הסיפור הקצר"),
          h("p", null, "לכל מושג יש כאן הסבר קצר, דוגמה, והבחנה ממושג קרוב שקל להתבלבל איתו. אחרי הקריאה — אפשר לתרגל כל מושג בנפרד."),
          h(
            "p",
            { class: "notice info" },
            "חשוב לדעת: אלה הסברים מקובלים ברמת מבוא. ייתכן שבמחברת הכיתה ההגדרות מנוסחות קצת אחרת — אם יש הבדל, ההגדרות של המורה קובעות. האפליקציה לא יודעת אילו שאלות יופיעו בהערכה.",
          ),
        ),
        h(
          "section",
          { class: "card" },
          h("h2", null, "מפת העלילה"),
          h(
            "p",
            null,
            "הרבה סיפורים קצרים בנויים כמו הר: מתחילים במישור (אקספוזיציה), מטפסים כשהבעיה מסתבכת (סיבוך), מגיעים לפסגה (נקודת שיא), ויורדים בצד השני (התרה) עד הסיום. לא כל סיפור עוקב אחרי המבנה הזה בדיוק — יש סיפורים שנגמרים בלי התרה מלאה — אבל המבנה עוזר לקרוא ולהבין.",
          ),
          svg,
          h("h3", null, "סיפור דוגמה: „" + C.GARDEN_EXAMPLE.title + "”"),
          h("p", { class: "small muted" }, "סיפור קצר ומומצא שמלווה את כל דפי הלימוד. כל חלק מסומן בשלב שלו:"),
          h(
            "ol",
            { class: "stage-list" },
            C.GARDEN_EXAMPLE.parts.map((p) =>
              h("li", null, h("span", { class: "stage-pill", style: { "--c": colorOf(p.stage) } }, stageName[p.stage]), h("span", null, p.text)),
            ),
          ),
        ),
        h("h2", { style: { margin: "18px 4px 10px" } }, "המושגים"),
        h(
          "div",
          { class: "concept-cards" },
          C.CONCEPTS.map((c) =>
            h(
              "a",
              { class: "concept-card", href: `#/learn/${c.id}`, style: { "--c": c.color } },
              learned[c.id] ? h("span", { class: "seen" }, "✓ נקרא") : null,
              h("div", { class: "t" }, c.name),
              h("div", { class: "s" }, c.short),
            ),
          ),
        ),
      );
    }

    plotMap() {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 640 260");
      svg.setAttribute("class", "plotmap");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "מפת העלילה: אקספוזיציה, סיבוך, נקודת שיא, התרה וסיום — מימין לשמאל, כמו הר.");
      const el = (tag, attrs, text) => {
        const e = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        if (text) e.textContent = text;
        svg.append(e);
        return e;
      };
      el("path", { d: "M630 205 L520 205 L320 52 L190 150 L130 205 L10 205", fill: "none", stroke: "rgba(255,255,255,.18)", "stroke-width": "14", "stroke-linejoin": "round", "stroke-linecap": "round" });
      el("path", { d: "M630 205 L520 205 L320 52 L190 150 L130 205 L10 205", fill: "none", stroke: "#cfe8ff", "stroke-width": "3", "stroke-linejoin": "round" });
      const pts = [
        { id: "expo", x: 575, y: 205, lx: 575, ly: 245, t: "אקספוזיציה" },
        { id: "conflict", x: 420, y: 128, lx: 492, ly: 118, t: "סיבוך" },
        { id: "climax", x: 320, y: 52, lx: 320, ly: 30, t: "נקודת שיא" },
        { id: "resolution", x: 190, y: 150, lx: 130, ly: 128, t: "התרה" },
        { id: "ending", x: 70, y: 205, lx: 70, ly: 245, t: "סיום" },
      ];
      for (const p of pts) {
        const color = conceptById.get(p.id).color;
        el("circle", { cx: p.x, cy: p.y, r: "11", fill: color, stroke: "#060a1c", "stroke-width": "3" });
        el("text", { x: p.lx, y: p.ly, "text-anchor": "middle", fill: color }, p.t);
      }
      el("text", { x: 320, y: 245, "text-anchor": "middle", style: "font-size:15px;font-weight:400;fill:#a9b6d8" }, "← כיוון הסיפור");
      return svg;
    }

    viewConcept(id) {
      const c = conceptById.get(id);
      if (!c) return this.viewLearn();
      this.progress.markLearned(id);
      const idx = C.CONCEPTS.indexOf(c);
      const prev = C.CONCEPTS[idx - 1];
      const next = C.CONCEPTS[idx + 1];
      return h(
        "article",
        { class: "card", style: { "--c": c.color } },
        h("a", { href: "#/learn", class: "small" }, "→ כל המושגים"),
        h("h1", { class: "concept-title", style: { marginTop: "8px" } }, c.name),
        h("h2", null, "בקצרה"),
        h("p", null, c.explain),
        h("ul", { class: "points" }, c.points.map((p) => h("li", null, p))),
        h("h2", { style: { marginTop: "18px" } }, "דוגמה"),
        h("div", { class: "example" }, c.example),
        h("p", { class: "small muted" }, c.exampleNote),
        h("h2", { style: { marginTop: "18px" } }, "להבדיל"),
        c.distinctions.map((d) => h("div", { class: "distinction" }, h("h3", null, d.title), h("p", { style: { margin: 0 } }, d.text))),
        h("p", { class: "tip", style: { marginTop: "16px" } }, h("strong", null, "טיפ: "), c.tip),
        h(
          "div",
          { class: "actions" },
          h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice({ focus: [c.id] }) }, "תרגול המושג הזה"),
          h(
            "div",
            { class: "row" },
            prev ? h("a", { class: "btn ghost", href: `#/learn/${prev.id}` }, "→ " + prev.name) : null,
            next ? h("a", { class: "btn ghost", href: `#/learn/${next.id}` }, next.name + " ←") : null,
          ),
        ),
      );
    }

    viewPracticeSetup() {
      const weak = this.progress.weakConcepts();
      const open = this.practice && !this.practice.finished && this.practice.items.length;
      const checklist = h(
        "div",
        { class: "checklist", role: "group", "aria-label": "בחירת מושגים לתרגול ממוקד" },
        C.CONCEPTS.map((c) =>
          h(
            "label",
            { style: { borderColor: c.color } },
            h("input", {
              type: "checkbox",
              checked: this.focusDraft.has(c.id),
              "data-fk": "focus-" + c.id,
              onchange: (e) => {
                if (e.target.checked) this.focusDraft.add(c.id);
                else this.focusDraft.delete(c.id);
                this.refresh();
              },
            }),
            c.name,
          ),
        ),
      );
      return h(
        "div",
        null,
        h(
          "section",
          { class: "card" },
          h("div", { class: "eyebrow" }, "אימון"),
          h("h1", null, "תרגול"),
          h(
            "p",
            null,
            "בכל סבב יש כ־10 שאלות מסוגים שונים: בחירה, זיהוי בתוך סיפור, התאמה, סידור ומיון. אחרי כל תשובה תקבלו משוב והסבר שמפנה לראיות בסיפור.",
          ),
          h("p", { class: "small muted" }, "אפשר לבקש רמז לפני שעונים. תשובות עם רמז נשמרות בנפרד, כדי שהציון „בלי רמז” ישקף את ההבנה שלכם."),
          open
            ? h(
                "div",
                { class: "notice info", style: { marginBottom: "12px" } },
                `יש סבב פתוח (${this.practice.label}, שאלה ${this.practice.index + 1} מתוך ${this.practice.items.length}). `,
                h("a", { href: "#/practice/run" }, "להמשיך בו"),
              )
            : null,
          h(
            "div",
            { class: "row" },
            h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice() }, "תרגול מעורב — 10 שאלות"),
            weak.length
              ? h(
                  "button",
                  { type: "button", class: "btn", onclick: () => this.startPractice({ focus: weak }) },
                  "חיזוק נקודות חלשות: " + weak.map((c) => conceptById.get(c).name).join(", "),
                )
              : null,
          ),
        ),
        h(
          "section",
          { class: "card" },
          h("h2", null, "תרגול ממוקד"),
          h("p", { class: "small muted" }, "בחרו מושג אחד או יותר:"),
          checklist,
          h(
            "div",
            { style: { marginTop: "14px" } },
            h(
              "button",
              {
                type: "button",
                class: "btn primary",
                disabled: this.focusDraft.size === 0,
                onclick: () => this.startPractice({ focus: C.CONCEPTS.map((c) => c.id).filter((id) => this.focusDraft.has(id)) }),
              },
              "התחלת תרגול ממוקד",
            ),
          ),
        ),
      );
    }

    viewPracticeRun() {
      const P = this.practice;
      if (!P || !P.items.length) return this.viewPracticeSetup();
      if (P.index >= P.items.length) return this.viewPracticeSummary();
      const item = P.items[P.index];
      const q = item.q;
      const answered = E.isAnswered(q, item.response);
      const ctx = {
        interactive: !item.checked,
        showResult: item.checked,
        onChange: () => this.refresh(),
      };

      const head = h(
        "div",
        { class: "qhead" },
        h("span", { class: "qcount" }, `${P.label} · שאלה ${P.index + 1} מתוך ${P.items.length}`),
        h(
          "span",
          { class: "row" },
          h("span", { class: "qtype" }, TYPE_LABELS[q.type]),
          h(
            "button",
            {
              type: "button",
              class: "linkbtn small",
              onclick: () => {
                P.finished = true;
                this.go("/practice/summary");
              },
            },
            "סיום הסבב",
          ),
        ),
      );
      const bar = h("div", { class: "progressbar", "aria-hidden": "true" }, h("span", { style: { width: `${(P.index / P.items.length) * 100}%` } }));

      const hint = item.hintOpen ? h("div", { class: "hint", role: "note" }, h("strong", null, "💡 רמז: "), q.hint) : null;

      let actions;
      let feedback = null;
      if (!item.checked) {
        actions = h(
          "div",
          { class: "actions" },
          h(
            "button",
            {
              type: "button",
              class: "btn ghost",
              "data-fk": "hint",
              disabled: item.hintOpen,
              onclick: () => {
                item.hintOpen = true;
                item.hinted = true;
                this.refresh();
              },
            },
            "💡 רמז",
          ),
          h(
            "div",
            { class: "row" },
            !answered ? h("span", { class: "small muted" }, q.type === "match" || q.type === "order" || q.type === "classify" ? "השלימו את כל הפריטים כדי לבדוק" : "בחרו תשובה כדי לבדוק") : null,
            h(
              "button",
              {
                type: "button",
                class: "btn primary",
                "data-fk": "check",
                disabled: !answered,
                onclick: () => this.checkPractice(),
              },
              "בדיקה",
            ),
          ),
        );
      } else {
        feedback = renderFeedback(item, { hinted: item.hinted });
        const last = P.index === P.items.length - 1;
        actions = h(
          "div",
          { class: "actions" },
          h("span", null),
          h(
            "button",
            {
              type: "button",
              class: "btn primary",
              "data-fk": "next",
              onclick: () => {
                P.index += 1;
                if (P.index >= P.items.length) {
                  P.finished = true;
                  this.go("/practice/summary");
                } else this.route();
              },
            },
            last ? "לסיכום הסבב ←" : "לשאלה הבאה ←",
          ),
        );
      }

      return h("section", { class: "card", "aria-labelledby": "qprompt" }, h("h1", { class: "sr-only" }, `שאלה ${P.index + 1}`), head, bar, renderQuestionBody(item, ctx), hint, feedback, actions);
    }

    checkPractice() {
      const item = this.practice.items[this.practice.index];
      if (!E.isAnswered(item.q, item.response) || item.checked) return;
      item.result = E.grade(item.q, item.response);
      item.checked = true;
      this.progress.recordPractice(item.q, item.result, item.hinted);
      this.refresh();
      const v = document.getElementById("verdict");
      if (v) {
        v.focus({ preventScroll: true });
        v.scrollIntoView({ block: "nearest", behavior: "smooth" });
        this.announce(v.textContent);
      }
    }

    conceptResultsTable(summary) {
      const rows = C.CONCEPTS.filter((c) => summary[c.id]).map((c) => {
        const s = summary[c.id];
        const p = s.w ? s.c / s.w : 0;
        const label = p >= E.MASTERY_THRESHOLD ? "שולטים" : p >= E.WEAK_THRESHOLD ? "כמעט שם" : "כדאי לחזק";
        return h(
          "div",
          { class: "concept-row" },
          h("a", { class: "name", href: `#/learn/${c.id}`, style: { color: "inherit", textDecoration: "none" } }, c.name),
          saberBar(p, c.color, `${c.name}: ${pct(p)}%`),
          h("div", { class: "val" }, pct(p) + "%"),
          h("div", { class: "detail" }, label),
        );
      });
      return h("div", { class: "concept-grid" }, rows);
    }

    viewPracticeSummary() {
      const P = this.practice;
      if (!P) return this.viewPracticeSetup();
      P.finished = true;
      const done = P.items.filter((it) => it.checked);
      if (!done.length) {
        return h(
          "section",
          { class: "card" },
          h("h1", null, "הסבב הסתיים"),
          h("p", null, "לא נבדקו תשובות בסבב הזה, ולכן אין עדיין תוצאות להציג."),
          h("div", { class: "row" }, h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice({ focus: P.focus }) }, "סבב חדש"), h("a", { class: "btn", href: "#/" }, "לדף הבית")),
        );
      }
      const full = done.filter((it) => it.result.score === 1).length;
      const partial = done.filter((it) => it.result.score > 0 && it.result.score < 1).length;
      const summary = E.summarizeByConcept(done.map((it) => it.result));
      const weak = E.weakFromSummary(summary);
      const mistakes = done.filter((it) => it.result.score < 1).map((it) => it.q);
      const hintedCount = done.filter((it) => it.hinted).length;

      const icon = (it) => (it.result.score === 1 ? "✅" : it.result.score > 0 ? "🟡" : "🔸");
      return h(
        "div",
        null,
        h(
          "section",
          { class: "card center" },
          h("div", { class: "eyebrow" }, P.label),
          h("h1", null, full === done.length ? "סבב מושלם! 🌟" : "סיימתם סבב אימון!"),
          h("div", { class: "score-big" }, `${full}/${done.length}`),
          h("p", { class: "muted" }, "שאלות נכונות במלואן", partial ? ` · ${partial} נכונות בחלקן` : "", hintedCount ? ` · ${hintedCount} עם רמז` : ""),
        ),
        h(
          "section",
          { class: "card" },
          h("h2", null, "תוצאות לפי מושג"),
          this.conceptResultsTable(summary),
          h(
            "div",
            { class: "row", style: { marginTop: "16px" } },
            h("button", { type: "button", class: "btn primary", onclick: () => this.startPractice({ focus: P.focus, continueRun: true }) }, "המשך — עוד 10 שאלות"),
            weak.length
              ? h(
                  "button",
                  { type: "button", class: "btn", onclick: () => this.startPractice({ focus: weak }) },
                  "תרגול ממוקד: " + weak.map((c) => conceptById.get(c).name).join(", "),
                )
              : null,
            mistakes.length
              ? h(
                  "button",
                  { type: "button", class: "btn", onclick: () => this.startPractice({ questions: mistakes, label: "חזרה על שאלות שכדאי לתרגל שוב" }) },
                  `לנסות שוב את ${mistakes.length === 1 ? "השאלה שלא הצליחה" : `${mistakes.length} השאלות שלא הצליחו`}`,
                )
              : null,
            h("a", { class: "btn ghost", href: "#/" }, "לדף הבית"),
          ),
          weak.length ? h("p", { class: "small muted", style: { marginTop: "10px" } }, "„כדאי לחזק” = פחות מ־70% בסבב הזה. אפשר גם לחזור לדף הלימוד של המושג.") : null,
        ),
        h(
          "section",
          { class: "card soft" },
          h("h2", null, "השאלות בסבב"),
          h(
            "ul",
            { class: "result-list" },
            done.map((it) => h("li", null, h("span", { "aria-label": it.result.score === 1 ? "נכון" : it.result.score > 0 ? "נכון בחלקו" : "לא נכון" }, icon(it)), h("span", null, it.q.prompt.length > 110 ? it.q.prompt.slice(0, 110) + "…" : it.q.prompt))),
          ),
        ),
      );
    }

    // ----- מבחן -----
    viewTestIntro() {
      const open = this.test && this.test.items.length;
      const last = this.progress.lastTest();
      return h(
        "div",
        null,
        h(
          "section",
          { class: "card" },
          h("div", { class: "eyebrow" }, "מבחן המועצה"),
          h("h1", null, "מבחן תרגול"),
          h(
            "ul",
            { class: "points" },
            h("li", null, "12 שאלות מעורבות על כל המושגים, כולל התאמה וסידור."),
            h("li", null, "אין רמזים, ואין משוב במהלך המבחן. אפשר לעבור בין השאלות ולשנות תשובות עד ההגשה."),
            h("li", null, "בסוף תראו ציון, תוצאות לפי מושג, ואת כל התשובות הנכונות עם הסברים — קודם את הטעויות."),
            h("li", null, "הציון נשמר בנפרד מהתרגול, כדי שישקף הבנה בלי עזרה."),
          ),
          h("p", { class: "small muted" }, "זה מבחן תרגול בלבד — הוא לא מנבא את השאלות שיופיעו בהערכה בכיתה."),
          open
            ? h(
                "div",
                { class: "stack" },
                h("p", { class: "notice info" }, `יש מבחן פתוח (ענית על ${this.test.items.filter((it) => E.isAnswered(it.q, it.response)).length} מתוך ${this.test.items.length}).`),
                h(
                  "div",
                  { class: "row" },
                  h("a", { class: "btn primary", href: "#/test/run" }, "המשך המבחן"),
                  h("button", { type: "button", class: "btn", onclick: () => this.startTest() }, "התחלת מבחן חדש"),
                ),
              )
            : h("button", { type: "button", class: "btn primary", onclick: () => this.startTest() }, "התחלת המבחן"),
        ),
        last
          ? h(
              "section",
              { class: "card soft" },
              h("h2", null, "המבחן האחרון"),
              h("p", null, `${formatDate(last.at)}: ${last.pct}% — ${last.full} מתוך ${last.n} שאלות נכונות במלואן.`),
              this.testReview ? h("a", { href: "#/test/results" }, "לפירוט התשובות") : null,
            )
          : null,
      );
    }

    viewTestRun() {
      const T = this.test;
      if (!T || !T.items.length) return this.viewTestIntro();
      const item = T.items[T.index];
      const ctx = { interactive: true, showResult: false, onChange: () => this.refresh() };
      const answeredCount = T.items.filter((it) => E.isAnswered(it.q, it.response)).length;
      const dots = h(
        "nav",
        { class: "qdots", "aria-label": "מעבר בין שאלות" },
        T.items.map((it, i) =>
          h(
            "button",
            {
              type: "button",
              class: E.isAnswered(it.q, it.response) ? "answered" : "",
              "aria-current": i === T.index ? "step" : null,
              "aria-label": `שאלה ${i + 1}${E.isAnswered(it.q, it.response) ? " (נענתה)" : ""}`,
              onclick: () => {
                T.index = i;
                T.confirming = false;
                this.route();
              },
            },
            i + 1,
          ),
        ),
      );
      const last = T.index === T.items.length - 1;
      const unanswered = T.items.length - answeredCount;
      const confirm = T.confirming
        ? h(
            "div",
            { class: "notice", role: "alertdialog", "aria-label": "אישור הגשה", style: { marginTop: "14px" } },
            h("p", null, unanswered ? `נשארו ${unanswered} שאלות בלי תשובה מלאה. שאלה בלי תשובה נספרת כשגויה. להגיש בכל זאת?` : "להגיש את המבחן? אחרי ההגשה כבר אי אפשר לשנות תשובות."),
            h(
              "div",
              { class: "row" },
              h("button", { type: "button", class: "btn primary", "data-fk": "confirm-submit", onclick: () => this.submitTest() }, "כן, להגיש"),
              h(
                "button",
                {
                  type: "button",
                  class: "btn",
                  onclick: () => {
                    T.confirming = false;
                    this.refresh();
                  },
                },
                "חזרה לשאלות",
              ),
            ),
          )
        : null;
      return h(
        "section",
        { class: "card", "aria-labelledby": "qprompt" },
        h("h1", { class: "sr-only" }, `מבחן תרגול — שאלה ${T.index + 1}`),
        h(
          "div",
          { class: "qhead" },
          h("span", { class: "qcount" }, `מבחן תרגול · שאלה ${T.index + 1} מתוך ${T.items.length}`),
          h("span", { class: "qtype" }, TYPE_LABELS[item.q.type]),
        ),
        dots,
        renderQuestionBody(item, ctx),
        h(
          "div",
          { class: "actions" },
          h(
            "button",
            {
              type: "button",
              class: "btn ghost",
              disabled: T.index === 0,
              onclick: () => {
                T.index -= 1;
                T.confirming = false;
                this.route();
              },
            },
            "→ הקודמת",
          ),
          h("span", { class: "small muted" }, `נענו ${answeredCount} מתוך ${T.items.length}`),
          last
            ? h(
                "button",
                {
                  type: "button",
                  class: "btn primary",
                  "data-fk": "submit",
                  onclick: () => {
                    T.confirming = true;
                    this.refresh();
                    const b = this.main.querySelector('[data-fk="confirm-submit"]');
                    if (b) {
                      b.focus({ preventScroll: true });
                      b.scrollIntoView({ block: "nearest" });
                    }
                  },
                },
                "סיום והגשה",
              )
            : h(
                "button",
                {
                  type: "button",
                  class: "btn primary",
                  onclick: () => {
                    T.index += 1;
                    T.confirming = false;
                    this.route();
                  },
                },
                "הבאה ←",
              ),
        ),
        !last
          ? h(
              "div",
              { class: "row end", style: { marginTop: "8px" } },
              h(
                "button",
                {
                  type: "button",
                  class: "linkbtn small",
                  onclick: () => {
                    T.confirming = true;
                    this.refresh();
                    const b = this.main.querySelector('[data-fk="confirm-submit"]');
                    if (b) {
                      b.focus({ preventScroll: true });
                      b.scrollIntoView({ block: "nearest" });
                    }
                  },
                },
                "הגשת המבחן עכשיו",
              ),
            )
          : null,
        confirm,
      );
    }

    submitTest() {
      const T = this.test;
      if (!T) return;
      for (const it of T.items) {
        it.result = E.grade(it.q, it.response);
        it.checked = true;
      }
      const rec = this.progress.recordTest(T.items.map((it) => ({ q: it.q, result: it.result })));
      this.testReview = { items: T.items, rec };
      this.test = null;
      this.go("/test/results");
    }

    reviewCard(item) {
      const ctx = { interactive: false, showResult: true, onChange: () => {} };
      item.storyOpen = false;
      return h("article", { class: "review-card" }, renderQuestionBody(item, ctx, { headingTag: "h3" }), renderFeedback(item));
    }

    viewTestResults() {
      const R = this.testReview;
      if (!R) {
        const last = this.progress.lastTest();
        return h(
          "section",
          { class: "card" },
          h("h1", null, "תוצאות מבחן"),
          last
            ? h("p", null, `המבחן האחרון (${formatDate(last.at)}): ${last.pct}%. הפירוט המלא של התשובות מוצג רק מיד אחרי המבחן.`)
            : h("p", null, "עוד לא נעשה מבחן תרגול."),
          h("button", { type: "button", class: "btn primary", onclick: () => this.startTest() }, "מבחן חדש"),
        );
      }
      const { items, rec } = R;
      const summary = {};
      for (const [k, v] of Object.entries(rec.concepts)) summary[k] = v;
      const weak = E.weakFromSummary(summary);
      const prev = this.progress.data.tests.length > 1 ? this.progress.data.tests[this.progress.data.tests.length - 2] : null;
      const wrong = items.filter((it) => it.result.score < 1);
      const right = items.filter((it) => it.result.score === 1);

      // קיבוץ הטעויות לפי המושג המרכזי
      const groups = new Map();
      for (const it of wrong) {
        const key = it.q.concept;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
      }
      const groupOrder = C.CONCEPTS.map((c) => c.id).concat([E.MIXED]);
      const mistakeSections = groupOrder
        .filter((k) => groups.has(k))
        .map((k) => {
          const c = conceptById.get(k);
          return h(
            "div",
            null,
            h("h3", { class: "group-title", style: { "--c": c ? c.color : "var(--line)" } }, c ? c.name : "שאלות שמשלבות כמה מושגים"),
            groups.get(k).map((it) => this.reviewCard(it)),
          );
        });

      return h(
        "div",
        null,
        h(
          "section",
          { class: "card center" },
          h("div", { class: "eyebrow" }, "תוצאות מבחן התרגול"),
          h("h1", null, rec.pct >= 85 ? "תוצאה מצוינת! 🌟" : rec.pct >= 60 ? "עבודה טובה — יש עוד מה לחדד" : "התחלה — עכשיו יודעים מה לתרגל"),
          h("div", { class: "score-big" }, rec.pct + "%"),
          h(
            "p",
            { class: "muted" },
            `${rec.full} מתוך ${rec.n} שאלות נכונות במלואן (בשאלות התאמה, סידור ומיון יש ניקוד חלקי).`,
            prev ? ` במבחן הקודם: ${prev.pct}%.` : "",
          ),
        ),
        h(
          "section",
          { class: "card" },
          h("h2", null, "תוצאות לפי מושג"),
          this.conceptResultsTable(summary),
          h(
            "div",
            { class: "row", style: { marginTop: "16px" } },
            weak.length
              ? h(
                  "button",
                  { type: "button", class: "btn primary", onclick: () => this.startPractice({ focus: weak }) },
                  "תרגול ממוקד: " + weak.map((c) => conceptById.get(c).name).join(", "),
                )
              : null,
            h("button", { type: "button", class: weak.length ? "btn" : "btn primary", onclick: () => this.startTest() }, "מבחן חדש"),
            h("a", { class: "btn ghost", href: "#/" }, "לדף הבית"),
          ),
        ),
        wrong.length
          ? h(
              "section",
              { class: "card" },
              h("h2", null, `הטעויות שלכם (${wrong.length}) — עם התשובות הנכונות וההסברים`),
              h("p", { class: "small muted" }, "כל טעות היא הזדמנות. הנה מה שבחרתם, מה התשובה הנכונה, ולמה — לפי מושגים."),
              mistakeSections,
            )
          : h("section", { class: "card" }, h("h2", null, "אין טעויות! כל התשובות נכונות.")),
        right.length
          ? h(
              "section",
              { class: "card soft" },
              h(
                "details",
                { class: "collapsible" },
                h("summary", null, `שאלות שעניתם נכון (${right.length}) — הסברים`),
                right.map((it) => this.reviewCard(it)),
              ),
            )
          : null,
      );
    }

    viewAbout() {
      const resetBlock = this.confirmReset
        ? h(
            "div",
            { class: "notice", role: "alertdialog", "aria-label": "אישור איפוס" },
            h("p", null, "בטוחים? כל ההתקדמות — תרגולים, מבחנים ומושגים שנקראו — תימחק מהמכשיר הזה. אי אפשר לבטל את זה."),
            h(
              "div",
              { class: "row" },
              h(
                "button",
                {
                  type: "button",
                  class: "btn danger",
                  "data-fk": "reset-yes",
                  onclick: () => {
                    this.progress.reset();
                    this.practice = null;
                    this.test = null;
                    this.testReview = null;
                    this.confirmReset = false;
                    this.toast("ההתקדמות אופסה");
                    this.refresh();
                  },
                },
                "כן, לאפס הכול",
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "btn",
                  onclick: () => {
                    this.confirmReset = false;
                    this.refresh();
                  },
                },
                "ביטול",
              ),
            ),
          )
        : h(
            "button",
            {
              type: "button",
              class: "btn danger",
              "data-fk": "reset",
              onclick: () => {
                this.confirmReset = true;
                this.refresh();
                const b = this.main.querySelector('[data-fk="reset-yes"]');
                if (b) b.focus({ preventScroll: true });
              },
            },
            "איפוס ההתקדמות",
          );
      return h(
        "div",
        null,
        h(
          "section",
          { class: "card" },
          h("h1", null, "על האפליקציה"),
          h("h2", null, "איך משתמשים"),
          h(
            "ol",
            { class: "points" },
            h("li", null, h("strong", null, "לימוד: "), "קוראים את ההסבר, הדוגמה וההבחנות של כל מושג."),
            h("li", null, h("strong", null, "תרגול: "), "סבבים של 10 שאלות עם רמזים, משוב והסבר אחרי כל תשובה. בסוף כל סבב — תוצאות לפי מושג ואפשרות לתרגל ממוקד."),
            h("li", null, h("strong", null, "מבחן תרגול: "), "12 שאלות בלי רמזים ובלי משוב עד ההגשה. הציון נשמר בנפרד."),
          ),
          h("h2", { style: { marginTop: "16px" } }, "פרטיות"),
          h(
            "ul",
            { class: "points" },
            h("li", null, "אין הרשמה, אין סיסמה, אין תשלום ואין שימוש בבינה מלאכותית חיצונית."),
            h("li", null, "האפליקציה לא שואלת שום פרט אישי, ולא שולחת לשום מקום תשובות או ציונים."),
            h("li", null, "ההתקדמות נשמרת רק בדפדפן שבמכשיר הזה (localStorage). אפשר למחוק אותה בכל רגע בכפתור למטה."),
            h("li", null, "האפליקציה עובדת גם בלי אינטרנט, ולא טוענת שום קובץ מבחוץ."),
          ),
          h("h2", { style: { marginTop: "16px" } }, "חשוב לדעת"),
          h(
            "ul",
            { class: "points" },
            h("li", null, "ההסברים הם הסברים מקובלים ברמת מבוא. ייתכן שבמחברת הכיתה ההגדרות מנוסחות אחרת — במקרה כזה ההגדרות של המורה קובעות."),
            h("li", null, "האפליקציה לא יודעת אילו שאלות יופיעו בהערכה ואינה מנבאת אותן."),
            h(
              "li",
              null,
              "כל הסיפורים נכתבו במיוחד לתרגול. הסיפורים עם לוק, ליאה, דארת' ויידר והדרואידים הם סיפורים מומצאים בהשראת מלחמת הכוכבים — לא סצנות מהסרטים, ולא צריך להכיר את הסרטים כדי לענות.",
            ),
            h("li", null, "זו אפליקציית תרגול לא רשמית, ללא קשר ל־Lucasfilm או ל־Disney."),
          ),
        ),
        h("section", { class: "card" }, h("h2", null, "איפוס ההתקדמות"), h("p", { class: "small muted" }, "מוחק את כל הנתונים השמורים במכשיר הזה ומתחיל מחדש."), resetBlock),
      );
    }
  }

  S.App = App;
  S.ui = { h, renderQuestionBody, renderFeedback, WIDGETS };
})(window);
