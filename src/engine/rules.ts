import { Card, GameMode, Player, RankProfile } from '../types/game';
import { isBlackSuit, isRedSuit } from '../data/deck';

export const RANK_TIERS = [
  { name: '青铜校尉', color: '#cd7f32', starsNeeded: 3 },
  { name: '白银都尉', color: '#cbd5e1', starsNeeded: 3 },
  { name: '黄金中郎', color: '#fbbf24', starsNeeded: 4 },
  { name: '翡翠大将', color: '#34d399', starsNeeded: 4 },
  { name: '无双宗师', color: '#a855f7', starsNeeded: 5 },
  { name: '乱世枭雄', color: '#f43f5e', starsNeeded: 99 },
];

const RANK_STORAGE_KEY = 'sgs_douyin_rank_v1';

export function hasSkill(player: Player, skillId: string): boolean {
  return player.hero.skills.some((s) => s.id === skillId);
}

export function loadRankProfile(): RankProfile {
  try {
    const raw = localStorage.getItem(RANK_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RankProfile;
  } catch {
    // ignore
  }
  return { tierIndex: 0, stars: 1, wins: 0, losses: 0, streak: 0, totalKills: 0 };
}

export function saveRankProfile(profile: RankProfile) {
  try {
    localStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function applyRankMatchResult(profile: RankProfile, win: boolean, kills: number): RankProfile {
  const next = { ...profile, totalKills: profile.totalKills + kills };
  if (win) {
    next.wins += 1;
    next.streak += 1;
    const bonus = next.streak >= 3 ? 2 : 1;
    next.stars += bonus;
    const maxTier = RANK_TIERS.length - 1;
    while (next.tierIndex < maxTier && next.stars >= RANK_TIERS[next.tierIndex].starsNeeded) {
      next.stars -= RANK_TIERS[next.tierIndex].starsNeeded;
      next.tierIndex += 1;
    }
  } else {
    next.losses += 1;
    next.streak = 0;
    if (next.stars > 0) {
      next.stars -= 1;
    } else if (next.tierIndex > 0) {
      next.tierIndex -= 1;
      next.stars = Math.max(0, RANK_TIERS[next.tierIndex].starsNeeded - 1);
    }
  }
  saveRankProfile(next);
  return next;
}

export function isAlly(a: Player, b: Player, mode: GameMode): boolean {
  if (a.id === b.id) return true;
  if (mode === '2v2' || mode === 'landlord') {
    return a.team === b.team;
  }
  if (a.identity === 'lord' || a.identity === 'loyalist') {
    return b.identity === 'lord' || b.identity === 'loyalist';
  }
  if (a.identity === 'rebel') {
    return b.identity === 'rebel';
  }
  return false;
}

export function isEnemy(a: Player, b: Player, mode: GameMode): boolean {
  if (a.id === b.id) return false;
  return !isAlly(a, b, mode);
}

export function getDistance(players: Player[], from: Player, to: Player): number {
  if (from.id === to.id) return 0;
  const alive = players.filter((p) => p.alive);
  const idxA = alive.findIndex((p) => p.id === from.id);
  const idxB = alive.findIndex((p) => p.id === to.id);
  if (idxA === -1 || idxB === -1) return 99;
  const n = alive.length;
  const diff = Math.abs(idxA - idxB);
  let dist = Math.min(diff, n - diff);
  if (to.equip.horsePlus) dist += 1;
  if (hasSkill(to, 'feiying_shen')) dist += 1;
  if (from.equip.horseMinus) dist -= 1;
  if (hasSkill(from, 'mashu')) dist -= 1;
  if (hasSkill(from, 'chenglie_ji')) dist -= 2;
  return Math.max(1, dist);
}

export function getAttackRange(player: Player): number {
  return player.equip.weapon?.range ?? 1;
}

export function isSlashCard(card: Card): boolean {
  return card.name === '杀' || card.name === '火杀' || card.name === '雷杀';
}

export function canActAsSlash(player: Player, card: Card): boolean {
  if (isSlashCard(card)) return true;
  if (hasSkill(player, 'wusheng') && isRedSuit(card.suit)) return true;
  if (hasSkill(player, 'longdan') && card.name === '闪') return true;
  if (hasSkill(player, 'wushen') && card.suit === 'heart') return true;
  if (hasSkill(player, 'longhun') && card.suit === 'diamond') return true;
  if (hasSkill(player, 'shoudi_ji') && card.suit === 'diamond') return true;
  return false;
}

export function canActAsShan(player: Player, card: Card): boolean {
  if (card.name === '闪') return true;
  if (hasSkill(player, 'longdan') && isSlashCard(card)) return true;
  if (hasSkill(player, 'longhun') && card.suit === 'club') return true;
  if (hasSkill(player, 'qingguo_mou') && isBlackSuit(card.suit)) return true;
  return false;
}

export function canActAsPeach(player: Player, card: Card, isOwnTurn: boolean): boolean {
  if (card.name === '桃') return true;
  if (hasSkill(player, 'jijiu') && !isOwnTurn && isRedSuit(card.suit)) return true;
  if (hasSkill(player, 'longhun') && card.suit === 'heart') return true;
  return false;
}

export function canActAsWuxie(player: Player, card: Card): boolean {
  if (card.name === '无懈可击') return true;
  if (hasSkill(player, 'longhun') && card.suit === 'spade') return true;
  return false;
}

export function hasUnlimitedSlash(player: Player, card?: Card): boolean {
  if (hasSkill(player, 'paoxiao')) return true;
  if (player.hero.id === 'ji_lvbu') return true;
  if (player.equip.weapon?.name === '诸葛连弩') return true;
  if (hasSkill(player, 'wushen') && card?.suit === 'heart') return true;
  if (hasSkill(player, 'shoudi_ji') && card?.suit === 'diamond') return true;
  if (hasSkill(player, 'chengfan_zhi') && card && card.rank !== 10 && card.rank !== 11) return true;
  if (hasSkill(player, 'jizhi_wei_zhi') && player.hp <= 2) return true;
  return false;
}

export function getMaxSlashPerTurn(player: Player, mode: GameMode): number {
  let limit = 1 + player.kurouBonusSha;
  if (mode === 'landlord' && player.identity === 'landlord') limit += 1;
  if (hasSkill(player, 'dengfeng_mou') || hasSkill(player, 'jiang_mou') || hasSkill(player, 'jieying_shen')) limit += 1;
  if (player.hero.id === 'mou_lvbu' || player.hero.id === 'ji_guanyu' || player.hero.id === 'mou_gongsunzan') limit += 1;
  return limit;
}

export function getHandLimit(player: Player): number {
  let limit = Math.max(0, player.hp);
  if (player.hero.id === 'ji_zhouyu' || player.hero.id === 'zhi_zhouyu') limit += 2;
  else if (hasSkill(player, 'yingzi')) limit += 1;
  if (
    hasSkill(player, 'juejing') ||
    hasSkill(player, 'tongye_mou') ||
    hasSkill(player, 'weimu_mou') ||
    hasSkill(player, 'xueyi_ji') ||
    hasSkill(player, 'jushou_mou') ||
    hasSkill(player, 'qicai_mou') ||
    hasSkill(player, 'tianxiang_mou') ||
    hasSkill(player, 'jieying_shen') ||
    player.hero.id === 'jie_zhonghui'
  ) {
    limit += 2;
  }
  if (hasSkill(player, 'keji_mou') || player.hero.id === 'shen_zhugeliang') limit += 3;
  if (hasSkill(player, 'niepan_mou')) limit += 1;
  if (hasSkill(player, 'jizhu_mou') && player.hp <= 2) limit += 2;
  return limit;
}

export function isSlashUnlimitedRange(player: Player, card: Card): boolean {
  if (player.hero.id === 'jie_guanyu' && card.suit === 'diamond') return true;
  if ((player.hero.id === 'mou_guanyu' || player.hero.id === 'ji_guanyu') && isRedSuit(card.suit)) return true;
  if (hasSkill(player, 'wushen') && card.suit === 'heart') return true;
  if (hasSkill(player, 'shoudi_ji') && card.suit === 'diamond') return true;
  return false;
}

export function canTargetWithSlash(players: Player[], attacker: Player, target: Player, card: Card): boolean {
  if (!target.alive || attacker.id === target.id) return false;
  if (hasSkill(target, 'kongcheng') && target.hand.length === 0) return false;
  if (isSlashUnlimitedRange(attacker, card)) return true;
  const dist = getDistance(players, attacker, target);
  return dist <= getAttackRange(attacker);
}

export function getValidTargetsForCard(
  players: Player[],
  actor: Player,
  card: Card,
  mode: GameMode,
  asSkill?: string
): Player[] {
  const others = players.filter((p) => p.alive && p.id !== actor.id);

  if (asSkill === 'wusheng' || asSkill === 'longdan_sha' || asSkill === 'longhun_sha' || asSkill === 'wushen' || asSkill === 'shoudi_ji') {
    if (!hasUnlimitedSlash(actor, card) && actor.shaUsedThisTurn >= getMaxSlashPerTurn(actor, mode)) return [];
    return others.filter((t) => canTargetWithSlash(players, actor, t, card));
  }
  if (asSkill === 'qixi') {
    return others.filter((t) => hasAnyCard(t));
  }
  if (asSkill === 'guose') {
    return others.filter((t) => !t.judge.some((j) => j.name === '乐不思蜀'));
  }
  if (asSkill === 'duanliang_mou') {
    return others.filter((t) => !t.judge.some((j) => j.name === '兵粮寸断') && getDistance(players, actor, t) <= 2);
  }

  if (isSlashCard(card) || (hasSkill(actor, 'wushen') && card.suit === 'heart')) {
    if (!hasUnlimitedSlash(actor, card) && actor.shaUsedThisTurn >= getMaxSlashPerTurn(actor, mode)) return [];
    return others.filter((t) => canTargetWithSlash(players, actor, t, card));
  }

  switch (card.name) {
    case '桃':
      return actor.hp < actor.maxHp ? [actor] : [];
    case '酒':
      return actor.jiuUsedThisTurn < 1 ? [actor] : [];
    case '无中生有':
    case '桃园结义':
    case '南蛮入侵':
    case '万箭齐发':
    case '五谷丰登':
      return [actor];
    case '闪电':
      return actor.judge.some((j) => j.name === '闪电') ? [] : [actor];
    case '过河拆桥':
      return others.filter((t) => hasAnyCard(t));
    case '顺手牵羊':
      return others.filter((t) => hasAnyCard(t) && (hasSkill(actor, 'qicai_mou') || getDistance(players, actor, t) <= 1));
    case '决斗':
      return others.filter((t) => !(hasSkill(t, 'kongcheng') && t.hand.length === 0));
    case '火攻':
      return others.filter((t) => t.hand.length > 0);
    case '乐不思蜀':
      return others.filter((t) => !t.judge.some((j) => j.name === '乐不思蜀'));
    case '兵粮寸断':
      return others.filter((t) => !t.judge.some((j) => j.name === '兵粮寸断') && getDistance(players, actor, t) <= 1);
    case '闪':
    case '无懈可击':
      return [];
    default:
      if (['weapon', 'armor', 'horse_plus', 'horse_minus'].includes(card.type)) {
        return [actor];
      }
      return [];
  }
}

export function cardNeedsExplicitTarget(card: Card, asSkill?: string): boolean {
  if (asSkill && ['wusheng', 'longdan_sha', 'longhun_sha', 'wushen', 'qixi', 'guose', 'duanliang_mou', 'shoudi_ji'].includes(asSkill)) {
    return true;
  }
  if (isSlashCard(card)) return true;
  return ['过河拆桥', '顺手牵羊', '决斗', '火攻', '乐不思蜀', '兵粮寸断'].includes(card.name);
}

export function hasAnyCard(p: Player): boolean {
  return (
    p.hand.length > 0 ||
    !!p.equip.weapon ||
    !!p.equip.armor ||
    !!p.equip.horsePlus ||
    !!p.equip.horseMinus ||
    p.judge.length > 0
  );
}

export function getConvertiblePlaySkills(player: Player, card: Card): { skillId: string; label: string }[] {
  const res: { skillId: string; label: string }[] = [];
  if (hasSkill(player, 'wusheng') && isRedSuit(card.suit) && !isSlashCard(card)) {
    res.push({ skillId: 'wusheng', label: '武圣·当杀' });
  }
  if (hasSkill(player, 'longdan') && card.name === '闪') {
    res.push({ skillId: 'longdan_sha', label: '龙胆·当杀' });
  }
  if (hasSkill(player, 'qixi') && isBlackSuit(card.suit)) {
    res.push({ skillId: 'qixi', label: '奇袭·拆桥' });
  }
  if (hasSkill(player, 'guose') && card.suit === 'diamond') {
    res.push({ skillId: 'guose', label: '国色·乐不思蜀' });
  }
  if (hasSkill(player, 'duanliang_mou') && isBlackSuit(card.suit)) {
    res.push({ skillId: 'duanliang_mou', label: '断粮·兵粮' });
  }
  if (hasSkill(player, 'shoudi_ji') && card.suit === 'diamond' && !isSlashCard(card)) {
    res.push({ skillId: 'shoudi_ji', label: '狩敌·无距杀' });
  }
  if (hasSkill(player, 'longhun')) {
    if (card.suit === 'diamond' && !isSlashCard(card)) {
      res.push({ skillId: 'longhun_sha', label: '龙魂·火杀' });
    }
    if (card.suit === 'heart' && card.name !== '桃' && player.hp < player.maxHp) {
      res.push({ skillId: 'longhun_peach', label: '龙魂·桃' });
    }
  }
  return res;
}

export function getSeatTeamLabel(player: Player, mode: GameMode): { text: string; color: string; bg: string } {
  if (mode === '2v2') {
    return player.team === 'warm'
      ? { text: '暖色阵营', color: '#fca5a5', bg: 'rgba(185,28,28,0.85)' }
      : { text: '冷色阵营', color: '#93c5fd', bg: 'rgba(29,78,216,0.85)' };
  }
  if (mode === 'landlord') {
    return player.identity === 'landlord'
      ? { text: '地主', color: '#fde047', bg: 'rgba(161,98,7,0.9)' }
      : { text: '农民', color: '#86efac', bg: 'rgba(21,128,61,0.85)' };
  }
  if (!player.identityRevealed && !player.isHuman) {
    return { text: '身份暗置', color: '#cbd5e1', bg: 'rgba(51,65,85,0.85)' };
  }
  switch (player.identity) {
    case 'lord':
      return { text: '主公', color: '#fde047', bg: 'rgba(180,83,9,0.9)' };
    case 'loyalist':
      return { text: '忠臣', color: '#fbbf24', bg: 'rgba(217,119,6,0.85)' };
    case 'rebel':
      return { text: '反贼', color: '#86efac', bg: 'rgba(21,128,61,0.85)' };
    case 'renegade':
      return { text: '内奸', color: '#c4b5fd', bg: 'rgba(109,40,217,0.85)' };
    default:
      return { text: '未知', color: '#cbd5e1', bg: 'rgba(51,65,85,0.85)' };
  }
}
