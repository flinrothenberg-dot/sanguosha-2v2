import React from 'react';
import { Card } from '../types/game';
import { isRedSuit, rankLabel, suitSymbol } from '../data/deck';

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  badge?: string;
  overlap?: boolean;
  onClick?: () => void;
}

function cardIcon(card: Card): string {
  switch (card.name) {
    case '杀':
      return '⚔️';
    case '火杀':
      return '🔥';
    case '雷杀':
      return '⚡';
    case '闪':
      return '🛡️';
    case '桃':
      return '🍑';
    case '酒':
      return '🍶';
    case '无中生有':
      return '✨';
    case '过河拆桥':
      return '🌉';
    case '顺手牵羊':
      return '🐑';
    case '南蛮入侵':
      return '🐘';
    case '万箭齐发':
      return '🏹';
    case '桃园结义':
      return '🌸';
    case '决斗':
      return '🥊';
    case '五谷丰登':
      return '🌾';
    case '无懈可击':
      return '☯️';
    case '火攻':
      return '☄️';
    case '乐不思蜀':
      return '🎭';
    case '兵粮寸断':
      return '⛓️';
    case '闪电':
      return '🌩️';
    default:
      if (card.type === 'weapon') return '🗡️';
      if (card.type === 'armor') return '🛡️';
      if (card.type === 'horse_plus') return '🐎';
      if (card.type === 'horse_minus') return '🏇';
      return '📜';
  }
}

/**
 * 1:1 还原抖音《三国杀》小游戏卡牌布局：
 * 左侧竖条排布【点数 + 花色 + 竖排牌名】（即使叠放手牌也能一眼看清每一张牌！）
 * 选中时亮起冰蓝-鎏金边框并上浮！
 */
export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  selected = false,
  disabled = false,
  compact = false,
  badge,
  overlap = false,
  onClick,
}) => {
  const red = isRedSuit(card.suit);
  const w = compact ? 74 : 88;
  const h = compact ? 104 : 124;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={`${card.name} (${suitSymbol(card.suit)}${rankLabel(card.rank)})\n${card.description}`}
      style={{
        position: 'relative',
        width: w,
        height: h,
        flexShrink: 0,
        marginLeft: overlap ? -22 : 0,
        borderRadius: 7,
        padding: 0,
        border: selected ? '2.5px solid #38bdf8' : '1.5px solid #8a7356',
        background: 'linear-gradient(165deg, #fbf6ea 0%, #eadbc1 60%, #d4be96 100%)',
        boxShadow: selected
          ? '0 0 18px rgba(56, 189, 248, 0.85), 0 -4px 14px rgba(250, 204, 21, 0.45)'
          : '0 4px 12px rgba(0, 0, 0, 0.65)',
        transform: selected ? 'translateY(-15px) scale(1.03)' : 'translateY(0)',
        zIndex: selected ? 20 : 1,
        opacity: disabled ? 0.56 : 1,
        filter: disabled ? 'brightness(0.72)' : 'none',
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        transition: 'transform 0.14s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.14s ease',
        overflow: 'hidden',
        display: 'flex',
        textAlign: 'left',
      }}
    >
      {/* Left Vertical Strip: Rank + Suit + Vertical Name (Just like Douyin Sanguosha!) */}
      <div
        style={{
          width: compact ? 22 : 25,
          height: '100%',
          background: 'rgba(255, 250, 240, 0.72)',
          borderRight: '1px solid rgba(138, 115, 86, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 4,
          gap: 1,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: compact ? 12 : 14, fontWeight: 900, lineHeight: 1, color: red ? '#dc2626' : '#111827' }}>
          {rankLabel(card.rank)}
        </span>
        <span style={{ fontSize: compact ? 11 : 13, lineHeight: 1, color: red ? '#dc2626' : '#111827' }}>
          {suitSymbol(card.suit)}
        </span>
        <span
          className="font-serif-cn"
          style={{
            marginTop: 2,
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontSize: card.name.length > 3 ? (compact ? 10 : 11) : compact ? 12 : 13,
            fontWeight: 900,
            color:
              card.element === 'fire'
                ? '#b91c1c'
                : card.element === 'thunder'
                  ? '#4338ca'
                  : card.type === 'weapon' || card.type === 'armor'
                    ? '#0369a1'
                    : '#1c1917',
            lineHeight: 1,
            letterSpacing: -0.5,
          }}
        >
          {card.name}
        </span>
      </div>

      {/* Right Artwork Area */}
      <div
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            card.type === 'trick' || card.type === 'delay'
              ? 'radial-gradient(circle at 50% 45%, rgba(30, 58, 138, 0.18), rgba(15, 23, 42, 0.08))'
              : card.type === 'weapon' || card.type === 'armor'
                ? 'radial-gradient(circle at 50% 45%, rgba(14, 116, 144, 0.18), rgba(15, 23, 42, 0.08))'
                : 'radial-gradient(circle at 50% 45%, rgba(120, 53, 15, 0.15), transparent)',
        }}
      >
        <div style={{ fontSize: compact ? 24 : 30, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}>
          {cardIcon(card)}
        </div>
        {card.range && (
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              fontSize: 9,
              fontWeight: 800,
              color: '#0369a1',
              background: 'rgba(255,255,255,0.72)',
              padding: '0 3px',
              borderRadius: 3,
            }}
          >
            范{card.range}
          </div>
        )}
      </div>

      {/* Optional center table badge */}
      {badge && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '94%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            background: 'rgba(15, 23, 42, 0.9)',
            color: '#fde68a',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 99,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(253, 230, 138, 0.4)',
          }}
        >
          {badge}
        </div>
      )}
    </button>
  );
};
