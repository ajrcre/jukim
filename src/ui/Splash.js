import { SPLASHES } from "./splashScenes.js";

// Which cartoon intro to use (chosen from the variants in splashScenes.js).
export const SPLASH_ID = "slipper";

/** Full-screen cartoon intro; resolves once the player taps. */
export class Splash {
  constructor(root, svg) {
    this.root = root;
    this.svg = svg;
    this.scene = null;
  }

  play(onTap) {
    this.root.hidden = false;
    const def = SPLASHES.find((s) => s.id === SPLASH_ID) ?? SPLASHES[0];
    this.scene = def.create(this.svg);
    const handler = () => {
      this.root.removeEventListener("pointerdown", handler);
      onTap();
    };
    this.root.addEventListener("pointerdown", handler);
  }

  hide() {
    this.scene?.destroy();
    this.scene = null;
    this.root.hidden = true;
  }
}
