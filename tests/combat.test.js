import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step } from '../src/combat.js';
import { fighters } from '../src/roster.js';

const moveOf = (id, move) => fighters.find(f => f.id === id).moves[move];

// Numpad digit → held keys for a fighter facing right (1) or left (-1).
function held(digit, facing = 1) {
  const x = ((digit - 1) % 3) - 1, y = Math.floor((digit - 1) / 3) - 1;
  const input = {};
  if (x * facing > 0) input.right = true;
  if (x * facing < 0) input.left = true;
  if (y > 0) input.up = true;
  if (y < 0) input.down = true;
  return input;
}

// One frame per digit, the button pressed with the last one: numpad('236', 'a').
const numpad = (digits, button, facing = 1) =>
  [...digits].map((d, i, all) => ({ ...held(Number(d), facing), ...(i === all.length - 1 ? { [button]: true } : {}) }));

function bout(player = 'jin', opponent = 'yue', gap = 55) {
  const state = createMatch(player, opponent);
  state.fighters[0].x = 400;
  state.fighters[1].x = 400 + gap;
  return state;
}

function play(state, frames, opponent = {}) {
  const events = [];
  for (const input of frames) {
    step(state, input, opponent);
    events.push(...state.events);
  }
  return events;
}

const idle = (state, frames, opponent = {}) => play(state, Array(frames).fill({}), opponent);

// Play a combo the way a player would: each segment is entered as soon as the
// previous segment's first hit lands (i.e. during its hitstop). `hold` is the
// direction kept between segments.
function combo(state, segments, hold = {}) {
  const events = [];
  const queue = [...segments[0]];
  let next = 1;
  for (let frame = 0; frame < 400; frame++) {
    step(state, queue.shift() ?? hold, {});
    for (const event of state.events) {
      events.push(event);
      if (event.type === 'hit' && event.attacker === 0 && next < segments.length &&
          events.filter(e => e.type === 'hit').length === segments.slice(0, next).length) {
        queue.push(...segments[next++]);
      }
    }
  }
  return events;
}

test('a normal has startup, hits once, and cannot be restarted during recovery', () => {
  const state = bout(), [a, b] = state.fighters;
  const { timing: [startup], damage } = a.profile.moves.standA;
  step(state, { a: true }, {});
  assert.equal(idle(state, startup - 1).length, 0);
  step(state, {}, {});
  assert.deepEqual(state.events.map(e => [e.type, e.attacker, e.moveId, e.damage, e.combo]), [['hit', 0, 'standA', damage, 1]]);
  assert.equal(b.hp, 100 - damage);
  assert.ok(a.meter > 0 && b.meter > 0);
  idle(state, state.hitstop);
  assert.equal(play(state, Array(8).fill({ d: true })).length, 0, 'D presses during recovery do nothing');
  assert.equal(a.moveId, 'standA');
});

test('hitstop freezes both fighters and the clock, then play resumes', () => {
  const state = bout(), [a, b] = state.fighters;
  for (let i = 0; i < 20 && !state.events.length; i++) step(state, i ? {} : { c: true }, {});
  assert.equal(state.events[0].moveId, 'standC');
  assert.equal(state.hitstop, 9);
  const frozen = JSON.stringify([state.ticks, a.x, b.x, a.poseTick, b.poseTick, b.pose]);
  play(state, Array(9).fill({ right: true }), { left: true });
  assert.equal(JSON.stringify([state.ticks, a.x, b.x, a.poseTick, b.poseTick, b.pose]), frozen);
  step(state, {}, {});
  assert.equal(state.hitstop, 0);
  assert.equal(a.poseTick, 7);
});

test('simultaneous contacts trade, including a double KO; an ended bout is frozen', () => {
  const state = bout('jin', 'jin');
  for (const f of state.fighters) f.hp = 1;
  const events = play(state, [{ a: true }, {}, {}, {}], { a: true });
  assert.deepEqual(events.map(e => [e.attacker, e.damage]), [[0, 1], [1, 1]]);
  assert.equal(state.winner, 'draw');
  assert.deepEqual(state.fighters.map(f => f.pose), ['ko', 'ko']);
  const ticks = state.ticks;
  step(state, { c: true }, {});
  assert.equal(state.ticks, ticks);
  assert.deepEqual(state.events, []);
});

