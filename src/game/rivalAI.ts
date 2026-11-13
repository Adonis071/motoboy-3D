import * as THREE from 'three';
import { DeliveryOrder } from '../types/game';
import { CollisionBox } from './physics';
import {
  createMotorcycle,
  createOnFootMotoboy,
  MotorcycleGroup,
  OnFootMotoboyGroup,
} from './proceduralModels';
import { VERTICAL_AVENUES_X, HORIZONTAL_AVENUES_Z } from './cityEnvironment';
import { sound } from '../audio/soundEngine';

export class RivalMotoboyAI {
  public mesh: MotorcycleGroup;
  public strandedRiderMesh: OnFootMotoboyGroup;
  public position = new THREE.Vector3(-67.2, 0, -52);
  public heading = 0;
  public speed = 0;
  public leanAngle = 0;
  public pitchAngle = 0;
  public steerAngle = 0;
  public wheelRotation = 0;

  // Competition, Health & Hijack state
  public health = 100;
  public koTimer = 0;
  public hasStolenPackage = false;
  public rivalStage: 'to_pickup' | 'to_deliver' = 'to_pickup';
  public currentOrderId: string | null = null;
  public stealCooldown = 0;
  public distanceToTargetM = 0;
  public stunTimer = 0;
  public hijackedTimer = 0;

  private waypoint = new THREE.Vector3();
  private badgeCanvas: HTMLCanvasElement;
  private badgeTexture: THREE.CanvasTexture;
  private lastBadgeState: string = '';
  private stuckTimer = 0;
  private prevPos = new THREE.Vector3(-67.2, 0, -52);

  constructor(scene: THREE.Scene) {
    // Distinctive Rival Motorcycle: Gold/Yellow & Black "RAPIDÃO" with Purple Neon
    this.mesh = createMotorcycle(
      {
        paintColor: '#eab308',
        trunkSkin: 'amarelo',
        helmetColor: '#facc15',
        neonColor: 'purple',
        exhaustType: 'sport',
      },
      {
        engineLevel: 2,
        accelerationLevel: 2,
        brakesLevel: 2,
        tiresLevel: 2,
        trunkLevel: 2,
        nitroUnlocked: true,
      }
    );

    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 340;
    this.badgeCanvas.height = 88;
    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
    this.badgeTexture.colorSpace = THREE.SRGBColorSpace;

    // Add a floating 3D Rival Nameplate + Health Bar Sprite above his helmet
    const badgeSprite = this.createRivalBadgeSprite();
    badgeSprite.position.set(0, 2.48, 0);
    this.mesh.add(badgeSprite);
    this.updateBadgeLabel('⚡ FALCÃO • INDO COLETAR', '#facc15');

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Stranded on-foot Falcão mesh when player hijacks his bike or knocks him out!
    this.strandedRiderMesh = createOnFootMotoboy('#facc15');
    const strandedBadge = this.createRivalBadgeSprite();
    strandedBadge.position.set(0, 2.3, 0);
    this.strandedRiderMesh.add(strandedBadge);
    this.strandedRiderMesh.visible = false;
    scene.add(this.strandedRiderMesh);
  }

  public intimidate() {
    if (this.hijackedTimer > 0 || this.koTimer > 0) return;
    this.stunTimer = 6.5;
    this.speed = 0;
  }

  public hijackBike() {
    this.hijackedTimer = 28.0;
    this.stunTimer = 0;
    this.speed = 0;
    this.hasStolenPackage = false;
    this.strandedRiderMesh.position.copy(this.position);
    this.strandedRiderMesh.visible = true;
    this.mesh.visible = false;
  }

