import {
  Card,
  CardName,
  CombatVfx,
  FloatingEffect,
  GameMode,
  GameState,
  HeroDef,
  Identity,
  LogEntry,
  PendingPrompt,
  Player,
  PromptResult,
  Suit,
  Team,
} from '../types/game';
import { createDeck, isBlackSuit, isRedSuit, rankLabel, shuffle, suitSymbol } from '../data/deck';
import {
  canActAsPeach,
  canActAsShan,
  canActAsSlash,
  canActAsWuxie,
  canTargetWithSlash,
  getAttackRange,
  getDistance,
  getHandLimit,
  getMaxSlashPerTurn,
  getValidTargetsForCard,
  hasAnyCard,
  hasSkill,
  hasUnlimitedSlash,
  isAlly,
  isEnemy,
  isSlashCard,
} from './rules';
import { sound } from '../utils/sound';

type Listener = (state: GameState) => void;

export interface MatchConfig {
  mode: GameMode;
  humanHero: HeroDef;
  otherHeroes: HeroDef[]; // 3 for 2v2, 2 for landlord, 4 for identity5
  humanName?: string;
}

const AI_NAMES = ['夜雨听风', '青梅煮酒', '长安陌客', '南山小酌', '江东少主', '半盏清茶', '月落乌啼', '风起洛阳'];

export class GameController {
  private state: GameState;
  private listeners = new Set<Listener>();
  private aborted = false;
  private playActionBusy = false;
  private playPhaseDoneResolver: (() => void) | null = null;
  private idCounter = 1;

  constructor(config: MatchConfig) {
    this.state = this.createInitialState(config);
  }

