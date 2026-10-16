const $ = (sel) => document.querySelector(sel);

/** DOM layer for in-game UI: HUD, pause/level/game-over overlays and toasts. */
export class UI {
  constructor(actions, lobby) {
    this.actions = actions;
    this.lobby = lobby;
    this.overlay = $("#overlay");
    this.panel = $("#overlay .panel");
    this.hud = $("#hud");
    this.status = $("#status");
    this.hudEls = {
      level: $("#hud-level"),
      score: $("#hud-score"),
      time: $("#hud-time"),
      progress: $("#hud-progress"),
      count: $("#hud-count"),
    };
    $("#pause-btn").addEventListener("click", () => actions.pause());
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

  showLobby(highScore) {
    this.hideOverlay();
    this.lobby.show(highScore);
  }

  hideLobby() {
    this.lobby.hide();
  }

  showPaused() {
    this.render(`<h2>הפסקה</h2>`, [
      ["▶ המשך", () => this.actions.resume(), "primary"],
      ["⚙ חזרה לאפשרויות", () => this.actions.lobby()],
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
        ["↻ שוב", () => this.actions.restart(), "primary"],
        ["⚙ שינוי אפשרויות", () => this.actions.lobby()],
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

  toast(message, ms = 3500) {
    this.status.textContent = message;
    this.status.hidden = false;
    clearTimeout(this.toastTimer);
    if (ms) this.toastTimer = setTimeout(() => (this.status.hidden = true), ms);
  }

  hideToast() {
    this.status.hidden = true;
  }
}
