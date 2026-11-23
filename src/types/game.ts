export type Faction = 'shu' | 'wei' | 'wu' | 'qun' | 'shen';

export type GameMode = '2v2' | 'landlord' | 'identity5';

export type Suit = 'spade' | 'heart' | 'club' | 'diamond';

export type CardType = 'basic' | 'trick' | 'delay' | 'weapon' | 'armor' | 'horse_plus' | 'horse_minus';

export type CardName =
  | '杀'
  | '火杀'
  | '雷杀'
  | '闪'
  | '桃'
  | '酒'
  | '无中生有'
  | '过河拆桥'
  | '顺手牵羊'
  | '南蛮入侵'
  | '万箭齐发'
  | '桃园结义'
  | '决斗'
  | '五谷丰登'
  | '无懈可击'
  | '火攻'
  | '乐不思蜀'
  | '兵粮寸断'
  | '闪电'
  | '诸葛连弩'
  | '青龙偃月刀'
  | '丈八蛇矛'
  | '贯石斧'
  | '青釭剑'
  | '麒麟弓'
  | '古锭刀'
  | '寒冰剑'
  | '八卦阵'
  | '仁王盾'
  | '藤甲'
  | '白银狮子'
  | '的卢'
  | '绝影'
  | '赤兔'
  | '大宛';

export interface Card {
  id: string;
  name: CardName;
  suit: Suit;
  rank: number; // 1..13
  type: CardType;
  range?: number; // for weapons
  description: string;
  element?: 'normal' | 'fire' | 'thunder';
}

export interface SkillDef {
  id: string;
  name: string;
  type: 'active' | 'passive' | 'trigger' | 'convert';
  description: string;
  shortDesc: string;
}

export type HeroRarity = 'rare' | 'epic' | 'legend' | 'shen';

export type HeroSeries = 'classic' | 'mou' | 'ji' | 'zhi' | 'shen';

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  series: HeroSeries;
  maxHp: number;
  gender: 'male' | 'female';
  rarity: HeroRarity;
  skills: SkillDef[];
  quote: string;
  portrait: string; // e.g. ./portraits/guanyu.jpg
  artPrimary: string;
  artSecondary: string;
  artAccent: string;
  weaponIcon: string;
  watermark: string;
}

export type Team = 'warm' | 'cool' | 'landlord' | 'peasant' | 'lord' | 'rebel' | 'renegade';

export type Identity = 'lord' | 'loyalist' | 'rebel' | 'renegade' | 'landlord' | 'peasant' | 'warm' | 'cool';

export interface EquipmentZone {
  weapon: Card | null;
  armor: Card | null;
  horsePlus: Card | null;
  horseMinus: Card | null;
}

export interface Player {
  id: string;
  seatIndex: number; // 0..N-1
  name: string;
  isHuman: boolean;
  hero: HeroDef;
  hp: number;
  maxHp: number;
  team: Team;
  identity: Identity;
  identityRevealed: boolean;
  alive: boolean;
  hand: Card[];
  equip: EquipmentZone;
  judge: Card[]; // delayed tricks
  // per-turn state
  shaUsedThisTurn: number;
  jiuUsedThisTurn: number;
  jiuActive: boolean;
  skillsUsedThisTurn: Record<string, number>;
  rendeGivenThisTurn: number;
  rendeHealedThisTurn: boolean;
  luoyiActive: boolean;
  kurouBonusSha: number;
  kurouRedUnblockable: boolean;
  wrathMarks: number; // 神吕布暴怒标记
  wuqianActive: boolean; // 神吕布无前
  yijueTargetId?: string; // 谋关羽义绝目标
  xiejiIgnoreArmor?: boolean; // 谋张飞协击无视防具
  liegongSuits: Suit[]; // 谋黄忠【烈弓】已记录的花色
  lastRecastRank?: number; // 志孙权【镇舷】上次重铸点数
  recastRanksThisTurn: number[]; // 志孙权【镇舷】本回合已重铸点数
  lastPlayedRed?: boolean; // 留赞【奋音】上一张牌颜色
  cardsPlayedThisTurn: number; // 骆统【勤政】本回合出牌数
  // stats
  damageDealt: number;
  kills: number;
}

