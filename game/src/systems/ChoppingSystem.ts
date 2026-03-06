import {
  Scene,
  Camera,
  Mesh,
  Vector3,
  TransformNode,
  Animation,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { GameState } from '../GameState';

const CHOP_RANGE = 5;
const BASE_CHOPS = 5;
const CHOP_INTERVAL = 0.45; // seconds per chop at base speed

// ── Tree Data ──────────────────────────────────────────────────────────────

export interface TreeData {
  id: string;
  root: TransformNode;    // pivot at ground level
  trunk: Mesh;
  foliage: Mesh;
  stump: Mesh;
  logPile: Mesh;
  position: Vector3;      // world XZ position
  chopsLanded: number;
  chopsRequired: number;
  isFelled: boolean;
  hasLogs: boolean;
  logsValue: number;
}

// ── System ─────────────────────────────────────────────────────────────────

export class ChoppingSystem {
  private isChopping = false;
  private chopTimer = 0;
  private activeTree: TreeData | null = null;
  private onFelled: ((tree: TreeData) => void) | null = null;
  private screenShakeCallback: (() => void) | null = null;

  constructor(
    private scene: Scene,
    private camera: Camera,
    private trees: TreeData[]
  ) {}

  setOnFelled(cb: (tree: TreeData) => void): void {
    this.onFelled = cb;
  }

  setScreenShake(cb: () => void): void {
    this.screenShakeCallback = cb;
  }

  // ── Per-Frame Update ──────────────────────────────────────────────────────

  update(deltaTime: number): void {
    if (!this.isChopping || !this.activeTree) return;

    // Stop automatically if we lose line-of-sight or move away
    const dist = Vector3.Distance(this.camera.position, this.activeTree.position);
    if (dist > CHOP_RANGE || this.activeTree.isFelled) {
      this.stopChopping();
      return;
    }

    const speedMult = 1 + GameState.player.upgrades.cuttingSpeed * 0.5;
    this.chopTimer += deltaTime * speedMult;

    if (this.chopTimer >= CHOP_INTERVAL) {
      this.chopTimer -= CHOP_INTERVAL;
      this.landChop();
    }
  }

  // ── Input API ─────────────────────────────────────────────────────────────

  startChopping(): void {
    const tree = this.getAimedTree();
    if (!tree) return;
    this.isChopping = true;
    this.activeTree = tree;
    this.chopTimer = 0;
  }

  stopChopping(): void {
    this.isChopping = false;
    this.activeTree = null;
    this.chopTimer = 0;
  }

  /** Returns the tree currently in the player's aim (center-screen), or null. */
  getAimedTree(): TreeData | null {
    const width = this.scene.getEngine().getRenderWidth();
    const height = this.scene.getEngine().getRenderHeight();
    const pick = this.scene.pick(width / 2, height / 2);

    if (!pick.hit || !pick.pickedMesh) {
      // Fallback: nearest unfelled tree in CHOP_RANGE ahead
      return this.nearestTreeInRange();
    }

    const meta = pick.pickedMesh.metadata as { treeId?: string } | null;
    if (meta?.treeId) {
      const tree = this.trees.find((t) => t.id === meta.treeId && !t.isFelled);
      if (tree) return tree;
    }

    return this.nearestTreeInRange();
  }

  get currentTree(): TreeData | null {
    return this.activeTree;
  }

  get chopProgress(): number {
    if (!this.activeTree) return 0;
    return this.activeTree.chopsLanded / this.activeTree.chopsRequired;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private landChop(): void {
    if (!this.activeTree) return;
    this.activeTree.chopsLanded++;
    this.screenShakeCallback?.();

    if (this.activeTree.chopsLanded >= this.activeTree.chopsRequired) {
      this.fellTree(this.activeTree);
    }
  }

  private fellTree(tree: TreeData): void {
    tree.isFelled = true;
    tree.hasLogs = true;
    tree.logsValue = 2 + GameState.player.upgrades.treeValue;
    this.stopChopping();

    // Hide foliage, reveal stump + log pile
    tree.foliage.isVisible = false;
    tree.trunk.checkCollisions = false;
    tree.stump.isVisible = true;
    tree.logPile.isVisible = true;

    // Fall animation — rotate the root node so trunk pivots at its base
    const fallAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
    Animation.CreateAndStartAnimation(
      `fall_${tree.id}`,
      tree.root,
      'rotation.z',
      30,
      25,
      0,
      fallAngle,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    this.onFelled?.(tree);
  }

  private nearestTreeInRange(): TreeData | null {
    let best: TreeData | null = null;
    let bestDist = CHOP_RANGE;

    for (const tree of this.trees) {
      if (tree.isFelled) continue;
      const d = Vector3.Distance(this.camera.position, tree.position);
      if (d < bestDist) {
        bestDist = d;
        best = tree;
      }
    }
    return best;
  }
}

// ── Tree Factory ─────────────────────────────────────────────────────────────

export function buildTree(scene: Scene, position: Vector3, id: string, chopsRequired: number): TreeData {
  const TRUNK_HEIGHT = 5 + Math.random() * 2;
  const TRUNK_DIAM = 0.5 + Math.random() * 0.2;

  // Root node at ground for correct fall pivot
  const root = new TransformNode(`tree_root_${id}`, scene);
  root.position = new Vector3(position.x, 0, position.z);

  // Trunk
  const trunk = MeshBuilder.CreateCylinder(
    `trunk_${id}`,
    { height: TRUNK_HEIGHT, diameter: TRUNK_DIAM, tessellation: 7 },
    scene
  );
  trunk.parent = root;
  trunk.position.y = TRUNK_HEIGHT / 2;
  trunk.checkCollisions = true;
  const trunkMat = new StandardMaterial(`trunkMat_${id}`, scene);
  trunkMat.diffuseColor = new Color3(0.38, 0.22, 0.1);
  trunk.material = trunkMat;
  trunk.metadata = { treeId: id };

  // Foliage (two stacked cones for depth)
  const foliage = MeshBuilder.CreateCylinder(
    `foliage_${id}`,
    { height: 4, diameterTop: 0, diameterBottom: 3.5, tessellation: 7 },
    scene
  );
  foliage.parent = root;
  foliage.position.y = TRUNK_HEIGHT + 1.8;
  const foliageMat = new StandardMaterial(`foliageMat_${id}`, scene);
  foliageMat.diffuseColor = new Color3(0.08, 0.35, 0.1);
  foliage.material = foliageMat;
  foliage.metadata = { treeId: id };

  const foliage2 = MeshBuilder.CreateCylinder(
    `foliage2_${id}`,
    { height: 3, diameterTop: 0, diameterBottom: 2.5, tessellation: 7 },
    scene
  );
  foliage2.parent = root;
  foliage2.position.y = TRUNK_HEIGHT + 3.5;
  foliage2.material = foliageMat;
  foliage2.metadata = { treeId: id };

  // Stump (hidden until felled)
  const stump = MeshBuilder.CreateCylinder(
    `stump_${id}`,
    { height: 0.6, diameter: TRUNK_DIAM + 0.2, tessellation: 7 },
    scene
  );
  stump.parent = root;
  stump.position.y = 0.3;
  stump.isVisible = false;
  stump.material = trunkMat;

  // Log pile (hidden until felled)
  const logPile = MeshBuilder.CreateCylinder(
    `logs_${id}`,
    { height: 0.35, diameter: 1.2, tessellation: 6 },
    scene
  );
  logPile.parent = root;
  logPile.position = new Vector3(1.2, 0.18, 0.8);
  logPile.isVisible = false;
  const logMat = new StandardMaterial(`logMat_${id}`, scene);
  logMat.diffuseColor = new Color3(0.55, 0.3, 0.12);
  logPile.material = logMat;
  logPile.metadata = { logId: id };

  return {
    id,
    root,
    trunk,
    foliage,
    stump,
    logPile,
    position: new Vector3(position.x, 0, position.z),
    chopsLanded: 0,
    chopsRequired,
    isFelled: false,
    hasLogs: false,
    logsValue: 0,
  };
}
