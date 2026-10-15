import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { menuItems, menuItemRect } from "./menus";

const P = {
  bg: "#0c141b",
  panel: "#111f28",
  line: "#253640",
  muted: "#7e959f",
  white: "#edf4ef",
  mint: "#9cf4cc",
  coral: "#ff8d7b",
  gold: "#e9c774",
};
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = P.white,
  weight = "500",
  align: CanvasTextAlign = "left",
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 17 ? '"Courier New", monospace' : "Arial, sans-serif"}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color = P.line,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function round(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(
  ctx: Context,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function arrow(ctx: Context, x: number, y: number, color: string): void {
  line(ctx, x, y, x + 18, y, color, 2);
  line(ctx, x + 11, y - 6, x + 18, y, color, 2);
  line(ctx, x + 11, y + 6, x + 18, y, color, 2);
}
function background(ctx: Context): void {
  const gradient = ctx.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    30,
    C.FIELD_CX,
    C.FIELD_CY,
    780,
  );
  gradient.addColorStop(0, "#14242c");
  gradient.addColorStop(1, P.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.strokeStyle = "#20323b";
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  for (let x = 0; x <= C.FIELD_W; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.FIELD_H);
  }
  for (let y = 0; y <= C.FIELD_H; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(C.FIELD_W, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function brand(ctx: Context, muted: boolean): void {
  round(ctx, 46, 38, 28, 28, 7, P.mint);
  line(ctx, 55, 47, 55, 57, P.bg, 3);
  line(ctx, 65, 47, 65, 57, P.bg, 3);
  circle(ctx, 60, 52, 2, P.bg);
  text(ctx, "CAROM / FIELD NOTES", 88, 53, 12, P.muted);
  text(
    ctx,
    "A GAME OF ANGLES",
    C.FIELD_W - 48,
    53,
    12,
    P.muted,
    "500",
    "right",
  );
  line(ctx, 46, 84, C.FIELD_W - 46, 84);
  line(ctx, 46, 667, C.FIELD_W - 46, 667);
  text(ctx, "W S / ↑ ↓  SELECT     ENTER  PLAY", 48, 692, 12, P.muted);
  text(
    ctx,
    muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 48,
    692,
    12,
    P.muted,
    "500",
    "right",
  );
}
function buttons(ctx: Context, s: DeepReadonly<CaromState>): void {
  menuItems(s.screen).forEach((item, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const active = s.menuIndex === i;
    round(ctx, r.x, r.y, r.w, r.h, 4, active ? P.mint : P.panel);
    if (!active) {
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      active ? "#39594d" : P.muted,
    );
    text(
      ctx,
      item,
      r.x + 59,
      r.y + r.h / 2,
      19,
      active ? P.bg : P.white,
      "700",
    );
    arrow(ctx, r.x + r.w - 44, r.y + r.h / 2, active ? P.bg : P.muted);
  });
}
function titleDiagram(ctx: Context): void {
  const x = 650,
    y = 205,
    w = 520,
    h = 326;
  round(ctx, x, y, w, h, 12, "#101e27");
  ctx.strokeStyle = "#334750";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([5, 9]);
  line(ctx, x + w / 2, y + 18, x + w / 2, y + h - 18, "#344c57");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#29414a";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 57, 0, Math.PI * 2);
  ctx.stroke();
  round(ctx, x + 22, y + 170, 8, 63, 4, P.mint);
  round(ctx, x + w - 30, y + 100, 8, 63, 4, P.coral);
  ctx.save();
  ctx.translate(x + 178, y + 100);
  ctx.rotate(-0.45);
  round(ctx, -5, -34, 10, 68, 4, P.gold);
  ctx.restore();
  ctx.save();
  ctx.translate(x + 342, y + 226);
  ctx.rotate(-0.45);
  round(ctx, -5, -34, 10, 68, 4, P.gold);
  ctx.restore();
  ctx.strokeStyle = P.mint;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x + 36, y + 200);
  ctx.bezierCurveTo(x + 110, y + 170, x + 125, y + 300, x + 246, y + 265);
  ctx.bezierCurveTo(x + 325, y + 240, x + 210, y + 64, x + 366, y + 65);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.shadowColor = P.white;
  ctx.shadowBlur = 23;
  circle(ctx, x + 366, y + 65, C.BALL_R, P.white);
  ctx.restore();
  circle(ctx, x + 366, y + 65, 23, "#edf4ef0c");
  text(ctx, "01 / THE CURVE", x, y - 29, 12, P.mint);
  text(ctx, "MOVE. STRIKE. BEND THE RALLY.", x, y + h + 35, 12, P.muted);
  line(ctx, x + 366, y + 36, x + 405, y - 25, P.muted);
  text(ctx, "SPIN", x + 412, y - 27, 11, P.muted);
  for (const [mx, my] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]) {
    line(ctx, mx - 5, my, mx + 5, my, P.muted);
    line(ctx, mx, my - 5, mx, my + 5, P.muted);
  }
}
function title(ctx: Context, s: DeepReadonly<CaromState>): void {
  brand(ctx, s.muted);
  text(ctx, "PADDLE DUEL  /  NO. 001", 112, 150, 12, P.mint);
  text(ctx, C.TITLE_TEXT, 101, 237, 122, P.white, "italic 900");
  round(ctx, 112, 302, 28, 3, 1, P.mint);
  text(ctx, "Not just back and forth.", 153, 304, 20, P.muted);
  buttons(ctx, s);
  text(ctx, "1 PLAYER", 504, 385, 10, P.muted);
  text(ctx, "2 PLAYERS", 504, 455, 10, P.muted);
  text(ctx, "THE GUIDE", 504, 525, 10, P.muted);
  titleDiagram(ctx);
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE}. WIN BY ${C.WIN_LEAD}. MAKE IT CURVE.`,
    112,
    615,
    12,
    P.muted,
  );
}
function keycap(ctx: Context, key: string, x: number, y: number, w = 42): void {
  round(ctx, x, y, w, 36, 5, "#20343e");
  text(ctx, key, x + w / 2, y + 18, 14, P.white, "700", "center");
}
function howto(ctx: Context, s: DeepReadonly<CaromState>): void {
  brand(ctx, s.muted);
  text(ctx, "THE PLAYBOOK", 110, 147, 12, P.mint);
  text(ctx, "Find your angle.", 108, 211, 58, P.white, "700");
  text(
    ctx,
    `Beat the other paddle to ${C.WIN_SCORE}. At deuce, take a ${C.WIN_LEAD}-point lead.`,
    111,
    267,
    19,
    P.muted,
  );
  const xs = [110, 505, 900];
  const headings = [
    "01 / TAKE CONTROL",
    "02 / PUT SPIN ON IT",
    "03 / PLAY THE BANK",
  ];
  xs.forEach((x, i) => {
    line(ctx, x, 311, x + 275, 311, P.line);
    text(ctx, headings[i], x, 342, 12, [P.mint, P.coral, P.gold][i]);
  });
  keycap(ctx, "W", 110, 374);
  keycap(ctx, "S", 160, 374);
  keycap(ctx, "↑", 242, 374);
  keycap(ctx, "↓", 292, 374);
  text(ctx, "LEFT / P1", 110, 433, 12, P.muted);
  text(ctx, "RIGHT / P2", 242, 433, 12, P.muted);
  text(ctx, "Solo: either pair moves you.", 110, 473, 16, P.white);
  text(ctx, "Versus: one pair per player.", 110, 499, 16, P.white);
  round(ctx, 508, 376, 7, 56, 3, P.coral);
  ctx.strokeStyle = P.coral;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(526, 408);
  ctx.quadraticCurveTo(598, 405, 660, 372);
  ctx.stroke();
  arrow(ctx, 646, 373, P.coral);
  text(ctx, "Strike while moving to curve", 505, 473, 16, P.white);
  text(ctx, "the ball. Edge hits go wider.", 505, 499, 16, P.white);
  ctx.save();
  ctx.translate(962, 405);
  ctx.rotate(-0.55);
  round(ctx, -5, -34, 10, 68, 3, P.gold);
  ctx.restore();
  line(ctx, 910, 433, 945, 400, P.gold, 2);
  line(ctx, 945, 400, 1055, 414, P.gold, 2);
  text(ctx, "Moving obstacles change the", 900, 473, 16, P.white);
  text(ctx, "rally. Use them, or avoid them.", 900, 499, 16, P.white);
  buttons(ctx, s);
  text(
    ctx,
    "P / ESC  PAUSE     M  MUTE     TOUCH  USE SIDE SLIDERS",
    520,
    618,
    12,
    P.muted,
  );
}
function field(ctx: Context, s: DeepReadonly<CaromState>): void {
  // All furniture shares the simulation's logical coordinates and live poses.
  ctx.setLineDash([7, 13]);
  line(ctx, C.NET_X, 110, C.NET_X, C.FIELD_H - 65, "#31424b");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#253842";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 72, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 0, 2, C.FIELD_W, 2, "#49616c", 3);
  line(ctx, 0, C.FIELD_H - 2, C.FIELD_W, C.FIELD_H - 2, "#49616c", 3);
  for (let y = 24; y < C.FIELD_H; y += 32) {
    line(ctx, 14, y, 20, y, "#2b424a");
    line(ctx, C.FIELD_W - 20, y, C.FIELD_W - 14, y, "#2b424a");
  }
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? P.mint : P.coral;
    const cy = s.paddles[side].cy;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    round(ctx, x, cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, 7, color);
    ctx.restore();
    line(
      ctx,
      x + C.PADDLE_W / 2,
      cy - 12,
      x + C.PADDLE_W / 2,
      cy + 12,
      "#0c141b44",
      2,
    );
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = "#e9c77455";
    ctx.shadowBlur = 16;
    round(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      7,
      P.gold,
    );
    ctx.shadowBlur = 0;
    circle(ctx, 0, 0, 3, "#8d7541");
    ctx.restore();
  }
  const b = s.ball;
  if (b) {
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      const fade = Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME);
      ctx.globalAlpha = fade * 0.5;
      ctx.lineCap = "round";
      line(ctx, a.x, a.y, p.x, p.y, P.white, C.BALL_R * 1.5 * fade);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowBlur = 23;
    ctx.shadowColor = P.white;
    circle(ctx, b.x, b.y, C.BALL_R, P.white);
    ctx.restore();
  }
  text(
    ctx,
    s.mode === "solo" ? "YOU / P1" : "PLAYER / 01",
    C.FIELD_CX - 100,
    33,
    11,
    P.mint,
    "500",
    "center",
  );
  text(
    ctx,
    s.mode === "solo" ? "CPU / P2" : "PLAYER / 02",
    C.FIELD_CX + 100,
    33,
    11,
    P.coral,
    "500",
    "center",
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 100,
    82,
    64,
    P.white,
    "700",
    "center",
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 100,
    82,
    64,
    P.white,
    "700",
    "center",
  );
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN vs MACHINE" : "VERSUS / LOCAL DUEL",
    48,
    34,
    12,
    P.muted,
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} / LEAD BY ${C.WIN_LEAD}`,
    C.FIELD_W - 48,
    34,
    12,
    P.muted,
    "500",
    "right",
  );
  text(ctx, "P / ESC  PAUSE", 48, C.FIELD_H - 28, 12, P.muted);
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 48,
    C.FIELD_H - 28,
    12,
    P.muted,
    "500",
    "right",
  );
  text(ctx, "SPIN", C.FIELD_CX - 102, C.FIELD_H - 28, 11, P.muted);
  line(
    ctx,
    C.FIELD_CX - 50,
    C.FIELD_H - 28,
    C.FIELD_CX + 70,
    C.FIELD_H - 28,
    "#314851",
    3,
  );
  const spin = b?.spin ?? 0;
  line(
    ctx,
    C.FIELD_CX + 10,
    C.FIELD_H - 28,
    C.FIELD_CX + 10 + (spin / C.SPIN_CLAMP) * 60,
    C.FIELD_H - 28,
    spin >= 0 ? P.mint : P.coral,
    3,
  );
  circle(ctx, C.FIELD_CX + 10, C.FIELD_H - 28, 3, P.white);
  if (s.screen === "countdown") {
    text(
      ctx,
      "GET READY",
      C.FIELD_CX,
      C.FIELD_CY - 69,
      12,
      P.mint,
      "700",
      "center",
    );
    text(
      ctx,
      s.receiver === "left" ? "← YOUR COURT" : "OPPONENT'S COURT →",
      C.FIELD_CX,
      C.FIELD_CY + 60,
      12,
      P.muted,
      "500",
      "center",
    );
    const progress =
      1 - Math.min(1, (b?.holdTimer ?? C.HOLD_TIME) / C.HOLD_TIME);
    line(
      ctx,
      C.FIELD_CX - 35,
      C.FIELD_CY + 84,
      C.FIELD_CX + 35,
      C.FIELD_CY + 84,
      P.line,
      3,
    );
    line(
      ctx,
      C.FIELD_CX - 35,
      C.FIELD_CY + 84,
      C.FIELD_CX - 35 + 70 * progress,
      C.FIELD_CY + 84,
      P.mint,
      3,
    );
  }
}
function overlay(ctx: Context, s: DeepReadonly<CaromState>): void {
  ctx.fillStyle = "#091016df";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  line(ctx, C.FIELD_CX - 200, 167, C.FIELD_CX + 200, 167, P.line);
  if (s.screen === "paused") {
    text(ctx, "RALLY ON HOLD", C.FIELD_CX, 207, 12, P.mint, "500", "center");
    text(ctx, "Take a breath.", C.FIELD_CX, 267, 58, P.white, "700", "center");
    text(
      ctx,
      `${s.score.p1} — ${s.score.p2}   /   ${s.mode.toUpperCase()}`,
      C.FIELD_CX,
      315,
      14,
      P.muted,
      "500",
      "center",
    );
  } else {
    text(ctx, "MATCH COMPLETE", C.FIELD_CX, 207, 12, P.gold, "500", "center");
    const winner =
      s.winner === "left"
        ? s.mode === "solo"
          ? "You take it."
          : "Player one wins."
        : s.mode === "solo"
          ? "Machine wins."
          : "Player two wins.";
    text(
      ctx,
      winner,
      C.FIELD_CX,
      265,
      56,
      s.winner === "left" ? P.mint : P.coral,
      "700",
      "center",
    );
    text(
      ctx,
      `${s.score.p1}  —  ${s.score.p2}`,
      C.FIELD_CX,
      316,
      27,
      P.white,
      "700",
      "center",
    );
  }
  buttons(ctx, s);
  text(
    ctx,
    "ONE MORE ANGLE. ONE MORE RALLY.",
    C.FIELD_CX,
    616,
    12,
    P.muted,
    "500",
    "center",
  );
}
export function render(s: DeepReadonly<CaromState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  background(ctx);
  if (s.screen === "title") title(ctx, s);
  else if (s.screen === "howto") howto(ctx, s);
  else {
    field(ctx, s);
    if (s.screen === "paused" || s.screen === "matchover") overlay(ctx, s);
  }
  ctx.restore();
}
