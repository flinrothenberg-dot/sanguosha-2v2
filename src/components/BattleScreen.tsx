import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, GameState, Player, RankProfile } from '../types/game';
import { GameController } from '../engine/gameController';
import {
  canActAsPeach,
  canActAsShan,
  canActAsSlash,
  canActAsWuxie,
  cardNeedsExplicitTarget,
  getAttackRange,
  getConvertiblePlaySkills,
  getDistance,
  getHandLimit,
  getMaxSlashPerTurn,
  getSeatTeamLabel,
  getValidTargetsForCard,
  hasSkill,
  hasUnlimitedSlash,
  isEnemy,
} from '../engine/rules';
import { isBlackSuit, isRedSuit, suitSymbol } from '../data/deck';
import { HeroArt } from './HeroArt';
import { PlayingCard } from './PlayingCard';
import { PromptModal } from './PromptModal';
import { VictoryModal } from './VictoryModal';
import {
  Bot,
  FastForward,
  LogOut,
  ScrollText,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
} from 'lucide-react';

interface BattleScreenProps {
  controller: GameController;
  rank: RankProfile;
  sfxEnabled: boolean;
  voiceEnabled: boolean;
  onToggleSfx: () => void;
  onToggleVoice: () => void;
  onPlayAgain: () => void;
  onBackLobby: () => void;
}

const PHASE_LABEL: Record<GameState['phase'], string> = {
  prepare: '准备阶段',
  judge: '判定阶段',
  draw: '摸牌阶段',
  play: '出牌阶段',
  discard: '弃牌阶段',
  end: '结束阶段',
};

const MODAL_PROMPT_KINDS = new Set([
  'pick_card_from_target',
  'guanxing',
  'wugu',
  'fanjian_guess',
  'tuxi_targets',
]);

