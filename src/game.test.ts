import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game } from "./game";
import type { CaromDebugApi, CaromState, Side } from "./game";
import * as C from "./constants";
import { obstaclePose } from "./simulation";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  for (const engine of engines.splice(0)) engine.destroy();
  vi.restoreAllMocks();
});
async function setup(step = 8) {
  const target = new EventTarget();
  const registrations: { name: string; keys: string[] }[] = [];
  const engine = createEngine({
    canvas: createCanvas(320, 180) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: "#0c141b",
    layout: C.LAYOUT,
    game: {
      ...game,
      initialize(api) {
        return game.initialize({
          ...api,
          input: {
            ...api.input,
            register(name, binding) {
              registrations.push({ name, keys: [...binding.keys] });
              api.input.register(name, binding);
            },
          },
        });
      },
    },
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => 320,
      cssHeight: () => 180,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  const cues: string[] = [];
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  await engine.initialize();
  const d = engine.debug;
  function key(code: string, down = true) {
    target.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  }
  async function tap(code: string) {
    key(code);
    await engine.advance(1);
    key(code, false);
  }
  function pointer(
    type: "down" | "move" | "up",
    x: number,
    y: number,
    device = "mouse",
    id = 1,
  ) {
    target.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x / 4,
        clientY: y / 4,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: type === "move" ? -1 : 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  }
  function pose(fn: (s: CaromState) => CaromState) {
    engine.apply(fn);
  }
  function flight(x: number, y: number, vx: number, vy = 0, spin = 0) {
    pose((s) => d.clearWorld(s));
    pose((s) => d.spawnBall(s));
    pose((s) => d.setBallHeld(s, false));
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setBallPosition(s, x, y));
    pose((s) => d.setBallVelocity(s, vx, vy));
    pose((s) => d.setBallSpin(s, spin));
  }
  return { engine, d, key, tap, pointer, pose, flight, cues, registrations };
}

describe("engine and value-state contract", () => {
  it("initializes every declared field and registers only the specified vocabulary", async () => {
    const h = await setup();
    const s = h.d.snapshot(h.engine.state);
    expect(h.registrations).toEqual(
      C.ACTIONS.map((name) => ({ name, keys: [...C.BINDINGS[name]] })),
    );
    expect(s).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      mode: "solo",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      simTime: 0,
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      muted: false,
      ai: { tracking: true, movement: true },
      obstacleClock: 0,
      obstacleClockRunning: true,
    });
    expect(s.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: true,
      holdTimer: C.HOLD_TIME,
      vx: 0,
      vy: 0,
      spin: 0,
      trail: [],
    });
    expect(s.obstacles).toEqual([obstaclePose(0, 0), obstaclePose(1, 0)]);
    expect(s.paddles.left).toEqual({
      cy: C.FIELD_CY,
      vy: 0,
      driven: false,
      drivenVy: 0,
    });
    expect(h.engine.diagnostics().every((r) => r.error === undefined)).toBe(
      true,
    );
    expect(h.engine.diagnostics().length).toBeGreaterThanOrEqual(14);
  });
  it("leaves previous values unchanged and advances only simTime on menus", async () => {
    const h = await setup();
    const old = h.engine.state,
      copy = structuredClone(old);
    await h.engine.advance(20);
    expect(old).toEqual(copy);
    expect(h.engine.state.simTime).toBeCloseTo(0.16);
    expect(h.engine.state.ball).toEqual(old.ball);
    expect(h.engine.state.obstacles).toEqual(old.obstacles);
    const snap = h.d.snapshot(h.engine.state);
    expect(snap).not.toBe(h.engine.state);
    expect(h.d.reconcile(h.engine.state)).toEqual(h.engine.state);
  });
  it("reports live diagnostic readings without changing the world", async () => {
    const h = await setup();
    h.flight(250, 100, 300, 400, 125);
    const before = structuredClone(h.engine.state);
    const readings = Object.fromEntries(
      h.engine.diagnostics().map((r) => [r.name, r.value]),
    );
    expect(readings["ball.speed"]).toBe(500);
    expect(readings["ball.spin"]).toBe(125);
    expect(readings.screen).toBe("playing");
    expect(h.engine.state).toEqual(before);
  });
});

