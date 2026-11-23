import {
  chargeProjectile, chargeRise, commandNormal, commandThrow, defense, groundWave, moveset, normalSet, rekka,
  risingAntiAir, rushStrike, spinRush, superMove,
} from './moves/archetypes.js';

// Each fighter is a handful of templates from src/moves/archetypes.js plus numbers.
// Units and field meanings are documented at the top of that file.
// invulnerable = [first, last] action frames (inclusive) where strikes, projectiles and throws whiff.

export const fighters = [
  {
    id: 'jin', name: '烬', color: '#ff8355', style: '疾攻型', tagline: '抢进半步，让火先到。',
    archetype: 'rekka', combo: '近 C → 炎牙 → 炎牙·贰 → 炎牙·叁',
    speed: 4.6, jumpSpeed: 12.0,
    moves: moveset(
      normalSet({
        standA: { timing: [3, 3, 8] },
        standC: { damage: 11 },
      }),
      rekka({
        ids: ['emberFang1', 'emberFang2', 'emberFang3'],
        names: ['炎牙', '炎牙·贰', '炎牙·叁'],
        descriptions: [
          '踏前挥出火爪的中段，命中或被防后可再输入 236P 接第二段。',
          '回身第二爪，命中或被防后可再输入 236P 接终段。',
          '跃起砸落的火拳，击倒对手；被防时破绽很大。',
        ],
        stages: [
          { damage: 8, reach: 98, band: [30, 100], timing: [8, 3, 16], drive: 2.2, hitstun: 21, blockstun: 15 },
          { damage: 8, reach: 98, band: [30, 100], timing: [7, 3, 16], drive: 2.2, hitstun: 21, blockstun: 15 },
          { damage: 13, reach: 104, band: [16, 112], timing: [9, 4, 28], drive: 2.6, hitstun: 24, blockstun: 14 },
        ],
      }),
      risingAntiAir({
        id: 'risingFlame', name: '升炎', description: '起手无敌的升空火拳，专打跳入；落空破绽大。',
        damage: 14, reach: 90, band: [30, 210], timing: [3, 8, 28], invulnerable: [0, 8], hitstun: 24, blockstun: 14,
      }),
      rushStrike({
        id: 'crimsonRush', name: '赤焰冲', description: '裹火从圈外突入的单发重拳，长距离插入。',
        motion: '214', button: 'k', damage: 13, reach: 100, band: [24, 103], timing: [13, 6, 22], drive: 5.2,
        hitstun: 22, blockstun: 16,
      }),
      commandNormal({
        id: 'stepKick', name: '踏火', description: '前踏半步的中段踢，可取消接必杀。', button: 'b',
        damage: 8, reach: 104, band: [30, 92], timing: [9, 3, 13], drive: 2, hitstun: 19, blockstun: 12,
        cancel: ['special', 'super'],
      }),
      superMove({
        id: 'skyBurn', name: '焚天', description: '无敌起手的五段火焰连拳，最后一击击倒。',
        damage: 6, hits: 5, reach: 112, band: [20, 150], timing: [5, 15, 30], drive: 3, invulnerable: [0, 10],
        hitstun: 20, blockstun: 12,
      }),
      defense({
        name: '焰步', description: '瞬间向后滑开，在闪身期间避开所有打击。', method: 'evade',
        timing: [0, 10, 13], cooldown: 66, retreat: 5.6, invulnerable: [0, 9],
      }),
    ),
  },
  {
    id: 'lan', name: '澜', color: '#59d8c6', style: '牵制型', tagline: '进退之间，潮向由我。',
    archetype: 'charge', combo: '2B → 2B → 潮弹；对空用潮升',
    speed: 3.9, jumpSpeed: 12.5,
    moves: moveset(
      normalSet({
        standB: { reach: 100 },
        crouchB: { reach: 104 },
        standD: { reach: 124 },
      }),
      chargeProjectile({
        id: 'tideShot', name: '潮弹', description: '后蓄力后推前发出水弹；蓄力时照样能防御。',
        damage: 10, timing: [9, 2, 24], hitstun: 20, blockstun: 14,
        projectile: { speed: 8, life: 90, w: 40, h: 40 },
      }),
      chargeRise({
        id: 'tideRise', name: '潮升', description: '下蓄力后上踢升空，起手无敌，专打跳入。',
        damage: 13, reach: 92, band: [30, 210], timing: [4, 8, 26], invulnerable: [0, 7], hitstun: 24, blockstun: 14,
      }),
      commandNormal({
        id: 'fallingTide', name: '落潮掌', description: '慢起手的上段劈掌，可破蹲防。', button: 'c',
        level: 'overhead', damage: 11, reach: 112, band: [24, 115], timing: [18, 4, 16], drive: 0.4,
        hitstun: 20, blockstun: 12,
      }),
      superMove({
        id: 'surge', name: '怒涛', description: '向前推出远距离的四段潮涌，起手无敌。',
        damage: 7, hits: 4, reach: 200, band: [10, 110], timing: [8, 16, 30], invulnerable: [0, 10],
        hitstun: 22, blockstun: 12,
      }),
      defense({
        name: '回流', description: '短暂架掌接招；接住打击时对手失衡，立即获得反击机会。', method: 'counter',
        timing: [1, 9, 17], cooldown: 78,
      }),
    ),
  },
  {
    id: 'yue', name: '岳', color: '#edc264', style: '重压型', tagline: '一步落定，山河有声。',
    archetype: 'grappler', combo: '2B → 地鸣；或贴身逼防御后山崩摔',
    speed: 3.0, jumpSpeed: 10.8,
    moves: moveset(
      normalSet({
        standA: { damage: 5 },
        standC: { damage: 13, timing: [7, 4, 17] },
        crouchB: { damage: 5, hitstun: 16 },
        standD: { damage: 14, timing: [11, 5, 20] },
        throw: { damage: 16 },
      }),
      commandThrow({
        id: 'landslideThrow', name: '山崩摔', description: '半圈抓住对手整个摔下，无视防御；抓空收招很长。',
        damage: 26, reach: 92, band: [0, 104], timing: [3, 2, 40],
      }),
      groundWave({
        id: 'quake', name: '地鸣', description: '震出贴地低段地波，腾空可以越过。',
        damage: 11, timing: [9, 2, 28], hitstun: 22, blockstun: 16,
        projectile: { speed: 7, life: 70, w: 52, h: 30 },
      }),
      rushStrike({
        id: 'boulderStep', name: '磐石进', description: '沉身前压的肩撞，途中可硬吃一击不被打断。',
        motion: '214', damage: 15, reach: 100, band: [30, 104], timing: [16, 5, 22], drive: 3.6, armor: 1,
        hitstun: 22, blockstun: 14,
      }),
      superMove({
        id: 'heavenEarth', name: '天地返', description: '无敌起手、连砸三下的重击，最后一击击倒。', button: 'c',
        damage: 11, hits: 3, reach: 122, band: [0, 120], timing: [6, 12, 34], invulnerable: [0, 8],
        hitstun: 24, blockstun: 14,
      }),
      defense({
        name: '山印', description: '定身结印，在较长时间内挡住所有段位，成功时额外聚能。', method: 'brace',
        timing: [3, 23, 15], cooldown: 96,
      }),
    ),
  },
  {
    id: 'skater', name: '冰上少女', color: '#bc9be8', style: '滑步型', tagline: '以冰弧入场，以步法控距。',
    archetype: 'spin', combo: '跳 D → 站 D → 旋风连转；对空阿克塞尔',
    speed: 4.4, jumpSpeed: 12.2,
    moves: moveset(
      normalSet({
        standD: { name: '回旋踢', description: '花滑转体带动的摆踢，可取消接旋风连转。', cancel: ['special', 'super'] },
        crouchD: {
          name: '蹲转扫', description: '蹲转（sit spin）贴冰扫出的低段，命中击倒。',
          reach: 126, timing: [8, 5, 22],
        },
      }, { crouchD: 'sitSpin' }),
      spinRush({
        id: 'spinChain', name: '旋风连转', description: '原地连转带出三段旋转踢并向前滑行，最后一转击倒。',
        damage: 6, hits: 3, reach: 104, band: [20, 100], timing: [6, 12, 18], drive: 2.2, hitstun: 18, blockstun: 12,
      }),
      risingAntiAir({
        id: 'axel', name: '阿克塞尔', description: '前跃起跳的升空旋转踢，起手无敌，两段对空。', button: 'k',
        damage: 7, hits: 2, reach: 94, band: [40, 220], timing: [4, 10, 26], invulnerable: [0, 7],
        hitstun: 22, blockstun: 12,
      }),
      rushStrike({
        id: 'iceArc', name: '冰弧突进', description: '沿冰弧长距离滑入，以掌击收势的中段突进。',
        damage: 13, reach: 100, band: [28, 101], timing: [14, 7, 24], drive: 5.8, hitstun: 22, blockstun: 14,
      }),
      superMove({
        id: 'tripleAxel', name: '三周半·终曲', description: '无敌起跳的六段连转踢，以落冰定格击倒。', button: 'k',
        damage: 5, hits: 6, reach: 112, band: [10, 160], timing: [5, 18, 30], drive: 2.5, invulnerable: [0, 10],
        hitstun: 20, blockstun: 12,
      }),
      defense({
        name: '急刹回滑', description: '短暂闪身后向后滑开，以距离避招；回滑后段与收势可被追击。', method: 'evade',
        timing: [2, 12, 16], cooldown: 72, retreat: 7.2, invulnerable: [2, 3],
      }),
    ),
  },
];
