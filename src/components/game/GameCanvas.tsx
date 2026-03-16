'use client';

import { useRef, useEffect, useCallback } from 'react';
import { GameEngine } from '@/engine/GameEngine';
import { GameRenderer } from '@/renderer/GameRenderer';
import { ClassicMode } from '@/engine/modes/ClassicMode';
import { BomberMode } from '@/engine/modes/BomberMode';
import { TouchManager } from '@/engine/TouchManager';
import { getHighScore, setHighScore, getGlobalHighScore, submitGlobalScore } from '@/lib/storage';

type SelectedMode = 'classic' | 'bomber';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const highScoreRef = useRef<number>(0);
  const globalHighScoreRef = useRef<number>(0);
  const selectedModeRef = useRef<SelectedMode>('classic');
  const touchManagerRef = useRef<TouchManager | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      rendererRef.current?.resize(rect.width, rect.height);
      // Update touch manager with new board layout
      const layout = rendererRef.current?.getBoardLayout();
      if (layout) {
        touchManagerRef.current?.updateLayout(layout);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new GameRenderer(ctx);
    rendererRef.current = renderer;

    const loadScores = (mode: SelectedMode) => {
      highScoreRef.current = getHighScore(mode);
      getGlobalHighScore(mode).then(s => { globalHighScoreRef.current = s; });
    };

    loadScores('classic');

    const engine = new GameEngine({
      onGameOver: (score) => {
        const mode = selectedModeRef.current;
        const isNew = setHighScore(mode, score);
        if (isNew) {
          highScoreRef.current = score;
        }
        submitGlobalScore(mode, score);
      },
    });
    engineRef.current = engine;

    // Touch controls
    const touchManager = new TouchManager(
      (action) => {
        if (engine.state === 'playing') {
          engine.inputManager.injectAction(action);
        }
      },
      (column) => {
        if (engine.state === 'playing') {
          engine.moveToColumn(column);
        }
      },
    );
    touchManager.bind(canvas);
    touchManagerRef.current = touchManager;

    resizeCanvas();

    // Pass initial board layout to touch manager
    const layout = renderer.getBoardLayout();
    touchManager.updateLayout(layout);

    window.addEventListener('resize', resizeCanvas);

    const startGame = () => {
      const mode = selectedModeRef.current;
      loadScores(mode);
      let gameMode;
      if (mode === 'bomber') {
        gameMode = new BomberMode();
      } else {
        gameMode = new ClassicMode();
      }
      engine.start(gameMode);
    };

    const handleGlobalKey = (e: KeyboardEvent) => {
      // Mode selection on title/game over screen
      if (engine.state === 'title' || engine.state === 'game_over') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          selectedModeRef.current = 'classic';
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          selectedModeRef.current = 'bomber';
          return;
        }
      }

      if (e.code === 'Space') {
        if (engine.state === 'title' || engine.state === 'game_over') {
          e.preventDefault();
          startGame();
        }
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (engine.state === 'playing' || engine.state === 'paused') {
          engine.pause();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    // Touch on title/game over: tap to start, swipe to change mode
    const handleTitleTouch = (e: TouchEvent) => {
      if (engine.state !== 'title' && engine.state !== 'game_over') return;
      // Simple tap to start on title/game over
      if (e.type === 'touchend') {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const relX = touch.clientX - rect.left;
        const w = rect.width;

        // Bottom third of screen: tap to start
        const relY = touch.clientY - rect.top;
        const h = rect.height;
        if (relY > h * 0.55) {
          e.preventDefault();
          startGame();
          return;
        }

        // Top area: left/right for mode selection
        if (relX < w / 2) {
          selectedModeRef.current = 'classic';
        } else {
          selectedModeRef.current = 'bomber';
        }
        e.preventDefault();
      }
    };
    canvas.addEventListener('touchend', handleTitleTouch, { passive: false });

    const renderGame = (deltaTime: number) => {
      // Process visual events from engine (explosions, line clears)
      if (engine.visualEvents.length > 0) {
        renderer.processVisualEvents(engine.visualEvents);
        engine.visualEvents = [];
      }

      renderer.render(
        engine.board,
        engine.currentPiece,
        engine.getGhostY(),
        engine.score,
        engine.level,
        engine.totalLinesCleared,
        engine.getSpeed(),
        highScoreRef.current,
        globalHighScoreRef.current,
        engine.nextPieces,
        engine.holdPiece,
        engine.activeChainText,
        engine.chainTextTimer,
        engine.chainEffectTier,
        deltaTime,
      );
    };

    const loop = (timestamp: number) => {
      const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;

      if (engine.state === 'title') {
        renderer.drawTitle(selectedModeRef.current);
      } else if (engine.state === 'playing' || engine.state === 'chain_resolving') {
        engine.tick(deltaTime);
        renderGame(deltaTime);
      } else if (engine.state === 'paused') {
        renderGame(0);
        renderer.drawPaused();
      } else if (engine.state === 'game_over') {
        engine.gameOverTimer += deltaTime;
        renderGame(deltaTime); // pass deltaTime for effects
        renderer.drawGameOver(engine.score, highScoreRef.current, engine.gameOverTimer, engine.board);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleGlobalKey);
      canvas.removeEventListener('touchend', handleTitleTouch);
      touchManager.unbind(canvas);
      engine.destroy();
    };
  }, [resizeCanvas]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: '#0a0a1a',
        touchAction: 'none',
      }}
      tabIndex={0}
    />
  );
}
