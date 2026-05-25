import { BOARD_WIDTH, BOARD_HEIGHT, HIDDEN_ROWS, BLOCK_COLORS, CELL_SIZE, INITIAL_DROP_INTERVAL } from '@/lib/constants';
import { Board } from '@/engine/Board';
import { getPieceDefinitionArmoryFragment, getPieceDefinitionCellColor, Piece } from '@/engine/Piece';
import { BombKind, GameModeType, PieceDefinition, VisualEvent, WeaponId } from '@/engine/types';
import { EffectManager } from './EffectManager';

const EFFECT_COLORS = ['#ffffff', '#ffff00', '#ff8800', '#ff0044'];

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellSize: number = CELL_SIZE;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private boardPixelWidth: number = 0;
  private boardPixelHeight: number = 0;
  private canvasW: number = 800;
  private canvasH: number = 600;
  private isMobile: boolean = false;

  // Effects
  readonly effects: EffectManager = new EffectManager();

  // Starfield
  private stars: { x: number; y: number; brightness: number; speed: number; size: number }[] = [];
  private starTimer: number = 0;
  // Background nebula blobs
  private nebulae: { x: number; y: number; r: number; color: string; phase: number }[] = [];
  // Floating debris
  private debris: { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number; color: string }[] = [];
  private gameOverDissolvedRows: Set<number> = new Set();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.initStars();
    this.initNebulae();
    this.initDebris();
  }

  resize(canvasWidth: number, canvasHeight: number, controllerHeight: number = 0): void {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;
    const visibleRows = BOARD_HEIGHT;
    const isMobile = controllerHeight > 0;
    this.isMobile = isMobile;

    if (isMobile) {
      // Mobile: compact right panel, board left/top aligned
      const sidePanel = Math.max(44, canvasWidth * 0.12);
      const boardAreaW = canvasWidth - sidePanel;
      const availableH = canvasHeight - controllerHeight;
      const maxCellW = Math.floor(boardAreaW / BOARD_WIDTH);
      const maxCellH = Math.floor(availableH / visibleRows);
      this.cellSize = Math.min(maxCellW, maxCellH);
      this.boardPixelWidth = BOARD_WIDTH * this.cellSize;
      this.boardPixelHeight = visibleRows * this.cellSize;
      this.offsetX = 0;
      this.offsetY = 0;
    } else {
      // Desktop: cap cell size, center board+panel as a unit
      const maxCellH = Math.floor((canvasHeight - 20) / visibleRows);
      this.cellSize = Math.min(maxCellH, 32);
      this.boardPixelWidth = BOARD_WIDTH * this.cellSize;
      this.boardPixelHeight = visibleRows * this.cellSize;
      const sidePanelW = Math.max(120, this.cellSize * 5);
      const totalW = this.boardPixelWidth + 12 + sidePanelW;
      this.offsetX = Math.max(10, Math.floor((canvasWidth - totalW) / 2));
      this.offsetY = Math.max(10, Math.floor((canvasHeight - this.boardPixelHeight) / 2));
    }
  }

  /** Board layout info for touch coordinate mapping */
  getBoardLayout(): { offsetX: number; cellSize: number } {
    return { offsetX: this.offsetX, cellSize: this.cellSize };
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        brightness: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.02 + 0.005,
        size: Math.random() < 0.1 ? 3 : Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  private initNebulae(): void {
    this.nebulae = [];
    const colors = [
      'rgba(40, 20, 80, 0.15)',   // purple
      'rgba(20, 40, 80, 0.12)',   // blue
      'rgba(80, 20, 40, 0.10)',   // red
      'rgba(20, 60, 60, 0.10)',   // teal
    ];
    for (let i = 0; i < 5; i++) {
      this.nebulae.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 0.25 + 0.1,
        color: colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private initDebris(): void {
    this.debris = [];
    const colors = ['#443', '#554', '#445', '#433', '#353'];
    for (let i = 0; i < 8; i++) {
      this.debris.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.003,
        vy: Math.random() * 0.008 + 0.003,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.002,
        size: Math.random() * 4 + 2,
        color: colors[i % colors.length],
      });
    }
  }

  /** Process visual events from the engine and spawn effects */
  processVisualEvents(events: VisualEvent[]): void {
    for (const evt of events) {
      if (evt.type === 'line_clear' && evt.rows) {
        for (const row of evt.rows) {
          const visibleY = row;
          if (visibleY >= 0) {
            const py = this.offsetY + visibleY * this.cellSize;
            this.effects.spawnLineClear(py, this.offsetX, this.boardPixelWidth, this.cellSize);
          }
        }
        this.effects.addShake(2, 150);
      }
      if (evt.type === 'explosion' && evt.cells) {
        const power = evt.power ?? 1;
        const intensity = Math.min(3, 0.8 + (evt.chainCount || 1) * 0.3 + (power - 1) * 0.8);
        const effectColor = this.getAttackEffectColor(evt.weaponId);
        const effectDuration = evt.durationMs ?? 800;
        for (const cell of evt.cells) {
          const visibleY = cell.y;
          if (visibleY >= 0) {
            const px = this.offsetX + (cell.x + 0.5) * this.cellSize;
            const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
            this.effects.spawnExplosion(px, py, effectColor, intensity, effectDuration);
          }
        }
        // Spawn blast rings at bomb centers to show explosion radius
        if (evt.blastCenters) {
          for (const bc of evt.blastCenters) {
            const visibleY = bc.y;
            if (visibleY >= 0) {
              const px = this.offsetX + (bc.x + 0.5) * this.cellSize;
              const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
              const pixelRadius = bc.radius * this.cellSize;
              this.effects.spawnBlastRing(px, py, pixelRadius, effectDuration);
            }
          }
        }
        const shakeBase = evt.weaponId === 'tub' ? 6 : evt.weaponId === 'missile' ? 4 : 3;
        const flashBase = evt.weaponId === 'bomb' ? 130 : evt.weaponId === 'pan' ? 90 : 80;
        this.effects.addShake((shakeBase + (evt.chainCount || 1) * 2) * (power > 1 ? 1.35 : 1), power > 1 ? 420 : 300);
        this.effects.addFlash(flashBase + (power - 1) * 80);
      }
    }
  }

  render(
    board: Board,
    currentPiece: Piece | null,
    ghostY: number,
    modeType: GameModeType,
    score: number,
    level: number,
    lines: number,
    speed: number,
    highScore: number,
    globalHighScore: number,
    nextPieces: PieceDefinition[],
    holdPiece: PieceDefinition | null,
    chainText: string,
    chainTextTimer: number,
    chainEffectTier: number,
    deltaTime: number,
  ): void {
    const { ctx, canvasW: w, canvasH: h } = this;

    // Update effects
    this.effects.update(deltaTime);

    // Get shake offset
    const shake = this.effects.getShakeOffset();

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#050510');
    bgGrad.addColorStop(0.4, '#0a0a20');
    bgGrad.addColorStop(0.7, '#0d0818');
    bgGrad.addColorStop(1, '#080510');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Nebula clouds
    this.drawNebulae(w, h, deltaTime);

    // Stars
    this.drawStars(w, h, deltaTime);

    // Floating debris
    this.drawDebris(w, h, deltaTime);

    // Apply shake offset for board content
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Board outer glow
    ctx.save();
    ctx.shadowColor = 'rgba(60, 80, 140, 0.4)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = 'rgba(80, 100, 160, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.offsetX - 4, this.offsetY - 4, this.boardPixelWidth + 8, this.boardPixelHeight + 8);
    ctx.restore();

    // Board border
    ctx.strokeStyle = '#3a4060';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX - 2, this.offsetY - 2, this.boardPixelWidth + 4, this.boardPixelHeight + 4);

    // Board background with subtle gradient
    const boardBg = ctx.createLinearGradient(this.offsetX, this.offsetY, this.offsetX, this.offsetY + this.boardPixelHeight);
    boardBg.addColorStop(0, 'rgba(8, 8, 25, 0.9)');
    boardBg.addColorStop(0.5, 'rgba(10, 10, 30, 0.85)');
    boardBg.addColorStop(1, 'rgba(6, 6, 20, 0.9)');
    ctx.fillStyle = boardBg;
    ctx.fillRect(this.offsetX, this.offsetY, this.boardPixelWidth, this.boardPixelHeight);

    this.drawSpawnWarningRows();

    // Grid lines
    this.drawGrid();

    // Placed blocks
    this.drawBoard(board);

    // Ghost piece
    if (currentPiece) {
      this.drawGhostPiece(currentPiece, ghostY);
    }

    // Current piece
    if (currentPiece) {
      this.drawPiece(currentPiece);
    }

    // Particles (drawn on board layer with shake)
    this.drawParticles();

    ctx.restore(); // end shake offset

    // HUD (not shaken)
    this.drawHUD(modeType, score, level, lines, speed, highScore, globalHighScore, nextPieces, holdPiece, w);

    // Chain text
    if (chainText && chainTextTimer > 0) {
      this.drawChainText(chainText, chainTextTimer, chainEffectTier, w, h);
    }

    // Vignette overlay
    const vigR = Math.max(w, h) * 0.7;
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, vigR * 0.4, w / 2, h / 2, vigR);
    vigGrad.addColorStop(0, 'transparent');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);

    // Screen flash overlay
    if (this.effects.screenFlash > 0) {
      const flashAlpha = Math.min(0.4, this.effects.screenFlash / 150);
      ctx.fillStyle = `rgba(255, 200, 100, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawNebulae(w: number, h: number, deltaTime: number): void {
    const { ctx } = this;
    this.starTimer += deltaTime;
    for (const n of this.nebulae) {
      const pulse = Math.sin(this.starTimer * 0.0005 + n.phase) * 0.03;
      const r = (n.r + pulse) * Math.max(w, h);
      const grad = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, r);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawStars(w: number, h: number, deltaTime: number): void {
    const { ctx } = this;
    for (const star of this.stars) {
      star.y += star.speed * deltaTime * 0.001;
      if (star.y > 1) star.y -= 1;

      const twinkle = Math.sin(this.starTimer * 0.003 + star.x * 100) * 0.3 + 0.7;
      const alpha = star.brightness * twinkle;
      if (star.size >= 3) {
        // Bright star with glow
        ctx.save();
        ctx.shadowColor = 'rgba(180, 200, 255, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = `rgba(220, 230, 255, ${alpha})`;
        ctx.fillRect(star.x * w - 1, star.y * h - 1, 3, 3);
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
      }
    }
  }

  private drawDebris(w: number, h: number, deltaTime: number): void {
    const { ctx } = this;
    const dt = deltaTime * 0.001;
    for (const d of this.debris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.rotSpeed * deltaTime;
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
      if (d.x < -0.05) d.x = 1.05;
      if (d.x > 1.05) d.x = -0.05;

      const px = d.x * w;
      const py = d.y * h;

      // Skip debris that would overlap the board area
      if (px > this.offsetX - 10 && px < this.offsetX + this.boardPixelWidth + 10 &&
          py > this.offsetY - 10 && py < this.offsetY + this.boardPixelHeight + 10) continue;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.5;
      // Small irregular rock shape
      ctx.beginPath();
      ctx.moveTo(-d.size, -d.size * 0.6);
      ctx.lineTo(-d.size * 0.3, -d.size);
      ctx.lineTo(d.size * 0.7, -d.size * 0.5);
      ctx.lineTo(d.size, d.size * 0.3);
      ctx.lineTo(d.size * 0.4, d.size);
      ctx.lineTo(-d.size * 0.6, d.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(50, 50, 80, 0.3)';
    ctx.lineWidth = 0.5;

    const visibleRows = BOARD_HEIGHT;

    for (let x = 0; x <= BOARD_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + x * this.cellSize, this.offsetY);
      ctx.lineTo(this.offsetX + x * this.cellSize, this.offsetY + this.boardPixelHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= visibleRows; y++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + y * this.cellSize);
      ctx.lineTo(this.offsetX + this.boardPixelWidth, this.offsetY + y * this.cellSize);
      ctx.stroke();
    }
  }

  private drawBoard(board: Board): void {
    // Legacy oversized-bomb rendering path
    const megaDrawn = new Set<string>();

    // First pass: find and draw legacy 2x2 oversized bombs
    for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        const c00 = board.getCell(x, y);
        const c10 = board.getCell(x + 1, y);
        const c01 = board.getCell(x, y + 1);
        const c11 = board.getCell(x + 1, y + 1);
        if (c00.megaBomb && c10.megaBomb && c01.megaBomb && c11.megaBomb) {
          this.drawMegaBomb(x, y);
          megaDrawn.add(`${x},${y}`);
          megaDrawn.add(`${x + 1},${y}`);
          megaDrawn.add(`${x},${y + 1}`);
          megaDrawn.add(`${x + 1},${y + 1}`);
        }
      }
    }

    // Second pass: draw normal cells (skip oversized bomb cells already drawn)
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (megaDrawn.has(`${x},${y}`)) continue;
        const cell = board.getCell(x, y);
        if (cell.type !== 'empty') {
          this.drawCell(
            x,
            y,
            cell.color,
            cell.type === 'bomb',
            cell.core === true,
            cell.weaponId,
            cell.fragmentIndex,
            cell.fire === true,
            cell.bombKind,
          );
        }
      }
    }
  }

  private drawSpawnWarningRows(): void {
    const { ctx } = this;
    const warningHeight = this.cellSize * HIDDEN_ROWS;
    if (warningHeight <= 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(94, 196, 196, 0.05)';
    ctx.fillRect(this.offsetX, this.offsetY, this.boardPixelWidth, warningHeight);

    ctx.strokeStyle = 'rgba(94, 196, 196, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.offsetX, this.offsetY + warningHeight);
    ctx.lineTo(this.offsetX + this.boardPixelWidth, this.offsetY + warningHeight);
    ctx.stroke();

    if (!this.isMobile) {
      ctx.fillStyle = 'rgba(170, 204, 204, 0.55)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('SPAWN', this.offsetX + 6, this.offsetY + 4);
    }
    ctx.restore();
  }

  /** Draw a legacy 2x2 oversized bomb spanning (boardX, visibleY) to (boardX+1, visibleY+1) */
  private drawMegaBomb(boardX: number, visibleY: number): void {
    const { ctx } = this;
    const s = this.cellSize;
    const x = this.offsetX + boardX * s;
    const y = this.offsetY + visibleY * s;
    const size = s * 2; // 2x2 cells

    ctx.save();

    // Dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Large bomb body
    const cx = x + size / 2;
    const cy = y + size * 0.55;
    const r = size * 0.38;

    const bodyGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
    bodyGrad.addColorStop(0, '#555');
    bodyGrad.addColorStop(0.5, '#222');
    bodyGrad.addColorStop(1, '#000');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Thick fuse
    const fuseStartX = cx + r * 0.2;
    const fuseStartY = cy - r;
    const fuseEndX = cx + size * 0.35;
    const fuseEndY = y + size * 0.05;
    ctx.strokeStyle = '#664422';
    ctx.lineWidth = Math.max(3, s * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fuseStartX, fuseStartY);
    ctx.quadraticCurveTo(cx + size * 0.15, y + size * 0.08, fuseEndX, fuseEndY);
    ctx.stroke();

    // Spark (bigger)
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(fuseEndX, fuseEndY, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffee44';
    ctx.beginPath();
    ctx.arc(fuseEndX, fuseEndY, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Danger symbol
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff3333';
    ctx.font = `bold ${Math.floor(s * 0.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);

    ctx.restore();
  }

  // Seeded random for consistent rock textures per cell position
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private drawCell(
    boardX: number,
    visibleY: number,
    colorIndex: number,
    isBomb: boolean,
    isCore: boolean = false,
    weaponId?: WeaponId,
    fragmentIndex?: number,
    isFire: boolean = false,
    bombKind?: BombKind,
  ): void {
    const { ctx } = this;
    const x = this.offsetX + boardX * this.cellSize;
    const y = this.offsetY + visibleY * this.cellSize;
    const s = this.cellSize;
    const p = 1; // padding

    if (weaponId && typeof fragmentIndex === 'number') {
      this.drawArmoryCell(x, y, s, colorIndex, weaponId, fragmentIndex);
      return;
    }

    const color = BLOCK_COLORS[colorIndex] || '#888';
    const seed = boardX * 1000 + visibleY * 37 + colorIndex * 7;

    ctx.save();

    // Irregular meteor shape (clipped rounded polygon)
    ctx.beginPath();
    const inset = s * 0.08;
    const jitter = s * 0.06;
    const corners = [
      { bx: x + p + inset + this.seededRandom(seed + 1) * jitter, by: y + p + inset + this.seededRandom(seed + 2) * jitter },
      { bx: x + s * 0.45 + this.seededRandom(seed + 3) * jitter, by: y + p + this.seededRandom(seed + 4) * jitter * 0.5 },
      { bx: x + s - p - inset - this.seededRandom(seed + 5) * jitter, by: y + p + inset + this.seededRandom(seed + 6) * jitter },
      { bx: x + s - p - this.seededRandom(seed + 7) * jitter * 0.5, by: y + s * 0.55 + this.seededRandom(seed + 8) * jitter },
      { bx: x + s - p - inset - this.seededRandom(seed + 9) * jitter, by: y + s - p - inset - this.seededRandom(seed + 10) * jitter },
      { bx: x + s * 0.5 - this.seededRandom(seed + 11) * jitter, by: y + s - p - this.seededRandom(seed + 12) * jitter * 0.5 },
      { bx: x + p + inset + this.seededRandom(seed + 13) * jitter, by: y + s - p - inset - this.seededRandom(seed + 14) * jitter },
      { bx: x + p + this.seededRandom(seed + 15) * jitter * 0.5, by: y + s * 0.45 - this.seededRandom(seed + 16) * jitter },
    ];
    ctx.moveTo(corners[0].bx, corners[0].by);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].bx, corners[i].by);
    }
    ctx.closePath();
    ctx.clip();

    // Base color fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);

    // Rocky texture: dark craters/spots
    for (let i = 0; i < 5; i++) {
      const cx = x + this.seededRandom(seed + 20 + i) * s;
      const cy = y + this.seededRandom(seed + 30 + i) * s;
      const cr = this.seededRandom(seed + 40 + i) * s * 0.2 + s * 0.04;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + this.seededRandom(seed + 50 + i) * 0.15})`;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light specular spots (mineral glints)
    for (let i = 0; i < 3; i++) {
      const cx = x + this.seededRandom(seed + 60 + i) * s;
      const cy = y + this.seededRandom(seed + 70 + i) * s;
      const cr = this.seededRandom(seed + 80 + i) * s * 0.08 + s * 0.02;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + this.seededRandom(seed + 90 + i) * 0.2})`;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-left light gradient (3D depth)
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, s, s);

    // Extra visual cues for tricky dark-screen color pairs.
    this.drawColorCue(x, y, s, colorIndex);

    // Edge glow
    ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].bx, corners[0].by);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].bx, corners[i].by);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    // Bomb: shell with subtype cue
    if (isBomb) {
      ctx.save();
      const cx = x + s / 2;
      const cy = y + s * 0.55; // slightly lower center for bomb body
      const r = s * 0.35;

      // Black bomb body
      const bodyGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      bodyGrad.addColorStop(0, '#444');
      bodyGrad.addColorStop(0.6, '#1a1a1a');
      bodyGrad.addColorStop(1, '#000');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.2, cy - r * 0.25, r * 0.2, r * 0.15, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // Fuse stem (top of bomb to upper-right)
      const fuseStartX = cx + r * 0.15;
      const fuseStartY = cy - r;
      const fuseEndX = cx + s * 0.35;
      const fuseEndY = y + s * 0.08;
      ctx.strokeStyle = '#664422';
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fuseStartX, fuseStartY);
      ctx.quadraticCurveTo(cx + s * 0.1, y + s * 0.12, fuseEndX, fuseEndY);
      ctx.stroke();

      // Spark at fuse tip
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(fuseEndX, fuseEndY, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // Inner bright spark
      ctx.fillStyle = '#ffdd44';
      ctx.beginPath();
      ctx.arc(fuseEndX, fuseEndY, s * 0.03, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = bombKind === 'thunder'
        ? '#9cc6ff'
        : bombKind === 'cluster'
          ? '#ffe08a'
          : '#ff9a5a';
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      if (bombKind === 'thunder') {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.16, cy - s * 0.16);
        ctx.lineTo(cx + s * 0.16, cy + s * 0.16);
        ctx.moveTo(cx + s * 0.16, cy - s * 0.16);
        ctx.lineTo(cx - s * 0.16, cy + s * 0.16);
        ctx.stroke();
      } else if (bombKind === 'cluster') {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.18, cy);
        ctx.lineTo(cx + s * 0.18, cy);
        ctx.moveTo(cx, cy - s * 0.18);
        ctx.lineTo(cx, cy + s * 0.18);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffcf9a';
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (isFire) {
      ctx.save();
      const flame = ctx.createLinearGradient(x + s * 0.5, y + s * 0.1, x + s * 0.5, y + s * 0.9);
      flame.addColorStop(0, 'rgba(255,240,150,0.96)');
      flame.addColorStop(0.45, 'rgba(255,165,60,0.96)');
      flame.addColorStop(1, 'rgba(220,60,20,0.92)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.12);
      ctx.bezierCurveTo(x + s * 0.68, y + s * 0.28, x + s * 0.72, y + s * 0.54, x + s * 0.52, y + s * 0.82);
      ctx.bezierCurveTo(x + s * 0.32, y + s * 0.64, x + s * 0.3, y + s * 0.34, x + s * 0.5, y + s * 0.12);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,244,205,0.88)';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.26);
      ctx.bezierCurveTo(x + s * 0.58, y + s * 0.36, x + s * 0.58, y + s * 0.5, x + s * 0.5, y + s * 0.62);
      ctx.bezierCurveTo(x + s * 0.42, y + s * 0.52, x + s * 0.42, y + s * 0.38, x + s * 0.5, y + s * 0.26);
      ctx.fill();
      ctx.restore();
    }

    if (isCore) {
      ctx.save();
      const cx = x + s / 2;
      const cy = y + s / 2;

      ctx.strokeStyle = 'rgba(255, 245, 180, 0.95)';
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.shadowColor = 'rgba(255, 210, 80, 0.7)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 250, 210, 0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private getAttackEffectColor(weaponId?: WeaponId): string {
    switch (weaponId) {
      case 'missile':
        return '#7ab8ff';
      case 'bomb':
        return '#ff8b45';
      case 'tub':
        return '#d8e4f4';
      case 'pan':
        return '#f7c75f';
      case 'katana':
        return '#ff8fcf';
      case 'sword':
        return '#d8e6ff';
      case 'spear':
        return '#7be3b1';
      default:
        return '#ff6630';
    }
  }

  private getArmoryWeaponLabel(weaponId: WeaponId): string {
    switch (weaponId) {
      case 'missile':
        return 'M';
      case 'bomb':
        return 'B';
      case 'tub':
        return 'T';
      case 'pan':
        return 'P';
      case 'katana':
        return 'K';
      case 'sword':
        return 'S';
      case 'spear':
        return 'L';
      default:
        return '?';
    }
  }

  private drawArmoryCell(
    x: number,
    y: number,
    size: number,
    colorIndex: number,
    weaponId: WeaponId,
    fragmentIndex: number,
    compact: boolean = false,
  ): void {
    const { ctx } = this;
    const color = BLOCK_COLORS[colorIndex] || '#888';
    const inset = compact ? Math.max(0.5, size * 0.06) : Math.max(1, size * 0.08);
    const radius = compact ? Math.max(1.5, size * 0.14) : Math.max(3, size * 0.18);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, radius);
    ctx.clip();

    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'rgba(18,22,36,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = 'rgba(8, 14, 24, 0.18)';
    ctx.fillRect(x + size * 0.08, y + size * 0.12, size * 0.84, size * 0.76);

    this.drawArmoryBadgeIcon(x, y, size, weaponId, compact);

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = compact ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = compact ? 0.9 : 1.2;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, radius);
    ctx.stroke();

    ctx.fillStyle = 'rgba(8, 12, 18, 0.82)';
    ctx.font = `${compact ? 'bold 6px' : `bold ${Math.max(8, Math.floor(size * 0.2))}px`} monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.getArmoryWeaponLabel(weaponId), x + size - inset * 1.8, y + size - inset * 1.6);
    ctx.restore();
  }

  private drawArmoryBadgeIcon(
    x: number,
    y: number,
    size: number,
    weaponId: WeaponId,
    compact: boolean,
  ): void {
    const { ctx } = this;
    const stroke = compact ? Math.max(0.9, size * 0.07) : Math.max(1.2, size * 0.08);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (weaponId === 'missile') {
      ctx.fillStyle = 'rgba(245, 250, 255, 0.95)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.18);
      ctx.lineTo(x + size * 0.66, y + size * 0.36);
      ctx.lineTo(x + size * 0.34, y + size * 0.36);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(44, 68, 106, 0.96)';
      ctx.fillRect(x + size * 0.41, y + size * 0.33, size * 0.18, size * 0.3);

      ctx.fillStyle = 'rgba(58, 98, 168, 0.95)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.41, y + size * 0.5);
      ctx.lineTo(x + size * 0.28, y + size * 0.62);
      ctx.lineTo(x + size * 0.41, y + size * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.59, y + size * 0.5);
      ctx.lineTo(x + size * 0.72, y + size * 0.62);
      ctx.lineTo(x + size * 0.59, y + size * 0.62);
      ctx.closePath();
      ctx.fill();

      const flame = ctx.createLinearGradient(x, y + size * 0.62, x, y + size * 0.84);
      flame.addColorStop(0, '#ffe08c');
      flame.addColorStop(1, '#ff6a30');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.82);
      ctx.lineTo(x + size * 0.39, y + size * 0.62);
      ctx.lineTo(x + size * 0.61, y + size * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (weaponId === 'bomb') {
      const cx = x + size * 0.47;
      const cy = y + size * 0.54;
      const r = size * 0.21;
      const bodyGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r);
      bodyGrad.addColorStop(0, '#4f4f58');
      bodyGrad.addColorStop(0.55, '#1f2028');
      bodyGrad.addColorStop(1, '#090a10');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#6f4d2a';
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.4, cy - r * 0.9);
      ctx.quadraticCurveTo(x + size * 0.76, y + size * 0.2, x + size * 0.78, y + size * 0.14);
      ctx.stroke();

      ctx.fillStyle = '#ff9d34';
      ctx.beginPath();
      ctx.arc(x + size * 0.8, y + size * 0.14, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (weaponId === 'tub') {
      ctx.strokeStyle = 'rgba(246,250,255,0.95)';
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.34);
      ctx.lineTo(x + size * 0.28, y + size * 0.62);
      ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.78, x + size * 0.72, y + size * 0.62);
      ctx.lineTo(x + size * 0.72, y + size * 0.34);
      ctx.stroke();

      ctx.fillStyle = 'rgba(190, 216, 240, 0.75)';
      ctx.fillRect(x + size * 0.3, y + size * 0.34, size * 0.4, size * 0.08);
      ctx.restore();
      return;
    }

    if (weaponId === 'katana') {
      ctx.strokeStyle = 'rgba(255, 236, 248, 0.98)';
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.26, y + size * 0.72);
      ctx.lineTo(x + size * 0.72, y + size * 0.28);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(104, 52, 78, 0.95)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.2, y + size * 0.78);
      ctx.lineTo(x + size * 0.32, y + size * 0.66);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 153, 205, 0.95)';
      ctx.fillRect(x + size * 0.16, y + size * 0.73, size * 0.12, size * 0.08);
      ctx.restore();
      return;
    }

    if (weaponId === 'sword') {
      ctx.fillStyle = 'rgba(245, 249, 255, 0.96)';
      ctx.fillRect(x + size * 0.45, y + size * 0.18, size * 0.1, size * 0.46);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.08);
      ctx.lineTo(x + size * 0.58, y + size * 0.22);
      ctx.lineTo(x + size * 0.42, y + size * 0.22);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(124, 140, 168, 0.95)';
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y + size * 0.56);
      ctx.lineTo(x + size * 0.7, y + size * 0.56);
      ctx.stroke();

      ctx.fillStyle = 'rgba(103, 73, 40, 0.95)';
      ctx.fillRect(x + size * 0.46, y + size * 0.56, size * 0.08, size * 0.18);
      ctx.restore();
      return;
    }

    if (weaponId === 'spear') {
      ctx.strokeStyle = 'rgba(230, 255, 245, 0.95)';
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.24, y + size * 0.74);
      ctx.lineTo(x + size * 0.68, y + size * 0.3);
      ctx.stroke();

      ctx.fillStyle = 'rgba(220, 255, 242, 0.96)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.74, y + size * 0.24);
      ctx.lineTo(x + size * 0.56, y + size * 0.32);
      ctx.lineTo(x + size * 0.66, y + size * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(76, 120, 94, 0.95)';
      ctx.fillRect(x + size * 0.18, y + size * 0.68, size * 0.14, size * 0.08);
      ctx.restore();
      return;
    }

    ctx.fillStyle = 'rgba(244, 194, 92, 0.95)';
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y + size * 0.52, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(93, 63, 20, 0.95)';
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y + size * 0.52, size * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.57, y + size * 0.52);
    ctx.lineTo(x + size * 0.8, y + size * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  private drawArmoryFragmentSlice(
    x: number,
    y: number,
    size: number,
    weaponId: WeaponId,
    fragmentIndex: number,
  ): void {
    const { ctx } = this;
    const fragmentCol = fragmentIndex % 3;
    const fragmentRow = Math.floor(fragmentIndex / 3);
    const fullSize = size * 3;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.translate(x - fragmentCol * size, y - fragmentRow * size);
    this.drawArmoryIllustration(weaponId, 0, 0, fullSize);
    ctx.restore();
  }

  private drawArmoryIllustration(weaponId: WeaponId, x: number, y: number, size: number): void {
    const { ctx } = this;

    if (weaponId === 'missile') {
      const cx = x + size * 0.5;
      ctx.save();
      ctx.fillStyle = 'rgba(245, 250, 255, 0.92)';
      ctx.beginPath();
      ctx.moveTo(cx, y + size * 0.08);
      ctx.lineTo(x + size * 0.64, y + size * 0.26);
      ctx.lineTo(x + size * 0.36, y + size * 0.26);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(44, 68, 106, 0.92)';
      ctx.fillRect(x + size * 0.42, y + size * 0.24, size * 0.16, size * 0.46);

      ctx.fillStyle = 'rgba(192, 224, 255, 0.95)';
      ctx.fillRect(x + size * 0.45, y + size * 0.31, size * 0.1, size * 0.14);

      ctx.fillStyle = 'rgba(58, 98, 168, 0.95)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.42, y + size * 0.54);
      ctx.lineTo(x + size * 0.24, y + size * 0.68);
      ctx.lineTo(x + size * 0.42, y + size * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.58, y + size * 0.54);
      ctx.lineTo(x + size * 0.76, y + size * 0.68);
      ctx.lineTo(x + size * 0.58, y + size * 0.68);
      ctx.closePath();
      ctx.fill();

      const flame = ctx.createLinearGradient(cx, y + size * 0.68, cx, y + size * 0.92);
      flame.addColorStop(0, '#ffe08c');
      flame.addColorStop(0.55, '#ff9b39');
      flame.addColorStop(1, '#ff5230');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(cx, y + size * 0.94);
      ctx.lineTo(x + size * 0.38, y + size * 0.7);
      ctx.lineTo(x + size * 0.62, y + size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (weaponId === 'bomb') {
      const cx = x + size * 0.5;
      const cy = y + size * 0.58;
      const radius = size * 0.25;
      ctx.save();
      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      grad.addColorStop(0, '#4a4a4a');
      grad.addColorStop(0.55, '#191919');
      grad.addColorStop(1, '#050505');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.28, cy - radius * 0.26, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#8b6439';
      ctx.lineWidth = size * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + radius * 0.1, cy - radius * 0.92);
      ctx.quadraticCurveTo(x + size * 0.78, y + size * 0.16, x + size * 0.7, y + size * 0.06);
      ctx.stroke();

      ctx.fillStyle = '#ffb248';
      ctx.beginPath();
      ctx.arc(x + size * 0.7, y + size * 0.06, size * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (weaponId === 'tub') {
      ctx.save();
      const rimGrad = ctx.createLinearGradient(x, y + size * 0.28, x, y + size * 0.42);
      rimGrad.addColorStop(0, '#f2f7ff');
      rimGrad.addColorStop(1, '#9db0c7');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(x + size * 0.18, y + size * 0.28, size * 0.64, size * 0.1);

      const bodyGrad = ctx.createLinearGradient(x, y + size * 0.36, x, y + size * 0.76);
      bodyGrad.addColorStop(0, '#dfe8f5');
      bodyGrad.addColorStop(0.55, '#a2b5ca');
      bodyGrad.addColorStop(1, '#657689');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.24, y + size * 0.38);
      ctx.quadraticCurveTo(x + size * 0.18, y + size * 0.6, x + size * 0.3, y + size * 0.76);
      ctx.lineTo(x + size * 0.7, y + size * 0.76);
      ctx.quadraticCurveTo(x + size * 0.82, y + size * 0.6, x + size * 0.76, y + size * 0.38);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(82, 96, 114, 0.9)';
      ctx.lineWidth = size * 0.025;
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (weaponId === 'katana') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 244, 250, 0.96)';
      ctx.lineWidth = size * 0.04;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.2, y + size * 0.8);
      ctx.lineTo(x + size * 0.8, y + size * 0.2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 173, 214, 0.96)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.24, y + size * 0.82);
      ctx.lineTo(x + size * 0.82, y + size * 0.24);
      ctx.stroke();

      ctx.fillStyle = '#77495a';
      ctx.fillRect(x + size * 0.12, y + size * 0.74, size * 0.16, size * 0.08);
      ctx.fillStyle = '#ff9fcd';
      ctx.fillRect(x + size * 0.18, y + size * 0.7, size * 0.08, size * 0.16);
      ctx.restore();
      return;
    }

    if (weaponId === 'sword') {
      ctx.save();
      const bladeGrad = ctx.createLinearGradient(x + size * 0.5, y + size * 0.1, x + size * 0.5, y + size * 0.8);
      bladeGrad.addColorStop(0, '#ffffff');
      bladeGrad.addColorStop(0.45, '#dce7f8');
      bladeGrad.addColorStop(1, '#8ea2bf');
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.06);
      ctx.lineTo(x + size * 0.6, y + size * 0.24);
      ctx.lineTo(x + size * 0.56, y + size * 0.72);
      ctx.lineTo(x + size * 0.44, y + size * 0.72);
      ctx.lineTo(x + size * 0.4, y + size * 0.24);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#99a8c1';
      ctx.lineWidth = size * 0.03;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.62);
      ctx.lineTo(x + size * 0.72, y + size * 0.62);
      ctx.stroke();

      ctx.fillStyle = '#6c5337';
      ctx.fillRect(x + size * 0.46, y + size * 0.62, size * 0.08, size * 0.22);
      ctx.restore();
      return;
    }

    if (weaponId === 'spear') {
      ctx.save();
      ctx.strokeStyle = '#dffff1';
      ctx.lineWidth = size * 0.035;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.18, y + size * 0.82);
      ctx.lineTo(x + size * 0.74, y + size * 0.26);
      ctx.stroke();

      ctx.fillStyle = '#ebfff6';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.8, y + size * 0.2);
      ctx.lineTo(x + size * 0.6, y + size * 0.28);
      ctx.lineTo(x + size * 0.7, y + size * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#5d8c73';
      ctx.fillRect(x + size * 0.12, y + size * 0.76, size * 0.16, size * 0.08);
      ctx.restore();
      return;
    }

    ctx.save();
    const panGrad = ctx.createRadialGradient(x + size * 0.34, y + size * 0.5, size * 0.04, x + size * 0.34, y + size * 0.5, size * 0.28);
    panGrad.addColorStop(0, '#fff1b0');
    panGrad.addColorStop(0.45, '#f0ba57');
    panGrad.addColorStop(1, '#8a5d1e');
    ctx.fillStyle = panGrad;
    ctx.beginPath();
    ctx.arc(x + size * 0.34, y + size * 0.52, size * 0.23, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(76, 48, 16, 0.95)';
    ctx.lineWidth = size * 0.03;
    ctx.stroke();

    ctx.fillStyle = '#6e4b20';
    ctx.fillRect(x + size * 0.48, y + size * 0.48, size * 0.3, size * 0.06);
    ctx.fillRect(x + size * 0.74, y + size * 0.46, size * 0.12, size * 0.1);
    ctx.restore();
  }

  private drawColorCue(x: number, y: number, size: number, colorIndex: number): void {
    const { ctx } = this;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (colorIndex === 3) {
      // Green pieces get a dark mineral vein slash.
      ctx.strokeStyle = 'rgba(18, 32, 12, 0.78)';
      ctx.lineWidth = Math.max(1.5, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.22, y + size * 0.34);
      ctx.lineTo(x + size * 0.46, y + size * 0.66);
      ctx.lineTo(x + size * 0.76, y + size * 0.3);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 248, 210, 0.42)';
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y + size * 0.76);
      ctx.lineTo(x + size * 0.58, y + size * 0.52);
      ctx.stroke();
    } else if (colorIndex === 5) {
      // Blue pieces get a bright diamond shard marker.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.22);
      ctx.lineTo(x + size * 0.68, y + size * 0.5);
      ctx.lineTo(x + size * 0.5, y + size * 0.78);
      ctx.lineTo(x + size * 0.34, y + size * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(8, 22, 70, 0.7)';
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.28);
      ctx.lineTo(x + size * 0.5, y + size * 0.72);
      ctx.stroke();
    } else if (colorIndex === 9) {
      // Rescue colony pieces get a plated hull with window slits.
      ctx.strokeStyle = 'rgba(28, 72, 110, 0.88)';
      ctx.lineWidth = Math.max(1.2, size * 0.055);
      ctx.strokeRect(x + size * 0.18, y + size * 0.22, size * 0.64, size * 0.56);

      ctx.fillStyle = 'rgba(66, 122, 180, 0.82)';
      ctx.fillRect(x + size * 0.22, y + size * 0.34, size * 0.56, size * 0.12);
      ctx.fillRect(x + size * 0.22, y + size * 0.54, size * 0.56, size * 0.12);

      ctx.fillStyle = 'rgba(255, 252, 222, 0.92)';
      const windowSize = Math.max(1.2, size * 0.08);
      for (let i = 0; i < 3; i++) {
        const wx = x + size * (0.3 + i * 0.16);
        ctx.fillRect(wx, y + size * 0.37, windowSize, windowSize);
        ctx.fillRect(wx, y + size * 0.57, windowSize, windowSize);
      }
    } else if (colorIndex === 10) {
      // Support weights look like heavy steel ballast plates.
      ctx.strokeStyle = 'rgba(32, 38, 50, 0.9)';
      ctx.lineWidth = Math.max(1.2, size * 0.055);
      ctx.strokeRect(x + size * 0.18, y + size * 0.2, size * 0.64, size * 0.6);

      ctx.fillStyle = 'rgba(210, 220, 235, 0.45)';
      ctx.fillRect(x + size * 0.26, y + size * 0.3, size * 0.48, size * 0.1);
      ctx.fillRect(x + size * 0.26, y + size * 0.6, size * 0.48, size * 0.08);

      ctx.fillStyle = 'rgba(28, 32, 42, 0.82)';
      const boltRadius = Math.max(1.3, size * 0.055);
      const boltPositions = [
        [0.3, 0.35],
        [0.7, 0.35],
        [0.3, 0.63],
        [0.7, 0.63],
      ] as const;
      for (const [bx, by] of boltPositions) {
        ctx.beginPath();
        ctx.arc(x + size * bx, y + size * by, boltRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawPiece(piece: Piece): void {
    // Mega bomb: draw as a single large bomb
    if (piece.isMegaBomb && piece.y >= 0) {
      this.drawMegaBomb(piece.x, piece.y);
      return;
    }

    const matrix = piece.getMatrix();
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const by = piece.y + row;
          if (by >= 0) {
            const isBomb = piece.isBombAt(col, row);
            const isFire = piece.isFireAt(col, row);
            const bombKind = piece.getBombKindAt(col, row) ?? undefined;
            const fragment = piece.getArmoryFragmentAt(col, row);
            const colorIndex = isBomb
              ? bombKind === 'thunder'
                ? 16
                : bombKind === 'cluster'
                  ? 17
                  : 8
              : isFire
                ? 15
                : piece.getColorAt(col, row);
            this.drawCell(
              piece.x + col,
              by,
              colorIndex,
              isBomb,
              false,
              fragment?.weaponId,
              fragment?.fragmentIndex,
              isFire,
              bombKind,
            );
          }
        }
      }
    }
  }

  private drawGhostPiece(piece: Piece, ghostY: number): void {
    const { ctx } = this;
    const matrix = piece.getMatrix();
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const visibleY = ghostY + row;
          if (visibleY >= 0) {
            const x = this.offsetX + (piece.x + col) * this.cellSize;
            const y = this.offsetY + visibleY * this.cellSize;
            const s = this.cellSize;
            const isBomb = piece.isBombAt(col, row);
            const colorIndex = piece.getColorAt(col, row);
            const color = isBomb ? '#ff4444' : (BLOCK_COLORS[colorIndex] || '#888');
            // Filled semi-transparent ghost
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = color;
            ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
            // Border
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  private drawHUD(
    modeType: GameModeType,
    score: number,
    level: number,
    lines: number,
    speed: number,
    highScore: number,
    globalHighScore: number,
    nextPieces: PieceDefinition[],
    holdPiece: PieceDefinition | null,
    canvasWidth: number,
  ): void {
    const { ctx } = this;
    const gap = this.isMobile ? 4 : 12;
    const rightX = this.offsetX + this.boardPixelWidth + gap;
    let yPos = this.offsetY + 6;
    const labelFont = this.isMobile ? '9px monospace' : '11px monospace';
    const valueFont = this.isMobile ? 'bold 12px monospace' : 'bold 16px monospace';
    const lineHeight = this.isMobile ? 28 : 38;
    const valOffset = this.isMobile ? 11 : 15;
    const miniS = this.isMobile ? 8 : 12;
    const miniGap = this.isMobile ? 34 : 48;

    // Panel background
    const panelW = canvasWidth - rightX - 4;
    const panelH = this.boardPixelHeight;
    ctx.fillStyle = 'rgba(10, 10, 30, 0.5)';
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(rightX - 4 + r, this.offsetY - 2);
    ctx.lineTo(rightX - 4 + panelW - r, this.offsetY - 2);
    ctx.quadraticCurveTo(rightX - 4 + panelW, this.offsetY - 2, rightX - 4 + panelW, this.offsetY - 2 + r);
    ctx.lineTo(rightX - 4 + panelW, this.offsetY - 2 + panelH - r);
    ctx.quadraticCurveTo(rightX - 4 + panelW, this.offsetY - 2 + panelH, rightX - 4 + panelW - r, this.offsetY - 2 + panelH);
    ctx.lineTo(rightX - 4 + r, this.offsetY - 2 + panelH);
    ctx.quadraticCurveTo(rightX - 4, this.offsetY - 2 + panelH, rightX - 4, this.offsetY - 2 + panelH - r);
    ctx.lineTo(rightX - 4, this.offsetY - 2 + r);
    ctx.quadraticCurveTo(rightX - 4, this.offsetY - 2, rightX - 4 + r, this.offsetY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 80, 140, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const drawLabel = (label: string, value: string, color?: string) => {
      ctx.fillStyle = '#aac';
      ctx.font = labelFont;
      ctx.textAlign = 'left';
      ctx.fillText(label, rightX, yPos);
      ctx.fillStyle = color || '#fff';
      ctx.font = valueFont;
      ctx.fillText(value, rightX, yPos + valOffset);
      yPos += lineHeight;
    };

    // Score
    drawLabel('SCORE', score.toLocaleString());

    // Personal best
    drawLabel('MY BEST', highScore.toLocaleString(), '#ffd700');

    // Global best
    drawLabel('WORLD', globalHighScore > 0 ? globalHighScore.toLocaleString() : '---', '#55ddff');

    // Level
    drawLabel('LEVEL', `${level}`);

    // Lines
    drawLabel(
      modeType === 'purify'
        ? 'CORES'
        : modeType === 'armory'
          ? 'WEAPONS'
          : modeType === 'bomber'
            ? 'BLAST'
            : 'LINES',
      `${lines}`,
    );

    // Speed (show as relative speed, 1.0x at start)
    const speedMultiplier = (INITIAL_DROP_INTERVAL / speed).toFixed(1);
    drawLabel('SPEED', `${speedMultiplier}x`, speed < 300 ? '#ff4444' : speed < 600 ? '#ffaa00' : '#55ff55');

    if (modeType === 'bomber') {
      yPos = this.drawBomberIgnitionHint(rightX, yPos, panelW);
    } else if (modeType === 'armory') {
      yPos = this.drawArmoryBuildHint(rightX, yPos, panelW);
    }

    // Next pieces
    ctx.fillStyle = '#aac';
    ctx.font = labelFont;
    ctx.fillText('NEXT', rightX, yPos);
    yPos += valOffset;
    for (let i = 0; i < nextPieces.length; i++) {
      this.drawMiniPiece(nextPieces[i], rightX + 2, yPos + i * miniGap, miniS);
    }

    // Hold piece - draw below NEXT on the right side
    yPos += nextPieces.length * miniGap + 4;
    ctx.fillStyle = '#aac';
    ctx.font = labelFont;
    ctx.textAlign = 'left';
    ctx.fillText('HOLD', rightX, yPos);
    if (holdPiece) {
      this.drawMiniPiece(holdPiece, rightX + 2, yPos + valOffset, miniS);
    }
  }

  private drawArmoryBuildHint(rightX: number, yPos: number, panelWidth: number): number {
    const { ctx } = this;
    const boxTop = yPos - 2;
    const boxHeight = this.isMobile ? 32 : 72;
    const boxWidth = Math.max(46, panelWidth - 12);

    ctx.save();
    ctx.fillStyle = 'rgba(255,180,93,0.08)';
    ctx.strokeStyle = 'rgba(255,180,93,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rightX - 4, boxTop, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffcf7a';
    ctx.font = this.isMobile ? 'bold 8px monospace' : 'bold 11px monospace';
    ctx.fillText('BUILD', rightX + 4, boxTop + 12);

    ctx.fillStyle = '#fff2d8';
    ctx.font = this.isMobile ? 'bold 8px monospace' : 'bold 12px monospace';
    ctx.fillText('2x2 / 6 OVERDRIVE', rightX + 4, boxTop + (this.isMobile ? 22 : 28));

    if (!this.isMobile) {
      ctx.fillStyle = '#d6dced';
      ctx.font = '10px monospace';
      ctx.fillText('HIT 1 WEAPON CELL TO CHAIN', rightX + 4, boxTop + 44);
      const sampleX = rightX + boxWidth - 32;
      const sampleY = boxTop + 14;
      this.drawArmoryCell(sampleX, sampleY, 10, 11, 'missile', 0, true);
      this.drawArmoryCell(sampleX + 11, sampleY, 10, 11, 'missile', 0, true);
      this.drawArmoryCell(sampleX, sampleY + 11, 10, 11, 'missile', 0, true);
      this.drawArmoryCell(sampleX + 11, sampleY + 11, 10, 11, 'missile', 0, true);
    }

    ctx.restore();
    return yPos + boxHeight + 8;
  }

  private drawBomberIgnitionHint(rightX: number, yPos: number, panelWidth: number): number {
    const { ctx } = this;
    const boxTop = yPos - 2;
    const boxHeight = this.isMobile ? 34 : 62;
    const boxWidth = Math.max(46, panelWidth - 12);

    ctx.save();
    ctx.fillStyle = 'rgba(255,106,77,0.08)';
    ctx.strokeStyle = 'rgba(255,106,77,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rightX - 4, boxTop, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffb08c';
    ctx.font = this.isMobile ? 'bold 8px monospace' : 'bold 11px monospace';
    ctx.fillText('IGNITE', rightX + 4, boxTop + 12);

    ctx.fillStyle = '#ffe9d0';
    ctx.font = this.isMobile ? 'bold 8px monospace' : 'bold 12px monospace';
    ctx.fillText('FIRE + BOMB', rightX + 4, boxTop + (this.isMobile ? 22 : 28));

    if (!this.isMobile) {
      ctx.fillStyle = '#d6dced';
      ctx.font = '10px monospace';
      ctx.fillText('ROWS DO NOTHING', rightX + 4, boxTop + 44);
    }

    ctx.restore();
    return yPos + boxHeight + 8;
  }

  private drawMiniPiece(def: PieceDefinition, x: number, y: number, size: number = 12): void {
    const { ctx } = this;
    const miniSize = size;
    const matrix = def.matrices[0];

    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const cx = x + col * miniSize;
          const cy = y + row * miniSize;
          const ms = miniSize - 1;
          const colorIndex = getPieceDefinitionCellColor(def, 0, col, row);
          const color = BLOCK_COLORS[colorIndex] || '#888';
          const fragment = getPieceDefinitionArmoryFragment(def, 0, col, row);

          if (fragment) {
            this.drawArmoryCell(cx, cy, ms, colorIndex, fragment.weaponId, fragment.fragmentIndex, true);
          } else {
            // Mini meteor style
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx + ms / 2, cy + ms / 2, ms / 2, 0, Math.PI * 2);
            ctx.fill();
            this.drawColorCue(cx, cy, ms, colorIndex);
            // Light spot
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath();
            ctx.arc(cx + ms * 0.35, cy + ms * 0.35, ms * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  private drawParticles(): void {
    const { ctx } = this;

    // Blast rings (drawn behind particles)
    for (const ring of this.effects.blastRings) {
      const progress = 1 - ring.life / ring.maxLife; // 0→1
      const currentRadius = ring.maxRadius * progress;
      const alpha = (1 - progress) * 0.6;
      const lineWidth = Math.max(2, (1 - progress) * 6);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ff6630';
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill (faint)
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = '#ff8844';
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Particles
    for (const p of this.effects.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawChainText(
    text: string,
    timer: number,
    effectTier: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const { ctx } = this;
    const progress = 1 - (timer / 2000); // 0 to 1
    const scale = 1 + Math.sin(progress * Math.PI) * 0.3;
    const alpha = Math.min(1, timer / 500);

    const color = EFFECT_COLORS[effectTier] || '#fff';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSize = effectTier >= 3 ? 48 : effectTier >= 2 ? 40 : effectTier >= 1 ? 32 : 26;

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 + effectTier * 10;
    ctx.font = `bold ${Math.floor(fontSize * scale)}px monospace`;
    ctx.fillStyle = color;
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 - 50);

    // Second pass for extra glow on high tiers
    if (effectTier >= 2) {
      ctx.shadowBlur = 40;
      ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 - 50);
    }

    ctx.restore();
  }

  /** Draw only the animated background (stars, nebula, debris) for title screen */
  drawTitleBackground(): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#050510');
    bgGrad.addColorStop(0.4, '#0a0a20');
    bgGrad.addColorStop(0.7, '#0d0818');
    bgGrad.addColorStop(1, '#080510');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    this.drawNebulae(w, h, 16);
    this.drawStars(w, h, 16);
    this.drawDebris(w, h, 16);
  }

  drawGameOver(score: number, highScore: number, animTimer: number = 0, board?: Board): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    // Game over animation: blocks crumble row by row from bottom
    const ANIM_DURATION = 1500; // total animation ms
    const visibleRows = BOARD_HEIGHT;

    if (board && animTimer < ANIM_DURATION) {
      if (animTimer <= 100) {
        this.gameOverDissolvedRows.clear();
      }

      // Spawn crumble particles progressively
      const progress = animTimer / ANIM_DURATION;
      const rowsToDissolve = Math.floor(progress * visibleRows);

      // Spawn particles for newly dissolved rows (check each frame)
      for (let i = 0; i < rowsToDissolve; i++) {
        const boardRow = BOARD_HEIGHT - 1 - i; // bottom to top
        const visibleY = boardRow;
        if (visibleY < 0) continue;
        if (this.gameOverDissolvedRows.has(boardRow)) continue;
        this.gameOverDissolvedRows.add(boardRow);

        for (let x = 0; x < BOARD_WIDTH; x++) {
          const cell = board.getCell(x, boardRow);
          if (cell.type !== 'empty') {
            const px = this.offsetX + (x + 0.5) * this.cellSize;
            const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
            const color = BLOCK_COLORS[cell.color] || '#888';
            this.effects.spawnExplosion(px, py, color, 0.5);
          }
        }
      }

      // Semi-transparent overlay during animation
      const overlayAlpha = Math.min(0.5, progress * 0.6);
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // After animation: just darken — React overlay handles all UI text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);
  }

  drawTitle(selectedMode: 'classic' | 'bomber' = 'classic'): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    // Same rich background as gameplay
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#050510');
    bgGrad.addColorStop(0.4, '#0a0a20');
    bgGrad.addColorStop(0.7, '#0d0818');
    bgGrad.addColorStop(1, '#080510');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    this.drawNebulae(w, h, 0);
    this.drawStars(w, h, 0);

    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 30;
    ctx.fillText('METEOR CRUSH', w / 2, h / 2 - 80);
    ctx.shadowBlur = 0;

    // Mode selection - 2 modes
    const modes: { key: string; label: string; color: string; glow: string }[] = [
      { key: 'classic', label: '1:CLASSIC', color: '#fff', glow: '#5ec4c4' },
      { key: 'bomber', label: '2:BOMBER', color: '#ff4444', glow: '#ff2244' },
    ];

    ctx.font = 'bold 18px monospace';
    const spacing = 120;
    const startX = w / 2 - spacing / 2;

    for (let i = 0; i < modes.length; i++) {
      const m = modes[i];
      const isSelected = selectedMode === m.key;
      ctx.fillStyle = isSelected ? m.color : '#556';
      if (isSelected) {
        ctx.shadowColor = m.glow;
        ctx.shadowBlur = 12;
      }
      ctx.fillText(m.label, startX + i * spacing, h / 2 - 10);
      ctx.shadowBlur = 0;
    }

    // Mode description
    ctx.font = '12px monospace';
    if (selectedMode === 'bomber') {
      ctx.fillStyle = '#ff8866';
      ctx.fillText('\u2738 Fire blocks ignite chain bombs!', w / 2, h / 2 + 15);
    } else {
      ctx.fillStyle = '#5ec4c4';
      ctx.fillText('Standard meteor stacking', w / 2, h / 2 + 15);
    }

    ctx.fillStyle = '#aac';
    ctx.font = '18px monospace';
    ctx.fillText('Press SPACE to start', w / 2, h / 2 + 50);

    ctx.fillStyle = '#778';
    ctx.font = '14px monospace';
    ctx.fillText('Arrow keys: Move  |  Up/W: Rotate  |  Space: Drop', w / 2, h / 2 + 90);
    ctx.fillText('Shift/C: Hold  |  Z: Rotate CCW  |  P: Pause', w / 2, h / 2 + 112);
  }

  drawPaused(): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', w / 2, h / 2);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Press P or ESC to resume', w / 2, h / 2 + 40);
  }
}
