// Move templates. A character is a list of templates filled with numbers and
// names; the engine only reads the resulting data.
//
// Units: distances in stage pixels, times in 60 Hz frames.
// timing = [startup, active, recovery]; the first active frame is `startup`
// frames after the press. reach is measured forward from the body centre;
// band = [low, high] above the attacker's feet. drive = forward pixels per frame
// during startup + active. damage is per hit; hits are spread evenly across the
// active frames. hitstun / blockstun count frames after hitstop ends.

const LIGHT_CHAIN = ['standA', 'standB', 'crouchA', 'crouchB'];
const CANCEL = ['special', 'super'];

function notationOf({ motion, button, stance, forward, near }) {
  if (button === 'ab') return 'A+B';
  const key = button.toUpperCase();
  if (near) return `近身 4/6${key}`;
  if (motion) return `${motion}${key}`;
  if (forward) return `6${key}`;
  if (stance === 'crouch') return `2${key}`;
  if (stance === 'air') return `j.${key}`;
  return key;
}

function move({ id, name, description, kind, input, pose, level = 'mid', damage = 0, reach = 0, band = [0, 0],
  timing, drive = 0, hits = 1, hitstun = 0, blockstun = 0, ...extra }) {
  if (!Array.isArray(timing) || timing.length !== 3) throw new TypeError(`${id}: timing must be [startup, active, recovery]`);
  return { id, name, description, kind, input, notation: notationOf(input), pose, level, damage, reach, band,
    timing, drive, hits, hitstun, blockstun, ...extra };
}

// ---- Shared normals -------------------------------------------------------

const NORMALS = {
  standA: { name: '站 A', description: '最快的直拳，可连打，可取消。', input: { button: 'a', stance: 'stand' }, pose: 'light',
    damage: 4, reach: 82, band: [56, 100], timing: [4, 3, 8], hitstun: 15, blockstun: 10, chain: LIGHT_CHAIN, cancel: CANCEL },
  standB: { name: '站 B', description: '短促的中段踢，可连打，可取消。', input: { button: 'b', stance: 'stand' }, pose: 'light',
    damage: 5, reach: 92, band: [30, 82], timing: [5, 3, 9], hitstun: 15, blockstun: 10, chain: LIGHT_CHAIN, cancel: CANCEL },
  standC: { name: '近 C', description: '贴身重拳，命中或被防时可取消接必杀。', input: { button: 'c', stance: 'stand' }, pose: 'heavy',
    damage: 10, reach: 88, band: [44, 106], timing: [6, 4, 15], hitstun: 22, blockstun: 15, cancel: CANCEL },
  standD: { name: '站 D', description: '远距离重踢，打点远但收招长。', input: { button: 'd', stance: 'stand' }, pose: 'heavy',
    damage: 11, reach: 116, band: [40, 100], timing: [9, 4, 18], hitstun: 20, blockstun: 14 },
  crouchA: { name: '蹲 A', description: '蹲姿快拳，中段，可连打。', input: { button: 'a', stance: 'crouch' }, pose: 'light',
    damage: 4, reach: 78, band: [26, 70], timing: [4, 3, 8], hitstun: 15, blockstun: 10, chain: LIGHT_CHAIN, cancel: CANCEL },
  crouchB: { name: '蹲 B', description: '扫脚踝的低段轻踢，可连打，可取消。', input: { button: 'b', stance: 'crouch' }, pose: 'light',
    level: 'low', damage: 4, reach: 92, band: [0, 30], timing: [5, 3, 9], hitstun: 15, blockstun: 10, chain: LIGHT_CHAIN, cancel: CANCEL },
  crouchC: { name: '蹲 C', description: '向上斜打的重拳，可取消，兼作对空。', input: { button: 'c', stance: 'crouch' }, pose: 'heavy',
    damage: 9, reach: 86, band: [20, 150], timing: [6, 4, 16], hitstun: 20, blockstun: 14, cancel: CANCEL },
  crouchD: { name: '蹲 D', description: '低段扫腿，命中击倒，被防后破绽大。', input: { button: 'd', stance: 'crouch' }, pose: 'heavy',
    level: 'low', damage: 10, reach: 120, band: [0, 26], timing: [8, 4, 22], hitstun: 20, blockstun: 12, knockdown: true },
  airA: { name: '跳 A', description: '空中快拳。', input: { button: 'a', stance: 'air' }, pose: 'light',
    level: 'overhead', damage: 5, reach: 72, band: [30, 84], timing: [4, 8, 0], hitstun: 15, blockstun: 10 },
  airB: { name: '跳 B', description: '空中斜下踢，判定持续。', input: { button: 'b', stance: 'air' }, pose: 'light',
    level: 'overhead', damage: 5, reach: 82, band: [0, 54], timing: [4, 10, 0], hitstun: 15, blockstun: 10 },
  airC: { name: '跳 C', description: '空中重拳，跳入起手。', input: { button: 'c', stance: 'air' }, pose: 'heavy',
    level: 'overhead', damage: 9, reach: 82, band: [20, 76], timing: [7, 8, 0], hitstun: 22, blockstun: 14 },
  airD: { name: '跳 D', description: '空中重踢，向下压的跳入起手。', input: { button: 'd', stance: 'air' }, pose: 'heavy',
    level: 'overhead', damage: 10, reach: 96, band: [-14, 44], timing: [6, 10, 0], hitstun: 24, blockstun: 14 },
  throw: { name: '投', description: '贴身 ←/→ + C 抓摔，无视防御；对方跳跃或受击中抓不到。', kind: 'throw',
    input: { button: 'c', near: true }, pose: 'heavy', level: 'throw', damage: 12, reach: 74, band: [0, 104],
    timing: [1, 1, 20], knockdown: true },
};

