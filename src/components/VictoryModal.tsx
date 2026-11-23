import React from 'react';
import { GameState, RankProfile } from '../types/game';
import { RANK_TIERS, getSeatTeamLabel } from '../engine/rules';
import { Crown, RotateCcw, Home, Trophy, Skull } from 'lucide-react';

interface VictoryModalProps {
  state: GameState;
  rank: RankProfile;
  onPlayAgain: () => void;
  onBackLobby: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ state, rank, onPlayAgain, onBackLobby }) => {
  if (!state.winner) return null;
  const win = state.winner.isHumanWin;
  const tier = RANK_TIERS[Math.min(rank.tierIndex, RANK_TIERS.length - 1)];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        background: 'rgba(4, 7, 14, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
      }}
    >
      <div
        className="gold-panel"
        style={{
          width: '100%',
          maxWidth: 396,
          borderRadius: 18,
          padding: 20,
          textAlign: 'center',
          maxHeight: '90%',
          overflowY: 'auto',
          border: win ? '2px solid #fde047' : '2px solid #991b1b',
          background: win
            ? 'radial-gradient(circle at 50% 0%, rgba(217, 119, 6, 0.35), rgba(11, 14, 20, 0.98) 65%)'
            : 'radial-gradient(circle at 50% 0%, rgba(153, 27, 27, 0.35), rgba(11, 14, 20, 0.98) 65%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          {win ? <Trophy size={48} color="#fde047" /> : <Skull size={48} color="#f87171" />}
        </div>

        <h2
          className="font-serif-cn"
          style={{
            margin: 0,
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 4,
            color: win ? '#fde68a' : '#fca5a5',
            textShadow: '0 4px 16px rgba(0,0,0,0.8)',
          }}
        >
          {state.winner.title}
        </h2>
        <p style={{ margin: '8px 0 18px', fontSize: 14, color: '#cbd5e1' }}>{state.winner.subtitle}</p>

        {/* 2v2 Rank Progress */}
        {state.mode === '2v2' && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(229,185,99,0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={22} color={tier.color} />
              <span className="font-serif-cn" style={{ fontSize: 18, fontWeight: 900, color: tier.color }}>
                {tier.name}
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#fde047', fontWeight: 700 }}>
              {win ? (rank.streak >= 3 ? '+2 ★（连胜加成！）' : '+1 ★') : '-1 ★'} · 当前 {rank.stars} 星
            </div>
          </div>
        )}

        {/* Scoreboard */}
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(229,185,99,0.22)',
            background: 'rgba(10, 14, 22, 0.8)',
            marginBottom: 22,
          }}
        >
          {state.players.map((p) => {
            const label = getSeatTeamLabel({ ...p, identityRevealed: true }, state.mode);
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1.2fr 68px 56px 64px',
                  alignItems: 'center',
                  padding: '8px 8px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11,
                  background: p.isHuman ? 'rgba(229,185,99,0.1)' : 'transparent',
                }}
              >
                <span style={{ color: '#94a3b8' }}>{p.seatIndex + 1}号位</span>
                <span style={{ textAlign: 'left', fontWeight: 700, color: p.isHuman ? '#fde68a' : '#f1f5f9' }}>
                  {p.hero.name} {p.isHuman ? '（你）' : ''}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: label.bg,
                    color: label.color,
                  }}
                >
                  {label.text}
                </span>
                <span style={{ color: '#fb923c' }}>输出 {p.damageDealt}</span>
                <span style={{ color: p.alive ? '#4ade80' : '#f87171' }}>
                  {p.alive ? '存活' : '阵亡'} / {p.kills}杀
                </span>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={onBackLobby}
            style={{
              padding: '11px 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Home size={16} /> 返回大厅
          </button>
          <button
            type="button"
            className="gold-btn font-serif-cn"
            onClick={onPlayAgain}
            style={{
              padding: '11px 30px',
              borderRadius: 10,
              fontSize: 16,
              letterSpacing: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RotateCcw size={16} /> 再来一局
          </button>
        </div>
      </div>
    </div>
  );
};