describe("menus and input", () => {
  it("wraps navigation and prioritizes movement over confirm, and up over down", async () => {
    const h = await setup();
    h.key("KeyW");
    h.key("KeyS");
    h.key("Enter");
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("title");
    expect(h.engine.state.menuIndex).toBe(2);
    h.key("KeyW", false);
    h.key("KeyS", false);
    h.key("Enter", false);
    await h.tap("ArrowDown");
    expect(h.engine.state.menuIndex).toBe(0);
  });
  it("remembers how-to selection and returns by confirm or back", async () => {
    const h = await setup();
    await h.tap("KeyW");
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("howto");
    expect(h.engine.state.titleIndex).toBe(2);
    await h.tap("Enter");
    expect(h.engine.state.menuIndex).toBe(2);
    await h.tap("Enter");
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("title");
    expect(h.engine.state.menuIndex).toBe(2);
  });
  it("starts versus, freezes countdown with one Escape and resumes only once", async () => {
    const h = await setup();
    await h.tap("KeyS");
    await h.tap("Enter");
    expect(h.engine.state.mode).toBe("versus");
    expect(h.engine.state.screen).toBe("countdown");
    const timer = h.engine.state.ball?.holdTimer;
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("paused");
    const clock = h.engine.state.obstacleClock;
    await h.engine.advance(50);
    expect(h.engine.state.ball?.holdTimer).toBe(timer);
    expect(h.engine.state.obstacleClock).toBe(clock);
    h.key("KeyS");
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("countdown");
    h.key("KeyS", false);
  });
  it("restart resets a match, quit restores the remembered title, matchover supports replay and back", async () => {
    const h = await setup();
    await h.tap("KeyS");
    await h.tap("Enter");
    h.pose((s) => h.d.setScore(s, 5, 4));
    await h.tap("KeyP");
    await h.tap("ArrowDown");
    await h.tap("Enter");
    expect(h.engine.state.score).toEqual({ p1: 0, p2: 0 });
    expect(h.engine.state.mode).toBe("versus");
    await h.tap("KeyP");
    await h.tap("KeyW");
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("title");
    expect(h.engine.state.menuIndex).toBe(1);
    h.pose((s) => h.d.setScreen(s, "matchover"));
    h.pose((s) => h.d.setMenuIndex(s, 0));
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("countdown");
    h.pose((s) => h.d.setScreen(s, "matchover"));
    await h.tap("Escape");
    expect(h.engine.state.screen).toBe("title");
    h.pose((s) => h.d.setScreen(s, "matchover"));
    h.pose((s) => h.d.setMenuIndex(s, 1));
    await h.tap("Enter");
    expect(h.engine.state.screen).toBe("title");
  });
  it.each(["mouse", "touch"])(
    "selects and confirms %s regions over one or several frames",
    async (device) => {
      const h = await setup();
      const r = h.d.menuItemRect(h.engine.state, 1)!;
      h.pointer("move", r.x + 10, r.y + 10, device);
      await h.engine.advance(1);
      expect(h.engine.state.menuIndex).toBe(1);
      h.pointer("down", r.x + 10, r.y + 10, device);
      await h.engine.advance(2);
      h.pointer("up", r.x + 10, r.y + 10, device);
      await h.engine.advance(1);
      expect(h.engine.state.screen).toBe("countdown");
      expect(h.engine.state.mode).toBe("versus");
      h.pose((s) => h.d.reset(s));
      h.pointer("down", 150, 380, device);
      h.pointer("up", 150, 380, device);
      await h.engine.advance(1);
      expect(h.engine.state.mode).toBe("solo");
    },
  );
  it("rejects cross-region and outside clicks; keyboard confirmation beats pointer confirmation", async () => {
    const h = await setup();
    h.pointer("down", 150, 380);
    h.pointer("up", 150, 460);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("title");
    h.pointer("down", 20, 20);
    h.pointer("up", 150, 380);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("title");
    h.pose((s) => h.d.setMenuIndex(s, 2));
    h.key("Enter");
    h.pointer("down", 150, 380);
    h.pointer("up", 150, 380);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("howto");
    expect(h.d.menuItemRect(h.engine.state, 1)).toBeNull();
    h.pose((s) => h.d.setScreen(s, "playing"));
    expect(h.d.menuItemRect(h.engine.state, 0)).toBeNull();
  });
  it("toggles mute on any screen and mirrors debug mute into the bus", async () => {
    const h = await setup();
    await h.tap("KeyM");
    expect(h.engine.state.muted).toBe(true);
    h.pose((s) => h.d.setMuted(s, false));
    await h.engine.advance(1);
    expect(h.engine.state.muted).toBe(false);
    h.pose((s) => h.d.setScreen(s, "paused"));
    await h.tap("KeyM");
    expect(h.engine.state.muted).toBe(true);
  });
});