test('only backwards guards; lows beat standing guard and overheads beat crouch guard', () => {
  for (const [id, input, startup, gap, direction, method] of [
    ['jin', { a: true }, 3, 55, { right: true }, 'stand'],
    ['jin', { a: true }, 3, 55, { right: true, down: true }, 'crouch'],
    ['jin', { a: true }, 3, 55, { left: true }, null],
    ['jin', { a: true }, 3, 55, { down: true }, null],
    ['lan', { down: true, b: true }, 5, 55, { right: true }, null],
    ['lan', { down: true, b: true }, 5, 55, { right: true, down: true }, 'crouch'],
    ['lan', { right: true, c: true }, 18, 100, { right: true, down: true }, null],
    ['lan', { right: true, c: true }, 18, 100, { right: true }, 'stand'],
  ]) {
    const state = bout(id, 'yue', gap);
    step(state, input, {});
    assert.equal(idle(state, startup - 1).length, 0);
    step(state, {}, direction);
    const [event] = state.events;
    const label = `${id} ${JSON.stringify(input)} vs ${JSON.stringify(direction)}`;
    assert.equal(event.type, method ? 'block' : 'hit', label);
    assert.equal(event.method ?? null, method, label);
    assert.equal(state.fighters[1].hp === 100, !!method, label);
  }
  const reversed = bout('jin', 'lan', -55);
  play(reversed, [{ a: true }, {}, {}]);
  step(reversed, {}, { left: true });
  assert.equal(reversed.events[0].method, 'stand');
});

test('jin: close C cancels into all three ember fangs for a 4-hit combo with damage scaling', () => {
  const state = bout('jin', 'yue');
  const events = combo(state, [[{ c: true }], numpad('236', 'a'), numpad('236', 'a'), numpad('236', 'c')]);
  const hits = events.filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => e.moveId), ['standC', 'emberFang1', 'emberFang2', 'emberFang3']);
  assert.deepEqual(hits.map(e => e.combo), [1, 2, 3, 4]);
  const raw = hits.map(e => moveOf('jin', e.moveId).damage);
  assert.ok(hits.slice(1).every((e, i) => e.damage < raw[i + 1]), 'later hits are scaled down');
  assert.equal(state.fighters[1].hp, 100 - hits.reduce((sum, e) => sum + e.damage, 0));
  assert.equal(state.combo[0].hits, 0, 'the counter clears once the target is back up');
});

test('lan: 2B, 2B, then a charged tide shot connects as a 3-hit combo while holding down-back', () => {
  const state = bout('lan', 'jin');
  const charge = { down: true, left: true };
  const events = combo(state, [
    [...Array(45).fill(charge), { ...charge, b: true }],
    [{ ...charge, b: true }],
    [{ right: true, a: true }],
  ], charge);
  const hits = events.filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => [e.moveId, e.combo]), [['crouchB', 1], ['crouchB', 2], ['tideShot', 3]]);
});

test('yue: 2B cancels into the quake ground wave for a 2-hit combo', () => {
  const state = bout('yue', 'jin');
  const hits = combo(state, [[{ down: true, b: true }], numpad('236', 'b')]).filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => [e.moveId, e.combo]), [['crouchB', 1], ['quake', 2]]);
});

test('skater: jump D, stand D, then the three-spin chain for a 5-hit combo', () => {
  const state = bout('skater', 'jin', 150);
  const hits = combo(state, [
    [...Array(4).fill({ up: true, right: true }), ...Array(23).fill({}), { d: true }],
    [...Array(12).fill({}), { d: true }],
    numpad('214', 'b'),
  ]).filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => e.moveId), ['airD', 'standD', 'spinChain', 'spinChain', 'spinChain']);
  assert.deepEqual(hits.map(e => e.combo), [1, 2, 3, 4, 5]);
  assert.equal(state.fighters[1].hp, 100 - hits.reduce((sum, e) => sum + e.damage, 0));
});

test('light attacks chain only after contact; cancels into specials need contact too', () => {
  const chained = bout('jin', 'yue');
  const hits = combo(chained, [[{ a: true }], [{ a: true }]]).filter(e => e.type === 'hit');
  assert.deepEqual(hits.map(e => [e.moveId, e.combo]), [['standA', 1], ['standA', 2]]);

  const whiff = bout('jin', 'yue', 300), [a] = whiff.fighters;
  play(whiff, [{ c: true }, ...Array(7).fill({}), ...numpad('236', 'a')]);
  const seen = new Set();
  for (let i = 0; i < 30; i++) { step(whiff, {}, {}); seen.add(a.moveId); }
  assert.ok(!seen.has('emberFang1'), 'a whiffed close C cannot be cancelled');
});

