import { Vector3 } from '@babylonjs/core';
import { TreeData } from './ChoppingSystem';
import { GameState } from '../GameState';

const COLLECT_RANGE = 2.2;
const DEPOSIT_RANGE = 3.0;

export class InventorySystem {
  constructor(
    private trees: TreeData[],
    private woodBoxPosition: Vector3
  ) {}

  /**
   * Call every frame. Auto-collects nearby logs and auto-deposits at the
   * wood box. Returns a string describing what action occurred (for HUD hints).
   */
  update(playerPos: Vector3): 'collected' | 'deposited' | null {
    // Collect logs from felled trees
    for (const tree of this.trees) {
      if (!tree.hasLogs || !tree.logPile.isVisible) continue;

      const logWorldPos = tree.logPile.getAbsolutePosition();
      const dist = Vector3.Distance(playerPos, logWorldPos);

      if (dist < COLLECT_RANGE) {
        const capacity = 5 + GameState.player.upgrades.treeValue;
        const space = capacity - GameState.player.carriedLogs;
        if (space <= 0) break; // arms full

        const collected = Math.min(tree.logsValue, space);
        tree.hasLogs = false;
        tree.logPile.isVisible = false;

        GameState.updatePlayer({
          carriedLogs: GameState.player.carriedLogs + collected,
        });
        GameState.emit('logsCollected', collected);
        return 'collected';
      }
    }

    // Deposit at wood box
    if (GameState.player.carriedLogs > 0) {
      const distToBox = Vector3.Distance(playerPos, this.woodBoxPosition);
      if (distToBox < DEPOSIT_RANGE) {
        const logs = GameState.player.carriedLogs;
        GameState.updatePlayer({
          carriedLogs: 0,
          currentLumber: GameState.player.currentLumber + logs,
        });
        GameState.emit('lumberDeposited', logs);
        return 'deposited';
      }
    }

    return null;
  }

  /** Called when the player reaches the cabin safely. Banks the day's lumber. */
  bankDayLumber(): void {
    // Any carried logs are lost (you dropped them running from tigers)
    const earned = GameState.player.currentLumber;
    GameState.updatePlayer({
      totalLumber: GameState.player.totalLumber + earned,
      currentLumber: 0,
      carriedLogs: 0,
    });
    GameState.emit('daySaved', earned);
  }

  /** Called when the player is caught. Day's lumber is lost. */
  loseDayLumber(): void {
    GameState.updatePlayer({
      currentLumber: 0,
      carriedLogs: 0,
    });
  }

  isNearWoodBox(playerPos: Vector3): boolean {
    return Vector3.Distance(playerPos, this.woodBoxPosition) < DEPOSIT_RANGE;
  }

  nearestLogDistance(playerPos: Vector3): number {
    let best = Infinity;
    for (const tree of this.trees) {
      if (!tree.hasLogs || !tree.logPile.isVisible) continue;
      const d = Vector3.Distance(playerPos, tree.logPile.getAbsolutePosition());
      if (d < best) best = d;
    }
    return best;
  }
}