describe("paddles and AI", () => {
  it("uses both control pairs for solo and separate pairs for versus, including countdown", async () => {
    const h = await setup(10);
    await h.tap("Enter");
    h.key("ArrowDown");
    await h.engine.advance(10);
    expect(h.engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.1,
    );
    expect(h.engine.state.paddles.right.cy).toBe(C.FIELD_CY);
    h.pose((s) => h.d.setMode(s, "versus"));
    const left = h.engine.state.paddles.left.cy;
    await h.engine.advance(10);
    expect(h.engine.state.paddles.left.cy).toBe(left);
    expect(h.engine.state.paddles.right.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.1,
    );
  });
  it("integrates driven velocity, stores it separately and computes actual clamped velocity", async () => {
    const h = await setup(10);
    await h.tap("Enter");
    h.pose((s) => h.d.setPaddleVy(s, "left", 800));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
    h.pose((s) => h.d.setPaddleDriven(s, "left", true));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(800);
    h.pose((s) => h.d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBeCloseTo(200);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
    expect(h.engine.state.paddles.left.drivenVy).toBe(800);
    h.pose((s) => h.d.setPaddleCy(s, "left", C.PADDLE_MIN_CY));
    h.pose((s) => h.d.setPaddleVy(s, "left", -500));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.left.vy).toBe(0);
  });
  it("AI defends rightward flight, returns home, and gates tracking and movement independently", async () => {
    const h = await setup(10);
    h.flight(850, 540, 200, 100);
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    h.pose((s) => h.d.setAiMovement(s, false));
    const cy = h.engine.state.paddles.right.cy;
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.cy).toBe(cy);
    expect(h.engine.state.paddles.right.vy).toBe(0);
    h.pose((s) => h.d.setAiMovement(s, true));
    h.pose((s) => h.d.setAiTracking(s, false));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(0);
    h.pose((s) => h.d.setPaddleCy(s, "right", 600));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    h.pose((s) => h.d.setPaddleDriven(s, "right", true));
    h.pose((s) => h.d.setPaddleVy(s, "right", 100));
    await h.engine.advance(1);
    expect(h.engine.state.paddles.right.vy).toBe(100);
  });
});

