import { BOARD_WIDTH, BOARD_HEIGHT, HIDDEN_ROWS, BLOCK_COLORS, CELL_SIZE, INITIAL_DROP_INTERVAL } from '@/lib/constants';
import { Board } from '@/engine/Board';
import { Piece } from '@/engine/Piece';
import { PieceDefinition, VisualEvent } from '@/engine/types';
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

  // Effects
  readonly effects: EffectManager = new EffectManager();

  // Starfield
  private stars: { x: number; y: number; brightness: number; speed: number }[] = [];
  private starTimer: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.initStars();
  }

  resize(canvasWidth: number, canvasHeight: number): void {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;
    const visibleRows = BOARD_HEIGHT - HIDDEN_ROWS;
    const maxCellW = Math.floor(canvasWidth * 0.6 / BOARD_WIDTH);
    const maxCellH = Math.floor(canvasHeight * 0.95 / visibleRows);
    this.cellSize = Math.min(maxCellW, maxCellH);

    this.boardPixelWidth = BOARD_WIDTH * this.cellSize;
    this.boardPixelHeight = visibleRows * this.cellSize;
    this.offsetX = Math.floor((canvasWidth - this.boardPixelWidth) / 2);
    this.offsetY = Math.floor((canvasHeight - this.boardPixelHeight) / 2);
  }

  /** Board layout info for touch coordinate mapping */
  getBoardLayout(): { offsetX: number; cellSize: number } {
    return { offsetX: this.offsetX, cellSize: this.cellSize };
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        brightness: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.02 + 0.005,
      });
    }
  }

  /** Process visual events from the engine and spawn effects */
  processVisualEvents(events: VisualEvent[]): void {
    for (const evt of events) {
      if (evt.type === 'line_clear' && evt.rows) {
        for (const row of evt.rows) {
          const visibleY = row - HIDDEN_ROWS;
          if (visibleY >= 0) {
            const py = this.offsetY + visibleY * this.cellSize;
            this.effects.spawnLineClear(py, this.offsetX, this.boardPixelWidth, this.cellSize);
          }
        }
        this.effects.addShake(2, 150);
      }
      if (evt.type === 'explosion' && evt.cells) {
        const intensity = Math.min(2, 0.8 + (evt.chainCount || 1) * 0.3);
        for (const cell of evt.cells) {
          const visibleY = cell.y - HIDDEN_ROWS;
          if (visibleY >= 0) {
            const px = this.offsetX + (cell.x + 0.5) * this.cellSize;
            const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
            this.effects.spawnExplosion(px, py, '#ff6630', intensity);
          }
        }
        // Spawn blast rings at bomb centers to show explosion radius
        if (evt.blastCenters) {
          for (const bc of evt.blastCenters) {
            const visibleY = bc.y - HIDDEN_ROWS;
            if (visibleY >= 0) {
              const px = this.offsetX + (bc.x + 0.5) * this.cellSize;
              const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
              const pixelRadius = bc.radius * this.cellSize;
              this.effects.spawnBlastRing(px, py, pixelRadius);
            }
          }
        }
        this.effects.addShake(3 + (evt.chainCount || 1) * 2, 300);
        this.effects.addFlash(100);
      }
    }
  }

  render(
    board: Board,
    currentPiece: Piece | null,
    ghostY: number,
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

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Stars
    this.drawStars(w, h, deltaTime);

    // Apply shake offset for board content
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Board border
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX - 2, this.offsetY - 2, this.boardPixelWidth + 4, this.boardPixelHeight + 4);

    // Board background
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.fillRect(this.offsetX, this.offsetY, this.boardPixelWidth, this.boardPixelHeight);

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
    this.drawHUD(score, level, lines, speed, highScore, globalHighScore, nextPieces, holdPiece, w);

    // Chain text
    if (chainText && chainTextTimer > 0) {
      this.drawChainText(chainText, chainTextTimer, chainEffectTier, w, h);
    }

    // Screen flash overlay
    if (this.effects.screenFlash > 0) {
      const flashAlpha = Math.min(0.4, this.effects.screenFlash / 150);
      ctx.fillStyle = `rgba(255, 200, 100, ${flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawStars(w: number, h: number, deltaTime: number): void {
    this.starTimer += deltaTime;
    for (const star of this.stars) {
      star.y += star.speed * deltaTime * 0.001;
      if (star.y > 1) star.y -= 1;

      const twinkle = Math.sin(this.starTimer * 0.003 + star.x * 100) * 0.3 + 0.7;
      const alpha = star.brightness * twinkle;
      this.ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
      this.ctx.fillRect(star.x * w, star.y * h, 2, 2);
    }
  }

  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(50, 50, 80, 0.3)';
    ctx.lineWidth = 0.5;

    const visibleRows = BOARD_HEIGHT - HIDDEN_ROWS;

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
    // Track mega bomb cells already drawn as part of a 2x2 cluster
    const megaDrawn = new Set<string>();

    // First pass: find and draw 2x2 mega bomb clusters
    for (let y = HIDDEN_ROWS; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        const c00 = board.getCell(x, y);
        const c10 = board.getCell(x + 1, y);
        const c01 = board.getCell(x, y + 1);
        const c11 = board.getCell(x + 1, y + 1);
        if (c00.megaBomb && c10.megaBomb && c01.megaBomb && c11.megaBomb) {
          const vy = y - HIDDEN_ROWS;
          this.drawMegaBomb(x, vy);
          megaDrawn.add(`${x},${y}`);
          megaDrawn.add(`${x + 1},${y}`);
          megaDrawn.add(`${x},${y + 1}`);
          megaDrawn.add(`${x + 1},${y + 1}`);
        }
      }
    }

    // Second pass: draw normal cells (skip mega bomb cells already drawn)
    for (let y = HIDDEN_ROWS; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (megaDrawn.has(`${x},${y}`)) continue;
        const cell = board.getCell(x, y);
        if (cell.type !== 'empty') {
          this.drawCell(x, y - HIDDEN_ROWS, cell.color, cell.type === 'bomb');
        }
      }
    }
  }

  /** Draw a 2x2 mega bomb spanning (boardX, visibleY) to (boardX+1, visibleY+1) */
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

  private drawCell(boardX: number, visibleY: number, colorIndex: number, isBomb: boolean): void {
    const { ctx } = this;
    const x = this.offsetX + boardX * this.cellSize;
    const y = this.offsetY + visibleY * this.cellSize;
    const s = this.cellSize;
    const p = 1; // padding

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

    // Bomb: black sphere with fuse
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

      ctx.restore();
    }
  }

  private drawPiece(piece: Piece): void {
    // Mega bomb: draw as a single large bomb
    if (piece.isMegaBomb && piece.y >= HIDDEN_ROWS) {
      this.drawMegaBomb(piece.x, piece.y - HIDDEN_ROWS);
      return;
    }

    const matrix = piece.getMatrix();
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const by = piece.y + row;
          if (by >= HIDDEN_ROWS) {
            const isBomb = piece.isBombAt(col, row);
            this.drawCell(piece.x + col, by - HIDDEN_ROWS, piece.definition.color, isBomb);
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
          const visibleY = ghostY + row - HIDDEN_ROWS;
          if (visibleY >= 0) {
            const x = this.offsetX + (piece.x + col) * this.cellSize;
            const y = this.offsetY + visibleY * this.cellSize;
            const s = this.cellSize;
            const isBomb = piece.isBombAt(col, row);
            ctx.strokeStyle = isBomb ? '#ff4444' : (BLOCK_COLORS[piece.definition.color] || '#888');
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  private drawHUD(
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
    const rightX = this.offsetX + this.boardPixelWidth + 20;
    const leftX = this.offsetX - 120;
    let yPos = this.offsetY + 10;
    const lineHeight = 45;

    const drawLabel = (label: string, value: string, color?: string) => {
      ctx.fillStyle = '#aac';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, rightX, yPos);
      ctx.fillStyle = color || '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(value, rightX, yPos + 18);
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
    drawLabel('LINES', `${lines}`);

    // Speed (show as relative speed, 1.0x at start)
    const speedMultiplier = (INITIAL_DROP_INTERVAL / speed).toFixed(1);
    drawLabel('SPEED', `${speedMultiplier}x`, speed < 300 ? '#ff4444' : speed < 600 ? '#ffaa00' : '#55ff55');

    // Next pieces
    ctx.fillStyle = '#aac';
    ctx.font = '14px monospace';
    ctx.fillText('NEXT', rightX, yPos);
    yPos += 20;
    for (let i = 0; i < nextPieces.length; i++) {
      this.drawMiniPiece(nextPieces[i], rightX + 10, yPos + i * 60);
    }

    // Hold piece on the left (if there's room)
    if (leftX > 10) {
      ctx.fillStyle = '#aac';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HOLD', leftX, this.offsetY + 20);
      if (holdPiece) {
        this.drawMiniPiece(holdPiece, leftX + 10, this.offsetY + 40);
      }
    }
  }

  private drawMiniPiece(def: PieceDefinition, x: number, y: number): void {
    const { ctx } = this;
    const miniSize = 12;
    const matrix = def.matrices[0];
    const color = BLOCK_COLORS[def.color] || '#888';

    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const cx = x + col * miniSize;
          const cy = y + row * miniSize;
          const ms = miniSize - 1;
          // Mini meteor style
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx + ms / 2, cy + ms / 2, ms / 2, 0, Math.PI * 2);
          ctx.fill();
          // Light spot
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.arc(cx + ms * 0.35, cy + ms * 0.35, ms * 0.2, 0, Math.PI * 2);
          ctx.fill();
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

  drawGameOver(score: number, highScore: number, animTimer: number = 0, board?: Board): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    // Game over animation: blocks crumble row by row from bottom
    const ANIM_DURATION = 1500; // total animation ms
    const visibleRows = BOARD_HEIGHT - HIDDEN_ROWS;

    if (board && animTimer < ANIM_DURATION) {
      // Spawn crumble particles progressively
      const progress = animTimer / ANIM_DURATION;
      const rowsToDissolve = Math.floor(progress * visibleRows);

      // Spawn particles for newly dissolved rows (check each frame)
      for (let i = 0; i < rowsToDissolve; i++) {
        const boardRow = BOARD_HEIGHT - 1 - i; // bottom to top
        const visibleY = boardRow - HIDDEN_ROWS;
        if (visibleY < 0) continue;

        for (let x = 0; x < BOARD_WIDTH; x++) {
          const cell = board.getCell(x, boardRow);
          if (cell.type !== 'empty') {
            // Only spawn particles once per cell (check if still populated)
            const px = this.offsetX + (x + 0.5) * this.cellSize;
            const py = this.offsetY + (visibleY + 0.5) * this.cellSize;
            const color = BLOCK_COLORS[cell.color] || '#888';
            this.effects.spawnExplosion(px, py, color, 0.5);
            board.destroyCell(x, boardRow);
          }
        }
      }

      // Semi-transparent overlay during animation
      const overlayAlpha = Math.min(0.7, progress * 0.9);
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // Show GAME OVER text fading in
      const textAlpha = Math.min(1, progress * 2);
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 60);
      ctx.restore();
      return;
    }

    // After animation: full game over screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 60);

    ctx.fillStyle = '#fff';
    ctx.font = '24px monospace';
    ctx.fillText(`Score: ${score.toLocaleString()}`, w / 2, h / 2);

    if (score >= highScore && highScore > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px monospace';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 15;
      ctx.fillText('NEW HIGH SCORE!', w / 2, h / 2 + 35);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#aac';
      ctx.font = '18px monospace';
      ctx.fillText(`Hi-Score: ${highScore.toLocaleString()}`, w / 2, h / 2 + 35);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 80);
  }

  drawTitle(selectedMode: 'classic' | 'bomber' = 'classic'): void {
    const { ctx } = this;
    const w = this.canvasW;
    const h = this.canvasH;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
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
      ctx.fillText('\u2738 Bombs + chain explosions!', w / 2, h / 2 + 15);
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
