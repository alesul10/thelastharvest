import { GameState, Upgrades } from '../GameState';

export interface UpgradeDef {
  id: keyof Upgrades;
  name: string;
  flavor: string;
  maxLevel: number;
  costs: number[];
  statLabel: (level: number) => string;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'cuttingSpeed',
    name: 'Axe Sharpness',
    flavor: 'A sharper blade fells trees before the sun moves.',
    maxLevel: 4,
    costs: [10, 25, 50, 100],
    statLabel: (lvl) => `${1 + lvl * 0.5}x chop speed`,
  },
  {
    id: 'movementSpeed',
    name: 'Running Boots',
    flavor: 'Faster legs mean you can outrun the tigers... for now.',
    maxLevel: 4,
    costs: [15, 35, 70, 140],
    statLabel: (lvl) => `${1 + lvl * 0.25}x move speed`,
  },
  {
    id: 'treeCount',
    name: 'Forest Contract',
    flavor: 'More trees to fell — and more stumps for them to rise from.',
    maxLevel: 4,
    costs: [5, 15, 35, 75],
    statLabel: (lvl) => `${8 + lvl * 4} trees/day`,
  },
  {
    id: 'treeValue',
    name: 'Lumber Quality',
    flavor: 'Dense wood. Worth more. Takes longer.',
    maxLevel: 4,
    costs: [8, 20, 45, 90],
    statLabel: (lvl) => `${2 + lvl} logs/tree`,
  },
  {
    id: 'maxLives',
    name: 'Extra Life',
    flavor: 'Tigers are patient. You need to be lucky more than once.',
    maxLevel: 4,
    costs: [30, 65, 120, 220],
    statLabel: (lvl) => `${3 + lvl} total lives`,
  },
];

/** Returns cost for the next level of an upgrade, or null if maxed. */
export function getUpgradeCost(id: keyof Upgrades): number | null {
  const def = UPGRADE_DEFS.find((u) => u.id === id)!;
  const currentLevel = GameState.player.upgrades[id];
  if (currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel];
}

/** Attempts to purchase an upgrade. Returns true on success. */
export function purchaseUpgrade(id: keyof Upgrades): boolean {
  const cost = getUpgradeCost(id);
  if (cost === null) return false;
  if (GameState.player.totalLumber < cost) return false;

  const newUpgrades: Upgrades = {
    ...GameState.player.upgrades,
    [id]: GameState.player.upgrades[id] + 1,
  };

  // If buying maxLives, also increase current lives immediately
  let livesUpdate = {};
  if (id === 'maxLives') {
    livesUpdate = { lives: GameState.player.lives + 1 };
  }

  GameState.updatePlayer({
    totalLumber: GameState.player.totalLumber - cost,
    upgrades: newUpgrades,
    ...livesUpdate,
  });

  GameState.emit('upgradeApplied', newUpgrades);
  return true;
}