test('a rekka follow-up only comes out inside its window after the previous stage connects', () => {
  const late = bout('jin', 'yue'), [a] = late.fighters;
  const events = play(late, numpad('236', 'a'));
  for (let i = 0; i < 40 && !events.length; i++) events.push(...play(late, [{}]));
  assert.equal(events[0].moveId, 'emberFang1');
  idle(late, late.hitstop + moveOf('jin', 'emberFang1').followUp.window + 1);
  play(late, numpad('236', 'a'));
  const seen = new Set();
  for (let i = 0; i < 30; i++) { step(late, {}, {}); seen.add(a.moveId); }
  assert.ok(!seen.has('emberFang2'), 'too late: no second stage');
  assert.ok(seen.has('emberFang1'), 'the buffered command restarts the first stage instead');

  const whiff = bout('jin', 'yue', 320), [w] = whiff.fighters;
  play(whiff, [...numpad('236', 'a'), ...Array(10).fill({}), ...numpad('236', 'a')]);
  const stages = new Set();
  for (let i = 0; i < 20; i++) { step(whiff, {}, {}); stages.add(w.moveId); }
  assert.ok(!stages.has('emberFang2'), 'a stage that missed cannot be followed up');
});

test('623 wins over 236 when both are in the input, and the rising flame is invulnerable at start', () => {
  const priority = bout('jin', 'yue', 300), [p] = priority.fighters;
  play(priority, numpad('23623', 'a'));
  assert.equal(p.moveId, 'risingFlame');
  const plain = bout('jin', 'yue', 300);
  play(plain, numpad('236', 'a'));
  assert.equal(plain.fighters[0].moveId, 'emberFang1');

  // Yue's heavy punch lands during the rise's invulnerable frames and whiffs.
  const reversal = bout('jin', 'yue'), [r, y] = reversal.fighters;
  const frames = [{}, {}, {}, {}, ...numpad('623', 'a')];
  const log = [];
  for (let i = 0; i < 40; i++) {
    step(reversal, frames[i] ?? {}, i === 0 ? { c: true } : {});
    log.push(...reversal.events);
  }
  assert.deepEqual(log.map(e => [e.attacker, e.moveId]), [[0, 'risingFlame']]);
  assert.equal(r.hp, 100);
  assert.ok(y.hp < 100);
});

test('throws ignore guard but cannot grab a jumping opponent', () => {
  for (const direction of [{ right: true }, { left: true }]) {
    const state = bout('jin', 'yue'), [a, b] = state.fighters;
    step(state, { ...direction, c: true }, { right: true });
    const [event] = state.events.length ? state.events : play(state, [{}], { right: true });
    assert.equal(event.type, 'throw');
    assert.equal(event.move, 'throw');
    assert.equal(b.hp, 100 - moveOf('jin', 'throw').damage);
    idle(state, state.hitstop + 2);
    assert.equal(b.moveId, null);
    assert.ok(['hurt', 'ko'].includes(b.pose), 'the thrown fighter is knocked down');
    assert.equal(b.x < a.x, !!direction.left, 'a back throw lands the opponent behind');
  }

  const jumping = bout('jin', 'yue'), [j] = jumping.fighters;
  play(jumping, [{}, {}], { up: true });
  step(jumping, { right: true, c: true }, {});
  assert.equal(j.moveId, 'standC', 'with nobody to grab, the button gives the normal');
  const events = [...jumping.events, ...idle(jumping, 12)];
  assert.ok(!events.some(e => e.type === 'throw'));

  const grab = bout('yue', 'jin'), [g, target] = grab.fighters;
  play(grab, [{}, {}, {}, {}], { up: true });
  const missed = play(grab, [...numpad('41236', 'a'), ...Array(5).fill({})]);
  assert.ok(!missed.some(e => e.type === 'throw'));
  assert.equal(g.moveId, 'landslideThrow', 'a missed command throw leaves a long recovery');
  assert.equal(target.hp, 100);
  const guarded = bout('yue', 'jin');
  const landed = play(guarded, [...numpad('41236', 'a'), {}, {}, {}, {}], { right: true });
  assert.deepEqual(landed.map(e => [e.type, e.moveId, e.move]), [['throw', 'landslideThrow', 'special']]);
});