  /**
   * Applies on-foot Punch or Push from the Player to Rival Falcão.
   * When Falcão's Life reaches 0%, he suffers total KO/Lose!
   */
  public applyMeleeHit(
    playerPos: THREE.Vector3,
    damage: number,
    isPush: boolean
  ): { hit: boolean; defeated: boolean; knockedOffBike: boolean } {
    if (this.koTimer > 0) return { hit: false, defeated: false, knockedOffBike: false };
    const dist = Math.hypot(this.position.x - playerPos.x, this.position.z - playerPos.z);
    if (dist > 3.6) return { hit: false, defeated: false, knockedOffBike: false };

    this.health = Math.max(0, this.health - damage);
    this.hasStolenPackage = false;

    const pushDirX = (this.position.x - playerPos.x) / (dist || 1);
    const pushDirZ = (this.position.z - playerPos.z) / (dist || 1);
    this.position.x += pushDirX * (isPush ? 1.8 : 0.7);
    this.position.z += pushDirZ * (isPush ? 1.8 : 0.7);

    if (this.health <= 0) {
      this.koTimer = 32.0;
      this.stunTimer = 0;
      this.speed = 0;
      this.strandedRiderMesh.position.copy(this.position);
      this.strandedRiderMesh.visible = true;
      this.updateBadgeLabel('💀 FALCÃO DERROTADO (LOSE)!', '#ef4444');
      return { hit: true, defeated: true, knockedOffBike: true };
    }

    if (isPush) {
      this.stunTimer = 8.0;
      this.speed = 0;
      this.updateBadgeLabel('💫 EMPURRADO! TOME A MOTO [F]', '#f97316');
      return { hit: true, defeated: false, knockedOffBike: true };
    }

    this.stunTimer = Math.max(this.stunTimer, 4.0);
    this.speed = 0;
    this.updateBadgeLabel('🥊 FALCÃO ATINGIDO!', '#f97316');
    return { hit: true, defeated: false, knockedOffBike: false };
  }

  private createRivalBadgeSprite(): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({ map: this.badgeTexture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.2, 0.84, 1);
    return sprite;
  }