describe("ball and contact simulation", () => {
  it.each([-1, 1] as const)(
    "serves with sign %s only when its timer expires, without advancing on that frame",
    async (sign) => {
      const h = await setup(10);
      await h.tap("Enter");
      h.pose((s) => h.d.setBallServeSign(s, sign));
      h.pose((s) => h.d.setBallHoldTimer(s, 0.015));
      await h.engine.advance(1);
      expect(h.engine.state.ball?.held).toBe(true);
      await h.engine.advance(1);
      const b = h.engine.state.ball!;
      expect(h.engine.state.screen).toBe("playing");
      expect(b.x).toBe(C.FIELD_CX);
      expect(b.vx).toBeCloseTo(-C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE));
      expect(b.vy).toBeCloseTo(sign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE));
      expect(b.serveSign).toBe(sign);
      await h.engine.advance(1);
      expect(h.engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
    },
  );
  it("draws serve signs afresh on every parking and draw, preserving the sign during flight", async () => {
    const h = await setup();
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.2);
    h.pose((s) => h.d.spawnBall(s));
    expect(h.engine.state.ball?.serveSign).toBe(-1);
    h.pose((s) => h.d.spawnBall(s));
    expect(h.engine.state.ball?.serveSign).toBe(1);
    h.pose((s) => h.d.drawBallServeSign(s));
    expect(h.engine.state.ball?.serveSign).toBe(-1);
  });
  it("turns velocity without changing speed and decays spin by its half-life", async () => {
    const h = await setup(8);
    h.flight(600, 300, 200, 0, 100);
    await h.engine.advance(100);
    const b = h.engine.state.ball!;
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(200);
    expect(b.spin).toBeCloseTo(50);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.trail.length).toBeGreaterThan(1);
    expect(
      b.trail.every((p) => h.engine.state.simTime - p.t <= C.TRAIL_TIME),
    ).toBe(true);
  });
  it.each([
    [-100, C.BALL_R + 0.2],
    [100, C.FIELD_H - C.BALL_R - 0.2],
  ])(
    "reflects walls at vy %s without changing spin or speed",
    async (vy, y) => {
      const h = await setup();
      h.flight(600, y, 0, vy);
      await h.engine.advance(1);
      expect(h.engine.state.ball!.vy).toBe(-vy);
      expect(h.engine.state.ball!.y).toBe(
        vy < 0 ? C.BALL_R : C.FIELD_H - C.BALL_R,
      );
      expect(h.cues).toEqual([C.CUES.wallBounce]);
    },
  );
  it.each(["left", "right"] as const)(
    "bounces off the %s paddle, adds its integrated motion and caps speed",
    async (side: Side) => {
      const h = await setup();
      h.flight(
        side === "left" ? C.P1_X1 + C.BALL_R + 2 : C.P2_X0 - C.BALL_R - 2,
        C.FIELD_CY,
        side === "left" ? -C.SPEED_CAP : C.SPEED_CAP,
      );
      h.pose((s) => h.d.setPaddleDriven(s, side, true));
      h.pose((s) => h.d.setPaddleVy(s, side, 300));
      await h.engine.advance(1);
      const b = h.engine.state.ball!;
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(C.SPEED_CAP);
      expect(Math.sign(b.vx)).toBe(side === "left" ? 1 : -1);
      expect(b.spin).toBeGreaterThan(240);
      expect(h.cues).toEqual([C.CUES.paddleHit]);
    },
  );
  it("reflects paddle endcaps like a wall without adding spin", async () => {
    const h = await setup();
    h.flight(
      C.P1_X0 + C.PADDLE_W / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 0.1,
      0,
      100,
    );
    await h.engine.advance(1);
    expect(h.engine.state.ball!.vy).toBe(-100);
    expect(h.engine.state.ball!.spin).toBe(0);
    expect(h.cues).toEqual([C.CUES.wallBounce]);
  });
  it.each([0, Math.PI / 4, Math.PI / 2])(
    "reflects an oriented obstacle at theta %s",
    async (theta) => {
      const h = await setup();
      const t = theta / C.OBSTACLE_SPIN_RATE,
        o = obstaclePose(0, t);
      const nx = Math.cos(theta),
        ny = Math.sin(theta);
      h.flight(
        o.cx + nx * (C.OBSTACLE_HW + C.BALL_R + 1),
        o.cy + ny * (C.OBSTACLE_HW + C.BALL_R + 1),
        -500 * nx,
        -500 * ny,
      );
      h.pose((s) => h.d.setObstacleClock(s, t));
      h.pose((s) => h.d.setObstacleClockRunning(s, false));
      h.pose((s) => h.d.spawnObstacle(s, 0));
      await h.engine.advance(1);
      const b = h.engine.state.ball!;
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(500);
      expect(b.vx * nx + b.vy * ny).toBeCloseTo(500);
      expect(h.cues).toEqual([C.CUES.obstacleBounce]);
    },
  );
  it("pushes an inside obstacle pose out of the least-penetrated face", async () => {
    const h = await setup();
    h.flight(490, 220, 0);
    h.pose((s) => h.d.spawnObstacle(s, 0));
    h.pose((s) => h.d.setObstacleClockRunning(s, false));
    await h.engine.advance(1);
    expect(h.engine.state.ball!.x).toBe(490 + C.OBSTACLE_HW + C.BALL_R);
    expect(h.cues).toEqual([]);
  });
  it("sways in anti-phase, rotates continuously, freezes, and reconciles without advancing", async () => {
    const h = await setup(10);
    await h.tap("Enter");
    await h.engine.advance(44);
    const t = h.engine.state.obstacleClock;
    expect(h.engine.state.obstacles).toEqual([
      obstaclePose(0, t),
      obstaclePose(1, t),
    ]);
    h.pose((s) => h.d.setObstacleClock(s, 0.9));
    expect(h.engine.state.obstacles[0].cy).toBeCloseTo(300);
    expect(h.engine.state.obstacles[1].cy).toBeCloseTo(420);
    h.pose((s) => h.d.setObstacleClockRunning(s, false));
    await h.engine.advance(10);
    expect(h.engine.state.obstacleClock).toBe(0.9);
    const old = structuredClone(h.engine.state);
    h.pose((s) => h.d.reconcile(s));
    expect(h.engine.state).toEqual(old);
  });
  it("handles an absent world without drawing, collisions, timers or scoring", async () => {
    const h = await setup();
    h.pose((s) => h.d.clearWorld(s));
    h.pose((s) => h.d.setScreen(s, "countdown"));
    await h.engine.advance(5);
    expect(h.engine.state.ball).toBeNull();
    expect(h.engine.state.obstacles).toEqual([]);
    expect(h.engine.state.screen).toBe("countdown");
    expect(h.cues).toEqual([]);
    expect(() => h.pose((s) => h.d.setBallSpin(s, 10))).toThrow("No ball");
    expect(() => h.pose((s) => h.d.spawnObstacle(s, 2))).toThrow();
  });
});

