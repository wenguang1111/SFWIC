// Missions observe resolved contacts, not input presses. They never affect match rules.
// e.move 是招式类别：'light' | 'heavy' | 'special' | 'super' | 'throw'；e.combo 是该击结算后的连段数。
const playerHit = e => e.type === 'hit' && e.attacker === 0;

export const missions = [
  { id: 'opener', name: '命中练习', goal: 3, description: '用任意攻击命中对手 3 次。', counts: playerHit },
  { id: 'guard', name: '守住阵脚', goal: 2, description: '成功格挡对手的攻击 2 次。', counts: e => e.type === 'block' && e.target === 0 },
  { id: 'finisher', name: '必杀试炼', goal: 1, description: '用必杀技或超必杀技命中对手 1 次。', counts: e => playerHit(e) && (e.move === 'special' || e.move === 'super') },
  { id: 'combo3', name: '三连段', goal: 1, description: '打出一次至少 3 HITS 的连招（取消或派生均可）。', counts: e => playerHit(e) && e.combo >= 3 },
];

export function advanceMission(mission, score, events) {
  for (const event of events) if (mission.counts(event)) score++;
  return Math.min(score, mission.goal);
}
