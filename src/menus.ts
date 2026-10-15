import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState, MenuRect, Screen } from "./game";
import * as C from "./constants";
import { startMatch, toTitle } from "./simulation";

export function menuItems(screen: Screen): readonly string[] {
  switch (screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(
  s: DeepReadonly<CaromState>,
  index: number,
): MenuRect | null {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= menuItems(s.screen).length
  )
    return null;
  if (s.screen === "title")
    return { x: 110, y: 356 + index * 70, w: 370, h: 58 };
  if (s.screen === "howto") return { x: 110, y: 590, w: 370, h: 58 };
  return { x: C.FIELD_CX - 200, y: 355 + index * 70, w: 400, h: 58 };
}
function hit(s: DeepReadonly<CaromState>, x: number, y: number): number {
  return menuItems(s.screen).findIndex((_, i) => {
    const r = menuItemRect(s, i);
    return (
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
  });
}
function confirm(s: DeepReadonly<CaromState>): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return toTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : toTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : toTitle(s);
    default:
      return s;
  }
}
export function readMenus(
  state: CaromState,
  input: UpdateApi["input"],
  edges: Readonly<Record<C.ActionName, boolean>>,
): CaromState {
  let s = state;
  const screen = s.screen;
  // Read each pointer source once; samples retain both edges of quick taps.
  const samples = input.pointerSamples();
  const contacts = input.pointerContacts();
  input.pointer();
  if ((screen === "playing" || screen === "countdown") && edges.pause)
    return {
      ...s,
      screen: "paused",
      resumeScreen: screen,
      menuIndex: 0,
      menuPresses: [],
    };
  if (screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: [] };
  if ((screen === "howto" || screen === "matchover") && edges.back)
    return toTitle(s);
  const count = menuItems(screen).length;
  if (count === 0) return { ...s, menuPresses: [] };
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  if (up || down)
    s = { ...s, menuIndex: (s.menuIndex + (up ? count - 1 : 1)) % count };
  const keyboardConfirm = !up && !down && edges.confirm;
  const keyboardItem = s.menuIndex;
  let presses = [...(s.menuPresses ?? [])].filter((p) => p.screen === screen);
  let pointerConfirm = false;
  for (const sample of samples) {
    const index = hit(s, sample.x, sample.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (sample.type === "down" && sample.button === "primary") {
      presses = [
        ...presses.filter((p) => p.id !== sample.id),
        { id: sample.id, index, screen },
      ];
    }
    if (sample.type === "up") {
      const origin = presses.find((p) => p.id === sample.id);
      if (origin && origin.index >= 0 && origin.index === index)
        pointerConfirm = true;
      presses = presses.filter((p) => p.id !== sample.id);
    }
  }
  // Held contacts also select after a keyboard edge without requiring a move.
  for (const contact of contacts) {
    if (contact.device !== "touch") continue;
    const index = hit(s, contact.x, contact.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  s = { ...s, menuPresses: presses };
  if (keyboardConfirm)
    return { ...confirm({ ...s, menuIndex: keyboardItem }), menuPresses: [] };
  if (pointerConfirm) return { ...confirm(s), menuPresses: [] };
  return s;
}