describe("scoring and time-step agreement", () => {
  it.each(["left", "right"] as const)(
    "scores for %s only beyond the whole goal, parks and serves toward the receiver",
    async (side) => {
      const h = await setup();
      h.flight(
        side === "left" ? C.FIELD_W + C.BALL_R + 1 : -C.BALL_R - 1,
        100,
        side === "left" ? 100 : -100,
      );
      await h.engine.advance(1);
      expect(h.engine.state.score).toEqual({
        p1: side === "left" ? 1 : 0,
        p2: side === "right" ? 1 : 0,
      });
      expect(h.engine.state.receiver).toBe(side === "left" ? "right" : "left");
      expect(h.engine.state.ball?.trail).toEqual([]);
      expect(h.cues).toEqual([C.CUES.score]);
      h.pose((s) => h.d.setBallHoldTimer(s, 0));
      await h.engine.advance(1);
      expect(Math.sign(h.engine.state.ball!.vx)).toBe(side === "left" ? 1 : -1);
    },
  );
  it("continues at deuce until a two-point lead, then leaves the winning ball in place", async () => {
    const h = await setup();
    h.flight(C.FIELD_W + C.BALL_R + 1, 100, 100);
    h.pose((s) => h.d.setScore(s, 10, 10));
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("countdown");
    h.flight(C.FIELD_W + C.BALL_R + 1, 100, 100);
    await h.engine.advance(1);
    expect(h.engine.state.screen).toBe("matchover");
    expect(h.engine.state.winner).toBe("left");
    expect(h.engine.state.score).toEqual({ p1: 12, p2: 10 });
    expect(h.engine.state.ball!.x).toBeGreaterThan(C.FIELD_W);
    await h.engine.advance(1);
  });
  it("also resolves a right-side victory through real play", async () => {
    const h = await setup();
    h.flight(-C.BALL_R - 1, 100, -100);
    h.pose((s) => h.d.setScore(s, 9, 10));
    await h.engine.advance(1);
    expect(h.engine.state.winner).toBe("right");
  });
  it("reaches the same paddle contacts, wall bounces and goal at 2 and 16 ms", async () => {
    async function drive(step: number) {
      const h = await setup(step);
      h.flight(150, C.FIELD_CY, -600, -150, 90);
      h.pose((s) => h.d.setAiMovement(s, false));
      let frames = 0;
      while (h.engine.state.screen === "playing" && frames++ < 2500)
        await h.engine.advance(1);
      return {
        events: h.cues,
        score: h.engine.state.score,
        time: h.engine.state.simTime,
        speed: Math.hypot(h.engine.state.ball!.vx, h.engine.state.ball!.vy),
      };
    }
    const a = await drive(2),
      b = await drive(16);
    expect(a.events).toEqual(b.events);
    expect(a.score).toEqual(b.score);
    expect(Math.abs(a.time - b.time) / a.time).toBeLessThan(0.08);
    expect(Math.abs(a.speed - b.speed)).toBeLessThan(10);
  });
});

