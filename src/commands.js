// Input history and command recognition. Directions are stored relative to the
// fighter's facing in numpad notation (6 = forward, 4 = back, 2 = down …), so
// every command is written once for a right-facing fighter and mirrors itself.

export const HISTORY = 64;    // frames kept; enough for a full charge plus its release
const LATE = 4;               // the button may follow the final direction by this many frames
const MOTION_WINDOW = 15;     // first to last direction of a special motion
const SUPER_WINDOW = 30;      // first to last direction of a double motion
const CHARGE = 40;            // frames the charge direction must be held
const CHARGE_RELEASE = 8;     // frames allowed between leaving the charge and pushing the release
const PAIR = 3;               // A+B may be pressed up to this many frames apart

const sequence = (digits, window) => ({ tokens: [...digits].map(Number), window });
const charge = (hold, release) => ({ hold: new Set(hold), release: new Set(release) });

// Recognition priority: a double motion beats its single half, 623 beats 236.
// (An array, not an object: numeric-looking object keys would be reordered.)
const MOTIONS = [
  ['236236', sequence('236236', SUPER_WINDOW)],
  ['41236', sequence('41236', MOTION_WINDOW)],
  ['623', sequence('623', MOTION_WINDOW)],
  ['[4]6', charge([1, 4, 7], [3, 6, 9])],
  ['[2]8', charge([1, 2, 3], [7, 8, 9])],
  ['214', sequence('214', MOTION_WINDOW)],
  ['236', sequence('236', MOTION_WINDOW)],
];
export const MOTION_PRIORITY = MOTIONS.map(([name]) => name);
const BUTTONS = ['a', 'b', 'c', 'd'];

export function relativeDirection(input, facing) {
  const x = (Number(!!input.right) - Number(!!input.left)) * facing;
  const y = input.up ? 1 : input.down ? -1 : 0;
  return 5 + x + 3 * y;
}

// Find the tokens in order, newest first; the last one must be fresh and the
// whole motion must fit its window. Other directions may sit between tokens.
function completes(dirs, { tokens, window }) {
  const newest = dirs.length - 1;
  let i = newest, end = -1;
  for (let t = tokens.length - 1; t >= 0; t--) {
    while (i >= 0 && dirs[i] !== tokens[t]) i--;
    if (i < 0) return false;
    if (end < 0) {
      if (newest - i > LATE) return false;
      end = i;
    }
    if (end - i > window) return false;
    i--;
  }
  return true;
}

function charged(dirs, { hold, release }) {
  let i = dirs.length - 1;
  while (i >= 0 && dirs.length - 1 - i <= LATE && !release.has(dirs[i])) i--;
  if (i < 0 || dirs.length - 1 - i > LATE) return false;
  let j = i - 1;
  while (j >= 0 && i - j <= CHARGE_RELEASE && !hold.has(dirs[j])) j--;
  if (j < 0 || i - j > CHARGE_RELEASE) return false;
  let held = 0;
  while (j >= 0 && hold.has(dirs[j])) { held++; j--; }
  return held >= CHARGE;
}

export function recognize(dirs) {
  const found = new Set();
  for (const [name, motion] of MOTIONS) {
    if (motion.tokens ? completes(dirs, motion) : charged(dirs, motion)) found.add(name);
  }
  return found;
}

export function createInputLog() {
  return { frame: 0, dirs: [], lastPress: { a: -Infinity, b: -Infinity, c: -Infinity, d: -Infinity } };
}

// Record one frame. Returns a press when any button went down this frame,
// carrying everything needed to resolve it later (it may sit in a buffer).
export function record(log, input, facing) {
  const dir = relativeDirection(input, facing);
  log.dirs.push(dir);
  if (log.dirs.length > HISTORY) log.dirs.shift();
  const frame = log.frame++;
  const pressed = BUTTONS.filter(button => input[button]);
  for (const button of pressed) log.lastPress[button] = frame;
  if (!pressed.length) return null;
  const press = { dir, motions: recognize(log.dirs), age: 0, ab: false };
  for (const button of BUTTONS) press[button] = !!input[button];
  press.ab = (press.a || press.b) &&
    frame - log.lastPress.a < PAIR && frame - log.lastPress.b < PAIR;
  return press;
}

const BUTTON_GROUPS = { a: ['a'], b: ['b'], c: ['c'], d: ['d'], p: ['a', 'c'], k: ['b', 'd'] };

// Does a press satisfy a move's input (ignoring stance / distance, which the engine checks)?
export function pressMatches(press, input) {
  if (input.button === 'ab') return press.ab;
  if (!BUTTON_GROUPS[input.button].some(button => press[button])) return false;
  if (input.motion) return press.motions.has(input.motion);
  if (input.forward) return press.dir === 6;
  return true;
}

// Frames of absolute input that perform a move's command — used by the CPU.
const MOTION_DIRS = { '236': [2, 3, 6], '623': [6, 2, 3], '214': [2, 1, 4], '41236': [4, 1, 2, 3, 6], '236236': [2, 3, 6, 2, 3, 6] };
const DEFAULT_BUTTON = { p: 'a', k: 'b' };

export function absoluteInput(dir, facing) {
  const x = ((dir - 1) % 3) - 1, y = Math.floor((dir - 1) / 3) - 1;
  const input = {};
  if (x * facing > 0) input.right = true;
  if (x * facing < 0) input.left = true;
  if (y > 0) input.up = true;
  if (y < 0) input.down = true;
  return input;
}

export function commandFrames(input, facing) {
  const button = DEFAULT_BUTTON[input.button] ?? input.button;
  const buttons = button === 'ab' ? { a: true, b: true } : { [button]: true };
  let dirs;
  if (input.motion === '[4]6') dirs = [...Array(CHARGE + 2).fill(1), 6];
  else if (input.motion === '[2]8') dirs = [...Array(CHARGE + 2).fill(1), 8];
  else if (input.motion) dirs = MOTION_DIRS[input.motion];
  else if (input.forward || input.near) dirs = [6];
  else if (input.stance === 'crouch') dirs = [2];
  else dirs = [5];
  return dirs.map((dir, i) => ({ ...absoluteInput(dir, facing), ...(i === dirs.length - 1 ? buttons : {}) }));
}
