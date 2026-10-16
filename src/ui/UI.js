const $ = (sel) => document.querySelector(sel);

/** DOM layer: HUD, overlay screens and the settings panel. */
export class UI {
  constructor(actions) {
    this.actions = actions;
    this.overlay = $("#overlay");
    this.panel = $("#overlay .panel");
    this.hud = $("#hud");
    this.settings = $("#settings");
    this.status = $("#status");
    this.hudEls = {
      level: $("#hud-level"),
      score: $("#hud-score"),
      time: $("#hud-time"),
      progress: $("#hud-progress"),
      count: $("#hud-count"),
    };
    $("#pause-btn").addEventListener("click", () => actions.pause());
    $("#settings-close").addEventListener("click", () => this.closeSettings());
    $("#bg-upload").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) actions.uploadBackground(file);
      e.target.value = "";
    });
    for (const input of document.querySelectorAll('input[name="camera"]')) {
      input.addEventListener("change", () => actions.setCamera(input.value));
    }
    $("#sound-toggle").addEventListener("change", (e) => actions.setMuted(!e.target.checked));
  }

  render(html, buttons) {
    this.panel.innerHTML = html;
    const row = document.createElement("div");
    row.className = "buttons";
    for (const [label, handler, cls] of buttons) {
      const b = document.createElement("button");
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener("click", handler);
      row.append(b);
    }
    this.panel.append(row);
    this.overlay.hidden = false;
  }

  hideOverlay() {
    this.overlay.hidden = true;
  }

  setPlaying(playing) {
    this.hud.hidden = !playing;
  }

  showMenu(highScore) {
    this.render(
      `<h1>מחץ את הג'וק</h1>
       <p class="lead">ג'וקים נכנסים מכל הכיוונים — מחצו אותם לפני שנגמר הזמן!</p>
       <ul class="how">
         <li>🖱️ קליק / 👆 נגיעה על הג'וק</li>
         <li>✋➜✊ מצלמה קדמית: יד פתוחה שנסגרת לאגרוף מעל הג'וק</li>
         <li>📷 מצלמה אחורית: הג'וקים רצים על הרצפה האמיתית שלך</li>
       </ul>
       ${highScore ? `<p class="record">🏆 שיא: ${highScore}</p>` : ""}`,
      [
        ["▶ התחל", () => this.actions.start(), "primary"],
        ["⚙ הגדרות", () => this.openSettings()],
      ],
    );
  }

  showPaused() {
    this.render(`<h2>הפסקה</h2>`, [
      ["▶ המשך", () => this.actions.resume(), "primary"],
      ["⚙ הגדרות", () => this.openSettings()],
      ["🏠 תפריט", () => this.actions.menu()],
    ]);
  }

  showLevelComplete({ level, bonus, score }) {
    this.render(
      `<h2>שלב ${level} הושלם! 🎉</h2>
       <p>בונוס זמן: +${bonus}</p>
       <p class="big">${score}</p>`,
      [["שלב הבא ▶", () => this.actions.next(), "primary"]],
    );
  }

  showGameOver({ score, highScore, record, level }) {
    this.render(
      `<h2>${record ? "שיא חדש! 🏆" : "נגמר הזמן ⏰"}</h2>
       <p>הגעת לשלב ${level}</p>
       <p class="big">${score}</p>
       <p>שיא: ${highScore}</p>`,
      [
        ["↻ שוב", () => this.actions.start(), "primary"],
        ["🏠 תפריט", () => this.actions.menu()],
      ],
    );
  }

  updateHud(game) {
    const { level, score } = game;
    this.hudEls.level.textContent = level.level;
    this.hudEls.score.textContent = score.score;
    const t = Math.ceil(level.timeLeft);
    this.hudEls.time.textContent = t;
    this.hudEls.time.classList.toggle("urgent", t <= 5);
    this.hudEls.count.textContent = `${level.squashed}/${level.config.target}`;
    this.hudEls.progress.style.width = `${Math.min(100, (level.squashed / level.config.target) * 100)}%`;
  }

  openSettings() {
    this.settings.hidden = false;
  }

  closeSettings() {
    this.settings.hidden = true;
  }

  renderBackgrounds(items, selectedId, onSelect) {
    const grid = $("#bg-grid");
    grid.innerHTML = "";
    for (const { id, label, thumb } of items) {
      const b = document.createElement("button");
      b.className = "bg-option" + (id === selectedId ? " selected" : "");
      b.style.backgroundImage = `url(${thumb})`;
      b.innerHTML = `<span>${label}</span>`;
      b.addEventListener("click", () => onSelect(id));
      grid.append(b);
    }
  }

  setCameraOption(value) {
    const input = document.querySelector(`input[name="camera"][value="${value}"]`);
    if (input) input.checked = true;
  }

  setCameraAvailable(available) {
    for (const input of document.querySelectorAll('input[name="camera"]')) {
      if (input.value !== "off") input.disabled = !available;
    }
  }

  toast(message, ms = 3500) {
    this.status.textContent = message;
    this.status.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.status.hidden = true), ms);
  }
}
