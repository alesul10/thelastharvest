import { Scene } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  Control,
  StackPanel,
} from '@babylonjs/gui';
import { GameState } from '../GameState';

export class MainMenu {
  private gui: AdvancedDynamicTexture;
  private onStart: (() => void) | null = null;

  constructor(scene: Scene) {
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('MainMenu', true, scene);
    this.buildScreen();
  }

  setOnStart(cb: () => void): void {
    this.onStart = cb;
  }

  // ── Start Screen ──────────────────────────────────────────────────────────

  showStartScreen(): void {
    this.gui.dispose();
    // rebuild cleanly
    this.buildScreen();
  }

  // ── Game Over Screen ──────────────────────────────────────────────────────

  showGameOver(day: number, totalLumber: number, onRestart: () => void): void {
    this.gui.dispose();
    const gui = AdvancedDynamicTexture.CreateFullscreenUI('GameOver');
    this.gui = gui;

    const overlay = new Rectangle('overlay');
    overlay.width = '100%';
    overlay.height = '100%';
    overlay.background = 'rgba(0,0,0,0.88)';
    gui.addControl(overlay);

    const panel = new StackPanel('panel');
    panel.width = '480px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    overlay.addControl(panel);

    const addText = (text: string, size: number, color: string, pad = 10) => {
      const t = new TextBlock(`go_${text}`, text);
      t.color = color;
      t.fontSize = size;
      t.fontFamily = 'monospace';
      t.height = `${size + pad * 2}px`;
      t.paddingBottom = `${pad}px`;
      panel.addControl(t);
    };

    addText('THE LAST HARVEST', 14, 'rgba(200,80,80,0.7)', 4);
    addText('GAME OVER', 48, '#e03030', 6);
    addText(`You survived ${day - 1} day${day - 1 !== 1 ? 's' : ''}`, 18, '#c8a850', 8);
    addText(`Total lumber banked: ${totalLumber}`, 16, '#f0d080', 6);
    addText('', 12, 'transparent', 4); // spacer

    // Lore blurb
    const lore = new TextBlock('lore',
      'The tigers claimed the forest.\nThe groundhogs guard the stumps.\nNo lumberjack has survived this wood.');
    lore.color = 'rgba(180,140,140,0.75)';
    lore.fontSize = 13;
    lore.fontFamily = 'monospace';
    lore.height = '70px';
    lore.textWrapping = true;
    lore.paddingBottom = '20px';
    panel.addControl(lore);

    const btn = Button.CreateSimpleButton('restart', 'PLAY AGAIN');
    btn.width = '200px';
    btn.height = '46px';
    btn.color = 'white';
    btn.fontSize = 16;
    btn.fontFamily = 'monospace';
    btn.background = '#6a1a1a';
    btn.cornerRadius = 6;
    btn.onPointerClickObservable.add(() => {
      GameState.reset();
      onRestart();
    });
    panel.addControl(btn);
  }

  dispose(): void {
    this.gui.dispose();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildScreen(): void {
    const gui = AdvancedDynamicTexture.CreateFullscreenUI('MainMenu');
    this.gui = gui;

    // Dark overlay
    const overlay = new Rectangle('overlay');
    overlay.width = '100%';
    overlay.height = '100%';
    overlay.background = 'rgba(0,0,0,0.82)';
    gui.addControl(overlay);

    const panel = new StackPanel('panel');
    panel.width = '500px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    overlay.addControl(panel);

    // Title
    const title = new TextBlock('title', 'THE LAST HARVEST');
    title.color = '#c84a20';
    title.fontSize = 38;
    title.fontFamily = 'monospace';
    title.height = '60px';
    panel.addControl(title);

    const sub = new TextBlock('sub', 'A Lumberjack Horror Story');
    sub.color = 'rgba(200,160,100,0.75)';
    sub.fontSize = 16;
    sub.fontFamily = 'monospace';
    sub.height = '30px';
    sub.paddingBottom = '28px';
    panel.addControl(sub);

    // Instructions
    const instructions = [
      '[W A S D]  Move',
      '[Mouse]    Look around',
      '[Hold LMB] Chop trees',
      '[E]        Enter cabin',
      '',
      'Collect logs → deposit at wood box.',
      'Return to the cabin before nightfall.',
      '',
      'At DUSK — tigers prowl the forest edges.',
      'At NIGHT — groundhogs rise from the stumps.',
      '',
      'Three catches and the forest claims you.',
    ];

    instructions.forEach((line, i) => {
      const t = new TextBlock(`inst_${i}`, line);
      t.color = line.startsWith('[') ? '#f0d080' : 'rgba(200,200,190,0.85)';
      t.fontSize = 13;
      t.fontFamily = 'monospace';
      t.height = line === '' ? '12px' : '20px';
      panel.addControl(t);
    });

    // Spacer
    const spacer = new TextBlock('spacer', '');
    spacer.height = '24px';
    panel.addControl(spacer);

    // Start button
    const btn = Button.CreateSimpleButton('start', 'BEGIN  (click to lock cursor)');
    btn.width = '280px';
    btn.height = '48px';
    btn.color = 'white';
    btn.fontSize = 15;
    btn.fontFamily = 'monospace';
    btn.background = '#3a1a0a';
    btn.cornerRadius = 6;
    btn.onPointerClickObservable.add(() => this.onStart?.());
    panel.addControl(btn);

    // Footer
    const footer = new TextBlock('footer', 'Use ESC to pause');
    footer.color = 'rgba(150,130,120,0.6)';
    footer.fontSize = 11;
    footer.fontFamily = 'monospace';
    footer.height = '24px';
    footer.paddingTop = '10px';
    panel.addControl(footer);
  }
}