  private uid(prefix: string): string {
    return `${prefix}_${this.idCounter++}_${Date.now().toString(36)}`;
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.cloneState());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    if (this.aborted) return;
    const snap = this.cloneState();
    this.listeners.forEach((fn) => fn(snap));
  }

  private cloneState(): GameState {
    return {
      ...this.state,
      players: this.state.players.map((p) => ({
        ...p,
        hand: [...p.hand],
        equip: { ...p.equip },
        judge: [...p.judge],
        skillsUsedThisTurn: { ...p.skillsUsedThisTurn },
      })),
      tableCards: [...this.state.tableCards],
      logs: [...this.state.logs],
      floatingEffects: [...this.state.floatingEffects],
    };
  }

  public getState(): GameState {
    return this.cloneState();
  }

  public destroy() {
    this.aborted = true;
    if (this.state.pendingPrompt) {
      this.state.pendingPrompt.resolve({ confirmed: false });
      this.state.pendingPrompt = null;
    }
    if (this.playPhaseDoneResolver) {
      this.playPhaseDoneResolver();
      this.playPhaseDoneResolver = null;
    }
    this.listeners.clear();
  }

  public setAutoPlay(auto: boolean) {
    this.state.autoPlay = auto;
    this.emit();
    if (auto && !this.playActionBusy && this.playPhaseDoneResolver) {
      const current = this.state.players[this.state.currentSeat];
      if (current?.isHuman && this.state.phase === 'play') {
        this.runAutoPlayForHuman();
      }
    }
  }

  public setSpeed(mult: 1 | 2) {
    this.state.speedMultiplier = mult;
    this.emit();
  }

  private sleep(ms: number): Promise<void> {
    // Relaxed 1x pacing so every card play, VFX, and skill reads naturally without rushing
    const actual = Math.max(220, Math.round((ms * 2.55) / this.state.speedMultiplier));
    return new Promise((resolve) => setTimeout(resolve, actual));
  }

  private async humanPause(minMs: number, maxMs: number): Promise<void> {
    const raw = minMs + Math.random() * Math.max(0, maxMs - minMs);
    const actual = Math.max(250, Math.round(raw / this.state.speedMultiplier));
    return new Promise((resolve) => setTimeout(resolve, actual));
  }

  private createInitialState(config: MatchConfig): GameState {
    const deck = createDeck();
    const players: Player[] = [];
    const names = shuffle(AI_NAMES);

    const makePlayer = (
      seatIndex: number,
      isHuman: boolean,
      hero: HeroDef,
      team: Team,
      identity: Identity,
      identityRevealed: boolean,
      bonusHp = 0
    ): Player => {
      const maxHp = hero.maxHp + bonusHp;
      return {
        id: `p_${seatIndex}`,
        seatIndex,
        name: isHuman ? config.humanName || '主公（你）' : `${names[seatIndex % names.length]}`,
        isHuman,
        hero,
        hp: maxHp,
        maxHp,
        team,
        identity,
        identityRevealed,
        alive: true,
        hand: [],
        equip: { weapon: null, armor: null, horsePlus: null, horseMinus: null },
        judge: [],
        shaUsedThisTurn: 0,
        jiuUsedThisTurn: 0,
        jiuActive: false,
        skillsUsedThisTurn: {},
        rendeGivenThisTurn: 0,
        rendeHealedThisTurn: false,
        luoyiActive: false,
        kurouBonusSha: 0,
        kurouRedUnblockable: false,
        wrathMarks: hero.id === 'shen_lvbu' ? 2 : 0,
        wuqianActive: false,
        liegongSuits: [],
        recastRanksThisTurn: [],
        cardsPlayedThisTurn: 0,
        damageDealt: 0,
        kills: 0,
      };
    };

    if (config.mode === '2v2') {
      // Classic 2v2 seating: Seat 0 (Warm) & Seat 3 (Warm) vs Seat 1 (Cool) & Seat 2 (Cool)
      players.push(makePlayer(0, true, config.humanHero, 'warm', 'warm', true));
      players.push(makePlayer(1, false, config.otherHeroes[0], 'cool', 'cool', true));
      players.push(makePlayer(2, false, config.otherHeroes[1], 'cool', 'cool', true));
      players.push(makePlayer(3, false, config.otherHeroes[2], 'warm', 'warm', true));
    } else if (config.mode === 'landlord') {
      // Human is Landlord (Seat 0), +1 maxHp
      players.push(makePlayer(0, true, config.humanHero, 'landlord', 'landlord', true, 1));
      players.push(makePlayer(1, false, config.otherHeroes[0], 'peasant', 'peasant', true));
      players.push(makePlayer(2, false, config.otherHeroes[1], 'peasant', 'peasant', true));
    } else {
      // 5-player Identity: 1 Lord, 1 Loyalist, 2 Rebels, 1 Renegade
      const identities: Identity[] = shuffle(['lord', 'loyalist', 'rebel', 'rebel', 'renegade']);
      const humanIdentity = identities[0];
      const mapTeam = (id: Identity): Team => {
        if (id === 'lord' || id === 'loyalist') return 'lord';
        if (id === 'rebel') return 'rebel';
        return 'renegade';
      };
      players.push(
        makePlayer(
          0,
          true,
          config.humanHero,
          mapTeam(humanIdentity),
          humanIdentity,
          humanIdentity === 'lord',
          humanIdentity === 'lord' ? 1 : 0
        )
      );
      for (let i = 1; i < 5; i++) {
        const id = identities[i];
        players.push(
          makePlayer(i, false, config.otherHeroes[i - 1], mapTeam(id), id, id === 'lord', id === 'lord' ? 1 : 0)
        );
      }
    }

    // Deal 4 initial cards to each player
    for (const p of players) {
      for (let i = 0; i < 4; i++) {
        const c = deck.pop();
        if (c) p.hand.push(c);
      }
    }

    const lordIdx = config.mode === 'identity5' ? players.findIndex((p) => p.identity === 'lord') : 0;

    return {
      mode: config.mode,
      turnNumber: 1,
      currentSeat: lordIdx >= 0 ? lordIdx : 0,
      phase: 'prepare',
      players,
      deck,
      discardPile: [],
      tableCards: [],
      logs: [
        {
          id: this.uid('log'),
          turn: 1,
          text:
            config.mode === '2v2'
              ? '【2v2排位赛】开局！1号位与4号位（暖色）对战 2号位与3号位（冷色）。1号位首回合少摸1张牌。'
              : config.mode === 'landlord'
                ? '【欢乐斗地主】开局！地主获得专属技【飞扬】【跋扈】及+1体力上限！'
                : '【5人经典身份场】开局！主公亮明身份，其余身份暗置。',
          kind: 'system',
        },
      ],
      floatingEffects: [],
      activeBanner: null,
      activeVfx: null,
      hitFlash: null,
      pendingPrompt: null,
      winner: null,
      luckyCardLeft: 5,
      autoPlay: false,
      speedMultiplier: 1,
      started: false,
    };
  }

  private addLog(text: string, kind: LogEntry['kind'] = 'normal') {
    this.state.logs.push({
      id: this.uid('log'),
      turn: this.state.turnNumber,
      text,
      kind,
    });
    if (this.state.logs.length > 80) {
      this.state.logs = this.state.logs.slice(-80);
    }
    this.emit();
  }

  private addFloat(targetId: string, text: string, kind: FloatingEffect['kind']) {
    const eff: FloatingEffect = {
      id: this.uid('eff'),
      targetId,
      text,
      kind,
      createdAt: Date.now(),
    };
    this.state.floatingEffects.push(eff);
    this.emit();
    setTimeout(() => {
      this.state.floatingEffects = this.state.floatingEffects.filter((e) => e.id !== eff.id);
      this.emit();
    }, 1300);
  }

  private showSkillBanner(player: Player, skillName: string) {
    sound.playSkill();
    sound.speak(skillName);
    this.state.activeBanner = {
      id: this.uid('banner'),
      playerName: player.name,
      heroName: player.hero.name,
      skillName,
      faction: player.hero.faction,
      quote: player.hero.quote,
    };
    this.addFloat(player.id, `【${skillName}】`, 'skill');
    this.emit();
    setTimeout(() => {
      if (this.state.activeBanner?.skillName === skillName) {
        this.state.activeBanner = null;
        this.emit();
      }
    }, 1500);
  }

  private triggerVfx(kind: CombatVfx['kind'], label: string, sublabel?: string, targetId?: string) {
    const vfx: CombatVfx = {
      id: this.uid('vfx'),
      kind,
      label,
      sublabel,
      targetId,
    };
    this.state.activeVfx = vfx;
    this.emit();
    setTimeout(() => {
      if (this.state.activeVfx?.id === vfx.id) {
        this.state.activeVfx = null;
        this.emit();
      }
    }, 950);
  }

  private triggerHitFlash(targetId: string, amount: number, element: 'normal' | 'fire' | 'thunder') {
    const hf = { id: this.uid('hit'), targetId, amount, element };
    this.state.hitFlash = hf;
    this.emit();
    setTimeout(() => {
      if (this.state.hitFlash?.id === hf.id) {
        this.state.hitFlash = null;
        this.emit();
      }
    }, 700);
  }

  private pushTableCard(card: Card, from: Player, to?: Player, label?: string) {
    this.state.tableCards.push({
      id: this.uid('tbl'),
      card,
      fromName: from.hero.name,
      toName: to?.hero.name,
      label,
    });
    if (this.state.tableCards.length > 6) {
      this.state.tableCards = this.state.tableCards.slice(-6);
    }
    this.emit();
  }

  private drawFromDeck(count: number): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (this.state.deck.length === 0) {
        if (this.state.discardPile.length === 0) break;
        this.state.deck = shuffle(this.state.discardPile);
        this.state.discardPile = [];
        this.addLog('牌堆耗尽，已重新洗牌。', 'system');
      }
      const c = this.state.deck.pop();
      if (c) out.push(c);
    }
    return out;
  }

  private giveCardsToPlayer(player: Player, cards: Card[]) {
    player.hand.push(...cards);
    this.emit();
  }

  private discardCards(cards: Card[]) {
    this.state.discardPile.push(...cards);
    this.emit();
  }

  private removeHandCard(player: Player, cardId: string): Card | null {
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return null;
    const [card] = player.hand.splice(idx, 1);
    return card;
  }

  public useLuckyCard(): boolean {
    const human = this.state.players.find((p) => p.isHuman);
    if (!human || this.state.luckyCardLeft <= 0 || this.state.turnNumber > 1) return false;
    sound.playTrick();
    this.state.luckyCardLeft -= 1;
    const count = human.hand.length;
    this.state.deck.unshift(...human.hand);
    this.state.deck = shuffle(this.state.deck);
    human.hand = this.drawFromDeck(count);
    this.addLog(`${human.hero.name} 使用了【手气卡】，重新抽取了 ${count} 张初始手牌！`, 'system');
    this.emit();
    return true;
  }

  public async start() {
    if (this.state.started) return;
    this.state.started = true;
    this.emit();
    await this.sleep(500);
    this.runGameLoop();
  }

  private checkVictory(): boolean {
    if (this.state.winner) return true;
    const alive = this.state.players.filter((p) => p.alive);
    const human = this.state.players.find((p) => p.isHuman)!;

    if (this.state.mode === '2v2') {
      const warmAlive = alive.some((p) => p.team === 'warm');
      const coolAlive = alive.some((p) => p.team === 'cool');
      if (!warmAlive || !coolAlive) {
        const winTeam: Team = warmAlive ? 'warm' : 'cool';
        const isHumanWin = human.team === winTeam;
        this.state.winner = {
          team: winTeam,
          title: isHumanWin ? '2v2 排位胜利' : '2v2 排位惜败',
          subtitle: winTeam === 'warm' ? '暖色阵营（1/4号位）大获全胜！' : '冷色阵营（2/3号位）掌控全局！',
          isHumanWin,
        };
        sound.playVictory(isHumanWin);
        this.addLog(`战局结束：${this.state.winner.subtitle}`, 'system');
        this.emit();
        return true;
      }
    } else if (this.state.mode === 'landlord') {
      const landlordAlive = alive.some((p) => p.identity === 'landlord');
      const peasantAlive = alive.some((p) => p.identity === 'peasant');
      if (!landlordAlive || !peasantAlive) {
        const winTeam: Team = landlordAlive ? 'landlord' : 'peasant';
        const isHumanWin = human.team === winTeam;
        this.state.winner = {
          team: winTeam,
          title: isHumanWin ? '斗地主大捷' : '斗地主败北',
          subtitle: landlordAlive ? '地主势不可挡，力压群雄！' : '农民齐心协力，推翻地主！',
          isHumanWin,
        };
        sound.playVictory(isHumanWin);
        this.emit();
        return true;
      }
    } else {
      // identity5
      const lord = this.state.players.find((p) => p.identity === 'lord')!;
      const rebelsAlive = alive.some((p) => p.identity === 'rebel');
      const renegadesAlive = alive.some((p) => p.identity === 'renegade');
      if (!lord.alive) {
        const onlyRenegade = alive.length === 1 && alive[0].identity === 'renegade';
        const winTeam: Team = onlyRenegade ? 'renegade' : 'rebel';
        const isHumanWin = human.team === winTeam;
        this.state.winner = {
          team: winTeam,
          title: isHumanWin ? '身份场胜利' : '身份场败北',
          subtitle: onlyRenegade ? '内奸笑到最后，独揽天下！' : '反贼成功弑主，改朝换代！',
          isHumanWin,
        };
        sound.playVictory(isHumanWin);
        this.emit();
        return true;
      }
      if (!rebelsAlive && !renegadesAlive) {
        const isHumanWin = human.identity === 'lord' || human.identity === 'loyalist';
        this.state.winner = {
          team: 'lord',
          title: isHumanWin ? '主忠凯旋' : '反内败北',
          subtitle: '主公与忠臣肃清寰宇，天下太平！',
          isHumanWin,
        };
        sound.playVictory(isHumanWin);
        this.emit();
        return true;
      }
    }
    return false;
  }

  private async runGameLoop() {
    while (!this.aborted && !this.state.winner) {
      const player = this.state.players[this.state.currentSeat];
      if (!player || !player.alive) {
        this.advanceSeat();
        continue;
      }

      // Reset per-turn flags
      player.shaUsedThisTurn = 0;
      player.jiuUsedThisTurn = 0;
      player.jiuActive = false;
      player.skillsUsedThisTurn = {};
      player.rendeGivenThisTurn = 0;
      player.rendeHealedThisTurn = false;
      player.luoyiActive = false;
      player.kurouBonusSha = 0;
      player.kurouRedUnblockable = false;
      player.wuqianActive = false;
      player.yijueTargetId = undefined;
      player.xiejiIgnoreArmor = false;
      player.recastRanksThisTurn = [];
      player.lastRecastRank = undefined;
      player.lastPlayedRed = undefined;
      player.cardsPlayedThisTurn = 0;

      // Clear previous turn's table cards cleanly when a new player starts their turn
      this.state.tableCards = [];
      this.addLog(`─── 第 ${this.state.turnNumber} 回合：${player.hero.name}（${player.seatIndex + 1}号位）───`, 'phase');

      // 1. Prepare Phase
      this.state.phase = 'prepare';
      this.emit();
      await this.handlePreparePhase(player);
      if (this.aborted || this.checkVictory() || !player.alive) {
        this.advanceSeat();
        continue;
      }

      // 2. Judge Phase
      this.state.phase = 'judge';
      this.emit();
      const { skipDraw, skipPlay } = await this.handleJudgePhase(player);
      if (this.aborted || this.checkVictory() || !player.alive) {
        this.advanceSeat();
        continue;
      }

      // 3. Draw Phase
      if (!skipDraw) {
        this.state.phase = 'draw';
        this.emit();
        await this.handleDrawPhase(player);
        if (this.aborted || this.checkVictory() || !player.alive) {
          this.advanceSeat();
          continue;
        }
      }

      // 4. Play Phase
      if (!skipPlay) {
        this.state.phase = 'play';
        this.emit();
        await this.handlePlayPhase(player);
        if (this.aborted || this.checkVictory() || !player.alive) {
          this.advanceSeat();
          continue;
        }
      }

      // 5. Discard Phase
      this.state.phase = 'discard';
      this.emit();
      await this.handleDiscardPhase(player);
      if (this.aborted || this.checkVictory() || !player.alive) {
        this.advanceSeat();
        continue;
      }

      // 6. End Phase
      this.state.phase = 'end';
      this.emit();
      await this.handleEndPhase(player);
      if (this.aborted || this.checkVictory()) break;

      this.advanceSeat();
      await this.sleep(320);
    }
  }

  private advanceSeat() {
    const n = this.state.players.length;
    const prev = this.state.currentSeat;
    let next = (prev + 1) % n;
    let guard = 0;
    while (!this.state.players[next].alive && guard < n) {
      next = (next + 1) % n;
      guard++;
    }
    if (next <= prev) {
      this.state.turnNumber += 1;
    }
    this.state.currentSeat = next;
    this.emit();
  }

  private askPlayer(prompt: Omit<PendingPrompt, 'id' | 'resolve'>): Promise<PromptResult> {
    return new Promise((resolve) => {
      if (this.aborted) {
        resolve({ confirmed: false });
        return;
      }
      const p = this.state.players.find((pl) => pl.id === prompt.playerId);
      if (!p || !p.isHuman || this.state.autoPlay) {
        // Natural human-like reaction delay (thinking whether to dodge / rescue / counter)
        const reactMs = Math.round((850 + Math.random() * 650) / this.state.speedMultiplier);
        setTimeout(() => {
          resolve(this.resolvePromptByAI(prompt));
        }, Math.max(220, reactMs));
        return;
      }

      const fullPrompt: PendingPrompt = {
        ...prompt,
        id: this.uid('prompt'),
        resolve: (res) => {
          this.state.pendingPrompt = null;
          this.emit();
          resolve(res);
        },
      };
      this.state.pendingPrompt = fullPrompt;
      this.emit();
    });
  }

  public submitPrompt(result: PromptResult) {
    if (!this.state.pendingPrompt) return;
    const resolver = this.state.pendingPrompt.resolve;
    resolver(result);
  }

  // ==================== PHASES ====================

  private recordLiegongSuit(player: Player | undefined, suit: Suit) {
    if (!player || !player.alive || !hasSkill(player, 'mou_liegong')) return;
    if (!player.liegongSuits.includes(suit)) {
      player.liegongSuits.push(suit);
      this.addFloat(player.id, `烈弓记录 ${suitSymbol(suit)} (${player.liegongSuits.length}/4)`, 'skill');
      this.addLog(`${player.hero.name}【烈弓】记录了花色 ${suitSymbol(suit)}（当前 ${player.liegongSuits.map(suitSymbol).join('')}）。`, 'skill');
      this.emit();
    }
  }

  private async handlePreparePhase(player: Player) {
    // 谋甄姬 谋·洛神 (连续判黑收入手牌)
    if (hasSkill(player, 'luoshen_mou')) {
      this.showSkillBanner(player, '谋·洛神');
      let got = 0;
      while (player.alive && got < 8) {
        const j = await this.doJudge(player, '洛神');
        if (j && isBlackSuit(j.suit)) {
          // reclaim from discardPile into hand
          const idx = this.state.discardPile.findIndex((c) => c.id === j.id);
          if (idx >= 0) this.state.discardPile.splice(idx, 1);
          this.giveCardsToPlayer(player, [j]);
          got += 1;
          await this.sleep(220);
        } else {
          break;
        }
      }
      if (got > 0) this.addLog(`${player.hero.name} 发动【谋·洛神】，连判获得 ${got} 张黑色牌！`, 'skill');
    }

    // 诸葛亮 / 谋诸葛亮 / 极诸葛亮 观星
    if (hasSkill(player, 'guanxing')) {
      const topCards = this.drawFromDeck(5);
      if (topCards.length > 0) {
        this.showSkillBanner(player, '观星');
        if (player.isHuman && !this.state.autoPlay) {
          const res = await this.askPlayer({
            kind: 'guanxing',
            playerId: player.id,
            title: '发动【观星】',
            subtitle: '将卡牌分配至牌堆顶（即将摸到/判定）或牌堆底',
            cards: topCards,
            canSkip: false,
          });
          const top = res.topCards ?? topCards;
          const bottom = res.bottomCards ?? [];
          // top[0] will be drawn first (pop from end)
          for (let i = top.length - 1; i >= 0; i--) {
            this.state.deck.push(top[i]);
          }
          for (const c of bottom) {
            this.state.deck.unshift(c);
          }
        } else {
          // AI puts good cards on top (桃/无中/杀/闪)
          const score = (c: Card) => {
            if (c.name === '桃' || c.name === '无中生有') return 10;
            if (c.name === '顺手牵羊' || c.name === '过河拆桥' || c.name === '乐不思蜀') return 8;
            if (isSlashCard(c)) return 7;
            if (c.name === '闪') return 6;
            return 3;
          };
          const sorted = [...topCards].sort((a, b) => score(b) - score(a));
          const keepTop = sorted.slice(0, 3);
          const putBot = sorted.slice(3);
          for (let i = keepTop.length - 1; i >= 0; i--) this.state.deck.push(keepTop[i]);
          for (const c of putBot) this.state.deck.unshift(c);
        }
        this.addLog(`${player.hero.name} 发动【观星】调整了牌堆顶的牌。`, 'skill');
        await this.sleep(350);
      }
    }
  }

  private async doJudge(player: Player, reason: string): Promise<Card | null> {
    const drawn = this.drawFromDeck(1);
    if (drawn.length === 0) return null;
    let judgeCard = drawn[0];
    this.pushTableCard(judgeCard, player, undefined, `${reason}判定`);
    this.addLog(`${player.hero.name} 进行【${reason}】判定：${suitSymbol(judgeCard.suit)}${rankLabel(judgeCard.rank)} ${judgeCard.name}`, 'normal');
    await this.sleep(450);

    // 司马懿 / 极司马懿 鬼才
    const simayi = this.state.players.find((p) => p.alive && hasSkill(p, 'guicai') && p.hand.length > 0);
    if (simayi && reason === '乐不思蜀') {
      const wantRed = isAlly(simayi, player, this.state.mode);
      const isHeart = judgeCard.suit === 'heart';
      if (wantRed && !isHeart) {
        const heart = simayi.hand.find((c) => c.suit === 'heart');
        if (heart) {
          this.removeHandCard(simayi, heart.id);
          this.discardCards([judgeCard]);
          judgeCard = heart;
          this.showSkillBanner(simayi, '鬼才');
          this.addLog(`司马懿发动【鬼才】，用 ${suitSymbol(heart.suit)}${rankLabel(heart.rank)} 替换判定牌！`, 'skill');
        }
      } else if (!wantRed && isHeart) {
        const nonHeart = simayi.hand.find((c) => c.suit !== 'heart');
        if (nonHeart) {
          this.removeHandCard(simayi, nonHeart.id);
          this.discardCards([judgeCard]);
          judgeCard = nonHeart;
          this.showSkillBanner(simayi, '鬼才');
          this.addLog(`司马懿发动【鬼才】，用 ${suitSymbol(nonHeart.suit)}${rankLabel(nonHeart.rank)} 替换判定牌！`, 'skill');
        }
      }
    }

    // 界郭嘉 / 谋郭嘉 / 极郭嘉 天妒
    if (hasSkill(player, 'tiandu') && player.alive) {
      this.showSkillBanner(player, '天妒');
      this.giveCardsToPlayer(player, [judgeCard]);
      this.addLog(`${player.hero.name} 发动【天妒】，获得了判定牌 ${judgeCard.name}。`, 'skill');
    } else {
      this.discardCards([judgeCard]);
    }
    return judgeCard;
  }

  private async handleJudgePhase(player: Player): Promise<{ skipDraw: boolean; skipPlay: boolean }> {
    let skipDraw = false;
    let skipPlay = false;

    // 斗地主地主专属技【飞扬】：判定阶段可弃2张手牌移除1张延时锦囊
    if (
      this.state.mode === 'landlord' &&
      player.identity === 'landlord' &&
      player.judge.length > 0 &&
      player.hand.length >= 2
    ) {
      this.showSkillBanner(player, '飞扬');
      const d1 = player.hand.pop()!;
      const d2 = player.hand.pop()!;
      const removed = player.judge.pop()!;
      this.discardCards([d1, d2, removed]);
      this.addLog(`${player.hero.name} 发动地主技【飞扬】，弃2牌移除了【${removed.name}】！`, 'skill');
      await this.sleep(400);
    }

    while (player.judge.length > 0 && player.alive) {
      const card = player.judge.pop()!;
      const negated = await this.askWuxie(card, player, `${player.hero.name}的【${card.name}】`);
      if (negated) {
        this.discardCards([card]);
        continue;
      }

      const jCard = await this.doJudge(player, card.name);
      if (!jCard) {
        this.discardCards([card]);
        continue;
      }

      if (card.name === '乐不思蜀') {
        if (jCard.suit !== 'heart') {
          skipPlay = true;
          this.addFloat(player.id, '乐不思蜀生效！', 'info');
          this.addLog(`${player.hero.name} 的【乐不思蜀】判定生效，跳过出牌阶段！`, 'damage');
        } else {
          this.addFloat(player.id, '天过！', 'dodge');
          this.addLog(`${player.hero.name} 的【乐不思蜀】判定红桃，天过！`, 'heal');
        }
        this.discardCards([card]);
      } else if (card.name === '兵粮寸断') {
        if (jCard.suit !== 'club') {
          skipDraw = true;
          this.addFloat(player.id, '兵粮寸断生效！', 'info');
          this.addLog(`${player.hero.name} 的【兵粮寸断】判定生效，跳过摸牌阶段！`, 'damage');
        } else {
          this.addFloat(player.id, '兵粮失效', 'dodge');
          this.addLog(`${player.hero.name} 的【兵粮寸断】判定梅花，失效！`, 'heal');
        }
        this.discardCards([card]);
      } else if (card.name === '闪电') {
        if (jCard.suit === 'spade' && jCard.rank >= 2 && jCard.rank <= 9) {
          this.addLog(`轰隆！【闪电】劈中 ${player.hero.name}，造成3点雷电伤害！`, 'damage');
          this.discardCards([card]);
          await this.applyDamage(null, player, 3, 'thunder');
        } else {
          // Pass to next alive player
          const alive = this.state.players.filter((p) => p.alive);
          const idx = alive.findIndex((p) => p.id === player.id);
          const nextP = alive[(idx + 1) % alive.length];
          if (nextP && !nextP.judge.some((j) => j.name === '闪电')) {
            nextP.judge.push(card);
            this.addLog(`【闪电】未劈中，顺延传给 ${nextP.hero.name}。`, 'normal');
          } else {
            this.discardCards([card]);
          }
        }
      }
      await this.sleep(350);
    }

    return { skipDraw, skipPlay };
  }

  private async handleDrawPhase(player: Player) {
    let drawCount = 2;

    // 2v2 official balance: Seat 0 draws 1 card on turn 1
    if (this.state.mode === '2v2' && this.state.turnNumber === 1 && player.seatIndex === 0) {
      drawCount = 1;
      this.addLog('【2v2平衡规则】1号位首回合摸牌阶段少摸1张牌（摸1张）。', 'system');
    }

    // 斗地主地主【跋扈】：摸牌阶段多摸1张
    if (this.state.mode === 'landlord' && player.identity === 'landlord') {
      drawCount += 1;
      this.addFloat(player.id, '跋扈+1牌', 'skill');
    }

    // 英姿 / 极·英姿
    if (hasSkill(player, 'yingzi')) {
      const bonus = player.hero.id === 'ji_zhouyu' ? 2 : 1;
      drawCount += bonus;
      this.showSkillBanner(player, player.hero.id === 'ji_zhouyu' ? '极·英姿' : '英姿');
    }

    // 谋鲁肃 / 极鲁肃 好施
    if (hasSkill(player, 'haoshi_mou')) {
      drawCount += 2;
      this.showSkillBanner(player, '好施');
    }

    // 其他摸牌+1被动 (极袁绍/谋曹丕/极诸葛亮/极刘备/谋刘备/志姜维/神甘宁/谋赵云残血/谋孙策受伤)
    if (
      hasSkill(player, 'xueyi_ji') ||
      hasSkill(player, 'xingshang_mou') ||
      hasSkill(player, 'jizhi_wei_zhi') ||
      hasSkill(player, 'jieying_shen') ||
      player.hero.id === 'ji_zhugeliang' ||
      player.hero.id === 'ji_liubei' ||
      player.hero.id === 'mou_liubei' ||
      (hasSkill(player, 'jizhu_mou') && player.hp <= 2) ||
      (hasSkill(player, 'jiang_mou') && player.hp < player.maxHp)
    ) {
      drawCount += 1;
    }

    // 志孙权【承帆】：多摸1张且优先从牌堆获得点数10~J的牌
    if (hasSkill(player, 'chengfan_zhi')) {
      this.showSkillBanner(player, '承帆');
      const total = drawCount + 1;
      const picked: Card[] = [];
      for (let i = this.state.deck.length - 1; i >= 0 && picked.length < total; i--) {
        const rk = this.state.deck[i].rank;
        if (rk === 10 || rk === 11) {
          picked.push(this.state.deck.splice(i, 1)[0]);
        }
      }
      if (picked.length < total) {
        picked.push(...this.drawFromDeck(total - picked.length));
      }
      this.giveCardsToPlayer(player, picked);
      this.addLog(`${player.hero.name} 发动【承帆】，获得了 ${picked.length} 张牌（优先10~J）！`, 'skill');
      await this.sleep(300);
      return;
    }

    // 界张辽 / 谋张辽 【突袭】
    if (hasSkill(player, 'tuxi')) {
      const enemiesWithHand = this.state.players.filter(
        (p) => p.alive && p.id !== player.id && isEnemy(player, p, this.state.mode) && p.hand.length > 0
      );
      if (enemiesWithHand.length > 0) {
        let targets: Player[] = [];
        if (player.isHuman && !this.state.autoPlay) {
          const res = await this.askPlayer({
            kind: 'tuxi_targets',
            playerId: player.id,
            title: '是否发动【突袭】？',
            subtitle: `可少摸至多${Math.min(drawCount, 2)}张牌，改为从敌方手牌中各偷取1张`,
            canSkip: true,
          });
          if (res.confirmed && res.selectedTargetIds && res.selectedTargetIds.length > 0) {
            targets = res.selectedTargetIds
              .map((id) => this.state.players.find((p) => p.id === id))
              .filter((p): p is Player => !!p && p.alive && p.hand.length > 0)
              .slice(0, Math.min(drawCount, 2));
          }
        } else {
          targets = enemiesWithHand.slice(0, Math.min(drawCount, 2));
        }

        if (targets.length > 0) {
          this.showSkillBanner(player, '突袭');
          drawCount -= targets.length;
          for (const t of targets) {
            const idx = Math.floor(Math.random() * t.hand.length);
            const [stolen] = t.hand.splice(idx, 1);
            player.hand.push(stolen);
            this.addLog(`${player.hero.name} 发动【突袭】，从 ${t.hero.name} 手中偷取了1张牌！`, 'skill');
          }
          await this.sleep(350);
        }
      }
    }

    // 界许褚【裸衣】
    if (player.hero.id === 'jie_xuchu' && drawCount >= 2) {
      const hasOffensive = player.hand.some((c) => isSlashCard(c) || c.name === '决斗');
      if (!player.isHuman || this.state.autoPlay ? hasOffensive : false) {
        player.luoyiActive = true;
        drawCount -= 1;
        this.showSkillBanner(player, '裸衣');
        this.addLog(`${player.hero.name} 发动【裸衣】，少摸1张牌，本回合杀与决斗伤害+1！`, 'skill');
      }
    }

    if (drawCount > 0) {
      const cards = this.drawFromDeck(drawCount);
      this.giveCardsToPlayer(player, cards);
      this.addLog(`${player.hero.name} 摸了 ${cards.length} 张牌。`, 'normal');
    }
    await this.sleep(300);
  }

  private async handlePlayPhase(player: Player) {
    if (player.isHuman && !this.state.autoPlay) {
      await new Promise<void>((resolve) => {
        this.playPhaseDoneResolver = resolve;
      });
      this.playPhaseDoneResolver = null;
    } else {
      await this.runAIPlayPhase(player);
    }
  }

  private async runAutoPlayForHuman() {
    const player = this.state.players[this.state.currentSeat];
    if (!player || !player.isHuman) return;
    await this.runAIPlayPhase(player);
    this.humanEndPlayPhase();
  }

  public humanEndPlayPhase() {
    if (this.playActionBusy) return;
    if (this.playPhaseDoneResolver) {
      sound.playClick();
      const fn = this.playPhaseDoneResolver;
      this.playPhaseDoneResolver = null;
      fn();
    }
  }

  public async humanPlayCard(cardId: string, targetId?: string, asSkill?: string) {
    if (this.playActionBusy || this.state.phase !== 'play') return;
    const player = this.state.players[this.state.currentSeat];
    if (!player || !player.isHuman) return;
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return;

    this.playActionBusy = true;
    try {
      const target = targetId ? this.state.players.find((p) => p.id === targetId) : undefined;
      await this.executePlayCard(player, card, target, asSkill);
      if (this.checkVictory() || !player.alive) {
        if (this.playPhaseDoneResolver) {
          const fn = this.playPhaseDoneResolver;
          this.playPhaseDoneResolver = null;
          fn();
        }
      }
    } finally {
      this.playActionBusy = false;
      this.emit();
    }
  }

  public async humanUseZhangba(cardId1: string, cardId2: string, targetId: string) {
    if (this.playActionBusy || this.state.phase !== 'play') return;
    const player = this.state.players[this.state.currentSeat];
    const target = this.state.players.find((p) => p.id === targetId);
    if (!player || !player.isHuman || !target || player.equip.weapon?.name !== '丈八蛇矛') return;
    const c1 = player.hand.find((c) => c.id === cardId1);
    const c2 = player.hand.find((c) => c.id === cardId2);
    if (!c1 || !c2 || c1.id === c2.id) return;

    this.playActionBusy = true;
    try {
      this.removeHandCard(player, c1.id);
      this.removeHandCard(player, c2.id);
      this.discardCards([c1, c2]);
      const virtualSlash: Card = {
        id: this.uid('zb_sha'),
        name: '杀',
        suit: isRedSuit(c1.suit) && isRedSuit(c2.suit) ? 'heart' : 'spade',
        rank: 0,
        type: 'basic',
        element: 'normal',
        description: '丈八蛇矛转化杀',
      };
      this.addLog(`${player.hero.name} 发动【丈八蛇矛】，将2张手牌当【杀】对 ${target.hero.name} 使用！`, 'skill');
      await this.resolveSlash(player, target, virtualSlash, true);
      if (this.checkVictory() || !player.alive) {
        if (this.playPhaseDoneResolver) {
          const fn = this.playPhaseDoneResolver;
          this.playPhaseDoneResolver = null;
          fn();
        }
      }
    } finally {
      this.playActionBusy = false;
      this.emit();
    }
  }

  public async humanUseActiveSkill(skillId: string, cardIds: string[], targetIds: string[]) {
    if (this.playActionBusy || this.state.phase !== 'play') return;
    const player = this.state.players[this.state.currentSeat];
    if (!player || !player.isHuman) return;

    this.playActionBusy = true;
    try {
      await this.executeActiveSkill(player, skillId, cardIds, targetIds);
      if (this.checkVictory() || !player.alive) {
        if (this.playPhaseDoneResolver) {
          const fn = this.playPhaseDoneResolver;
          this.playPhaseDoneResolver = null;
          fn();
        }
      }
    } finally {
      this.playActionBusy = false;
      this.emit();
    }
  }

  // ==================== ACTIVE SKILLS ====================

  private async executeActiveSkill(player: Player, skillId: string, cardIds: string[], targetIds: string[]) {
    if (skillId === 'zhiheng' && hasSkill(player, 'zhiheng')) {
      if ((player.skillsUsedThisTurn['zhiheng'] ?? 0) >= 1 || cardIds.length === 0) return;
      player.skillsUsedThisTurn['zhiheng'] = 1;
      const discardAllHand = cardIds.length >= player.hand.length && player.hand.length > 0;
      const removed: Card[] = [];
      for (const cid of cardIds) {
        const c = this.removeHandCard(player, cid);
        if (c) removed.push(c);
      }
      if (removed.length === 0) return;
      this.discardCards(removed);
      this.showSkillBanner(player, player.hero.id === 'ji_sunquan' ? '极·制衡' : '制衡');
      const bonus = player.hero.id === 'ji_sunquan' ? 1 : discardAllHand ? 1 : 0;
      const drawN = removed.length + bonus;
      const drawn = this.drawFromDeck(drawN);
      this.giveCardsToPlayer(player, drawn);
      this.addLog(
        `${player.hero.name} 发动【制衡】，弃置 ${removed.length} 张牌，摸了 ${drawn.length} 张牌${bonus ? '（额外+1！）' : ''}。`,
        'skill'
      );
      await this.sleep(350);
      return;
    }

    if (skillId === 'rende' && hasSkill(player, 'rende')) {
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target || cardIds.length === 0) return;
      const given: Card[] = [];
      for (const cid of cardIds) {
        const c = this.removeHandCard(player, cid);
        if (c) given.push(c);
      }
      if (given.length === 0) return;
      this.showSkillBanner(player, '仁德');
      this.giveCardsToPlayer(target, given);
      player.rendeGivenThisTurn += given.length;
      this.addLog(`${player.hero.name} 发动【仁德】，将 ${given.length} 张牌交给 ${target.hero.name}。`, 'skill');
      if (player.rendeGivenThisTurn >= 2 && !player.rendeHealedThisTurn && player.hp < player.maxHp) {
        player.rendeHealedThisTurn = true;
        this.healPlayer(player, 1);
      }
      await this.sleep(350);
      return;
    }

    if (skillId === 'kurou' && hasSkill(player, 'kurou')) {
      if ((player.skillsUsedThisTurn['kurou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['kurou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '苦肉');
      await this.loseHp(player, 1);
      if (player.alive) {
        const drawn = this.drawFromDeck(3);
        this.giveCardsToPlayer(player, drawn);
        player.kurouBonusSha += 1;
        player.kurouRedUnblockable = true;
        this.addLog(`${player.hero.name} 发动【苦肉】失去1点体力，摸3张牌，本回合额外+1杀且红杀必中！`, 'skill');
      }
      await this.sleep(350);
      return;
    }

    if (skillId === 'qingnang' && hasSkill(player, 'qingnang')) {
      if ((player.skillsUsedThisTurn['qingnang'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.hp < p.maxHp);
      if (!target) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['qingnang'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '青囊');
      this.healPlayer(target, 1);
      if (player.hero.id === 'mou_huatuo') this.giveCardsToPlayer(target, this.drawFromDeck(1));
      this.addLog(`${player.hero.name} 发动【青囊】，弃1牌令 ${target.hero.name} 回复1点体力！`, 'heal');
      await this.sleep(350);
      return;
    }

    if (skillId === 'jieyin' && hasSkill(player, 'jieyin')) {
      if ((player.skillsUsedThisTurn['jieyin'] ?? 0) >= 1 || cardIds.length < 2) return;
      const target = this.state.players.find(
        (p) => p.id === targetIds[0] && p.alive && p.id !== player.id && p.hero.gender === 'male' && p.hp < p.maxHp
      );
      if (!target) return;
      const c1 = this.removeHandCard(player, cardIds[0]);
      const c2 = this.removeHandCard(player, cardIds[1]);
      if (!c1 || !c2) return;
      player.skillsUsedThisTurn['jieyin'] = 1;
      this.discardCards([c1, c2]);
      this.showSkillBanner(player, '结姻');
      if (player.hp < player.maxHp) this.healPlayer(player, 1);
      this.healPlayer(target, 1);
      this.addLog(`${player.hero.name} 发动【结姻】，与 ${target.hero.name} 各回复1点体力！`, 'heal');
      await this.sleep(350);
      return;
    }

    if (skillId === 'fanjian' && hasSkill(player, 'fanjian')) {
      if ((player.skillsUsedThisTurn['fanjian'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['fanjian'] = 1;
      this.showSkillBanner(player, '反间');
      const suits: Suit[] = ['spade', 'heart', 'club', 'diamond'];
      let guess: Suit = suits[Math.floor(Math.random() * 4)];
      if (target.isHuman && !this.state.autoPlay) {
        const res = await this.askPlayer({
          kind: 'fanjian_guess',
          playerId: target.id,
          title: `${player.hero.name} 对你发动【反间】`,
          subtitle: '请猜测此牌的花色，猜错将受到1点伤害',
          canSkip: false,
        });
        if (res.selectedSuit) guess = res.selectedSuit;
      }
      this.giveCardsToPlayer(target, [c]);
      if (guess !== c.suit) {
        this.addLog(`${target.hero.name} 猜了 ${suitSymbol(guess)}，实际为 ${suitSymbol(c.suit)}，猜错受到1点伤害！`, 'damage');
        await this.applyDamage(player, target, 1, 'normal');
      } else {
        this.addLog(`${target.hero.name} 猜中了花色 ${suitSymbol(guess)}，免受伤害！`, 'heal');
      }
      await this.sleep(350);
      return;
    }

    if (skillId === 'lijian' && hasSkill(player, 'lijian')) {
      if ((player.skillsUsedThisTurn['lijian'] ?? 0) >= 1 || cardIds.length < 1 || targetIds.length < 2) return;
      const t1 = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.hero.gender === 'male');
      const t2 = this.state.players.find((p) => p.id === targetIds[1] && p.alive && p.hero.gender === 'male' && p.id !== t1?.id);
      if (!t1 || !t2) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['lijian'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, player.hero.id === 'ji_diaochan' ? '极·离间' : '离间');
      if (player.hero.id === 'ji_diaochan') {
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
      this.addLog(`${player.hero.name} 发动【离间】，令 ${t1.hero.name} 与 ${t2.hero.name} 决斗！`, 'skill');
      await this.resolveDuel(t1, t2);
      return;
    }

    if (skillId === 'shenfen' && hasSkill(player, 'shenfen')) {
      if ((player.skillsUsedThisTurn['shenfen'] ?? 0) >= 1 || player.wrathMarks < 4) return;
      player.skillsUsedThisTurn['shenfen'] = 1;
      player.wrathMarks -= 4;
      this.showSkillBanner(player, '神愤');
      const enemies = this.state.players.filter((p) => p.alive && isEnemy(player, p, this.state.mode));
      this.addLog(`${player.hero.name} 消耗4枚暴怒发动【神愤】！天地变色！`, 'skill');
      for (const e of enemies) {
        if (!e.alive) continue;
        await this.applyDamage(player, e, 1, 'normal');
        if (e.alive && e.hand.length > 0) {
          const dropN = Math.min(2, e.hand.length);
          const dropped = e.hand.splice(0, dropN);
          this.discardCards(dropped);
          this.addLog(`${e.hero.name} 因【神愤】弃置了 ${dropN} 张手牌。`, 'normal');
        }
        if (this.checkVictory()) return;
      }
      await this.sleep(400);
      return;
    }

    // ==================== 谋 / 极 系列专属主动技 ====================
    if (skillId === 'yijue_mou' && hasSkill(player, 'yijue_mou')) {
      if ((player.skillsUsedThisTurn['yijue_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['yijue_mou'] = 1;
      this.discardCards([c]);
      player.yijueTargetId = target.id;
      this.showSkillBanner(player, '义绝');
      if (target.hand.length < player.hand.length) {
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
      this.addLog(`${player.hero.name} 对 ${target.hero.name} 发动【义绝】，本回合对其杀必中且伤害+1！`, 'skill');
      await this.sleep(320);
      return;
    }

    if (skillId === 'xieji_mou' && hasSkill(player, 'xieji_mou')) {
      if ((player.skillsUsedThisTurn['xieji_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['xieji_mou'] = 1;
      this.discardCards([c]);
      player.xiejiIgnoreArmor = true;
      this.showSkillBanner(player, '协击');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      this.addLog(`${player.hero.name} 发动【协击】，摸2张牌且本回合杀无视防具！`, 'skill');
      await this.sleep(320);
      return;
    }

    if ((skillId === 'huoji_mou' || skillId === 'ronghuo_mou' || skillId === 'qianxun_mou') && hasSkill(player, skillId)) {
      if ((player.skillsUsedThisTurn[skillId] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!target || !cardObj || !isRedSuit(cardObj.suit)) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn[skillId] = 1;
      const label = skillId === 'huoji_mou' ? '火计' : skillId === 'ronghuo_mou' ? '融火' : '谦逊';
      this.showSkillBanner(player, label);
      const dmg = skillId === 'ronghuo_mou' && target.hand.length < player.hand.length ? 2 : 1;
      this.addLog(`${player.hero.name} 发动【${label}】，对 ${target.hero.name} 造成 ${dmg} 点火焰伤害！`, 'damage');
      await this.applyDamage(player, target, dmg, 'fire');
      if (skillId === 'qianxun_mou' && player.alive) {
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
      await this.sleep(320);
      return;
    }

    if (skillId === 'lianhuan_mou' && hasSkill(player, 'lianhuan_mou')) {
      if ((player.skillsUsedThisTurn['lianhuan_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['lianhuan_mou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '连环');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      this.addLog(`${player.hero.name} 发动【连环】重铸1牌并摸2张牌！`, 'skill');
      await this.sleep(300);
      return;
    }

    if (skillId === 'xuanhuo_mou' && hasSkill(player, 'xuanhuo_mou')) {
      if ((player.skillsUsedThisTurn['xuanhuo_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['xuanhuo_mou'] = 1;
      this.showSkillBanner(player, '眩惑');
      this.giveCardsToPlayer(target, [c, ...this.drawFromDeck(2)]);
      this.addLog(`${player.hero.name} 发动【眩惑】交1牌给 ${target.hero.name} 并令其摸2张牌！`, 'skill');
      await this.sleep(320);
      return;
    }

    if (skillId === 'qingzheng_mou' && hasSkill(player, 'qingzheng_mou')) {
      if ((player.skillsUsedThisTurn['qingzheng_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['qingzheng_mou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '清正');
      if (target.hand.length > 0) {
        const dropped = target.hand.splice(0, 1);
        this.discardCards(dropped);
      }
      this.addLog(`${player.hero.name} 发动【清正】，弃置 ${target.hero.name} 1牌并造成1点伤害！`, 'damage');
      await this.applyDamage(player, target, 1, 'normal');
      return;
    }

    if (skillId === 'quanmou_mou' && hasSkill(player, 'quanmou_mou')) {
      if ((player.skillsUsedThisTurn['quanmou_mou'] ?? 0) >= 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      player.skillsUsedThisTurn['quanmou_mou'] = 1;
      this.showSkillBanner(player, '权谋');
      if (target.hand.length > 0) {
        const idx = Math.floor(Math.random() * target.hand.length);
        const [stolen] = target.hand.splice(idx, 1);
        this.giveCardsToPlayer(player, [stolen]);
        this.addLog(`${player.hero.name} 发动【权谋】，从 ${target.hero.name} 手中夺取1张牌！`, 'skill');
      } else {
        this.addLog(`${player.hero.name} 发动【权谋】，${target.hero.name} 无手牌受到1点伤害！`, 'damage');
        await this.applyDamage(player, target, 1, 'normal');
      }
      await this.sleep(320);
      return;
    }

    if ((skillId === 'shensu_mou' || skillId === 'quhu_mou' || skillId === 'kuangfu_mou') && hasSkill(player, skillId)) {
      if ((player.skillsUsedThisTurn[skillId] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn[skillId] = 1;
      this.discardCards([c]);
      const label = skillId === 'shensu_mou' ? '神速' : skillId === 'quhu_mou' ? '驱虎' : '狂斧';
      this.showSkillBanner(player, label);
      const hasEquip = !!(target.equip.weapon || target.equip.armor || target.equip.horsePlus || target.equip.horseMinus);
      await this.applyDamage(player, target, 1, 'normal');
      if (skillId === 'kuangfu_mou' && hasEquip && player.alive) {
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
      return;
    }

    if (skillId === 'luanwu_mou' && hasSkill(player, 'luanwu_mou')) {
      if ((player.skillsUsedThisTurn['luanwu_mou'] ?? 0) >= 1) return;
      player.skillsUsedThisTurn['luanwu_mou'] = 1;
      this.showSkillBanner(player, '乱武');
      const enemies = this.state.players
        .filter((p) => p.alive && isEnemy(player, p, this.state.mode))
        .sort((a, b) => a.hp - b.hp);
      if (enemies.length > 0) {
        await this.applyDamage(player, enemies[0], 1, 'normal');
        for (const e of enemies.slice(1)) {
          if (e.alive && e.hand.length > 0) {
            this.discardCards(e.hand.splice(0, 1));
          }
        }
      }
      return;
    }

    if (skillId === 'fenwei_mou' && hasSkill(player, 'fenwei_mou')) {
      if ((player.skillsUsedThisTurn['fenwei_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['fenwei_mou'] = 1;
      this.discardCards([c]);
      player.kurouBonusSha += 1;
      this.showSkillBanner(player, '奋威');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      this.addLog(`${player.hero.name} 发动【奋威】，摸2牌且本回合出杀次数+1！`, 'skill');
      await this.sleep(320);
      return;
    }

    if (skillId === 'dujiang_mou' && hasSkill(player, 'dujiang_mou')) {
      if ((player.skillsUsedThisTurn['dujiang_mou'] ?? 0) >= 1 || cardIds.length < 2) return;
      const c1 = this.removeHandCard(player, cardIds[0]);
      const c2 = this.removeHandCard(player, cardIds[1]);
      if (!c1 || !c2) return;
      player.skillsUsedThisTurn['dujiang_mou'] = 1;
      this.discardCards([c1, c2]);
      this.showSkillBanner(player, '渡江');
      this.healPlayer(player, 1);
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(320);
      return;
    }

    if (skillId === 'dimeng_mou' && hasSkill(player, 'dimeng_mou')) {
      if ((player.skillsUsedThisTurn['dimeng_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['dimeng_mou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '缔盟');
      const tmp = player.hand;
      player.hand = target.hand;
      target.hand = tmp;
      this.addLog(`${player.hero.name} 发动【缔盟】，与 ${target.hero.name} 交换了全部手牌！`, 'skill');
      this.emit();
      await this.sleep(350);
      return;
    }

    if (skillId === 'luanji_mou' && hasSkill(player, 'luanji_mou')) {
      if ((player.skillsUsedThisTurn['luanji_mou'] ?? 0) >= 1 || cardIds.length < 2) return;
      const c1 = this.removeHandCard(player, cardIds[0]);
      const c2 = this.removeHandCard(player, cardIds[1]);
      if (!c1 || !c2) return;
      player.skillsUsedThisTurn['luanji_mou'] = 1;
      this.discardCards([c1, c2]);
      this.showSkillBanner(player, player.hero.id === 'ji_yuanshao' ? '极·乱击' : '乱击');
      const enemies = this.state.players.filter((p) => p.alive && isEnemy(player, p, this.state.mode));
      this.addLog(`${player.hero.name} 发动【乱击】向所有敌方射出万箭齐发！`, 'skill');
      for (const e of enemies) {
        if (!e.alive) continue;
        if (e.equip.armor?.name === '藤甲') {
          this.addFloat(e.id, '藤甲免疫', 'dodge');
          continue;
        }
        const shan = e.hand.find((h) => canActAsShan(e, h));
        if (shan && (!e.isHuman || this.state.autoPlay)) {
          this.removeHandCard(e, shan.id);
          this.discardCards([shan]);
          sound.playDodge();
          this.addFloat(e.id, '闪避', 'dodge');
        } else if (shan && e.isHuman) {
          const res = await this.askPlayer({
            kind: 'respond_shan',
            playerId: e.id,
            title: `响应 ${player.hero.name} 的【乱击·万箭】`,
            subtitle: '请打出1张【闪】，否则受到1点伤害',
            minCards: 1,
            maxCards: 1,
            canSkip: true,
          });
          if (res.confirmed && res.selectedCardIds?.[0]) {
            const used = this.removeHandCard(e, res.selectedCardIds[0]);
            if (used) {
              this.discardCards([used]);
              sound.playDodge();
              continue;
            }
          }
          await this.applyDamage(player, e, 1, 'normal');
        } else {
          await this.applyDamage(player, e, 1, 'normal');
        }
        if (this.checkVictory()) return;
      }
      return;
    }

    if (skillId === 'jiuchi_mou' && hasSkill(player, 'jiuchi_mou')) {
      if ((player.skillsUsedThisTurn['jiuchi_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!cardObj || !isBlackSuit(cardObj.suit)) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn['jiuchi_mou'] = 1;
      player.jiuActive = true;
      this.showSkillBanner(player, '酒池');
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      this.addLog(`${player.hero.name} 发动【酒池】，进入酒状态并摸1张牌！`, 'skill');
      await this.sleep(320);
      return;
    }

    if (skillId === 'leiji_mou' && hasSkill(player, 'leiji_mou')) {
      if ((player.skillsUsedThisTurn['leiji_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!target || !cardObj || (cardObj.name !== '闪' && cardObj.suit !== 'spade')) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn['leiji_mou'] = 1;
      this.showSkillBanner(player, '雷击');
      this.addLog(`${player.hero.name} 发动【雷击】召唤天雷，对 ${target.hero.name} 造成2点雷电伤害！`, 'damage');
      await this.applyDamage(player, target, 2, 'thunder');
      return;
    }

    // ==================== 志系列 & 新增谋攻篇主动技 ====================
    if (skillId === 'zhenxian_zhi' && hasSkill(player, 'zhenxian_zhi')) {
      if ((player.skillsUsedThisTurn['zhenxian_zhi'] ?? 0) >= 3 || cardIds.length < 1) return;
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!cardObj || player.recastRanksThisTurn.includes(cardObj.rank)) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn['zhenxian_zhi'] = (player.skillsUsedThisTurn['zhenxian_zhi'] ?? 0) + 1;
      player.recastRanksThisTurn.push(cardObj.rank);
      const adjacent = player.lastRecastRank !== undefined && Math.abs(player.lastRecastRank - cardObj.rank) === 1;
      player.lastRecastRank = cardObj.rank;
      this.showSkillBanner(player, '镇舷');
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      if (adjacent) {
        const enemy = this.state.players.find((p) => p.alive && isEnemy(player, p, this.state.mode) && hasAnyCard(p));
        if (enemy) {
          const stolen = await this.pickTargetCard(player, enemy, '镇舷·相邻夺牌', '获得');
          if (stolen) {
            this.giveCardsToPlayer(player, [stolen.card]);
            if (stolen.fromEquip) await this.onLoseEquipment(enemy, stolen.card);
            this.addLog(`${player.hero.name}【镇舷】点数相邻触发，从 ${enemy.hero.name} 夺取1张牌！`, 'skill');
          }
        }
      }
      await this.sleep(300);
      return;
    }

    if (skillId === 'hanzhi_zhi' && hasSkill(player, 'hanzhi_zhi')) {
      if ((player.skillsUsedThisTurn['hanzhi_zhi'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['hanzhi_zhi'] = 1;
      this.showSkillBanner(player, '憾志');
      this.giveCardsToPlayer(target, [c, ...this.drawFromDeck(2)]);
      if (player.hp < player.maxHp) this.healPlayer(player, 1);
      await this.sleep(320);
      return;
    }

    if (skillId === 'beizhi_zhi' && hasSkill(player, 'beizhi_zhi')) {
      if ((player.skillsUsedThisTurn['beizhi_zhi'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['beizhi_zhi'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '悖志');
      const enemies = this.state.players.filter((p) => p.alive && isEnemy(player, p, this.state.mode));
      for (const e of enemies) {
        if (e.hand.length > 0) this.discardCards(e.hand.splice(0, 1));
        else await this.applyDamage(player, e, 1, 'normal');
      }
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(320);
      return;
    }

    if (skillId === 'fangquan_zhi' && hasSkill(player, 'fangquan_zhi')) {
      if ((player.skillsUsedThisTurn['fangquan_zhi'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['fangquan_zhi'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '放权');
      this.giveCardsToPlayer(target, this.drawFromDeck(3));
      this.addLog(`${player.hero.name} 发动【放权】，令 ${target.hero.name} 摸3张牌！`, 'skill');
      await this.sleep(320);
      return;
    }

    if (skillId === 'wengua_zhi' && hasSkill(player, 'wengua_zhi')) {
      if ((player.skillsUsedThisTurn['wengua_zhi'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['wengua_zhi'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '问卦');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      await this.sleep(300);
      return;
    }

    if (skillId === 'tiaoxin_mou' && hasSkill(player, 'tiaoxin_mou')) {
      if ((player.skillsUsedThisTurn['tiaoxin_mou'] ?? 0) >= 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      player.skillsUsedThisTurn['tiaoxin_mou'] = 1;
      this.showSkillBanner(player, '谋·挑衅');
      if (target.hand.length > 0) {
        const [stolen] = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1);
        this.giveCardsToPlayer(player, [stolen]);
      } else {
        await this.applyDamage(player, target, 1, 'normal');
      }
      await this.sleep(300);
      return;
    }

    if (skillId === 'jieyue_mou' && hasSkill(player, 'jieyue_mou')) {
      if ((player.skillsUsedThisTurn['jieyue_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['jieyue_mou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '节钺');
      if (isAlly(player, target, this.state.mode)) {
        this.giveCardsToPlayer(target, this.drawFromDeck(2));
      } else {
        const dropN = Math.min(2, target.hand.length);
        this.discardCards(target.hand.splice(0, dropN));
      }
      await this.sleep(300);
      return;
    }

    if (skillId === 'qiaobian_mou' && hasSkill(player, 'qiaobian_mou')) {
      if ((player.skillsUsedThisTurn['qiaobian_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn['qiaobian_mou'] = 1;
      this.discardCards([c]);
      this.showSkillBanner(player, '巧变');
      if (target.hand.length > 0) {
        const [stolen] = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1);
        this.giveCardsToPlayer(player, [stolen]);
      }
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(300);
      return;
    }

    if (skillId === 'tianyi_mou' && hasSkill(player, 'tianyi_mou')) {
      if ((player.skillsUsedThisTurn['tianyi_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['tianyi_mou'] = 1;
      this.discardCards([c]);
      player.kurouBonusSha += 2;
      this.showSkillBanner(player, '谋·天义');
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(300);
      return;
    }

    if ((skillId === 'qingjian_mou' || skillId === 'mingce_mou') && hasSkill(player, skillId)) {
      if ((player.skillsUsedThisTurn[skillId] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const c = this.removeHandCard(player, cardIds[0]);
      if (!target || !c) return;
      player.skillsUsedThisTurn[skillId] = 1;
      this.showSkillBanner(player, skillId === 'mingce_mou' ? '明策' : '清俭');
      this.giveCardsToPlayer(target, [c, ...this.drawFromDeck(skillId === 'mingce_mou' ? 2 : 0)]);
      if (skillId === 'qingjian_mou') this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(300);
      return;
    }

    if (skillId === 'zaiqi_mou' && hasSkill(player, 'zaiqi_mou')) {
      if ((player.skillsUsedThisTurn['zaiqi_mou'] ?? 0) >= 1 || cardIds.length < 1 || player.hp >= player.maxHp) return;
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!cardObj || !isRedSuit(cardObj.suit)) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn['zaiqi_mou'] = 1;
      this.showSkillBanner(player, '再起');
      this.healPlayer(player, 1);
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(300);
      return;
    }

    if (skillId === 'lieren_mou' && hasSkill(player, 'lieren_mou')) {
      if ((player.skillsUsedThisTurn['lieren_mou'] ?? 0) >= 1 || cardIds.length < 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      const cardObj = player.hand.find((h) => h.id === cardIds[0]);
      if (!target || !cardObj || !isRedSuit(cardObj.suit)) return;
      this.removeHandCard(player, cardObj.id);
      this.discardCards([cardObj]);
      player.skillsUsedThisTurn['lieren_mou'] = 1;
      this.showSkillBanner(player, '烈刃');
      await this.applyDamage(player, target, 1, 'fire');
      if (target.alive && target.hand.length > 0) {
        const [stolen] = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1);
        this.giveCardsToPlayer(player, [stolen]);
      }
      await this.sleep(300);
      return;
    }

    // ==================== 神将 & T0传说专属主动技 ====================
    if (skillId === 'jilue_shen' && hasSkill(player, 'jilue_shen')) {
      if ((player.skillsUsedThisTurn['jilue_shen'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['jilue_shen'] = 1;
      this.discardCards([c]);
      player.luoyiActive = true;
      this.showSkillBanner(player, '极略');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      await this.sleep(320);
      return;
    }

    if ((skillId === 'kuangfeng_shen' || skillId === 'yeyan_shen') && hasSkill(player, skillId)) {
      const need = skillId === 'yeyan_shen' ? 2 : 1;
      if ((player.skillsUsedThisTurn[skillId] ?? 0) >= 1 || cardIds.length < need) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      const dropped: Card[] = [];
      for (let i = 0; i < need; i++) {
        const c = this.removeHandCard(player, cardIds[i]);
        if (c) dropped.push(c);
      }
      if (dropped.length < need) return;
      player.skillsUsedThisTurn[skillId] = 1;
      this.discardCards(dropped);
      const label = skillId === 'yeyan_shen' ? '业炎' : '狂风';
      this.showSkillBanner(player, label);
      this.triggerVfx('fire_slash', `${label}焚天！`, `${player.hero.name} → ${target.hero.name}`, target.id);
      await this.applyDamage(player, target, 2, 'fire');
      return;
    }

    if (skillId === 'poxi_shen' && hasSkill(player, 'poxi_shen')) {
      if ((player.skillsUsedThisTurn['poxi_shen'] ?? 0) >= 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      player.skillsUsedThisTurn['poxi_shen'] = 1;
      this.showSkillBanner(player, '魄袭');
      if (target.hand.length > 0) {
        const n = Math.min(2, target.hand.length);
        this.discardCards(target.hand.splice(0, n));
        this.addLog(`${player.hero.name} 发动【魄袭】，弃置 ${target.hero.name} ${n} 张手牌！`, 'skill');
      } else {
        await this.applyDamage(player, target, 1, 'normal');
      }
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      await this.sleep(320);
      return;
    }

    if (skillId === 'cuike_shen' && hasSkill(player, 'cuike_shen')) {
      if ((player.skillsUsedThisTurn['cuike_shen'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['cuike_shen'] = 1;
      this.discardCards([c]);
      const label = player.hero.id === 'jie_liru' ? '焚城' : '摧克';
      this.showSkillBanner(player, label);
      this.triggerVfx('aoe', `${label}！`, '全体敌方受击');
      const enemies = this.state.players.filter((p) => p.alive && isEnemy(player, p, this.state.mode));
      for (const e of enemies) {
        if (e.alive) await this.applyDamage(player, e, 1, player.hero.id === 'jie_liru' ? 'fire' : 'normal');
        if (this.checkVictory()) return;
      }
      return;
    }

    if (skillId === 'yingba_shen' && hasSkill(player, 'yingba_shen')) {
      if ((player.skillsUsedThisTurn['yingba_shen'] ?? 0) >= 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id && p.maxHp > 1);
      if (!target) return;
      player.skillsUsedThisTurn['yingba_shen'] = 1;
      target.maxHp -= 1;
      if (target.hp > target.maxHp) target.hp = target.maxHp;
      this.showSkillBanner(player, '英霸');
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      this.addLog(`${player.hero.name} 发动【英霸】，削减了 ${target.hero.name} 1点体力上限！`, 'damage');
      await this.sleep(320);
      return;
    }

    if (skillId === 'huishi_shen' && hasSkill(player, 'huishi_shen')) {
      if ((player.skillsUsedThisTurn['huishi_shen'] ?? 0) >= 1) return;
      player.skillsUsedThisTurn['huishi_shen'] = 1;
      this.showSkillBanner(player, '慧识');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      if (player.maxHp < 6) {
        player.maxHp += 1;
        this.healPlayer(player, 1);
      }
      await this.sleep(320);
      return;
    }

    if (skillId === 'qiangxi_shen' && hasSkill(player, 'qiangxi_shen')) {
      if ((player.skillsUsedThisTurn['qiangxi_shen'] ?? 0) >= 1) return;
      const target = this.state.players.find((p) => p.id === targetIds[0] && p.alive && p.id !== player.id);
      if (!target) return;
      player.skillsUsedThisTurn['qiangxi_shen'] = 1;
      this.showSkillBanner(player, '强袭');
      await this.loseHp(player, 1);
      if (player.alive && target.alive) {
        this.triggerVfx('slash', '强袭重击！', `${player.hero.name} → ${target.hero.name}`, target.id);
        await this.applyDamage(player, target, 2, 'normal');
      }
      return;
    }

    if (skillId === 'huashen_jie' && hasSkill(player, 'huashen_jie')) {
      if ((player.skillsUsedThisTurn['huashen_jie'] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn['huashen_jie'] = 1;
      this.discardCards([c]);
      const label = player.hero.id === 'nanhualaoxian' ? '御风' : '化身';
      this.showSkillBanner(player, label);
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
      if (enemy) {
        this.triggerVfx('thunder_slash', `${label}天雷！`, `${player.hero.name} → ${enemy.hero.name}`, enemy.id);
        await this.applyDamage(player, enemy, 1, 'thunder');
      }
      return;
    }

    if ((skillId === 'shanjia_legend' || skillId === 'chenglue_legend') && hasSkill(player, skillId)) {
      if ((player.skillsUsedThisTurn[skillId] ?? 0) >= 1 || cardIds.length < 1) return;
      const c = this.removeHandCard(player, cardIds[0]);
      if (!c) return;
      player.skillsUsedThisTurn[skillId] = 1;
      this.discardCards([c]);
      player.kurouBonusSha += skillId === 'chenglue_legend' ? 2 : 1;
      this.showSkillBanner(player, skillId === 'chenglue_legend' ? '成略' : '缮甲');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      await this.sleep(320);
      return;
    }
  }

  // ==================== CARD EXECUTION ====================

  private async executePlayCard(player: Player, card: Card, target?: Player, asSkill?: string) {
    // 谋黄忠【烈弓】：使用牌或成为其他角色牌的目标后记录花色！
    this.recordLiegongSuit(player, card.suit);
    if (target && target.id !== player.id) {
      this.recordLiegongSuit(target, card.suit);
    }

    // 留赞【奋音】：红黑交替出牌立即摸1张！
    if (hasSkill(player, 'fenyin_legend') && this.state.phase === 'play') {
      const curRed = isRedSuit(card.suit);
      if (player.lastPlayedRed !== undefined && player.lastPlayedRed !== curRed) {
        this.showSkillBanner(player, '奋音');
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
      player.lastPlayedRed = curRed;
    }

    // 骆统【勤政】：每使用2张牌立即摸1张！
    if (hasSkill(player, 'qinzheng_legend') && this.state.phase === 'play') {
      player.cardsPlayedThisTurn += 1;
      if (player.cardsPlayedThisTurn % 2 === 0) {
        this.showSkillBanner(player, '勤政');
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
    }

    // Skill conversion: 龙魂·桃
    if (asSkill === 'longhun_peach' && player.hero.id === 'shen_zhaoyun') {
      this.removeHandCard(player, card.id);
      this.pushTableCard(card, player, player, '龙魂·桃');
      this.discardCards([card]);
      this.showSkillBanner(player, '龙魂');
      this.healPlayer(player, 1);
      await this.sleep(300);
      return;
    }

    // Skill conversion: 奇袭 (过河拆桥)
    if (asSkill === 'qixi' && target) {
      this.removeHandCard(player, card.id);
      this.pushTableCard(card, player, target, '奇袭·拆桥');
      this.discardCards([card]);
      this.showSkillBanner(player, '奇袭');
      await this.resolveChaiQiao(player, target, card);
      return;
    }

    // Skill conversion: 国色 (乐不思蜀)
    if (asSkill === 'guose' && target) {
      this.removeHandCard(player, card.id);
      const virtualLe: Card = { ...card, name: '乐不思蜀', type: 'delay' };
      target.judge.push(virtualLe);
      this.showSkillBanner(player, '国色');
      this.addLog(`${player.hero.name} 发动【国色】，将方块牌当【乐不思蜀】置于 ${target.hero.name} 判定区！`, 'skill');
      await this.sleep(300);
      return;
    }

    // Skill conversion: 断粮 (兵粮寸断)
    if (asSkill === 'duanliang_mou' && target) {
      this.removeHandCard(player, card.id);
      const virtualBing: Card = { ...card, name: '兵粮寸断', type: 'delay' };
      target.judge.push(virtualBing);
      this.showSkillBanner(player, '断粮');
      this.addLog(`${player.hero.name} 发动【断粮】，将黑色牌当【兵粮寸断】置于 ${target.hero.name} 判定区！`, 'skill');
      await this.sleep(300);
      return;
    }

    // Slash or converted Slash
    const isConvertedSlash = asSkill === 'wusheng' || asSkill === 'longdan_sha' || asSkill === 'longhun_sha' || asSkill === 'shoudi_ji';
    const isShenGuanyuHeart = hasSkill(player, 'wushen') && card.suit === 'heart';
    if ((isSlashCard(card) || isConvertedSlash || isShenGuanyuHeart) && target) {
      this.removeHandCard(player, card.id);
      if (asSkill === 'wusheng') this.showSkillBanner(player, '武圣');
      if (asSkill === 'longdan_sha') this.showSkillBanner(player, '龙胆');
      if (asSkill === 'longhun_sha') this.showSkillBanner(player, '龙魂');
      if (asSkill === 'shoudi_ji') this.showSkillBanner(player, '狩敌');
      if (isShenGuanyuHeart && !isSlashCard(card)) this.showSkillBanner(player, '武神');
      const effectiveCard: Card =
        asSkill === 'longhun_sha' ? { ...card, name: '火杀', element: 'fire' } : card;
      this.pushTableCard(effectiveCard, player, target, isConvertedSlash ? '转化杀' : undefined);
      await this.resolveSlash(player, target, effectiveCard, false);
      return;
    }

    // Equip cards
    if (['weapon', 'armor', 'horse_plus', 'horse_minus'].includes(card.type)) {
      this.removeHandCard(player, card.id);
      sound.playClick();
      let old: Card | null = null;
      if (card.type === 'weapon') {
        old = player.equip.weapon;
        player.equip.weapon = card;
      } else if (card.type === 'armor') {
        old = player.equip.armor;
        player.equip.armor = card;
      } else if (card.type === 'horse_plus') {
        old = player.equip.horsePlus;
        player.equip.horsePlus = card;
      } else if (card.type === 'horse_minus') {
        old = player.equip.horseMinus;
        player.equip.horseMinus = card;
      }
      if (old) {
        this.discardCards([old]);
        await this.onLoseEquipment(player, old);
      }
      this.addLog(`${player.hero.name} 装备了【${card.name}】。`, 'normal');
      await this.sleep(260);
      return;
    }

    // Basic non-slash
    if (card.name === '桃') {
      this.removeHandCard(player, card.id);
      this.pushTableCard(card, player, player);
      this.discardCards([card]);
      sound.speak('桃');
      this.healPlayer(player, 1);
      await this.sleep(280);
      return;
    }

    if (card.name === '酒') {
      this.removeHandCard(player, card.id);
      this.pushTableCard(card, player, player);
      this.discardCards([card]);
      player.jiuUsedThisTurn += 1;
      player.jiuActive = true;
      sound.playTrick();
      sound.speak('酒');
      this.triggerVfx('jiu', '饮酒蓄势！', `${player.hero.name} 下张【杀】伤害+1`, player.id);
      this.addFloat(player.id, '酒·伤害+1', 'skill');
      this.addLog(`${player.hero.name} 饮下一坛【酒】，下一张【杀】伤害+1！`, 'normal');
      await this.sleep(360);
      return;
    }

    // Delayed tricks
    if (card.name === '乐不思蜀' || card.name === '兵粮寸断') {
      if (!target) return;
      this.removeHandCard(player, card.id);
      target.judge.push(card);
      sound.playTrick();
      sound.speak(card.name);
      this.addLog(`${player.hero.name} 对 ${target.hero.name} 使用了【${card.name}】。`, 'normal');
      await this.sleep(300);
      return;
    }

    if (card.name === '闪电') {
      this.removeHandCard(player, card.id);
      player.judge.push(card);
      sound.playTrick();
      sound.speak('闪电');
      this.addLog(`${player.hero.name} 挂上了【闪电】！`, 'normal');
      await this.sleep(300);
      return;
    }

    // Normal tricks
    this.removeHandCard(player, card.id);
    this.pushTableCard(card, player, target);
    this.discardCards([card]);
    sound.playTrick();
    sound.speak(card.name);
    const isAoe = card.name === '南蛮入侵' || card.name === '万箭齐发' || card.name === '桃园结义' || card.name === '五谷丰登';
    this.triggerVfx(
      isAoe ? 'aoe' : 'trick',
      card.name,
      target && target.id !== player.id ? `${player.hero.name} → ${target.hero.name}` : player.hero.name,
      target?.id
    );

    // 谋黄月英【集智】：每使用一张普通锦囊牌立即摸1张牌
    if (hasSkill(player, 'jizhi_mou')) {
      this.showSkillBanner(player, '集智');
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
    }

    switch (card.name) {
      case '无中生有': {
        this.addLog(`${player.hero.name} 使用了【无中生有】！`, 'normal');
        if (!(await this.askWuxie(card, player, `${player.hero.name}的【无中生有】`))) {
          const drawn = this.drawFromDeck(2);
          this.giveCardsToPlayer(player, drawn);
          this.addLog(`${player.hero.name} 摸了2张牌。`, 'normal');
        }
        break;
      }
      case '过河拆桥':
        if (target) await this.resolveChaiQiao(player, target, card);
        break;
      case '顺手牵羊':
        if (target) await this.resolveShunShou(player, target, card);
        break;
      case '决斗':
        if (target) {
          this.addLog(`${player.hero.name} 向 ${target.hero.name} 发起【决斗】！`, 'normal');
          if (!(await this.askWuxie(card, target, `对${target.hero.name}的【决斗】`))) {
            await this.resolveDuel(player, target);
          }
        }
        break;
      case '南蛮入侵':
        await this.resolveAOE(player, card, '杀');
        break;
      case '万箭齐发':
        await this.resolveAOE(player, card, '闪');
        break;
      case '桃园结义': {
        this.addLog(`${player.hero.name} 使用了【桃园结义】！`, 'heal');
        const ordered = this.getAlivePlayersFrom(player.seatIndex);
        for (const p of ordered) {
          if (!p.alive || p.hp >= p.maxHp) continue;
          if (await this.askWuxie(card, p, `对${p.hero.name}的【桃园结义】`)) continue;
          this.healPlayer(p, 1);
          await this.sleep(220);
        }
        break;
      }
      case '五谷丰登': {
        const ordered = this.getAlivePlayersFrom(player.seatIndex);
        const pool = this.drawFromDeck(ordered.length);
        this.addLog(`${player.hero.name} 使用了【五谷丰登】，亮出 ${pool.length} 张牌！`, 'normal');
        for (const p of ordered) {
          if (!p.alive || pool.length === 0) continue;
          if (await this.askWuxie(card, p, `对${p.hero.name}的【五谷丰登】`)) continue;
          let picked: Card | undefined;
          if (p.isHuman && !this.state.autoPlay) {
            const res = await this.askPlayer({
              kind: 'wugu',
              playerId: p.id,
              title: '【五谷丰登】选牌',
              subtitle: '请从以下亮出的牌中选择1张收入手牌',
              cards: [...pool],
              canSkip: false,
            });
            const cid = res.selectedCardIds?.[0];
            picked = pool.find((c) => c.id === cid) ?? pool[0];
          } else {
            picked = this.pickBestWuguCard(p, pool);
          }
          if (picked) {
            const idx = pool.findIndex((c) => c.id === picked!.id);
            if (idx >= 0) pool.splice(idx, 1);
            this.giveCardsToPlayer(p, [picked]);
            this.addLog(`${p.hero.name} 从五谷丰登拿走了【${picked.name}】。`, 'normal');
          }
          await this.sleep(220);
        }
        if (pool.length > 0) this.discardCards(pool);
        break;
      }
      case '火攻': {
        if (!target || target.hand.length === 0) break;
        this.addLog(`${player.hero.name} 对 ${target.hero.name} 使用了【火攻】！`, 'normal');
        if (await this.askWuxie(card, target, `对${target.hero.name}的【火攻】`)) break;
        const shown = target.hand[Math.floor(Math.random() * target.hand.length)];
        this.addLog(`${target.hero.name} 展示了 ${suitSymbol(shown.suit)}${rankLabel(shown.rank)} ${shown.name}。`, 'normal');
        const match = player.hand.find((c) => c.suit === shown.suit);
        if (match) {
          this.removeHandCard(player, match.id);
          this.discardCards([match]);
          this.addLog(`${player.hero.name} 弃置同花色牌 ${suitSymbol(match.suit)}${match.name}，火攻成功！`, 'damage');
          await this.applyDamage(player, target, 1, 'fire');
        } else {
          this.addLog(`${player.hero.name} 没有 ${suitSymbol(shown.suit)} 花色的手牌，火攻未生效。`, 'normal');
        }
        break;
      }
    }
    await this.sleep(250);
  }

  private async resolveSlash(attacker: Player, target: Player, card: Card, alreadyDiscarded: boolean) {
    sound.playSlash();
    sound.speak(card.name);
    attacker.shaUsedThisTurn += 1;
    const vfxKind = card.element === 'fire' ? 'fire_slash' : card.element === 'thunder' ? 'thunder_slash' : 'slash';
    this.triggerVfx(vfxKind, card.name, `${attacker.hero.name} → ${target.hero.name}`, target.id);
    await this.sleep(220);

    let dmg = 1;
    let unblockable = false;
    let ignoreArmor =
      attacker.equip.weapon?.name === '青釭剑' ||
      attacker.wuqianActive ||
      !!attacker.xiejiIgnoreArmor ||
      hasSkill(attacker, 'tieji_mou');
    let needShans = hasSkill(attacker, 'wushuang') || attacker.wuqianActive ? 2 : 1;

    if (attacker.jiuActive) {
      dmg += 1;
      attacker.jiuActive = false;
    }
    if (attacker.luoyiActive || hasSkill(attacker, 'luoyi_ji')) {
      dmg += 1;
    }
    // 咆哮 / 极吕布 第2张杀起伤害+1
    if ((hasSkill(attacker, 'paoxiao') || attacker.hero.id === 'ji_lvbu') && attacker.shaUsedThisTurn >= 2) {
      dmg += 1;
      this.showSkillBanner(attacker, attacker.hero.id === 'ji_lvbu' ? '极·无双' : '咆哮');
    }
    // 界黄盖/谋黄盖 苦肉红杀不可闪
    if (attacker.kurouRedUnblockable && isRedSuit(card.suit)) {
      unblockable = true;
    }
    // 谋关羽 义绝目标
    if (attacker.yijueTargetId === target.id) {
      unblockable = true;
      dmg += 1;
    }
    // 极关羽 / 谋华雄 红杀+1伤
    if ((attacker.hero.id === 'ji_guanyu' || hasSkill(attacker, 'yaowu_mou')) && isRedSuit(card.suit)) {
      dmg += 1;
      if (attacker.hero.id === 'ji_guanyu') unblockable = true;
    }
    // 谋马超 铁骑
    if (hasSkill(attacker, 'tieji_mou') && attacker.hp >= target.hp) {
      unblockable = true;
      this.showSkillBanner(attacker, '铁骑');
    }
    // 极马云騄 骋烈：每回合首杀弃目标1张手牌
    if (hasSkill(attacker, 'chenglie_ji') && attacker.shaUsedThisTurn === 1 && target.hand.length > 0) {
      this.showSkillBanner(attacker, '骋烈');
      const [dropped] = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1);
      this.discardCards([dropped]);
      this.addLog(`${attacker.hero.name} 发动【骋烈】，弃置了 ${target.hero.name} 1张手牌！`, 'skill');
    }

    // 志姜维 继志：体力≤2时杀伤+1
    if (hasSkill(attacker, 'jizhi_wei_zhi') && attacker.hp <= 2) {
      dmg += 1;
    }

    // 界徐盛 破军：先破坏敌方防御（弃1~2张手牌），若目标手牌≤你伤害+1
    if (hasSkill(attacker, 'pojun_jie')) {
      this.showSkillBanner(attacker, '破军');
      const breakN = Math.min(2, target.hp, target.hand.length);
      if (breakN > 0) {
        const dropped = target.hand.splice(0, breakN);
        this.discardCards(dropped);
        this.addLog(`${attacker.hero.name} 发动【破军】，击破了 ${target.hero.name} ${breakN} 张防御手牌！`, 'skill');
      }
      if (target.hand.length <= attacker.hand.length) {
        dmg += 1;
        this.addLog(`【破军】目标手牌≤${attacker.hero.name}，此【杀】伤害+1！`, 'skill');
      }
    }

    // 谋黄忠【烈弓（谋）】：真实四花色记录机制！
    let blockedShanSuits: Suit[] = [];
    let mouLiegongTriggered = false;
    if (hasSkill(attacker, 'mou_liegong') && attacker.liegongSuits.length > 0) {
      mouLiegongTriggered = true;
      blockedShanSuits = [...attacker.liegongSuits];
      const revealCount = Math.max(0, attacker.liegongSuits.length - 1);
      this.showSkillBanner(attacker, '烈弓（谋）');
      if (revealCount > 0) {
        const revealed = this.drawFromDeck(revealCount);
        let matched = 0;
        for (const rc of revealed) {
          this.pushTableCard(rc, attacker, target, '烈弓亮牌');
          if (attacker.liegongSuits.includes(rc.suit)) matched += 1;
        }
        this.discardCards(revealed);
        if (matched > 0) dmg += matched;
        this.addLog(
          `${attacker.hero.name} 发动【烈弓（谋）】（已记 ${blockedShanSuits.map(suitSymbol).join('')}），亮出牌堆顶 ${revealed.length} 张牌，命中 ${matched} 张同花色，伤害+${matched}！且封锁对应花色的【闪】！`,
          'skill'
        );
      } else {
        this.addLog(
          `${attacker.hero.name} 发动【烈弓（谋）】，封锁 ${blockedShanSuits.map(suitSymbol).join('')} 花色的【闪】！`,
          'skill'
        );
      }
    }

    // 界黄忠【界·烈弓】
    if (hasSkill(attacker, 'jie_liegong')) {
      const noDodge = target.hand.length <= attacker.hand.length;
      const bonusDmg = target.hp >= attacker.hp;
      if (noDodge || bonusDmg) {
        this.showSkillBanner(attacker, '界·烈弓');
        if (noDodge) unblockable = true;
        if (bonusDmg) dmg += 1;
      }
    }

    // 标黄忠【标·烈弓】
    if (hasSkill(attacker, 'biao_liegong')) {
      if (target.hand.length >= attacker.hp || target.hand.length <= getAttackRange(attacker)) {
        this.showSkillBanner(attacker, '标·烈弓');
        unblockable = true;
      }
    }

    // 无双
    if (hasSkill(attacker, 'wushuang')) {
      this.showSkillBanner(attacker, '无双');
    }

    this.addLog(
      `${attacker.hero.name} 对 ${target.hero.name} 使用了【${card.name}】${dmg > 1 ? `（伤害${dmg}）` : ''}${unblockable ? '（不可闪避）' : ''}！`,
      'normal'
    );

    // Check armor immunity (unless 青釭剑)
    if (!ignoreArmor && target.equip.armor) {
      if (target.equip.armor.name === '仁王盾' && isBlackSuit(card.suit)) {
        this.addFloat(target.id, '仁王盾无效', 'dodge');
        this.addLog(`${target.hero.name} 的【仁王盾】抵消了黑色【杀】！`, 'normal');
        if (!alreadyDiscarded) this.discardCards([card]);
        return;
      }
      if (target.equip.armor.name === '藤甲' && (!card.element || card.element === 'normal')) {
        this.addFloat(target.id, '藤甲免疫', 'dodge');
        this.addLog(`${target.hero.name} 的【藤甲】免疫了普通【杀】！`, 'normal');
        if (!alreadyDiscarded) this.discardCards([card]);
        return;
      }
    }

    let dodged = false;
    if (!unblockable) {
      let shansGot = 0;
      while (shansGot < needShans) {
        // 八卦阵判定
        if (!ignoreArmor && target.equip.armor?.name === '八卦阵') {
          const j = await this.doJudge(target, '八卦阵');
          if (j && isRedSuit(j.suit)) {
            shansGot += 1;
            sound.playDodge();
            this.addFloat(target.id, '八卦·闪', 'dodge');
            this.addLog(`${target.hero.name} 的【八卦阵】判定红色，视为打出【闪】！`, 'normal');
            continue;
          }
        }

        const hasShan = target.hand.some((c) => canActAsShan(target, c) && !blockedShanSuits.includes(c.suit));
        if (!hasShan) break;

        const res = await this.askPlayer({
          kind: 'respond_shan',
          playerId: target.id,
          sourcePlayerId: attacker.id,
          title: `响应 ${attacker.hero.name} 的【${card.name}】`,
          subtitle:
            blockedShanSuits.length > 0
              ? `【烈弓】已封锁 ${blockedShanSuits.map(suitSymbol).join('')}！请打出其他花色【闪】`
              : `请打出 ${needShans - shansGot} 张【闪】来抵消（否则受到 ${dmg} 点伤害）`,
          minCards: 1,
          maxCards: 1,
          blockedSuits: blockedShanSuits,
          canSkip: true,
        });

        if (res.confirmed && res.selectedCardIds && res.selectedCardIds.length > 0) {
          const used = this.removeHandCard(target, res.selectedCardIds[0]);
          if (used) {
            this.pushTableCard(used, target, attacker, '闪避');
            this.discardCards([used]);
            sound.playDodge();
            sound.speak('闪');
            this.triggerVfx('dodge', '闪避！', target.hero.name, target.id);
            this.addFloat(target.id, '闪避', 'dodge');
            this.addLog(`${target.hero.name} 打出了【闪】！`, 'normal');
            // 界赵云 回合外龙胆摸1牌
            if (target.hero.id === 'jie_zhaoyun' && used.name !== '闪' && this.state.players[this.state.currentSeat].id !== target.id) {
              this.showSkillBanner(target, '龙胆');
              this.giveCardsToPlayer(target, this.drawFromDeck(1));
            }
            shansGot += 1;
            continue;
          }
        }
        break;
      }
      if (shansGot >= needShans) dodged = true;
    }

    if (dodged) {
      // 贯石斧强命
      if (attacker.equip.weapon?.name === '贯石斧' && attacker.hand.length >= 2) {
        let triggerGuanshi = false;
        if (attacker.isHuman && !this.state.autoPlay) {
          const res = await this.askPlayer({
            kind: 'guanshi_discard',
            playerId: attacker.id,
            title: '是否发动【贯石斧】？',
            subtitle: '弃置2张手牌，令此【杀】依然造成伤害',
            minCards: 2,
            maxCards: 2,
            canSkip: true,
          });
          if (res.confirmed && res.selectedCardIds && res.selectedCardIds.length === 2) {
            const c1 = this.removeHandCard(attacker, res.selectedCardIds[0]);
            const c2 = this.removeHandCard(attacker, res.selectedCardIds[1]);
            if (c1 && c2) {
              this.discardCards([c1, c2]);
              triggerGuanshi = true;
            }
          }
        } else if (target.hp <= dmg) {
          const dropped = attacker.hand.splice(0, 2);
          this.discardCards(dropped);
          triggerGuanshi = true;
        }
        if (triggerGuanshi) {
          this.addLog(`${attacker.hero.name} 发动【贯石斧】弃2牌强行命中！`, 'skill');
          dodged = false;
        }
      }
    }

    if (dodged) {
      if (mouLiegongTriggered) attacker.liegongSuits = [];
      if (!alreadyDiscarded) this.discardCards([card]);
      return;
    }

    // Hit!
    // 古锭刀：目标空城伤害+1
    if (attacker.equip.weapon?.name === '古锭刀' && target.hand.length === 0) {
      dmg += 1;
      this.addLog(`${attacker.hero.name} 的【古锭刀】触发，伤害+1！`, 'skill');
    }

    // 麒麟弓：拆马
    if (attacker.equip.weapon?.name === '麒麟弓' && (target.equip.horsePlus || target.equip.horseMinus)) {
      const horse = target.equip.horsePlus || target.equip.horseMinus;
      if (horse) {
        if (target.equip.horsePlus?.id === horse.id) target.equip.horsePlus = null;
        else target.equip.horseMinus = null;
        this.discardCards([horse]);
        await this.onLoseEquipment(target, horse);
        this.addLog(`${attacker.hero.name} 的【麒麟弓】射落了 ${target.hero.name} 的【${horse.name}】！`, 'skill');
      }
    }

    const damageCard = alreadyDiscarded ? undefined : card;
    await this.applyDamage(attacker, target, dmg, card.element ?? 'normal', damageCard);
    if (mouLiegongTriggered) attacker.liegongSuits = [];
    if (hasSkill(attacker, 'shoudi_ji') && attacker.alive) {
      this.giveCardsToPlayer(attacker, this.drawFromDeck(1));
    }
    // If Jianxiong didn't pick up the card, discard it
    if (damageCard && !target.hand.some((c) => c.id === damageCard.id)) {
      this.discardCards([damageCard]);
    }
  }

  private async resolveChaiQiao(actor: Player, target: Player, card: Card) {
    this.addLog(`${actor.hero.name} 对 ${target.hero.name} 使用了【过河拆桥】。`, 'normal');
    if (await this.askWuxie(card, target, `对${target.hero.name}的【过河拆桥】`)) return;
    if (!hasAnyCard(target)) return;
    const picked = await this.pickTargetCard(actor, target, '过河拆桥', '弃置');
    if (picked) {
      this.discardCards([picked.card]);
      if (picked.fromEquip) await this.onLoseEquipment(target, picked.card);
      this.addLog(`${actor.hero.name} 弃置了 ${target.hero.name} 的【${picked.card.name}】。`, 'normal');
    }
  }

  private async resolveShunShou(actor: Player, target: Player, card: Card) {
    this.addLog(`${actor.hero.name} 对 ${target.hero.name} 使用了【顺手牵羊】。`, 'normal');
    if (await this.askWuxie(card, target, `对${target.hero.name}的【顺手牵羊】`)) return;
    if (!hasAnyCard(target)) return;
    const picked = await this.pickTargetCard(actor, target, '顺手牵羊', '获得');
    if (picked) {
      this.giveCardsToPlayer(actor, [picked.card]);
      if (picked.fromEquip) await this.onLoseEquipment(target, picked.card);
      this.addLog(`${actor.hero.name} 顺走了 ${target.hero.name} 的1张牌${picked.fromEquip ? `（【${picked.card.name}】）` : ''}。`, 'normal');
    }
  }

  private async pickTargetCard(
    actor: Player,
    target: Player,
    title: string,
    verb: string
  ): Promise<{ card: Card; fromEquip: boolean } | null> {
    if (actor.isHuman && !this.state.autoPlay) {
      const res = await this.askPlayer({
        kind: 'pick_card_from_target',
        playerId: actor.id,
        targetPlayerId: target.id,
        title: `【${title}】选择目标牌`,
        subtitle: `请选择要${verb} ${target.hero.name} 的一张牌`,
        canSkip: false,
      });
      if (res.selectedZone === 'hand' && target.hand.length > 0) {
        const idx = Math.floor(Math.random() * target.hand.length);
        const [c] = target.hand.splice(idx, 1);
        return { card: c, fromEquip: false };
      }
      if (res.selectedZone === 'weapon' && target.equip.weapon) {
        const c = target.equip.weapon;
        target.equip.weapon = null;
        return { card: c, fromEquip: true };
      }
      if (res.selectedZone === 'armor' && target.equip.armor) {
        const c = target.equip.armor;
        target.equip.armor = null;
        return { card: c, fromEquip: true };
      }
      if (res.selectedZone === 'horsePlus' && target.equip.horsePlus) {
        const c = target.equip.horsePlus;
        target.equip.horsePlus = null;
        return { card: c, fromEquip: true };
      }
      if (res.selectedZone === 'horseMinus' && target.equip.horseMinus) {
        const c = target.equip.horseMinus;
        target.equip.horseMinus = null;
        return { card: c, fromEquip: true };
      }
      if (res.selectedZone === 'judge' && target.judge.length > 0) {
        const idx = target.judge.findIndex((j) => j.id === res.selectedZoneCardId);
        const [c] = target.judge.splice(idx >= 0 ? idx : 0, 1);
        return { card: c, fromEquip: false };
      }
    }

    // AI priority: if ally has 乐不思蜀/兵粮寸断, remove it!
    if (isAlly(actor, target, this.state.mode) && target.judge.length > 0) {
      const [c] = target.judge.splice(0, 1);
      return { card: c, fromEquip: false };
    }
    // Against enemy: armor/horsePlus -> weapon -> hand -> judge
    if (target.equip.armor) {
      const c = target.equip.armor;
      target.equip.armor = null;
      return { card: c, fromEquip: true };
    }
    if (target.equip.horsePlus) {
      const c = target.equip.horsePlus;
      target.equip.horsePlus = null;
      return { card: c, fromEquip: true };
    }
    if (target.hand.length > 0) {
      const idx = Math.floor(Math.random() * target.hand.length);
      const [c] = target.hand.splice(idx, 1);
      return { card: c, fromEquip: false };
    }
    if (target.equip.weapon) {
      const c = target.equip.weapon;
      target.equip.weapon = null;
      return { card: c, fromEquip: true };
    }
    if (target.equip.horseMinus) {
      const c = target.equip.horseMinus;
      target.equip.horseMinus = null;
      return { card: c, fromEquip: true };
    }
    if (target.judge.length > 0) {
      const [c] = target.judge.splice(0, 1);
      return { card: c, fromEquip: false };
    }
    return null;
  }

  private async resolveDuel(source: Player, target: Player) {
    let responder = target;
    let challenger = source;
    while (responder.alive && challenger.alive) {
      const needCount = challenger.hero.id === 'jie_lvbu' ? 2 : 1;
      let paid = 0;
      while (paid < needCount) {
        const hasSha = responder.hand.some((c) => canActAsSlash(responder, c));
        if (!hasSha) break;
        const res = await this.askPlayer({
          kind: 'respond_sha',
          playerId: responder.id,
          sourcePlayerId: challenger.id,
          title: `与 ${challenger.hero.name} 【决斗】`,
          subtitle: `请打出 ${needCount - paid} 张【杀】，否则受到伤害`,
          minCards: 1,
          maxCards: 1,
          canSkip: true,
        });
        if (res.confirmed && res.selectedCardIds?.[0]) {
          const c = this.removeHandCard(responder, res.selectedCardIds[0]);
          if (c) {
            this.pushTableCard(c, responder, challenger, '决斗·杀');
            this.discardCards([c]);
            sound.playSlash();
            paid += 1;
            continue;
          }
        }
        break;
      }
      if (paid < needCount) {
        const dmg = 1 + (challenger.luoyiActive ? 1 : 0);
        await this.applyDamage(challenger, responder, dmg, 'normal');
        return;
      }
      // Swap roles
      const tmp = responder;
      responder = challenger;
      challenger = tmp;
    }
  }

  private async resolveAOE(source: Player, card: Card, needName: '杀' | '闪') {
    this.addLog(`${source.hero.name} 发动了全场锦囊【${card.name}】！`, 'normal');
    const ordered = this.getAlivePlayersFrom(source.seatIndex).filter((p) => p.id !== source.id);
    for (const target of ordered) {
      if (!target.alive) continue;
      if (target.equip.armor?.name === '藤甲') {
        this.addFloat(target.id, '藤甲免疫', 'dodge');
        this.addLog(`${target.hero.name} 的【藤甲】免疫了【${card.name}】！`, 'normal');
        continue;
      }
      if (await this.askWuxie(card, target, `对${target.hero.name}的【${card.name}】`)) continue;

      let dodged = false;
      if (needName === '闪' && target.equip.armor?.name === '八卦阵') {
        const j = await this.doJudge(target, '八卦阵');
        if (j && isRedSuit(j.suit)) {
          dodged = true;
          sound.playDodge();
          this.addFloat(target.id, '八卦·闪', 'dodge');
        }
      }

      if (!dodged) {
        const canRespond =
          needName === '杀'
            ? target.hand.some((c) => canActAsSlash(target, c))
            : target.hand.some((c) => canActAsShan(target, c));
        if (canRespond) {
          const res = await this.askPlayer({
            kind: needName === '杀' ? 'respond_sha' : 'respond_shan',
            playerId: target.id,
            sourcePlayerId: source.id,
            title: `响应【${card.name}】`,
            subtitle: `请打出1张【${needName}】，否则受到1点伤害`,
            minCards: 1,
            maxCards: 1,
            canSkip: true,
          });
          if (res.confirmed && res.selectedCardIds?.[0]) {
            const c = this.removeHandCard(target, res.selectedCardIds[0]);
            if (c) {
              this.pushTableCard(c, target, undefined, `响应${card.name}`);
              this.discardCards([c]);
              if (needName === '闪') sound.playDodge();
              else sound.playSlash();
              this.addFloat(target.id, `打出${needName}`, 'dodge');
              dodged = true;
            }
          }
        }
      }

      if (!dodged) {
        await this.applyDamage(source, target, 1, 'normal');
        if (this.checkVictory()) return;
      }
      await this.sleep(240);
    }
  }

  private async askWuxie(trickCard: Card, target: Player, desc: string): Promise<boolean> {
    const isHarmful = ['过河拆桥', '顺手牵羊', '南蛮入侵', '万箭齐发', '决斗', '火攻', '乐不思蜀', '兵粮寸断', '闪电'].includes(
      trickCard.name
    );

    const alive = this.getAlivePlayersFrom(this.state.currentSeat);
    for (const p of alive) {
      const wuxieCard = p.hand.find((c) => canActAsWuxie(p, c));
      if (!wuxieCard) continue;

      if (p.isHuman && !this.state.autoPlay) {
        // Only prompt human if relevant (harmful to ally/self OR beneficial to enemy)
        const allyTarget = isAlly(p, target, this.state.mode);
        const worthAsking = (isHarmful && allyTarget) || (!isHarmful && !allyTarget);
        if (!worthAsking) continue;

        const res = await this.askPlayer({
          kind: 'respond_wuxie',
          playerId: p.id,
          title: '是否打出【无懈可击】？',
          subtitle: `抵消 ${desc}`,
          minCards: 1,
          maxCards: 1,
          canSkip: true,
        });
        if (res.confirmed && res.selectedCardIds?.[0]) {
          const used = this.removeHandCard(p, res.selectedCardIds[0]);
          if (used) {
            this.pushTableCard(used, p, target, '无懈可击');
            this.discardCards([used]);
            sound.playTrick();
            sound.speak('无懈可击');
            this.addFloat(target.id, '无懈可击！', 'wuxie');
            this.addLog(`${p.hero.name} 打出【无懈可击】，抵消了 ${desc}！`, 'skill');
            await this.sleep(320);
            return true;
          }
        }
      } else {
        // Human-like consideration before countering with 无懈可击
        const allyTarget = isAlly(p, target, this.state.mode);
        const shouldNegate =
          (isHarmful && allyTarget && (trickCard.name === '乐不思蜀' || trickCard.name === '决斗' || target.hp <= 2 || Math.random() < 0.65)) ||
          (trickCard.name === '无中生有' && !allyTarget && Math.random() < 0.85);
        if (shouldNegate) {
          await this.humanPause(950, 1550);
          this.removeHandCard(p, wuxieCard.id);
          this.pushTableCard(wuxieCard, p, target, '无懈可击');
          this.discardCards([wuxieCard]);
          sound.playTrick();
          sound.speak('无懈可击');
          this.addFloat(target.id, '无懈可击！', 'wuxie');
          this.addLog(`${p.hero.name} 打出【无懈可击】，抵消了 ${desc}！`, 'skill');
          await this.sleep(320);
          return true;
        }
      }
    }
    return false;
  }

  // ==================== DAMAGE, HEAL, DYING ====================

  private healPlayer(player: Player, amount: number) {
    if (!player.alive) return;
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + amount);
    if (player.hp > before) {
      sound.playHeal();
      this.triggerVfx('heal', `体力 +${player.hp - before}`, player.hero.name, player.id);
      this.addFloat(player.id, `+${player.hp - before} 体力`, 'heal');
    }
    this.emit();
  }

  private async loseHp(player: Player, amount: number) {
    if (!player.alive) return;
    player.hp -= amount;
    sound.playDamage();
    this.triggerHitFlash(player.id, amount, 'normal');
    this.addFloat(player.id, `-${amount} 体力`, 'damage');
    this.emit();
    if (player.hp <= 0) {
      await this.handleDying(player, null);
    }
  }

  private async onLoseEquipment(player: Player, equipCard: Card) {
    if (equipCard.name === '白银狮子' && player.alive && player.hp < player.maxHp) {
      this.healPlayer(player, 1);
      this.addLog(`${player.hero.name} 失去【白银狮子】，回复1点体力！`, 'heal');
    }
    if (player.hero.id === 'sunshangxiang' && player.alive) {
      this.showSkillBanner(player, '枭姬');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      this.addLog(`${player.hero.name} 发动【枭姬】，摸了2张牌！`, 'skill');
    }
  }

  private async applyDamage(
    source: Player | null,
    target: Player,
    rawAmount: number,
    element: 'normal' | 'fire' | 'thunder',
    damageCard?: Card
  ) {
    if (!target.alive || rawAmount <= 0) return;
    let amount = rawAmount;

    // 藤甲火伤+1
    if (element === 'fire' && target.equip.armor?.name === '藤甲') {
      amount += 1;
      this.addLog(`${target.hero.name} 身穿【藤甲】，火焰伤害+1！`, 'damage');
    }
    // 白银狮子最多受1伤
    if (target.equip.armor?.name === '白银狮子' && amount > 1) {
      amount = 1;
      this.addLog(`${target.hero.name} 的【白银狮子】将伤害降至1点！`, 'normal');
    }

    target.hp -= amount;
    if (source) {
      source.damageDealt += amount;
      // 神吕布狂暴
      if (source.hero.id === 'shen_lvbu') {
        source.wrathMarks += amount;
      }
    }
    if (target.hero.id === 'shen_lvbu') {
      target.wrathMarks += amount;
    }

    sound.playDamage();
    this.triggerHitFlash(target.id, amount, element);
    this.addFloat(target.id, `-${amount}`, 'damage');
    this.addLog(
      `${target.hero.name} 受到${source ? `来自 ${source.hero.name} 的 ` : ''}${amount} 点${element === 'fire' ? '火焰' : element === 'thunder' ? '雷电' : ''}伤害！（剩余体力 ${target.hp}/${target.maxHp}）`,
      'damage'
    );
    this.emit();
    await this.sleep(320);

    if (target.hp <= 0) {
      await this.handleDying(target, source);
    }

    if (!target.alive) return;

    // On-damaged trigger skills!
    // 奸雄 (界曹操/谋曹操/极曹操)
    if (hasSkill(target, 'jianxiong')) {
      this.showSkillBanner(target, target.hero.id === 'ji_caocao' ? '极·奸雄' : '奸雄');
      if (damageCard) {
        this.giveCardsToPlayer(target, [damageCard]);
      }
      const drawN = target.hero.id === 'ji_caocao' ? 2 : 1;
      this.giveCardsToPlayer(target, this.drawFromDeck(drawN));
      this.addLog(`${target.hero.name} 发动【奸雄】${damageCard ? `获得【${damageCard.name}】并` : ''}摸${drawN}张牌！`, 'skill');
    }

    // 反馈 (司马懿/谋司马懿/极司马懿)
    if (hasSkill(target, 'fankui') && source && source.alive && source.id !== target.id && hasAnyCard(source)) {
      this.showSkillBanner(target, '反馈');
      const stolen = await this.pickTargetCard(target, source, '反馈', '获得');
      if (stolen) {
        this.giveCardsToPlayer(target, [stolen.card]);
        if (stolen.fromEquip) await this.onLoseEquipment(source, stolen.card);
        if (target.hero.id === 'ji_simayi') this.giveCardsToPlayer(target, this.drawFromDeck(1));
        this.addLog(`${target.hero.name} 发动【反馈】，获得了 ${source.hero.name} 的1张牌！`, 'skill');
      }
    }

    // 遗计 (界郭嘉/谋郭嘉/极郭嘉)
    if (hasSkill(target, 'yiji')) {
      this.showSkillBanner(target, target.hero.id === 'ji_guojia' ? '极·遗计' : '遗计');
      const perDmg = target.hero.id === 'ji_guojia' ? 3 : 2;
      const drawn = this.drawFromDeck(perDmg * amount);
      const ally = this.state.players.find((p) => p.alive && p.id !== target.id && isAlly(target, p, this.state.mode));
      if (ally && (!target.isHuman || this.state.autoPlay)) {
        const half = Math.ceil(drawn.length / 2);
        this.giveCardsToPlayer(ally, drawn.slice(0, half));
        this.giveCardsToPlayer(target, drawn.slice(half));
        this.addLog(`${target.hero.name} 发动【遗计】摸 ${drawn.length} 牌，将 ${half} 张分给队友 ${ally.hero.name}！`, 'skill');
      } else {
        this.giveCardsToPlayer(target, drawn);
        this.addLog(`${target.hero.name} 发动【遗计】，摸了 ${drawn.length} 张牌！`, 'skill');
      }
    }

    // 谋法正 恩怨
    if (hasSkill(target, 'enyuan_mou') && source && source.alive && source.id !== target.id) {
      this.showSkillBanner(target, '恩怨');
      if (source.hand.length > 0) {
        const [given] = source.hand.splice(0, 1);
        this.giveCardsToPlayer(target, [given]);
        this.addLog(`${source.hero.name} 因【恩怨】交给了 ${target.hero.name} 1张牌！`, 'skill');
      } else {
        await this.loseHp(source, 1);
      }
    }

    // 谋荀彧 节命
    if (hasSkill(target, 'jieming_mou')) {
      this.showSkillBanner(target, '节命');
      const ally = this.state.players.find((p) => p.alive && isAlly(target, p, this.state.mode));
      if (ally) this.giveCardsToPlayer(ally, this.drawFromDeck(2));
    }

    // 谋曹丕 放逐
    if (hasSkill(target, 'fangzhu_mou') && source && source.alive && source.id !== target.id) {
      this.showSkillBanner(target, '放逐');
      if (source.hand.length >= 2) {
        this.discardCards(source.hand.splice(0, 2));
        this.addLog(`${source.hero.name} 因【放逐】弃置2张手牌！`, 'skill');
      } else {
        this.discardCards(source.hand.splice(0, source.hand.length));
        await this.loseHp(source, 1);
      }
    }

    // 谋庞统 涅槃 / 谋大乔 婉容 / 谋小乔 天香
    if (hasSkill(target, 'niepan_mou') || hasSkill(target, 'wanrong_mou')) {
      this.giveCardsToPlayer(target, this.drawFromDeck(1));
    }
    if (hasSkill(target, 'tianxiang_mou')) {
      this.showSkillBanner(target, '天香');
      this.giveCardsToPlayer(target, this.drawFromDeck(2));
    }

    // 神曹操 归心：每受1点伤害夺取全场每人1张牌！
    if (hasSkill(target, 'guixin_shen')) {
      this.showSkillBanner(target, '归心');
      for (const other of this.state.players) {
        if (other.alive && other.id !== target.id && other.hand.length > 0) {
          const [stolen] = other.hand.splice(Math.floor(Math.random() * other.hand.length), 1);
          this.giveCardsToPlayer(target, [stolen]);
        }
      }
      this.addLog(`${target.hero.name} 发动【归心】，从全场每名角色处各夺取1张牌！`, 'skill');
    }

    // 界魏延 狂骨：对距离1以内敌人造成伤害回复1血或摸1牌
    if (source && source.alive && hasSkill(source, 'kuanggu_legend') && getDistance(this.state.players, source, target) <= 1) {
      this.showSkillBanner(source, '狂骨');
      if (source.hp < source.maxHp) this.healPlayer(source, 1);
      else this.giveCardsToPlayer(source, this.drawFromDeck(1));
    }

    // 界夏侯惇 刚烈
    if (hasSkill(target, 'ganglie') && source && source.alive && source.id !== target.id) {
      this.showSkillBanner(target, '刚烈');
      const j = await this.doJudge(target, '刚烈');
      if (j && j.suit !== 'heart') {
        if (source.hand.length >= 2 && (!source.isHuman || this.state.autoPlay)) {
          const dropped = source.hand.splice(0, 2);
          this.discardCards(dropped);
          this.addLog(`${source.hero.name} 因【刚烈】弃置了2张手牌！`, 'normal');
        } else {
          this.addLog(`【刚烈】生效！${source.hero.name} 受到1点伤害！`, 'damage');
          await this.applyDamage(target, source, 1, 'normal');
        }
      }
    }
  }

  private async handleDying(target: Player, killer: Player | null) {
    this.addLog(`⚠️ ${target.hero.name} 进入濒死状态！请求救援！`, 'death');
    // 神赵云 绝境进入濒死摸1牌
    if (target.hero.id === 'shen_zhaoyun') {
      this.showSkillBanner(target, '绝境');
      this.giveCardsToPlayer(target, this.drawFromDeck(1));
    }

    const ordered = this.getAlivePlayersFrom(this.state.currentSeat);
    while (target.hp <= 0 && !this.aborted) {
      let rescued = false;
      for (const helper of ordered) {
        if (!helper.alive) continue;
        const isSelf = helper.id === target.id;
        const isOwnTurn = this.state.players[this.state.currentSeat].id === helper.id;
        const canSave = helper.hand.some(
          (c) => canActAsPeach(helper, c, isOwnTurn) || (isSelf && c.name === '酒')
        );
        if (!canSave) continue;

        // Don't bother asking enemies unless human wants to
        if (!isAlly(helper, target, this.state.mode) && (!helper.isHuman || this.state.autoPlay)) continue;

        const res = await this.askPlayer({
          kind: 'respond_peach',
          playerId: helper.id,
          targetPlayerId: target.id,
          title: `${target.hero.name} 濒死求桃！`,
          subtitle: isSelf ? '请打出【桃】或【酒】自救' : `是否打出【桃】救援 ${target.hero.name}？`,
          minCards: 1,
          maxCards: 1,
          canSkip: true,
        });

        if (res.confirmed && res.selectedCardIds?.[0]) {
          const c = this.removeHandCard(helper, res.selectedCardIds[0]);
          if (c) {
            this.pushTableCard(c, helper, target, isSelf ? '自救' : '救人');
            this.discardCards([c]);
            sound.speak(c.name === '酒' ? '酒' : '桃');
            this.healPlayer(target, 1);
            this.addLog(`${helper.hero.name} 打出【${c.name}】救了 ${target.hero.name} 一命！`, 'heal');
            rescued = true;
            if (target.hp > 0) break;
          }
        }
      }
      if (!rescued) break;
    }

    if (target.hp > 0) {
      if (target.hero.id === 'shen_zhaoyun') {
        this.giveCardsToPlayer(target, this.drawFromDeck(1));
      }
      return;
    }

    // Player dies!
    target.alive = false;
    target.identityRevealed = true;
    const allCards: Card[] = [...target.hand, ...target.judge];
    if (target.equip.weapon) allCards.push(target.equip.weapon);
    if (target.equip.armor) allCards.push(target.equip.armor);
    if (target.equip.horsePlus) allCards.push(target.equip.horsePlus);
    if (target.equip.horseMinus) allCards.push(target.equip.horseMinus);
    target.hand = [];
    target.judge = [];
    target.equip = { weapon: null, armor: null, horsePlus: null, horseMinus: null };
    this.discardCards(allCards);

    if (killer) killer.kills += 1;
    sound.speak(`${target.hero.name}阵亡`);
    this.addLog(`💀 ${target.hero.name} 阵亡！${killer ? `（击杀者：${killer.hero.name}）` : ''}`, 'death');
    this.emit();

    if (this.checkVictory()) return;

    // 2v2 Official Rule: Surviving teammate draws 1 card when teammate dies!
    if (this.state.mode === '2v2') {
      const teammate = this.state.players.find((p) => p.alive && p.team === target.team);
      if (teammate) {
        this.giveCardsToPlayer(teammate, this.drawFromDeck(1));
        this.addFloat(teammate.id, '队友阵亡 +1牌', 'info');
        this.addLog(`【2v2规则】队友阵亡，${teammate.hero.name} 悲愤摸1张牌！`, 'system');
      }
    } else if (this.state.mode === 'landlord' && target.identity === 'peasant') {
      const otherPeasant = this.state.players.find((p) => p.alive && p.identity === 'peasant');
      if (otherPeasant) {
        this.giveCardsToPlayer(otherPeasant, this.drawFromDeck(2));
        this.addLog(`【斗地主规则】队友阵亡，${otherPeasant.hero.name} 摸2张牌！`, 'system');
      }
    } else if (this.state.mode === 'identity5' && killer && killer.alive) {
      if (target.identity === 'rebel') {
        this.giveCardsToPlayer(killer, this.drawFromDeck(3));
        this.addLog(`${killer.hero.name} 击杀反贼，奖励摸3张牌！`, 'system');
      }
    }
  }

  private async handleDiscardPhase(player: Player) {
    const limit = getHandLimit(player);
    const excess = player.hand.length - limit;
    if (excess <= 0) return;

    if (player.isHuman && !this.state.autoPlay) {
      const res = await this.askPlayer({
        kind: 'discard',
        playerId: player.id,
        title: `弃牌阶段（手牌上限 ${limit}）`,
        subtitle: `请弃置 ${excess} 张手牌`,
        minCards: excess,
        maxCards: excess,
        canSkip: false,
      });
      const ids = res.selectedCardIds ?? [];
      const dropped: Card[] = [];
      for (const id of ids) {
        const c = this.removeHandCard(player, id);
        if (c) dropped.push(c);
      }
      while (player.hand.length > limit) {
        const c = player.hand.pop();
        if (c) dropped.push(c);
      }
      this.discardCards(dropped);
      this.addLog(`${player.hero.name} 弃置了 ${dropped.length} 张牌。`, 'normal');
    } else {
      // AI keeps valuable cards (桃 > 闪 > 无懈 > 杀 > others)
      const keepScore = (c: Card) => {
        if (c.name === '桃') return 100;
        if (c.name === '闪') return 80;
        if (c.name === '无懈可击') return 75;
        if (c.name === '酒') return 65;
        if (isSlashCard(c)) return 55;
        return 20;
      };
      player.hand.sort((a, b) => keepScore(a) - keepScore(b));
      const dropped = player.hand.splice(0, excess);
      this.discardCards(dropped);
      this.addLog(`${player.hero.name} 弃置了 ${dropped.length} 张牌。`, 'normal');
    }
    await this.sleep(260);
  }

  private async handleEndPhase(player: Player) {
    // 闭月 (界貂蝉/谋貂蝉/极貂蝉)
    if (hasSkill(player, 'biyue') && player.alive) {
      this.showSkillBanner(player, '闭月');
      const n =
        player.hero.id === 'mou_diaochan' || player.hero.id === 'ji_diaochan'
          ? 2
          : player.hand.length === 0
            ? 2
            : 1;
      this.giveCardsToPlayer(player, this.drawFromDeck(n));
      this.addLog(`${player.hero.name} 发动【闭月】，摸了 ${n} 张牌！`, 'skill');
      await this.sleep(300);
    }
    // 谋陆逊 连营
    if (hasSkill(player, 'lianying_mou') && player.alive) {
      const n = player.hand.length === 0 ? 3 : 1;
      this.showSkillBanner(player, '连营');
      this.giveCardsToPlayer(player, this.drawFromDeck(n));
      await this.sleep(260);
    }
    // 谋姜维 志继
    if (hasSkill(player, 'zhiji_mou') && player.alive && player.hand.length <= 1) {
      this.showSkillBanner(player, '志继');
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
      this.healPlayer(player, 1);
      await this.sleep(260);
    }
    // 谋曹仁 谋·据守 / 谋郭淮 精策
    if ((hasSkill(player, 'jushou_mou') || hasSkill(player, 'jingce_mou')) && player.alive) {
      this.giveCardsToPlayer(player, this.drawFromDeck(2));
    }
    // 谋夏侯氏 樵拾 / 志夏侯徽 宜室
    if ((hasSkill(player, 'qiaoshi_mou') || hasSkill(player, 'yishi_zhi')) && player.alive) {
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
      const ally = this.state.players.find((p) => p.alive && p.id !== player.id && isAlly(player, p, this.state.mode));
      if (ally) this.giveCardsToPlayer(ally, this.drawFromDeck(1));
    }
    // 志徐氏 伏诛
    if (hasSkill(player, 'fuzhu_zhi') && player.alive && player.hand.length >= 3) {
      const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
      if (enemy) {
        this.showSkillBanner(player, '伏诛');
        await this.applyDamage(player, enemy, 1, 'normal');
      }
    }
    // 神周瑜 琴音
    if (hasSkill(player, 'qinyin_shen') && player.alive) {
      this.showSkillBanner(player, '琴音');
      if (player.hp < player.maxHp) {
        this.healPlayer(player, 1);
        const ally = this.state.players.find((p) => p.alive && p.id !== player.id && isAlly(player, p, this.state.mode));
        if (ally && ally.hp < ally.maxHp) this.healPlayer(ally, 1);
      } else {
        this.giveCardsToPlayer(player, this.drawFromDeck(1));
      }
    }
    // 其他结束阶段摸1牌 (谋吕蒙/谋贾诩/谋大乔/谋郭嘉)
    if (
      player.alive &&
      (hasSkill(player, 'keji_mou') ||
        hasSkill(player, 'weimu_mou') ||
        hasSkill(player, 'wanrong_mou') ||
        player.hero.id === 'mou_guojia')
    ) {
      this.giveCardsToPlayer(player, this.drawFromDeck(1));
    }
  }

  private getAlivePlayersFrom(startSeat: number): Player[] {
    const n = this.state.players.length;
    const res: Player[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.state.players[(startSeat + i) % n];
      if (p && p.alive) res.push(p);
    }
    return res;
  }

  // ==================== SMART AI ====================

  private resolvePromptByAI(prompt: Omit<PendingPrompt, 'id' | 'resolve'>): PromptResult {
    const p = this.state.players.find((pl) => pl.id === prompt.playerId);
    if (!p) return { confirmed: false };

    if (prompt.kind === 'respond_shan') {
      const blocked = prompt.blockedSuits ?? [];
      const c = p.hand.find((card) => canActAsShan(p, card) && !blocked.includes(card.suit));
      return c ? { confirmed: true, selectedCardIds: [c.id] } : { confirmed: false };
    }
    if (prompt.kind === 'respond_sha') {
      const c = p.hand.find((card) => canActAsSlash(p, card));
      return c ? { confirmed: true, selectedCardIds: [c.id] } : { confirmed: false };
    }
    if (prompt.kind === 'respond_peach') {
      const isSelf = prompt.targetPlayerId === p.id;
      const isOwnTurn = this.state.players[this.state.currentSeat].id === p.id;
      const c = p.hand.find((card) => canActAsPeach(p, card, isOwnTurn) || (isSelf && card.name === '酒'));
      return c ? { confirmed: true, selectedCardIds: [c.id] } : { confirmed: false };
    }
    if (prompt.kind === 'discard') {
      const count = prompt.minCards ?? 1;
      const ids = p.hand.slice(0, count).map((c) => c.id);
      return { confirmed: true, selectedCardIds: ids };
    }
    if (prompt.kind === 'wugu' && prompt.cards?.length) {
      const best = this.pickBestWuguCard(p, prompt.cards);
      return { confirmed: true, selectedCardIds: [best.id] };
    }
    return { confirmed: false };
  }

  private pickBestWuguCard(p: Player, pool: Card[]): Card {
    const score = (c: Card) => {
      if (c.name === '桃') return p.hp < p.maxHp ? 100 : 75;
      if (c.name === '无中生有') return 90;
      if (c.name === '顺手牵羊' || c.name === '乐不思蜀') return 80;
      if (c.name === '过河拆桥' || c.name === '南蛮入侵' || c.name === '万箭齐发') return 70;
      if (isSlashCard(c)) return 55;
      if (c.name === '闪') return 50;
      return 30;
    };
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  }

  private pickBestEnemy(actor: Player, candidates: Player[]): Player | undefined {
    const enemies = candidates.filter((t) => isEnemy(actor, t, this.state.mode));
    if (enemies.length === 0) return undefined;
    // Prioritize lowest HP enemy (focus fire in 2v2!)
    return [...enemies].sort((a, b) => a.hp - b.hp || a.hand.length - b.hand.length)[0];
  }

  private async runAIPlayPhase(player: Player) {
    // Natural pause at start of play phase (looking over newly drawn hand)
    await this.humanPause(1200, 1950);

    let safety = 0;
    while (!this.aborted && !this.state.winner && player.alive && safety < 24) {
      safety++;
      if (safety > 1) {
        // Variable human thinking pause between actions
        await this.humanPause(1300, 2250);
      }
      if (this.aborted || this.state.winner || !player.alive) break;

      const pickSpareCard = (excludeNames: CardName[] = ['桃', '无懈可击', '无中生有']): Card | undefined => {
        const spares = player.hand.filter((c) => !excludeNames.includes(c.name));
        const pool = spares.length > 0 ? spares : player.hand;
        return pool[Math.floor(Math.random() * pool.length)];
      };

      // 1. Hero active skills (classic + 谋 + 极 + 神)
      if (hasSkill(player, 'shenfen') && player.wrathMarks >= 4 && (player.skillsUsedThisTurn['shenfen'] ?? 0) < 1) {
        await this.executeActiveSkill(player, 'shenfen', [], []);
        continue;
      }
      if (hasSkill(player, 'kurou') && player.hp >= 2 && player.hand.length >= 1 && (player.skillsUsedThisTurn['kurou'] ?? 0) < 1) {
        const c = pickSpareCard(['桃', '酒']) ?? player.hand[0];
        await this.executeActiveSkill(player, 'kurou', [c.id], []);
        continue;
      }
      if (hasSkill(player, 'zhiheng') && player.hand.length >= 2 && (player.skillsUsedThisTurn['zhiheng'] ?? 0) < 1) {
        const junk = player.hand.filter((c) => c.name !== '桃' && c.name !== '无中生有').map((c) => c.id);
        if (junk.length > 0) {
          await this.executeActiveSkill(player, 'zhiheng', junk, []);
          continue;
        }
      }
      if (hasSkill(player, 'qingnang') && player.hand.length >= 1 && (player.skillsUsedThisTurn['qingnang'] ?? 0) < 1) {
        const hurtAlly = this.state.players.find(
          (p) => p.alive && isAlly(player, p, this.state.mode) && p.hp < p.maxHp
        );
        if (hurtAlly) {
          const c = pickSpareCard() ?? player.hand[0];
          await this.executeActiveSkill(player, 'qingnang', [c.id], [hurtAlly.id]);
          continue;
        }
      }
      if (hasSkill(player, 'rende') && player.hand.length >= 3 && !player.rendeHealedThisTurn) {
        const ally = this.state.players.find((p) => p.alive && p.id !== player.id && isAlly(player, p, this.state.mode));
        if (ally) {
          await this.executeActiveSkill(player, 'rende', [player.hand[0].id, player.hand[1].id], [ally.id]);
          continue;
        }
      }
      if (hasSkill(player, 'fanjian') && player.hand.length >= 2 && (player.skillsUsedThisTurn['fanjian'] ?? 0) < 1) {
        const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
        if (enemy) {
          const c = pickSpareCard() ?? player.hand[0];
          await this.executeActiveSkill(player, 'fanjian', [c.id], [enemy.id]);
          continue;
        }
      }
      // 谋/极 AI主动技
      if (hasSkill(player, 'luanji_mou') && player.hand.length >= 3 && (player.skillsUsedThisTurn['luanji_mou'] ?? 0) < 1) {
        await this.executeActiveSkill(player, 'luanji_mou', [player.hand[0].id, player.hand[1].id], []);
        continue;
      }
      if (hasSkill(player, 'luanwu_mou') && (player.skillsUsedThisTurn['luanwu_mou'] ?? 0) < 1) {
        await this.executeActiveSkill(player, 'luanwu_mou', [], []);
        continue;
      }
      if (hasSkill(player, 'quanmou_mou') && (player.skillsUsedThisTurn['quanmou_mou'] ?? 0) < 1) {
        const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
        if (enemy) {
          await this.executeActiveSkill(player, 'quanmou_mou', [], [enemy.id]);
          continue;
        }
      }
      if ((hasSkill(player, 'lianhuan_mou') || hasSkill(player, 'xieji_mou') || hasSkill(player, 'fenwei_mou')) && player.hand.length >= 1) {
        const sid = hasSkill(player, 'lianhuan_mou') ? 'lianhuan_mou' : hasSkill(player, 'xieji_mou') ? 'xieji_mou' : 'fenwei_mou';
        if ((player.skillsUsedThisTurn[sid] ?? 0) < 1) {
          const c = pickSpareCard() ?? player.hand[0];
          await this.executeActiveSkill(player, sid, [c.id], []);
          continue;
        }
      }
      if ((hasSkill(player, 'huoji_mou') || hasSkill(player, 'ronghuo_mou') || hasSkill(player, 'qianxun_mou'))) {
        const sid = hasSkill(player, 'huoji_mou') ? 'huoji_mou' : hasSkill(player, 'ronghuo_mou') ? 'ronghuo_mou' : 'qianxun_mou';
        const red = player.hand.find((c) => isRedSuit(c.suit) && c.name !== '桃');
        const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
        if (red && enemy && (player.skillsUsedThisTurn[sid] ?? 0) < 1) {
          await this.executeActiveSkill(player, sid, [red.id], [enemy.id]);
          continue;
        }
      }
      if (hasSkill(player, 'leiji_mou') && (player.skillsUsedThisTurn['leiji_mou'] ?? 0) < 1) {
        const c = player.hand.find((h) => h.name === '闪' || h.suit === 'spade');
        const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
        if (c && enemy) {
          await this.executeActiveSkill(player, 'leiji_mou', [c.id], [enemy.id]);
          continue;
        }
      }
      if ((hasSkill(player, 'shensu_mou') || hasSkill(player, 'qingzheng_mou') || hasSkill(player, 'kuangfu_mou')) && player.hand.length >= 2) {
        const sid = hasSkill(player, 'shensu_mou') ? 'shensu_mou' : hasSkill(player, 'qingzheng_mou') ? 'qingzheng_mou' : 'kuangfu_mou';
        const enemy = this.pickBestEnemy(player, this.state.players.filter((p) => p.alive && p.id !== player.id));
        if (enemy && (player.skillsUsedThisTurn[sid] ?? 0) < 1) {
          const c = pickSpareCard() ?? player.hand[0];
          await this.executeActiveSkill(player, sid, [c.id], [enemy.id]);
          continue;
        }
      }
      if (hasSkill(player, 'xuanhuo_mou') && player.hand.length >= 2 && (player.skillsUsedThisTurn['xuanhuo_mou'] ?? 0) < 1) {
        const ally = this.state.players.find((p) => p.alive && p.id !== player.id && isAlly(player, p, this.state.mode));
        if (ally) {
          const c = pickSpareCard() ?? player.hand[0];
          await this.executeActiveSkill(player, 'xuanhuo_mou', [c.id], [ally.id]);
          continue;
        }
      }

      // 2. Playable cards — shuffle scan order slightly so AI behaves naturally like a human player
      let acted = false;
      const handScan = Math.random() < 0.45 ? shuffle(player.hand) : [...player.hand];
      for (const card of handScan) {
        if (!player.alive || this.state.winner) break;

        // Peach if hurt
        if (card.name === '桃' && player.hp < player.maxHp) {
          await this.executePlayCard(player, card, player);
          acted = true;
          break;
        }
        // Equip if slot empty or better weapon
        if (['weapon', 'armor', 'horse_plus', 'horse_minus'].includes(card.type)) {
          const shouldEquip =
            (card.type === 'weapon' && (!player.equip.weapon || (card.range ?? 1) > (player.equip.weapon.range ?? 1))) ||
            (card.type === 'armor' && !player.equip.armor) ||
            (card.type === 'horse_plus' && !player.equip.horsePlus) ||
            (card.type === 'horse_minus' && !player.equip.horseMinus);
          if (shouldEquip) {
            await this.executePlayCard(player, card, player);
            acted = true;
            break;
          }
        }
        // 无中生有 / 五谷丰登
        if (card.name === '无中生有' || card.name === '五谷丰登') {
          await this.executePlayCard(player, card, player);
          acted = true;
          break;
        }
        // 桃园结义 if allies hurt more than enemies
        if (card.name === '桃园结义') {
          const hurtAllies = this.state.players.filter((p) => p.alive && isAlly(player, p, this.state.mode) && p.hp < p.maxHp).length;
          const hurtEnemies = this.state.players.filter((p) => p.alive && isEnemy(player, p, this.state.mode) && p.hp < p.maxHp).length;
          if (hurtAllies > hurtEnemies || player.hp <= 1) {
            await this.executePlayCard(player, card, player);
            acted = true;
            break;
          }
        }
        // AOE
        if (card.name === '南蛮入侵' || card.name === '万箭齐发') {
          const allyLow = this.state.players.some(
            (p) => p.alive && p.id !== player.id && isAlly(player, p, this.state.mode) && p.hp <= 1
          );
          if (!allyLow) {
            await this.executePlayCard(player, card, player);
            acted = true;
            break;
          }
        }
        // Targeted tricks
        if (['过河拆桥', '顺手牵羊', '决斗', '火攻', '乐不思蜀', '兵粮寸断'].includes(card.name)) {
          const valid = getValidTargetsForCard(this.state.players, player, card, this.state.mode);
          const target = this.pickBestEnemy(player, valid);
          if (target) {
            await this.executePlayCard(player, card, target);
            acted = true;
            break;
          }
        }
        // 酒 before 杀
        if (card.name === '酒' && player.jiuUsedThisTurn < 1) {
          const hasSlashReady =
            player.hand.some((c) => canActAsSlash(player, c)) &&
            (hasUnlimitedSlash(player) || player.shaUsedThisTurn < getMaxSlashPerTurn(player, this.state.mode));
          const hasTarget = this.state.players.some(
            (t) => t.alive && isEnemy(player, t, this.state.mode) && getDistance(this.state.players, player, t) <= getAttackRange(player)
          );
          if (hasSlashReady && hasTarget) {
            await this.executePlayCard(player, card, player);
            acted = true;
            break;
          }
        }
        // 杀 (or converted slash)
        if (canActAsSlash(player, card)) {
          if (hasUnlimitedSlash(player, card) || player.shaUsedThisTurn < getMaxSlashPerTurn(player, this.state.mode)) {
            const valid = this.state.players.filter((t) => canTargetWithSlash(this.state.players, player, t, card));
            const target = this.pickBestEnemy(player, valid);
            if (target) {
              const asSkill =
                !isSlashCard(card) && hasSkill(player, 'wusheng')
                  ? 'wusheng'
                  : !isSlashCard(card) && hasSkill(player, 'longdan')
                    ? 'longdan_sha'
                    : !isSlashCard(card) && hasSkill(player, 'longhun')
                      ? 'longhun_sha'
                      : !isSlashCard(card) && hasSkill(player, 'shoudi_ji')
                        ? 'shoudi_ji'
                        : undefined;
              await this.executePlayCard(player, card, target, asSkill);
              acted = true;
              break;
            }
          }
        }
      }

      if (!acted) {
        // Brief natural hesitation before passing turn
        await this.humanPause(850, 1400);
        break;
      }
    }
  }
}