  private updateBadgeLabel(text: string, borderColor: string) {
    const hp = Math.max(0, Math.min(100, Math.round(this.health)));
    const key = `${text}_${borderColor}_${hp}`;
    if (this.lastBadgeState === key) return;
    this.lastBadgeState = key;

    const ctx = this.badgeCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 340, 88);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 332, 80, 16);
    ctx.fill();

    ctx.strokeStyle = hp <= 0 ? '#ef4444' : borderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 4, 332, 80, 16);
    ctx.stroke();

    ctx.fillStyle = hp <= 0 ? '#f87171' : borderColor;
    ctx.font = '900 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 170, 27);

    // Health bar track ("Barra de Life")
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(22, 48, 296, 22, 9);
    ctx.fill();

    const barColor = hp > 60 ? '#10b981' : hp > 30 ? '#f59e0b' : '#ef4444';
    if (hp > 0) {
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(24, 50, Math.max(12, (292 * hp) / 100), 18, 7);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px monospace';
    ctx.fillText(`❤️ LIFE ${hp}%`, 170, 59);

    this.badgeTexture.needsUpdate = true;
  }

  /**
   * Computes a strictly avenue-aligned waypoint so the Rival navigates the city intersections
   * cleanly and only pulls into the curb bay when already aligned on the target's avenue.
   */
  private computeAvenueWaypoint(targetX: number, targetZ: number): THREE.Vector3 {
    const rx = this.position.x;
    const rz = this.position.z;

    if (Math.hypot(targetX - rx, targetZ - rz) < 9.5) {
      return this.waypoint.set(targetX, 0, targetZ);
    }

    const nearestVertX = VERTICAL_AVENUES_X.reduce((best, x) =>
      Math.abs(x - rx) < Math.abs(best - rx) ? x : best
    );
    const nearestHorizZ = HORIZONTAL_AVENUES_Z.reduce((best, z) =>
      Math.abs(z - rz) < Math.abs(best - rz) ? z : best
    );

    const targetVertDist = Math.min(...VERTICAL_AVENUES_X.map(x => Math.abs(x - targetX)));
    const targetHorizDist = Math.min(...HORIZONTAL_AVENUES_Z.map(z => Math.abs(z - targetZ)));
    const isTargetOnVertAvenue = targetVertDist <= targetHorizDist;

    const targetVertX = VERTICAL_AVENUES_X.reduce((best, x) =>
      Math.abs(x - targetX) < Math.abs(best - targetX) ? x : best
    );
    const targetHorizZ = HORIZONTAL_AVENUES_Z.reduce((best, z) =>
      Math.abs(z - targetZ) < Math.abs(best - targetZ) ? z : best
    );

    const onVertAvenue = Math.abs(rx - nearestVertX) < 6.8;
    const onHorizAvenue = Math.abs(rz - nearestHorizZ) < 6.8;

    if (isTargetOnVertAvenue) {
      if (Math.abs(rx - targetVertX) < 6.8) {
        if (Math.abs(targetZ - rz) < 16) {
          return this.waypoint.set(targetX, 0, targetZ);
        }
        return this.waypoint.set(targetVertX, 0, targetZ);
      }
      if (onHorizAvenue) {
        return this.waypoint.set(targetVertX, 0, nearestHorizZ);
      }
      return this.waypoint.set(nearestVertX, 0, nearestHorizZ);
    }

    if (Math.abs(rz - targetHorizZ) < 6.8) {
      if (Math.abs(targetX - rx) < 16) {
        return this.waypoint.set(targetX, 0, targetZ);
      }
      return this.waypoint.set(targetX, 0, targetHorizZ);
    }

    if (onVertAvenue) {
      return this.waypoint.set(nearestVertX, 0, targetHorizZ);
    }
    return this.waypoint.set(nearestVertX, 0, nearestHorizZ);
  }

  public update(
    dt: number,
    order: DeliveryOrder | null,
    playerPos: THREE.Vector3,
    playerLevelSpeedBonus: number,
    obstacles: CollisionBox[],
    onRivalPickup: () => void,
    onPlayerInterceptRival: () => void,
    onRivalDeliver: () => void,
    isPlayerOnFoot: boolean = false
  ) {
    if (this.stealCooldown > 0) {
      this.stealCooldown = Math.max(0, this.stealCooldown - dt);
    }

    // If Falcão lost all his Life (0% HP), he lies knocked out on the ground!
    if (this.koTimer > 0) {
      this.koTimer = Math.max(0, this.koTimer - dt);
      this.strandedRiderMesh.visible = true;
      this.strandedRiderMesh.position.set(this.position.x + 1.1, 0.22, this.position.z);
      this.strandedRiderMesh.rotation.x = -Math.PI / 2.2;
      this.updateBadgeLabel('💀 FALCÃO DERROTADO (0% LIFE)!', '#ef4444');
      if (this.koTimer <= 0) {
        this.health = 100;
        this.strandedRiderMesh.rotation.x = 0;
        this.strandedRiderMesh.position.y = 0;
        this.strandedRiderMesh.visible = false;
        this.mesh.visible = true;
      }
      return;
    }

    // If player hijacked Falcão's bike, Falcão stays on foot waving his arms angrily!
    if (this.hijackedTimer > 0) {
      this.hijackedTimer = Math.max(0, this.hijackedTimer - dt);
      this.mesh.visible = false;
      this.strandedRiderMesh.visible = true;
      this.strandedRiderMesh.rotation.x = 0;
      this.strandedRiderMesh.position.y = 0;
      this.updateBadgeLabel('🤬 FALCÃO A PÉ: "ROUBARAM MINHA MOTO!"', '#ef4444');
      const wave = Math.sin(this.hijackedTimer * 14) * 0.9;
      this.strandedRiderMesh.leftArm.rotation.x = -Math.PI * 0.7 + wave * 0.4;
      this.strandedRiderMesh.rightArm.rotation.x = -Math.PI * 0.7 - wave * 0.4;
      this.strandedRiderMesh.rotation.y = Math.atan2(
        playerPos.x - this.position.x,
        playerPos.z - this.position.z
      );
      if (this.hijackedTimer <= 0) {
        this.strandedRiderMesh.visible = false;
        this.mesh.visible = true;
      }
      return;
    }

    this.strandedRiderMesh.rotation.x = 0;
    this.strandedRiderMesh.visible = false;
    this.mesh.visible = true;

    if (!order) return;

    // Reset rival stage whenever a new order spawns
    if (this.currentOrderId !== order.id) {
      this.currentOrderId = order.id;
      this.hasStolenPackage = false;
      this.rivalStage = 'to_pickup';
      this.stealCooldown = 0;
    }

    const isHeadingToRestaurant = this.rivalStage === 'to_pickup';
    const targetPos = isHeadingToRestaurant ? order.restaurantPos : order.customerPos;

    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      this.speed = THREE.MathUtils.damp(this.speed, 0, 10, dt);
      this.updateBadgeLabel('😡 PARADO! TOME A MOTO [F]', '#f97316');
      this.mesh.position.copy(this.position);
      return;
    }

    const distToPlayer = Math.hypot(
      this.position.x - playerPos.x,
      this.position.z - playerPos.z
    );

    if (this.hasStolenPackage) {
      this.updateBadgeLabel('⚡ FALCÃO • ROUBOU O PEDIDO!', '#f43f5e');
    } else if (isPlayerOnFoot && distToPlayer < 16) {
      this.updateBadgeLabel('😂 FALCÃO: "TÁ A PÉ SEM MOTO?!"', '#facc15');
    } else if (isHeadingToRestaurant) {
      this.updateBadgeLabel('⚡ FALCÃO • INDO COLETAR', '#facc15');
    } else {
      this.updateBadgeLabel('⚡ FALCÃO • ENTREGANDO', '#fb923c');
    }

    const rawDistToTarget = Math.hypot(
      this.position.x - targetPos.x,
      this.position.z - targetPos.z
    );
    this.distanceToTargetM = Math.round(rawDistToTarget * 8);

    // Compute street-aligned waypoint
    const wp = this.computeAvenueWaypoint(targetPos.x, targetPos.z);
    const dx = wp.x - this.position.x;
    const dz = wp.z - this.position.z;
    const desiredHeading = Math.atan2(dx, dz);

    let angleDiff = desiredHeading - this.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const isApproachingBay = rawDistToTarget < 18;
    const turnRate = isApproachingBay ? 11.5 : Math.abs(angleDiff) > 0.7 ? 7.5 : 4.8;
    this.heading += THREE.MathUtils.clamp(angleDiff, -turnRate * dt, turnRate * dt);

    this.steerAngle = THREE.MathUtils.damp(
      this.steerAngle,
      THREE.MathUtils.clamp(angleDiff, -0.55, 0.55),
      12,
      dt
    );

    const baseRivalMaxSpeed = 16.5 + playerLevelSpeedBonus * 0.65;
    let speedMultiplier = 1.0;
    if (Math.abs(angleDiff) > 0.85) {
      speedMultiplier = 0.35;
    } else if (Math.abs(angleDiff) > 0.4) {
      speedMultiplier = 0.62;
    }
    if (rawDistToTarget < 14) {
      speedMultiplier = Math.min(
        speedMultiplier,
        THREE.MathUtils.clamp(rawDistToTarget / 14, 0.38, 1.0)
      );
    }

    const targetSpeed = baseRivalMaxSpeed * speedMultiplier;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 6, dt);

    // Lean on turns & celebratory wheelie ("grau") on straightaways
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, -this.steerAngle * 0.55, 8, dt);
    const shouldWheelie =
      Math.abs(angleDiff) < 0.12 && this.speed > 13.5 && !isApproachingBay && this.hasStolenPackage;
    this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, shouldWheelie ? 0.48 : 0, 8, dt);

    // Advance position with obstacle collision resolution
    const moveX = Math.sin(this.heading) * this.speed * dt;
    const moveZ = Math.cos(this.heading) * this.speed * dt;
    const rivalRadius = 0.75;

    let nextX = THREE.MathUtils.clamp(this.position.x + moveX, -128, 130);
    let nextZ = THREE.MathUtils.clamp(this.position.z + moveZ, -128, 130);

    for (const box of obstacles) {
      if (
        nextX + rivalRadius > box.minX &&
        nextX - rivalRadius < box.maxX &&
        this.position.z + rivalRadius > box.minZ &&
        this.position.z - rivalRadius < box.maxZ
      ) {
        if (moveX > 0) nextX = box.minX - rivalRadius - 0.05;
        else nextX = box.maxX + rivalRadius + 0.05;
        break;
      }
    }
    this.position.x = nextX;

    for (const box of obstacles) {
      if (
        this.position.x + rivalRadius > box.minX &&
        this.position.x - rivalRadius < box.maxX &&
        nextZ + rivalRadius > box.minZ &&
        nextZ - rivalRadius < box.maxZ
      ) {
        if (moveZ > 0) nextZ = box.minZ - rivalRadius - 0.05;
        else nextZ = box.maxZ + rivalRadius + 0.05;
        break;
      }
    }
    this.position.z = nextZ;

    // Anti-stuck recovery: if blocked by a building corner for > 0.5s, nudge onto nearest avenue
    const movedDist = Math.hypot(
      this.position.x - this.prevPos.x,
      this.position.z - this.prevPos.z
    );
    this.prevPos.copy(this.position);
    if (movedDist < 0.03 * dt * 60) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.45) {
        const nearestVertX = VERTICAL_AVENUES_X.reduce((best, x) =>
          Math.abs(x - this.position.x) < Math.abs(best - this.position.x) ? x : best
        );
        this.position.x = THREE.MathUtils.lerp(this.position.x, nearestVertX, 0.35);
        this.heading = desiredHeading;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    // Check interaction with Player (Bump / Intercept!)
    if (distToPlayer < 2.4) {
      // Push apart slightly so characters/bikes don't overlap
      const pushX = (this.position.x - playerPos.x) / (distToPlayer || 1);
      const pushZ = (this.position.z - playerPos.z) / (distToPlayer || 1);
      this.position.x += pushX * 0.4;
      this.position.z += pushZ * 0.4;

      // Only intercept by ramming when the player is riding a motorcycle (!isPlayerOnFoot).
      // When on foot, the player intercepts via Punch/Push or Hijack [F]!
      if (!isPlayerOnFoot && this.hasStolenPackage && this.stealCooldown <= 0) {
        this.hasStolenPackage = false;
        this.rivalStage = 'to_pickup'; // Rival must go back to restaurant to get another bag!
        this.stealCooldown = 2.5;
        this.speed *= 0.35;
        sound.playCash();
        onPlayerInterceptRival();
      }
    }

    // Check if Rival reached the Restaurant or Customer checkpoint (5.8m radius)
    if (rawDistToTarget < 5.8) {
      if (isHeadingToRestaurant) {
        // Rival arrived at the Restaurant bay and picked up the order!
        this.rivalStage = 'to_deliver';
        this.speed = 3.0;
        if (order.state === 'to_pickup') {
          this.hasStolenPackage = true;
          this.stealCooldown = 2.0;
          onRivalPickup();
        }
      } else if (this.rivalStage === 'to_deliver' && this.stealCooldown <= 0) {
        // Rival arrived at the Customer dropoff bay and completed the delivery!
        this.hasStolenPackage = false;
        this.rivalStage = 'to_pickup';
        this.stealCooldown = 2.0;
        onRivalDeliver();
      }
    }

    // Sync 3D mesh transform
    this.wheelRotation += (this.speed / 0.35) * dt;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = this.leanAngle;
    this.mesh.rotation.x = -this.pitchAngle;
    this.mesh.frontFork.rotation.y = this.steerAngle;
    this.mesh.frontWheel.rotation.x = this.wheelRotation;
    this.mesh.rearWheel.rotation.x = this.wheelRotation;
  }
}
