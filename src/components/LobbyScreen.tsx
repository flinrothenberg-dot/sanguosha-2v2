import React from 'react';
import { GameMode, RankProfile } from '../types/game';
import { HEROES } from '../data/heroes';
import { RANK_TIERS } from '../engine/rules';
import { Crown, Flame, Shield, Sparkles, Swords, Users, Volume2, VolumeX, Mic, MicOff, BookOpen } from 'lucide-react';

interface LobbyScreenProps {
  rank: RankProfile;
  sfxEnabled: boolean;
  voiceEnabled: boolean;
  onToggleSfx: () => void;
  onToggleVoice: () => void;
  onSelectMode: (mode: GameMode) => void;
  onOpenGallery: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  rank,
  sfxEnabled,
  voiceEnabled,
  onToggleSfx,
  onToggleVoice,
  onSelectMode,
  onOpenGallery,
}) => {
  const tier = RANK_TIERS[Math.min(rank.tierIndex, RANK_TIERS.length - 1)];
  const totalGames = rank.wins + rank.losses;
  const winRate = totalGames > 0 ? Math.round((rank.wins / totalGames) * 100) : 0;

  return (
    <div
      className="lobby-bg"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Mobile Bar */}
      <header
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(229, 185, 99, 0.25)',
          background: 'rgba(8, 11, 18, 0.9)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            className="font-serif-cn"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
              border: '1.5px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 900,
              color: '#fde68a',
            }}
          >
            杀
          </div>
          <div>
            <div className="font-serif-cn" style={{ fontSize: 16, fontWeight: 900, color: '#fef3c7', lineHeight: 1.1 }}>
              三国杀 · 竖屏典藏版
            </div>
            <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={10} /> {HEROES.length}名全解锁 · 谋/极/志/神
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={onToggleSfx}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {sfxEnabled ? <Volume2 size={15} color="#fde68a" /> : <VolumeX size={15} color="#64748b" />}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onToggleVoice}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {voiceEnabled ? <Mic size={15} color="#fde68a" /> : <MicOff size={15} color="#64748b" />}
          </button>
        </div>
      </header>

      {/* Currency Strip */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.72)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-around',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#fde047' }}>🫘 欢乐豆 ∞</span>
        <span style={{ color: '#e2e8f0' }}>🪙 银两 ∞</span>
        <span style={{ color: '#4ade80' }}>💎 元宝 ∞</span>
      </div>

      {/* Scrollable Vertical Mobile Body */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Main Feature Card: 2v2 Ranked */}
        <section
          className="gold-panel"
          style={{
            borderRadius: 16,
            padding: 16,
            background:
              'radial-gradient(circle at 85% 15%, rgba(185, 28, 28, 0.36), transparent 55%), radial-gradient(circle at 15% 85%, rgba(29, 78, 216, 0.28), transparent 52%), linear-gradient(155deg, rgba(24, 28, 40, 0.96), rgba(10, 13, 20, 0.98))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(220, 38, 38, 0.28)',
                border: '1px solid rgba(248, 113, 113, 0.6)',
                color: '#fca5a5',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Flame size={12} /> 核心主打
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {rank.wins}胜 {rank.losses}负 {totalGames > 0 ? `(${winRate}%)` : ''}
            </span>
          </div>

          <h1 className="font-serif-cn" style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fef3c7', letterSpacing: 2 }}>
            2v2 排位赛
          </h1>
          <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.55 }}>
            1/4号位暖色 vs 2/3号位冷色，1号位首回合摸1牌平衡，队友阵亡补1牌，支持自由点将与指定队友！
          </p>

          {/* Rank Strip */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(10, 14, 24, 0.78)',
              border: '1px solid rgba(229, 185, 99, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Crown size={22} color={tier.color} />
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>当前段位</div>
                <div className="font-serif-cn" style={{ fontSize: 16, fontWeight: 900, color: tier.color }}>
                  {tier.name}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, letterSpacing: 2, color: '#fbbf24' }}>
                {'★'.repeat(Math.min(rank.stars, tier.starsNeeded))}
                {'☆'.repeat(Math.max(0, Math.min(tier.starsNeeded, 5) - Math.min(rank.stars, tier.starsNeeded)))}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                {rank.streak >= 2 ? `🔥 ${rank.streak}连胜` : `击杀 ${rank.totalKills}`}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="gold-btn font-serif-cn"
            onClick={() => onSelectMode('2v2')}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 10,
              fontSize: 18,
              letterSpacing: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Swords size={19} /> 开始 2v2 排位
          </button>
        </section>

        {/* Secondary Modes: 2-Column Compact Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            className="gold-panel"
            style={{
              borderRadius: 14,
              padding: 13,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'radial-gradient(circle at 80% 15%, rgba(217, 119, 6, 0.28), rgba(11, 14, 20, 0.96) 70%)',
            }}
          >
            <div>
              <h2 className="font-serif-cn" style={{ margin: 0, fontSize: 17, color: '#fde68a' }}>
                欢乐斗地主
              </h2>
              <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 2 }}>1v2 · 飞扬跋扈</div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                地主+1血+1摸+1杀，3分钟极速单挑双农民！
              </p>
            </div>
            <button
              type="button"
              className="crimson-btn font-serif-cn"
              onClick={() => onSelectMode('landlord')}
              style={{ marginTop: 10, height: 36, borderRadius: 8, fontSize: 13, letterSpacing: 1 }}
            >
              进入斗地主
            </button>
          </div>

          <div
            className="gold-panel"
            style={{
              borderRadius: 14,
              padding: 13,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'radial-gradient(circle at 80% 15%, rgba(16, 185, 129, 0.24), rgba(11, 14, 20, 0.96) 70%)',
            }}
          >
            <div>
              <h2 className="font-serif-cn" style={{ margin: 0, fontSize: 17, color: '#a7f3d0' }}>
                5人身份场
              </h2>
              <div style={{ fontSize: 10, color: '#34d399', marginTop: 2 }}>主 · 忠 · 反 · 内</div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                经典主公+忠臣+反贼+内奸身份博弈对抗。
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn font-serif-cn"
              onClick={() => onSelectMode('identity5')}
              style={{ marginTop: 10, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Users size={14} /> 身份场
            </button>
          </div>
        </div>

        {/* Full Hero Gallery Button */}
        <button
          type="button"
          onClick={onOpenGallery}
          className="gold-panel"
          style={{
            borderRadius: 14,
            padding: '13px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#fef3c7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.24)',
                border: '1px solid rgba(216, 180, 254, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BookOpen size={19} color="#e879f9" />
            </div>
            <div>
              <div className="font-serif-cn" style={{ fontSize: 15, fontWeight: 900 }}>
                全武将图鉴（{HEROES.length}名全解锁）
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                谋50将 · 极16将 · 志10将 · 神15将 · 传说界将
              </div>
            </div>
          </div>
          <Shield size={17} color="#fde68a" />
        </button>
      </main>
    </div>
  );
};
