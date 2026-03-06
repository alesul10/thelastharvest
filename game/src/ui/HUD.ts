import {
  Scene,
  Color3,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Control,
  Ellipse,
  StackPanel,
  Image,
} from '@babylonjs/gui';
import { GameState, GamePhase } from '../GameState';
import { DayNightCycle } from '../systems/DayNightCycle';

export class HUD {
  private gui: AdvancedDynamicTexture;

  // Timer
  private timerBg!: Rectangle;
  private timerFill!: Rectangle;
  private timerLabel!: TextBlock;

  // Lives
  private livesPanel!: StackPanel;

  // Lumber
  private lumberText!: TextBlock;
  private carriedText!: TextBlock;

  // Day
  private dayText!: TextBlock;

  // Chop progress
  private chopBg!: Rectangle;
  private chopFill!: Rectangle;

  // Interaction hint
  private hintText!: TextBlock;

  // Phase banner
  private phaseBanner!: Rectangle;
  private phaseBannerText!: TextBlock;
  private bannerTimer = 0;

  // Caught flash
  private catchOverlay!: Rectangle;
  private catchTimer = 0;

  constructor(private scene: Scene, private cycle: DayNightCycle) {
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('HUD', true, scene);
    this.buildCrosshair();
    this.buildTimer();
    this.buildLives();
    this.buildLumberCounter();
    this.buildDayLabel();
    this.buildChopBar();
    this.buildHint();
    this.buildPhaseBanner();
    this.buildCatchOverlay();
    this.bindEvents();
  }

  // ── Per-Frame ──────────────────────────────────────────────────────────────

  update(deltaTime: number, chopProgress: number, hint: string): void {
    this.updateTimer();
    this.updateLumber();
    this.updateChopBar(chopProgress);
    this.updateHint(hint);

    // Banner fade
    if (this.bannerTimer > 0) {
      this.bannerTimer -= deltaTime;
      if (this.bannerTimer <= 0) {
        this.phaseBanner.isVisible = false;
      }
    }

    // Catch overlay fade
    if (this.catchTimer > 0) {
      this.catchTimer -= deltaTime;
      this.catchOverlay.alpha = Math.max(this.catchTimer / 0.8, 0);
      if (this.catchTimer <= 0) this.catchOverlay.isVisible = false;
    }
  }

  showPhaseBanner(text: string, color: string, duration = 3): void {
    this.phaseBannerText.text = text;
    this.phaseBanner.background = color;
    this.phaseBanner.isVisible = true;
    this.bannerTimer = duration;
  }

  triggerCatchFlash(): void {
    this.catchOverlay.isVisible = true;
    this.catchOverlay.alpha = 1;
    this.catchTimer = 0.8;
  }

