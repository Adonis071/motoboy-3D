import * as THREE from 'three';
import { ArmedBanditGroup, createArmedBandit } from './proceduralModels';
import { sound } from '../audio/soundEngine';

interface BanditAgent {
  mesh: ArmedBanditGroup;
  position: THREE.Vector3;
  patrolOrigin: THREE.Vector3;
  heading: number;
  health: number;
  state: 'patrol' | 'announcing_and_chasing_bike' | 'fleeing_on_bike' | 'ko';
  fleeTimer: number;
  knockdownTimer: number;
  shotCooldown: number;
  threatCooldown: number;
  muzzleTimer: number;
  walkPhase: number;
}

const BANDIT_HOTSPOTS: Array<{ x: number; z: number }> = [
  { x: -64, z: -5 },    // Centro Comercial
  { x: -16, z: 32 },    // Acesso Morro da Ladeira
  { x: 44, z: -35 },    // Jardins
  { x: 44, z: 65 },     // Orla
  { x: -16, z: -135 },  // Polo Industrial
  { x: -16, z: 135 },   // Arena & Autódromo
];

export class BanditManager {
  public bandits: BanditAgent[] = [];
  public nearestBanditDistM = 999;

  constructor(scene: THREE.Scene) {
    BANDIT_HOTSPOTS.forEach((spot, idx) => {
      const mesh = createArmedBandit();
      const pos = new THREE.Vector3(spot.x, 0, spot.z);
      mesh.position.copy(pos);
      scene.add(mesh);

      this.bandits.push({
        mesh,
        position: pos,
        patrolOrigin: pos.clone(),
        heading: (idx * Math.PI) / 2,
        health: 100,
        state: 'patrol',
        fleeTimer: 0,
        knockdownTimer: 0,
        shotCooldown: 2.0,
        threatCooldown: 0,
        muzzleTimer: 0,
        walkPhase: idx * 1.3,
      });
    });
  }

  public setVisible(visible: boolean) {
    for (const b of this.bandits) {
      b.mesh.visible = visible;
    }
  }

  public get isRidingPlayerBike(): boolean {
    return this.bandits.some(b => b.state === 'fleeing_on_bike');
  }

  /**
   * If player uses Xingamento / Taunt near a bandit (< 13m), it intimidates or delays the bandit!
   */
  public onPlayerTaunt(playerPos: THREE.Vector3): boolean {
    let affected = false;
    for (const b of this.bandits) {
      if (b.state === 'ko') continue;
      const dist = Math.hypot(b.position.x - playerPos.x, b.position.z - playerPos.z);
      if (dist < 13) {
        b.shotCooldown = 3.5;
        b.mesh.updateOverheadHud('😠 LADRÃO INTIMIDADO!', b.health);
        affected = true;
      }
    }
    return affected;
  }

  /**
   * Player On-Foot Melee Attack (Punch 🥊 or Push 👐) against nearby Armed Bandits!
   * Reduces bandit's Life bar; if Life reaches 0%, Bandit suffers total KO/Lose!
   * If Bandit was fleeing on player's stolen bike, knocks him off the bike!
   */
  public applyMeleeHit(
    playerPos: THREE.Vector3,
    damage: number,
    isPush: boolean
  ): { hit: boolean; defeated: boolean; knockedOffStolenBike: boolean } {
    let hit = false;
    let defeated = false;
    let knockedOffStolenBike = false;

    for (const b of this.bandits) {
      if (b.state === 'ko') continue;
      const dx = b.position.x - playerPos.x;
      const dz = b.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 3.6) {
        hit = true;
        b.health = Math.max(0, b.health - damage);
        b.shotCooldown = 3.2;

        if (b.state === 'fleeing_on_bike') {
          b.state = 'announcing_and_chasing_bike';
          b.fleeTimer = 0;
          knockedOffStolenBike = true;
        }

        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        b.position.x += nx * (isPush ? 2.2 : 0.85);
        b.position.z += nz * (isPush ? 2.2 : 0.85);

        if (b.health <= 0) {
          defeated = true;
          b.state = 'ko';
          b.knockdownTimer = 22.0;
          b.mesh.updateOverheadHud('🔫 LADRÃO DERROTADO', 0);
        } else {
          b.mesh.updateOverheadHud(
            isPush ? '💫 LADRÃO EMPURRADO!' : '🥊 LADRÃO ATINGIDO!',
            b.health
          );
        }
      }
    }

