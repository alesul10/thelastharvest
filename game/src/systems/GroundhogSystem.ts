import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Mesh,
  TransformNode,
} from '@babylonjs/core';
import { GameState } from '../GameState';

interface Groundhog {
  root: TransformNode;
  body: Mesh;
  leftEye: Mesh;
  rightEye: Mesh;
  glow: PointLight;
  stumpPos: Vector3;
  emerged: boolean;
  emergeT: number; // 0→1 emergence lerp
  speed: number;
}

export class GroundhogSystem {
  private groundhogs: Groundhog[] = [];
  private bobT = 0;

  constructor(private scene: Scene) {}

  // ── Spawn ─────────────────────────────────────────────────────────────────

  /** Spawn one groundhog per stump position. */
  spawnFromStumps(stumpPositions: Vector3[]): void {
    this.dispose();
    const day = GameState.player.day;
    const baseSpeed = 2.2 + day * 0.35;

    stumpPositions.forEach((pos, i) => {
      this.groundhogs.push(this.buildGroundhog(pos, baseSpeed, `gh_${i}`));
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Returns true if the player was caught by a groundhog this frame.
   */
  update(deltaTime: number, playerPos: Vector3): boolean {
    this.bobT += deltaTime * 6;

    for (const gh of this.groundhogs) {
      if (!gh.emerged) {
        // Emerge slowly from below ground
        gh.emergeT = Math.min(gh.emergeT + deltaTime * 0.6, 1);
        gh.root.position.y = gh.stumpPos.y - 0.9 + gh.emergeT * 1.25;
        if (gh.emergeT >= 1) gh.emerged = true;
        continue;
      }

      const toPlayer = playerPos.subtract(gh.root.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      // Catch radius
      if (dist < 1.4) return true;

      // Seek player
      if (dist > 0.2) {
        const dir = toPlayer.normalize();
        gh.root.position.addInPlace(dir.scale(gh.speed * deltaTime));
        gh.root.position.y = gh.stumpPos.y + 0.4 + Math.sin(this.bobT) * 0.07;

        // Face movement direction
        gh.root.lookAt(
          new Vector3(playerPos.x, gh.root.position.y, playerPos.z)
        );
      }

      // Red eye flicker
      gh.glow.intensity = 0.45 + Math.sin(this.bobT * 2.3) * 0.15;
    }

    return false;
  }

  dispose(): void {
    this.groundhogs.forEach((gh) => {
      gh.glow.dispose();
      gh.root.dispose(false, true);
    });
    this.groundhogs = [];
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private buildGroundhog(stumpPos: Vector3, speed: number, id: string): Groundhog {
    const root = new TransformNode(`${id}_root`, this.scene);
    root.position = new Vector3(stumpPos.x, stumpPos.y - 0.9, stumpPos.z);

    // Body
    const body = MeshBuilder.CreateSphere(`${id}_body`, { diameter: 0.75, segments: 6 }, this.scene);
    body.parent = root;
    body.position.y = 0;
    const bodyMat = new StandardMaterial(`${id}_bodyMat`, this.scene);
    bodyMat.diffuseColor = new Color3(0.28, 0.18, 0.09);
    bodyMat.specularColor = Color3.Black();
    body.material = bodyMat;

    // Ears
    for (const sign of [-1, 1]) {
      const ear = MeshBuilder.CreateCylinder(
        `${id}_ear${sign}`,
        { height: 0.32, diameterTop: 0.02, diameterBottom: 0.18, tessellation: 6 },
        this.scene
      );
      ear.parent = body;
      ear.position = new Vector3(sign * 0.22, 0.42, 0);
      ear.material = bodyMat;
    }

    // Eyes
    const eyeMat = new StandardMaterial(`${id}_eyeMat`, this.scene);
    eyeMat.emissiveColor = new Color3(1, 0, 0);
    eyeMat.disableLighting = true;

    const leftEye = MeshBuilder.CreateSphere(`${id}_leye`, { diameter: 0.1, segments: 4 }, this.scene);
    leftEye.parent = body;
    leftEye.position = new Vector3(0.14, 0.1, 0.34);
    leftEye.material = eyeMat;

    const rightEye = MeshBuilder.CreateSphere(`${id}_reye`, { diameter: 0.1, segments: 4 }, this.scene);
    rightEye.parent = body;
    rightEye.position = new Vector3(-0.14, 0.1, 0.34);
    rightEye.material = eyeMat;

    // Red point light for eye glow
    const glow = new PointLight(`${id}_glow`, Vector3.Zero(), this.scene);
    glow.parent = body;
    glow.position = new Vector3(0, 0, 0.4);
    glow.diffuse = new Color3(1, 0.05, 0.05);
    glow.intensity = 0.5;
    glow.range = 4;

    return {
      root,
      body,
      leftEye,
      rightEye,
      glow,
      stumpPos: stumpPos.clone(),
      emerged: false,
      emergeT: 0,
      speed,
    };
  }
}
