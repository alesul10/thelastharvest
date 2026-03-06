import {
  Scene,
  DirectionalLight,
  HemisphericLight,
  Color3,
  Color4,
  Vector3,
} from '@babylonjs/core';
import { GameState, GamePhase } from '../GameState';

// Day = 3 minutes total
const DAY_DURATION = 180;
const DUSK_START = 0.72;   // 72% → tigers start prowling
const NIGHT_START = 0.85;  // 85% → groundhogs rise from stumps

export class DayNightCycle {
  private elapsed = 0;

  constructor(
    private scene: Scene,
    private sun: DirectionalLight,
    private ambient: HemisphericLight
  ) {}

  /** Call every frame while a day is running. */
  update(deltaTime: number): void {
    const p = GameState.phase;
    if (p !== 'PLAYING' && p !== 'DUSK_WARNING' && p !== 'NIGHT') return;

    this.elapsed += deltaTime;
    const t = Math.min(this.elapsed / DAY_DURATION, 1);

    this.updateLighting(t);
    this.updateFog(t);
    this.checkPhaseTransitions(t);
  }

  get progress(): number {
    return Math.min(this.elapsed / DAY_DURATION, 1);
  }

  get secondsRemaining(): number {
    return Math.max(DAY_DURATION - this.elapsed, 0);
  }

  startDay(): void {
    this.elapsed = 0;
    this.scene.clearColor = new Color4(0.42, 0.68, 0.9, 1);
    this.scene.fogColor = new Color3(0.42, 0.68, 0.9);
    this.scene.fogDensity = 0.015;
  }

  // ── Lighting ───────────────────────────────────────────────────────────────

  private updateLighting(t: number): void {
    // Animate sun arc east → west
    const arc = t * Math.PI;
    this.sun.direction = new Vector3(
      Math.cos(arc),
      -Math.sin(arc) - 0.1,
      0.3
    ).normalize();

    if (t < 0.1) {
      // Dawn: orange → white
      const s = t / 0.1;
      this.sun.diffuse = Color3.Lerp(new Color3(1, 0.45, 0.05), Color3.White(), s);
      this.sun.intensity = 0.6 + s * 0.4;
      this.ambient.diffuse = new Color3(0.35, 0.35, 0.35);
    } else if (t < DUSK_START) {
      // Full day
      this.sun.diffuse = Color3.White();
      this.sun.intensity = 1.0;
      this.ambient.diffuse = new Color3(0.4, 0.4, 0.4);
      this.ambient.groundColor = new Color3(0.15, 0.18, 0.12);
    } else if (t < NIGHT_START) {
      // Dusk warning: sun deepens to blood orange
      const s = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      this.sun.diffuse = Color3.Lerp(Color3.White(), new Color3(1, 0.2, 0.02), s);
      this.sun.intensity = 1.0 - s * 0.55;
      this.ambient.diffuse = Color3.Lerp(
        new Color3(0.4, 0.4, 0.4),
        new Color3(0.18, 0.08, 0.04),
        s
      );
    } else {
      // Night
      this.sun.diffuse = new Color3(0.08, 0.08, 0.25);
      this.sun.intensity = 0.12;
      this.ambient.diffuse = new Color3(0.04, 0.04, 0.12);
      this.ambient.groundColor = new Color3(0.01, 0.01, 0.04);
    }

    // Sky colour
    this.updateSky(t);
  }

  private updateSky(t: number): void {
    if (t < DUSK_START) {
      this.scene.clearColor = new Color4(0.42, 0.68, 0.9, 1);
      this.scene.fogColor = new Color3(0.42, 0.68, 0.9);
    } else if (t < NIGHT_START) {
      const s = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      this.scene.clearColor = new Color4(
        0.42 + s * 0.48,
        0.68 - s * 0.58,
        0.9 - s * 0.87,
        1
      );
      this.scene.fogColor = new Color3(
        0.42 + s * 0.3,
        0.68 - s * 0.5,
        0.9 - s * 0.85
      );
    } else {
      this.scene.clearColor = new Color4(0.02, 0.02, 0.08, 1);
      this.scene.fogColor = new Color3(0.02, 0.02, 0.08);
    }
  }

  private updateFog(t: number): void {
    if (t < DUSK_START) {
      this.scene.fogDensity = 0.015;
    } else if (t < NIGHT_START) {
      const s = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      this.scene.fogDensity = 0.015 + s * 0.025; // fog thickens at dusk
    } else {
      this.scene.fogDensity = 0.04;
    }
  }

  // ── Phase Transitions ─────────────────────────────────────────────────────

  private checkPhaseTransitions(t: number): void {
    const phase = GameState.phase;

    if (t >= DUSK_START && phase === 'PLAYING') {
      GameState.setPhase('DUSK_WARNING');
    } else if (t >= NIGHT_START && phase === 'DUSK_WARNING') {
      GameState.setPhase('NIGHT');
    }
  }
}
