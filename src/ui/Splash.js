import { createSplashScene } from "./splashScene.js";

/** Full-screen cartoon intro; calls onTap once the player taps. */
export class Splash {
  constructor(root, svg) {
    this.root = root;
    this.svg = svg;
    this.scene = null;
  }

  play(onTap) {
    this.root.hidden = false;
    this.scene = createSplashScene(this.svg);
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
