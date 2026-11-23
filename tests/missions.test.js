import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMission, missions } from '../src/missions.js';

const objective = id => missions.find(m => m.id === id);

test('防守任务区分玩家与对手，完成后不会超额计数', () => {
  const block = { type: 'block', attacker: 1, target: 0, move: 'light' };
  const opponentBlock = { ...block, attacker: 0, target: 1 };
  const mission = objective('guard');
  assert.equal(advanceMission(mission, 0, [opponentBlock, block]), 1);
  assert.equal(advanceMission(mission, 1, [block, block]), 2);
});

test('必杀任务只在玩家必杀或超必杀真正命中时完成', () => {
  const special = { type: 'hit', move: 'special', attacker: 0, target: 1, combo: 1 };
  const mission = objective('finisher');
  assert.equal(advanceMission(mission, 0, [
    { ...special, move: 'heavy' }, { ...special, move: 'throw' }, { ...special, type: 'block' },
    { ...special, attacker: 1, target: 0 }, { ...special, move: 'super', attacker: 1, target: 0 },
  ]), 0);
  assert.equal(advanceMission(mission, 0, [special]), 1);
  assert.equal(advanceMission(mission, 0, [{ ...special, move: 'super' }]), 1);
});

test('三连段任务只看玩家单次连段达到 3 HITS', () => {
  const hit = (combo, extra = {}) => ({ type: 'hit', move: 'light', attacker: 0, target: 1, combo, ...extra });
  const mission = objective('combo3');
  assert.equal(advanceMission(mission, 0, [hit(1), hit(2), hit(1), hit(2)]), 0);
  assert.equal(advanceMission(mission, 0, [hit(3, { type: 'block' }), hit(3, { attacker: 1, target: 0 })]), 0);
  assert.equal(advanceMission(mission, 0, [hit(1), hit(2), hit(3, { move: 'special' }), hit(4)]), 1);
});

test('命中练习兼容投技与超必杀类别', () => {
  const mission = objective('opener');
  const events = ['throw', 'super', 'light'].map(move => ({ type: 'hit', move, attacker: 0, target: 1, combo: 1 }));
  assert.equal(advanceMission(mission, 0, events), 3);
});
