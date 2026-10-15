import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { createDebug } from "./debug";
import { initialState, advanceWorld } from "./simulation";
import { readMenus } from "./menus";
import { render } from "./render";

export const BACKGROUND = "#0c141b";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;

  /** In-progress menu gestures; consumed on release, never part of the world. */
  readonly menuPresses?: readonly {
    readonly id: number;
    readonly index: number;
    readonly screen: Screen;
  }[];
}

export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export type CaromSnapshot = Omit<CaromState, "ball" | "menuPresses"> & {
  readonly version: number;
  readonly ball: (BallState & { readonly speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(state: DeepReadonly<CaromState>): CaromState;
  spawnBall(state: DeepReadonly<CaromState>): CaromState;
  spawnObstacle(state: DeepReadonly<CaromState>, index: number): CaromState;
  reset(state: DeepReadonly<CaromState>): CaromState;
  reconcile(state: DeepReadonly<CaromState>): CaromState;
  setScreen(state: DeepReadonly<CaromState>, screen: Screen): CaromState;
  setMode(state: DeepReadonly<CaromState>, mode: Mode): CaromState;
  setMenuIndex(state: DeepReadonly<CaromState>, index: number): CaromState;
  setTitleIndex(state: DeepReadonly<CaromState>, index: number): CaromState;
  setResumeScreen(
    state: DeepReadonly<CaromState>,
    screen: "countdown" | "playing",
  ): CaromState;
  setScore(state: DeepReadonly<CaromState>, p1: number, p2: number): CaromState;
  setWinner(state: DeepReadonly<CaromState>, side: Side | null): CaromState;
  setReceiver(state: DeepReadonly<CaromState>, side: Side): CaromState;
  setPaddleCy(
    state: DeepReadonly<CaromState>,
    side: Side,
    cy: number,
  ): CaromState;
  setPaddleVy(
    state: DeepReadonly<CaromState>,
    side: Side,
    vy: number,
  ): CaromState;
  setPaddleDriven(
    state: DeepReadonly<CaromState>,
    side: Side,
    driven: boolean,
  ): CaromState;
  setBallPosition(
    state: DeepReadonly<CaromState>,
    x: number,
    y: number,
  ): CaromState;
  setBallVelocity(
    state: DeepReadonly<CaromState>,
    vx: number,
    vy: number,
  ): CaromState;
  setBallSpin(state: DeepReadonly<CaromState>, spin: number): CaromState;
  setBallHeld(state: DeepReadonly<CaromState>, held: boolean): CaromState;
  setBallHoldTimer(
    state: DeepReadonly<CaromState>,
    seconds: number,
  ): CaromState;
  setBallServeSign(state: DeepReadonly<CaromState>, sign: 1 | -1): CaromState;
  drawBallServeSign(state: DeepReadonly<CaromState>): CaromState;
  setAiTracking(state: DeepReadonly<CaromState>, enabled: boolean): CaromState;
  setAiMovement(state: DeepReadonly<CaromState>, enabled: boolean): CaromState;
  setMuted(state: DeepReadonly<CaromState>, muted: boolean): CaromState;
  setObstacleClock(state: DeepReadonly<CaromState>, t: number): CaromState;
  setObstacleClockRunning(
    state: DeepReadonly<CaromState>,
    running: boolean,
  ): CaromState;
  snapshot(state: DeepReadonly<CaromState>): CaromSnapshot;
  menuItemRect(state: DeepReadonly<CaromState>, index: number): MenuRect | null;
}

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 630,
      freqTo: 260,
      durationMs: 75,
      gain: 0.22,
    });
    api.audio.define(C.CUES.wallBounce, {
      wave: "sine",
      freq: 310,
      freqTo: 180,
      durationMs: 45,
      gain: 0.16,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "square",
      freq: 880,
      freqTo: 460,
      durationMs: 65,
      gain: 0.08,
    });
    api.audio.define(C.CUES.score, {
      wave: "triangle",
      freq: 280,
      freqTo: 760,
      durationMs: 240,
      gain: 0.2,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1", (s) => s.score.p1);
    api.diagnostics.register("p2", (s) => s.score.p2);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "none");
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
    return [initialState(), createDebug()];
  },
  update(
    state: DeepReadonly<CaromState>,
    api: UpdateApi,
    dt: number,
  ): CaromState {
    const edges = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    ) as Record<C.ActionName, boolean>;
    api.audio.setMuted(edges.mute ? !state.muted : state.muted);
    let s: CaromState = {
      ...state,
      simTime: state.simTime + dt,
      muted: api.audio.muted(),
    };
    s = readMenus(s, api.input, edges);
    const held = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.value(a) > 0]),
    ) as Record<C.ActionName, boolean>;
    const up = held["p1-up"] || (s.mode === "solo" && held["p2-up"]);
    const down = held["p1-down"] || (s.mode === "solo" && held["p2-down"]);
    const events = new Set<C.CueName>();
    s = advanceWorld(
      s,
      dt,
      {
        left: Number(down) - Number(up),
        right: Number(held["p2-down"]) - Number(held["p2-up"]),
      },
      events,
    );
    for (const cue of events) api.audio.play(cue);
    return s;
  },
  render,
};
