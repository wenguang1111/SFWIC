import { skins, stages, assetRoot, baseSkin } from '../assets/skins.js';
import { rect, line } from './pixels.js';
import { portraitSprite } from './portraits.js';
import { drawHarbor, FLOOR } from './harbor.js';
import { drawBuiltinFighter } from './sprites.js';
import { moveEffects, impact, drawProjectile, currentMove, frameData, themeOf } from './effects.js';

const images = new Map(), animations = new WeakMap(), phasedSequences = new WeakMap();

function loadedImage(path) {
  if (typeof path !== 'string' || !path) return null;
  if (!images.has(path)) {
    const img = new Image();
    images.set(path, img);
    img.onload = () => window.dispatchEvent(new Event('artready'));
    img.onerror = () => images.set(path, null);
    try { img.src = new URL(path, assetRoot).href; }
    catch { images.set(path, null); }
  }
  const img = images.get(path);
  return img?.complete && img.naturalWidth && img.naturalHeight ? img : null;
}

export function drawPortrait(ctx, id) {
  const img = loadedImage(skins[id]?.portrait) || portraitSprite(baseSkin(id));
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.min(w / iw, h / ih), dw = Math.round(iw * scale), dh = Math.round(ih * scale);
  ctx.save();ctx.imageSmoothingEnabled = false;ctx.clearRect(0,0,w,h);
  ctx.drawImage(img, Math.round((w-dw)/2), h-dh, dw, dh);ctx.restore();
}

function animation(sequence, img) {
  if (animations.has(sequence)) return animations.get(sequence);
  let ticks = 0;
  for (const frame of sequence) {
    if (!Array.isArray(frame) || frame.length !== 7 || !frame.every(Number.isInteger)) { ticks = 0; break; }
    const [sx, sy, w, h, , , duration] = frame;
    if (sx < 0 || sy < 0 || w <= 0 || h <= 0 || duration <= 0 || sx+w > img.naturalWidth || sy+h > img.naturalHeight) { ticks = 0; break; }
    ticks += duration;
  }
  animations.set(sequence, ticks);
  return ticks;
}

// Split `ticks` across frames by their weight (last field); every frame shows at least one tick.
function spread(frames, ticks) {
  const total = frames.reduce((sum, f) => sum + f[6], 0);
  let used = 0, acc = 0;
  return frames.map(frame => {
    acc += frame[6];
    const duration = Math.max(1, Math.round(ticks * acc / total) - used);
    used += duration;
    return [...frame.slice(0, 6), duration];
  });
}

// Phased skin entries take their tick lengths from the move's [startup, active, recovery].
function phasedSequence(entry, move) {
  const timing = frameData(move);
  if (!timing) return null;
  let byMove = phasedSequences.get(entry);
  if (!byMove) phasedSequences.set(entry, byMove = new WeakMap());
  if (byMove.has(move)) return byMove.get(move);
  const hits = entry.perHit ? Math.max(1, move.hits | 0) : 1, sequence = [];
  for (const phase of ['startup', 'active', 'recovery']) {
    const frames = phase === 'active' ? Array.from({ length: hits }, () => entry[phase] ?? []).flat() : entry[phase] ?? [];
    if (timing[phase] > 0 && frames.length) sequence.push(...spread(frames, timing[phase]));
  }
  const result = sequence.length ? sequence : null;
  byMove.set(move, result);
  return result;
}

function drawSequence(c, img, seq, size, tick, loop) {
  const total = animation(seq, img);
  if (!total) return false;
  let t = loop ? tick % total : Math.min(tick, total-1);
  for (const [sx,sy,w,h,ax,ay,duration] of seq) {
    if (t < duration) {
      // Model-drawn art is far larger than the arena grid; filter the downscale instead of dropping pixels.
      c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(img,sx,sy,w,h,Math.round(-ax*size),Math.round(-ay*size),w*size,h*size);
      c.restore(); return true;
    }
    t -= duration;
  }
  return false;
}

// Sheets are looked up by the move's animation key first, then by the pose category.
function externalSprite(c, f) {
  // Image sheets keep one guard stance per height: a crouching guard reuses the crouch pose.
  const pose = f.pose === 'guard' && f.crouched ? 'crouch' : f.pose;
  const skin = skins[f.id], img = loadedImage(skin?.sheet), size = (skin?.scale ?? 2) / 2;
  if (!img || !Number.isFinite(size) || size <= 0) return false;
  const move = currentMove(f), tick = Math.max(0, f.poseTick || 0);
  const keys = f.moveId != null ? [f.anim ?? f.moveId, pose] : [pose];
  for (const key of keys) {
    const entry = skin.frames?.[key];
    const seq = Array.isArray(entry) ? entry : entry && typeof entry === 'object' ? phasedSequence(entry, move) : null;
    if (seq && drawSequence(c, img, seq, size, tick, key === 'walk' || key === 'idle')) return true;
  }
  return false;
}

