// State pattern: each game phase decides how time, strikes and the UI behave.

class State {
  constructor(game) {
    this.game = game;
  }
  enter() {}
  exit() {}
  update() {}
  strike() {}
}

/** Cartoon intro; the world stays empty underneath. */
export class SplashState extends State {}

/** Pre-game options screen, with a few roaches wandering around behind it. */
export class LobbyState extends State {
  enter() {
    this.game.ui.showLobby(this.game.score.highScore);
  }
  exit() {
    this.game.ui.hideLobby();
  }
  update(dt) {
    // Some ambient roaches wander around the menu for atmosphere.
    const g = this.game;
    g.ambientTimer = (g.ambientTimer ?? 0) - dt;
    if (g.ambientTimer <= 0 && g.world.roaches.length < 4) {
      g.world.spawn({ weights: { german: 1, american: 1 }, speedMul: 0.9 });
      g.ambientTimer = 1.5;
    }
    g.world.update(dt, []);
  }
}

export class PlayingState extends State {
  enter() {
    this.game.ui.hideOverlay();
    this.game.ui.setPlaying(true);
  }
  exit() {
    this.game.ui.setPlaying(false);
  }
  update(dt, time) {
    const g = this.game;
    g.time += dt;
    g.spawner.update(dt, g);
    g.world.update(dt, g.input.threats());
    g.sound.setScurry(g.world.activity());
    g.ui.updateHud(g);

    if (g.level.complete) g.machine.change(new LevelCompleteState(g));
    else if (g.level.failed) g.machine.change(new GameOverState(g));
  }
  strike(s) {
    const g = this.game;
    const hit = g.world.strike(s);
    if (!hit.length) {
      g.score.miss();
      g.sound.play("miss", { volume: 0.6 });
      return;
    }
    for (const r of hit) {
      g.level.recordSquash();
      const points = g.score.squash(r.type.points, g.time);
      const mult = g.score.multiplier;
      const color = r.type.name === "golden" ? "#ffd84a" : "#fff";
      g.world.popup(r.x, r.y - 20, mult > 1 ? `+${points} ×${mult}` : `+${points}`, color);
      g.bus.emit("squash", r);
    }
    g.sound.squash(hit.some((r) => r.type.name === "american"));
  }
}

export class PausedState extends State {
  enter() {
    this.game.sound.setScurry(0);
    this.game.ui.showPaused();
  }
}

export class LevelCompleteState extends State {
  enter() {
    const g = this.game;
    const bonus = Math.ceil(g.level.timeLeft) * 5;
    g.score.bonus(bonus);
    g.sound.setScurry(0);
    g.sound.play("levelup");
    g.ui.updateHud(g);
    g.ui.showLevelComplete({ level: g.level.level, bonus, score: g.score.score });
  }
  update(dt) {
    this.game.world.update(dt, []);
  }
}

export class GameOverState extends State {
  enter() {
    const g = this.game;
    g.sound.setScurry(0);
    g.sound.play("gameover");
    const record = g.score.commit();
    g.ui.showGameOver({ score: g.score.score, highScore: g.score.highScore, record, level: g.level.level });
  }
  update(dt) {
    this.game.world.update(dt, []);
  }
}

export class GameStateMachine {
  constructor() {
    this.state = null;
  }

  change(next) {
    this.state?.exit();
    this.state = next;
    next.enter();
  }

  is(StateClass) {
    return this.state instanceof StateClass;
  }
}
