import { fighters as roster } from './roster.js';
import { commandFrames, createInputLog, MOTION_PRIORITY, pressMatches, record } from './commands.js';

const LEFT = 48, RIGHT = 912, BODY = 50, GRAVITY = 0.72;
const STAND_HEIGHT = 104, CROUCH_HEIGHT = 61;
const SUPER_FLASH = 30;     // frozen frames of darkened screen when a super starts
const BUFFER = 5;           // simulated frames a press waits for its move to become possible
const CANCEL_WINDOW = 12;   // simulated frames after contact in which chains and cancels stay open
const KARA = 3;             // a normal this young turns into the defence when A+B completes
const PREJUMP = 3;          // grounded frames before take-off; specials may still come out
const KNOCKDOWN = 36, GETUP = 10;
const HITSTOP = { light: 6, heavy: 9, special: 11, super: 14, throw: 8 };
const KIND_RANK = { super: 0, special: 1, defense: 2, throw: 3, command: 4, normal: 5 };
const motionRank = move => move.input.motion ? MOTION_PRIORITY.indexOf(move.input.motion) : MOTION_PRIORITY.length;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const within = (tick, [from, to]) => tick >= from && tick <= to;
const airborne = f => f.y > 0 || f.vy !== 0;
const height = f => f.crouched ? CROUCH_HEIGHT : STAND_HEIGHT;
const category = move => move.kind === 'normal' || move.kind === 'command' ? move.pose : move.kind;

// Per character: moves in recognition priority and the ids only reachable as follow-ups.
const catalog = new Map(roster.map(profile => {
  const moves = Object.values(profile.moves);
  const order = [...moves].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || motionRank(a) - motionRank(b));
  const followOnly = new Set(moves.flatMap(m => m.followUp ? [m.followUp.move] : []));
  return [profile.id, { profile, order, followOnly }];
}));

function fighter(id, x, facing) {
  const entry = catalog.get(id);
  if (!entry) throw new RangeError(`未知角色：${id}`);
  return {
    id, profile: entry.profile, x, y: 0, facing, hp: 100, meter: 0, pose: 'idle', poseTick: 0, anim: 'idle',
    moveId: null, crouched: false, guard: null, defenseCooldown: 0,
    action: null, vy: 0, airX: 0, log: createInputLog(), presses: [],
  };
}

// options.timeLimit: round length in seconds, or null for an untimed practice round.
export function createMatch(playerId, cpuId, { timeLimit = 60 } = {}) {
  return {
    fighters: [fighter(playerId, 306, 1), fighter(cpuId, 654, -1)],
    ticks: 0, timeLimit, remaining: timeLimit, winner: null, events: [],
    projectiles: [], hitstop: 0, superFlash: 0,
    combo: [{ hits: 0, damage: 0 }, { hits: 0, damage: 0 }],
    brain: { next: 0, plan: [], hold: {} },
  };
}

// ---- CPU -------------------------------------------------------------------
// The CPU reads the previous visible frame only and speaks through the same
// input format as a player, queueing whole command sequences when it commits.

function cpuInput(state) {
  const brain = state.brain;
  if (brain.plan.length) return brain.plan.shift();
  if (state.ticks < brain.next) return brain.hold;
  brain.next = state.ticks + 6 + Math.floor(Math.random() * 8);
  brain.hold = decide(state, brain);
  return brain.hold;
}

