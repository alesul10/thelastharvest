import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  TransformNode,
  PointerEventTypes,
  KeyboardEventTypes,
} from '@babylonjs/core';

import { GameState } from '../GameState';
import { DayNightCycle } from '../systems/DayNightCycle';
import { ChoppingSystem, TreeData, buildTree } from '../systems/ChoppingSystem';
import { GroundhogSystem } from '../systems/GroundhogSystem';
import { TigerSystem } from '../systems/TigerSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { HUD } from '../ui/HUD';
import { UpgradeMenu } from '../ui/UpgradeMenu';
import { MainMenu } from '../ui/MainMenu';

// ── Constants ─────────────────────────────────────────────────────────────────

const CABIN_POS = new Vector3(-22, 0, -22);
const WOOD_BOX_POS = new Vector3(-17, 0, -17);
const PLAYER_START = new Vector3(-20, 1.75, -19);
const CABIN_SAFE_RADIUS = 5;
const FOREST_HALF = 25;
const MIN_TREE_DIST = 4;
const CABIN_EXCLUSION = 11;

// ── Scene ─────────────────────────────────────────────────────────────────────

export class ForestScene {
  // Babylon core
  private scene!: Scene;
  private camera!: UniversalCamera;
  private sun!: DirectionalLight;
  private ambient!: HemisphericLight;
  private shadows!: ShadowGenerator;

  // World objects
  private trees: TreeData[] = [];
  private cabinMesh!: Mesh;
  private woodBoxMesh!: Mesh;

  // Systems
  private cycle!: DayNightCycle;
  private chopping!: ChoppingSystem;
  private groundhogs!: GroundhogSystem;
  private tigers!: TigerSystem;
  private inventory!: InventorySystem;

  // UI
  private hud!: HUD;
  private upgradeMenu!: UpgradeMenu;
  private mainMenu!: MainMenu;

  // State flags
  private isMouseDown = false;
  private enterKeyDown = false;
  private catchInProgress = false;
  private cameraShakeT = 0;

  constructor(private engine: Engine, private canvas: HTMLCanvasElement) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.scene = new Scene(this.engine);
    this.scene.gravity = new Vector3(0, -18, 0);
    this.scene.collisionsEnabled = true;
    this.scene.fogMode = Scene.FOGMODE_EXP2;

    this.setupLighting();
    this.setupGround();
    this.setupCabin();
    this.setupWoodBox();
    this.spawnForest();
    this.setupCamera();
    this.setupSystems();
    this.setupInput();

