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

function getCardPalette(card: Card): {
  bg: string;
  accent: string;
  ink: string;
  seal: string;
  tag: string;
} {
  if (card.name === '火杀' || card.name === '火攻') {
    return {
      bg: 'radial-gradient(circle at 60% 35%, rgba(234, 88, 12, 0.34), rgba(127, 29, 29, 0.2) 55%, rgba(28, 16, 12, 0.14))',
      accent: '#ea580c',
      ink: '#9a3412',
      seal: '#c2410c',
      tag: card.type === 'basic' ? '火' : '锦囊',
    };
  }
  if (card.name === '雷杀' || card.name === '闪电') {
    return {
      bg: 'radial-gradient(circle at 60% 35%, rgba(124, 58, 237, 0.32), rgba(49, 46, 129, 0.22) 55%, rgba(15, 23, 42, 0.12))',
      accent: '#7c3aed',
      ink: '#4338ca',
      seal: '#5b21b6',
      tag: card.type === 'basic' ? '雷' : '延时',
    };
  }
  if (card.name === '杀') {
    return {
      bg: 'radial-gradient(circle at 55% 42%, rgba(153, 27, 27, 0.25), rgba(69, 10, 10, 0.14) 60%, rgba(28, 25, 23, 0.08))',
      accent: '#b91c1c',
      ink: '#1c1917',
      seal: '#991b1b',
      tag: '基本',
    };
  }
  if (card.name === '闪') {
    return {
      bg: 'radial-gradient(circle at 55% 42%, rgba(14, 116, 144, 0.26), rgba(30, 58, 138, 0.14) 60%, rgba(241, 245, 249, 0.08))',
      accent: '#0284c7',
      ink: '#0c4a6e',
      seal: '#0369a1',
      tag: '基本',
    };
  }
  if (card.name === '桃' || card.name === '桃园结义') {
    return {
      bg: 'radial-gradient(circle at 55% 42%, rgba(225, 29, 72, 0.24), rgba(21, 128, 61, 0.14) 62%, rgba(254, 242, 242, 0.06))',
      accent: '#e11d48',
      ink: '#9f1239',
      seal: '#be123c',
      tag: card.type === 'basic' ? '基本' : '锦囊',
    };
  }
  if (card.name === '酒') {
    return {
      bg: 'radial-gradient(circle at 55% 42%, rgba(180, 83, 9, 0.28), rgba(120, 53, 15, 0.16) 62%, transparent)',
      accent: '#d97706',
      ink: '#78350f',
      seal: '#92400e',
      tag: '基本',
    };
  }
  if (card.type === 'trick' || card.type === 'delay') {
    return {
      bg: 'radial-gradient(circle at 55% 42%, rgba(30, 64, 175, 0.24), rgba(88, 28, 135, 0.14) 62%, rgba(15, 23, 42, 0.08))',
      accent: '#1d4ed8',
      ink: '#1e3a8a',
      seal: card.type === 'delay' ? '#6d28d9' : '#1d4ed8',
      tag: card.type === 'delay' ? '延时' : '锦囊',
    };
  }
  return {
    bg: 'radial-gradient(circle at 55% 42%, rgba(15, 118, 110, 0.24), rgba(120, 83, 25, 0.15) 62%, transparent)',
    accent: '#0f766e',
    ink: '#115e59',
    seal: '#0f766e',
    tag: card.type === 'weapon' ? '武器' : card.type === 'armor' ? '防具' : '坐骑',
  };
}

/**
 * Custom classical Chinese ink & gold vector illustrations for every card — zero cartoon emojis!
 */
