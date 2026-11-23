import React, { useMemo, useState } from 'react';
import { Faction, GameMode, HeroDef, HeroSeries } from '../types/game';
import { FACTION_META, HEROES, SERIES_META } from '../data/heroes';
import { shuffle } from '../data/deck';
import { HeroArt } from './HeroArt';
import { ArrowLeft, RefreshCw, Swords, Users, Search } from 'lucide-react';

interface HeroSelectScreenProps {
  mode: GameMode;
  initialHero?: HeroDef | null;
  onBack: () => void;
  onStartMatch: (humanHero: HeroDef, teammateHero?: HeroDef | null) => void;
}

export const HeroSelectScreen: React.FC<HeroSelectScreenProps> = ({
  mode,
  initialHero,
  onBack,
  onStartMatch,
}) => {
  const [pickMode, setPickMode] = useState<'all' | 'box5'>('all');
  const [seriesFilter, setSeriesFilter] = useState<HeroSeries | 'all'>('all');
  const [factionFilter, setFactionFilter] = useState<Faction | 'all'>('all');
  const [query, setQuery] = useState('');
  const [boxSeed, setBoxSeed] = useState(0);
  const [selectedHero, setSelectedHero] = useState<HeroDef>(initialHero ?? HEROES[0]);
  const [teammateHero, setTeammateHero] = useState<HeroDef | null>(null);
  const [pickingSlot, setPickingSlot] = useState<'self' | 'teammate'>('self');

  const randomFive = useMemo(() => {
    void boxSeed;
    return shuffle(HEROES).slice(0, 6);
  }, [boxSeed]);

  const displayedHeroes = useMemo(() => {
    if (pickMode === 'box5') return randomFive;
    return HEROES.filter((h) => {
      if (seriesFilter !== 'all' && h.series !== seriesFilter) return false;
      if (factionFilter !== 'all' && h.faction !== factionFilter) return false;
      if (query.trim() && !h.name.includes(query.trim()) && !h.skills.some((s) => s.name.includes(query.trim()))) {
        return false;
      }
      return true;
    });
  }, [pickMode, randomFive, seriesFilter, factionFilter, query]);

  const handleCardClick = (hero: HeroDef) => {
    if (pickingSlot === 'teammate') {
      if (hero.id === selectedHero.id) return;
      setTeammateHero(hero);
      setPickingSlot('self');
    } else {
      if (teammateHero?.id === hero.id) setTeammateHero(null);
      setSelectedHero(hero);
    }
  };

  return (
    <div
      className="lobby-bg"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          height: 46,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(229,185,99,0.25)',
          background: 'rgba(8, 11, 18, 0.92)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="ghost-btn"
          onClick={onBack}
          style={{ padding: '4px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <ArrowLeft size={14} /> 返回
        </button>
        <span className="font-serif-cn" style={{ fontSize: 15, fontWeight: 900, color: '#fde68a' }}>
          {mode === '2v2' ? '2v2 选将' : mode === 'landlord' ? '斗地主选将' : '身份场选将'}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            className={pickMode === 'all' ? 'gold-btn' : 'ghost-btn'}
            onClick={() => setPickMode('all')}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11 }}
          >
            全将({HEROES.length})
          </button>
          <button
            type="button"
            className={pickMode === 'box5' ? 'gold-btn' : 'ghost-btn'}
            onClick={() => {
              setPickMode('box5');
              setBoxSeed((s) => s + 1);
            }}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11 }}
          >
            随机将框
          </button>
        </div>
      </header>

      {/* Selected Hero Sticky Summary Card */}
      <div
        style={{
          padding: '10px 12px',
          background: 'rgba(12, 17, 28, 0.92)',
          borderBottom: '1px solid rgba(229,185,99,0.25)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 88, height: 118, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #fde047', flexShrink: 0 }}>
            <HeroArt hero={selectedHero} size="sm" />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="font-serif-cn" style={{ fontSize: 17, fontWeight: 900, color: '#fde68a' }}>
                  {selectedHero.name}
                </span>
                <span style={{ fontSize: 11, color: SERIES_META[selectedHero.series].color, fontWeight: 700 }}>
                  {SERIES_META[selectedHero.series].label} · {selectedHero.maxHp}血
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: '#cbd5e1',
                  lineHeight: 1.4,
                  maxHeight: 50,
                  overflowY: 'auto',
                }}
              >
                {selectedHero.skills.map((s) => `【${s.name}】${s.shortDesc}`).join(' ')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {mode === '2v2' && (
                <button
                  type="button"
                  className={pickingSlot === 'teammate' ? 'gold-btn' : 'ghost-btn'}
                  onClick={() => setPickingSlot(pickingSlot === 'teammate' ? 'self' : 'teammate')}
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Users size={13} /> {pickingSlot === 'teammate' ? '点下方选队友' : teammateHero ? `队友:${teammateHero.name}` : '指定队友'}
                </button>
              )}
              <button
                type="button"
                className="gold-btn font-serif-cn"
                onClick={() => onStartMatch(selectedHero, teammateHero)}
                style={{
                  flex: 1.2,
                  height: 34,
                  borderRadius: 8,
                  fontSize: 14,
                  letterSpacing: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Swords size={15} /> 出战对局
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {pickMode === 'all' ? (
        <div style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              type="button"
              onClick={() => setSeriesFilter('all')}
              className={seriesFilter === 'all' ? 'gold-btn' : 'ghost-btn'}
              style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, whiteSpace: 'nowrap' }}
            >
              全部
            </button>
            {(['mou', 'ji', 'zhi', 'shen', 'classic'] as HeroSeries[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeriesFilter(s)}
                className={seriesFilter === s ? 'gold-btn' : 'ghost-btn'}
                style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, whiteSpace: 'nowrap' }}
              >
                {SERIES_META[s].label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'shu', 'wei', 'wu', 'qun', 'shen'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFactionFilter(f)}
                  className={factionFilter === f ? 'gold-btn' : 'ghost-btn'}
                  style={{ padding: '2px 7px', borderRadius: 5, fontSize: 11 }}
                >
                  {f === 'all' ? '全' : FACTION_META[f].name}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} color="#94a3b8" style={{ position: 'absolute', left: 7 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜武将..."
                style={{
                  padding: '3px 8px 3px 22px',
                  borderRadius: 6,
                  border: '1px solid rgba(229,185,99,0.3)',
                  background: 'rgba(15,23,42,0.85)',
                  color: '#f8fafc',
                  fontSize: 11,
                  width: 96,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '8px 10px 4px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            className="crimson-btn"
            onClick={() => setBoxSeed((s) => s + 1)}
            style={{ padding: '4px 12px', borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} /> 无限换将卡
          </button>
        </div>
      )}

      {/* 3-Column Scrollable Hero Grid */}
      <div
        style={{
          flex: 1,
          padding: '8px 10px 16px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          alignContent: 'start',
        }}
      >
        {displayedHeroes.map((h) => {
          const isSelf = selectedHero.id === h.id;
          const isMate = teammateHero?.id === h.id;
          return (
            <div
              key={h.id}
              onClick={() => handleCardClick(h)}
              style={{
                position: 'relative',
                height: 146,
                borderRadius: 9,
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelf
                  ? '2.5px solid #fde047'
                  : isMate
                    ? '2.5px solid #38bdf8'
                    : '1px solid rgba(229,185,99,0.28)',
                boxShadow: isSelf ? '0 0 16px rgba(250, 204, 21, 0.55)' : '0 3px 8px rgba(0,0,0,0.45)',
              }}
            >
              <HeroArt hero={h} size="sm" />
              {isSelf && (
                <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#eab308', color: '#1c1205', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 4, zIndex: 5 }}>
                  自己
                </div>
              )}
              {isMate && (
                <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#0284c7', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 4, zIndex: 5 }}>
                  队友
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