function decide(state, brain) {
  const [foe, self] = state.fighters;
  const toward = self.x < foe.x ? 1 : -1, distance = Math.abs(foe.x - self.x);
  const back = toward > 0 ? 'left' : 'right', forward = toward > 0 ? 'right' : 'left';
  const moves = Object.values(self.profile.moves), roll = Math.random();
  const queue = frames => { brain.plan = frames.slice(1); return frames[0]; };
  const perform = move => queue(commandFrames(move.input, toward));
  const pick = test => {
    const options = moves.filter(m => test(m) && !catalog.get(self.id).followOnly.has(m.id));
    return options[Math.floor(Math.random() * options.length)];
  };
  const charge = m => m.input.motion?.startsWith('[');

  const threat = foe.action?.kind === 'move' && foe.action.move.kind !== 'defense' ? foe.action.move : null;
  if (threat && distance < threat.reach + threat.drive * threat.timing[0] + 40 && roll < 0.8) {
    const defense = self.profile.moves.defense;
    if (roll < 0.14 && !self.defenseCooldown) return perform(defense);
    return { [back]: true, down: threat.level === 'low' };
  }
  const shot = state.projectiles.find(p => p.owner === 0 && Math.abs(p.x - self.x) < 220);
  if (shot && roll < 0.75) {
    const low = foe.profile.moves[shot.moveId].projectile.low;
    return low && roll < 0.5 ? queue([{ up: true, [forward]: true }, ...Array(6).fill({ [forward]: true })]) : { [back]: true };
  }
  if (airborne(foe) && distance < 180 && roll < 0.5) {
    const antiAir = pick(m => m.kind === 'special' && m.invulnerable && !charge(m));
    if (antiAir) return perform(antiAir);
    return { [back]: true };
  }
  if (self.meter >= 50 && distance < 130 && roll < 0.25) return perform(pick(m => m.kind === 'super'));
  if (distance < 85 && roll < 0.2) return perform(pick(m => m.level === 'throw'));
  if (distance < 100 && roll < 0.75) {
    const finisher = roll < 0.4 && pick(m => m.kind === 'special' && m.level !== 'throw');
    if (finisher && charge(finisher)) {
      // Charge while crouch-guarding, jab low from the charge, then release into the special.
      const frames = commandFrames(finisher.input, toward), hold = frames[0];
      return queue([...frames.slice(0, -1), { ...hold, b: true }, ...Array(8).fill(hold), frames.at(-1)]);
    }
    const opener = pick(m => (m.kind === 'normal' || m.kind === 'command') && m.input.stance !== 'air' && m.level !== 'throw');
    return queue([...commandFrames(opener.input, toward), ...Array(8).fill({}), ...(finisher ? commandFrames(finisher.input, toward) : [])]);
  }
  if (distance < 300 && roll < 0.3) {
    const special = pick(m => m.kind === 'special' && m.level !== 'throw' && (m.projectile || m.drive > 0 || charge(m)));
    if (special) return perform(special);
  }
  if (distance > 110 && distance < 270 && roll > 0.9) {
    return queue([...Array(4).fill({ up: true, [forward]: true }), ...Array(18).fill({}), { d: true }]);
  }
  return { [distance < 90 && roll > 0.82 ? back : forward]: true };
}

// ---- Moves -----------------------------------------------------------------

function invulnerable(f) {
  const act = f.action;
  if (act?.kind === 'down') return true;
  return act?.kind === 'move' && act.move.kind !== 'defense' && !!act.move.invulnerable &&
    within(act.tick, act.move.invulnerable);
}

function throwable(f) {
  const act = f.action;
  if (airborne(f) || (act && act.kind !== 'move') || invulnerable(f)) return false;
  return !(act?.move.method === 'evade' && within(act.tick, act.move.invulnerable));
}

function allowed(state, index, f, move, press) {
  const other = state.fighters[1 - index], act = f.action;
  const { followOnly } = catalog.get(f.id);
  if (move.cost && f.meter < move.cost) return false;
  if (move.kind === 'defense' && f.defenseCooldown) return false;
  if (move.projectile && state.projectiles.some(p => p.owner === index)) return false;
  const stance = airborne(f) ? 'air' : press.dir <= 3 ? 'crouch' : 'stand';
  if (move.input.stance ? move.input.stance !== stance : stance === 'air') return false;
  if (move.kind === 'throw' &&
      ((press.dir !== 4 && press.dir !== 6) || !throwable(other) || Math.abs(other.x - f.x) > move.reach)) return false;
  if (!act) return !followOnly.has(move.id);
  if (act.kind === 'prejump') return (move.kind === 'special' || move.kind === 'super') && !followOnly.has(move.id);
  if (act.kind !== 'move') return false;
  const current = act.move;
  if (move.kind === 'defense') return current.kind === 'normal' && act.tick < KARA && act.contactAt === null;
  if (act.contactAt === null) return false;
  const since = act.tick - act.contactAt;
  if (current.followUp?.move === move.id) return since <= current.followUp.window;
  if (followOnly.has(move.id) || since > CANCEL_WINDOW) return false;
  return !!(current.chain?.includes(move.id) || current.cancel?.includes(move.kind));
}

function start(state, f, move, press) {
  const [startup, active, recovery] = move.timing;
  f.action = {
    kind: 'move', move, tick: 0, duration: startup + active + recovery, contactAt: null, hitsDone: 0,
    armorUsed: 0, aerial: airborne(f), back: press.dir === 4,
  };
  if (move.cost) f.meter -= move.cost;
  if (move.kind === 'super') state.superFlash = SUPER_FLASH;
  if (move.kind === 'defense') f.defenseCooldown = move.cooldown;
  f.crouched = move.input.stance === 'crouch';
  f.guard = null;
}

