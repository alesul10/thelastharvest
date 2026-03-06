// ─── Phase Types ─────────────────────────────────────────────────────────────

export type GamePhase =
  | 'MENU'
  | 'PLAYING'
  | 'DUSK_WARNING'  // Tigers prowl the forest edges
  | 'NIGHT'         // Groundhogs rise from stumps
  | 'CABIN_SAFE'    // Player reached the cabin
  | 'CAUGHT'        // Mid-catch screen flash
  | 'UPGRADING'
  | 'GAME_OVER';

// ─── Upgrade Levels (0 = base, max 4) ────────────────────────────────────────

export interface Upgrades {
  cuttingSpeed: number;  // multiplier: 1 + level * 0.5   (1x → 3x)
  movementSpeed: number; // multiplier: 1 + level * 0.25  (1x → 2x)
  treeCount: number;     // trees per day: 8 + level * 4  (8 → 24)
  treeValue: number;     // logs per tree: 2 + level       (2 → 6)
  maxLives: number;      // total lives:   3 + level       (3 → 7)
}

// ─── Player Data ──────────────────────────────────────────────────────────────

export interface PlayerData {
  totalLumber: number;   // accumulated across safe days (upgrade currency)
  currentLumber: number; // earned this day — lost if caught
  carriedLogs: number;   // logs currently being carried to the wood box
  lives: number;
  day: number;
  upgrades: Upgrades;
}

// ─── Event Bus ───────────────────────────────────────────────────────────────

type EventHandler<T = void> = (data: T) => void;

interface EventMap {
  phaseChanged: GamePhase;
  playerCaught: 'tiger' | 'groundhog';
  daySaved: number;          // lumber banked
  gameOver: void;
  lumberDeposited: number;
  logsCollected: number;
  treeFelled: string;        // stump id
  upgradeApplied: Upgrades;
  newDay: number;            // day number
}

// ─── Singleton ────────────────────────────────────────────────────────────────

class GameStateManager {
  private _phase: GamePhase = 'MENU';
  private _player: PlayerData = this.defaultPlayer();
  private listeners = new Map<string, Set<EventHandler<any>>>();

  get phase(): GamePhase {
    return this._phase;
  }

  get player(): Readonly<PlayerData> {
    return this._player;
  }

  setPhase(phase: GamePhase): void {
    this._phase = phase;
    this.emit('phaseChanged', phase);
  }

  updatePlayer(data: Partial<PlayerData>): void {
    this._player = { ...this._player, ...data };
  }

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as EventHandler<any>);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<any>);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((h) => h(data));
  }

  reset(): void {
    this._player = this.defaultPlayer();
    this._phase = 'MENU';
  }

  private defaultPlayer(): PlayerData {
    return {
      totalLumber: 0,
      currentLumber: 0,
      carriedLogs: 0,
      lives: 3,
      day: 1,
      upgrades: {
        cuttingSpeed: 0,
        movementSpeed: 0,
        treeCount: 0,
        treeValue: 0,
        maxLives: 0,
      },
    };
  }
}

export const GameState = new GameStateManager();