describe("debug poses", () => {
  it("sets each independent field without advancing or changing its neighbors; reset releases everything", async () => {
    const h = await setup();
    h.pose((s) => h.d.setTitleIndex(s, 2));
    h.pose((s) => h.d.setResumeScreen(s, "countdown"));
    h.pose((s) => h.d.setWinner(s, "right"));
    h.pose((s) => h.d.setReceiver(s, "right"));
    h.pose((s) => h.d.setMode(s, "versus"));
    h.pose((s) => h.d.setPaddleDriven(s, "left", true));
    h.pose((s) => h.d.setPaddleVy(s, "left", 123));
    h.pose((s) => h.d.setPaddleCy(s, "left", 99));
    h.pose((s) => h.d.setBallVelocity(s, 300, 400));
    h.pose((s) => h.d.setBallPosition(s, 90, 200));
    h.pose((s) => h.d.setBallSpin(s, -123));
    h.pose((s) => h.d.setBallHeld(s, false));
    h.pose((s) => h.d.setBallHoldTimer(s, 0.25));
    h.pose((s) => h.d.setMuted(s, true));
    const before = structuredClone(h.engine.state);
    h.pose((s) => h.d.reconcile(s));
    expect(h.engine.state).toEqual(before);
    const snap = h.d.snapshot(h.engine.state);
    expect(snap.ball).toMatchObject({
      x: 90,
      y: 200,
      speed: 500,
      spin: -123,
      held: false,
      holdTimer: 0.25,
    });
    expect(snap.paddles.left).toEqual({
      cy: 99,
      vy: 0,
      drivenVy: 123,
      driven: true,
    });
    expect(snap.resumeScreen).toBe("countdown");
    expect(snap.titleIndex).toBe(2);
    expect(snap.winner).toBe("right");
    expect(snap.simTime).toBe(0);
    h.pose((s) => h.d.reset(s));
    expect(h.engine.state.muted).toBe(true);
    expect(h.engine.state.simTime).toBe(0);
    expect(h.engine.state.titleIndex).toBe(0);
    expect(h.engine.state.paddles.left.driven).toBe(false);
    expect(h.engine.state.paddles.left.drivenVy).toBe(0);
  });
  it("re-spawns existing obstacles in index order and replaces the ball with a fresh held one", async () => {
    const h = await setup();
    h.pose((s) => h.d.clearWorld(s));
    h.pose((s) => h.d.setObstacleClock(s, 1.5));
    h.pose((s) => h.d.spawnObstacle(s, 1));
    h.pose((s) => h.d.spawnObstacle(s, 0));
    h.pose((s) => h.d.spawnObstacle(s, 1));
    expect(h.engine.state.obstacles).toEqual([
      obstaclePose(0, 1.5),
      obstaclePose(1, 1.5),
    ]);
    h.pose((s) => h.d.spawnBall(s));
    expect(h.engine.state.ball?.held).toBe(true);
    expect(h.engine.state.ball?.holdTimer).toBe(C.HOLD_TIME);
  });
  it("records its real drawing without unsupported values", async () => {
    const h = await setup();
    h.engine.startRecording();
    await h.engine.advance(1);
    await h.tap("Enter");
    await h.engine.advance(1);
    const recording = h.engine.stopRecording();
    expect(recording.frames).toHaveLength(3);
    expect(JSON.stringify(recording)).not.toContain("$opaque");
  });
});
