import { fighters } from './src/roster.js';
import { drawPortrait, drawStage } from './src/art.js';
import { createMatch, step } from './src/combat.js';
import { keyboard } from './src/input.js';
import { missions, advanceMission } from './src/missions.js';

const $ = id => document.getElementById(id);
const setText = (id, value) => {
  const element = $(id), text = String(value);
  if (element.textContent !== text) element.textContent = text;
};
const stage = $('stage').getContext('2d');
let selected = fighters.find(fighter => fighter.id === 'skater');
let mode = 'lobby';
let session;
const keys = keyboard(() => mode === 'fight');

// 招式记法（以面朝右的小键盘方向为准）转成玩家能直接照按的箭头与键位。
const arrows = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
const buttons = { A: '轻拳(J)', B: '轻脚(K)', C: '重拳(U)', D: '重脚(I)', P: '拳(J/U)', K: '脚(K/I)', AB: '轻拳+轻脚(J+K)' };
function readNotation(text) {
  let out = '', afterDirection = false;
  for (const token of text.match(/\[\d\]|j\.|A\+?B|[1-9]|[ABCDPK]|[^]/g) ?? []) {
    if (token[0] === '[') {
      out += `${arrows[token[1]]}(蓄) `;
      afterDirection = false;
    } else if (token in arrows) {
      out += arrows[token];
      afterDirection ||= token !== '5';
    } else if (token === 'j.') {
      out += '空中 ';
    } else {
      const button = buttons[token.replace('+', '')];
      out += button ? `${afterDirection ? ' + ' : ''}${button}` : token;
      afterDirection = false;
    }
  }
  return out;
}

const archetypes = { rekka: '派生连段', charge: '蓄力牵制', grappler: '指令投', spin: '旋转连踢' };
const levels = { high: '上段', mid: '中段', low: '低段', overhead: '上段 · 破蹲防', throw: '投 · 无视防御' };
const moveGroups = [
  ['普通技与指令技', move => move.kind === 'command' || move.kind === 'throw'],
  ['必杀技', move => move.kind === 'special'],
  ['超必杀', move => move.kind === 'super'],
  ['防守技', move => move.kind === 'defense'],
];

function moveTags(move) {
  return [
    levels[move.level],
    move.hits > 1 && `${move.hits} 段`,
    move.projectile && '飞行道具',
    move.invulnerable && '起手无敌',
    move.armor && '可硬吃一击',
    move.cost && `消耗 ${move.cost} 能量`,
    move.cooldown && `冷却 ${(move.cooldown / 60).toFixed(1)} 秒`,
  ].filter(Boolean).join(' · ');
}

function moveRow(move) {
  const row = document.createElement('div');
  row.className = 'move';
  row.innerHTML = '<div class="move-head"><b></b><small></small></div><kbd class="cmd"></kbd><p></p>';
  row.querySelector('b').textContent = move.name;
  row.querySelector('small').textContent = moveTags(move);
  row.querySelector('kbd').textContent = readNotation(move.notation);
  row.querySelector('p').textContent = move.description;
  return row;
}

function normalsList(moves) {
  const details = document.createElement('details');
  details.className = 'normals';
  details.innerHTML = '<summary></summary><ul></ul>';
  details.querySelector('summary').textContent = `通用普通技 · 站 / 蹲 / 跳 × 四键（${moves.length} 招）`;
  details.querySelector('ul').append(...moves.map(move => {
    const item = document.createElement('li');
    item.title = move.description;
    item.innerHTML = '<kbd></kbd><span></span>';
    item.querySelector('kbd').textContent = readNotation(move.notation);
    item.querySelector('span').textContent = `${move.name} · ${levels[move.level] ?? ''}`;
    return item;
  }));
  return details;
}

function renderMoves(fighter) {
  const moves = Object.values(fighter.moves);
  const sections = moveGroups.map(([title, belongs], index) => {
    const section = document.createElement('section');
    section.className = 'move-group';
    section.innerHTML = '<h3></h3>';
    section.querySelector('h3').textContent = title;
    section.append(...moves.filter(belongs).map(moveRow));
    if (index === 0) section.append(normalsList(moves.filter(move => move.kind === 'normal')));
    return section;
  });
  $('moves').replaceChildren(...sections.filter(section => section.childElementCount > 1));
}

