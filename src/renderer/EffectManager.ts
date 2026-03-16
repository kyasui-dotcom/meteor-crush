/**
 * Visual effects manager: particles, screen shake, flash overlays.
 * All coordinates are in CSS pixel space (not board coords).
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface BlastRing {
  cx: number; // center x (pixel)
  cy: number; // center y (pixel)
  maxRadius: number; // final radius (pixel)
  life: number; // remaining ms
  maxLife: number;
}

interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

export class EffectManager {
  particles: Particle[] = [];
  blastRings: BlastRing[] = [];
  private shake: ScreenShake | null = null;
  screenFlash: number = 0; // remaining ms (white overlay)
  rowFlashRows: number[] = []; // visible row indices to flash
  rowFlashTimer: number = 0;

  /** Spawn explosion particles from a board cell (pixel coords) */
  spawnExplosion(cx: number, cy: number, color: string, intensity: number = 1): void {
    const count = Math.floor(6 + intensity * 4);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
      const speed = (60 + Math.random() * 120) * intensity;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 4,
        y: cy + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // slight upward bias
        color,
        size: 2 + Math.random() * 3 * intensity,
        life: 400 + Math.random() * 400,
        maxLife: 800,
      });
    }
  }

  /** Spawn particles along a cleared row (pixel coords) */
  spawnLineClear(y: number, x0: number, width: number, cellSize: number): void {
    const count = Math.floor(width / cellSize) * 3;
    for (let i = 0; i < count; i++) {
      const px = x0 + Math.random() * width;
      const py = y + Math.random() * cellSize;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: `hsl(${180 + Math.random() * 60}, 80%, 70%)`,
        size: 1.5 + Math.random() * 2,
        life: 300 + Math.random() * 300,
        maxLife: 600,
      });
    }
  }

  /** Spawn a blast ring expanding outward from a center point */
  spawnBlastRing(cx: number, cy: number, maxRadius: number): void {
    this.blastRings.push({
      cx, cy, maxRadius,
      life: 500,
      maxLife: 500,
    });
  }

  /** Trigger screen shake */
  addShake(intensity: number, duration: number = 300): void {
    // Stack with existing shake
    if (this.shake) {
      this.shake.intensity = Math.max(this.shake.intensity, intensity);
      this.shake.duration = Math.max(this.shake.duration - this.shake.elapsed, duration);
      this.shake.elapsed = 0;
    } else {
      this.shake = { intensity, duration, elapsed: 0 };
    }
  }

  /** Trigger screen flash (white overlay) */
  addFlash(duration: number = 120): void {
    this.screenFlash = Math.max(this.screenFlash, duration);
  }

  /** Trigger row flash (highlight rows before they clear) */
  addRowFlash(visibleRows: number[]): void {
    this.rowFlashRows = visibleRows;
    this.rowFlashTimer = 150;
  }

  /** Update all effects (call each frame) */
  update(deltaTime: number): void {
    // Particles
    for (const p of this.particles) {
      p.x += p.vx * deltaTime * 0.001;
      p.y += p.vy * deltaTime * 0.001;
      p.vy += 300 * deltaTime * 0.001; // gravity
      p.life -= deltaTime;
      p.size *= (1 - deltaTime * 0.001); // shrink
    }
    this.particles = this.particles.filter(p => p.life > 0 && p.size > 0.3);

    // Blast rings
    for (const ring of this.blastRings) {
      ring.life -= deltaTime;
    }
    this.blastRings = this.blastRings.filter(r => r.life > 0);

    // Shake
    if (this.shake) {
      this.shake.elapsed += deltaTime;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake = null;
      }
    }

    // Screen flash
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - deltaTime);
    }

    // Row flash
    if (this.rowFlashTimer > 0) {
      this.rowFlashTimer = Math.max(0, this.rowFlashTimer - deltaTime);
      if (this.rowFlashTimer <= 0) {
        this.rowFlashRows = [];
      }
    }
  }

  /** Get current shake offset */
  getShakeOffset(): { x: number; y: number } {
    if (!this.shake) return { x: 0, y: 0 };
    const progress = this.shake.elapsed / this.shake.duration;
    const decay = 1 - progress;
    const freq = 20; // Hz
    const t = this.shake.elapsed * 0.001 * freq * Math.PI * 2;
    return {
      x: Math.sin(t * 1.3) * this.shake.intensity * decay,
      y: Math.cos(t) * this.shake.intensity * decay * 0.7,
    };
  }

  /** Clear all effects */
  reset(): void {
    this.particles = [];
    this.blastRings = [];
    this.shake = null;
    this.screenFlash = 0;
    this.rowFlashRows = [];
    this.rowFlashTimer = 0;
  }

  get hasActiveEffects(): boolean {
    return this.particles.length > 0 || this.blastRings.length > 0 || this.shake !== null || this.screenFlash > 0 || this.rowFlashTimer > 0;
  }
}
