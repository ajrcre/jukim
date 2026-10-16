const $ = (sel) => document.querySelector(sel);

/**
 * The pre-game screen: game mode, background and sound, all visible up front.
 * Emits onChange(settings) on every change and onStart() from the big button.
 */
export class Lobby {
  constructor({ settings, backgrounds, onChange, onStart, onUpload }) {
    this.root = $("#lobby");
    this.settings = { ...settings };
    this.backgrounds = backgrounds; // [{ id, label, thumb }]
    this.onChange = onChange;
    for (const card of document.querySelectorAll("#mode-cards .card")) {
      card.addEventListener("click", () => this.set({ mode: card.dataset.mode }));
    }
    $("#sound-toggle").addEventListener("change", (e) => this.set({ muted: !e.target.checked }));
    $("#start-btn").addEventListener("click", () => onStart(this.settings));
    $("#bg-upload").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
      e.target.value = "";
    });
    this.render();
  }

  show(highScore) {
    $("#lobby-record").textContent = highScore ? `🏆 שיא: ${highScore}` : "";
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  setBackgrounds(backgrounds) {
    this.backgrounds = backgrounds;
    this.render();
  }

  set(patch) {
    Object.assign(this.settings, patch);
    this.render();
    this.onChange(this.settings);
  }

  render() {
    const { mode, background, muted } = this.settings;
    for (const card of document.querySelectorAll("#mode-cards .card")) {
      card.classList.toggle("selected", card.dataset.mode === mode);
    }
    $("#sound-toggle").checked = !muted;

    const mouth = mode === "mouth";
    $("#bg-note").hidden = !mouth;
    const grid = $("#bg-grid");
    grid.classList.toggle("disabled", mouth);
    grid.innerHTML = "";
    const tiles = [
      ...this.backgrounds,
      { id: "rear", label: "📷 הרצפה שלך", thumb: null, cls: "camera" },
      { id: "upload", label: "🖼️ תמונה משלך", thumb: null, cls: "upload" },
    ];
    for (const { id, label, thumb, cls } of tiles) {
      const b = document.createElement("button");
      b.className = `bg-option ${cls ?? ""}` + (id === background ? " selected" : "");
      if (thumb) b.style.backgroundImage = `url(${thumb})`;
      b.innerHTML = `<span>${label}</span>`;
      b.disabled = mouth;
      b.addEventListener("click", () => {
        if (id === "upload") $("#bg-upload").click();
        else this.set({ background: id });
      });
      grid.append(b);
    }
  }
}