const CardIllustration: React.FC<{ card: Card }> = ({ card }) => {
  const uid = card.id.replace(/[^a-zA-Z0-9_]/g, '');

  switch (card.name) {
    case '杀':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <defs>
            <linearGradient id={`bl_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="55%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>
          {/* Ink slash arc */}
          <path d="M12 78 Q40 20 68 18 Q44 38 22 86 Z" fill="#7f1d1d" opacity="0.28" />
          {/* Crossed sword & halberd */}
          <path d="M18 82 L60 16 L65 20 L24 85 Z" fill={`url(#bl_${uid})`} stroke="#450a0a" strokeWidth="1" />
          <path d="M22 68 L34 76" stroke="#b45309" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M62 82 L22 22 L17 26 L56 85 Z" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1" opacity="0.9" />
          {/* Crimson splatter ring */}
          <circle cx="42" cy="48" r="18" fill="none" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.65" />
          <path d="M52 24 L66 14 L58 30" fill="#dc2626" opacity="0.7" />
        </svg>
      );

    case '火杀':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <path d="M40 12 C56 28 66 46 58 68 C52 84 28 86 22 68 C16 50 28 32 40 12 Z" fill="#dc2626" opacity="0.28" />
          <path d="M42 22 C52 36 56 50 48 66 C42 76 30 74 28 62 C26 48 34 36 42 22 Z" fill="#f97316" opacity="0.5" />
          <path d="M20 82 L58 18 L64 23 L25 85 Z" fill="#fef3c7" stroke="#9a3412" strokeWidth="1.2" />
          <path d="M18 68 Q40 48 62 32" fill="none" stroke="#fde047" strokeWidth="2.2" opacity="0.85" />
          <circle cx="58" cy="24" r="4" fill="#fde047" opacity="0.9" />
        </svg>
      );

    case '雷杀':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="48" r="26" fill="#4c1d95" opacity="0.2" />
          <path d="M48 10 L26 48 L41 48 L28 88 L56 44 L40 44 Z" fill="#fde047" stroke="#6d28d9" strokeWidth="1.5" />
          <path d="M18 78 L60 18" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
          <path d="M16 32 L30 38 M52 64 L66 70" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case '闪':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          {/* Swirling wind silk */}
          <path d="M10 64 Q28 24 58 26 Q38 42 66 56 Q34 62 18 82 Z" fill="#0284c7" opacity="0.22" />
          <path d="M16 70 C24 38 44 26 62 30" fill="none" stroke="#0369a1" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 76 C36 52 50 48 66 52" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
          {/* Jade shield crest */}
          <path d="M40 24 L58 33 V52 C58 65 40 76 40 76 C40 76 22 65 22 52 V33 Z" fill="rgba(14, 116, 144, 0.25)" stroke="#0e7490" strokeWidth="2" />
          <path d="M40 31 L51 37 V51 C51 59 40 67 40 67 C40 67 29 59 29 51 V37 Z" fill="none" stroke="#bae6fd" strokeWidth="1.2" />
        </svg>
      );

    case '桃':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <defs>
            <radialGradient id={`peach_${uid}`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fecdd3" />
              <stop offset="55%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#be123c" />
            </radialGradient>
          </defs>
          {/* Leaves */}
          <path d="M38 30 C26 16 14 20 18 32 C24 34 32 34 38 30 Z" fill="#15803d" stroke="#14532d" strokeWidth="1" />
          <path d="M42 29 C54 15 66 20 61 32 C54 34 48 33 42 29 Z" fill="#22c55e" stroke="#14532d" strokeWidth="1" />
          {/* Peach body */}
          <path d="M40 28 C58 24 64 46 56 64 C50 76 40 82 40 82 C40 82 30 76 24 64 C16 46 22 24 40 28 Z" fill={`url(#peach_${uid})`} stroke="#9f1239" strokeWidth="1.5" />
          <path d="M40 31 Q35 50 40 76" fill="none" stroke="#ffe4e6" strokeWidth="1.5" opacity="0.65" />
          <circle cx="32" cy="44" r="4" fill="#fff1f2" opacity="0.45" />
        </svg>
      );

    case '酒':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          {/* Vapor */}
          <path d="M32 30 Q28 20 35 14 M44 28 Q50 18 44 12" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
          {/* Bronze Jue Cup */}
          <path d="M22 38 L58 38 L50 56 C48 62 32 62 30 56 Z" fill="#b45309" stroke="#451a03" strokeWidth="1.5" />
          <path d="M22 38 L14 33 L24 44" fill="#d97706" stroke="#451a03" strokeWidth="1.2" />
          <path d="M58 38 L66 34 L55 46" fill="#d97706" stroke="#451a03" strokeWidth="1.2" />
          {/* Three tripod legs */}
          <path d="M33 60 L26 82 M40 61 L40 84 M47 60 L54 82" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
          <circle cx="40" cy="48" r="14" fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.5" />
        </svg>
      );

    case '无中生有':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="48" r="24" fill="#1d4ed8" opacity="0.16" />
          <path d="M20 62 Q40 24 60 62" fill="none" stroke="#b45309" strokeWidth="2" />
          <rect x="26" y="34" width="28" height="34" rx="3" fill="#fef3c7" stroke="#92400e" strokeWidth="1.5" />
          <path d="M32 43 H48 M32 50 H48 M32 57 H42" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 16 L43 24 L51 24 L45 29 L47 36 L40 31 L33 36 L35 29 L29 24 L37 24 Z" fill="#f59e0b" />
        </svg>
      );

    case '过河拆桥':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          {/* River waves */}
          <path d="M10 74 Q22 68 34 74 T58 74 T72 74" fill="none" stroke="#0284c7" strokeWidth="2.5" />
          <path d="M12 82 Q24 76 36 82 T60 82" fill="none" stroke="#0369a1" strokeWidth="2" opacity="0.7" />
          {/* Broken wooden bridge */}
          <path d="M12 58 Q26 42 36 46 L32 56 L14 64 Z" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
          <path d="M68 58 Q54 42 44 46 L48 56 L66 64 Z" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
          {/* Flame / shatter */}
          <path d="M38 22 L44 38 L52 28 L42 52 L34 36 Z" fill="#dc2626" opacity="0.8" />
        </svg>
      );

    case '顺手牵羊':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          {/* Mountain & rope */}
          <path d="M10 74 L28 48 L44 66 L58 52 L72 74 Z" fill="#334155" opacity="0.2" />
          <path d="M14 42 Q32 30 46 46" fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="3 2" />
          {/* Graceful stylized sheep/ram silhouette */}
          <ellipse cx="44" cy="56" rx="15" ry="10" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
          <circle cx="28" cy="48" r="6" fill="#f1f5f9" stroke="#475569" strokeWidth="1.5" />
          <path d="M25 43 C21 37 16 40 20 45" fill="none" stroke="#92400e" strokeWidth="2" />
          <path d="M34 65 L32 76 M41 66 L40 76 M49 65 L50 76 M55 64 L57 75" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case '南蛮入侵':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="48" r="24" fill="#7f1d1d" opacity="0.16" />
          {/* War Elephant Silhouette */}
          <path d="M22 52 C22 34 40 28 54 34 C62 38 64 52 58 64 L52 64 L52 76 L44 76 L44 64 L32 64 L32 76 L24 76 L24 60 C18 62 14 54 16 44 C18 40 20 46 22 52 Z" fill="#451a03" opacity="0.85" />
          {/* Tusks */}
          <path d="M22 52 Q12 56 14 44" fill="none" stroke="#fef3c7" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 34 L48 26 L50 36 Z" fill="#b91c1c" />
        </svg>
      );

    case '万箭齐发':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          {[
            [18, 20, 42, 74],
            [32, 14, 54, 72],
            [46, 18, 66, 78],
            [12, 36, 36, 86],
            [38, 28, 60, 86],
          ].map(([x1, y1, x2, y2], i) => (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#451a03" strokeWidth="2" />
              <polygon points={`${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 2},${y2 - 7}`} fill="#991b1b" />
              <line x1={x1 - 3} y1={y1 + 2} x2={x1 + 3} y2={y1 - 2} stroke="#b91c1c" strokeWidth="2" />
            </g>
          ))}
        </svg>
      );

    case '桃园结义':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="42" r="24" fill="#fb7185" opacity="0.18" />
          {/* Three golden chalices */}
          {[22, 40, 58].map((cx, idx) => (
            <g key={idx}>
              <path d={`M${cx - 6} 50 H${cx + 6} L${cx + 3} 64 H${cx - 3} Z`} fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <line x1={cx} y1="64" x2={cx} y2="74" stroke="#78350f" strokeWidth="2" />
              <line x1={cx - 4} y1="74" x2={cx + 4} y2="74" stroke="#78350f" strokeWidth="2" />
            </g>
          ))}
          {/* Blossoms */}
          <circle cx="24" cy="28" r="5" fill="#fda4af" />
          <circle cx="40" cy="22" r="6" fill="#fb7185" />
          <circle cx="56" cy="28" r="5" fill="#fda4af" />
        </svg>
      );

    case '决斗':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="50" r="24" fill="none" stroke="#991b1b" strokeWidth="2" strokeDasharray="5 3" />
          <path d="M16 74 L60 22" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
          <path d="M64 74 L20 22" stroke="#b91c1c" strokeWidth="4" strokeLinecap="round" />
          <polygon points="40,38 44,46 52,48 44,52 40,60 36,52 28,48 36,46" fill="#f59e0b" />
        </svg>
      );

    case '五谷丰登':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="30" r="14" fill="#f59e0b" opacity="0.35" />
          {/* Golden wheat stalks */}
          {[26, 40, 54].map((x, idx) => (
            <g key={idx}>
              <path d={`M${x} 78 Q${x + (idx - 1) * 4} 50 ${x} 26`} fill="none" stroke="#b45309" strokeWidth="2.2" />
              <ellipse cx={x - 4} cy="36" rx="3" ry="5" fill="#d97706" />
              <ellipse cx={x + 4} cy="42" rx="3" ry="5" fill="#f59e0b" />
              <ellipse cx={x - 4} cy="48" rx="3" ry="5" fill="#d97706" />
            </g>
          ))}
        </svg>
      );

    case '无懈可击':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="50" r="24" fill="rgba(30, 58, 138, 0.14)" stroke="#1e3a8a" strokeWidth="2.2" />
          <path d="M40 26 A12 12 0 0 1 40 50 A12 12 0 0 0 40 74 A24 24 0 0 1 40 26 Z" fill="#1e293b" />
          <circle cx="40" cy="38" r="3.5" fill="#f8fafc" />
          <circle cx="40" cy="62" r="3.5" fill="#1e293b" />
          <circle cx="40" cy="50" r="29" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="4 3" />
        </svg>
      );

    case '火攻':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <path d="M40 16 C58 34 62 56 48 76 C40 84 26 78 24 62 C22 48 30 34 40 16 Z" fill="#ea580c" opacity="0.72" />
          <path d="M40 30 C49 42 51 56 42 70 C36 74 30 68 30 58 C30 46 35 38 40 30 Z" fill="#fde047" opacity="0.88" />
          <path d="M16 76 L62 24" stroke="#7f1d1d" strokeWidth="2" />
        </svg>
      );

    case '乐不思蜀':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="44" r="22" fill="#9333ea" opacity="0.16" />
          {/* Palace lantern */}
          <line x1="40" y1="16" x2="40" y2="28" stroke="#78350f" strokeWidth="2" />
          <ellipse cx="40" cy="46" rx="16" ry="18" fill="#be123c" stroke="#fbbf24" strokeWidth="1.5" />
          <line x1="28" y1="46" x2="52" y2="46" stroke="#fde68a" strokeWidth="1" opacity="0.7" />
          <line x1="40" y1="28" x2="40" y2="64" stroke="#fde68a" strokeWidth="1" opacity="0.7" />
          <path d="M35 64 L34 80 M40 64 L40 84 M45 64 L46 80" stroke="#f59e0b" strokeWidth="1.8" />
        </svg>
      );

    case '兵粮寸断':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <rect x="20" y="34" width="40" height="30" rx="3" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
          <line x1="20" y1="49" x2="60" y2="49" stroke="#d97706" strokeWidth="2" />
          <path d="M14 26 L66 74 M66 26 L14 74" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
        </svg>
      );

    case '闪电':
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <path d="M20 34 C16 24 28 18 36 22 C44 16 58 20 58 32 C66 34 66 46 56 46 H22 C14 46 14 36 20 34 Z" fill="#334155" />
          <polygon points="44,42 30,62 41,62 34,86 54,56 42,56" fill="#fde047" stroke="#4338ca" strokeWidth="1.2" />
        </svg>
      );

    default:
      if (card.type === 'weapon') {
        return (
          <svg viewBox="0 0 80 100" style={svgArtStyle}>
            <circle cx="40" cy="48" r="22" fill="#991b1b" opacity="0.16" />
            <path d="M18 78 L58 20 C64 26 64 38 52 44 L24 82 Z" fill="#cbd5e1" stroke="#334155" strokeWidth="1.5" />
            <path d="M20 74 L30 80" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
            <circle cx="56" cy="24" r="3" fill="#dc2626" />
          </svg>
        );
      }
      if (card.type === 'armor') {
        return (
          <svg viewBox="0 0 80 100" style={svgArtStyle}>
            <path d="M40 20 L62 32 V54 C62 68 40 80 40 80 C40 80 18 68 18 54 V32 Z" fill="#0f766e" opacity="0.3" stroke="#0f766e" strokeWidth="2.2" />
            <polygon points="40,30 53,38 53,53 40,66 27,53 27,38" fill="none" stroke="#d97706" strokeWidth="1.6" />
            <circle cx="40" cy="48" r="5" fill="#0f766e" />
          </svg>
        );
      }
      // Horse
      return (
        <svg viewBox="0 0 80 100" style={svgArtStyle}>
          <circle cx="40" cy="48" r="22" fill="#b45309" opacity="0.15" />
          <path d="M22 68 C22 50 32 42 44 40 L48 26 L56 32 L52 44 C60 48 62 58 58 70 L52 70 L50 58 L34 58 L30 70 Z" fill={card.type === 'horse_minus' ? '#991b1b' : '#1e3a8a'} opacity="0.88" />
          <path d="M14 48 H28 M12 56 H24" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
};

