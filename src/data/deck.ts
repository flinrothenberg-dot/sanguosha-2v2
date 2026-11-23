import { Card, CardName, CardType, Suit } from '../types/game';

interface CardBlueprint {
  name: CardName;
  type: CardType;
  suit: Suit;
  rank: number;
  range?: number;
  element?: 'normal' | 'fire' | 'thunder';
  description: string;
}

const DESC: Record<CardName, string> = {
  杀: '对攻击范围内的一名角色使用，令其打出一张【闪】，否则受到1点伤害。',
  火杀: '火焰属性【杀】，对【藤甲】角色伤害+1。',
  雷杀: '雷电属性【杀】，对攻击范围内的一名角色造成1点雷电伤害。',
  闪: '抵消对你使用的一张【杀】。',
  桃: '出牌阶段回复1点体力；或任意角色濒死时令其回复1点体力。',
  酒: '出牌阶段使用，本回合下一张【杀】伤害+1；或自身濒死时回复1点体力。',
  无中生有: '出牌阶段对自己使用，摸2张牌。',
  过河拆桥: '弃置任意一名其他角色手牌、装备区或判定区的一张牌（无距离限制）。',
  顺手牵羊: '获得距离为1以内的一名其他角色手牌、装备区或判定区的一张牌。',
  南蛮入侵: '对所有其他角色使用，除非其打出一张【杀】，否则受到1点伤害。',
  万箭齐发: '对所有其他角色使用，除非其打出一张【闪】，否则受到1点伤害。',
  桃园结义: '令所有已受伤的角色各回复1点体力。',
  决斗: '对一名其他角色使用，由目标开始轮流打出【杀】，先无法打出者受1点伤害。',
  五谷丰登: '亮出与存活角色数等量的牌，从你开始每人依次选拿1张。',
  无懈可击: '在目标锦囊牌生效前，抵消其对一名角色的效果。',
  火攻: '展示目标一张手牌，你可弃置同花色手牌对其造成1点火焰伤害。',
  乐不思蜀: '置于其他角色判定区，判定非红桃则跳过其出牌阶段。',
  兵粮寸断: '置于距离1以内其他角色判定区，判定非梅花则跳过其摸牌阶段。',
  闪电: '置于自己判定区，若判定为黑桃2~9则受到3点雷电伤害，否则传给下家。',
  诸葛连弩: '武器（范围1）：出牌阶段你使用【杀】无次数限制。',
  青龙偃月刀: '武器（范围3）：当你使用的【杀】被【闪】抵消时，可再对其使用一张【杀】。',
  丈八蛇矛: '武器（范围3）：可将两张手牌当一张普通【杀】使用或打出。',
  贯石斧: '武器（范围3）：你的【杀】被【闪】抵消时，可弃2张牌令此【杀】依然造成伤害。',
  青釭剑: '武器（范围2）：锁定技，你的【杀】无视目标防具。',
  麒麟弓: '武器（范围5）：你的【杀】造成伤害时，可弃置目标装备区的一匹坐骑。',
  古锭刀: '武器（范围2）：锁定技，你的【杀】对没有手牌的角色造成伤害+1。',
  寒冰剑: '武器（范围2）：你的【杀】造成伤害时，可改为依次弃置目标2张牌。',
  八卦阵: '防具：每当你需要使用或打出【闪】时，可判定，若为红色则视为打出【闪】。',
  仁王盾: '防具：锁定技，黑色的【杀】对你无效。',
  藤甲: '防具：锁定技，【南蛮入侵】、【万箭齐发】和普通【杀】对你无效；受到火焰伤害+1。',
  白银狮子: '防具：锁定技，你每次最多受到1点伤害；失去装备区的此牌时回复1点体力。',
  的卢: '防御马（+1）：其他角色计算与你的距离+1。',
  绝影: '防御马（+1）：其他角色计算与你的距离+1。',
  赤兔: '进攻马（-1）：你计算与其他角色的距离-1。',
  大宛: '进攻马（-1）：你计算与其他角色的距离-1。',
};

