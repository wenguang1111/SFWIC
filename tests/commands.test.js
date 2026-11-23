import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputLog, record } from '../src/commands.js';

// Numpad digit → held directions for a fighter facing `facing` (1 = right, -1 = left).
function held(digit, facing = 1) {
  const x = ((digit - 1) % 3) - 1, y = Math.floor((digit - 1) / 3) - 1;
  const input = {};
  if (x * facing > 0) input.right = true;
  if (x * facing < 0) input.left = true;
  if (y > 0) input.up = true;
  if (y < 0) input.down = true;
  return input;
}

// Feed directions one per frame, then the button on the last frame; return the press.
function enter(digits, button, { facing = 1, late = 0 } = {}) {
  const log = createInputLog();
  const dirs = [...digits].map(Number);
  let press = null;
  dirs.forEach((digit, i) => {
    const last = i === dirs.length - 1 && !late;
    press = record(log, { ...held(digit, facing), ...(last ? { [button]: true } : {}) }, facing);
  });
  for (let i = 0; i < late; i++) {
    press = record(log, i === late - 1 ? { [button]: true } : {}, facing);
  }
  return press;
}

test('motions are read relative to facing, so a left-facing fighter mirrors them', () => {
  for (const motion of ['236', '623', '214', '41236', '236236']) {
    assert.ok(enter(motion, 'a').motions.has(motion), `${motion} facing right`);
    assert.ok(enter(motion, 'a', { facing: -1 }).motions.has(motion), `${motion} facing left`);
  }
  // The raw keys of a right-facing 236 (↓↘→) read as 214 for a fighter facing left.
  const log = createInputLog();
  for (const input of [{ down: true }, { down: true, right: true }]) record(log, input, -1);
  const press = record(log, { right: true, a: true }, -1);
  assert.ok(press.motions.has('214'));
  assert.ok(!press.motions.has('236'));
});

test('a motion must finish within its window and the button follow within four frames', () => {
  assert.ok(enter('2223336', 'a').motions.has('236'));
  assert.ok(!enter(`2${'5'.repeat(15)}36`, 'a').motions.has('236'), 'too slow');
  assert.ok(enter('236', 'a', { late: 4 }).motions.has('236'));
  assert.ok(!enter('236', 'a', { late: 5 }).motions.has('236'), 'button too late');
  assert.ok(enter('2362336', 'c').motions.has('236236'));
  assert.ok(enter(`236${'5'.repeat(10)}236`, 'c').motions.has('236236'), 'double motion has a longer window');
  assert.ok(!enter(`236${'5'.repeat(30)}236`, 'c').motions.has('236236'));
});

test('charge needs 40 frames of back or down before the release', () => {
  for (const [hold, release, motion] of [['4', '6', '[4]6'], ['1', '6', '[4]6'], ['2', '8', '[2]8'], ['1', '8', '[2]8']]) {
    assert.ok(enter(hold.repeat(40) + release, 'a').motions.has(motion), `${motion} via ${hold}`);
    assert.ok(!enter(hold.repeat(39) + release, 'a').motions.has(motion), `${motion} short charge`);
    assert.ok(enter(hold.repeat(40) + release, 'a', { facing: -1 }).motions.has(motion), `${motion} mirrored`);
  }
  assert.ok(!enter(`${'4'.repeat(25)}5${'4'.repeat(25)}6`, 'a').motions.has('[4]6'), 'a broken charge restarts');
});

test('A and B count as a pair when pressed up to three frames apart', () => {
  const pair = gap => {
    const log = createInputLog();
    record(log, { a: true }, 1);
    for (let i = 1; i < gap; i++) record(log, {}, 1);
    return record(log, { b: true }, 1).ab;
  };
  assert.equal(pair(1), true);
  assert.equal(pair(2), true);
  assert.equal(pair(3), false);
  assert.equal(record(createInputLog(), { a: true, b: true }, 1).ab, true);
});
