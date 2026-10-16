import { EventBus } from "../core/EventBus.js";
import { GameLoop } from "../core/GameLoop.js";
import { RoachRenderer } from "../entities/RoachRenderer.js";
import { World } from "./World.js";
import { LevelManager } from "./LevelManager.js";
import { ScoreManager } from "./ScoreManager.js";
import { EdgeSpawner } from "./spawners.js";
import { GameStateMachine, LobbyState, PausedState, PlayingState, SplashState } from "./GameStateMachine.js";

const NO_INPUT = { threats: () => [] };

/** Facade over the game's subsystems; owns the loop and state transitions. */
export class Game {
  constructor({ canvas, ui, sound }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.sound = sound;
    this.bus = new EventBus();
    this.renderer = new RoachRenderer();
    this.world = new World(this.bus, this.renderer);
    this.level = new LevelManager();
    this.score = new ScoreManager();
    this.input = NO_INPUT;
    this.spawner = new EdgeSpawner();
    this.machine = new GameStateMachine();
    this.time = 0;
    this.loop = new GameLoop(
      (dt, t) => this.machine.state.update(dt, t),
      (t) => this.render(t),
    );
    this.bus.on("strike", (s) => this.machine.state.strike(s));
  }

  boot() {
    this.machine.change(new SplashState(this));
    this.loop.start();
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.renderer.setPixelRatio(dpr);
    this.world.resize(width, height, dpr);
  }

  render(time) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.beginFrame();
    this.world.draw(ctx, time);
  }

  toLobby() {
    if (this.machine.is(PausedState)) this.score.commit();
    this.world.clear();
    this.machine.change(new LobbyState(this));
  }

  newGame(spawner = new EdgeSpawner()) {
    this.spawner = spawner;
    this.world.clear();
    this.score.reset();
    this.level.start(1);
    this.time = 0;
    this.machine.change(new PlayingState(this));
  }

  nextLevel() {
    this.world.roaches = [];
    this.level.start(this.level.level + 1);
    this.machine.change(new PlayingState(this));
  }

  pause() {
    if (this.machine.is(PlayingState)) this.machine.change(new PausedState(this));
  }

  resume() {
    if (this.machine.is(PausedState)) this.machine.change(new PlayingState(this));
  }

  get playing() {
    return this.machine.is(PlayingState);
  }
}
