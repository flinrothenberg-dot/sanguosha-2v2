import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameMode, HeroDef, RankProfile } from './types/game';
import { HEROES } from './data/heroes';
import { shuffle } from './data/deck';
import { applyRankMatchResult, loadRankProfile } from './engine/rules';
import { GameController } from './engine/gameController';
import { sound } from './utils/sound';
import { LobbyScreen } from './components/LobbyScreen';
import { HeroSelectScreen } from './components/HeroSelectScreen';
import { HeroGalleryModal } from './components/HeroGalleryModal';
import { BattleScreen } from './components/BattleScreen';

type Screen = 'lobby' | 'select' | 'battle';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [mode, setMode] = useState<GameMode>('2v2');
  const [preselectedHero, setPreselectedHero] = useState<HeroDef | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [rank, setRank] = useState<RankProfile>(() => loadRankProfile());
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [controller, setController] = useState<GameController | null>(null);

  const lastConfigRef = useRef<{ mode: GameMode; humanHero: HeroDef; teammateHero?: HeroDef | null } | null>(null);
  const settledMatchRef = useRef<GameController | null>(null);

  const toggleSfx = () => {
    const next = !sfxEnabled;
    sound.sfxEnabled = next;
    setSfxEnabled(next);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    sound.voiceEnabled = next;
    setVoiceEnabled(next);
  };

  const launchMatch = useCallback(
    (matchMode: GameMode, humanHero: HeroDef, teammateHero?: HeroDef | null) => {
      if (controller) {
        controller.destroy();
      }
      lastConfigRef.current = { mode: matchMode, humanHero, teammateHero };

      const pool = shuffle(HEROES.filter((h) => h.id !== humanHero.id && h.id !== teammateHero?.id));
      let otherHeroes: HeroDef[] = [];
      if (matchMode === '2v2') {
        const mate = teammateHero ?? pool[2];
        otherHeroes = [pool[0], pool[1], mate];
      } else if (matchMode === 'landlord') {
        otherHeroes = [pool[0], pool[1]];
      } else {
        otherHeroes = [pool[0], pool[1], pool[2], pool[3]];
      }

      const nextCtrl = new GameController({
        mode: matchMode,
        humanHero,
        otherHeroes,
      });

      // Listen once for match end to update 2v2 rank
      const unsub = nextCtrl.subscribe((st) => {
        if (st.winner && settledMatchRef.current !== nextCtrl) {
          settledMatchRef.current = nextCtrl;
          const human = st.players.find((p) => p.isHuman);
          if (st.mode === '2v2') {
            setRank((prev) => applyRankMatchResult(prev, st.winner!.isHumanWin, human?.kills ?? 0));
          }
          unsub();
        }
      });

      setController(nextCtrl);
      setScreen('battle');
    },
    [controller]
  );

  useEffect(() => {
    return () => {
      if (controller) controller.destroy();
    };
  }, [controller]);

  const handleBackLobby = () => {
    if (controller) {
      controller.destroy();
      setController(null);
    }
    setScreen('lobby');
  };

  const handlePlayAgain = () => {
    const cfg = lastConfigRef.current;
    if (cfg) {
      launchMatch(cfg.mode, cfg.humanHero, cfg.teammateHero);
    } else {
      handleBackLobby();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 30%, #1c1917 0%, #090a0f 70%, #040507 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Mobile Portrait 9:16 Viewport Shell (Full-screen on phone, centered phone frame on PC) */}
      <div
        className="mobile-shell"
        style={{
          position: 'relative',
          width: 'min(100vw, 430px)',
          height: '100dvh',
          maxHeight: '932px',
          overflow: 'hidden',
          background: '#0b0e14',
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(229, 185, 99, 0.28)',
        }}
      >
        {screen === 'lobby' && (
          <LobbyScreen
            rank={rank}
            sfxEnabled={sfxEnabled}
            voiceEnabled={voiceEnabled}
            onToggleSfx={toggleSfx}
            onToggleVoice={toggleVoice}
            onSelectMode={(m) => {
              sound.playClick();
              setMode(m);
              setPreselectedHero(null);
              setScreen('select');
            }}
            onOpenGallery={() => {
              sound.playClick();
              setShowGallery(true);
            }}
          />
        )}

        {screen === 'select' && (
          <HeroSelectScreen
            mode={mode}
            initialHero={preselectedHero}
            onBack={() => {
              sound.playClick();
              setScreen('lobby');
            }}
            onStartMatch={(hero, mate) => {
              sound.playSkill();
              launchMatch(mode, hero, mate);
            }}
          />
        )}

        {screen === 'battle' && controller && (
          <BattleScreen
            controller={controller}
            rank={rank}
            sfxEnabled={sfxEnabled}
            voiceEnabled={voiceEnabled}
            onToggleSfx={toggleSfx}
            onToggleVoice={toggleVoice}
            onPlayAgain={handlePlayAgain}
            onBackLobby={handleBackLobby}
          />
        )}

        {showGallery && (
          <HeroGalleryModal
            onClose={() => setShowGallery(false)}
            onQuickStart2v2={(hero) => {
              sound.playClick();
              setShowGallery(false);
              setMode('2v2');
              setPreselectedHero(hero);
              setScreen('select');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default App;