test('opposing projectiles cancel out and each fighter keeps one on screen at a time', () => {
  const state = bout('lan', 'lan', 400);
  const charge = Array(42).fill(null);
  const events = [];
  charge.forEach(() => step(state, { left: true }, { right: true }));
  step(state, { right: true, a: true }, { left: true, a: true });
  for (let i = 0; i < 60; i++) { step(state, {}, {}); events.push(...state.events); }
  assert.deepEqual(events.map(e => e.type), ['clash']);
  assert.deepEqual(state.fighters.map(f => f.hp), [100, 100]);
  assert.equal(state.projectiles.length, 0);

  const solo = bout('lan', 'yue', 700), [lan] = solo.fighters;
  solo.fighters[0].x = 100;
  solo.fighters[1].x = 880;
  for (let i = 0; i < 42; i++) step(solo, { left: true }, {});
  step(solo, { right: true, a: true }, {});
  idle(solo, 30);
  assert.equal(solo.projectiles.length, 1);
  for (let i = 0; i < 42; i++) step(solo, { left: true }, {});
  step(solo, { right: true, a: true }, {});
  idle(solo, 10);
  assert.equal(solo.projectiles.length, 1, 'no second shot while the first is still out');
  assert.notEqual(lan.moveId, 'tideShot');
});

test('a ground wave hits a standing opponent but can be jumped', () => {
  const hit = bout('yue', 'lan', 200);
  const events = play(hit, [...numpad('236', 'b'), ...Array(40).fill({})]);
  assert.deepEqual(events.map(e => [e.type, e.moveId]), [['hit', 'quake']]);

  const jumped = bout('yue', 'lan', 200);
  const misses = [];
  for (let i = 0; i < 60; i++) {
    step(jumped, [...numpad('236', 'b')][i] ?? {}, i === 10 ? { up: true } : {});
    misses.push(...jumped.events);
  }
  assert.deepEqual(misses, []);
  assert.equal(jumped.fighters[1].hp, 100);
});

test('a super costs 50 meter, darkens the screen and lands every hit', () => {
  const poor = bout('jin', 'yue'), [p] = poor.fighters;
  p.meter = 49;
  play(poor, numpad('236236', 'a'));
  assert.notEqual(p.moveId, 'skyBurn');
  assert.equal(poor.superFlash, 0);

  const state = bout('jin', 'yue'), [a, b] = state.fighters;
  a.meter = 60;
  play(state, numpad('236236', 'a'));
  assert.equal(a.moveId, 'skyBurn');
  assert.equal(a.meter, 10);
  assert.ok(state.superFlash > 0);
  const frozen = [a.poseTick, b.x, state.ticks];
  idle(state, state.superFlash - 1, { left: true });
  assert.deepEqual([a.poseTick, b.x, state.ticks], frozen);
  const hits = idle(state, 160).filter(e => e.type === 'hit');
  const { hits: count } = moveOf('jin', 'skyBurn');
  assert.equal(hits.length, count);
  assert.deepEqual(hits.map(e => e.move), Array(count).fill('super'));
  assert.equal(hits.at(-1).combo, count);
});

test('armor absorbs one hit without flinching; the next hit breaks through', () => {
  const state = bout('jin', 'yue', 90), [a, b] = state.fighters;
  const events = [];
  for (let i = 0; i < 30; i++) {
    step(state, i === 3 ? { c: true } : {}, numpad('214', 'a', -1)[i] ?? {});
    events.push(...state.events);
    if (events.length === 1) break;
  }
  assert.equal(events[0].attacker, 0);
  assert.ok(b.hp < 100);
  assert.equal(b.moveId, 'boulderStep', 'the shoulder charge keeps going');
  const after = [];
  for (let i = 0; i < 60; i++) { step(state, {}, {}); after.push(...state.events); }
  assert.deepEqual(after.map(e => [e.attacker, e.moveId]), [[1, 'boulderStep']]);
  assert.ok(a.hp < 100);
});

test('a knocked-down fighter cannot be hit while lying and gets back up', () => {
  const state = bout('jin', 'yue'), [, b] = state.fighters;
  play(state, [{ down: true, d: true }]);
  const swept = idle(state, 20);
  assert.equal(swept[0].moveId, 'crouchD');
  idle(state, 25);
  assert.equal(b.pose, 'ko');
  const hp = b.hp;
  assert.equal(play(state, [{ a: true }, {}, {}, {}, {}, {}]).length, 0);
  assert.equal(b.hp, hp);
  idle(state, 60);
  assert.equal(b.pose, 'idle');
});

