'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { GameEngine } from '@/engine/GameEngine';
import { Piece, STANDARD_PIECES, SUPPORT_WEIGHT_PIECE } from '@/engine/Piece';
import { TouchManager } from '@/engine/TouchManager';
import { GameRenderer } from '@/renderer/GameRenderer';
import { ClassicMode } from '@/engine/modes/ClassicMode';
import { BomberMode } from '@/engine/modes/BomberMode';
import { ArmoryMode } from '@/engine/modes/ArmoryMode';
import { PurifyMode } from '@/engine/modes/PurifyMode';
import {
  getHighScore, setHighScore, getGlobalHighScore, submitGlobalScore,
  getPlayerName, setPlayerName, addScoreHistory, getLocalRanking,
  getGlobalRanking, getPlayerContinent, RankingEntry,
  getShowRulesBeforeGame, setShowRulesBeforeGame as saveShowRulesBeforeGame,
  getSecretModeUnlocked, setSecretModeUnlocked,
  getEasterEggProgress,
  syncEasterEggProgress,
} from '@/lib/storage';
import { InputAction } from '@/engine/types';
import {
  getInterstitialDebugState,
  initializeAds,
  prepareInterstitial,
  refreshInterstitialDebugState,
  recordCompletedPlay,
  showInterstitial,
} from '@/lib/ads';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { EasterEggId } from '@/lib/easterEggs';
import {
  unlockAudio, startBGM, stopBGM, sfxMenuConfirm, sfxLock, sfxLineClear,
  sfxBombExplode, sfxChain, sfxHardDrop, sfxHold, sfxGameOver, sfxLevelUp,
} from '@/lib/sound';
import GameOverAdSense from '@/components/ads/GameOverAdSense';
import VirtualController from './VirtualController';
import RuleSheet from './RuleSheet';
import LanguagePicker from '@/components/i18n/LanguagePicker';
import { BOARD_HEIGHT, BOARD_WIDTH, HIDDEN_ROWS } from '@/lib/constants';

type SelectedMode = 'classic' | 'bomber' | 'armory' | 'purify';
type ScreenState = 'title' | 'playing' | 'game_over' | 'ranking';
type RankingTab = 'my' | 'regional' | 'world';
type ActivePanel = 'rules' | 'settings' | null;
type TitleColony = {
  id: number;
  leftPercent: number;
  size: number;
  durationMs: number;
};
type StatusBanner = {
  title: string;
  detail?: string;
  background: string;
  color: string;
};

type SnapshotCell = {
  x: number;
  y: number;
  visibleY: number | null;
  type: 'block' | 'bomb';
  color: number;
  core?: true;
  fire?: true;
  bombKind?: 'normal' | 'thunder' | 'cluster';
  weaponId?: string;
  fragmentIndex?: number;
  megaBomb?: true;
};

type SnapshotPiece = {
  name: string;
  x: number;
  y: number;
  rotation: number;
  occupiedCells: { x: number; y: number }[];
};

type GameSnapshot = {
  coordinateSystem: string;
  mode: SelectedMode;
  state: string;
  score: number;
  level: number;
  lines: number;
  speed: number;
  chainText: string;
  chainTimer: number;
  chainEffectTier: number;
  ghostY: number | null;
  filledCellCount: number;
  filledCells: SnapshotCell[];
  currentPiece: SnapshotPiece | null;
  holdPiece: string | null;
  nextPieces: string[];
};

type DebugWindow = Window & {
  __meteorCrushDebug?: Record<string, (...args: never[]) => unknown>;
  __meteorCrushState?: () => GameSnapshot | null;
  advanceTime?: (ms: number) => Promise<void>;
  render_game_to_text?: () => string;
};

function createPieceSnapshot(piece: Piece | null): SnapshotPiece | null {
  if (!piece) {
    return null;
  }

  return {
    name: piece.definition.name,
    x: piece.x,
    y: piece.y,
    rotation: piece.rotation,
    occupiedCells: piece.getOccupiedCells(),
  };
}

function createGameSnapshot(engine: GameEngine, mode: SelectedMode): GameSnapshot {
  const filledCells: SnapshotCell[] = [];

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = engine.board.getCell(x, y);
      if (cell.type === 'empty') {
        continue;
      }

      filledCells.push({
        x,
        y,
        visibleY: y,
        type: cell.type,
        color: cell.color,
        core: cell.core === true ? true : undefined,
        fire: cell.fire === true ? true : undefined,
        bombKind: cell.bombKind,
        weaponId: cell.weaponId,
        fragmentIndex: cell.fragmentIndex,
        megaBomb: cell.megaBomb === true ? true : undefined,
      });
    }
  }

  return {
    coordinateSystem: `board origin is top-left; x increases right; y increases downward; all ${BOARD_HEIGHT} rows are rendered; rows 0-${HIDDEN_ROWS - 1} are the spawn warning zone`,
    mode,
    state: engine.state,
    score: engine.score,
    level: engine.level,
    lines: engine.mode.type === 'purify'
      ? engine.getRemainingCoreCount()
      : engine.mode.type === 'armory'
        ? engine.getArmoryWeaponCount()
        : engine.totalLinesCleared,
    speed: engine.getSpeed(),
    chainText: engine.activeChainText,
    chainTimer: engine.chainTextTimer,
    chainEffectTier: engine.chainEffectTier,
    ghostY: engine.currentPiece ? engine.getGhostY() : null,
    filledCellCount: filledCells.length,
    filledCells,
    currentPiece: createPieceSnapshot(engine.currentPiece),
    holdPiece: engine.holdPiece?.name ?? null,
    nextPieces: engine.nextPieces.map((piece) => piece.name),
  };
}

const SECRET_MODE_SEQUENCE: SelectedMode[] = ['classic', 'classic', 'bomber', 'bomber', 'classic', 'bomber'];

const MOBILE_SAFE_AREA_ALLOWANCE = 24;
const MIN_CONTROLLER_HEIGHT = 112;
const MAX_CONTROLLER_HEIGHT = 150;
const MIN_TITLE_COLONY_SIZE = 42;
const MAX_TITLE_COLONY_SIZE = 74;
const GAME_OVER_INTERSTITIAL_DELAY_MS = 420;
const FIXED_TIMESTEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 100;
const MAX_CATCH_UP_STEPS = 6;

function isTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const uaDataMobile = typeof nav.userAgentData !== 'undefined' && typeof nav.userAgentData.mobile !== 'undefined'
    ? !!nav.userAgentData.mobile
    : false;
  const touchPointsOnCompactViewport = navigator.maxTouchPoints > 0 && window.innerWidth <= 900;
  const coarsePointerOnSmallScreen = window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900;
  return (
    uaDataMobile ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    touchPointsOnCompactViewport ||
    coarsePointerOnSmallScreen
  );
}

function getControllerHeight(viewportWidth: number): number {
  const calculated = Math.round(viewportWidth * 0.34);
  return Math.min(MAX_CONTROLLER_HEIGHT, Math.max(MIN_CONTROLLER_HEIGHT, calculated));
}

