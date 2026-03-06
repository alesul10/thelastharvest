import { Scene } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  Control,
  StackPanel,
  ScrollViewer,
} from '@babylonjs/gui';
import { GameState } from '../GameState';
import {
  UPGRADE_DEFS,
  UpgradeDef,
  getUpgradeCost,
  purchaseUpgrade,
} from '../systems/UpgradeStore';

export class UpgradeMenu {
  private gui!: AdvancedDynamicTexture;
  private onNextDay: (() => void) | null = null;

  constructor(private scene: Scene) {}

  setOnNextDay(cb: () => void): void {
    this.onNextDay = cb;
  }

  show(earnedLumber: number): void {
    this.gui?.dispose();
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('UpgradeMenu', true, this.scene);
    this.build(earnedLumber);
  }

  hide(): void {
    this.gui?.dispose();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private build(earnedLumber: number): void {
    const overlay = new Rectangle('overlay');
    overlay.width = '100%';
    overlay.height = '100%';
    overlay.background = 'rgba(0,0,0,0.9)';
    this.gui.addControl(overlay);

    const root = new StackPanel('root');
    root.width = '520px';
    root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    overlay.addControl(root);

    // Header
    const header = new TextBlock('header', 'END OF DAY');
    header.color = '#c84a20';
    header.fontSize = 30;
    header.fontFamily = 'monospace';
    header.height = '45px';
    root.addControl(header);

    const sub = new TextBlock('sub', `Day ${GameState.player.day} complete`);
    sub.color = 'rgba(200,170,120,0.85)';
    sub.fontSize = 14;
    sub.fontFamily = 'monospace';
    sub.height = '22px';
    root.addControl(sub);

    const earned = new TextBlock('earned', `Lumber banked today: +${earnedLumber}`);
    earned.color = '#f0d080';
    earned.fontSize = 16;
    earned.fontFamily = 'monospace';
    earned.height = '28px';
    earned.paddingBottom = '4px';
    root.addControl(earned);

    this.buildTotalLumber(root);

    const divider = new TextBlock('div', '─'.repeat(52));
    divider.color = 'rgba(255,255,255,0.2)';
    divider.fontSize = 12;
    divider.fontFamily = 'monospace';
    divider.height = '18px';
    root.addControl(divider);

    const shopLabel = new TextBlock('shopLabel', 'UPGRADES');
    shopLabel.color = 'rgba(200,200,200,0.7)';
    shopLabel.fontSize = 13;
    shopLabel.fontFamily = 'monospace';
    shopLabel.height = '20px';
    shopLabel.paddingBottom = '6px';
    root.addControl(shopLabel);

    // Upgrade rows
    UPGRADE_DEFS.forEach((def) => this.buildUpgradeRow(root, def));

    // Tiger warning
    const day = GameState.player.day;
    const tigerCount = Math.min(1 + Math.floor(day / 2), 4);
    const warn = new TextBlock('tigerWarn',
      `Tomorrow: ${tigerCount} tiger${tigerCount > 1 ? 's' : ''} will patrol the forest at dusk.`);
    warn.color = '#c85020';
    warn.fontSize = 12;
    warn.fontFamily = 'monospace';
    warn.height = '20px';
    warn.paddingTop = '10px';
    root.addControl(warn);

    const spacer = new TextBlock('sp', '');
    spacer.height = '14px';
    root.addControl(spacer);

    // Next day button
    const btn = Button.CreateSimpleButton('nextDay', 'START DAY ' + (GameState.player.day + 1));
    btn.width = '220px';
    btn.height = '46px';
    btn.color = 'white';
    btn.fontSize = 16;
    btn.fontFamily = 'monospace';
    btn.background = '#1a4a1a';
    btn.cornerRadius = 6;
    btn.onPointerClickObservable.add(() => {
      this.onNextDay?.();
    });
    root.addControl(btn);
  }

  private buildTotalLumber(parent: StackPanel): void {
    const row = new TextBlock('total',
      `Total lumber available: ${GameState.player.totalLumber}`);
    row.color = '#d0a830';
    row.fontSize = 15;
    row.fontFamily = 'monospace';
    row.height = '26px';
    row.paddingBottom = '8px';
    parent.addControl(row);
  }

  private buildUpgradeRow(parent: StackPanel, def: UpgradeDef): void {
    const level = GameState.player.upgrades[def.id];
    const cost = getUpgradeCost(def.id);
    const maxed = level >= def.maxLevel;
    const canAfford = !maxed && cost !== null && GameState.player.totalLumber >= cost;

    const row = new Rectangle(`row_${def.id}`);
    row.width = '500px';
    row.height = '52px';
    row.cornerRadius = 5;
    row.background = 'rgba(255,255,255,0.04)';
    row.color = 'rgba(255,255,255,0.08)';
    row.paddingBottom = '5px';
    parent.addControl(row);

    // Name
    const name = new TextBlock(`name_${def.id}`, def.name);
    name.color = maxed ? '#80c080' : 'rgba(220,210,190,0.9)';
    name.fontSize = 13;
    name.fontFamily = 'monospace';
    name.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    name.left = '12px';
    name.top = '-8px';
    row.addControl(name);

    // Stat label
    const stat = new TextBlock(`stat_${def.id}`, def.statLabel(level));
    stat.color = 'rgba(180,200,180,0.7)';
    stat.fontSize = 11;
    stat.fontFamily = 'monospace';
    stat.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stat.left = '12px';
    stat.top = '10px';
    row.addControl(stat);

    // Level pips
    const pips = new TextBlock(`pips_${def.id}`, buildPips(level, def.maxLevel));
    pips.color = '#f0d080';
    pips.fontSize = 14;
    pips.fontFamily = 'monospace';
    pips.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    pips.left = '20px';
    row.addControl(pips);

    // Buy button
    if (!maxed) {
      const btn = Button.CreateSimpleButton(`buy_${def.id}`,
        canAfford ? `BUY  ${cost}⌂` : cost !== null ? `${cost}⌂` : 'MAX');
      btn.width = '100px';
      btn.height = '32px';
      btn.color = canAfford ? 'white' : 'rgba(150,130,110,0.6)';
      btn.fontSize = 12;
      btn.fontFamily = 'monospace';
      btn.background = canAfford ? '#3a2a08' : 'rgba(60,50,40,0.4)';
      btn.cornerRadius = 4;
      btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      btn.right = '10px' as any;
      btn.isEnabled = canAfford;
      btn.onPointerClickObservable.add(() => {
        if (purchaseUpgrade(def.id)) {
          // Rebuild the menu to reflect new state
          const earned = GameState.player.currentLumber; // already 0 after bank
          this.build(0);
        }
      });
      row.addControl(btn);
    } else {
      const maxLabel = new TextBlock(`max_${def.id}`, 'MAXED');
      maxLabel.color = '#60b060';
      maxLabel.fontSize = 12;
      maxLabel.fontFamily = 'monospace';
      maxLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      maxLabel.right = '14px' as any;
      row.addControl(maxLabel);
    }
  }
}

function buildPips(level: number, max: number): string {
  const filled = '■'.repeat(level);
  const empty = '□'.repeat(max - level);
  return filled + empty;
}