test('all three defenses work without meter, have distinct outcomes and lock out immediate reuse', () => {
  for (const [id, method] of [['jin', 'evade'], ['lan', 'counter'], ['yue', 'brace']]) {
    const state = bout('jin', id, 82), [a, b] = state.fighters;
    const originalX = b.x;
    step(state, { d: true }, {});
    idle(state, 4);
    const events = play(state, [{}, {}, {}, {}, {}, {}], { a: true, b: true });
    assert.equal(events[0].method, method, id);
    assert.equal(b.hp, 100);
    assert.equal(b.x > originalX, method === 'evade');
    assert.equal(a.pose === 'hurt', method === 'counter');
    assert.equal(b.meter, method === 'brace' ? 17 : 8);
    idle(state, 50);
    assert.ok(b.defenseCooldown > 0);
    step(state, {}, { a: true, b: true });
    assert.notEqual(b.moveId, 'defense');
    idle(state, b.defenseCooldown + 20);
    step(state, {}, { a: true, b: true });
    assert.equal(b.moveId, 'defense');
  }
});

test('A then B within three frames becomes the defense instead of a jab', () => {
  const state = bout('jin', 'yue', 300), [a] = state.fighters;
  play(state, [{ a: true }, {}, { b: true }]);
  assert.equal(a.moveId, 'defense');
});

test('charging back still guards', () => {
  const state = bout('yue', 'lan', 55), [, b] = state.fighters;
  play(state, [{ down: true, b: true }], { down: true, right: true });
  const events = play(state, Array(10).fill({}), { down: true, right: true });
  assert.deepEqual(events.map(e => e.method), ['crouch']);
  assert.equal(b.hp, 100);
});

test('jump clears a sweep and lands on the other side with facing and back guard reversed', () => {
  const grounded = bout('yue', 'lan', 90);
  const swept = play(grounded, [{}, {}, { down: true, d: true }, ...Array(20).fill({})]);
  assert.deepEqual(swept.map(e => [e.type, e.moveId]), [['hit', 'crouchD']]);

  const jump = bout('yue', 'lan', 90), [y, l] = jump.fighters;
  const log = [];
  for (let i = 0; i < 50; i++) {
    step(jump, i === 2 ? { down: true, d: true } : {}, i < 3 ? { up: true, left: true } : {});
    log.push(...jump.events);
  }
  assert.deepEqual(log, []);
  assert.equal(l.hp, 100);
  assert.equal(l.y, 0);
  assert.ok(l.x < y.x);
  idle(jump, 12);
  assert.equal(l.facing, 1);
  assert.equal(y.facing, -1);
  step(jump, {}, { left: true });
  assert.equal(l.guard, 'stand');
});

test('the clock awards the round by HP after exactly 3,600 frames; practice rounds never time out', () => {
  for (const [hp, expected] of [[46, 0], [50, 'draw'], [72, 1]]) {
    const state = createMatch('lan', 'yue');
    state.fighters[0].hp = 50;
    state.fighters[1].hp = hp;
    idle(state, 3599);
    assert.equal(state.remaining, 1);
    assert.equal(state.winner, null);
    step(state, {}, {});
    assert.equal(state.remaining, 0);
    assert.equal(state.winner, expected);
  }
  const practice = createMatch('lan', 'yue', { timeLimit: null });
  assert.equal(practice.remaining, null);
  idle(practice, 4000);
  assert.equal(practice.winner, null);
  assert.equal(practice.remaining, null);
});

test('CPU approaches a distant opponent and does not mirror a fresh input instantly', () => {
  const state = createMatch('jin', 'yue');
  const start = state.fighters[1].x;
  step(state, { a: true });
  assert.equal(state.fighters[1].pose, 'walk');
  assert.ok(state.fighters[1].x < start);
});

test('the CPU fights back with its own moves', () => {
  for (const { id } of fighters) {
    const state = createMatch('jin', id);
    const used = new Set();
    for (let i = 0; i < 3000 && state.winner === null; i++) {
      step(state, { right: true });
      if (state.fighters[1].moveId) used.add(state.fighters[1].profile.moves[state.fighters[1].moveId].kind);
    }
    assert.ok(used.has('special'), `${id} CPU uses specials`);
    assert.ok(used.has('normal'), `${id} CPU uses normals`);
  }
});
