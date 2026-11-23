import React, { useMemo, useState } from 'react';
import { Faction, HeroDef, HeroSeries } from '../types/game';
import { FACTION_META, HEROES, RARITY_META, SERIES_META } from '../data/heroes';
import { HeroArt } from './HeroArt';
import { X, Swords, Search } from 'lucide-react';

interface HeroGalleryModalProps {
  onClose: () => void;
  onQuickStart2v2: (hero: HeroDef) => void;
}

type SidebarTab = 'hot' | 'all' | 'mou' | 'zhi' | 'ji' | 'shen' | 'classic';

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: 'hot', label: '热门' },
  { id: 'all', label: '全部' },
  { id: 'mou', label: '谋' },
  { id: 'zhi', label: '志' },
  { id: 'ji', label: '极' },
  { id: 'shen', label: '神将' },
  { id: 'classic', label: '界限' },
];

export const HeroGalleryModal: React.FC<HeroGalleryModalProps> = ({ onClose, onQuickStart2v2 }) => {
  const [tab, setTab] = useState<SidebarTab>('hot');
  const [factionFilter, setFactionFilter] = useState<Faction | 'all'>('all');
  const [query, setQuery] = useState('');
  const [detailHero, setDetailHero] = useState<HeroDef | null>(null);

  const list = useMemo(() => {
    return HEROES.filter((h) => {
      if (tab === 'hot') {
        const hotIds = new Set([
          'mou_huangzhong',
          'mou_xiaoqiao',
          'ji_mayunlu',
          'ji_diaochan',
          'ji_hetaihou',
          'ji_xinxianying',
          'zhi_sunquan',
          'jie_quanzong',
          'zhangxingcai',
          'jie_xusheng',
          'shen_caocao',
          'shen_ganning',
          'shen_guanyu',
          'shen_lvbu',
          'liuzan',
        ]);
        if (!hotIds.has(h.id)) return false;
      } else if (tab !== 'all' && h.series !== (tab as HeroSeries)) {
        return false;
      }
      if (factionFilter !== 'all' && h.faction !== factionFilter) return false;
      if (query.trim() && !h.name.includes(query.trim()) && !h.skills.some((s) => s.name.includes(query.trim()))) {
        return false;
      }
      return true;
    });
  }, [tab, factionFilter, query]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: '#38485a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Dark Header Bar (Exact Mirror of Screenshot 2!) */}
      <div
        style={{
          height: 46,
          padding: '0 12px',
          background: '#253140',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span className="font-serif-cn" style={{ fontSize: 18, fontWeight: 900, color: '#f3e5c8', letterSpacing: 2 }}>
          武将
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color: '#fde047', fontWeight: 800 }}>🪙 ∞</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800 }}>⚪ ∞</span>
          <span style={{ color: '#4ade80', fontWeight: 800 }}>💎 ∞</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Mobile Portrait Body: [Left 66px Vertical Sidebar] + [Right 3-Col Card Grid] */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '66px 1fr', overflow: 'hidden' }}>
        {/* Left Vertical Tabs */}
        <nav
          style={{
            background: '#2b3847',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 4,
            overflowY: 'auto',
          }}
        >
          {SIDEBAR_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="font-serif-cn"
                style={{
                  height: 44,
                  border: 'none',
                  background: active
                    ? 'linear-gradient(90deg, rgba(180, 134, 62, 0.78), rgba(180, 134, 62, 0.18))'
                    : 'transparent',
                  borderLeft: active ? '3px solid #fde047' : '3px solid transparent',
                  color: active ? '#fff7d6' : '#94a3b8',
                  fontSize: 13,
                  fontWeight: active ? 900 : 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Right 3-Column Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#3a4b5d' }}>
          {/* Sub-bar */}
          <div style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>
                拥有：<strong style={{ color: '#fb923c' }}>{list.length}</strong>/{list.length}
              </span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜武将..."
                  style={{
                    padding: '3px 22px 3px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: '#23303e',
                    color: '#f8fafc',
                    fontSize: 11,
                    width: 102,
                    outline: 'none',
                  }}
                />
                <Search size={12} color="#94a3b8" style={{ position: 'absolute', right: 6 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['all', 'shu', 'wei', 'wu', 'qun', 'shen'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFactionFilter(f)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: 5,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: factionFilter === f ? '#b45309' : '#263342',
                    color: factionFilter === f ? '#fffbeb' : '#cbd5e1',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {f === 'all' ? '全' : FACTION_META[f].name}
                </button>
              ))}
            </div>
          </div>

          <div className="font-serif-cn" style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', letterSpacing: 2, padding: '2px 0 6px' }}>
            ─── {SIDEBAR_TABS.find((t) => t.id === tab)?.label}武将 ───
          </div>

          {/* 3-Col Mobile Grid */}
          <div
            style={{
              flex: 1,
              padding: '0 8px 14px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              alignContent: 'start',
            }}
          >
            {list.map((h) => {
              const rMeta = RARITY_META[h.rarity];
              return (
                <div
                  key={h.id}
                  onClick={() => setDetailHero(h)}
                  style={{
                    position: 'relative',
                    height: 136,
                    borderRadius: 7,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
                    background: '#1e293b',
                  }}
                >
                  <img
                    src={h.portrait}
                    alt={h.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
                  />
                  <div
                    className="font-serif-cn"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 4,
                      fontSize: 12,
                      fontWeight: 900,
                      color: rMeta.color,
                      textShadow: '0 1px 6px #000',
                    }}
                  >
                    {rMeta.label}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '16px 3px 4px',
                      background: 'linear-gradient(180deg, transparent, rgba(12, 16, 24, 0.95) 68%)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="font-serif-cn" style={{ fontSize: 12, fontWeight: 900, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.name}
                    </div>
                    <div style={{ fontSize: 9, color: SERIES_META[h.series].color }}>◆</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Sheet Detail Overlay when clicking a Hero */}
      {detailHero && (
        <div
          onClick={() => setDetailHero(null)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 70,
            background: 'rgba(5, 8, 14, 0.72)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="gold-panel"
            style={{
              width: '100%',
              maxHeight: '78%',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 108, height: 148, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <HeroArt hero={detailHero} size="md" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-serif-cn" style={{ fontSize: 20, fontWeight: 900, color: '#fde68a' }}>
                    {detailHero.name}
                  </span>
                  <button type="button" className="ghost-btn" onClick={() => setDetailHero(null)} style={{ padding: '2px 7px', borderRadius: 6, fontSize: 11 }}>
                    关闭
                  </button>
                </div>
                <div style={{ fontSize: 11, color: SERIES_META[detailHero.series].color, marginTop: 2, fontWeight: 700 }}>
                  {SERIES_META[detailHero.series].label} · 体力 {detailHero.maxHp}
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic', marginTop: 6 }}>
                  “{detailHero.quote}”
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detailHero.skills.map((sk) => (
                <div key={sk.id} style={{ padding: 9, borderRadius: 8, background: 'rgba(15,23,42,0.82)', border: '1px solid rgba(229,185,99,0.25)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fde68a' }}>【{sk.name}】</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2, lineHeight: 1.45 }}>{sk.description}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="gold-btn font-serif-cn"
              onClick={() => onQuickStart2v2(detailHero)}
              style={{
                marginTop: 14,
                width: '100%',
                height: 44,
                borderRadius: 10,
                fontSize: 16,
                letterSpacing: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Swords size={17} /> 用 {detailHero.name} 开2v2
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
