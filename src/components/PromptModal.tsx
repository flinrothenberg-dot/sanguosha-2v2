import React, { useState } from 'react';
import { Card, GameState, PendingPrompt, PromptResult, Suit } from '../types/game';
import { PlayingCard } from './PlayingCard';
import { suitSymbol } from '../data/deck';
import { isEnemy } from '../engine/rules';

interface PromptModalProps {
  state: GameState;
  prompt: PendingPrompt;
  onSubmit: (res: PromptResult) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ state, prompt, onSubmit }) => {
  const [topIds, setTopIds] = useState<string[]>(() => (prompt.cards ?? []).map((c) => c.id));
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // 1. 过河拆桥 / 顺手牵羊 / 反馈
  if (prompt.kind === 'pick_card_from_target') {
    const target = state.players.find((p) => p.id === prompt.targetPlayerId);
    if (!target) return null;

    return (
      <div style={backdropStyle}>
        <div className="gold-panel" style={modalBoxStyle}>
          <h3 className="font-serif-cn" style={titleStyle}>{prompt.title}</h3>
          <p style={subStyle}>{prompt.subtitle}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Hand */}
            {target.hand.length > 0 && (
              <div>
                <div style={zoneLabelStyle}>手牌区（{target.hand.length} 张）</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {target.hand.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'hand' })}
                      style={{
                        width: 68,
                        height: 94,
                        borderRadius: 8,
                        border: '1.5px solid #e5b963',
                        background: 'linear-gradient(155deg, #451a03, #1c1917)',
                        color: '#fde68a',
                        fontWeight: 900,
                        fontSize: 20,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      杀
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            {(target.equip.weapon || target.equip.armor || target.equip.horsePlus || target.equip.horseMinus) && (
              <div>
                <div style={zoneLabelStyle}>装备区</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {target.equip.weapon && (
                    <PlayingCard
                      card={target.equip.weapon}
                      compact
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'weapon' })}
                    />
                  )}
                  {target.equip.armor && (
                    <PlayingCard
                      card={target.equip.armor}
                      compact
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'armor' })}
                    />
                  )}
                  {target.equip.horsePlus && (
                    <PlayingCard
                      card={target.equip.horsePlus}
                      compact
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'horsePlus' })}
                    />
                  )}
                  {target.equip.horseMinus && (
                    <PlayingCard
                      card={target.equip.horseMinus}
                      compact
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'horseMinus' })}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Judge */}
            {target.judge.length > 0 && (
              <div>
                <div style={zoneLabelStyle}>判定区</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {target.judge.map((jc) => (
                    <PlayingCard
                      key={jc.id}
                      card={jc}
                      compact
                      onClick={() => onSubmit({ confirmed: true, selectedZone: 'judge', selectedZoneCardId: jc.id })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. 观星
  if (prompt.kind === 'guanxing' && prompt.cards) {
    const topCards: Card[] = prompt.cards.filter((c) => topIds.includes(c.id));
    const botCards: Card[] = prompt.cards.filter((c) => !topIds.includes(c.id));

    const toggleCard = (id: string) => {
      setTopIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    return (
      <div style={backdropStyle}>
        <div className="gold-panel" style={modalBoxStyle}>
          <h3 className="font-serif-cn" style={titleStyle}>{prompt.title}</h3>
          <p style={subStyle}>点击卡牌在【牌堆顶（即将摸到）】与【牌堆底】之间切换</p>

          <div style={{ marginTop: 14 }}>
            <div style={zoneLabelStyle}>牌堆顶（优先摸到/判定）— {topCards.length} 张</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minHeight: 112, padding: 8, borderRadius: 10, background: 'rgba(229,185,99,0.08)' }}>
              {topCards.map((c) => (
                <PlayingCard key={c.id} card={c} compact onClick={() => toggleCard(c.id)} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={zoneLabelStyle}>牌堆底 — {botCards.length} 张</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minHeight: 112, padding: 8, borderRadius: 10, background: 'rgba(15,23,42,0.6)' }}>
              {botCards.map((c) => (
                <PlayingCard key={c.id} card={c} compact onClick={() => toggleCard(c.id)} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="gold-btn"
              onClick={() => onSubmit({ confirmed: true, topCards, bottomCards: botCards })}
              style={{ padding: '8px 24px', borderRadius: 9, fontSize: 14 }}
            >
              确定排列
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. 五谷丰登
  if (prompt.kind === 'wugu' && prompt.cards) {
    return (
      <div style={backdropStyle}>
        <div className="gold-panel" style={modalBoxStyle}>
          <h3 className="font-serif-cn" style={titleStyle}>{prompt.title}</h3>
          <p style={subStyle}>{prompt.subtitle}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
            {prompt.cards.map((c) => (
              <PlayingCard
                key={c.id}
                card={c}
                onClick={() => onSubmit({ confirmed: true, selectedCardIds: [c.id] })}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. 周瑜反间猜花色
  if (prompt.kind === 'fanjian_guess') {
    const suits: { id: Suit; label: string; color: string }[] = [
      { id: 'spade', label: '黑桃', color: '#e2e8f0' },
      { id: 'heart', label: '红桃', color: '#f87171' },
      { id: 'club', label: '梅花', color: '#e2e8f0' },
      { id: 'diamond', label: '方块', color: '#f87171' },
    ];
    return (
      <div style={backdropStyle}>
        <div className="gold-panel" style={{ ...modalBoxStyle, maxWidth: 420 }}>
          <h3 className="font-serif-cn" style={titleStyle}>{prompt.title}</h3>
          <p style={subStyle}>{prompt.subtitle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            {suits.map((s) => (
              <button
                key={s.id}
                type="button"
                className="ghost-btn"
                onClick={() => onSubmit({ confirmed: true, selectedSuit: s.id })}
                style={{ padding: '14px', borderRadius: 10, fontSize: 18, fontWeight: 900, color: s.color }}
              >
                {suitSymbol(s.id)} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 5. 张辽突袭选目标
  if (prompt.kind === 'tuxi_targets') {
    const actor = state.players.find((p) => p.id === prompt.playerId);
    const candidates = state.players.filter(
      (p) => p.alive && actor && p.id !== actor.id && p.hand.length > 0
    );
    const toggleTarget = (id: string) => {
      setSelectedTargets((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
      );
    };
    return (
      <div style={backdropStyle}>
        <div className="gold-panel" style={{ ...modalBoxStyle, maxWidth: 500 }}>
          <h3 className="font-serif-cn" style={titleStyle}>{prompt.title}</h3>
          <p style={subStyle}>{prompt.subtitle}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {candidates.map((c) => {
              const sel = selectedTargets.includes(c.id);
              const enemy = actor ? isEnemy(actor, c, state.mode) : true;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleTarget(c.id)}
                  className={sel ? 'gold-btn' : 'ghost-btn'}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 9,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14,
                  }}
                >
                  <span>
                    {c.seatIndex + 1}号位 · {c.hero.name} ({enemy ? '敌方' : '友方'})
                  </span>
                  <span>手牌 {c.hand.length} 张</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onSubmit({ confirmed: false })}
              style={{ padding: '8px 18px', borderRadius: 8 }}
            >
              不发动（正常摸牌）
            </button>
            <button
              type="button"
              className="gold-btn"
              disabled={selectedTargets.length === 0}
              onClick={() => onSubmit({ confirmed: true, selectedTargetIds: selectedTargets })}
              style={{ padding: '8px 20px', borderRadius: 8 }}
            >
              发动突袭 ({selectedTargets.length})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const backdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 55,
  background: 'rgba(4, 7, 13, 0.82)',
  backdropFilter: 'blur(5px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
};

const modalBoxStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  borderRadius: 14,
  padding: 16,
  maxHeight: '84%',
  overflowY: 'auto',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: '#fde68a',
};

const subStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13,
  color: '#cbd5e1',
};

const zoneLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#fbbf24',
  marginBottom: 8,
};
