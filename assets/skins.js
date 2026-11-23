// Optional overrides. Image URLs are relative to this module. Remove a key to
// use the corresponding built-in portrait or pose. Sprite artwork faces right.
//
// jin: {
//   portrait: './jin/portrait.png',       // transparent bust; bottom-centred
//   sheet: './jin/fighter.png', scale: 2, // logical stage pixels per sheet pixel
//   frames: {
//     idle: [[0, 0, 64, 80, 32, 78, 12], [64, 0, 64, 80, 32, 78, 12]],
//     light: [[0, 80, 80, 80, 32, 78, 6], [80, 80, 80, 80, 32, 78, 3]],
//   },
// }
// Frame = [sourceX, sourceY, width, height, footAnchorX, footAnchorY, ticks].
// A tick is 1/60 s. Idle and walk repeat; other poses hold the final frame.
//
// Move animations are keyed by move id (or move.anim) and fall back to the pose key.
// A phased entry { startup, active, recovery, perHit } lists frames per phase with a
// relative weight instead of ticks: the renderer splits each phase's length from the
// move's timing [startup, active, recovery] in src/roster.js, so art never drifts from
// the frame data. perHit repeats the active frames once per hit of a multi-hit move.
// Approved skater poses were drawn by the image model; code only crops and scales them.
const skaterPose = {
  palmWindup: [87, 11, 177, 316, 96, 316], palmStrike: [378, 22, 274, 305, 153, 305], palmRecover: [767, 11, 170, 316, 96, 316],
  spinWindup: [97, 351, 176, 316, 88, 316], spinKick: [354, 348, 314, 318, 159, 318], spinLand: [762, 351, 172, 316, 83, 316],
  arcCrouch: [63, 737, 192, 273, 95, 273], arcLunge: [337, 724, 332, 286, 202, 286], arcBrake: [764, 692, 179, 318, 98, 318],
  glidePush: [374, 1048, 247, 292, 152, 292], glideCollect: [777, 1034, 144, 308, 81, 308],
  crouch: [97, 1431, 157, 257, 92, 257], jump: [421, 1371, 160, 240, 93, 240], block: [763, 1372, 166, 318, 94, 318],
  brake: [62, 1722, 207, 309, 115, 309], hurt: [383, 1732, 222, 300, 125, 300], down: [747, 1803, 216, 229, 75, 229],
  idle: [78, 2056, 187, 311, 104, 311],
};
const hold = (pose, ticks) => [...skaterPose[pose], ticks];
const frames = list => list.map(e => Array.isArray(e) ? [...skaterPose[e[0]], e[1]] : [...skaterPose[e], 1]);
const phased = (startup, active, recovery, perHit = false) =>
  ({ startup: frames(startup), active: frames(active), recovery: frames(recovery), perHit });

export const skins = {
  skater: {
    portrait: './skater/portrait.png',
    sheet: './skater/combat.png',
    scale: 0.46, // matches the built-in fighters' on-screen height
    effects: 'ice',
    frames: {
      idle: [hold('idle', 60)],
      walk: [hold('glidePush', 10), hold('glideCollect', 10)],
      crouch: [hold('crouch', 60)],
      jump: [hold('jump', 60)],
      guard: [hold('block', 60)],
      // Pose fallbacks, used when a move has no entry below or lacks timing data.
      light: [hold('palmWindup', 7), hold('palmStrike', 6), hold('palmRecover', 10)],
      heavy: [hold('spinWindup', 17), hold('spinKick', 9), hold('spinLand', 18)],
      special: [hold('arcCrouch', 16), hold('arcLunge', 12), hold('arcBrake', 22)],
      defense: [hold('brake', 30)],
      hurt: [hold('hurt', 60)],
      ko: [hold('down', 60)],
      // Moves: [startup frames], [active frames], [recovery frames]; ['pose', weight].
      standA: phased(['palmWindup'], ['palmStrike'], ['palmRecover']),
      standB: phased(['glideCollect'], ['spinKick'], ['glideCollect']),
      standC: phased(['palmWindup'], ['arcLunge'], ['palmRecover']),
      standD: phased(['spinWindup'], ['spinKick'], ['spinLand']),
      crouchA: phased(['crouch'], ['arcCrouch'], ['crouch']),
      crouchB: phased(['crouch'], ['crouch'], ['crouch']),
      crouchC: phased(['crouch'], ['arcCrouch'], [['arcCrouch', 1], ['crouch', 1]]),
      // 蹲转扫: the sheet has one crouch pose; the low spin ring is drawn by the 'sitSpin' effect.
      sitSpin: phased(['crouch'], ['crouch'], ['crouch']),
      airA: phased(['jump'], ['jump'], ['jump']),
      airB: phased(['jump'], ['spinKick'], ['jump']),
      airC: phased(['jump'], ['jump'], ['jump']),
      airD: phased(['jump'], ['spinKick'], ['jump']),
      // Grab with the palm, then pivot on the skates to sling the opponent away.
      throw: phased(['palmWindup'], ['palmStrike'], ['spinWindup', 'spinLand']),
      // Each hit of the spin chain shows the kick, then the body coming round again.
      spinChain: phased(['spinWindup'], [['spinKick', 2], ['spinWindup', 1]], ['spinLand'], true),
      axel: phased([['arcCrouch', 2], ['jump', 1]], ['spinKick'], [['jump', 2], ['spinLand', 1]]),
      iceArc: phased(['arcCrouch'], ['arcLunge'], ['arcBrake']),
      tripleAxel: phased([['arcCrouch', 2], ['jump', 1]], [['spinKick', 2], ['jump', 1]], [['jump', 1], ['spinLand', 2]], true),
    },
  },
};

// Image stages. crop = [sourceX, sourceY, width, height], drawn over the full arena;
// pick it so the fighters' floor line (86.5% of the crop height) lands on the floor.
export const stages = {
  saturn: { backdrop: './skater/saturn-arena.webp', crop: [0, 246, 1536, 640] },
};
export const assetRoot = import.meta.url;

// New roster IDs may reuse one of the three built-in silhouettes and effects.
export function baseSkin(id) {
  const base = skins[id]?.base ?? id;
  return base === 'lan' || base === 'yue' ? base : 'jin';
}