function paintPortraits() {
  drawPortrait($('portrait').getContext('2d'), selected.id);
  for (const card of $('roster').children) drawPortrait(card.querySelector('canvas').getContext('2d'), card.dataset.id);
}

function selectFighter(fighter) {
  selected = fighter;
  const index = fighters.indexOf(fighter);
  setText('fighter-number', `FIGHTER / ${String(index + 1).padStart(2, '0')}`);
  setText('fighter-name', fighter.name);
  setText('fighter-style', fighter.style);
  setText('fighter-tagline', fighter.tagline);
  setText('fighter-archetype', archetypes[fighter.archetype] ?? '');
  setText('fighter-combo', fighter.combo ? readNotation(fighter.combo) : '');
  $('fighter-combo').parentElement.hidden = !fighter.combo;
  $('hero').style.setProperty('--accent', fighter.color);
  $('hero').dataset.fighter = fighter.id;
  for (const card of $('roster').children) card.setAttribute('aria-pressed', String(card.dataset.id === fighter.id));
  renderMoves(fighter);
  paintPortraits();
}

for (const [index, fighter] of fighters.entries()) {
  const card = document.createElement('button');
  card.className = 'fighter-card';
  card.dataset.id = fighter.id;
  card.style.setProperty('--color', fighter.color);
  card.innerHTML = '<canvas width="160" height="144" aria-hidden="true"></canvas><span><small></small></span>';
  card.querySelector('small').textContent = `NO.${String(index + 1).padStart(2, '0')}`;
  card.querySelector('span').append(fighter.name);
  card.onclick = () => selectFighter(fighter);
  $('roster').append(card);
}
for (const m of missions) $('mission').add(new Option(m.name, m.id));
const chosenMission = () => missions.find(m => m.id === $('mission').value);
$('mission').onchange = () => setText('objective', chosenMission().description);
$('mission').onchange();
$('practice').onchange = () => { $('dummy-guard').disabled = !$('practice').checked; };
$('practice').onchange();
selectFighter(selected);
window.addEventListener('artready', paintPortraits);

// 练习陪练不走 CPU：默认站立不动；选了防御时，只在玩家出招或飞行道具在场时按住后方向。
function dummyInput(state, guard) {
  if (guard === 'none') return {};
  const [player, dummy] = state.fighters;
  const away = player.x < dummy.x ? 'right' : 'left';
  if (guard === 'crouch') return { down: true, [away]: true };
  const threatened = player.moveId != null || state.projectiles?.some(shot => shot.owner === 0);
  return threatened ? { [away]: true } : {};
}

function drawCombo(prefix, combo) {
  const element = $(`${prefix}-combo`), live = combo?.hits >= 2;
  if (live) setText(element.id, `${combo.hits} HITS · ${combo.damage}`);
  element.classList.toggle('on', live);
}

function drawMatch() {
  const { state, fx, mission, score } = session;
  drawStage(stage, state, fx);
  for (const [i, prefix] of ['p', 'c'].entries()) {
    const { hp, meter } = state.fighters[i];
    if ($(`${prefix}-hp`).value !== hp) $(`${prefix}-hp`).value = hp;
    if ($(`${prefix}-meter`).value !== meter) $(`${prefix}-meter`).value = meter;
    $(`${prefix}-meter`).parentElement.classList.toggle('ready', meter >= 50);
    setText(`${prefix}-energy`, `气 ${Math.floor(meter)} / 100${meter >= 50 ? '　超必杀就绪' : ''}`);
    drawCombo(prefix, state.combo?.[i]);
  }
  setText('defense-ready', state.fighters[0].defenseCooldown ? '防守技冷却' : '防守技就绪');
  setText('time', state.remaining ?? '∞');
  setText('progress', `${score === mission.goal ? '已完成　' : ''}${score} / ${mission.goal}`);
}

const contactTypes = new Set(['hit', 'block', 'throw', 'clash']);
function runTick() {
  const { state, mission, fx, practice } = session;
  for (const mark of fx) mark.age++;
  while (fx.length && fx[0].age >= 16) fx.shift();
  if (practice) step(state, keys.sample(), dummyInput(state, practice.guard));
  else step(state, keys.sample());
  for (const event of state.events) {
    if (!contactTypes.has(event.type)) continue;
    const target = state.fighters[event.target];
    fx.push({ ...event, x: event.x ?? target.x, y: event.y ?? target.y, age: 0 });
  }
  session.score = advanceMission(mission, session.score, state.events);
}