export const BattleScreen: React.FC<BattleScreenProps> = ({
  controller,
  rank,
  sfxEnabled,
  voiceEnabled,
  onToggleSfx,
  onToggleVoice,
  onPlayAgain,
  onBackLobby,
}) => {
  const [state, setState] = useState<GameState>(() => controller.getState());
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [activeSkillMode, setActiveSkillMode] = useState<string | null>(null);
  const [convertSkillId, setConvertSkillId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [sortTrigger, setSortTrigger] = useState(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = controller.subscribe((next) => setState(next));
    controller.start();
    return () => {
      unsub();
    };
  }, [controller]);

  useEffect(() => {
    setSelectedCardIds([]);
    setSelectedTargetIds([]);
    setActiveSkillMode(null);
    setConvertSkillId(null);
  }, [state.currentSeat, state.phase, state.pendingPrompt?.id]);

  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.logs.length, showLogs]);

  const human = useMemo(() => state.players.find((p) => p.isHuman)!, [state.players]);
  const others = useMemo(() => state.players.filter((p) => !p.isHuman), [state.players]);
  const currentPlayer = state.players[state.currentSeat];
  const isHumanPlayTurn =
    currentPlayer?.id === human.id && state.phase === 'play' && !state.pendingPrompt && !state.autoPlay;

  const inlinePrompt =
    state.pendingPrompt && !MODAL_PROMPT_KINDS.has(state.pendingPrompt.kind) ? state.pendingPrompt : null;
  const modalPrompt =
    state.pendingPrompt && MODAL_PROMPT_KINDS.has(state.pendingPrompt.kind) ? state.pendingPrompt : null;

  const selectedSingleCard: Card | null =
    selectedCardIds.length === 1 ? human.hand.find((c) => c.id === selectedCardIds[0]) ?? null : null;

  const convertibleSkills = useMemo(() => {
    if (!isHumanPlayTurn || !selectedSingleCard || activeSkillMode) return [];
    return getConvertiblePlaySkills(human, selectedSingleCard);
  }, [isHumanPlayTurn, selectedSingleCard, activeSkillMode, human]);

  const validTargets = useMemo((): Player[] => {
    if (!isHumanPlayTurn) return [];
    if (
      activeSkillMode === 'rende' ||
      activeSkillMode === 'fanjian' ||
      activeSkillMode === 'yijue_mou' ||
      activeSkillMode === 'huoji_mou' ||
      activeSkillMode === 'ronghuo_mou' ||
      activeSkillMode === 'qianxun_mou' ||
      activeSkillMode === 'xuanhuo_mou' ||
      activeSkillMode === 'qingzheng_mou' ||
      activeSkillMode === 'quanmou_mou' ||
      activeSkillMode === 'shensu_mou' ||
      activeSkillMode === 'quhu_mou' ||
      activeSkillMode === 'kuangfu_mou' ||
      activeSkillMode === 'dimeng_mou' ||
      activeSkillMode === 'leiji_mou' ||
      activeSkillMode === 'hanzhi_zhi' ||
      activeSkillMode === 'fangquan_zhi' ||
      activeSkillMode === 'tiaoxin_mou' ||
      activeSkillMode === 'jieyue_mou' ||
      activeSkillMode === 'qiaobian_mou' ||
      activeSkillMode === 'qingjian_mou' ||
      activeSkillMode === 'mingce_mou' ||
      activeSkillMode === 'lieren_mou' ||
      activeSkillMode === 'kuangfeng_shen' ||
      activeSkillMode === 'yeyan_shen' ||
      activeSkillMode === 'poxi_shen' ||
      activeSkillMode === 'yingba_shen' ||
      activeSkillMode === 'qiangxi_shen'
    ) {
      return state.players.filter((p) => p.alive && p.id !== human.id);
    }
    if (activeSkillMode === 'qingnang') {
      return state.players.filter((p) => p.alive && p.hp < p.maxHp);
    }
    if (activeSkillMode === 'jieyin') {
      return state.players.filter((p) => p.alive && p.id !== human.id && p.hero.gender === 'male' && p.hp < p.maxHp);
    }
    if (activeSkillMode === 'lijian') {
      return state.players.filter((p) => p.alive && p.hero.gender === 'male');
    }
    if (activeSkillMode === 'zhangba') {
      if (!hasUnlimitedSlash(human) && human.shaUsedThisTurn >= getMaxSlashPerTurn(human, state.mode)) return [];
      return state.players.filter(
        (p) => p.alive && p.id !== human.id && getDistance(state.players, human, p) <= getAttackRange(human)
      );
    }
    if (selectedSingleCard) {
      return getValidTargetsForCard(state.players, human, selectedSingleCard, state.mode, convertSkillId ?? undefined);
    }
    return [];
  }, [isHumanPlayTurn, activeSkillMode, selectedSingleCard, convertSkillId, state.players, state.mode, human]);

  const validTargetIdSet = useMemo(() => new Set(validTargets.map((p) => p.id)), [validTargets]);

  // Auto-preselect target when there is exactly 1 valid enemy target for snappy official UX
  useEffect(() => {
    if (!isHumanPlayTurn || activeSkillMode === 'lijian') return;
    if (selectedSingleCard && cardNeedsExplicitTarget(selectedSingleCard, convertSkillId ?? undefined)) {
      const enemies = validTargets.filter((t) => isEnemy(human, t, state.mode));
      if (enemies.length === 1) {
        setSelectedTargetIds([enemies[0].id]);
      } else if (validTargets.length === 1) {
        setSelectedTargetIds([validTargets[0].id]);
      }
    }
  }, [selectedSingleCard?.id, convertSkillId, isHumanPlayTurn, activeSkillMode]);

  const isCardSelectable = (card: Card): boolean => {
    if (inlinePrompt) {
      const isOwnTurn = currentPlayer?.id === human.id;
      if (inlinePrompt.kind === 'respond_shan') {
        const blocked = inlinePrompt.blockedSuits ?? [];
        return canActAsShan(human, card) && !blocked.includes(card.suit);
      }
      if (inlinePrompt.kind === 'respond_sha') return canActAsSlash(human, card);
      if (inlinePrompt.kind === 'respond_peach') {
        const isSelf = inlinePrompt.targetPlayerId === human.id;
        return canActAsPeach(human, card, isOwnTurn) || (isSelf && card.name === '酒');
      }
      if (inlinePrompt.kind === 'respond_wuxie') return canActAsWuxie(human, card);
      if (inlinePrompt.kind === 'discard' || inlinePrompt.kind === 'guanshi_discard') return true;
      return false;
    }
    if (!isHumanPlayTurn) return false;
    if (activeSkillMode) {
      if (
        activeSkillMode === 'shenfen' ||
        activeSkillMode === 'luanwu_mou' ||
        activeSkillMode === 'quanmou_mou' ||
        activeSkillMode === 'tiaoxin_mou' ||
        activeSkillMode === 'poxi_shen' ||
        activeSkillMode === 'yingba_shen' ||
        activeSkillMode === 'huishi_shen' ||
        activeSkillMode === 'qiangxi_shen'
      ) {
        return false;
      }
      if (
        activeSkillMode === 'huoji_mou' ||
        activeSkillMode === 'ronghuo_mou' ||
        activeSkillMode === 'qianxun_mou' ||
        activeSkillMode === 'zaiqi_mou' ||
        activeSkillMode === 'lieren_mou'
      ) {
        return isRedSuit(card.suit);
      }
      if (activeSkillMode === 'zhenxian_zhi') return !human.recastRanksThisTurn.includes(card.rank);
      if (activeSkillMode === 'jiuchi_mou') return isBlackSuit(card.suit);
      if (activeSkillMode === 'leiji_mou') return card.name === '闪' || card.suit === 'spade';
      return true;
    }
    const normalTargets = getValidTargetsForCard(state.players, human, card, state.mode);
    if (normalTargets.length > 0) return true;
    const convs = getConvertiblePlaySkills(human, card);
    return convs.some((cv) =>
      cv.skillId === 'longhun_peach'
        ? human.hp < human.maxHp
        : getValidTargetsForCard(state.players, human, card, state.mode, cv.skillId).length > 0
    );
  };

  const handleCardClick = (card: Card) => {
    if (!isCardSelectable(card)) return;

    if (inlinePrompt) {
      const max = inlinePrompt.maxCards ?? 1;
      setSelectedCardIds((prev) => {
        if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
        if (max === 1) return [card.id];
        if (prev.length >= max) return [...prev.slice(1), card.id];
        return [...prev, card.id];
      });
      return;
    }

    if (activeSkillMode) {
      const multi = activeSkillMode === 'zhiheng' || activeSkillMode === 'rende';
      const max =
        activeSkillMode === 'jieyin' ||
        activeSkillMode === 'zhangba' ||
        activeSkillMode === 'dujiang_mou' ||
        activeSkillMode === 'luanji_mou' ||
        activeSkillMode === 'yeyan_shen'
          ? 2
          : multi
            ? 99
            : 1;
      setSelectedCardIds((prev) => {
        if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
        if (max === 1) return [card.id];
        if (prev.length >= max) return [...prev.slice(1), card.id];
        return [...prev, card.id];
      });
      return;
    }

    if (selectedCardIds.includes(card.id)) {
      // Double-click self-target card to play immediately
      if (!cardNeedsExplicitTarget(card, convertSkillId ?? undefined)) {
        const targets = getValidTargetsForCard(state.players, human, card, state.mode, convertSkillId ?? undefined);
        if (targets.length > 0) {
          controller.humanPlayCard(card.id, targets[0].id, convertSkillId ?? undefined);
          setSelectedCardIds([]);
          setConvertSkillId(null);
          return;
        }
      }
      setSelectedCardIds([]);
      setSelectedTargetIds([]);
      setConvertSkillId(null);
    } else {
      setSelectedCardIds([card.id]);
      setSelectedTargetIds([]);
      const normalValid = getValidTargetsForCard(state.players, human, card, state.mode);
      if (normalValid.length === 0) {
        const convs = getConvertiblePlaySkills(human, card);
        setConvertSkillId(convs[0]?.skillId ?? null);
      } else {
        setConvertSkillId(null);
      }
    }
  };

  const handleSeatClick = (target: Player) => {
    if (!isHumanPlayTurn || !validTargetIdSet.has(target.id)) return;

    // Official style: 1st click locks target with crossed swords (⚔); clicking an already-locked target immediately confirms & fires!
    if (activeSkillMode === 'lijian') {
      setSelectedTargetIds((prev) => {
        if (prev.includes(target.id)) return prev.filter((id) => id !== target.id);
        if (prev.length >= 2) return [prev[1], target.id];
        return [...prev, target.id];
      });
      return;
    }

    if (selectedTargetIds.includes(target.id) && !activeSkillMode && selectedSingleCard) {
      controller.humanPlayCard(selectedSingleCard.id, target.id, convertSkillId ?? undefined);
      setSelectedCardIds([]);
      setSelectedTargetIds([]);
      setConvertSkillId(null);
      return;
    }

    setSelectedTargetIds([target.id]);
  };

  const canConfirmAction = (): boolean => {
    if (inlinePrompt) {
      const min = inlinePrompt.minCards ?? 1;
      return selectedCardIds.length >= min;
    }
    if (!isHumanPlayTurn) return false;
    if (activeSkillMode === 'shenfen') return human.wrathMarks >= 4;
    if (activeSkillMode === 'luanwu_mou' || activeSkillMode === 'huishi_shen') return true;
    if (
      activeSkillMode === 'quanmou_mou' ||
      activeSkillMode === 'tiaoxin_mou' ||
      activeSkillMode === 'poxi_shen' ||
      activeSkillMode === 'yingba_shen' ||
      activeSkillMode === 'qiangxi_shen'
    ) {
      return selectedTargetIds.length === 1;
    }
    if (activeSkillMode === 'zhiheng') return selectedCardIds.length >= 1;
    if (
      activeSkillMode === 'kurou' ||
      activeSkillMode === 'xieji_mou' ||
      activeSkillMode === 'lianhuan_mou' ||
      activeSkillMode === 'fenwei_mou' ||
      activeSkillMode === 'jiuchi_mou' ||
      activeSkillMode === 'zhenxian_zhi' ||
      activeSkillMode === 'beizhi_zhi' ||
      activeSkillMode === 'wengua_zhi' ||
      activeSkillMode === 'tianyi_mou' ||
      activeSkillMode === 'zaiqi_mou' ||
      activeSkillMode === 'jilue_shen' ||
      activeSkillMode === 'cuike_shen' ||
      activeSkillMode === 'huashen_jie' ||
      activeSkillMode === 'shanjia_legend' ||
      activeSkillMode === 'chenglue_legend'
    ) {
      return selectedCardIds.length === 1;
    }
    if (activeSkillMode === 'dujiang_mou' || activeSkillMode === 'luanji_mou') {
      return selectedCardIds.length === 2;
    }
    if (activeSkillMode === 'yeyan_shen') {
      return selectedCardIds.length === 2 && selectedTargetIds.length === 1;
    }
    if (activeSkillMode === 'rende') return selectedCardIds.length >= 1 && selectedTargetIds.length === 1;
    if (
      activeSkillMode === 'qingnang' ||
      activeSkillMode === 'fanjian' ||
      activeSkillMode === 'yijue_mou' ||
      activeSkillMode === 'huoji_mou' ||
      activeSkillMode === 'ronghuo_mou' ||
      activeSkillMode === 'qianxun_mou' ||
      activeSkillMode === 'xuanhuo_mou' ||
      activeSkillMode === 'qingzheng_mou' ||
      activeSkillMode === 'shensu_mou' ||
      activeSkillMode === 'quhu_mou' ||
      activeSkillMode === 'kuangfu_mou' ||
      activeSkillMode === 'dimeng_mou' ||
      activeSkillMode === 'leiji_mou' ||
      activeSkillMode === 'hanzhi_zhi' ||
      activeSkillMode === 'fangquan_zhi' ||
      activeSkillMode === 'jieyue_mou' ||
      activeSkillMode === 'qiaobian_mou' ||
      activeSkillMode === 'qingjian_mou' ||
      activeSkillMode === 'mingce_mou' ||
      activeSkillMode === 'lieren_mou' ||
      activeSkillMode === 'kuangfeng_shen' ||
      activeSkillMode === 'yeyan_shen' ||
      activeSkillMode === 'poxi_shen' ||
      activeSkillMode === 'yingba_shen' ||
      activeSkillMode === 'qiangxi_shen'
    ) {
      return selectedCardIds.length === 1 && selectedTargetIds.length === 1;
    }
    if (activeSkillMode === 'jieyin') return selectedCardIds.length === 2 && selectedTargetIds.length === 1;
    if (activeSkillMode === 'lijian') return selectedCardIds.length === 1 && selectedTargetIds.length === 2;
    if (activeSkillMode === 'zhangba') return selectedCardIds.length === 2 && selectedTargetIds.length === 1;

    if (selectedSingleCard) {
      if (convertSkillId === 'longhun_peach') return human.hp < human.maxHp;
      if (!cardNeedsExplicitTarget(selectedSingleCard, convertSkillId ?? undefined)) {
        return validTargets.length > 0;
      }
      return selectedTargetIds.length === 1 && validTargetIdSet.has(selectedTargetIds[0]);
    }
    return false;
  };

  const handleConfirm = () => {
    if (inlinePrompt) {
      controller.submitPrompt({ confirmed: true, selectedCardIds });
      setSelectedCardIds([]);
      return;
    }
    if (!isHumanPlayTurn) return;
    if (activeSkillMode === 'zhangba') {
      controller.humanUseZhangba(selectedCardIds[0], selectedCardIds[1], selectedTargetIds[0]);
    } else if (activeSkillMode) {
      controller.humanUseActiveSkill(activeSkillMode, selectedCardIds, selectedTargetIds);
    } else if (selectedSingleCard) {
      const targetId = cardNeedsExplicitTarget(selectedSingleCard, convertSkillId ?? undefined)
        ? selectedTargetIds[0]
        : human.id;
      controller.humanPlayCard(selectedSingleCard.id, targetId, convertSkillId ?? undefined);
    }
    setSelectedCardIds([]);
    setSelectedTargetIds([]);
    setActiveSkillMode(null);
    setConvertSkillId(null);
  };

  const handleSecondaryBtn = () => {
    if (inlinePrompt && inlinePrompt.canSkip) {
      controller.submitPrompt({ confirmed: false });
      setSelectedCardIds([]);
      return;
    }
    if (selectedCardIds.length > 0 || activeSkillMode) {
      setSelectedCardIds([]);
      setSelectedTargetIds([]);
      setActiveSkillMode(null);
      setConvertSkillId(null);
      return;
    }
    if (isHumanPlayTurn) {
      controller.humanEndPlayPhase();
    }
  };

  // Active skill pills overlaid on bottom of human portrait (exact official style!)
  const activeSkillButtons = useMemo(() => {
    const btns: { id: string; label: string; enabled: boolean; hint: string }[] = [];
    const used = human.skillsUsedThisTurn;
    const addBtn = (id: string, label: string, needCards: number, hint: string, extraCond = true) => {
      if (!hasSkill(human, id)) return;
      btns.push({
        id,
        label,
        enabled: isHumanPlayTurn && (used[id] ?? 0) < 1 && human.hand.length >= needCards && extraCond,
        hint,
      });
    };

    addBtn('zhiheng', human.hero.id === 'ji_sunquan' ? '极·制衡' : '制衡', 1, '选择任意手牌后点【确定】重摸');
    if (hasSkill(human, 'rende')) {
      btns.push({
        id: 'rende',
        label: '仁德',
        enabled: isHumanPlayTurn && human.hand.length > 0,
        hint: '选择任意手牌并点击一名目标角色，再点【确定】',
      });
    }
    addBtn('kurou', '苦肉', 1, '选择1张手牌后点【确定】：扣1血摸3牌+红杀必中');
    addBtn('qingnang', '青囊', 1, '选择1张手牌并点击1名受伤角色，再点【确定】');
    addBtn('jieyin', '结姻', 2, '选择2张手牌并点击1名受伤男性角色，再点【确定】');
    addBtn('fanjian', '反间', 1, '选择1张手牌并点击1名敌方角色，再点【确定】');
    addBtn('lijian', human.hero.id === 'ji_diaochan' ? '极·离间' : '离间', 1, '选1张手牌并依次点击2名男性角色，再点【确定】');
    if (hasSkill(human, 'shenfen')) {
      btns.push({
        id: 'shenfen',
        label: `神愤 ${human.wrathMarks}/4`,
        enabled: isHumanPlayTurn && (used['shenfen'] ?? 0) < 1 && human.wrathMarks >= 4,
        hint: '消耗4枚暴怒标记：点【确定】令全体敌人掉1血并各弃2牌！',
      });
    }
    addBtn('yijue_mou', '义绝', 1, '选1牌并点1敌：本回合对其杀必中且伤害+1');
    addBtn('xieji_mou', '协击', 1, '选1牌点【确定】：摸2牌且杀无视防具');
    addBtn('huoji_mou', '火计', 1, '选1张红牌并点1敌：造成1点火焰伤害');
    addBtn('ronghuo_mou', '融火', 1, '选1张红牌并点1敌：造成火焰伤害（手牌多则2伤）');
    addBtn('qianxun_mou', '谦逊', 1, '选1张红牌并点1敌：造成1火伤并摸1牌');
    addBtn('lianhuan_mou', '连环', 1, '选1牌点【确定】：弃1摸2');
    addBtn('xuanhuo_mou', '眩惑', 1, '选1牌并点1队友：交给TA并令其摸2牌');
    addBtn('qingzheng_mou', '清正', 1, '选1牌并点1敌：令其弃1牌并受1伤');
    addBtn('quanmou_mou', '权谋', 0, '点击1名敌人再点【确定】：夺1牌或受1伤');
    addBtn('shensu_mou', '神速', 1, '选1牌并点任意敌方：无距离造成1点伤害');
    addBtn('luanwu_mou', '乱武', 0, '点【确定】发动：全体敌方受压制，低血敌受1伤');
    addBtn('quhu_mou', '驱虎', 1, '选1牌并点1敌：造成1点伤害');
    addBtn('fenwei_mou', '奋威', 1, '选1牌点【确定】：摸2牌且出杀+1');
    addBtn('dujiang_mou', '渡江', 2, '选2牌点【确定】：回复1血并摸1牌');
    addBtn('dimeng_mou', '缔盟', 1, '选1牌并点1目标：与其交换全部手牌！');
    addBtn('luanji_mou', human.hero.id === 'ji_yuanshao' ? '极·乱击' : '乱击', 2, '选2牌点【确定】：向全体敌方射出万箭齐发！');
    addBtn('jiuchi_mou', '酒池', 1, '选1黑牌点【确定】：进入酒状态并摸1牌');
    addBtn('leiji_mou', '雷击', 1, '选1张闪或黑桃并点1敌：造成2点雷电伤害！');
    addBtn('kuangfu_mou', '狂斧', 1, '选1牌并点1敌：造成1点伤害');
    if (hasSkill(human, 'zhenxian_zhi')) {
      const cnt = used['zhenxian_zhi'] ?? 0;
      btns.push({
        id: 'zhenxian_zhi',
        label: `镇舷 ${3 - cnt}/3`,
        enabled: isHumanPlayTurn && cnt < 3 && human.hand.some((c) => !human.recastRanksThisTurn.includes(c.rank)),
        hint: '选1张不同点数手牌点【确定】重铸；相邻点数额外顺敌1牌！',
      });
    }
    addBtn('hanzhi_zhi', '憾志', 1, '选1牌并点1队友：队友摸2牌且你回1血');
    addBtn('beizhi_zhi', '悖志', 1, '选1牌点【确定】：全体敌方弃牌/掉血并摸1牌');
    addBtn('fangquan_zhi', '放权', 1, '选1牌并点1队友：令队友摸3张牌！');
    addBtn('wengua_zhi', '问卦', 1, '选1牌点【确定】：弃1摸2');
    addBtn('tiaoxin_mou', '挑衅', 0, '点击1敌再点【确定】：夺1牌或受1伤');
    addBtn('jieyue_mou', '节钺', 1, '选1牌并点目标：队友摸2牌 / 敌方弃2牌');
    addBtn('qiaobian_mou', '巧变', 1, '选1牌并点1敌：夺1牌并摸1牌');
    addBtn('tianyi_mou', '天义', 1, '选1牌点【确定】：本回合出杀+2并摸1牌');
    addBtn('qingjian_mou', '清俭', 1, '选1牌并点1队友：交1牌并自己摸1牌');
    addBtn('mingce_mou', '明策', 1, '选1牌并点1队友：交1牌并令其摸2牌');
    addBtn('zaiqi_mou', '再起', 1, '选1红牌点【确定】：回1血并摸1牌', human.hp < human.maxHp);
    addBtn('lieren_mou', '烈刃', 1, '选1红牌并点1敌：造成1火伤并夺其1牌');
    // 神将 & T0传说主动技
    addBtn('jilue_shen', '极略', 1, '选1牌点【确定】：摸2牌且本回合杀伤害+1！');
    addBtn('kuangfeng_shen', '狂风', 1, '选1牌并点1敌：造成2点火焰伤害！');
    addBtn('yeyan_shen', '业炎', 2, '选2牌并点1敌：召唤业炎造成2点火焰伤害！');
    addBtn('poxi_shen', '魄袭', 0, '点击1敌点【确定】：弃其2手牌并摸1牌！');
    addBtn('cuike_shen', human.hero.id === 'jie_liru' ? '焚城' : '摧克', 1, '选1牌点【确定】：对全体敌方造成1点伤害！');
    addBtn('yingba_shen', '英霸', 0, '点击1敌点【确定】：削减其1点体力上限并摸1牌！');
    addBtn('huishi_shen', '慧识', 0, '点【确定】：摸2牌且+1体力上限（至多6）！');
    addBtn('qiangxi_shen', '强袭', 0, '点击1敌点【确定】：自损1血对敌造成2点伤害！');
    addBtn('huashen_jie', human.hero.id === 'nanhualaoxian' ? '御风' : '化身', 1, '选1牌点【确定】：摸2牌并天雷劈低血敌！');
    addBtn('shanjia_legend', '缮甲', 1, '选1牌点【确定】：摸2牌且出杀+1！');
    addBtn('chenglue_legend', '成略', 1, '选1牌点【确定】：摸2牌且出杀+2！');

    if (human.equip.weapon?.name === '丈八蛇矛') {
      btns.push({
        id: 'zhangba',
        label: '丈八蛇矛',
        enabled:
          isHumanPlayTurn &&
          human.hand.length >= 2 &&
          (hasUnlimitedSlash(human) || human.shaUsedThisTurn < getMaxSlashPerTurn(human, state.mode)),
        hint: '选择2张手牌并点击目标角色，再点【确定】当【杀】打出',
      });
    }
    return btns;
  }, [human, isHumanPlayTurn, state.mode]);

  const activeSkillHint = activeSkillButtons.find((b) => b.id === activeSkillMode)?.hint;

  // Dynamic official prompt text right above 确定 / 结束出牌
  const promptBannerText = useMemo(() => {
    if (inlinePrompt) return `${inlinePrompt.title}：${inlinePrompt.subtitle}`;
    if (!isHumanPlayTurn) {
      if (state.autoPlay) return '托管模式运行中，自动出牌中...';
      if (state.phase === 'play' && currentPlayer && !currentPlayer.isHuman) {
        return `${currentPlayer.name}（${currentPlayer.hero.name}）正在思考出牌...`;
      }
      return `${currentPlayer?.hero.name} · ${PHASE_LABEL[state.phase]}...`;
    }
    if (activeSkillHint) return `发动技能：${activeSkillHint}`;
    if (selectedSingleCard) {
      if (cardNeedsExplicitTarget(selectedSingleCard, convertSkillId ?? undefined)) {
        if (selectedTargetIds.length > 0) {
          const tName = state.players.find((p) => p.id === selectedTargetIds[0])?.hero.name ?? '';
          return `已锁定目标【${tName}】，点击【确定】打出【${selectedSingleCard.name}】`;
        }
        return `使用【${selectedSingleCard.name}】，请点击上方高亮目标角色`;
      }
      return `已选择【${selectedSingleCard.name}】，点击【确定】立即使用`;
    }
    return '出牌阶段，请选择手牌或点击手牌上方技能';
  }, [inlinePrompt, isHumanPlayTurn, state.autoPlay, currentPlayer, state.phase, activeSkillHint, selectedSingleCard, convertSkillId, selectedTargetIds, state.players]);

  const handLimit = getHandLimit(human);
  const hasSelection = selectedCardIds.length > 0 || !!activeSkillMode;

  const displayedHand = useMemo(() => {
    if (sortTrigger === 0) return human.hand;
    const typeOrder: Record<Card['type'], number> = {
      basic: 1,
      trick: 2,
      delay: 3,
      weapon: 4,
      armor: 5,
      horse_minus: 6,
      horse_plus: 7,
    };
    return [...human.hand].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.name.localeCompare(b.name));
  }, [human.hand, sortTrigger]);

  return (
    <div
      className={`battle-table-bg ${state.hitFlash?.targetId === human.id ? 'vfx-hit-shake' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Full-Screen Blood Vignette when Human Player Takes Damage! */}
      {state.hitFlash?.targetId === human.id && (
        <div
          key={state.hitFlash.id}
          className="vfx-screen-hurt"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow:
              state.hitFlash.element === 'fire'
                ? 'inset 0 0 85px 22px rgba(249, 115, 22, 0.8)'
                : state.hitFlash.element === 'thunder'
                  ? 'inset 0 0 85px 22px rgba(168, 85, 247, 0.8)'
                  : 'inset 0 0 85px 22px rgba(220, 38, 38, 0.8)',
          }}
        />
      )}
      {/* Epic Full-Bleed Hero Art Vignette Backdrop (Matches Douyin Screenshot 1!) */}
      <img
        src={human.hero.portrait}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 22%',
          opacity: 0.24,
          filter: 'blur(1px) saturate(1.15)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 38%, rgba(28, 22, 16, 0.35) 0%, rgba(16, 14, 14, 0.88) 78%, rgba(10, 10, 12, 0.96) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Subtle Official Bronze Dragon Medallion Background */}
      <svg
        viewBox="0 0 600 600"
        style={{
          position: 'absolute',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          width: 560,
          height: 560,
          opacity: 0.13,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <circle cx="300" cy="300" r="275" fill="none" stroke="#d4a76a" strokeWidth="2" />
        <circle cx="300" cy="300" r="248" fill="none" stroke="#d4a76a" strokeWidth="6" strokeDasharray="16 10" />
        <circle cx="300" cy="300" r="188" fill="none" stroke="#d4a76a" strokeWidth="2" />
        <circle cx="300" cy="300" r="110" fill="none" stroke="#d4a76a" strokeWidth="1.5" strokeDasharray="6 6" />
      </svg>

      {/* Top Slim Mobile Header (Single-line compact!) */}
      <header
        style={{
          height: 38,
          padding: '0 8px',
          background: 'linear-gradient(180deg, rgba(18, 14, 12, 0.96), rgba(28, 22, 18, 0.9))',
          borderBottom: '1px solid rgba(212, 167, 106, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, minWidth: 0 }}>
          <span className="font-serif-cn" style={{ fontWeight: 900, color: '#f6d598', whiteSpace: 'nowrap' }}>
            第{state.turnNumber}轮
          </span>
          <span style={{ color: '#fde68a', whiteSpace: 'nowrap' }}>🎴{state.deck.length}</span>
          <span
            style={{
              color: '#cbd5e1',
              fontSize: 10,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {state.mode === '2v2' ? '2v2排位' : state.mode === 'landlord' ? '斗地主' : '5人身份'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            className={state.autoPlay ? 'gold-btn' : 'ghost-btn'}
            onClick={() => controller.setAutoPlay(!state.autoPlay)}
            style={topToolBtnStyle}
          >
            <Bot size={12} /> {state.autoPlay ? '托' : '托管'}
          </button>
          <button
            type="button"
            className={state.speedMultiplier === 2 ? 'gold-btn' : 'ghost-btn'}
            onClick={() => controller.setSpeed(state.speedMultiplier === 1 ? 2 : 1)}
            style={topToolBtnStyle}
          >
            <FastForward size={12} /> {state.speedMultiplier}x
          </button>
          <button
            type="button"
            className={showLogs ? 'gold-btn' : 'ghost-btn'}
            onClick={() => setShowLogs((v) => !v)}
            style={topToolBtnStyle}
          >
            <ScrollText size={12} />
          </button>
          <button type="button" className="ghost-btn" onClick={onToggleSfx} style={topToolBtnStyle}>
            {sfxEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>
          <button type="button" className="ghost-btn" onClick={onToggleVoice} style={topToolBtnStyle}>
            {voiceEnabled ? <Mic size={12} /> : <MicOff size={12} />}
          </button>
          <button type="button" className="crimson-btn" onClick={onBackLobby} style={topToolBtnStyle}>
            <LogOut size={12} />
          </button>
        </div>
      </header>

      {/* Upper & Center Battlefield */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8px 6px 4px',
          position: 'relative',
          minHeight: 0,
          zIndex: 5,
        }}
      >
        {/* Top Row: Compact Vertical Hero Cards for Mobile Portrait */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: others.length >= 4 ? 5 : 8,
            alignItems: 'flex-start',
            zIndex: 10,
          }}
        >
          {others.map((p) => {
            const isCurrent = currentPlayer?.id === p.id;
            const isTargetable = validTargetIdSet.has(p.id);
            const isSelectedTarget = selectedTargetIds.includes(p.id);
            const dist = getDistance(state.players, human, p);
            const teamLabel = getSeatTeamLabel(p, state.mode);
            const effects = state.floatingEffects.filter((e) => e.targetId === p.id);
            const enemy = isEnemy(human, p, state.mode);
            const isBannerHere = state.activeBanner?.heroName === p.hero.name;
            const isHitHere = state.hitFlash?.targetId === p.id;
            const isSlashedHere =
              state.activeVfx?.targetId === p.id &&
              (state.activeVfx.kind === 'slash' ||
                state.activeVfx.kind === 'fire_slash' ||
                state.activeVfx.kind === 'thunder_slash');

            return (
              <div
                key={p.id}
                className={isHitHere ? 'vfx-hit-shake' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: others.length >= 4 ? 92 : 118,
                  position: 'relative',
                }}
              >
                {/* Floating Damage / Heal */}
                {effects.map((ef) => (
                  <div
                    key={ef.id}
                    className="animate-float-up font-serif-cn"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 32,
                      zIndex: 45,
                      pointerEvents: 'none',
                      fontSize: ef.kind === 'damage' ? 28 : 17,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      textShadow: '0 2px 10px #000',
                      color:
                        ef.kind === 'damage'
                          ? '#ef4444'
                          : ef.kind === 'heal'
                            ? '#4ade80'
                            : ef.kind === 'dodge'
                              ? '#38bdf8'
                              : ef.kind === 'wuxie'
                                ? '#e879f9'
                                : '#fde047',
                    }}
                  >
                    {ef.text}
                  </div>
                ))}

                {/* Official Vertical Hero Card */}
                <div
                  onClick={() => handleSeatClick(p)}
                  className={isTargetable ? 'target-highlight' : ''}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: others.length >= 4 ? 122 : 148,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: isSelectedTarget
                      ? '3px solid #fb923c'
                      : isCurrent
                        ? '2.5px solid #fde047'
                        : '1.5px solid rgba(229, 185, 99, 0.55)',
                    boxShadow: isSelectedTarget
                      ? '0 0 22px rgba(249, 115, 22, 0.85)'
                      : isCurrent
                        ? '0 0 18px rgba(250, 204, 21, 0.6)'
                        : '0 6px 14px rgba(0, 0, 0, 0.65)',
                    transform: isSelectedTarget ? 'scale(1.03)' : 'none',
                    transition: 'transform 0.14s ease, box-shadow 0.14s ease',
                    cursor: isTargetable ? 'pointer' : 'default',
                  }}
                >
                  <HeroArt hero={p.hero} size="sm" dead={!p.alive} currentHp={p.hp} />

                  {/* Top-Right Circular Role/Team Badge (Official Style!) */}
                  <div
                    className="font-serif-cn"
                    title={`${p.seatIndex + 1}号位 · ${teamLabel.text}`}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      padding: '2px 6px',
                      borderRadius: 99,
                      background: teamLabel.bg,
                      border: '1.5px solid #fde68a',
                      color: '#fffbeb',
                      fontSize: 10,
                      fontWeight: 900,
                      zIndex: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.75)',
                    }}
                  >
                    {p.seatIndex + 1}位·{state.mode === '2v2' ? (enemy ? '敌' : '友') : teamLabel.text.slice(0, 1)}
                  </div>

                  {/* Bottom-Left Hand Count Box (Official Style!) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      minWidth: 22,
                      height: 22,
                      padding: '0 5px',
                      borderRadius: 4,
                      background: 'rgba(18, 13, 10, 0.88)',
                      border: '1px solid #d4a76a',
                      color: '#fde68a',
                      fontSize: 12,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 6,
                    }}
                    title={`手牌 ${p.hand.length} 张`}
                  >
                    {p.hand.length}
                  </div>

                  {/* Distance Pill Top Center */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 30,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'rgba(18, 13, 10, 0.78)',
                      color: '#e5d5bc',
                      fontSize: 10,
                      fontWeight: 700,
                      zIndex: 6,
                    }}
                  >
                    距{dist}
                  </div>

                  {/* Crossed Swords Lock-On Icon (Official step_47 style!) */}
                  {isSelectedTarget && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(185, 28, 28, 0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 8,
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 48,
                          filter: 'drop-shadow(0 0 12px rgba(254, 240, 138, 0.95))',
                        }}
                      >
                        ⚔️
                      </span>
                    </div>
                  )}

                  {/* Direct On-Card Slash Cut VFX! */}
                  {isSlashedHere && state.activeVfx && (
                    <div
                      key={state.activeVfx.id}
                      className="vfx-card-slash"
                      style={{
                        position: 'absolute',
                        inset: -12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '140%',
                          height: 14,
                          borderRadius: 99,
                          background:
                            state.activeVfx.kind === 'fire_slash'
                              ? 'linear-gradient(90deg, transparent, #f97316, #fef08a, #dc2626, transparent)'
                              : state.activeVfx.kind === 'thunder_slash'
                                ? 'linear-gradient(90deg, transparent, #818cf8, #f5f3ff, #a855f7, transparent)'
                                : 'linear-gradient(90deg, transparent, #ef4444, #fff, #dc2626, transparent)',
                          boxShadow: '0 0 26px rgba(239, 68, 68, 0.95)',
                        }}
                      />
                    </div>
                  )}

                  {/* Direct On-Card Damage / Hurt Burst VFX! */}
                  {isHitHere && state.hitFlash && (
                    <div
                      key={state.hitFlash.id}
                      className="vfx-damage-burst"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          state.hitFlash.element === 'fire'
                            ? 'radial-gradient(circle, rgba(249,115,22,0.78), rgba(185,28,28,0.55) 65%, transparent)'
                            : state.hitFlash.element === 'thunder'
                              ? 'radial-gradient(circle, rgba(168,85,247,0.82), rgba(59,7,100,0.55) 65%, transparent)'
                              : 'radial-gradient(circle, rgba(239,68,68,0.78), rgba(127,29,29,0.5) 65%, transparent)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 11,
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ fontSize: 30 }}>
                        {state.hitFlash.element === 'fire' ? '🔥' : state.hitFlash.element === 'thunder' ? '⚡' : '💥'}
                      </span>
                      <span
                        className="font-serif-cn"
                        style={{
                          fontSize: 34,
                          fontWeight: 900,
                          color: '#fffbeb',
                          textShadow: '0 0 14px #dc2626, 0 3px 8px #000',
                          lineHeight: 1,
                        }}
                      >
                        -{state.hitFlash.amount}
                      </span>
                    </div>
                  )}

                  {/* On-Card Skill Activation Flash (Official step_49 style!) */}
                  {isBannerHere && state.activeBanner && (
                    <div
                      key={state.activeBanner.id}
                      className="animate-skill-slash"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(135deg, transparent 20%, rgba(253, 224, 71, 0.42) 50%, transparent 80%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9,
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        className="font-serif-cn"
                        style={{
                          fontSize: 28,
                          fontWeight: 900,
                          color: '#fffbeb',
                          textShadow: '0 0 14px #f59e0b, 0 2px 8px #000',
                          letterSpacing: 2,
                        }}
                      >
                        {state.activeBanner.skillName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Compact Equipment / Judge / Mark Badges under Opponent Card */}
                <div
                  style={{
                    marginTop: 4,
                    width: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 3,
                    fontSize: 10,
                  }}
                >
                  {p.equip.weapon && <span style={miniEquipPill('#fca5a5')}>⚔{p.equip.weapon.name}</span>}
                  {p.equip.armor && <span style={miniEquipPill('#6ee7b7')}>🛡{p.equip.armor.name}</span>}
                  {p.equip.horsePlus && <span style={miniEquipPill('#93c5fd')}>+1{p.equip.horsePlus.name}</span>}
                  {p.equip.horseMinus && <span style={miniEquipPill('#fdba74')}>-1{p.equip.horseMinus.name}</span>}
                  {p.judge.map((jc) => (
                    <span key={jc.id} style={miniEquipPill('#f5d0fe', '#581c87')}>
                      {jc.name}
                    </span>
                  ))}
                  {hasSkill(p, 'mou_liegong') && p.liegongSuits.length > 0 && (
                    <span style={miniEquipPill('#fde047', 'rgba(146,64,14,0.85)')}>
                      烈弓:{p.liegongSuits.map(suitSymbol).join('')}
                    </span>
                  )}
                  {p.hero.id === 'shen_lvbu' && (
                    <span style={miniEquipPill('#f472b6', 'rgba(88,28,135,0.85)')}>暴怒:{p.wrathMarks}</span>
                  )}
                </div>

                {/* Official Skill Subtitle Strip under Card */}
                {isBannerHere && state.activeBanner && (
                  <div
                    style={{
                      marginTop: 3,
                      padding: '2px 10px',
                      borderRadius: 4,
                      background: 'rgba(20, 14, 10, 0.85)',
                      border: '1px solid rgba(244, 202, 131, 0.5)',
                      color: '#fde68a',
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.hero.name}发动了技能【{state.activeBanner.skillName}】
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Center Open Play / Discard Pile */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: 115,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            {state.tableCards.map((tc) => (
              <div key={tc.id} className="animate-card-pop">
                <PlayingCard
                  card={tc.card}
                  compact
                  badge={
                    tc.label
                      ? `${tc.fromName}·${tc.label}`
                      : tc.toName && tc.toName !== tc.fromName
                        ? `${tc.fromName}→${tc.toName}`
                        : tc.fromName
                  }
                />
              </div>
            ))}
          </div>

          {/* Center Combat Card VFX Overlay (Slash Beam / Fire / Thunder / Shield Ring / Heal / Trick Scroll!) */}
          {state.activeVfx && (
            <div
              key={state.activeVfx.id}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 42,
                overflow: 'hidden',
              }}
            >
              {(state.activeVfx.kind === 'slash' ||
                state.activeVfx.kind === 'fire_slash' ||
                state.activeVfx.kind === 'thunder_slash') && (
                <>
                  <div
                    className="vfx-slash-beam"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '44%',
                      width: 520,
                      height: 18,
                      borderRadius: 99,
                      background:
                        state.activeVfx.kind === 'fire_slash'
                          ? 'linear-gradient(90deg, transparent, #f97316, #fef08a, #dc2626, transparent)'
                          : state.activeVfx.kind === 'thunder_slash'
                            ? 'linear-gradient(90deg, transparent, #818cf8, #e0e7ff, #a855f7, transparent)'
                            : 'linear-gradient(90deg, transparent, #ef4444, #fffbeb, #dc2626, transparent)',
                      boxShadow:
                        state.activeVfx.kind === 'fire_slash'
                          ? '0 0 38px #f97316, 0 0 70px #dc2626'
                          : state.activeVfx.kind === 'thunder_slash'
                            ? '0 0 38px #818cf8, 0 0 70px #a855f7'
                            : '0 0 36px #ef4444, 0 0 60px #fbbf24',
                    }}
                  />
                  <div
                    className="vfx-trick-scroll font-serif-cn"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '44%',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 44,
                        fontWeight: 900,
                        letterSpacing: 6,
                        color:
                          state.activeVfx.kind === 'fire_slash'
                            ? '#fed7aa'
                            : state.activeVfx.kind === 'thunder_slash'
                              ? '#e9d5ff'
                              : '#fef08a',
                        textShadow: '0 0 24px rgba(220, 38, 38, 0.95), 0 4px 12px #000',
                      }}
                    >
                      {state.activeVfx.label}
                    </div>
                    {state.activeVfx.sublabel && (
                      <div style={{ fontSize: 13, color: '#fffbeb', textShadow: '0 2px 6px #000', fontWeight: 700 }}>
                        {state.activeVfx.sublabel}
                      </div>
                    )}
                  </div>
                </>
              )}

              {(state.activeVfx.kind === 'dodge' || state.activeVfx.kind === 'heal' || state.activeVfx.kind === 'jiu') && (
                <div
                  className="vfx-ring-burst font-serif-cn"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '44%',
                    width: 190,
                    height: 190,
                    borderRadius: '50%',
                    border:
                      state.activeVfx.kind === 'dodge'
                        ? '5px solid #38bdf8'
                        : state.activeVfx.kind === 'heal'
                          ? '5px solid #4ade80'
                          : '5px solid #f59e0b',
                    background:
                      state.activeVfx.kind === 'dodge'
                        ? 'radial-gradient(circle, rgba(56,189,248,0.28), transparent 70%)'
                        : state.activeVfx.kind === 'heal'
                          ? 'radial-gradient(circle, rgba(74,222,128,0.3), transparent 70%)'
                          : 'radial-gradient(circle, rgba(245,158,11,0.32), transparent 70%)',
                    boxShadow:
                      state.activeVfx.kind === 'dodge'
                        ? '0 0 40px rgba(56,189,248,0.7)'
                        : state.activeVfx.kind === 'heal'
                          ? '0 0 40px rgba(74,222,128,0.7)'
                          : '0 0 40px rgba(245,158,11,0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 30, fontWeight: 900, color: '#fffbeb', textShadow: '0 2px 10px #000' }}>
                    {state.activeVfx.label}
                  </span>
                  {state.activeVfx.sublabel && (
                    <span style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>{state.activeVfx.sublabel}</span>
                  )}
                </div>
              )}

              {(state.activeVfx.kind === 'trick' || state.activeVfx.kind === 'aoe') && (
                <div
                  className="vfx-trick-scroll"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '43%',
                    minWidth: 360,
                    padding: '14px 48px',
                    borderRadius: 12,
                    textAlign: 'center',
                    background:
                      state.activeVfx.kind === 'aoe'
                        ? 'linear-gradient(90deg, transparent, rgba(153, 27, 27, 0.92) 20%, rgba(30, 14, 14, 0.96) 50%, rgba(153, 27, 27, 0.92) 80%, transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(29, 78, 216, 0.88) 20%, rgba(15, 23, 42, 0.96) 50%, rgba(29, 78, 216, 0.88) 80%, transparent)',
                    borderTop: '2px solid #fde68a',
                    borderBottom: '2px solid #fde68a',
                    boxShadow: '0 0 45px rgba(0,0,0,0.8)',
                  }}
                >
                  <div
                    className="font-serif-cn"
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      letterSpacing: 8,
                      color: '#fef3c7',
                      textShadow: '0 0 18px rgba(251, 191, 36, 0.85), 0 3px 10px #000',
                    }}
                  >
                    {state.activeVfx.label}
                  </div>
                  {state.activeVfx.sublabel && (
                    <div style={{ fontSize: 12, color: '#fde68a', marginTop: 3, letterSpacing: 1 }}>
                      {state.activeVfx.sublabel}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Center Skill Banner when Human triggers a skill */}
          {state.activeBanner && state.activeBanner.heroName === human.hero.name && (
            <div
              key={state.activeBanner.id}
              className="animate-skill-banner"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                zIndex: 45,
                pointerEvents: 'none',
                padding: '10px 36px',
                borderRadius: 12,
                background: 'linear-gradient(90deg, transparent, rgba(146, 64, 14, 0.92) 22%, rgba(28, 18, 10, 0.96) 50%, rgba(146, 64, 14, 0.92) 78%, transparent)',
                borderTop: '2px solid #fde68a',
                borderBottom: '2px solid #fde68a',
                textAlign: 'center',
                minWidth: 300,
              }}
            >
              <div className="font-serif-cn" style={{ fontSize: 30, fontWeight: 900, color: '#fffbeb', letterSpacing: 6 }}>
                {state.activeBanner.skillName}
              </div>
              <div style={{ fontSize: 12, color: '#fde68a', marginTop: 2 }}>
                {human.hero.name}发动了技能【{state.activeBanner.skillName}】
              </div>
            </div>
          )}
        </div>

        {/* Official Phase Prompt + Progress Line + Dual Pill Action Bar (确定 / 回合结束 or 取消) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            paddingBottom: 6,
            zIndex: 25,
          }}
        >
          {/* Prompt text & phase badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '96%' }}>
            <span
              style={{
                padding: '2px 9px',
                borderRadius: 4,
                background: inlinePrompt
                  ? 'linear-gradient(90deg, #b45309, #d97706)'
                  : isHumanPlayTurn
                    ? 'linear-gradient(90deg, #15803d, #16a34a)'
                    : 'rgba(51, 65, 85, 0.85)',
                color: '#fffbeb',
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
              }}
            >
              {inlinePrompt ? '等待响应' : PHASE_LABEL[state.phase]}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#f7dfba',
                textShadow: '0 1px 4px #000',
              }}
            >
              {promptBannerText}
            </span>
          </div>

          {/* Slim Golden Progress Line */}
          <div
            style={{
              width: 380,
              maxWidth: '82vw',
              height: 3,
              borderRadius: 99,
              background: 'rgba(20, 14, 10, 0.7)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: isHumanPlayTurn || inlinePrompt ? '100%' : '35%',
                height: '100%',
                background: 'linear-gradient(90deg, #9a6b24, #fde68a, #d97706)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Conversion toggles (when selecting a convertible card like 武圣/奇袭/国色/断粮/狩敌/龙魂) */}
          {convertibleSkills.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={!convertSkillId ? 'pill-action-gold' : 'ghost-btn'}
                onClick={() => setConvertSkillId(null)}
                style={{ padding: '3px 12px', borderRadius: 99, fontSize: 11 }}
              >
                原牌使用
              </button>
              {convertibleSkills.map((cv) => (
                <button
                  key={cv.skillId}
                  type="button"
                  className={convertSkillId === cv.skillId ? 'pill-action-gold' : 'ghost-btn'}
                  onClick={() => setConvertSkillId(cv.skillId)}
                  style={{ padding: '3px 12px', borderRadius: 99, fontSize: 11 }}
                >
                  {cv.label}
                </button>
              ))}
            </div>
          )}

          {/* Official Mobile Dual Buttons: 牌序 | 确定 | 结束出牌(取消) | 手气卡 */}
          {(isHumanPlayTurn || inlinePrompt) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '0 6px' }}>
              <button
                type="button"
                className="ghost-btn font-serif-cn"
                onClick={() => setSortTrigger((v) => v + 1)}
                title="一键整理手牌顺序"
                style={{
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#fde68a',
                  flexShrink: 0,
                }}
              >
                ⇅牌序
              </button>

              <button
                type="button"
                className="pill-action-gold font-serif-cn"
                disabled={!canConfirmAction()}
                onClick={handleConfirm}
                style={{ width: 102, height: 34, borderRadius: 6, fontSize: 15, letterSpacing: 3 }}
              >
                确定
              </button>

              {(!inlinePrompt || inlinePrompt.canSkip) && (
                <button
                  type="button"
                  onClick={handleSecondaryBtn}
                  className="font-serif-cn"
                  style={{
                    width: 102,
                    height: 34,
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 1,
                    cursor: 'pointer',
                    background: 'linear-gradient(180deg, #33465d 0%, #1e2c3d 100%)',
                    border: '1.5px solid #6b88a8',
                    color: '#e2ecf7',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
                  }}
                >
                  {inlinePrompt ? '取消' : hasSelection ? '取消' : '结束出牌'}
                </button>
              )}

              {isHumanPlayTurn && state.turnNumber === 1 && state.luckyCardLeft > 0 && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => controller.useLuckyCard()}
                  style={{
                    height: 32,
                    padding: '0 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fde047',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={11} /> 气({state.luckyCardLeft})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Mobile Portrait Player Dock (1:1 Mirror of Screenshot 1!) */}
      <footer
        style={{
          background: 'linear-gradient(180deg, rgba(20, 22, 26, 0.94) 0%, rgba(12, 13, 16, 0.99) 100%)',
          borderTop: '1.5px solid rgba(212, 167, 106, 0.42)',
          padding: '6px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        {/* Top Sub-Row: Compact Equip Strip (Left) + Horizontal Skill Buttons (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 26 }}>
          {/* Compact Equip & Hand/Limit Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 10 }}>
            <span style={miniEquipPill(human.hand.length > handLimit ? '#f87171' : '#fde68a')}>
              手牌{human.hand.length}/{handLimit}
            </span>
            {human.equip.weapon && <span style={miniEquipPill('#fca5a5')}>⚔{human.equip.weapon.name}</span>}
            {human.equip.armor && <span style={miniEquipPill('#6ee7b7')}>🛡{human.equip.armor.name}</span>}
            {human.equip.horseMinus && <span style={miniEquipPill('#fdba74')}>-1{human.equip.horseMinus.name}</span>}
            {human.equip.horsePlus && <span style={miniEquipPill('#93c5fd')}>+1{human.equip.horsePlus.name}</span>}
            {hasSkill(human, 'mou_liegong') && (
              <span style={miniEquipPill('#fde047', 'rgba(146,64,14,0.85)')}>
                烈弓:{human.liegongSuits.length > 0 ? human.liegongSuits.map(suitSymbol).join('') : '0/4'}
              </span>
            )}
            {human.judge.map((jc) => (
              <span key={jc.id} style={miniEquipPill('#f5d0fe', '#581c87')}>
                {jc.name}
              </span>
            ))}
          </div>

          {/* Horizontal Skill Buttons Right Above Hand */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
            {activeSkillButtons.map((btn) => {
              const active = activeSkillMode === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  disabled={!btn.enabled}
                  onClick={() => {
                    setSelectedCardIds([]);
                    setSelectedTargetIds([]);
                    setConvertSkillId(null);
                    setActiveSkillMode((prev) => (prev === btn.id ? null : btn.id));
                  }}
                  title={btn.hint}
                  className="font-serif-cn"
                  style={{
                    padding: '2px 10px',
                    borderRadius: 5,
                    border: active
                      ? '1.5px solid #fef08a'
                      : btn.enabled
                        ? '1.5px solid #cbd5e1'
                        : '1px solid rgba(148,163,184,0.28)',
                    background: active
                      ? 'linear-gradient(180deg, #d97706, #92400e)'
                      : btn.enabled
                        ? 'linear-gradient(180deg, #7c8594, #4b5563)'
                        : 'rgba(30, 34, 42, 0.72)',
                    color: btn.enabled ? '#fffbeb' : '#64748b',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: btn.enabled ? 'pointer' : 'not-allowed',
                    boxShadow: active ? '0 0 10px rgba(250, 204, 21, 0.8)' : '0 2px 5px rgba(0,0,0,0.45)',
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
            {activeSkillButtons.length === 0 &&
              human.hero.skills.slice(0, 2).map((sk) => (
                <span
                  key={sk.id}
                  title={sk.description}
                  className="font-serif-cn"
                  style={{
                    padding: '2px 8px',
                    borderRadius: 5,
                    background: 'rgba(35, 40, 48, 0.85)',
                    border: '1px solid rgba(203, 213, 225, 0.35)',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {sk.name}
                </span>
              ))}
          </div>
        </div>

        {/* Main Bottom Row: [Overlapping Hand Cards] + [104px Neon-Green Vertical Player Hero Card] */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 104px', gap: 8, alignItems: 'end', height: 138 }}>
          {/* Hand Cards Row */}
          {(() => {
            const overlapPx =
              displayedHand.length <= 3
                ? 0
                : displayedHand.length === 4
                  ? 18
                  : displayedHand.length === 5
                    ? 32
                    : 38;
            return (
              <div
                style={{
                  minWidth: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  gap: displayedHand.length > 3 ? 0 : 4,
                  overflowX: displayedHand.length > 5 ? 'auto' : 'visible',
                  overflowY: 'visible',
                  padding: '16px 4px 2px 4px',
                }}
              >
                {displayedHand.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#8c7a64', fontSize: 12 }}>当前无手牌</div>
                ) : (
                  displayedHand.map((card, idx) => {
                    const selectable = isCardSelectable(card);
                    const selected = selectedCardIds.includes(card.id);
                    return (
                      <PlayingCard
                        key={card.id}
                        card={card}
                        compact
                        selected={selected}
                        disabled={!selectable}
                        overlap={overlapPx > 0 && idx > 0 ? overlapPx : false}
                        onClick={() => handleCardClick(card)}
                      />
                    );
                  })
                )}
              </div>
            );
          })()}

          {/* Right: 104x136 Player Hero Card */}
          <div style={{ position: 'relative', width: 104, height: 136 }}>
            {state.floatingEffects
              .filter((e) => e.targetId === human.id)
              .map((ef) => (
                <div
                  key={ef.id}
                  className="animate-float-up font-serif-cn"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -12,
                    zIndex: 45,
                    fontSize: 20,
                    fontWeight: 900,
                    color: ef.kind === 'damage' ? '#ef4444' : ef.kind === 'heal' ? '#4ade80' : '#fde047',
                    textShadow: '0 2px 8px #000',
                    pointerEvents: 'none',
                  }}
                >
                  {ef.text}
                </div>
              ))}

            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                overflow: 'hidden',
                border: currentPlayer?.id === human.id ? '2.5px solid #4ade80' : '1.5px solid rgba(229,185,99,0.55)',
                boxShadow:
                  currentPlayer?.id === human.id
                    ? '0 0 20px rgba(34, 197, 94, 0.88), 0 0 5px rgba(74, 222, 128, 0.95)'
                    : '0 4px 12px rgba(0,0,0,0.65)',
              }}
            >
              <HeroArt hero={human.hero} size="sm" dead={!human.alive} currentHp={human.hp} />

              <div
                className="font-serif-cn"
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  padding: '1px 5px',
                  borderRadius: 99,
                  background: getSeatTeamLabel(human, state.mode).bg,
                  border: '1px solid #fde68a',
                  color: '#fffbeb',
                  fontSize: 9,
                  fontWeight: 900,
                  zIndex: 6,
                }}
              >
                {human.seatIndex + 1}位·{state.mode === '2v2' ? '暖' : getSeatTeamLabel(human, state.mode).text.slice(0, 1)}
              </div>

              {state.hitFlash?.targetId === human.id && (
                <div
                  key={state.hitFlash.id}
                  className="vfx-damage-burst"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      state.hitFlash.element === 'fire'
                        ? 'radial-gradient(circle, rgba(249,115,22,0.8), rgba(185,28,28,0.5) 68%, transparent)'
                        : state.hitFlash.element === 'thunder'
                          ? 'radial-gradient(circle, rgba(168,85,247,0.82), rgba(59,7,100,0.5) 68%, transparent)'
                          : 'radial-gradient(circle, rgba(239,68,68,0.82), rgba(127,29,29,0.55) 68%, transparent)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 11,
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: 22 }}>
                    {state.hitFlash.element === 'fire' ? '🔥' : state.hitFlash.element === 'thunder' ? '⚡' : '💥'}
                  </span>
                  <span className="font-serif-cn" style={{ fontSize: 26, fontWeight: 900, color: '#fffbeb', textShadow: '0 0 12px #dc2626' }}>
                    -{state.hitFlash.amount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Collapsible Battle Log Drawer */}
      {showLogs && (
        <div
          className="gold-panel"
          style={{
            position: 'absolute',
            top: 42,
            right: 8,
            left: 8,
            height: '52%',
            borderRadius: 12,
            zIndex: 35,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid rgba(229,185,99,0.22)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              fontWeight: 800,
              color: '#fde68a',
            }}
          >
            <span>实时战报日志</span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowLogs(false)}
              style={{ padding: '2px 6px', borderRadius: 5, fontSize: 11 }}
            >
              关闭
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {state.logs.map((l) => (
              <div
                key={l.id}
                style={{
                  lineHeight: 1.45,
                  color:
                    l.kind === 'damage'
                      ? '#fca5a5'
                      : l.kind === 'heal'
                        ? '#86efac'
                        : l.kind === 'skill'
                          ? '#fde68a'
                          : l.kind === 'death'
                            ? '#f87171'
                            : l.kind === 'phase'
                              ? '#93c5fd'
                              : l.kind === 'system'
                                ? '#c4b5fd'
                                : '#cbd5e1',
                }}
              >
                {l.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Modal Prompts */}
      {modalPrompt && (
        <PromptModal state={state} prompt={modalPrompt} onSubmit={(res) => controller.submitPrompt(res)} />
      )}

      {/* Victory Settlement */}
      {state.winner && (
        <VictoryModal state={state} rank={rank} onPlayAgain={onPlayAgain} onBackLobby={onBackLobby} />
      )}
    </div>
  );
};

const topToolBtnStyle: React.CSSProperties = {
  padding: '3px 9px',
  borderRadius: 6,
  fontSize: 11,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

function equipSlotStyle(filled: boolean, accent: string): React.CSSProperties {
  return {
    height: 24,
    padding: '0 8px',
    borderRadius: 4,
    background: filled ? 'rgba(66, 46, 28, 0.92)' : 'rgba(28, 22, 17, 0.76)',
    border: filled ? `1px solid ${accent}88` : '1px solid rgba(180, 145, 95, 0.25)',
    color: filled ? accent : '#7c6b57',
    fontSize: 11,
    fontWeight: filled ? 800 : 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
}

function miniEquipPill(color: string, bg = 'rgba(24, 18, 14, 0.85)'): React.CSSProperties {
  return {
    padding: '1px 5px',
    borderRadius: 4,
    background: bg,
    border: `1px solid ${color}55`,
    color,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
}
