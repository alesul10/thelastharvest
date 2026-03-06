/**
 * TigerSystem — Forest Guardians
 *
 * Lore: The ancient tigers of this wood guard the living trees.
 * When the sun begins to set (DUSK_WARNING) they emerge from the shadows
 * to reclaim the forest. They are faster than groundhogs, smarter, and
 * will not be dissuaded by darkness.
 *
 * Mechanics:
 *  - Spawned at the forest edge when DUSK_WARNING begins.
 *  - Patrol a random path until the player enters their detection radius.
 *  - Once hunting, they beeline at high speed and flank unpredictably.
 *  - They persist through NIGHT (alongside groundhogs).
 *  - They despawn at dawn with the rest of the horror.
 */

import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Mesh,
  TransformNode,
  Animation,
} from '@babylonjs/core';
import { GameState } from '../GameState';

type TigerState = 'patrol' | 'hunt' | 'pounce';

interface Tiger {
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  leftEye: Mesh;
  rightEye: Mesh;
  tail: Mesh;
  eyeGlow: PointLight;
  spawnPos: Vector3;
  patrolTarget: Vector3;
  state: TigerState;
  speed: number;
  huntSpeed: number;
  detectionRange: number;
  pounceTimer: number;
  patrolTimer: number;
  id: string;
}

const FOREST_HALF = 27;      // tigers spawn just beyond the playable forest edge
const DETECTION_RANGE = 14;  // distance at which tigers spot the player
const CATCH_RANGE = 1.6;

export class TigerSystem {
  private tigers: Tiger[] = [];
  private t = 0; // global time for animations

  constructor(private scene: Scene) {}

  // ── Spawn ──────────────────────────────────────────────────────────────────