// The simulator owns match time. A resumed tab never fast-forwards missed combat.
const tickMs = 1000 / 60;
let previous = null, debt = 0, request;
function frame(now) {
  if (mode !== 'fight') return;
  debt += previous === null ? 0 : Math.min(now - previous, 100);
  previous = now;
  while (debt >= tickMs && session.state.winner === null) {
    runTick();
    debt -= tickMs;
  }
  drawMatch();
  if (session.state.winner !== null) finish();
  else request = requestAnimationFrame(frame);
}
function play() {
  mode = 'fight'; keys.reset(); previous = null; debt = 0;
  $('cover').hidden = true;
  $('pause').disabled = false;
  request = requestAnimationFrame(frame);
}
function start(cpu, practice) {
  const mission = chosenMission();
  const state = createMatch(selected.id, cpu.id, practice ? { timeLimit: null } : undefined);
  session = { state, cpu, mission, practice, score: 0, fx: [] };
  const onIce = selected.id === 'skater' || cpu.id === 'skater';
  const versus = practice ? '练习模式' : '1P VS CPU';
  state.stageId = onIce ? 'saturn' : 'harbor';
  setText('arena-heading', onIce ? 'SATURN ARENA 冰场' : '港区夜场');
  setText('arena-label', `${onIce ? 'INGOLSTADT' : 'HARBOR DISTRICT'} / ${versus}`);
  setText('c-role', practice ? '陪练' : 'CPU');
  $('stage').setAttribute('aria-label', onIce ? 'Ingolstadt · SATURN ARENA 冰场对战' : '港区对战场地');
  for (const [prefix, fighter] of [['p', selected], ['c', cpu]]) {
    setText(`${prefix}-name`, fighter.name);
    $(`${prefix}-hp`).parentElement.style.setProperty('--accent', fighter.color);
    $(`${prefix}-hp`).value = 100;
    $(`${prefix}-combo`).classList.remove('on');
  }
  setText('location', practice ? '练习模式' : '单人对战');
  setText('contract-name', mission.name);
  $('lobby').hidden = true; $('arena').hidden = false;
  drawMatch(); play();
}
function showCover(code, title, detail, next) {
  keys.reset();
  setText('cover-code', code); setText('cover-title', title);
  setText('cover-detail', detail); setText('continue', next);
  $('cover').hidden = false;
  $('pause').disabled = true;
  $('continue').focus({ preventScroll: true });
}
function pause() {
  if (mode !== 'fight') return;
  mode = 'pause'; cancelAnimationFrame(request);
  showCover('SYSTEM / PAUSED', session.practice ? '练习暂停' : '对战暂停', '比赛已冻结。', '继续');
}
function finish() {
  mode = 'result';
  const { state, mission, score, practice } = session;
  const outcome = state.winner === 'draw' ? '平局' : state.winner === 0 ? '你赢了' : practice ? '陪练获胜' : '电脑获胜';
  const reason = state.fighters.some(f => f.hp <= 0) ? 'K.O.' : '时间到';
  showCover('MATCH / RESULT', outcome, `${reason}　·　${mission.name} ${score}/${mission.goal}`, practice ? '重新练习' : '再战一局');
}
$('start').onclick = () => {
  const others = fighters.filter(f => f !== selected);
  const practice = $('practice').checked ? { guard: $('dummy-guard').value } : null;
  start(others[Math.floor(Math.random() * others.length)], practice);
};
$('pause').onclick = pause;
$('continue').onclick = () => { if (mode === 'pause') play(); else if (mode === 'result') start(session.cpu, session.practice); };
$('leave').onclick = () => {
  mode = 'lobby'; session = null; keys.reset();
  $('arena').hidden = true; $('lobby').hidden = false;
  setText('location', '角色整备'); $('start').focus();
};
$('guide').onclick = () => { pause(); $('manual').showModal(); };
$('close-guide').onclick = () => $('manual').close();
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.repeat || $('manual').open) return;
  if (mode === 'fight') pause(); else if (mode === 'pause') play();
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