// tuning: per-slot overrides; ids: rename a slot (e.g. { crouchD: 'sitSpin' }).
export function normalSet(tuning = {}, ids = {}) {
  return Object.entries(NORMALS).map(([slot, base]) => {
    const id = ids[slot] ?? slot;
    return move({ kind: 'normal', ...base, ...tuning[slot], id });
  });
}

// ---- Character templates ---------------------------------------------------

// Command normal: direction + button, e.g. 6B step kick or 6C overhead.
export const commandNormal = ({ button, ...spec }) =>
  move({ kind: 'command', input: { button, forward: true, stance: 'stand' }, pose: 'heavy', ...spec });

// 236P ×3: each stage may follow the previous one within `window` frames after it connects.
export function rekka({ ids, names, descriptions, motion = '236', button = 'p', window = 14, stages }) {
  return stages.map((stage, i) => move({
    id: ids[i], name: names[i], description: descriptions[i], kind: 'special', input: { motion, button },
    pose: 'special', ...stage,
    ...(i < stages.length - 1 ? { followUp: { move: ids[i + 1], window } } : { knockdown: true }),
  }));
}

// 623 + button: invulnerable rise that covers the air above.
export const risingAntiAir = ({ button = 'p', ...spec }) =>
  move({ kind: 'special', input: { motion: '623', button }, pose: 'special', knockdown: true, ...spec });

// [2]8 + button: the charge version of the rising anti-air.
export const chargeRise = ({ button = 'k', ...spec }) =>
  move({ kind: 'special', input: { motion: '[2]8', button }, pose: 'special', knockdown: true, ...spec });

// Projectile specials. One projectile per fighter on screen; opposing ones cancel out.
export const projectile = ({ motion = '236', button = 'p', projectile: shot, ...spec }) =>
  move({ kind: 'special', input: { motion, button }, pose: 'special', projectile: { low: false, ...shot }, ...spec });

export const chargeProjectile = spec => projectile({ motion: '[4]6', ...spec });

// 236K: a low wave along the floor; jump over it.
export const groundWave = ({ button = 'k', projectile: shot, ...spec }) =>
  projectile({ motion: '236', button, level: 'low', projectile: { ...shot, low: true }, ...spec });

// 41236P: a grab from close range; ignores guard, long recovery when it misses.
export const commandThrow = ({ button = 'p', ...spec }) =>
  move({ kind: 'special', input: { motion: '41236', button }, pose: 'special', level: 'throw', knockdown: true, ...spec });

// 214K: travelling multi-hit spin, knocks down on its last hit.
export const spinRush = ({ button = 'k', motion = '214', ...spec }) =>
  move({ kind: 'special', input: { motion, button }, pose: 'special', knockdown: true, ...spec });

// 236 / 214 + button: a single long-travel strike.
export const rushStrike = ({ motion = '236', button = 'p', ...spec }) =>
  move({ kind: 'special', input: { motion, button }, pose: 'special', ...spec });

// 236236 + button: costs 50 meter, darkens the screen, invulnerable start.
export const superMove = ({ button = 'p', ...spec }) =>
  move({ kind: 'super', input: { motion: '236236', button }, pose: 'special', cost: 50, knockdown: true, ...spec });

// A+B: the character's own defence. method = evade | counter | brace.
//   evade: invulnerable over `invulnerable` while sliding back by `retreat` per active frame;
//   counter: a strike landing during the active frames is caught and the attacker staggers;
//   brace: guards every level during the active frames and earns extra meter.
export const defense = ({ method, cooldown, retreat = 0, ...spec }) =>
  move({ id: 'defense', kind: 'defense', input: { button: 'ab' }, pose: 'defense', level: 'mid', method, cooldown, retreat, ...spec });

export function moveset(...groups) {
  const moves = {};
  for (const m of groups.flat()) {
    if (moves[m.id]) throw new Error(`duplicate move id ${m.id}`);
    moves[m.id] = m;
  }
  return moves;
}