  /**
   * Spawn tigers around the forest perimeter.
   * Count scales with day number: 1 tiger days 1-2, +1 every 2 days (max 4).
   */
  spawn(): void {
    this.dispose();
    const day = GameState.player.day;
    const count = Math.min(1 + Math.floor((day - 1) / 2), 4);
    const baseSpeed = 3.5 + day * 0.4;
    const huntSpeed = baseSpeed * 1.6;

    for (let i = 0; i < count; i++) {
      const spawnPos = this.randomEdgePosition();
      this.tigers.push(this.buildTiger(spawnPos, baseSpeed, huntSpeed, `tiger_${i}`));
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  /**
   * Returns true if the player was caught by a tiger this frame.
   */
  update(deltaTime: number, playerPos: Vector3): boolean {
    this.t += deltaTime;

    for (const tiger of this.tigers) {
      tiger.patrolTimer -= deltaTime;

      const toPlayer = playerPos.subtract(tiger.root.position);
      toPlayer.y = 0;
      const distToPlayer = toPlayer.length();

      // ── Catch check ────────────────────────────────────────────────────────
      if (distToPlayer < CATCH_RANGE) return true;

      // ── State transitions ──────────────────────────────────────────────────
      if (distToPlayer < tiger.detectionRange && tiger.state === 'patrol') {
        tiger.state = 'hunt';
      } else if (distToPlayer > tiger.detectionRange * 1.4 && tiger.state === 'hunt') {
        tiger.state = 'patrol';
        tiger.patrolTarget = this.randomPatrolPoint(tiger.spawnPos);
      }

      // ── Pounce charge (close-range acceleration burst) ─────────────────────
      if (distToPlayer < 6 && tiger.state === 'hunt') {
        tiger.state = 'pounce';
        tiger.pounceTimer = 0.4;
      }
      if (tiger.state === 'pounce') {
        tiger.pounceTimer -= deltaTime;
        if (tiger.pounceTimer <= 0) tiger.state = 'hunt';
      }

      // ── Movement ───────────────────────────────────────────────────────────
      const speed = tiger.state === 'patrol'
        ? tiger.speed
        : tiger.state === 'pounce'
          ? tiger.huntSpeed * 2.2
          : tiger.huntSpeed;

      let moveDir: Vector3;

      if (tiger.state === 'patrol') {
        if (tiger.patrolTimer <= 0) {
          tiger.patrolTarget = this.randomPatrolPoint(tiger.spawnPos);
          tiger.patrolTimer = 3 + Math.random() * 4;
        }
        const toTarget = tiger.patrolTarget.subtract(tiger.root.position);
        toTarget.y = 0;
        moveDir = toTarget.length() > 0.5 ? toTarget.normalize() : Vector3.Zero();
      } else {
        // Hunt: slight flanking offset to be unpredictable
        const flank = new Vector3(
          Math.sin(this.t * 1.3 + parseInt(tiger.id.slice(-1))) * 2,
          0,
          Math.cos(this.t * 1.1 + parseInt(tiger.id.slice(-1))) * 2
        );
        moveDir = toPlayer.add(flank).normalize();
      }

      if (moveDir.length() > 0.01) {
        tiger.root.position.addInPlace(moveDir.scale(speed * deltaTime));
        tiger.root.position.y = 0;

        // Face movement direction
        const lookTarget = tiger.root.position.add(moveDir);
        tiger.root.lookAt(new Vector3(lookTarget.x, tiger.root.position.y, lookTarget.z));
      }

      // Body bob while moving
      tiger.body.position.y = 0.5 + Math.sin(this.t * 8) * 0.04;
      tiger.tail.rotation.z = Math.sin(this.t * 4) * 0.5;

      // Eye glow intensifies when hunting
      tiger.eyeGlow.intensity =
        tiger.state === 'patrol'
          ? 0.3 + Math.sin(this.t * 1.5) * 0.1
          : 0.9 + Math.sin(this.t * 8) * 0.2;
      tiger.eyeGlow.diffuse =
        tiger.state === 'patrol'
          ? new Color3(1, 0.5, 0)  // amber patrol
          : new Color3(1, 0.1, 0); // blood-red hunt
    }

    return false;
  }

  dispose(): void {
    this.tigers.forEach((t) => {
      t.eyeGlow.dispose();
      t.root.dispose(false, true);
    });
    this.tigers = [];
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private buildTiger(spawnPos: Vector3, speed: number, huntSpeed: number, id: string): Tiger {
    const root = new TransformNode(`${id}_root`, this.scene);
    root.position = spawnPos.clone();

    // Body — elongated sphere (scaled cylinder)
    const body = MeshBuilder.CreateSphere(`${id}_body`, { diameter: 1.1, segments: 6 }, this.scene);
    body.parent = root;
    body.scaling.z = 1.7; // elongate along Z (forward axis)
    body.position.y = 0.5;

    const bodyMat = new StandardMaterial(`${id}_bodyMat`, this.scene);
    bodyMat.diffuseColor = new Color3(0.72, 0.42, 0.08);
    bodyMat.specularColor = new Color3(0.1, 0.06, 0.01);
    body.material = bodyMat;

    // Stripes via a darker overlay mesh (simple darker sphere)
    const stripes = MeshBuilder.CreateSphere(`${id}_stripes`, { diameter: 1.12, segments: 6 }, this.scene);
    stripes.parent = root;
    stripes.scaling = new Vector3(0.35, 0.9, 1.75);
    stripes.position.y = 0.5;
    const stripeMat = new StandardMaterial(`${id}_stripeMat`, this.scene);
    stripeMat.diffuseColor = new Color3(0.1, 0.06, 0.02);
    stripeMat.alpha = 0.55;
    stripes.material = stripeMat;

    // Head
    const head = MeshBuilder.CreateSphere(`${id}_head`, { diameter: 0.72, segments: 6 }, this.scene);
    head.parent = root;
    head.position = new Vector3(0, 0.65, 0.8);

    const headMat = new StandardMaterial(`${id}_headMat`, this.scene);
    headMat.diffuseColor = new Color3(0.65, 0.38, 0.06);
    head.material = headMat;

    // Eyes
    const eyeMat = new StandardMaterial(`${id}_eyeMat`, this.scene);
    eyeMat.emissiveColor = new Color3(1, 0.6, 0);
    eyeMat.disableLighting = true;

    const leftEye = MeshBuilder.CreateSphere(`${id}_leye`, { diameter: 0.12, segments: 4 }, this.scene);
    leftEye.parent = head;
    leftEye.position = new Vector3(0.18, 0.1, 0.3);
    leftEye.material = eyeMat;

    const rightEye = MeshBuilder.CreateSphere(`${id}_reye`, { diameter: 0.12, segments: 4 }, this.scene);
    rightEye.parent = head;
    rightEye.position = new Vector3(-0.18, 0.1, 0.3);
    rightEye.material = eyeMat;

    // Ears
    const earMat = new StandardMaterial(`${id}_earMat`, this.scene);
    earMat.diffuseColor = new Color3(0.6, 0.3, 0.05);
    for (const sign of [-1, 1]) {
      const ear = MeshBuilder.CreateCylinder(
        `${id}_ear${sign}`,
        { height: 0.22, diameterTop: 0, diameterBottom: 0.2, tessellation: 5 },
        this.scene
      );
      ear.parent = head;
      ear.position = new Vector3(sign * 0.24, 0.32, 0.05);
      ear.material = earMat;
    }

    // Tail
    const tail = MeshBuilder.CreateCylinder(
      `${id}_tail`,
      { height: 0.8, diameterTop: 0.04, diameterBottom: 0.14, tessellation: 5 },
      this.scene
    );
    tail.parent = root;
    tail.position = new Vector3(0, 0.5, -0.85);
    tail.rotation.x = Math.PI / 4;
    tail.material = bodyMat;

    // Amber eye glow
    const eyeGlow = new PointLight(`${id}_glow`, Vector3.Zero(), this.scene);
    eyeGlow.parent = head;
    eyeGlow.position = new Vector3(0, 0, 0.4);
    eyeGlow.diffuse = new Color3(1, 0.5, 0);
    eyeGlow.intensity = 0.35;
    eyeGlow.range = 6;

    return {
      root,
      body,
      head,
      leftEye,
      rightEye,
      tail,
      eyeGlow,
      spawnPos: spawnPos.clone(),
      patrolTarget: this.randomPatrolPoint(spawnPos),
      state: 'patrol',
      speed,
      huntSpeed,
      detectionRange: DETECTION_RANGE,
      pounceTimer: 0,
      patrolTimer: 2,
      id,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private randomEdgePosition(): Vector3 {
    const side = Math.floor(Math.random() * 4);
    const h = FOREST_HALF;
    const r = (v: number) => (Math.random() - 0.5) * h * 2;
    switch (side) {
      case 0: return new Vector3(h, 0, r(h));
      case 1: return new Vector3(-h, 0, r(h));
      case 2: return new Vector3(r(h), 0, h);
      default: return new Vector3(r(h), 0, -h);
    }
  }

  private randomPatrolPoint(near: Vector3): Vector3 {
    const offset = 12;
    return new Vector3(
      near.x + (Math.random() - 0.5) * offset,
      0,
      near.z + (Math.random() - 0.5) * offset
    );
  }
}
