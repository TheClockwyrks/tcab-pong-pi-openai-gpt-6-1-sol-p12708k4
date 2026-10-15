import type { DeepReadonly } from "ts-essentials";
import type {
  BallState,
  CaromState,
  Mode,
  ObstacleState,
  PaddleState,
} from "./game";
import * as C from "./constants";

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export const serveSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parkedBall(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: serveSign(),
    trail: [],
  };
}
export function obstaclePose(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new RangeError(`No obstacle ${index}`);
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted = false): CaromState {
  const paddle = (): PaddleState => ({
    cy: C.FIELD_CY,
    vy: 0,
    driven: false,
    drivenVy: 0,
  });
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: paddle(), right: paddle() },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstaclePose(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function startMatch(
  s: DeepReadonly<CaromState>,
  mode: Mode,
): CaromState {
  return {
    ...s,
    screen: "countdown",
    mode,
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, 0)),
  };
}
export function toTitle(s: DeepReadonly<CaromState>): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function integrate(
  p: DeepReadonly<PaddleState>,
  vy: number,
  dt: number,
): PaddleState {
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
export interface Movement {
  readonly left: number;
  readonly right: number;
}
export function movePaddles(
  s: DeepReadonly<CaromState>,
  axis: Movement,
  dt: number,
): CaromState {
  const left = s.paddles.left,
    right = s.paddles.right;
  let rv = axis.right * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    const defending =
      s.ai.tracking &&
      s.screen === "playing" &&
      s.ball !== null &&
      s.ball.vx > 0;
    const target =
      defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
    const diff = target - right.cy;
    rv =
      !s.ai.movement ||
      Math.abs(diff) <= (defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE) ||
      dt <= 0
        ? 0
        : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  return {
    ...s,
    paddles: {
      left: integrate(
        left,
        left.driven ? left.drivenVy : axis.left * C.PADDLE_SPEED,
        dt,
      ),
      right: integrate(right, right.driven ? right.drivenVy : rv, dt),
    },
  };
}

// Mutable scratch values belong to this one call, never to the supplied state.
type Flight = { -readonly [K in keyof BallState]: BallState[K] };
function paddleCollision(
  b: Flight,
  p: DeepReadonly<PaddleState>,
  left: boolean,
  events: Set<C.CueName>,
): void {
  const x0 = left ? C.P1_X0 : C.P2_X0,
    x1 = left ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  if (!(
    b.x > x0 - C.BALL_R &&
    b.x < x1 + C.BALL_R &&
    b.y > y0 - C.BALL_R &&
    b.y < y1 + C.BALL_R
  ))
    return;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const theta =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (left ? 1 : -1) * speed * Math.cos(theta);
    b.vy = speed * Math.sin(theta);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    events.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
  }
}
function obstacleCollision(
  b: Flight,
  o: DeepReadonly<ObstacleState>,
  events: Set<C.CueName>,
): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  let qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const ex = lx - qx,
    ey = ly - qy,
    distance = Math.hypot(ex, ey);
  if (distance >= C.BALL_R) return;
  let nlx: number, nly: number;
  if (distance > 0) {
    nlx = ex / distance;
    nly = ey / distance;
  } else if (C.OBSTACLE_HW - Math.abs(lx) <= C.OBSTACLE_HH - Math.abs(ly)) {
    nlx = lx < 0 ? -1 : 1;
    nly = 0;
    qx = nlx * C.OBSTACLE_HW;
  } else {
    nlx = 0;
    nly = ly < 0 ? -1 : 1;
    qy = nly * C.OBSTACLE_HH;
  }
  const nx = nlx * c - nly * s,
    ny = nlx * s + nly * c;
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
    events.add(C.CUES.obstacleBounce);
  }
  const px = qx + nlx * C.BALL_R,
    py = qy + nly * C.BALL_R;
  b.x = o.cx + px * c - py * s;
  b.y = o.cy + px * s + py * c;
}
export function flyBall(
  s: DeepReadonly<CaromState>,
  dt: number,
  events: Set<C.CueName>,
): BallState | null {
  if (!s.ball || s.ball.held) return s.ball;
  const b: Flight = { ...s.ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h,
        c = Math.cos(angle),
        sn = Math.sin(angle);
      const vx = b.vx * c - b.vy * sn;
      b.vy = b.vx * sn + b.vy * c;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    paddleCollision(b, s.paddles.left, true, events);
    paddleCollision(b, s.paddles.right, false, events);
    for (const o of s.obstacles) obstacleCollision(b, o, events);
  }
  return b;
}
export function advanceWorld(
  state: DeepReadonly<CaromState>,
  dt: number,
  axis: Movement,
  events: Set<C.CueName>,
): CaromState {
  if (state.screen !== "playing" && state.screen !== "countdown") return state;
  let s = movePaddles(state, axis, dt);
  let b = s.ball;
  if (b) {
    if (b.held) {
      const timer = b.holdTimer - dt;
      b = { ...b, holdTimer: Math.max(0, timer) };
      if (timer <= 0) {
        b = {
          ...b,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        };
        s = { ...s, screen: "playing" };
      }
    } else if (s.screen === "playing") b = flyBall(s, dt, events);
    if (b)
      b = {
        ...b,
        trail: [
          ...b.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
          { x: b.x, y: b.y, t: s.simTime },
        ],
      };
  }
  s = { ...s, ball: b };
  if (b && !b.held && (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)) {
    const scorer = b.x > C.FIELD_CX ? "left" : "right";
    const score = {
      p1: s.score.p1 + (scorer === "left" ? 1 : 0),
      p2: s.score.p2 + (scorer === "right" ? 1 : 0),
    };
    const won =
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD);
    s = {
      ...s,
      score,
      ...(won
        ? ({ screen: "matchover", winner: scorer, menuIndex: 0 } as const)
        : ({
            screen: "countdown",
            receiver: scorer === "left" ? "right" : "left",
            ball: parkedBall(),
          } as const)),
    };
    events.add(C.CUES.score);
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  return {
    ...s,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, clock)),
  };
}