const svgArtStyle: React.CSSProperties = {
  width: '86%',
  height: '86%',
  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))',
};

/**
 * 精美古风牌面：烫金宣纸双框 + 左侧竖排花色点数牌名 + 专属水墨金描边矢量插画
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
  const palette = getCardPalette(card);
  const w = compact ? 76 : 90;
  const h = compact ? 108 : 128;

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
        borderRadius: 8,
        padding: 0,
        border: selected ? '2.5px solid #38bdf8' : '1.5px solid #a88754',
        background: 'linear-gradient(165deg, #fdf8ec 0%, #efe1c6 55%, #dac296 100%)',
        boxShadow: selected
          ? '0 0 20px rgba(56, 189, 248, 0.9), 0 -4px 16px rgba(250, 204, 21, 0.5)'
          : '0 5px 14px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.65)',
        transform: selected ? 'translateY(-16px) scale(1.04)' : 'translateY(0)',
        zIndex: selected ? 20 : 1,
        opacity: disabled ? 0.58 : 1,
        filter: disabled ? 'brightness(0.75) saturate(0.8)' : 'none',
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        transition: 'transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.16s ease',
        overflow: 'hidden',
        display: 'flex',
        textAlign: 'left',
      }}
    >
      {/* Inner double gilt border */}
      <div
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: 5,
          border: '1px solid rgba(138, 99, 44, 0.35)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Left Vertical Column: Rank + Suit + Calligraphic Card Name + Category Seal */}
      <div
        style={{
          width: compact ? 23 : 26,
          height: '100%',
          background: 'linear-gradient(180deg, rgba(255,252,244,0.86), rgba(242,226,196,0.72))',
          borderRight: '1px solid rgba(138, 102, 48, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 0 5px',
          flexShrink: 0,
          zIndex: 3,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: compact ? 12 : 14, fontWeight: 900, lineHeight: 1, color: red ? '#b91c1c' : '#18181b' }}>
            {rankLabel(card.rank)}
          </span>
          <span style={{ fontSize: compact ? 11 : 13, lineHeight: 1, color: red ? '#b91c1c' : '#18181b' }}>
            {suitSymbol(card.suit)}
          </span>
          <span
            className="font-serif-cn"
            style={{
              marginTop: 2,
              writingMode: 'vertical-rl',
              textOrientation: 'upright',
              fontSize: card.name.length > 3 ? (compact ? 9.5 : 10.5) : compact ? 12 : 13,
              fontWeight: 900,
              color: palette.ink,
              lineHeight: 1,
              letterSpacing: card.name.length > 3 ? -1 : 0,
            }}
          >
            {card.name}
          </span>
        </div>

        {/* Antique Red/Blue Seal Stamp at Bottom of Strip */}
        <span
          className="font-serif-cn"
          style={{
            fontSize: 8,
            fontWeight: 900,
            color: '#fffbeb',
            background: palette.seal,
            padding: '1px 2px',
            borderRadius: 2,
            lineHeight: 1.1,
            opacity: 0.9,
          }}
        >
          {palette.tag.slice(0, 1)}
        </span>
      </div>

      {/* Right Artwork Canvas */}
      <div
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: palette.bg,
        }}
      >
        <CardIllustration card={card} />
        {card.range && (
          <div
            style={{
              position: 'absolute',
              bottom: 5,
              right: 5,
              fontSize: 9,
              fontWeight: 900,
              color: '#0f766e',
              background: 'rgba(255, 250, 240, 0.85)',
              border: '1px solid rgba(15, 118, 110, 0.35)',
              padding: '0 4px',
              borderRadius: 3,
            }}
          >
            距{card.range}
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
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#fde68a',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 99,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(253, 230, 138, 0.45)',
            zIndex: 5,
          }}
        >
          {badge}
        </div>
      )}
    </button>
  );
};