function act(state, index, f) {
  const { order } = catalog.get(f.id);
  for (let i = f.presses.length - 1; i >= 0; i--) {
    const press = f.presses[i];
    const move = order.find(m => pressMatches(press, m.input) && allowed(state, index, f, m, press));
    if (move) {
      start(state, f, move, press);
      f.presses.length = 0;
      return;
    }
  }
}

// ---- Fighter update --------------------------------------------------------

// A jump goes the last horizontal way held during its prejump frames.
function advance(f, direction) {
  const action = f.action;
  if (!action) return;
  action.tick++;
  if (action.kind === 'prejump' && direction) action.direction = direction;
  if (action.kind === 'down') {
    if (action.landedAt !== null && action.tick - action.landedAt >= KNOCKDOWN + GETUP) f.action = null;
  } else if (action.tick >= action.duration) {
    f.action = null;
    if (action.kind === 'prejump') {
      f.vy = f.profile.jumpSpeed;
      f.airX = action.direction * f.profile.speed * 1.07;
    }
  }
}

function spawnProjectile(state, index, f, move) {
  const { speed, w, h, low } = move.projectile;
  state.projectiles.push({
    owner: index, moveId: move.id, vfx: move.vfx ?? move.id,
    x: f.x + f.facing * 36, y: low ? 0 : 40, vx: f.facing * speed, age: 0, w, h,
  });
}

function updateFighter(state, index, toward, input) {
  const f = state.fighters[index];
  const direction = Number(!!input.right) - Number(!!input.left);
  advance(f, direction);
  if (f.defenseCooldown) f.defenseCooldown--;
  if (!f.action && !airborne(f)) f.facing = toward;
  if (f.presses.length) act(state, index, f);

  const action = f.action;
  if (!action && !airborne(f)) {
    f.crouched = !!input.down && !input.up;
    f.guard = direction === -toward ? (f.crouched ? 'crouch' : 'stand') : null;
    if (input.up) {
      f.action = { kind: 'prejump', tick: 0, duration: PREJUMP, direction };
      f.guard = null;
    } else if (!f.crouched) {
      f.x += direction * f.profile.speed * (f.guard ? 0.64 : 1);
    }
  } else if (action?.kind === 'guard') {
    f.crouched = !!input.down;
    f.guard = f.crouched ? 'crouch' : 'stand';
  } else if (!action) {
    f.guard = null;
  }

  if (action?.kind === 'move' && !action.aerial) {
    const { move } = action, [startup, active] = move.timing;
    if (action.tick < startup + active) {
      if (move.method === 'evade') {
        if (action.tick >= startup) f.x -= f.facing * move.retreat;
      } else f.x += f.facing * move.drive;
    }
    if (move.projectile && action.tick === startup) spawnProjectile(state, index, f, move);
  }

  if (airborne(f)) {
    f.x += f.airX;
    f.y = Math.max(0, f.y + f.vy);
    f.vy = f.y ? f.vy - GRAVITY : 0;
    if (!f.y) {
      f.airX = 0;
      if (f.action?.kind === 'move' && f.action.aerial) f.action = null;
      else if (f.action?.kind === 'down') f.action.landedAt = f.action.tick;
    }
  }
  f.x = clamp(f.x, LEFT, RIGHT);
  refreshPose(f, direction);
}

function refreshPose(f, direction) {
  const action = f.action;
  let pose;
  if (!action) pose = airborne(f) ? 'jump' : f.crouched ? 'crouch' : direction ? 'walk' : 'idle';
  else if (action.kind === 'move') pose = action.move.pose;
  else if (action.kind === 'prejump') pose = 'jump';
  else if (action.kind === 'down') {
    pose = action.landedAt === null ? 'hurt' : action.tick - action.landedAt < KNOCKDOWN ? 'ko' : 'crouch';
  } else pose = action.kind;
  const timed = action && action.kind !== 'down' && action.kind !== 'prejump';
  f.poseTick = timed ? action.tick : f.pose === pose ? f.poseTick + 1 : 0;
  f.pose = pose;
  f.moveId = action?.kind === 'move' ? action.move.id : null;
  f.anim = action?.kind === 'move' ? action.move.anim ?? action.move.id : pose;
}

function separate(a, b) {
  if (Math.abs(a.y - b.y) >= 70 || Math.abs(a.x - b.x) >= BODY) return;
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  left.x = clamp((left.x + right.x - BODY) / 2, LEFT, RIGHT - BODY);
  right.x = left.x + BODY;
}

// ---- Contact ---------------------------------------------------------------