export default function GameCanvas() {
  const { lang, t, getContinentName } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const touchManagerRef = useRef<TouchManager | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const highScoreRef = useRef<number>(0);
  const globalHighScoreRef = useRef<number>(0);
  const selectedModeRef = useRef<SelectedMode>('purify');
  const secretModeUnlockedRef = useRef(true);
  const secretSequenceRef = useRef<SelectedMode[]>([]);
  const unlockBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleColonySpawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleColonyDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameOverInterstitialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purifyWaveSeenRef = useRef(false);
  const screenStateRef = useRef<ScreenState>('title');
  const previousScreenRef = useRef<ScreenState>('title');
  const showRulesBeforeGameRef = useRef(true);
  const activePanelRef = useRef<ActivePanel>(null);
  const [screenState, setScreenState] = useState<ScreenState>('title');
  const [selectedMode, setSelectedMode] = useState<SelectedMode>('purify');
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [controllerHeight, setControllerHeight] = useState(MAX_CONTROLLER_HEIGHT);
  const [lastScore, setLastScore] = useState(0);
  const [lastHighScore, setLastHighScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showRulesBeforeGame, setShowRulesBeforeGameState] = useState(true);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [secretModeUnlocked, setSecretModeUnlockedState] = useState(true);
  const [unlockBannerVisible, setUnlockBannerVisible] = useState(false);
  const [titleColony, setTitleColony] = useState<TitleColony | null>(null);
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);
  const [foundEggIds, setFoundEggIds] = useState<EasterEggId[]>([]);
  const [easterEggCount, setEasterEggCount] = useState(0);
  const [adFreeUntil, setAdFreeUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [adDebugState, setAdDebugState] = useState(() => getInterstitialDebugState());
  const [adActionBusy, setAdActionBusy] = useState(false);
  const [adActionStatus, setAdActionStatus] = useState('Idle');

  // Ranking state
  const [rankingTab, setRankingTab] = useState<RankingTab>('my');
  const [rankingMode, setRankingMode] = useState<SelectedMode>('purify');
  const [rankingData, setRankingData] = useState<RankingEntry[]>([]);
  const [localRanking, setLocalRanking] = useState<{ score: number; level: number; lines: number; date: string }[]>([]);
  const [playerContinent, setPlayerContinent] = useState('XX');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<ScreenState>('title');

  // Name input state
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const lastGameInfoRef = useRef<{ score: number; level: number; lines: number }>({ score: 0, level: 0, lines: 0 });
  const refreshAdDebugState = useCallback(async () => {
    const nextState = await refreshInterstitialDebugState();
    setAdDebugState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const debugApi = {
      getState: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        return createGameSnapshot(engine, selectedModeRef.current);
      },
      loadSupportWeightScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ClassicMode());
        engine.board.reset();
        engine.board.setCell(4, 3, { type: 'block', color: 4 });
        engine.board.setCell(4, 18, { type: 'block', color: 1 });
        engine.board.setCell(5, 17, { type: 'block', color: 2 });
        engine.board.setCell(6, 15, { type: 'block', color: 3 });
        engine.currentPiece = new Piece(SUPPORT_WEIGHT_PIECE, 4, 13);
        engine.state = 'playing';
        setSelectedMode('classic');
        setScreenState('playing');

        return {
          currentPiece: engine.currentPiece.definition.name,
          occupiedCells: engine.currentPiece.getOccupiedCells(),
        };
      },
      loadClassicOverflowScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        const novaPiece = STANDARD_PIECES.find((piece) => piece.name === 'Nova');
        if (!novaPiece) return null;

        engine.start(new ClassicMode());
        engine.board.reset();
        engine.currentPiece = new Piece(novaPiece, 4, -1);
        engine.state = 'playing';
        setSelectedMode('classic');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          currentPiece: engine.currentPiece.definition.name,
          occupiedCells: engine.currentPiece.getOccupiedCells(),
        };
      },
      lockCurrentPiece: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        (engine as unknown as { lockPiece: () => void }).lockPiece();

        return {
          currentPiece: engine.currentPiece?.definition.name ?? null,
          board: engine.board.grid.map((row) => row.map((cell) => ({
            type: cell.type,
            color: cell.color,
            core: cell.core === true,
          }))),
          chainText: engine.activeChainText,
        };
      },
      loadBomberIgnitionScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new BomberMode());
        engine.board.reset();

        engine.board.setCell(4, 12, { type: 'bomb', color: 16, bombKind: 'thunder' });
        engine.board.setCell(3, 12, { type: 'block', color: 15, fire: true });
        engine.board.setCell(0, 8, { type: 'bomb', color: 17, bombKind: 'cluster' });
        engine.board.setCell(0, 12, { type: 'block', color: 5 });
        engine.board.setCell(7, 15, { type: 'bomb', color: 8, bombKind: 'normal' });
        engine.board.setCell(8, 15, { type: 'bomb', color: 8, bombKind: 'normal' });
        engine.board.setCell(7, 16, { type: 'bomb', color: 8, bombKind: 'normal' });
        engine.board.setCell(8, 16, { type: 'bomb', color: 8, bombKind: 'normal' });
        engine.board.setCell(6, 15, { type: 'block', color: 1, fire: true });
        engine.board.setCell(11, 19, { type: 'block', color: 2 });
        engine.board.setCell(10, 18, { type: 'block', color: 3 });
        engine.board.setCell(2, 10, { type: 'block', color: 0 });
        engine.board.setCell(6, 10, { type: 'block', color: 1 });
        engine.board.setCell(2, 14, { type: 'block', color: 2 });
        engine.board.setCell(6, 14, { type: 'block', color: 3 });
        (engine as unknown as { refreshMegaBombs: () => void }).refreshMegaBombs();
        engine.currentPiece = null;
        engine.state = 'playing';
        setSelectedMode('bomber');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
        };
      },
      resolveBomberBoard: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        (engine as unknown as { beginBomberChain: () => void }).beginBomberChain();
        for (let i = 0; i < 20 && engine.state === 'chain_resolving'; i++) {
          engine.tick(500);
        }

        return {
          mode: engine.mode.type,
          state: engine.state,
          chainText: engine.activeChainText,
          score: engine.score,
          lines: engine.totalLinesCleared,
        };
      },
      loadArmoryBombScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ArmoryMode());
        engine.board.reset();

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            engine.board.setCell(4 + col, 12 + row, {
              type: 'block',
              color: 12,
              weaponId: 'bomb',
              fragmentIndex: row * 2 + col,
            });
          }
        }
        engine.board.setCell(3, 12, { type: 'block', color: 0 });
        engine.board.setCell(6, 13, { type: 'block', color: 1 });
        engine.state = 'playing';
        setSelectedMode('armory');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
        };
      },
      loadArmorySpearScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ArmoryMode());
        engine.board.reset();

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            engine.board.setCell(3 + col, 12 + row, {
              type: 'block',
              color: 20,
              weaponId: 'spear',
              fragmentIndex: row * 2 + col,
            });
          }
        }
        engine.board.setCell(8, 12, { type: 'block', color: 0 });
        engine.board.setCell(8, 13, { type: 'block', color: 1 });
        engine.board.setCell(2, 12, { type: 'block', color: 2 });
        engine.state = 'playing';
        setSelectedMode('armory');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
          weapon: 'spear',
        };
      },
      loadArmoryOverlapScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ArmoryMode());
        engine.board.reset();

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            engine.board.setCell(4 + col, 12 + row, {
              type: 'block',
              color: 12,
              weaponId: 'bomb',
              fragmentIndex: row * 3 + col,
            });
          }
        }
        engine.board.setCell(1, 9, { type: 'block', color: 0 });
        engine.board.setCell(7, 14, { type: 'block', color: 1 });
        engine.state = 'playing';
        setSelectedMode('armory');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
          weapon: 'bomb',
          overlap: true,
        };
      },
      loadArmoryOverdriveChainScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ArmoryMode());
        engine.board.reset();

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            engine.board.setCell(4 + col, 12 + row, {
              type: 'block',
              color: 18,
              weaponId: 'katana',
              fragmentIndex: row * 3 + col,
            });
          }
        }

        engine.board.setCell(3, 13, {
          type: 'block',
          color: 12,
          weaponId: 'bomb',
          fragmentIndex: 0,
        });
        engine.board.setCell(6, 16, {
          type: 'block',
          color: 14,
          weaponId: 'pan',
          fragmentIndex: 0,
        });
        engine.board.setCell(0, 11, { type: 'block', color: 6 });
        engine.board.setCell(9, 15, { type: 'block', color: 1 });
        engine.state = 'playing';
        setSelectedMode('armory');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
          weapon: 'katana',
          overdrive: true,
          chainTargets: ['bomb', 'pan'],
        };
      },
      loadArmoryJunkScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new ArmoryMode());
        engine.board.reset();

        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            engine.board.setCell(4 + col, 13 + row, {
              type: 'block',
              color: 14,
              weaponId: 'pan',
              fragmentIndex: row * 2 + col,
            });
          }
        }
        engine.board.setCell(1, 12, { type: 'block', color: 6 });
        engine.board.setCell(3, 13, { type: 'block', color: 4 });
        engine.board.setCell(8, 14, { type: 'block', color: 1 });
        engine.board.setCell(10, 15, { type: 'block', color: 5 });
        engine.board.setCell(9, 13, {
          type: 'block',
          color: 11,
          weaponId: 'missile',
          fragmentIndex: 0,
        });
        engine.state = 'playing';
        setSelectedMode('armory');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
          weapon: 'pan',
          junkMixed: true,
        };
      },
      loadPurifyLineScenario: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        engine.start(new PurifyMode());
        engine.board.reset();
        engine.board.setCell(3, 13, { type: 'block', color: 1 });
        engine.board.setCell(4, 13, { type: 'block', color: 1 });
        engine.board.setCell(5, 13, { type: 'block', color: 1 });
        engine.board.setCell(6, 13, { type: 'block', color: 1 });
        engine.board.setCell(3, 10, { type: 'block', color: 2, core: true });
        engine.board.setCell(4, 12, { type: 'block', color: 5 });
        engine.board.setCell(5, 9, { type: 'block', color: 2 });
        engine.state = 'playing';
        setSelectedMode('purify');
        setScreenState('playing');

        return {
          mode: engine.mode.type,
          boardSeeded: true,
          mechanic: 'line-clear',
        };
      },
      resolvePurifyBoard: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        (engine as unknown as { resolvePurifyMatches: () => void }).resolvePurifyMatches();

        return {
          mode: engine.mode.type,
          chainText: engine.activeChainText,
          score: engine.score,
          remainingCores: engine.getRemainingCoreCount(),
        };
      },
      resolveArmoryBoard: () => {
        const engine = engineRef.current;
        if (!engine) return null;

        (engine as unknown as { resolveArmoryMatches: () => void }).resolveArmoryMatches();

        return {
          mode: engine.mode.type,
          chainText: engine.activeChainText,
          weapons: engine.getArmoryWeaponCount(),
          score: engine.score,
        };
      },
    };

    (window as DebugWindow).__meteorCrushDebug = debugApi;

    return () => {
      delete (window as DebugWindow).__meteorCrushDebug;
    };
  }, []);

  useEffect(() => {
    const mobile = isTouchCapable();
    const shouldShowRules = getShowRulesBeforeGame();
    const secretUnlocked = getSecretModeUnlocked();
    const eggProgress = getEasterEggProgress();
    const playerName = getPlayerName();
    setIsMobile(mobile);
    setViewportWidth(window.innerWidth);
    setShowRulesBeforeGameState(shouldShowRules);
    setSecretModeUnlockedState(secretUnlocked);
    setFoundEggIds(eggProgress.foundIds);
    setEasterEggCount(eggProgress.foundCount);
    setAdFreeUntil(eggProgress.adFreeUntil);
    showRulesBeforeGameRef.current = shouldShowRules;
    secretModeUnlockedRef.current = secretUnlocked;
    if (mobile) {
      setControllerHeight(getControllerHeight(window.innerWidth));
    }
    void initializeAds().finally(refreshAdDebugState);
    void prepareInterstitial().finally(refreshAdDebugState);
    setPlayerNameInput(playerName);
    getPlayerContinent().then(c => setPlayerContinent(c));
    if (playerName) {
      void syncEasterEggProgress(playerName).then((remote) => {
        if (!remote) return;
        setFoundEggIds(remote.foundIds);
        setEasterEggCount(remote.foundCount);
        setAdFreeUntil(remote.adFreeUntil);
        if (remote.secretModeUnlocked) {
          secretModeUnlockedRef.current = true;
          setSecretModeUnlockedState(true);
          setSecretModeUnlocked(true);
        }
      });
    }
  }, [refreshAdDebugState]);

  useEffect(() => {
    screenStateRef.current = screenState;
  }, [screenState]);

  useEffect(() => {
    previousScreenRef.current = previousScreen;
  }, [previousScreen]);

  useEffect(() => {
    showRulesBeforeGameRef.current = showRulesBeforeGame;
  }, [showRulesBeforeGame]);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    secretModeUnlockedRef.current = secretModeUnlocked;
  }, [secretModeUnlocked]);

  const clearTitleColonyTimers = useCallback(() => {
    if (titleColonySpawnTimerRef.current) {
      clearTimeout(titleColonySpawnTimerRef.current);
      titleColonySpawnTimerRef.current = null;
    }
    if (titleColonyDismissTimerRef.current) {
      clearTimeout(titleColonyDismissTimerRef.current);
      titleColonyDismissTimerRef.current = null;
    }
  }, []);

  const clearGameOverInterstitialTimer = useCallback(() => {
    if (gameOverInterstitialTimerRef.current) {
      clearTimeout(gameOverInterstitialTimerRef.current);
      gameOverInterstitialTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (unlockBannerTimerRef.current) {
        clearTimeout(unlockBannerTimerRef.current);
      }
      if (statusBannerTimerRef.current) {
        clearTimeout(statusBannerTimerRef.current);
      }
      clearTitleColonyTimers();
      clearGameOverInterstitialTimer();
    };
  }, [clearGameOverInterstitialTimer, clearTitleColonyTimers]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const showTemporaryBanner = useCallback((banner: StatusBanner, durationMs: number = 2600) => {
    setStatusBanner(banner);
    if (statusBannerTimerRef.current) {
      clearTimeout(statusBannerTimerRef.current);
    }
    statusBannerTimerRef.current = setTimeout(() => {
      setStatusBanner(null);
    }, durationMs);
  }, []);

  const queueGameOverInterstitial = useCallback(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    clearGameOverInterstitialTimer();
    refreshAdDebugState();
    const delayMs = getInterstitialDebugState().debugToolsEnabled ? 0 : GAME_OVER_INTERSTITIAL_DELAY_MS;
    gameOverInterstitialTimerRef.current = setTimeout(() => {
      gameOverInterstitialTimerRef.current = null;
      void showInterstitial({
        shouldShow: () => (
          screenStateRef.current === 'game_over' &&
          activePanelRef.current === null
        ),
      }).finally(refreshAdDebugState);
    }, delayMs);
  }, [clearGameOverInterstitialTimer, refreshAdDebugState]);

  const runAdDebugAction = useCallback((label: string, action: () => Promise<boolean>) => {
    if (adActionBusy) return;
    void (async () => {
      setAdActionBusy(true);
      setAdActionStatus(`${label}: running`);
      const success = await action();
      const state = await refreshAdDebugState();
      setAdActionStatus(`${label}: ${state.lastDecision}`);
      showTemporaryBanner({
        title: success ? `${label} OK` : `${label} FAILED`,
        detail: state.lastAdError || state.lastDecisionDetail,
        background: success ? 'rgba(94,196,196,0.18)' : 'rgba(255, 90, 90, 0.18)',
        color: success ? '#7be8e8' : '#ff9f9f',
      }, success ? 2600 : 4200);
      setAdActionBusy(false);
    })();
  }, [adActionBusy, refreshAdDebugState, showTemporaryBanner]);

  const runManualAdTest = useCallback(() => {
    runAdDebugAction('FULL TEST', async () => {
      const prepared = await prepareInterstitial();
      if (!prepared) {
        return false;
      }
      return showInterstitial({ shouldShow: () => true });
    });
  }, [runAdDebugAction]);

  const runInitializeAdTest = useCallback(() => {
    runAdDebugAction('INIT', initializeAds);
  }, [runAdDebugAction]);

  const runPrepareAdTest = useCallback(() => {
    runAdDebugAction('PREPARE', prepareInterstitial);
  }, [runAdDebugAction]);

  const runShowAdTest = useCallback(() => {
    runAdDebugAction('SHOW', () => showInterstitial({ shouldShow: () => true }));
  }, [runAdDebugAction]);

  const markEggDiscovered = useCallback((_id: EasterEggId) => {}, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewportW = window.innerWidth;
    setViewportWidth(viewportW);
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const mobile = isTouchCapable();
    const nextControllerHeight = mobile ? getControllerHeight(viewportW) : MAX_CONTROLLER_HEIGHT;
    setIsMobile(mobile);
    setControllerHeight(nextControllerHeight);
    const controllerH = mobile ? nextControllerHeight + MOBILE_SAFE_AREA_ALLOWANCE : 0;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      rendererRef.current?.resize(rect.width, rect.height, controllerH);
      touchManagerRef.current?.updateLayout();
    }
  }, []);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    clearGameOverInterstitialTimer();
    const mode = selectedModeRef.current;
    unlockAudio();
    sfxMenuConfirm();
    void prepareInterstitial().finally(refreshAdDebugState);
    purifyWaveSeenRef.current = false;
    highScoreRef.current = getHighScore(mode);
    if (mode === 'classic') markEggDiscovered('start_classic');
    if (mode === 'bomber') markEggDiscovered('start_bomber');
    if (mode === 'purify') markEggDiscovered('start_purify');
    if (mode === 'purify') {
      globalHighScoreRef.current = 0;
    } else {
      getGlobalHighScore(mode).then(s => { globalHighScoreRef.current = s; });
    }
    const gameMode = mode === 'bomber'
      ? new BomberMode()
      : mode === 'armory'
        ? new ArmoryMode()
        : mode === 'purify'
        ? new PurifyMode()
        : new ClassicMode();
    engine.start(gameMode);
    accumulatorRef.current = 0;
    lastTimeRef.current = 0;
    startBGM();
    setActivePanel(null);
    setScreenState('playing');
    setNameSubmitted(false);
    requestAnimationFrame(() => resizeCanvas());
  }, [clearGameOverInterstitialTimer, markEggDiscovered, refreshAdDebugState, resizeCanvas]);

  const handleStartRequest = useCallback(() => {
    unlockAudio();
    if (showRulesBeforeGameRef.current) {
      markEggDiscovered('open_rules');
      setActivePanel('rules');
      return;
    }
    startGame();
  }, [markEggDiscovered, startGame]);

  const handleStartFromRules = useCallback(() => {
    setActivePanel(null);
    startGame();
  }, [startGame]);

  const revealSecretMode = useCallback(() => {
    if (secretModeUnlockedRef.current) return;
    clearTitleColonyTimers();
    setTitleColony(null);
    secretModeUnlockedRef.current = true;
    setSecretModeUnlockedState(true);
    setSecretModeUnlocked(true);
    markEggDiscovered('purify_unlocked');
    selectedModeRef.current = 'purify';
    setSelectedMode('purify');
    setUnlockBannerVisible(true);
    if (unlockBannerTimerRef.current) {
      clearTimeout(unlockBannerTimerRef.current);
    }
    unlockBannerTimerRef.current = setTimeout(() => {
      setUnlockBannerVisible(false);
    }, 2600);
  }, [clearTitleColonyTimers, markEggDiscovered]);

  const trackSecretModeSequence = useCallback((mode: SelectedMode): boolean => {
    if (secretModeUnlockedRef.current || engineRef.current?.state === 'playing') return false;
    if (mode === 'armory' || mode === 'purify') {
      secretSequenceRef.current = [];
      return false;
    }

    const next = [...secretSequenceRef.current, mode].slice(-SECRET_MODE_SEQUENCE.length);
    const validPrefix = SECRET_MODE_SEQUENCE.slice(0, next.length).every((entry, index) => entry === next[index]);
    secretSequenceRef.current = validPrefix ? next : [mode];

    const unlocked = SECRET_MODE_SEQUENCE.every((entry, index) => secretSequenceRef.current[index] === entry);
    if (unlocked) {
      secretSequenceRef.current = [];
      revealSecretMode();
      return true;
    }
    return false;
  }, [revealSecretMode]);

  const handleToggleShowRulesBeforeGame = useCallback((show: boolean) => {
    setShowRulesBeforeGameState(show);
    saveShowRulesBeforeGame(show);
    markEggDiscovered('toggle_rule_cards');
  }, [markEggDiscovered]);

  const handleTitleColonyTap = useCallback(() => {
    unlockAudio();
    sfxLevelUp();
    revealSecretMode();
  }, [revealSecretMode]);

  const queueAction = useCallback((engine: GameEngine | null, action: InputAction) => {
    if (!engine) return;
    if (action === 'hardDrop') sfxHardDrop();
    if (action === 'hold') sfxHold();
    engine.inputManager.pulseAction(action);
  }, []);

  const loadRanking = useCallback(async (tab: RankingTab, mode: SelectedMode) => {
    if (tab === 'my') {
      setLocalRanking(getLocalRanking(mode));
      return;
    }
    if (mode === 'purify') {
      setRankingLoading(false);
      setRankingData([]);
      return;
    }
    setRankingLoading(true);
    try {
      const region = tab === 'world' ? 'world' : 'continent';
      const result = await getGlobalRanking(mode, region);
      setRankingData(result.rankings);
      if (result.callerContinent && result.callerContinent !== 'XX') {
        setPlayerContinent(result.callerContinent);
      }
    } catch {
      setRankingData([]);
    }
    setRankingLoading(false);
  }, []);

  const openRanking = useCallback((from: ScreenState) => {
    clearGameOverInterstitialTimer();
    if (from === 'title') markEggDiscovered('open_ranking_title');
    if (from === 'game_over') markEggDiscovered('open_ranking_game_over');
    setPreviousScreen(from);
    setScreenState('ranking');
    setRankingMode(selectedModeRef.current);
    setRankingTab('my');
    setLocalRanking(getLocalRanking(selectedModeRef.current));
  }, [clearGameOverInterstitialTimer, markEggDiscovered]);

  const closeRanking = useCallback(() => {
    markEggDiscovered('close_ranking');
    setScreenState(previousScreen === 'game_over' ? 'game_over' : 'title');
  }, [markEggDiscovered, previousScreen]);

  const handleRankingTabChange = useCallback((tab: RankingTab) => {
    if (tab === 'regional') markEggDiscovered('switch_ranking_regional');
    if (tab === 'world') markEggDiscovered('switch_ranking_world');
    setRankingTab(tab);
    loadRanking(tab, rankingMode);
  }, [loadRanking, markEggDiscovered, rankingMode]);

  const handleOpenRules = useCallback(() => {
    clearGameOverInterstitialTimer();
    markEggDiscovered('open_rules');
    setActivePanel('rules');
  }, [clearGameOverInterstitialTimer, markEggDiscovered]);

  const handleCloseRules = useCallback(() => {
    markEggDiscovered('close_rules');
    setActivePanel(null);
  }, [markEggDiscovered]);

  const handleOpenSettings = useCallback(() => {
    clearGameOverInterstitialTimer();
    markEggDiscovered('open_settings');
    setActivePanel('settings');
  }, [clearGameOverInterstitialTimer, markEggDiscovered]);

  const applyModeSelection = useCallback((mode: SelectedMode) => {
    if (mode !== 'purify') {
      const unlockedNow = trackSecretModeSequence(mode);
      if (unlockedNow) {
        return;
      }
    }
    selectedModeRef.current = mode;
    setSelectedMode(mode);
  }, [trackSecretModeSequence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new GameRenderer(ctx);
    rendererRef.current = renderer;

    highScoreRef.current = getHighScore(selectedModeRef.current);
    if (selectedModeRef.current === 'purify') {
      globalHighScoreRef.current = 0;
    } else {
      getGlobalHighScore(selectedModeRef.current).then(s => { globalHighScoreRef.current = s; });
    }

    const engine = new GameEngine({
      onPieceLock: () => { sfxLock(); },
      onLevelChange: () => { sfxLevelUp(); },
      onLineClear: (event) => {
        if (event.linesCleared > 0) sfxLineClear(event.linesCleared);
        if (selectedModeRef.current === 'classic' && event.linesCleared >= 4) {
          markEggDiscovered('tetris_clear');
        }
      },
      onGameOver: (score) => {
        stopBGM();
        sfxGameOver();
        const mode = selectedModeRef.current;
        const isNew = setHighScore(mode, score);
        if (isNew) highScoreRef.current = score;
        lastGameInfoRef.current = {
          score,
          level: engine.level,
          lines: engine.totalLinesCleared,
        };
        addScoreHistory(mode, { score, level: engine.level, lines: engine.totalLinesCleared });
        setLastScore(score);
        setLastHighScore(highScoreRef.current);
        setIsNewHighScore(isNew);
        setScreenState('game_over');
        screenStateRef.current = 'game_over';
        setNameSubmitted(false);
        setPlayerNameInput(getPlayerName());
        recordCompletedPlay();
        refreshAdDebugState();
        queueGameOverInterstitial();
      },
    });
    engineRef.current = engine;
    const debugWindow = window as DebugWindow;
    const getSnapshot = () => createGameSnapshot(engine, selectedModeRef.current);
    debugWindow.__meteorCrushState = getSnapshot;
    debugWindow.render_game_to_text = () => JSON.stringify(getSnapshot());

    const touchManager = new TouchManager((action) => queueAction(engine, action));
    touchManagerRef.current = touchManager;
    if (isTouchCapable()) {
      touchManager.bind(canvas);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (activePanelRef.current === 'settings') {
        if (e.code === 'Escape') {
          e.preventDefault();
          setActivePanel(null);
        }
        return;
      }

      if (activePanelRef.current === 'rules') {
        if (e.code === 'Escape') {
          e.preventDefault();
          handleCloseRules();
          return;
        }

        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault();
          markEggDiscovered('start_from_rules');
          setActivePanel(null);
          startGame();
        }
        return;
      }

      if (screenStateRef.current === 'ranking') {
        if (e.code === 'Escape') {
          e.preventDefault();
          closeRanking();
        }
        return;
      }

      if (engine.state === 'title' || engine.state === 'game_over') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          applyModeSelection('classic');
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          applyModeSelection('bomber');
          return;
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          applyModeSelection('armory');
          return;
        }
        if (e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault();
          applyModeSelection('purify');
          return;
        }
      }
      if (e.code === 'Space') {
        if (engine.state === 'title' || engine.state === 'game_over') {
          e.preventDefault();
          if (engine.state === 'game_over') {
            markEggDiscovered('retry_from_game_over');
          }
          handleStartRequest();
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (engine.state === 'playing' || engine.state === 'paused') {
          engine.pause();
        } else if (e.code === 'Escape' && engine.state === 'game_over') {
          engine.state = 'title';
          markEggDiscovered('return_to_title');
          setScreenState('title');
          requestAnimationFrame(() => resizeCanvas());
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    const applyFixedUpdateStep = (stepMs: number) => {
      if (engine.state === 'playing' || engine.state === 'chain_resolving') {
        engine.tick(stepMs);
        if (engine.mode.type === 'purify' && engine.activeChainText === 'AREA PURIFIED' && !purifyWaveSeenRef.current) {
          purifyWaveSeenRef.current = true;
          markEggDiscovered('purify_wave');
        }
        return;
      }

      if (engine.state === 'game_over') {
        engine.gameOverTimer += stepMs;
      }
    };

    const runSimulation = (frameDeltaMs: number) => {
      const clampedDelta = Math.max(0, Math.min(frameDeltaMs, MAX_FRAME_DELTA_MS));
      const maxAccumulatedDelta = FIXED_TIMESTEP_MS * MAX_CATCH_UP_STEPS;
      accumulatorRef.current = Math.min(accumulatorRef.current + clampedDelta, maxAccumulatedDelta);

      let steps = 0;
      while (accumulatorRef.current >= FIXED_TIMESTEP_MS && steps < MAX_CATCH_UP_STEPS) {
        applyFixedUpdateStep(FIXED_TIMESTEP_MS);
        accumulatorRef.current -= FIXED_TIMESTEP_MS;
        steps += 1;
      }

      if (steps === MAX_CATCH_UP_STEPS && accumulatorRef.current >= FIXED_TIMESTEP_MS) {
        accumulatorRef.current = accumulatorRef.current % FIXED_TIMESTEP_MS;
      }

      return clampedDelta;
    };

    const drawCurrentFrame = (deltaTime: number) => {
      if (engine.visualEvents.length > 0) {
        for (const ev of engine.visualEvents) {
          if (ev.type === 'explosion') {
            sfxBombExplode();
            if (engine.mode.type === 'bomber') {
              markEggDiscovered('bomber_blast');
            }
          }
        }
        if (engine.activeChainText && engine.chainEffectTier > 0) {
          sfxChain(engine.chainEffectTier);
        }
        renderer.processVisualEvents(engine.visualEvents);
        engine.visualEvents = [];
      }
      renderer.render(
        engine.board, engine.currentPiece, engine.getGhostY(),
        engine.mode.type,
        engine.score,
        engine.level,
        engine.mode.type === 'purify'
          ? engine.getRemainingCoreCount()
          : engine.mode.type === 'armory'
            ? engine.getArmoryWeaponCount()
            : engine.totalLinesCleared,
        engine.getSpeed(),
        highScoreRef.current, globalHighScoreRef.current,
        engine.nextPieces, engine.holdPiece,
        engine.activeChainText, engine.chainTextTimer, engine.chainEffectTier,
        deltaTime,
      );
    };

    debugWindow.advanceTime = async (ms: number) => {
      const normalizedMs = Math.max(0, ms);
      const wholeSteps = Math.max(0, Math.round(normalizedMs / FIXED_TIMESTEP_MS));

      for (let step = 0; step < wholeSteps; step += 1) {
        applyFixedUpdateStep(FIXED_TIMESTEP_MS);
      }

      const steppedDelta = wholeSteps > 0 ? FIXED_TIMESTEP_MS : runSimulation(normalizedMs);
      if (wholeSteps > 0) {
        accumulatorRef.current = 0;
      }
      if (engine.state === 'title') {
        renderer.drawTitleBackground();
      } else if (engine.state === 'paused') {
        drawCurrentFrame(0);
        renderer.drawPaused();
      } else {
        drawCurrentFrame(steppedDelta);
        if (engine.state === 'game_over') {
          renderer.drawGameOver(engine.score, highScoreRef.current, engine.gameOverTimer, engine.board);
        }
      }
      lastTimeRef.current = performance.now();
    };

    const loop = (timestamp: number) => {
      const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : FIXED_TIMESTEP_MS;
      lastTimeRef.current = timestamp;
      if (engine.state === 'title') {
        accumulatorRef.current = 0;
        renderer.drawTitleBackground();
      } else if (engine.state === 'paused') {
        drawCurrentFrame(0);
        renderer.drawPaused();
      } else {
        const steppedDelta = runSimulation(deltaTime);
        drawCurrentFrame(steppedDelta);
        if (engine.state === 'game_over') {
          renderer.drawGameOver(engine.score, highScoreRef.current, engine.gameOverTimer, engine.board);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleGlobalKey);
      touchManager.unbind(canvas);
      touchManagerRef.current = null;
      delete debugWindow.__meteorCrushState;
      delete debugWindow.advanceTime;
      delete debugWindow.render_game_to_text;
      engine.destroy();
    };
  }, [applyModeSelection, closeRanking, handleCloseRules, handleStartRequest, markEggDiscovered, queueAction, queueGameOverInterstitial, refreshAdDebugState, resizeCanvas, startGame]);

  const handleControllerAction = useCallback((action: InputAction) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.state === 'playing') {
      queueAction(engine, action);
    }
    if (engine.state === 'paused' && action === 'pause') {
      engine.pause();
    }
  }, [queueAction]);

  const handleControllerActionStart = useCallback((action: InputAction) => {
    const engine = engineRef.current;
    if (!engine || engine.state !== 'playing') return;

    if (action === 'down') {
      engine.inputManager.pressAction('down');
    }
  }, []);

  const handleControllerActionEnd = useCallback((action: InputAction) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (action === 'down') {
      engine.inputManager.releaseAction('down');
    }
  }, []);

  const handleModeSelect = useCallback((mode: SelectedMode) => {
    applyModeSelection(mode);
  }, [applyModeSelection]);

  useEffect(() => {
    if (screenState !== 'title' || activePanel !== null || secretModeUnlocked) {
      clearTitleColonyTimers();
      setTitleColony(null);
      return;
    }

    let cancelled = false;

    const scheduleNextColony = () => {
      if (cancelled) return;

      const spawnDelayMs = 5000 + Math.round(Math.random() * 7000);
      titleColonySpawnTimerRef.current = setTimeout(() => {
        if (cancelled) return;

        const baseWidth = viewportWidth > 0 ? viewportWidth : (isMobile ? 390 : 960);
        const colonySize = Math.round(
          Math.min(MAX_TITLE_COLONY_SIZE, Math.max(MIN_TITLE_COLONY_SIZE, baseWidth * (isMobile ? 0.115 : 0.075))),
        );
        const durationMs = 4800 + Math.round(Math.random() * 1800);
        const nextColony: TitleColony = {
          id: Date.now(),
          leftPercent: 14 + Math.random() * 72,
          size: colonySize,
          durationMs,
        };

        setTitleColony(nextColony);

        titleColonyDismissTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          setTitleColony((current) => current?.id === nextColony.id ? null : current);
          scheduleNextColony();
        }, durationMs + 220);
      }, spawnDelayMs);
    };

    scheduleNextColony();

    return () => {
      cancelled = true;
      clearTitleColonyTimers();
    };
  }, [activePanel, clearTitleColonyTimers, isMobile, screenState, secretModeUnlocked, viewportWidth]);

  const handleNameSubmit = useCallback(() => {
    const name = playerNameInput.trim() || 'Anonymous';
    setPlayerName(name);
    setPlayerNameInput(name);
    markEggDiscovered('submit_name');
    void syncEasterEggProgress(name).then((remote) => {
      if (!remote) return;
      setFoundEggIds(remote.foundIds);
      setEasterEggCount(remote.foundCount);
      setAdFreeUntil(remote.adFreeUntil);
      if (remote.secretModeUnlocked) {
        secretModeUnlockedRef.current = true;
        setSecretModeUnlockedState(true);
        setSecretModeUnlocked(true);
      }
    });
    const mode = selectedModeRef.current;
    const info = lastGameInfoRef.current;
    if (mode !== 'purify') {
      submitGlobalScore(mode, info.score);
    }
    setNameSubmitted(true);
  }, [markEggDiscovered, playerNameInput]);

  const goToTitle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    clearGameOverInterstitialTimer();
    stopBGM();
    if (screenStateRef.current === 'game_over') {
      markEggDiscovered('return_to_title');
    }
    engine.state = 'title';
    accumulatorRef.current = 0;
    lastTimeRef.current = 0;
    setScreenState('title');
    requestAnimationFrame(() => resizeCanvas());
  }, [clearGameOverInterstitialTimer, markEggDiscovered, resizeCanvas]);

  const handleRetryRequest = useCallback(() => {
    if (screenStateRef.current === 'game_over') {
      markEggDiscovered('retry_from_game_over');
    }
    handleStartRequest();
  }, [handleStartRequest, markEggDiscovered]);

  const getModeTheme = (mode: SelectedMode) => {
    if (mode === 'bomber') {
      return {
        background: '#3a1a1a',
        color: '#ff4444',
        glow: '#ff2244',
      };
    }
    if (mode === 'armory') {
      return {
        background: '#3a2818',
        color: '#ffb45d',
        glow: '#f0922d',
      };
    }
    if (mode === 'purify') {
      return {
        background: '#1f3320',
        color: '#9be07a',
        glow: '#79d85a',
      };
    }
    return {
      background: '#1a3a4a',
      color: '#5ec4c4',
      glow: '#5ec4c4',
    };
  };

  const modeButton = (mode: SelectedMode, label: string, small = false) => {
    const theme = getModeTheme(mode);
    return (
      <button
        key={mode}
        onClick={() => handleModeSelect(mode)}
        style={{
          padding: small ? '8px 16px' : '16px 24px',
          fontSize: small ? '14px' : '18px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          background: selectedMode === mode ? theme.background : '#1a1a2a',
          color: selectedMode === mode ? theme.color : '#556',
          border: selectedMode === mode ? `2px solid ${theme.color}` : '2px solid #333',
          borderRadius: '12px',
          cursor: 'pointer',
          boxShadow: selectedMode === mode ? `0 0 12px ${theme.glow}` : 'none',
        }}
      >
        {label}
      </button>
    );
  };

  const rankingModeButton = (mode: SelectedMode, label: string) => {
    const theme = getModeTheme(mode);
    return (
      <button
        key={mode}
        onClick={() => {
          setRankingMode(mode);
          loadRanking(rankingTab, mode);
        }}
        style={{
          padding: '6px 16px',
          fontSize: '13px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          background: rankingMode === mode ? theme.background : '#1a1a2a',
          color: rankingMode === mode ? theme.color : '#556',
          border: rankingMode === mode ? `1px solid ${theme.color}` : '1px solid #333',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  const tabButton = (tab: RankingTab, label: string) => (
    <button
      key={tab}
      onClick={() => handleRankingTabChange(tab)}
      style={{
        padding: '8px 12px',
        fontSize: '13px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        background: rankingTab === tab ? '#2a2a4a' : 'transparent',
        color: rankingTab === tab ? '#ff8800' : '#667',
        border: 'none',
        borderBottom: rankingTab === tab ? '2px solid #ff8800' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  const showController = isMobile && screenState === 'playing' && activePanel === null;
  const compactControls = viewportWidth > 0 && viewportWidth < 390;
  const narrowLayout = viewportWidth > 0 && viewportWidth < 520;
  const availableModes: SelectedMode[] = ['classic', 'bomber', 'armory', 'purify'];
  const adFreeRemainingMs = adFreeUntil && adFreeUntil > nowMs ? adFreeUntil - nowMs : 0;
  const adFreeActive = adFreeRemainingMs > 0;
  const adDebugLines = adDebugState.debugToolsEnabled
    ? [
      `mode: ${adDebugState.testMode ? 'TEST ADS + DEBUG' : 'DEBUG'}`,
      `native: ${adDebugState.nativePlatform ? 'yes' : 'no'}`,
      `bridge: ${adDebugState.usingNativeAndroidBridge ? 'android-native' : 'community-plugin'}`,
      `initialized: ${adDebugState.initialized ? 'yes' : 'no'}`,
      `state: ${adDebugState.interstitialState}`,
      `plays: ${adDebugState.completedPlaysThisSession}`,
      `ready: ${adDebugState.adReady ? 'yes' : 'no'}`,
      `decision: ${adDebugState.lastDecision}`,
      `detail: ${adDebugState.lastDecisionDetail}`,
      `attempts: init ${adDebugState.initializeAttempts} / prepare ${adDebugState.prepareAttempts} / show ${adDebugState.showAttempts}`,
      `native calls: load ${adDebugState.nativeLoadCount} / show ${adDebugState.nativeShowCount}`,
      `session gate: ${adDebugState.sessionGateBypassed ? 'bypassed' : adDebugState.adFreePlaysPerSession}`,
      `reward gate: ${adDebugState.adFreeGateBypassed ? 'bypassed' : adFreeActive ? 'active' : 'inactive'}`,
      `error code: ${adDebugState.lastAdErrorCode ?? 'none'}`,
      adDebugState.lastAdError ? `error: ${adDebugState.lastAdError}` : 'error: none',
    ]
    : [];
  const localeIsJa = lang === 'ja';
  const titleFontSize = viewportWidth > 0
    ? (viewportWidth < 390 ? '30px' : viewportWidth < 520 ? '34px' : isMobile ? '36px' : '52px')
    : (isMobile ? '36px' : '52px');

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch { return ''; }
  };

  // Canvas is always mounted; overlays sit on top
  return (
    <div style={{
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#0a0a1a', overflow: 'hidden', position: 'relative',
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
      boxSizing: 'border-box',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%', flex: '1 1 0', minHeight: 0, display: 'block',
          background: '#0a0a1a', touchAction: 'none',
        }}
        tabIndex={0}
        onTouchStart={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />
      {statusBanner && (
        <div style={{
          position: 'absolute',
          top: 'calc(10px + env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 28,
          padding: '12px 16px',
          borderRadius: '18px',
          background: statusBanner.background,
          color: statusBanner.color,
          border: `1px solid ${statusBanner.color}33`,
          boxShadow: `0 0 22px ${statusBanner.color}22`,
          fontFamily: 'monospace',
          textAlign: 'center',
          pointerEvents: 'none',
          maxWidth: 'min(92vw, 420px)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {statusBanner.title}
          </div>
          {statusBanner.detail && (
            <div style={{ marginTop: '4px', fontSize: '11px', lineHeight: 1.4, color: '#eef7ff' }}>
              {statusBanner.detail}
            </div>
          )}
        </div>
      )}
      {showController && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `calc(${controllerHeight}px + env(safe-area-inset-bottom))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 5,
        }}>
          <VirtualController
            onAction={handleControllerAction}
            onActionStart={handleControllerActionStart}
            onActionEnd={handleControllerActionEnd}
            compact={compactControls}
          />
        </div>
      )}

      {screenState === 'title' && titleColony && !secretModeUnlocked && activePanel === null && (
        <button
          type="button"
          aria-label="Unlock hidden colony mode"
          onClick={handleTitleColonyTap}
          style={{
            position: 'absolute',
            top: `-${Math.round(titleColony.size * 1.4)}px`,
            left: `${titleColony.leftPercent}%`,
            width: `${titleColony.size}px`,
            height: `${Math.round(titleColony.size * 1.35)}px`,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            zIndex: 12,
            animation: `meteor-crush-title-colony-fall ${titleColony.durationMs}ms linear forwards`,
            pointerEvents: 'auto',
            touchAction: 'manipulation',
          }}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            animation: 'meteor-crush-title-colony-rock 1800ms ease-in-out infinite',
            filter: 'drop-shadow(0 0 18px rgba(103, 255, 227, 0.28))',
          }}>
            <div style={{
              position: 'absolute',
              top: '12%',
              left: '28%',
              width: '44%',
              height: '24%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(180,255,249,0.9) 0%, rgba(120,232,255,0.55) 45%, rgba(120,232,255,0) 100%)',
            }} />
            <div style={{
              position: 'absolute',
              left: '14%',
              right: '14%',
              top: '18%',
              bottom: '18%',
              borderRadius: '46% 46% 34% 34%',
              background: 'linear-gradient(180deg, #dce6f2 0%, #7887a2 52%, #31384d 100%)',
              border: '2px solid rgba(232, 240, 255, 0.6)',
              boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.28), inset 0 -10px 18px rgba(11,14,24,0.45)',
            }}>
              <div style={{
                position: 'absolute',
                left: '18%',
                right: '18%',
                top: '18%',
                height: '18%',
                borderRadius: '999px',
                background: 'linear-gradient(180deg, rgba(9,25,44,0.95) 0%, rgba(25,64,103,0.92) 100%)',
                border: '1px solid rgba(138, 235, 255, 0.5)',
                boxShadow: '0 0 12px rgba(90, 204, 255, 0.2)',
              }} />
              <div style={{
                position: 'absolute',
                left: '22%',
                right: '22%',
                bottom: '18%',
                height: '12%',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6%',
              }}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      borderRadius: '999px',
                      background: 'linear-gradient(180deg, #8effd3 0%, #41d9b3 100%)',
                      boxShadow: '0 0 10px rgba(78,255,208,0.6)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{
              position: 'absolute',
              left: '24%',
              right: '24%',
              bottom: '4%',
              height: '24%',
              borderRadius: '50% 50% 100% 100%',
              background: 'radial-gradient(circle at 50% 8%, rgba(255,250,182,0.95) 0%, rgba(112,255,216,0.8) 35%, rgba(62,201,255,0.28) 62%, rgba(62,201,255,0) 100%)',
              animation: 'meteor-crush-title-colony-thruster 260ms ease-in-out infinite',
              transformOrigin: '50% 0%',
            }} />
          </div>
        </button>
      )}

      {/* Title overlay */}
      {screenState === 'title' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'transparent',
          color: '#fff', fontFamily: 'monospace', gap: narrowLayout ? '18px' : '24px', touchAction: 'none', zIndex: 10,
          padding: 'calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: titleFontSize,
            fontWeight: 'bold',
            color: '#ff8800',
            textShadow: '0 0 30px #ff4400',
            margin: 0,
            lineHeight: 0.96,
            letterSpacing: narrowLayout ? '1px' : '2px',
            textAlign: 'center',
          }}>
            METEOR CRUSH
          </h1>
          {unlockBannerVisible && (
            <p style={{
              margin: 0,
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(121,216,90,0.16)',
              color: '#9be07a',
              fontSize: '12px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}>
              {t.secretUnlocked}
            </p>
          )}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: narrowLayout ? '8px' : '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {availableModes.map((mode) => modeButton(mode, mode.toUpperCase()))}
          </div>
          <p style={{ fontSize: '13px', color: getModeTheme(selectedMode).color, margin: 0 }}>
            {selectedMode === 'bomber'
              ? t.modeBomberDesc
              : selectedMode === 'armory'
                ? t.modeArmoryDesc
              : selectedMode === 'purify'
                ? t.modePurifyDesc
                : t.modeClassicDesc}
          </p>
          <button onClick={handleStartRequest} style={{
            marginTop: narrowLayout ? '8px' : '16px', padding: narrowLayout ? '18px 40px' : '20px 48px', fontSize: narrowLayout ? '20px' : '22px', fontFamily: 'monospace',
            fontWeight: 'bold', background: '#ff8800', color: '#000', border: 'none',
            borderRadius: '16px', cursor: 'pointer', boxShadow: '0 0 20px rgba(255,136,0,0.5)',
            width: narrowLayout ? 'min(100%, 220px)' : undefined,
          }}>
            {t.start}
          </button>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            width: '100%',
            maxWidth: narrowLayout ? '220px' : 'unset',
          }}>
            <button onClick={handleOpenRules} style={{
              padding: '12px 20px', fontSize: '15px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#5ec4c4',
              border: '1px solid #5ec4c4', borderRadius: '12px', cursor: 'pointer',
              width: narrowLayout ? '100%' : undefined,
            }}>
              {t.howToPlay}
            </button>
            <button onClick={() => openRanking('title')} style={{
              padding: '12px 20px', fontSize: '15px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#ffd700',
              border: '1px solid #ffd700', borderRadius: '12px', cursor: 'pointer',
              width: narrowLayout ? '100%' : undefined,
            }}>
              🏆 {t.ranking}
            </button>
            <button onClick={handleOpenSettings} style={{
              padding: '12px 20px', fontSize: '15px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#aac',
              border: '1px solid #556', borderRadius: '12px', cursor: 'pointer',
              width: narrowLayout ? '100%' : undefined,
            }}>
              {t.settings}
            </button>
          </div>
          {!isMobile && (
            <p style={{ fontSize: '12px', color: '#667', margin: '0' }}>{t.controls}</p>
          )}
        </div>
      )}

      {/* Game over overlay */}
      {screenState === 'game_over' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,26,0.85)',
          color: '#fff', fontFamily: 'monospace', gap: '12px', touchAction: 'none', zIndex: 10,
          overflowY: 'auto',
          padding: 'calc(20px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))',
          boxSizing: 'border-box',
        }}>
          <h1 style={{ fontSize: isMobile ? '36px' : '48px', fontWeight: 'bold', color: '#ff4444', margin: 0 }}>{t.gameOver}</h1>
          <p style={{ fontSize: '22px', margin: '4px 0' }}>{t.score(lastScore.toLocaleString())}</p>
          {isNewHighScore ? (
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffd700', textShadow: '0 0 15px #ffd700', margin: 0 }}>{t.newHighScore}</p>
          ) : (
            <p style={{ fontSize: '14px', color: '#aac', margin: 0 }}>{t.hiScore(lastHighScore.toLocaleString())}</p>
          )}
          <GameOverAdSense locale={localeIsJa ? 'ja' : 'en'} />

          {/* Name input + submit */}
          {!nameSubmitted ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
              <input
                type="text"
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value.slice(0, 12))}
                placeholder={t.enterName}
                style={{
                  padding: '10px 14px', fontSize: '16px', fontFamily: 'monospace',
                  background: '#1a1a2a', color: '#fff', border: '1px solid #555',
                  borderRadius: '8px', width: '160px', outline: 'none',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
              />
              <button onClick={handleNameSubmit} style={{
                padding: '10px 16px', fontSize: '14px', fontFamily: 'monospace',
                fontWeight: 'bold', background: '#ffd700', color: '#000', border: 'none',
                borderRadius: '8px', cursor: 'pointer',
              }}>
                {t.submit}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#5ec4c4', margin: 0 }}>✓ {playerNameInput}</p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {availableModes.map((mode) => modeButton(mode, mode.toUpperCase(), true))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleRetryRequest} style={{
              padding: '14px 36px', fontSize: '18px', fontFamily: 'monospace',
              fontWeight: 'bold', background: '#ff8800', color: '#000', border: 'none',
              borderRadius: '12px', cursor: 'pointer', boxShadow: '0 0 20px rgba(255,136,0,0.5)',
            }}>
              {t.retry}
            </button>
            <button onClick={() => openRanking('game_over')} style={{
              padding: '14px 20px', fontSize: '18px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#ffd700',
              border: '1px solid #ffd700', borderRadius: '12px', cursor: 'pointer',
            }}>
              🏆
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={handleOpenRules} style={{
              padding: '10px 18px', fontSize: '14px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#5ec4c4',
              border: '1px solid #5ec4c4', borderRadius: '12px', cursor: 'pointer',
            }}>
              {t.howToPlay}
            </button>
            <button onClick={handleOpenSettings} style={{
              padding: '10px 18px', fontSize: '14px', fontFamily: 'monospace',
              fontWeight: 'bold', background: 'transparent', color: '#aac',
              border: '1px solid #555', borderRadius: '12px', cursor: 'pointer',
            }}>
              {t.settings}
            </button>
          </div>
          <button onClick={goToTitle} style={{
            padding: '10px 24px', fontSize: '13px', fontFamily: 'monospace',
            fontWeight: 'bold', background: 'transparent', color: '#888', border: '1px solid #555',
            borderRadius: '12px', cursor: 'pointer',
          }}>
            {t.backToTitle}
          </button>
        </div>
      )}

      {/* Ranking overlay */}
      {screenState === 'ranking' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', background: 'rgba(10,10,26,0.95)',
          color: '#fff', fontFamily: 'monospace', touchAction: 'none', zIndex: 15,
          padding: 'calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))',
          boxSizing: 'border-box', overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffd700', margin: '0 0 12px', textShadow: '0 0 15px rgba(255,215,0,0.5)' }}>
            🏆 {t.ranking}
          </h2>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {availableModes.map((mode) => rankingModeButton(mode, mode.toUpperCase()))}
          </div>

          {/* Region tabs */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #333', marginBottom: '12px' }}>
            {tabButton('my', t.myRecords)}
            {tabButton('regional', getContinentName(playerContinent))}
            {tabButton('world', t.world)}
          </div>

          {/* Ranking list */}
          <div style={{ width: '100%', maxWidth: '400px', flex: '1 1 0', overflowY: 'auto' }}>
            {rankingLoading && rankingTab !== 'my' ? (
              <p style={{ textAlign: 'center', color: '#667', marginTop: '40px' }}>Loading...</p>
            ) : rankingTab === 'my' ? (
              localRanking.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#667', marginTop: '40px' }}>{t.noData}</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#667', borderBottom: '1px solid #333' }}>
                      <th style={{ padding: '6px 4px', textAlign: 'left', width: '30px' }}>{t.rank}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t.scoreLabel}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right', width: '36px' }}>{t.level}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right', width: '50px' }}>{t.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localRanking.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{
                          padding: '6px 4px',
                          color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#aac',
                          fontWeight: i < 3 ? 'bold' : 'normal',
                        }}>
                          {i + 1}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#fff' }}>
                          {r.score.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#aac' }}>{r.level}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#667' }}>{formatDate(r.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              rankingData.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#667', marginTop: '40px' }}>{t.noData}</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#667', borderBottom: '1px solid #333' }}>
                      <th style={{ padding: '6px 4px', textAlign: 'left', width: '30px' }}>{t.rank}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'left' }}>{t.name}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t.scoreLabel}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right', width: '50px' }}>{t.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData.map((r, i) => {
                      const isMe = r.name === getPlayerName();
                      return (
                        <tr key={i} style={{
                          borderBottom: '1px solid #222',
                          background: isMe ? 'rgba(255,136,0,0.1)' : 'transparent',
                        }}>
                          <td style={{
                            padding: '6px 4px',
                            color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#aac',
                            fontWeight: i < 3 ? 'bold' : 'normal',
                          }}>
                            {i + 1}
                          </td>
                          <td style={{
                            padding: '6px 4px', color: isMe ? '#ff8800' : '#fff',
                            fontWeight: isMe ? 'bold' : 'normal',
                            maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {r.name}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#fff' }}>
                            {r.score.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#667' }}>{formatDate(r.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>

          <button onClick={closeRanking} style={{
            marginTop: '12px', padding: '12px 32px', fontSize: '16px', fontFamily: 'monospace',
            fontWeight: 'bold', background: 'transparent', color: '#888', border: '1px solid #555',
            borderRadius: '12px', cursor: 'pointer',
          }}>
            {t.close}
          </button>
        </div>
      )}

      {activePanel === 'settings' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: 'rgba(8,10,20,0.94)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))',
          boxSizing: 'border-box',
        }}>
          <div style={{
            width: 'min(100%, 620px)',
            maxHeight: 'min(100%, calc(100dvh - 32px))',
            overflowY: 'auto',
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(180deg, rgba(20,24,40,0.98) 0%, rgba(10,12,24,0.98) 100%)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
            color: '#fff',
            fontFamily: 'monospace',
            padding: '24px',
            display: 'grid',
            gap: '18px',
          }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '28px', color: '#ff8800' }}>{t.settings}</h2>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#aac' }}>
                {t.showRulesBeforeGameDesc}
              </p>
            </div>

            <div style={{
              borderRadius: '18px',
              border: '1px solid rgba(94,196,196,0.22)',
              background: 'rgba(255,255,255,0.03)',
              padding: '16px',
              display: 'flex',
              gap: '16px',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'grid', gap: '6px', flex: '1 1 220px' }}>
                <strong style={{ fontSize: '15px', color: '#5ec4c4' }}>{t.showRulesBeforeGame}</strong>
                <span style={{ fontSize: '12px', color: '#9aa6c4', lineHeight: 1.6 }}>
                  {t.showRulesBeforeGameDesc}
                </span>
              </div>
              <button
                onClick={() => handleToggleShowRulesBeforeGame(!showRulesBeforeGame)}
                style={{
                  minWidth: '92px',
                  padding: '12px 18px',
                  borderRadius: '999px',
                  border: `1px solid ${showRulesBeforeGame ? '#5ec4c4' : '#555'}`,
                  background: showRulesBeforeGame ? 'rgba(94,196,196,0.18)' : 'rgba(255,255,255,0.05)',
                  color: showRulesBeforeGame ? '#5ec4c4' : '#8892aa',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {showRulesBeforeGame ? t.on : t.off}
              </button>
            </div>

            <div style={{
              borderRadius: '18px',
              border: '1px solid rgba(94,196,196,0.22)',
              background: 'rgba(255,255,255,0.03)',
              padding: '16px',
              display: 'grid',
              gap: '12px',
            }}>
              <LanguagePicker />
            </div>

            {adDebugState.debugToolsEnabled && (
              <div style={{
                borderRadius: '18px',
                border: '1px solid rgba(255,136,0,0.28)',
                background: 'rgba(255,136,0,0.06)',
                padding: '16px',
                display: 'grid',
                gap: '10px',
              }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <strong style={{ fontSize: '15px', color: '#ffb347' }}>AD TEST STATUS</strong>
                  <span style={{ fontSize: '12px', color: '#9aa6c4', lineHeight: 1.6 }}>
                    テスト広告ビルドでは最初の2プレイ免除と広告オフ報酬を無視して、そのまま広告を試せます。
                  </span>
                </div>
                <div style={{
                  borderRadius: '14px',
                  background: 'rgba(0,0,0,0.24)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '12px 14px',
                  display: 'grid',
                  gap: '6px',
                }}>
                  {adDebugLines.map((line) => (
                    <span key={line} style={{ fontSize: '12px', color: '#ffd9a6' }}>{line}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#fff0cf' }}>
                    action: {adActionBusy ? 'running' : 'idle'} / {adActionStatus}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'INIT ADS', onClick: runInitializeAdTest },
                      { label: 'PREPARE AD', onClick: runPrepareAdTest },
                      { label: 'SHOW AD', onClick: runShowAdTest },
                      { label: 'RUN FULL TEST', onClick: runManualAdTest },
                    ].map((actionButton) => (
                      <button
                        key={actionButton.label}
                        onClick={actionButton.onClick}
                        disabled={adActionBusy}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '14px',
                          border: '1px solid #ffb347',
                          background: adActionBusy ? 'rgba(255,255,255,0.04)' : 'rgba(255,179,71,0.12)',
                          color: adActionBusy ? '#a8a8a8' : '#ffd9a6',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          cursor: adActionBusy ? 'default' : 'pointer',
                        }}
                      >
                        {actionButton.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{
                  borderRadius: '14px',
                  background: 'rgba(0,0,0,0.18)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '12px 14px',
                  display: 'grid',
                  gap: '6px',
                }}>
                  <strong style={{ fontSize: '12px', color: '#fff0cf' }}>recent history</strong>
                  {adDebugState.decisionHistory.map((entry) => (
                    <span key={entry} style={{ fontSize: '12px', color: '#ffd9a6' }}>{entry}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={handleOpenRules}
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: '1px solid #5ec4c4',
                  background: 'transparent',
                  color: '#5ec4c4',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {t.howToPlay}
              </button>
              <button
                onClick={() => setActivePanel(null)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: '1px solid #555',
                  background: 'transparent',
                  color: '#d6dced',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'rules' && (
        <RuleSheet
          mode={selectedMode}
          onClose={handleCloseRules}
          onStart={() => {
            markEggDiscovered('start_from_rules');
            handleStartFromRules();
          }}
        />
      )}
      <style jsx global>{`
        @keyframes meteor-crush-title-colony-fall {
          0% {
            transform: translate(-50%, -6vh);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 112vh);
            opacity: 0.98;
          }
        }

        @keyframes meteor-crush-title-colony-rock {
          0%, 100% {
            transform: rotate(-7deg) scale(1);
          }
          50% {
            transform: rotate(7deg) scale(1.03);
          }
        }

        @keyframes meteor-crush-title-colony-thruster {
          0%, 100% {
            opacity: 0.55;
            transform: scaleY(0.82);
          }
          50% {
            opacity: 0.95;
            transform: scaleY(1.18);
          }
        }
      `}</style>
    </div>
  );
}