    return { hit, defeated, knockedOffStolenBike };
  }

  public applySpecialExecution(playerPos: THREE.Vector3): { executed: boolean; knockedOffStolenBike: boolean } {
    let executed = false;
    let knockedOffStolenBike = false;
    for (const b of this.bandits) {
      if (b.state === 'ko') continue;
      const dist = Math.hypot(b.position.x - playerPos.x, b.position.z - playerPos.z);
      if (dist < 5.5) {
        executed = true;
        const wasFleeingOnBike = b.state === 'fleeing_on_bike';
        b.health = 0;
        b.state = 'ko';
        b.knockdownTimer = 35.0;
        if (wasFleeingOnBike) {
          knockedOffStolenBike = true;
        }
        b.mesh.updateOverheadHud('⚡ FATALITY! LADRÃO ELIMINADO!', 0);
        sound.playCash();
      }
    }
    return { executed, knockedOffStolenBike };
  }

  /**
   * Triggered when the player calls 190 Police on their smartphone!
   * Dispatches tactical police intervention to arrest any bandit riding the player's stolen bike
   * or threatening nearby, recovering the motorcycle immediately.
   */
  public recoverBikeByPolice(playerPos: THREE.Vector3): {
    hadStolenBike: boolean;
    interceptPos: THREE.Vector3;
    neutralizedCount: number;
  } {
    let hadStolenBike = false;
    let neutralizedCount = 0;
    const interceptPos = playerPos.clone();

    for (const b of this.bandits) {
      if (b.state === 'ko') continue;
      const dist = Math.hypot(b.position.x - playerPos.x, b.position.z - playerPos.z);
      const isThief =
        b.state === 'fleeing_on_bike' ||
        b.state === 'announcing_and_chasing_bike' ||
        dist < 55;

      if (isThief) {
        if (b.state === 'fleeing_on_bike') {
          hadStolenBike = true;
          interceptPos.copy(b.position);
        } else if (!hadStolenBike && neutralizedCount === 0) {
          interceptPos.copy(b.position);
        }
        b.state = 'ko';
        b.health = 0;
        b.fleeTimer = 0;
        b.knockdownTimer = 32.0;
        b.mesh.position.y = 0.22;
        b.mesh.updateOverheadHud('🚓 PRESO PELA POLÍCIA (190)!', 0);
        neutralizedCount++;
      }
    }

    return { hadStolenBike, interceptPos, neutralizedCount };
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    bikePos: THREE.Vector3,
    onUpdateStolenBikeTransform: (x: number, z: number, heading: number) => void,
    playerSpeedKmH: number,
    isPlayerOnFoot: boolean,
    isCareerMode: boolean,
    onBanditThreatAlert: () => void,
    onBanditShotPlayer: (damage: number) => void,
    onBanditStealPlayerBike: (banditPos: THREE.Vector3) => void,
    onBanditNeutralized: (rewardCoins: number) => void
  ) {
    this.setVisible(isCareerMode);
    if (!isCareerMode) {
      this.nearestBanditDistM = 999;
      return;
    }

    let minDist = 999;

    for (const b of this.bandits) {
      if (b.shotCooldown > 0) b.shotCooldown = Math.max(0, b.shotCooldown - dt);
      if (b.threatCooldown > 0) b.threatCooldown = Math.max(0, b.threatCooldown - dt);

      // Muzzle flash fade
      if (b.muzzleTimer > 0) {
        b.muzzleTimer = Math.max(0, b.muzzleTimer - dt);
        (b.mesh.muzzleFlash.material as THREE.MeshBasicMaterial).opacity =
          b.muzzleTimer > 0 ? 0.95 : 0;
        b.mesh.muzzleFlash.scale.setScalar(1 + Math.random() * 0.6);
      }

      // 1. KO / Defeated state (0% Life)
      if (b.state === 'ko' || b.knockdownTimer > 0) {
        b.knockdownTimer = Math.max(0, b.knockdownTimer - dt);
        b.mesh.rotation.x = THREE.MathUtils.damp(b.mesh.rotation.x, -Math.PI / 2.2, 10, dt);
        b.mesh.position.y = 0.22;
        b.mesh.updateOverheadHud('🔫 LADRÃO DERROTADO', 0);
        if (b.knockdownTimer <= 0) {
          b.health = 100;
          b.state = 'patrol';
          b.mesh.rotation.x = 0;
          b.mesh.position.y = 0;
          b.position.copy(b.patrolOrigin);
          b.mesh.position.copy(b.position);
          b.mesh.updateOverheadHud('🔫 LADRÃO DE MOTO', 100);
        }
        continue;
      }

      // 2. Bandit Mounted on Player's Bike and Fleeing Down the Street!
      if (b.state === 'fleeing_on_bike') {
        b.fleeTimer = Math.max(0, b.fleeTimer - dt);
        const fleeSpeed = 7.6; // Slow enough that a sprinting/jumping player can catch and punch/push him!
        b.position.x = THREE.MathUtils.clamp(
          b.position.x + Math.sin(b.heading) * fleeSpeed * dt,
          -125,
          125
        );
        b.position.z = THREE.MathUtils.clamp(
          b.position.z + Math.cos(b.heading) * fleeSpeed * dt,
          -175,
          175
        );
        b.mesh.position.set(b.position.x, 0.28, b.position.z);
        b.mesh.rotation.y = b.heading;
        b.mesh.leftLeg.rotation.x = 0.45;
        b.mesh.rightLeg.rotation.x = 0.45;
        b.mesh.updateOverheadHud('🏍️ FUGINDO NA SUA MOTO! EMPURRE/SOQUE!', b.health);

        // Move the player's stolen motorcycle along with the bandit!
        onUpdateStolenBikeTransform(b.position.x, b.position.z, b.heading);

        const distToPlayer = Math.hypot(playerPos.x - b.position.x, playerPos.z - b.position.z);
        if (distToPlayer < minDist) minDist = distToPlayer;

        if (b.fleeTimer <= 0) {
          // Bandit abandons the bike and returns to patrol
          b.state = 'patrol';
          b.mesh.position.y = 0;
        }
        continue;
      }

      const dxPlayer = playerPos.x - b.position.x;
      const dzPlayer = playerPos.z - b.position.z;
      const distToPlayer = Math.hypot(dxPlayer, dzPlayer);
      if (distToPlayer < minDist) minDist = distToPlayer;

      // Target the motorcycle position so the thief only tries to steal an available motorcycle!
      const isBikeAlreadyStolen = this.isRidingPlayerBike;
      const targetBikeX = isPlayerOnFoot ? bikePos.x : playerPos.x;
      const targetBikeZ = isPlayerOnFoot ? bikePos.z : playerPos.z;
      const dxBike = targetBikeX - b.position.x;
      const dzBike = targetBikeZ - b.position.z;
      const distToBike = Math.hypot(dxBike, dzBike);

      // Can this bandit attempt a motorcycle theft?
      // - If player is riding a motorcycle (!isPlayerOnFoot) and within 26m
      // - Or if player is on foot, the parked motorcycle is NOT already stolen, and the parked bike is within 22m of the bandit
      const canStealMotorcycle =
        !isBikeAlreadyStolen &&
        ((!isPlayerOnFoot && distToBike < 26) || (isPlayerOnFoot && distToBike < 22));

      if (canStealMotorcycle) {
        b.state = 'announcing_and_chasing_bike';
        b.heading = Math.atan2(dxBike, dzBike);
        b.mesh.rotation.y = b.heading;

        // Announce the robbery only when player is riding or right next to the bike!
        if (distToBike < 20 && distToPlayer < 22 && b.threatCooldown <= 0) {
          b.threatCooldown = 8.5;
          sound.playBanditThreat();
          onBanditThreatAlert();
        }

        b.mesh.updateOverheadHud(
          isPlayerOnFoot
            ? '📢 INDO ROUBAR SUA MOTO ESTACIONADA!'
            : '📢 "PASSA A MOTO!" (INDO SUBIR)',
          b.health
        );

        // Run toward the motorcycle to mount it!
        if (distToBike > 1.8 && (isPlayerOnFoot || playerSpeedKmH < 42)) {
          const runSpeed = 4.8;
          b.position.x += Math.sin(b.heading) * runSpeed * dt;
          b.position.z += Math.cos(b.heading) * runSpeed * dt;
          b.walkPhase += dt * 11;
          const swing = Math.sin(b.walkPhase) * 0.65;
          b.mesh.leftLeg.rotation.x = swing;
          b.mesh.rightLeg.rotation.x = -swing;
          b.mesh.leftArm.rotation.x = -swing * 0.55;
        }

        // Fire warning/attack shot ONLY if player is riding a motorcycle at medium distance
        if (!isPlayerOnFoot && distToPlayer < 14 && distToPlayer > 3.4 && b.shotCooldown <= 0) {
          b.shotCooldown = 2.9;
          b.muzzleTimer = 0.14;
          (b.mesh.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1;
          sound.playGunshot();
          onBanditShotPlayer(10);
        }

        // Close range contact with the motorcycle (< 3.3m)
        if (distToBike < 3.3) {
          if (!isPlayerOnFoot && playerSpeedKmH >= 32) {
            // Player rammed the armed thief at high speed -> Instant KO (0% Life) + Reward!
            b.health = 0;
            b.state = 'ko';
            b.knockdownTimer = 20.0;
            b.mesh.updateOverheadHud('🔫 LADRÃO DERROTADO', 0);
            sound.playCrash();
            sound.playCash();
            onBanditNeutralized(40);
          } else if (isPlayerOnFoot || playerSpeedKmH < 24) {
            // Bandit reaches the slow/parked motorcycle -> Mounts the bike and flees!
            b.state = 'fleeing_on_bike';
            b.fleeTimer = 14.0;
            b.shotCooldown = 5.0;
            sound.playBanditThreat();
            onBanditStealPlayerBike(b.position);
          }
        }
      } else {
        // Player is on foot without a bike nearby (or far away) -> Bandit stays on patrol and recognizes player has no bike
        b.state = 'patrol';
        if (isPlayerOnFoot && distToPlayer < 18) {
          b.mesh.updateOverheadHud('🔫 LADRÃO: "TÁ A PÉ SEM MOTO!"', b.health);
        } else {
          b.mesh.updateOverheadHud('🔫 LADRÃO DE MOTO', b.health);
        }
        b.walkPhase += dt * 3.5;
        b.position.x = b.patrolOrigin.x + Math.sin(b.walkPhase * 0.4) * 2.2;
        b.position.z = b.patrolOrigin.z + Math.cos(b.walkPhase * 0.4) * 2.2;
        b.heading = Math.atan2(
          Math.cos(b.walkPhase * 0.4),
          -Math.sin(b.walkPhase * 0.4)
        );
        b.mesh.rotation.y = b.heading;
        const swing = Math.sin(b.walkPhase) * 0.3;
        b.mesh.leftLeg.rotation.x = swing;
        b.mesh.rightLeg.rotation.x = -swing;
      }

      b.mesh.position.x = b.position.x;
      b.mesh.position.y = 0;
      b.mesh.position.z = b.position.z;
    }

    this.nearestBanditDistM = Math.round(minDist * 8);
  }
}