const BLUEPRINTS: CardBlueprint[] = [
  // 杀 (28张: 普通杀20 + 火杀4 + 雷杀4)
  ...[7, 8, 8, 9, 9, 10, 10].map((rank) => ({ name: '杀' as CardName, type: 'basic' as CardType, suit: 'spade' as Suit, rank, element: 'normal' as const, description: DESC['杀'] })),
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((rank) => ({ name: '杀' as CardName, type: 'basic' as CardType, suit: 'club' as Suit, rank, element: 'normal' as const, description: DESC['杀'] })),
  ...[10, 10, 11].map((rank) => ({ name: '杀' as CardName, type: 'basic' as CardType, suit: 'heart' as Suit, rank, element: 'normal' as const, description: DESC['杀'] })),
  ...[6, 7, 8, 9, 10, 13].map((rank) => ({ name: '杀' as CardName, type: 'basic' as CardType, suit: 'diamond' as Suit, rank, element: 'normal' as const, description: DESC['杀'] })),
  ...[4, 7, 10].map((rank) => ({ name: '火杀' as CardName, type: 'basic' as CardType, suit: 'heart' as Suit, rank, element: 'fire' as const, description: DESC['火杀'] })),
  { name: '火杀', type: 'basic', suit: 'diamond', rank: 5, element: 'fire', description: DESC['火杀'] },
  ...[4, 5, 6, 7].map((rank) => ({ name: '雷杀' as CardName, type: 'basic' as CardType, suit: 'spade' as Suit, rank, element: 'thunder' as const, description: DESC['雷杀'] })),

  // 闪 (18张)
  ...[2, 2, 8, 9, 11, 13].map((rank) => ({ name: '闪' as CardName, type: 'basic' as CardType, suit: 'heart' as Suit, rank, description: DESC['闪'] })),
  ...[2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11].map((rank) => ({ name: '闪' as CardName, type: 'basic' as CardType, suit: 'diamond' as Suit, rank, description: DESC['闪'] })),

  // 桃 (10张)
  ...[3, 4, 6, 7, 8, 9, 12].map((rank) => ({ name: '桃' as CardName, type: 'basic' as CardType, suit: 'heart' as Suit, rank, description: DESC['桃'] })),
  ...[2, 3, 12].map((rank) => ({ name: '桃' as CardName, type: 'basic' as CardType, suit: 'diamond' as Suit, rank, description: DESC['桃'] })),

  // 酒 (5张)
  { name: '酒', type: 'basic', suit: 'spade', rank: 3, description: DESC['酒'] },
  { name: '酒', type: 'basic', suit: 'spade', rank: 9, description: DESC['酒'] },
  { name: '酒', type: 'basic', suit: 'club', rank: 3, description: DESC['酒'] },
  { name: '酒', type: 'basic', suit: 'club', rank: 9, description: DESC['酒'] },
  { name: '酒', type: 'basic', suit: 'diamond', rank: 9, description: DESC['酒'] },

  // 锦囊
  ...[7, 8, 9, 11].map((rank) => ({ name: '无中生有' as CardName, type: 'trick' as CardType, suit: 'heart' as Suit, rank, description: DESC['无中生有'] })),
  ...[3, 4, 12].map((rank) => ({ name: '过河拆桥' as CardName, type: 'trick' as CardType, suit: 'spade' as Suit, rank, description: DESC['过河拆桥'] })),
  ...[3, 4].map((rank) => ({ name: '过河拆桥' as CardName, type: 'trick' as CardType, suit: 'club' as Suit, rank, description: DESC['过河拆桥'] })),
  { name: '过河拆桥', type: 'trick', suit: 'heart', rank: 12, description: DESC['过河拆桥'] },
  ...[3, 4, 11].map((rank) => ({ name: '顺手牵羊' as CardName, type: 'trick' as CardType, suit: 'spade' as Suit, rank, description: DESC['顺手牵羊'] })),
  ...[3, 4].map((rank) => ({ name: '顺手牵羊' as CardName, type: 'trick' as CardType, suit: 'diamond' as Suit, rank, description: DESC['顺手牵羊'] })),
  { name: '南蛮入侵', type: 'trick', suit: 'spade', rank: 7, description: DESC['南蛮入侵'] },
  { name: '南蛮入侵', type: 'trick', suit: 'spade', rank: 13, description: DESC['南蛮入侵'] },
  { name: '南蛮入侵', type: 'trick', suit: 'club', rank: 7, description: DESC['南蛮入侵'] },
  { name: '万箭齐发', type: 'trick', suit: 'heart', rank: 1, description: DESC['万箭齐发'] },
  { name: '桃园结义', type: 'trick', suit: 'heart', rank: 1, description: DESC['桃园结义'] },
  { name: '决斗', type: 'trick', suit: 'spade', rank: 1, description: DESC['决斗'] },
  { name: '决斗', type: 'trick', suit: 'club', rank: 1, description: DESC['决斗'] },
  { name: '决斗', type: 'trick', suit: 'diamond', rank: 1, description: DESC['决斗'] },
  { name: '五谷丰登', type: 'trick', suit: 'heart', rank: 3, description: DESC['五谷丰登'] },
  { name: '五谷丰登', type: 'trick', suit: 'heart', rank: 4, description: DESC['五谷丰登'] },
  { name: '无懈可击', type: 'trick', suit: 'spade', rank: 11, description: DESC['无懈可击'] },
  { name: '无懈可击', type: 'trick', suit: 'club', rank: 12, description: DESC['无懈可击'] },
  { name: '无懈可击', type: 'trick', suit: 'club', rank: 13, description: DESC['无懈可击'] },
  { name: '无懈可击', type: 'trick', suit: 'diamond', rank: 12, description: DESC['无懈可击'] },
  { name: '无懈可击', type: 'trick', suit: 'heart', rank: 13, description: DESC['无懈可击'] },
  { name: '火攻', type: 'trick', suit: 'heart', rank: 2, description: DESC['火攻'] },
  { name: '火攻', type: 'trick', suit: 'heart', rank: 3, description: DESC['火攻'] },
  { name: '火攻', type: 'trick', suit: 'diamond', rank: 12, description: DESC['火攻'] },

  // 延时锦囊
  { name: '乐不思蜀', type: 'delay', suit: 'spade', rank: 6, description: DESC['乐不思蜀'] },
  { name: '乐不思蜀', type: 'delay', suit: 'club', rank: 6, description: DESC['乐不思蜀'] },
  { name: '乐不思蜀', type: 'delay', suit: 'heart', rank: 6, description: DESC['乐不思蜀'] },
  { name: '兵粮寸断', type: 'delay', suit: 'spade', rank: 10, description: DESC['兵粮寸断'] },
  { name: '兵粮寸断', type: 'delay', suit: 'club', rank: 4, description: DESC['兵粮寸断'] },
  { name: '闪电', type: 'delay', suit: 'spade', rank: 1, description: DESC['闪电'] },

  // 武器
  { name: '诸葛连弩', type: 'weapon', suit: 'club', rank: 1, range: 1, description: DESC['诸葛连弩'] },
  { name: '诸葛连弩', type: 'weapon', suit: 'diamond', rank: 1, range: 1, description: DESC['诸葛连弩'] },
  { name: '青龙偃月刀', type: 'weapon', suit: 'spade', rank: 5, range: 3, description: DESC['青龙偃月刀'] },
  { name: '丈八蛇矛', type: 'weapon', suit: 'spade', rank: 12, range: 3, description: DESC['丈八蛇矛'] },
  { name: '贯石斧', type: 'weapon', suit: 'diamond', rank: 5, range: 3, description: DESC['贯石斧'] },
  { name: '青釭剑', type: 'weapon', suit: 'spade', rank: 6, range: 2, description: DESC['青釭剑'] },
  { name: '麒麟弓', type: 'weapon', suit: 'heart', rank: 5, range: 5, description: DESC['麒麟弓'] },
  { name: '古锭刀', type: 'weapon', suit: 'spade', rank: 1, range: 2, description: DESC['古锭刀'] },
  { name: '寒冰剑', type: 'weapon', suit: 'spade', rank: 2, range: 2, description: DESC['寒冰剑'] },

  // 防具
  { name: '八卦阵', type: 'armor', suit: 'spade', rank: 2, description: DESC['八卦阵'] },
  { name: '八卦阵', type: 'armor', suit: 'club', rank: 2, description: DESC['八卦阵'] },
  { name: '仁王盾', type: 'armor', suit: 'club', rank: 2, description: DESC['仁王盾'] },
  { name: '藤甲', type: 'armor', suit: 'spade', rank: 2, description: DESC['藤甲'] },
  { name: '白银狮子', type: 'armor', suit: 'club', rank: 1, description: DESC['白银狮子'] },

  // 坐骑
  { name: '的卢', type: 'horse_plus', suit: 'club', rank: 5, description: DESC['的卢'] },
  { name: '绝影', type: 'horse_plus', suit: 'spade', rank: 5, description: DESC['绝影'] },
  { name: '赤兔', type: 'horse_minus', suit: 'heart', rank: 5, description: DESC['赤兔'] },
  { name: '大宛', type: 'horse_minus', suit: 'spade', rank: 13, description: DESC['大宛'] },
];

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createDeck(): Card[] {
  return shuffle(
    BLUEPRINTS.map((bp, idx) => ({
      ...bp,
      id: `card_${idx}_${Math.random().toString(36).slice(2, 7)}`,
    }))
  );
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'heart' || suit === 'diamond';
}

export function isBlackSuit(suit: Suit): boolean {
  return suit === 'spade' || suit === 'club';
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spade':
      return '♠';
    case 'heart':
      return '♥';
    case 'club':
      return '♣';
    case 'diamond':
      return '♦';
  }
}

export function rankLabel(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}
