import React, { useState } from 'react';
import { HeroDef } from '../types/game';
import { FACTION_META, RARITY_META, SERIES_META } from '../data/heroes';

interface HeroArtProps {
  hero: HeroDef;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  dead?: boolean;
  currentHp?: number;
}

/**
 * 1:1 还原官方《三国杀：一将成名 / 抖音三国杀小游戏》正版武将卡面规范：
 * - 左侧竖向势力缎带（左上角圆形鎏金势力徽章 + 竖排书法武将名 + 谋/极/志系列印）
 * - 右下角竖排翠绿勾玉体力珠
 * - 暗金鎏金细框 + 真实人物半身立绘
 */
export const HeroArt: React.FC<HeroArtProps> = ({
  hero,
  size = 'md',
  showDetails = true,
  dead = false,
  currentHp,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const faction = FACTION_META[hero.faction];
  const rarity = RARITY_META[hero.rarity];
  const series = SERIES_META[hero.series];
  const isSpecial = hero.series === 'shen' || hero.series === 'ji' || hero.rarity === 'legend';

  const ribbonW = size === 'sm' ? 22 : size === 'lg' ? 36 : 27;
  const sealSize = size === 'sm' ? 20 : size === 'lg' ? 32 : 25;
  const nameFontSize = size === 'sm' ? 11 : size === 'lg' ? 17 : 13;
  const hpCount = hero.maxHp;
  const liveHp = currentHp ?? hero.maxHp;

  const ribbonGradient =
    hero.faction === 'shu'
      ? 'linear-gradient(180deg, #b91c1c 0%, #7f1d1d 65%, #450a0a 100%)'
      : hero.faction === 'wei'
        ? 'linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 65%, #172554 100%)'
        : hero.faction === 'wu'
          ? 'linear-gradient(180deg, #047857 0%, #065f46 65%, #022c22 100%)'
          : hero.faction === 'shen'
            ? 'linear-gradient(180deg, #7e22ce 0%, #581c87 65%, #2e1065 100%)'
            : 'linear-gradient(180deg, #b45309 0%, #78350f 65%, #451a03 100%)';

  return (
    <div
      className={isSpecial && !dead ? 'shen-sheen' : ''}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: `radial-gradient(circle at 58% 30%, ${hero.artSecondary} 0%, ${hero.artPrimary} 65%, #090c12 100%)`,
        filter: dead ? 'grayscale(1) brightness(0.45)' : 'none',
      }}
    >
      {/* Real Painted Character Portrait */}
      {!imgFailed ? (
        <img
          src={hero.portrait}
          alt={hero.name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 14%',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size === 'sm' ? 26 : 40,
          }}
        >
          {hero.weaponIcon}
        </div>
      )}

      {/* Inner Gold Frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '1.5px solid rgba(229, 185, 99, 0.55)',
          boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Left Vertical Faction Ribbon (Official Sanguosha Card Style!) */}
      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: ribbonW,
            background: ribbonGradient,
            borderRight: '1.5px solid rgba(253, 230, 138, 0.7)',
            boxShadow: '2px 0 10px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 4,
            paddingBottom: 6,
            zIndex: 3,
          }}
        >
          {/* Top-Left Circular Gold Faction Crest */}
          <div
            className="font-serif-cn"
            style={{
              width: sealSize,
              height: sealSize,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #b45309 65%, #451a03 100%)',
              border: '1.5px solid #fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size === 'sm' ? 11 : size === 'lg' ? 16 : 13,
              fontWeight: 900,
              color: '#1c1205',
              boxShadow: '0 2px 6px rgba(0,0,0,0.75)',
              flexShrink: 0,
            }}
          >
            {faction.name}
          </div>

          {/* Series Mini Seal (谋 / 极 / 志) */}
          {(hero.series === 'mou' || hero.series === 'ji' || hero.series === 'zhi') && (
            <div
              className="font-serif-cn"
              style={{
                marginTop: 3,
                width: size === 'sm' ? 15 : size === 'lg' ? 22 : 18,
                height: size === 'sm' ? 15 : size === 'lg' ? 22 : 18,
                borderRadius: 4,
                background: series.bg,
                border: `1px solid ${series.color}`,
                color: series.color,
                fontSize: size === 'sm' ? 9 : size === 'lg' ? 13 : 11,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {series.short}
            </div>
          )}

          {/* Vertical Hero Name */}
          <div
            className="font-serif-cn"
            style={{
              marginTop: 5,
              writingMode: 'vertical-rl',
              textOrientation: 'upright',
              fontSize: nameFontSize,
              fontWeight: 900,
              color: '#fffbeb',
              letterSpacing: size === 'sm' ? 0 : 1,
              textShadow: '0 1px 4px rgba(0,0,0,0.95)',
              lineHeight: 1,
              overflow: 'hidden',
            }}
          >
            {hero.name}
          </div>
        </div>
      )}

      {/* Top Right Rarity Pill */}
      {size !== 'sm' && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(10, 12, 18, 0.82)',
            border: `1px solid ${rarity.color}bb`,
            color: rarity.color,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            zIndex: 3,
          }}
        >
          {rarity.label}
        </div>
      )}

      {/* Bottom Right Vertical Jade HP Beads (Official Sanguosha Magatama!) */}
      {showDetails && (
        <div
          style={{
            position: 'absolute',
            right: size === 'sm' ? 3 : 5,
            bottom: size === 'sm' ? 4 : 6,
            display: 'flex',
            flexDirection: 'column',
            gap: size === 'sm' ? 2 : 3,
            zIndex: 3,
            padding: '2px 2px',
            borderRadius: 99,
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          {Array.from({ length: hpCount }).map((_, idx) => {
            const filled = idx < liveHp;
            const dotSize = size === 'lg' ? 12 : size === 'sm' ? 7 : 9;
            return (
              <span
                key={idx}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50% 50% 50% 20%',
                  transform: 'rotate(-45deg)',
                  background: filled
                    ? liveHp <= 1
                      ? 'radial-gradient(circle at 30% 30%, #fca5a5, #dc2626)'
                      : 'radial-gradient(circle at 30% 30%, #bbf7d0, #16a34a 70%, #14532d)'
                    : 'rgba(255,255,255,0.16)',
                  border: '1px solid rgba(254, 243, 199, 0.75)',
                  boxShadow: filled ? '0 0 5px rgba(34, 197, 94, 0.7)' : 'none',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Bottom Subtle Title Strip */}
      {showDetails && size === 'lg' && (
        <div
          style={{
            position: 'absolute',
            left: ribbonW,
            right: 0,
            bottom: 0,
            padding: '14px 24px 6px 8px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(6, 9, 15, 0.88) 85%)',
            fontSize: 11,
            color: '#fde68a',
            letterSpacing: 1,
            zIndex: 2,
          }}
        >
          {hero.title}
        </div>
      )}

      {/* Dead Stamp */}
      {dead && (
        <div
          className="font-serif-cn"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <span
            style={{
              border: '3px solid #dc2626',
              color: '#ef4444',
              padding: '2px 10px',
              fontSize: size === 'sm' ? 16 : 24,
              fontWeight: 900,
              transform: 'rotate(-14deg)',
              background: 'rgba(20, 5, 5, 0.85)',
              letterSpacing: 4,
            }}
          >
            阵亡
          </span>
        </div>
      )}
    </div>
  );
};