  refreshLives(): void {
    this.buildLivesIcons();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private buildCrosshair(): void {
    const cross = new TextBlock('crosshair', '+');
    cross.color = 'rgba(255,255,255,0.7)';
    cross.fontSize = 22;
    cross.fontFamily = 'monospace';
    cross.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    cross.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.gui.addControl(cross);
  }

  private buildTimer(): void {
    this.timerBg = new Rectangle('timerBg');
    this.timerBg.width = '280px';
    this.timerBg.height = '22px';
    this.timerBg.cornerRadius = 11;
    this.timerBg.color = 'rgba(0,0,0,0.6)';
    this.timerBg.background = 'rgba(0,0,0,0.4)';
    this.timerBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.timerBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.timerBg.top = '18px';
    this.gui.addControl(this.timerBg);

    this.timerFill = new Rectangle('timerFill');
    this.timerFill.width = '100%';
    this.timerFill.height = '100%';
    this.timerFill.cornerRadius = 11;
    this.timerFill.background = '#87CEEB';
    this.timerFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.timerBg.addControl(this.timerFill);

    this.timerLabel = new TextBlock('timerLabel');
    this.timerLabel.color = 'white';
    this.timerLabel.fontSize = 11;
    this.timerLabel.fontFamily = 'monospace';
    this.timerLabel.outlineColor = 'black';
    this.timerLabel.outlineWidth = 2;
    this.timerBg.addControl(this.timerLabel);
  }

  private buildLives(): void {
    this.livesPanel = new StackPanel('livesPanel');
    this.livesPanel.isVertical = false;
    this.livesPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.livesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.livesPanel.left = '16px';
    this.livesPanel.top = '16px';
    this.livesPanel.height = '28px';
    this.gui.addControl(this.livesPanel);
    this.buildLivesIcons();
  }

  private buildLivesIcons(): void {
    this.livesPanel.clearControls();
    const lives = GameState.player.lives;
    for (let i = 0; i < Math.max(lives, 0); i++) {
      const heart = new TextBlock(`heart_${i}`, '♥');
      heart.color = '#e03030';
      heart.fontSize = 20;
      heart.width = '22px';
      heart.fontFamily = 'monospace';
      this.livesPanel.addControl(heart);
    }
  }

  private buildLumberCounter(): void {
    const panel = new StackPanel('lumberPanel');
    panel.isVertical = true;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.right = '16px' as any;
    panel.top = '16px';
    panel.width = '160px';
    this.gui.addControl(panel);

    this.lumberText = new TextBlock('lumberText', 'LUMBER: 0');
    this.lumberText.color = '#f0d080';
    this.lumberText.fontSize = 14;
    this.lumberText.fontFamily = 'monospace';
    this.lumberText.height = '20px';
    this.lumberText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.addControl(this.lumberText);

    this.carriedText = new TextBlock('carriedText', 'CARRYING: 0');
    this.carriedText.color = '#c8a850';
    this.carriedText.fontSize = 12;
    this.carriedText.fontFamily = 'monospace';
    this.carriedText.height = '18px';
    this.carriedText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.addControl(this.carriedText);
  }

  private buildDayLabel(): void {
    this.dayText = new TextBlock('dayText', 'DAY 1');
    this.dayText.color = 'rgba(255,255,255,0.75)';
    this.dayText.fontSize = 13;
    this.dayText.fontFamily = 'monospace';
    this.dayText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.dayText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.dayText.top = '45px';
    this.gui.addControl(this.dayText);
  }

  private buildChopBar(): void {
    this.chopBg = new Rectangle('chopBg');
    this.chopBg.width = '160px';
    this.chopBg.height = '12px';
    this.chopBg.cornerRadius = 6;
    this.chopBg.background = 'rgba(0,0,0,0.5)';
    this.chopBg.color = 'rgba(255,255,255,0.3)';
    this.chopBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.chopBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.chopBg.top = '60px';
    this.chopBg.isVisible = false;
    this.gui.addControl(this.chopBg);

    this.chopFill = new Rectangle('chopFill');
    this.chopFill.height = '100%';
    this.chopFill.cornerRadius = 6;
    this.chopFill.background = '#c84a20';
    this.chopFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.chopFill.width = '0%';
    this.chopBg.addControl(this.chopFill);
  }

  private buildHint(): void {
    this.hintText = new TextBlock('hint', '');
    this.hintText.color = 'rgba(255,255,220,0.9)';
    this.hintText.fontSize = 14;
    this.hintText.fontFamily = 'monospace';
    this.hintText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.hintText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.hintText.top = '85px';
    this.hintText.outlineColor = 'black';
    this.hintText.outlineWidth = 2;
    this.gui.addControl(this.hintText);
  }

  private buildPhaseBanner(): void {
    this.phaseBanner = new Rectangle('phaseBanner');
    this.phaseBanner.width = '420px';
    this.phaseBanner.height = '52px';
    this.phaseBanner.cornerRadius = 8;
    this.phaseBanner.background = 'rgba(0,0,0,0.7)';
    this.phaseBanner.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.phaseBanner.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.phaseBanner.top = '-80px';
    this.phaseBanner.isVisible = false;
    this.gui.addControl(this.phaseBanner);

    this.phaseBannerText = new TextBlock('phaseBannerText', '');
    this.phaseBannerText.color = 'white';
    this.phaseBannerText.fontSize = 20;
    this.phaseBannerText.fontFamily = 'monospace';
    this.phaseBanner.addControl(this.phaseBannerText);
  }

  private buildCatchOverlay(): void {
    this.catchOverlay = new Rectangle('catchOverlay');
    this.catchOverlay.width = '100%';
    this.catchOverlay.height = '100%';
    this.catchOverlay.background = 'rgba(200,20,20,0.55)';
    this.catchOverlay.isVisible = false;
    this.catchOverlay.alpha = 0;
    this.gui.addControl(this.catchOverlay);
  }

  // ── Update Helpers ────────────────────────────────────────────────────────

  private updateTimer(): void {
    const t = this.cycle.progress;
    const secs = Math.ceil(this.cycle.secondsRemaining);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerLabel.text = `${m}:${s.toString().padStart(2, '0')}`;

    // Width & colour
    const pct = Math.max(0, (1 - t) * 100);
    this.timerFill.width = `${pct}%`;

    if (t < 0.72) {
      this.timerFill.background = '#87CEEB';
    } else if (t < 0.85) {
      this.timerFill.background = '#e07030';
    } else {
      this.timerFill.background = '#2a1560';
    }
  }

  private updateLumber(): void {
    this.lumberText.text = `LUMBER: ${GameState.player.currentLumber}`;
    this.carriedText.text = `CARRYING: ${GameState.player.carriedLogs}`;
    this.dayText.text = `DAY ${GameState.player.day}`;
  }

  private updateChopBar(progress: number): void {
    if (progress > 0) {
      this.chopBg.isVisible = true;
      this.chopFill.width = `${Math.round(progress * 100)}%`;
    } else {
      this.chopBg.isVisible = false;
    }
  }

  private updateHint(hint: string): void {
    this.hintText.text = hint;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  private bindEvents(): void {
    GameState.on('phaseChanged', (phase) => {
      switch (phase) {
        case 'DUSK_WARNING':
          this.showPhaseBanner('DUSK FALLS — TIGERS ARE PROWLING', 'rgba(160,60,10,0.85)', 4);
          break;
        case 'NIGHT':
          this.showPhaseBanner('NIGHT — GROUNDHOGS RISE FROM THE STUMPS', 'rgba(30,10,60,0.9)', 4);
          break;
        case 'CABIN_SAFE':
          this.showPhaseBanner('YOU MADE IT BACK — YOU ARE SAFE', 'rgba(10,60,20,0.85)', 3);
          break;
      }
    });

    GameState.on('playerCaught', () => {
      this.triggerCatchFlash();
      this.buildLivesIcons();
    });
  }

  dispose(): void {
    this.gui.dispose();
  }
}