function defendedBy(target, level) {
  const act = target.action;
  if (act?.kind === 'move' && act.move.kind === 'defense') {
    const defense = act.move, [startup, active] = defense.timing;
    const covered = defense.method === 'evade'
      ? within(act.tick, defense.invulnerable)
      : act.tick >= startup && act.tick < startup + active;
    if (covered) return defense.method;
  }
  if (target.guard && !airborne(target) && (!act || act.kind === 'guard')) {
    if (level === 'mid' || (level === 'low') === (target.guard === 'crouch')) return target.guard;
  }
  return null;
}

function armored(target) {
  const act = target.action;
  if (act?.kind !== 'move' || !act.move.armor || act.armorUsed >= act.move.armor) return false;
  const [startup, active] = act.move.timing;
  return act.tick < startup + active;
}

function judge(state, attacker, move, source, extra = {}) {
  const target = state.fighters[1 - attacker];
  const method = defendedBy(target, move.level);
  return {
    move, source, attacker, final: true, ...extra,
    method, type: method ? 'block' : 'hit', armored: !method && armored(target),
  };
}

function strike(state, index) {
  const f = state.fighters[index], target = state.fighters[1 - index], act = f.action;
  if (act?.kind !== 'move') return null;
  const { move } = act, [startup, active] = move.timing;
  if (move.kind === 'defense' || move.projectile) return null;
  if (move.level === 'throw') {
    if (act.tick !== startup || !throwable(target) || Math.abs(target.x - f.x) > move.reach) return null;
    act.contactAt = act.tick;
    return { move, source: 'throw', attacker: index, type: 'throw', method: null, final: true, back: act.back };
  }
  if (act.hitsDone >= move.hits || act.tick >= startup + active ||
      act.tick < startup + Math.floor(act.hitsDone * active / move.hits)) return null;
  const dx = (target.x - f.x) * f.facing, [low, high] = move.band;
  if (dx < -8 || dx > move.reach || f.y + high < target.y || f.y + low > target.y + height(target)) return null;
  if (invulnerable(target)) return null;
  act.hitsDone++;
  act.contactAt = act.tick;
  return judge(state, index, move, 'strike', { final: act.hitsDone === move.hits });
}

function gain(f, points) { f.meter = Math.min(100, f.meter + points); }

function push(attacker, target, distance) {
  const room = attacker.facing > 0 ? RIGHT - target.x : target.x - LEFT;
  target.x = clamp(target.x + attacker.facing * distance, LEFT, RIGHT);
  if (room < distance) attacker.x = clamp(attacker.x - attacker.facing * (distance - room), LEFT, RIGHT);
}

function knockDown(target, direction) {
  target.action = { kind: 'down', tick: 0, landedAt: null };
  target.vy = Math.max(target.vy, 5);
  target.airX = direction * 2.4;
  target.crouched = false;
  target.guard = null;
}

function resolve(state, contact) {
  const { move, attacker: index } = contact;
  const a = state.fighters[index], b = state.fighters[1 - index], combo = state.combo[index];
  const kind = category(move);
  const event = { type: contact.type, attacker: index, target: 1 - index, move: kind, moveId: move.id, damage: 0, combo: combo.hits };
  if (contact.type === 'block') {
    event.method = contact.method;
    gain(b, contact.method === 'brace' ? 17 : 8);
    if (move.kind !== 'super') gain(a, 3);
    if (contact.method === 'counter') {
      if (contact.source === 'strike') {
        a.action = { kind: 'hurt', tick: 0, duration: 27 };
        a.guard = null;
        refreshPose(a, 0);
      }
      b.action.duration = b.action.tick + 5;
    } else if (contact.method === 'stand' || contact.method === 'crouch') {
      b.action = { kind: 'guard', tick: 0, duration: move.blockstun };
      b.crouched = contact.method === 'crouch';
      if (contact.source === 'strike') push(a, b, move.pose === 'light' ? 8 : 12);
    }
    if (contact.method !== 'evade') state.hitstop = Math.max(state.hitstop, HITSTOP[kind] - 2);
    refreshPose(b, 0);
    state.events.push(event);
    return;
  }
  const continuing = contact.type === 'hit' && (b.action?.kind === 'hurt' || b.action?.kind === 'down');
  if (!continuing) { combo.hits = 0; combo.damage = 0; }
  combo.hits++;
  const scale = Math.max(0.5, 1 - 0.1 * (combo.hits - 1));
  const damage = Math.min(b.hp, Math.max(1, Math.round(move.damage * scale)));
  b.hp -= damage;
  combo.damage += damage;
  Object.assign(event, { damage, combo: combo.hits });
  gain(b, Math.ceil(damage * 0.6));
  if (move.kind !== 'super') gain(a, move.kind === 'normal' || move.kind === 'command' ? 5 : 7);
  if (contact.type === 'throw') {
    if (contact.back) b.x = clamp(a.x - a.facing * BODY, LEFT, RIGHT);
    knockDown(b, contact.back ? -a.facing : a.facing);
  } else if (contact.armored) {
    b.action.armorUsed++;
  } else if (airborne(b) || (move.knockdown && contact.final)) {
    knockDown(b, a.facing);
  } else {
    b.action = { kind: 'hurt', tick: 0, duration: move.hitstun };
    b.guard = null;
    if (contact.source === 'strike') push(a, b, move.pose === 'light' ? 6 : 10);
  }
  state.hitstop = Math.max(state.hitstop, HITSTOP[kind]);
  refreshPose(b, 0);
  state.events.push(event);
}

