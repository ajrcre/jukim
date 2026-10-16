import { rand } from "../core/math.js";

const FILES = {
  squash1: "assets/sounds/squash1.mp3",
  squash2: "assets/sounds/squash2.mp3",
  squash3: "assets/sounds/squash3.mp3",
  miss: "assets/sounds/miss.mp3",
  scurry: "assets/sounds/scurry.mp3",
  levelup: "assets/sounds/levelup.mp3",
  gameover: "assets/sounds/gameover.mp3",
  cartoon_scream: "assets/sounds/cartoon_scream.mp3",
  slipper_whack: "assets/sounds/slipper_whack.mp3",
};

/**
 * Web Audio playback of the ElevenLabs-generated effects, with pitch
 * variation, a looping scurry bed whose volume follows roach activity, and a
 * synthesized fallback if a file can't be loaded.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.muted = false;
    this.scurryGain = null;
    this.scurrySource = null;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : 1;
      await Promise.all(Object.entries(FILES).map(([name, url]) => this.load(name, url)));
      this.startScurry();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async load(name, url) {
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      this.buffers.set(name, await this.ctx.decodeAudioData(data));
    } catch {
      this.buffers.delete(name);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  play(name, { rate = 1, volume = 1 } = {}) {
    if (!this.ctx || this.muted) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return this.synth(name);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.master);
    src.start();
  }

  squash(big = false) {
    const n = 1 + Math.floor(Math.random() * 3);
    this.play(`squash${n}`, { rate: rand(0.88, 1.12) * (big ? 0.9 : 1), volume: 1 });
    navigator.vibrate?.(big ? 60 : 35);
  }

  startScurry() {
    const buffer = this.buffers.get("scurry");
    if (!buffer) return;
    this.scurrySource = this.ctx.createBufferSource();
    this.scurrySource.buffer = buffer;
    this.scurrySource.loop = true;
    this.scurryGain = this.ctx.createGain();
    this.scurryGain.gain.value = 0;
    this.scurrySource.connect(this.scurryGain).connect(this.master);
    this.scurrySource.start();
  }

  /** activity: 0..1 how much scuttling is going on. */
  setScurry(activity) {
    if (!this.scurryGain) return;
    this.scurryGain.gain.setTargetAtTime(Math.min(1, activity) * 0.35, this.ctx.currentTime, 0.15);
  }

  /** Fallback: a filtered noise burst so the game still makes noise offline. */
  synth(name) {
    const ctx = this.ctx;
    const dur = name === "miss" ? 0.12 : 0.25;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = name === "miss" ? 400 : 1800;
    src.connect(filter).connect(this.master);
    src.start();
  }
}