export type Phase = 'prepare' | 'judge' | 'draw' | 'play' | 'discard' | 'end';

export interface FloatingEffect {
  id: string;
  targetId: string;
  text: string;
  kind: 'damage' | 'heal' | 'dodge' | 'skill' | 'info' | 'wuxie';
  createdAt: number;
}

export interface SkillBanner {
  id: string;
  playerName: string;
  heroName: string;
  skillName: string;
  faction: Faction;
  quote?: string;
}

export interface CombatVfx {
  id: string;
  kind: 'slash' | 'fire_slash' | 'thunder_slash' | 'dodge' | 'heal' | 'jiu' | 'trick' | 'aoe' | 'lightning';
  label: string;
  sublabel?: string;
  targetId?: string;
}

export interface HitFlash {
  id: string;
  targetId: string;
  amount: number;
  element: 'normal' | 'fire' | 'thunder';
}

export interface LogEntry {
  id: string;
  turn: number;
  text: string;
  kind: 'normal' | 'damage' | 'heal' | 'skill' | 'death' | 'phase' | 'system';
}

export type PromptKind =
  | 'respond_shan'
  | 'respond_sha'
  | 'respond_peach'
  | 'respond_wuxie'
  | 'discard'
  | 'pick_card_from_target'
  | 'guanxing'
  | 'wugu'
  | 'fanjian_guess'
  | 'yiji_give'
  | 'tuxi_targets'
  | 'guanshi_discard'
  | 'qilin_horse';

export interface PendingPrompt {
  id: string;
  kind: PromptKind;
  playerId: string; // who needs to respond
  title: string;
  subtitle: string;
  minCards?: number;
  maxCards?: number;
  requiredCount?: number; // e.g., Wushuang needs 2 Shan
  sourcePlayerId?: string;
  targetPlayerId?: string;
  cards?: Card[]; // for guanxing, wugu, yiji
  canSkip?: boolean;
  filterSuit?: Suit[];
  blockedSuits?: Suit[]; // e.g. 谋黄忠烈弓封锁的闪花色
  filterNames?: CardName[];
  allowEquip?: boolean;
  allowJudge?: boolean;
  context?: Record<string, unknown>;
  resolve: (result: PromptResult) => void;
}

export interface PromptResult {
  confirmed: boolean;
  selectedCardIds?: string[];
  selectedTargetIds?: string[];
  selectedZone?: 'hand' | 'weapon' | 'armor' | 'horsePlus' | 'horseMinus' | 'judge';
  selectedZoneCardId?: string;
  selectedSuit?: Suit;
  topCards?: Card[];
  bottomCards?: Card[];
  giveMap?: Record<string, string[]>; // targetId -> cardIds
}

export interface PlayedCardVisual {
  id: string;
  card: Card;
  fromName: string;
  toName?: string;
  label?: string;
}

export interface RankProfile {
  tierIndex: number; // 0..5
  stars: number;
  wins: number;
  losses: number;
  streak: number;
  totalKills: number;
}

export interface GameState {
  mode: GameMode;
  turnNumber: number;
  currentSeat: number;
  phase: Phase;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  tableCards: PlayedCardVisual[];
  logs: LogEntry[];
  floatingEffects: FloatingEffect[];
  activeBanner: SkillBanner | null;
  activeVfx: CombatVfx | null;
  hitFlash: HitFlash | null;
  pendingPrompt: PendingPrompt | null;
  winner: {
    team: Team;
    title: string;
    subtitle: string;
    isHumanWin: boolean;
  } | null;
  luckyCardLeft: number; // 手气卡次数
  autoPlay: boolean;
  speedMultiplier: 1 | 2;
  started: boolean;
}