function overlapping(p, q) {
  return Math.abs(p.x - q.x) < (p.w + q.w) / 2 && p.y < q.y + q.h && q.y < p.y + p.h;
}

function updateProjectiles(state) {
  const shots = state.projectiles;
  for (const p of shots) {
    p.x += p.vx;
    p.age++;
  }
  const gone = new Set(shots.filter(p => {
    const move = state.fighters[p.owner].profile.moves[p.moveId];
    return p.age >= move.projectile.life || p.x < LEFT - 80 || p.x > RIGHT + 80;
  }));
  for (const p of shots) for (const q of shots) {
    if (p.owner !== 0 || q.owner !== 1 || gone.has(p) || gone.has(q) || !overlapping(p, q)) continue;
    gone.add(p).add(q);
    state.events.push({ type: 'clash', attacker: 0, target: 1, move: 'special', moveId: p.moveId, damage: 0, combo: 0,
      x: (p.x + q.x) / 2, y: Math.max(p.y, q.y) });
  }
  for (const p of shots) {
    if (gone.has(p)) continue;
    const target = state.fighters[1 - p.owner];
    const body = { x: target.x, y: target.y, w: BODY, h: height(target) };
    if (!overlapping(p, body) || invulnerable(target)) continue;
    gone.add(p);
    resolve(state, judge(state, p.owner, state.fighters[p.owner].profile.moves[p.moveId], 'projectile'));
  }
  state.projectiles = shots.filter(p => !gone.has(p));
}

// ---- Frame -----------------------------------------------------------------

// Advance one frame. Directions are held, buttons a–d are press edges.
// opponentInput bypasses the CPU for deterministic replays and rules tests.
// During hitstop and the super flash the simulation is frozen, but presses are
// still recorded and buffered so cancels can be entered during the freeze.
export function step(state, input = {}, opponentInput) {
  state.events.length = 0;
  if (state.winner !== null) return state;
  const inputs = [input, opponentInput ?? cpuInput(state)];
  const [a, b] = state.fighters;
  const toward = a.x <= b.x ? 1 : -1;
  state.fighters.forEach((f, i) => {
    if (!f.action && !airborne(f)) f.facing = i ? -toward : toward;
    const press = record(f.log, inputs[i], f.facing);
    if (press) f.presses.push(press);
  });
  if (state.hitstop || state.superFlash) {
    state.hitstop = Math.max(0, state.hitstop - 1);
    state.superFlash = Math.max(0, state.superFlash - 1);
    return state;
  }

  updateFighter(state, 0, toward, inputs[0]);
  updateFighter(state, 1, -toward, inputs[1]);
  separate(a, b);
  // Snapshot both contacts before applying either: equal-frame hits always trade.
  const contacts = [strike(state, 0), strike(state, 1)].filter(Boolean);
  for (const contact of contacts) resolve(state, contact);
  updateProjectiles(state);

  state.fighters.forEach((f, i) => {
    if (f.action?.kind !== 'hurt' && f.action?.kind !== 'down') Object.assign(state.combo[1 - i], { hits: 0, damage: 0 });
    f.presses = f.presses.filter(press => ++press.age <= BUFFER);
  });
  state.ticks++;
  const timed = state.timeLimit !== null;
  if (timed) state.remaining = Math.ceil((state.timeLimit * 60 - state.ticks) / 60);
  if (!a.hp || !b.hp || (timed && !state.remaining)) {
    state.winner = a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
    for (const f of state.fighters) if (!f.hp) { f.pose = 'ko'; f.poseTick = 0; f.anim = 'ko'; f.moveId = null; }
  }
  return state;
}