    // Show main menu on first load
    this.mainMenu = new MainMenu(this.scene);
    this.mainMenu.setOnStart(() => this.startGame());
    this.mainMenu.showStartScreen();
  }

  /** Called by the engine's render loop. */
  update(): void {
    const dt = this.engine.getDeltaTime() / 1000;
    const phase = GameState.phase;

    if (phase === 'PLAYING' || phase === 'DUSK_WARNING' || phase === 'NIGHT') {
      this.cycle.update(dt);
      this.handleEnemies(dt);
      this.handleCameraShake(dt);
      this.updateChopping(dt);

      const inv = this.inventory.update(this.camera.position);

      // Cabin entry
      this.checkCabinEntry();

      // HUD hint
      const hint = this.resolveHint(inv);
      const chopProg = this.chopping.chopProgress;
      this.hud.update(dt, chopProg, hint);
    }

    this.scene.render();
  }

  dispose(): void {
    this.scene.dispose();
  }

  // ── Start / New Day ───────────────────────────────────────────────────────

  private startGame(): void {
    this.mainMenu.dispose();
    this.canvas.requestPointerLock();
    GameState.setPhase('PLAYING');
    this.cycle.startDay();
    GameState.emit('newDay', GameState.player.day);
  }

  private startNextDay(): void {
    GameState.updatePlayer({ day: GameState.player.day + 1 });
    this.upgradeMenu.hide();

    // Reset scene objects for the new day
    this.clearForest();
    this.spawnForest();

    // Reset systems
    this.chopping = new ChoppingSystem(this.scene, this.camera, this.trees);
    this.chopping.setOnFelled(() => {});
    this.chopping.setScreenShake(() => this.triggerShake());
    this.inventory = new InventorySystem(this.trees, WOOD_BOX_POS);
    this.groundhogs.dispose();
    this.tigers.dispose();

    // Reset player position
    this.camera.position.copyFrom(PLAYER_START);
    this.canvas.requestPointerLock();

    GameState.updatePlayer({ currentLumber: 0, carriedLogs: 0 });
    GameState.setPhase('PLAYING');
    this.cycle.startDay();
    GameState.emit('newDay', GameState.player.day);
  }

  // ── Lighting ──────────────────────────────────────────────────────────────

  private setupLighting(): void {
    this.sun = new DirectionalLight('sun', new Vector3(1, -1, 0.5), this.scene);
    this.sun.diffuse = Color3.White();
    this.sun.intensity = 1.0;

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    this.ambient.diffuse = new Color3(0.4, 0.4, 0.4);
    this.ambient.groundColor = new Color3(0.15, 0.18, 0.12);
    this.ambient.intensity = 1.0;

    this.shadows = new ShadowGenerator(1024, this.sun);
    this.shadows.useBlurExponentialShadowMap = true;
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  private setupGround(): void {
    const ground = MeshBuilder.CreateGround('ground', { width: 70, height: 70, subdivisions: 2 }, this.scene);
    ground.checkCollisions = true;
    const mat = new StandardMaterial('groundMat', this.scene);
    mat.diffuseColor = new Color3(0.22, 0.32, 0.14);
    mat.specularColor = Color3.Black();
    ground.material = mat;
    this.shadows.addShadowCaster(ground, false);
    ground.receiveShadows = true;
  }

  // ── Cabin ─────────────────────────────────────────────────────────────────

  private setupCabin(): void {
    // Main body
    this.cabinMesh = MeshBuilder.CreateBox('cabin', { width: 7, height: 5, depth: 7 }, this.scene);
    this.cabinMesh.position = new Vector3(CABIN_POS.x, 2.5, CABIN_POS.z);
    this.cabinMesh.checkCollisions = true;
    const cabinMat = new StandardMaterial('cabinMat', this.scene);
    cabinMat.diffuseColor = new Color3(0.32, 0.2, 0.1);
    this.cabinMesh.material = cabinMat;
    this.shadows.addShadowCaster(this.cabinMesh);

    // Roof
    const roof = MeshBuilder.CreateCylinder('roof',
      { height: 3, diameterTop: 0, diameterBottom: 9.5, tessellation: 4 }, this.scene);
    roof.position = new Vector3(CABIN_POS.x, 6.5, CABIN_POS.z);
    roof.rotation.y = Math.PI / 4;
    const roofMat = new StandardMaterial('roofMat', this.scene);
    roofMat.diffuseColor = new Color3(0.2, 0.12, 0.06);
    roof.material = roofMat;
    this.shadows.addShadowCaster(roof);

    // Door frame indicator
    const door = MeshBuilder.CreateBox('door', { width: 1.4, height: 2.5, depth: 0.2 }, this.scene);
    door.position = new Vector3(CABIN_POS.x + 3.55, 1.25, CABIN_POS.z);
    const doorMat = new StandardMaterial('doorMat', this.scene);
    doorMat.diffuseColor = new Color3(0.55, 0.32, 0.14);
    door.material = doorMat;

    // Warm cabin window light
    const cabinLight = new HemisphericLight('cabinLight', new Vector3(0, 1, 0), this.scene);
    cabinLight.position = CABIN_POS.clone();
    (cabinLight as any).position = CABIN_POS.clone();
  }

  // ── Wood Box ──────────────────────────────────────────────────────────────

  private setupWoodBox(): void {
    this.woodBoxMesh = MeshBuilder.CreateBox('woodBox', { width: 1.8, height: 1, depth: 1.2 }, this.scene);
    this.woodBoxMesh.position = new Vector3(WOOD_BOX_POS.x, 0.5, WOOD_BOX_POS.z);
    const mat = new StandardMaterial('woodBoxMat', this.scene);
    mat.diffuseColor = new Color3(0.5, 0.28, 0.1);
    this.woodBoxMesh.material = mat;

    // Label on top (simple overlay; handled in HUD hints)
  }

  // ── Forest ────────────────────────────────────────────────────────────────

  private spawnForest(): void {
    const treeCount = 8 + GameState.player.upgrades.treeCount * 4;
    const chopsRequired = Math.max(3, 5 - Math.floor(GameState.player.upgrades.cuttingSpeed * 0.5));
    const positions = this.generateTreePositions(treeCount);

    positions.forEach((pos, i) => {
      const tree = buildTree(this.scene, pos, `t${i}_d${GameState.player.day}`, chopsRequired);
      this.trees.push(tree);
      this.shadows.addShadowCaster(tree.trunk);
      this.shadows.addShadowCaster(tree.foliage);
    });
  }

  private clearForest(): void {
    this.trees.forEach((t) => {
      t.root.dispose(false, true);
    });
    this.trees = [];
  }

  private generateTreePositions(count: number): Vector3[] {
    const positions: Vector3[] = [];
    let attempts = 0;

    while (positions.length < count && attempts < 2000) {
      attempts++;
      const x = (Math.random() - 0.5) * FOREST_HALF * 2;
      const z = (Math.random() - 0.5) * FOREST_HALF * 2;
      const pos = new Vector3(x, 0, z);

      // Keep away from cabin/box area
      if (Vector3.Distance(pos, CABIN_POS) < CABIN_EXCLUSION) continue;

      // Min spacing between trees
      const tooClose = positions.some((p) => Vector3.Distance(pos, p) < MIN_TREE_DIST);
      if (!tooClose) positions.push(pos);
    }
    return positions;
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera(): void {
    this.camera = new UniversalCamera('player', PLAYER_START.clone(), this.scene);
    this.camera.setTarget(new Vector3(0, 1.75, 0));
    this.camera.minZ = 0.1;
    this.camera.speed = 0.3;
    this.camera.angularSensibility = 900;
    this.camera.keysUp    = [87]; // W
    this.camera.keysDown  = [83]; // S
    this.camera.keysLeft  = [65]; // A
    this.camera.keysRight = [68]; // D
    this.camera.checkCollisions = true;
    this.camera.applyGravity = true;
    this.camera.ellipsoid = new Vector3(0.5, 0.85, 0.5);
    this.camera.attachControl(this.canvas, true);

    // Apply movement speed upgrade
    GameState.on('upgradeApplied', (upgrades) => {
      this.camera.speed = 0.3 * (1 + upgrades.movementSpeed * 0.25);
    });
  }

  // ── Systems ───────────────────────────────────────────────────────────────

  private setupSystems(): void {
    this.cycle      = new DayNightCycle(this.scene, this.sun, this.ambient);
    this.chopping   = new ChoppingSystem(this.scene, this.camera, this.trees);
    this.groundhogs = new GroundhogSystem(this.scene);
    this.tigers     = new TigerSystem(this.scene);
    this.inventory  = new InventorySystem(this.trees, WOOD_BOX_POS);
    this.hud        = new HUD(this.scene, this.cycle);
    this.upgradeMenu = new UpgradeMenu(this.scene);

    this.chopping.setScreenShake(() => this.triggerShake());

    this.upgradeMenu.setOnNextDay(() => this.startNextDay());

    // Phase transitions
    GameState.on('phaseChanged', (phase) => this.onPhaseChanged(phase));
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    // Mouse button — chop
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 0) {
        this.isMouseDown = true;
        this.canvas.requestPointerLock();
        this.chopping.startChopping();
      }
      if (info.type === PointerEventTypes.POINTERUP && info.event.button === 0) {
        this.isMouseDown = false;
        this.chopping.stopChopping();
      }
    });

    // Keyboard — E to enter cabin
    this.scene.onKeyboardObservable.add((info) => {
      if (info.type === KeyboardEventTypes.KEYDOWN && info.event.key === 'e') {
        this.enterKeyDown = true;
      }
      if (info.type === KeyboardEventTypes.KEYUP && info.event.key === 'e') {
        this.enterKeyDown = false;
      }
    });

    // Pointer lock change — pause if lost
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) {
        this.chopping.stopChopping();
      }
    });
  }

  // ── Enemy Handling ────────────────────────────────────────────────────────

  private handleEnemies(dt: number): void {
    const phase = GameState.phase;
    const playerPos = this.camera.position;

    // Tigers active during DUSK_WARNING and NIGHT
    if (phase === 'DUSK_WARNING' || phase === 'NIGHT') {
      const tigerCaught = this.tigers.update(dt, playerPos);
      if (tigerCaught) this.handleCaught('tiger');
    }

    // Groundhogs active during NIGHT only
    if (phase === 'NIGHT') {
      const ghCaught = this.groundhogs.update(dt, playerPos);
      if (ghCaught) this.handleCaught('groundhog');
    }
  }

  private handleCaught(by: 'tiger' | 'groundhog'): void {
    if (this.catchInProgress) return;
    this.catchInProgress = true;

    this.chopping.stopChopping();
    this.inventory.loseDayLumber();

    const newLives = GameState.player.lives - 1;
    GameState.updatePlayer({ lives: newLives });
    GameState.emit('playerCaught', by);
    this.hud.triggerCatchFlash();
    this.hud.refreshLives();

    if (newLives <= 0) {
      GameState.setPhase('GAME_OVER');
      GameState.emit('gameOver', undefined);
      this.groundhogs.dispose();
      this.tigers.dispose();

      this.mainMenu.showGameOver(
        GameState.player.day,
        GameState.player.totalLumber,
        () => {
          GameState.reset();
          this.clearForest();
          this.spawnForest();
          this.mainMenu.showStartScreen();
          this.mainMenu.setOnStart(() => this.startGame());
        }
      );
      return;
    }

    // Teleport to cabin, end the day without reward
    this.camera.position.copyFrom(PLAYER_START);
    this.chopping.stopChopping();

    setTimeout(() => {
      this.catchInProgress = false;
      // Night continues but player is now near cabin — they can try to enter
    }, 1200);
  }

  // ── Cabin Check ───────────────────────────────────────────────────────────

  private checkCabinEntry(): void {
    const phase = GameState.phase;
    if (phase !== 'DUSK_WARNING' && phase !== 'NIGHT') return;

    const dist = Vector3.Distance(this.camera.position, CABIN_POS);
    if (dist < CABIN_SAFE_RADIUS && this.enterKeyDown) {
      this.enterCabin();
    }
  }

  private enterCabin(): void {
    GameState.setPhase('CABIN_SAFE');
    this.groundhogs.dispose();
    this.tigers.dispose();
    this.chopping.stopChopping();

    const earned = GameState.player.currentLumber;
    this.inventory.bankDayLumber();

    // Show upgrade menu after brief delay
    setTimeout(() => {
      GameState.setPhase('UPGRADING');
      this.upgradeMenu.show(earned);
    }, 1800);
  }

  // ── Phase Events ──────────────────────────────────────────────────────────

  private onPhaseChanged(phase: typeof GameState.phase): void {
    switch (phase) {
      case 'DUSK_WARNING':
        this.tigers.spawn();
        break;

      case 'NIGHT': {
        const stumpPositions = this.trees
          .filter((t) => t.isFelled)
          .map((t) => t.stump.getAbsolutePosition());
        this.groundhogs.spawnFromStumps(stumpPositions);
        break;
      }

      case 'CABIN_SAFE':
        // HUD handled by event
        break;
    }
  }

  // ── HUD Hint Resolver ─────────────────────────────────────────────────────

  private resolveHint(invAction: 'collected' | 'deposited' | null): string {
    const phase = GameState.phase;

    if (phase === 'DUSK_WARNING') return 'TIGERS ARE PROWLING — GET TO THE CABIN  [E]';
    if (phase === 'NIGHT') return 'NIGHT FALLS — REACH THE CABIN  [E]';

    const nearCabin = Vector3.Distance(this.camera.position, CABIN_POS) < CABIN_SAFE_RADIUS + 3;
    if (nearCabin && (phase === 'DUSK_WARNING' || phase === 'NIGHT')) return 'PRESS [E] — ENTER CABIN';

    if (invAction === 'collected') return 'Logs collected';
    if (invAction === 'deposited') return 'Lumber deposited';

    const nearBox = this.inventory.isNearWoodBox(this.camera.position);
    if (nearBox && GameState.player.carriedLogs > 0) return 'Depositing logs...';

    const aimed = this.chopping.getAimedTree();
    if (aimed && !aimed.isFelled) return '[Hold LMB] Chop tree';

    if (GameState.player.carriedLogs >= 5 + GameState.player.upgrades.treeValue) {
      return 'Arms full — deposit at wood box';
    }

    return '';
  }

  // ── Camera Shake ──────────────────────────────────────────────────────────

  private triggerShake(): void {
    this.cameraShakeT = 0.1;
  }

  private handleCameraShake(dt: number): void {
    if (this.cameraShakeT <= 0) return;
    this.cameraShakeT -= dt;
    const intensity = 0.04;
    this.camera.position.x += (Math.random() - 0.5) * intensity;
    this.camera.position.y += (Math.random() - 0.5) * intensity * 0.5;
  }
}