function shadow(c,f) {
  const radius = Math.max(8,20-Math.floor(f.y/18)), x = Math.round(f.x/2);
  rect(c,'#423e4b',x-radius-4,FLOOR-1,(radius+4)*2,4);
  rect(c,'#363441',x-radius,FLOOR,radius*2,3);
  rect(c,'#393643',x-radius+5,FLOOR+3,radius*2-10,1);
}

function drawBackdrop(c, state) {
  const stage = stages[state.stageId], img = loadedImage(stage?.backdrop);
  if (!img) { drawHarbor(c, state.ticks); return; }
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(img, ...stage.crop, 0, 0, 480, 200); c.restore();
}

// Super flash: the arena darkens and light streaks fan out behind the super's user.
function superFlash(c, state) {
  const left = state.superFlash;
  if (!(left > 0)) return;
  c.save(); c.globalAlpha = Math.min(.68, left * .06);
  c.fillStyle = '#07060d'; c.fillRect(0, 0, 480, 200); c.restore();
  for (const f of state.fighters) {
    if (currentMove(f)?.kind !== 'super') continue;
    const x = Math.round(f.x/2), y = FLOOR - Math.round(f.y/2) - 36;
    for (let n = 0; n < 10; n++) {
      const a = n * Math.PI / 5 + left * .05, len = 40 + (n % 3) * 18;
      c.save(); c.globalAlpha = .55;
      line(c, n % 2 ? '#fff1c3' : '#bda8ff', x + Math.cos(a)*10, y + Math.sin(a)*10, x + Math.cos(a)*len, y + Math.sin(a)*len);
      c.restore();
    }
  }
}

function projectiles(c, state) {
  for (const p of state.projectiles ?? []) {
    if (!Number.isFinite(p?.x)) continue;
    const owner = state.fighters[p.owner], dir = Math.sign(p.vx) || owner?.facing || 1;
    c.save(); c.translate(Math.round(p.x/2), FLOOR - Math.round((p.y || 0)/2)); c.scale(dir, 1);
    drawProjectile(c, p, owner?.id); c.restore();
  }
}

function impacts(c, state, fx) {
  for (const e of fx) {
    const defender = state.fighters[e.target], attacker = state.fighters[e.attacker];
    if (!defender || !attacker) continue;
    if (e.type === 'clash') {
      const x = e.x ?? (defender.x + attacker.x) / 2;
      impact(c, e, x/2, FLOOR - (e.y ?? 40)/2 - 6, themeOf(attacker.id));
      continue;
    }
    // Sparks land at the struck part of the move's band (both in stage pixels from the feet).
    const band = attacker.profile?.moves?.[e.moveId]?.band;
    const height = e.type === 'throw' ? 0 : Array.isArray(band) && band.every(Number.isFinite) ? Math.min(46, (band[0] + band[1]) / 4) : 37;
    impact(c, e, (e.x ?? defender.x)/2 - attacker.facing*5, FLOOR - (e.y ?? defender.y)/2 - height, themeOf(attacker.id));
  }
}

// Hitstop shakes the whole picture, strongest on the first frozen frame.
function shake(state) {
  const left = state.hitstop;
  if (!(left > 0)) return [0, 0];
  const amount = Math.min(3, Math.ceil(left / 3)), side = left % 2 ? 1 : -1;
  return [side * amount * 2, (left % 3 === 0 ? -1 : 1) * Math.ceil(amount / 2) * 2];
}

// Draw straight onto the visible canvas in 480 × 200 arena units, scaled to its backing
// resolution: hand-made pixel art keeps hard edges, while image sheets and backdrops
// keep their full detail instead of being squeezed through a 480 × 200 buffer.
export function drawStage(ctx, state, fx = []) {
  const k = ctx.canvas.width / 480, [dx, dy] = shake(state);
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle = '#07060d'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.setTransform(k,0,0,k,dx*k/2,dy*k/2); ctx.imageSmoothingEnabled = false;
  drawBackdrop(ctx, state);
  superFlash(ctx, state);
  for (const f of state.fighters) shadow(ctx,f);
  for (const fighter of state.fighters) {
    // The simulation distinguishes held guard from guard stun. Both show a stance.
    const f = fighter.guard && ['idle','walk','crouch'].includes(fighter.pose) ? {...fighter,pose:'guard',anim:'guard'} : fighter;
    ctx.save();ctx.translate(Math.round(f.x/2),FLOOR-Math.round(f.y/2));ctx.scale(f.facing,1);
    if (!externalSprite(ctx,f)) drawBuiltinFighter(ctx,f);
    moveEffects(ctx,f);ctx.restore();
  }
  projectiles(ctx, state);
  impacts(ctx, state, fx);
  ctx.restore();
}
