import * as THREE from 'three';
import { BikeUpgrades, WeatherConfig } from '../types/game';
import { sound } from '../audio/soundEngine';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  wheelie: boolean;
  nitro: boolean;
  horn: boolean;
  analogSteer?: number; // -1 (full right) to +1 (full left)
  gestureActive?: boolean;
  gestureAngle?: number; // Screen-relative angle in radians (0: forward, -PI/2: right, +PI/2: left, PI: backward)
  gestureMagnitude?: number; // 0 to 1
  cameraYaw?: number; // Current camera yaw in radians
  sensitivity?: number; // 0.5 to 2.0 (multiplier)
}

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RespawnLocation {
  x: number;
  z: number;
  heading: number;
  name: string;
}

export const RESPAWN_LOCATIONS: RespawnLocation[] = [
  { x: -70, z: -38, heading: 0, name: 'Pronto-Socorro Central (Centro Comercial)' },
  { x: 50, z: -45, heading: Math.PI, name: 'Alameda Gourmet (Bairro dos Jardins)' },
  { x: -70, z: 62, heading: 0, name: 'Base do Morro do Sol (Quebrada & Ladeiras)' },
  { x: 50, z: 68, heading: Math.PI, name: 'Avenida Beira-Mar (Orla da Praia)' },
  { x: -10, z: -145, heading: Math.PI / 2, name: 'Terminal Norte (Polo Industrial & Porto)' },
  { x: -10, z: 145, heading: -Math.PI / 2, name: 'Paddock VIP (Arena & Autódromo Neon)' },
  { x: 82, z: -12.2, heading: Math.PI / 2, name: 'Entrada da Ponte Estaiada (Rumo à Nova Metrópole)' },
  { x: 290, z: -28, heading: 0, name: 'Avenida das Torres (Nova Metrópole • Outra Cidade)' },
];

export class BikePhysics {
  // Spawn safely in the middle of the main avenue in Centro
  public position = new THREE.Vector3(-70, 0, -25);
  public velocity = new THREE.Vector3(0, 0, 0);
  public heading = 0; // Rotation around Y in radians
  public speed = 0; // Current linear forward speed in m/s

  // Visual angles
  public leanAngle = 0; // Roll when turning
  public pitchAngle = 0; // Wheelie (grau) pitch
  public steerAngle = 0; // Front fork steering angle
  public wheelRotation = 0; // Spin of wheels

  // Wheelie tracking
  public isWheelie = false;
  public wheelieTime = 0;
  public grauCombo = 0;

  // Nitro
  public nitroAvailable = 1.0; // 0.0 to 1.0 (100%)
  public isNitroActive = false;

  // Drift / Slip / Aquaplaning
  public slipAngle = 0;
  public isSkidding = false;
  public isAquaplaning = false;

  // Collision cooldown & Bike Health (0 to 100%) & Fuel (0 to 100%)
  public crashCooldown = 0;
  public bikeHealth = 100;
  public fuel = 100;
  private skidSoundCooldown = 0;

  // On-Foot & Bike Hijacking state
  public isOnFoot = false;
  public parkedBikePosition = new THREE.Vector3(-67.2, 0, -28);
  public parkedBikeHeading = Math.PI;
  public walkCycle = 0;
  public hasHijackedRivalBike = false;

  // Player Life Bar (0 to 100%) & On-Foot Jump / Melee Combat state
  public playerHealth = 100;
  public jumpY = 0;
  public jumpVelY = 0;
  public isJumping = false;
  public meleeAction: 'none' | 'punch' | 'push' = 'none';
  public meleeTimer = 0;
  private lastRespawnIdx = 0;
  private hornCooldown = 0;

  constructor() {}

  public applyDamage(amount: number): number {
    this.bikeHealth = Math.max(0, Math.round(this.bikeHealth - amount));
    return this.bikeHealth;
  }

  public applyPlayerDamage(amount: number): number {
    this.playerHealth = Math.max(0, Math.round(this.playerHealth - amount));
    return this.playerHealth;
  }

  public refuelFull() {
    this.fuel = 100;
  }

  /**
   * Revives the player with 100% Life and 100% Bike Health at a DIFFERENT location in the city
   * far from where the player lost their life!
   */
  public revivePlayerFull(): RespawnLocation {
    this.playerHealth = 100;
    this.bikeHealth = 100;
    this.fuel = 100;

    // Pick a different respawn location that is also far (> 45m) from current death position
    const candidates = RESPAWN_LOCATIONS.map((loc, idx) => ({ loc, idx })).filter(
      item =>
        item.idx !== this.lastRespawnIdx &&
        Math.hypot(item.loc.x - this.position.x, item.loc.z - this.position.z) > 45
    );

    const pool =
      candidates.length > 0
        ? candidates
        : RESPAWN_LOCATIONS.map((loc, idx) => ({ loc, idx })).filter(
            item => item.idx !== this.lastRespawnIdx
          );

    const chosen = pool[Math.floor(Math.random() * pool.length)] || {
      loc: RESPAWN_LOCATIONS[0],
      idx: 0,
    };
    this.lastRespawnIdx = chosen.idx;

    this.teleportTo(chosen.loc.x, chosen.loc.z, chosen.loc.heading);
    this.crashCooldown = 1.5; // Brief spawn protection
    return chosen.loc;
  }

  public triggerJump(): boolean {
    if (!this.isOnFoot || this.isJumping) return false;
    this.isJumping = true;
    this.jumpVelY = 9.2;
    sound.playJump();
    return true;
  }

  public triggerMelee(type: 'punch' | 'push') {
    this.meleeAction = type;
    this.meleeTimer = 0.38;
    if (type === 'punch') {
      sound.playPunch();
    } else {
      sound.playPush();
    }
  }

  public repairFull() {
    this.bikeHealth = 100;
  }


  public resetPosition() {
    this.revivePlayerFull();
  }

  public teleportTo(x: number, z: number, heading: number = 0) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.leanAngle = 0;
    this.pitchAngle = 0;
    this.steerAngle = 0;
    this.isOnFoot = false;
    this.jumpY = 0;
    this.jumpVelY = 0;
    this.isJumping = false;
    this.parkedBikePosition.set(x, 0, z);
    this.parkedBikeHeading = heading;
  }

  /**
   * Forces the player off the motorcycle (e.g., when an armed motorcycle thief ambushes and mounts the bike to flee).
   */
  public forceDismount(stolenPushAway = false) {
    if (this.isOnFoot) return;
    this.isOnFoot = true;
    this.isWheelie = false;
    this.isNitroActive = false;
    this.leanAngle = 0;
    this.pitchAngle = 0;
    this.speed = 0;
    this.parkedBikePosition.copy(this.position);
    this.parkedBikeHeading = this.heading;

    if (stolenPushAway) {
      // Knock player slightly to the side while the bandit mounts the bike at parkedBikePosition and rides off!
      this.position.x += Math.cos(this.heading) * 1.65;
      this.position.z -= Math.sin(this.heading) * 1.65;
    }
  }

  /**
   * Toggles between riding the motorcycle and walking on foot, or hijacking Rival Falcão's motorcycle!
   */
  public toggleMount(
    rivalPos: THREE.Vector3,
    isRivalAvailable: boolean,
    isOwnBikeStolen: boolean = false
  ): 'dismounted' | 'mounted_own' | 'hijacked_rival' | 'too_far_from_bike' {
    if (!this.isOnFoot) {
      // Dismount motorcycle cleanly
      this.isOnFoot = true;
      this.isWheelie = false;
      this.isNitroActive = false;
      this.isSkidding = false;
      this.isAquaplaning = false;
      this.isJumping = false;
      this.jumpY = 0;
      this.jumpVelY = 0;
      this.speed = 0;
      this.velocity.set(0, 0, 0);
      this.leanAngle = 0;
      this.pitchAngle = 0;
      this.steerAngle = 0;
      this.slipAngle = 0;
      // Normalize heading to [-PI, PI]
      this.heading = Math.atan2(Math.sin(this.heading), Math.cos(this.heading));
      this.parkedBikePosition.copy(this.position);
      this.parkedBikePosition.y = 0;
      this.parkedBikeHeading = this.heading;

      // Step 1.35m to the left side of the parked motorcycle
      this.position.x += Math.cos(this.heading) * 1.35;
      this.position.z -= Math.sin(this.heading) * 1.35;
      this.position.y = 0;
      return 'dismounted';
    }

    // Player is currently on foot -> Check if close to Rival Falcão to hijack his bike!
    const distToRival = Math.hypot(
      this.position.x - rivalPos.x,
      this.position.z - rivalPos.z
    );

    if (isRivalAvailable && distToRival < 8.5) {
      this.isOnFoot = false;
      this.hasHijackedRivalBike = true;
      this.position.copy(rivalPos);
      this.position.y = 0;
      this.jumpY = 0;
      this.jumpVelY = 0;
      this.isJumping = false;
      this.parkedBikePosition.copy(rivalPos);
      this.speed = 6;
      this.bikeHealth = 100;
      this.nitroAvailable = 1.0;
      return 'hijacked_rival';
    }

    // Otherwise check if player is close enough to their parked motorcycle (and it isn't currently stolen)
    const distToOwnBike = Math.hypot(
      this.position.x - this.parkedBikePosition.x,
      this.position.z - this.parkedBikePosition.z
    );
    if (!isOwnBikeStolen && distToOwnBike < 75) {
      this.isOnFoot = false;
      this.jumpY = 0;
      this.jumpVelY = 0;
      this.isJumping = false;
      this.position.copy(this.parkedBikePosition);
      this.position.y = 0;
      this.heading = this.parkedBikeHeading;
      this.speed = 0;
      return 'mounted_own';
    }

    // Player is on foot far from their bike (or bike is being ridden away by a thief) -> stay on foot!
    return 'too_far_from_bike';
  }

  public update(
    dt: number,
    inputs: InputState,
    upgrades: BikeUpgrades,
    weather: WeatherConfig,
    obstacles: CollisionBox[],
    onGrauScore?: (points: number, combo: number) => void,
    onCrash?: () => void,
    isSheltered: boolean = false
  ) {
    if (this.crashCooldown > 0) {
      this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    }
    if (this.meleeTimer > 0) {
      this.meleeTimer = Math.max(0, this.meleeTimer - dt);
      if (this.meleeTimer <= 0) {
        this.meleeAction = 'none';
      }
    }

    // ON-FOOT CHARACTER MOVEMENT (Walking / Sprinting / Jumping / Punching / Pushing)
    if (this.isOnFoot) {
      this.isWheelie = false;
      this.isNitroActive = false;
      this.isSkidding = false;
      this.isAquaplaning = false;
      this.leanAngle = 0;
      this.pitchAngle = 0;

      // Vertical Jump kinematics
      if (this.isJumping || this.jumpY > 0) {
        this.jumpY += this.jumpVelY * dt;
        this.jumpVelY -= 25 * dt;
        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.jumpVelY = 0;
          this.isJumping = false;
        }
      }
      this.position.y = this.jumpY;

      // Camera-relative walking controls (supports virtual joystick, keyboard WASD/Arrows, and analog fallback)
      const camYaw = inputs.cameraYaw ?? this.heading;
      let hasMoveInput = false;
      let targetHeading = this.heading;
      let walkMagnitude = 0;

      // Check keyboard WASD / Arrows first so keyboard + touch never conflict
      let moveX = 0;
      let moveZ = 0;
      if (inputs.forward) moveZ += 1;
      if (inputs.backward) moveZ -= 1;
      if (inputs.left) moveX -= 1;
      if (inputs.right) moveX += 1;

      if (inputs.gestureActive && (inputs.gestureMagnitude ?? 0) > 0.04) {
        hasMoveInput = true;
        targetHeading = camYaw + (inputs.gestureAngle ?? 0);
        walkMagnitude = THREE.MathUtils.clamp(inputs.gestureMagnitude ?? 1.0, 0.25, 1.0);
      } else if (moveX !== 0 || moveZ !== 0) {
        hasMoveInput = true;
        walkMagnitude = 1.0;
        const localAngle = Math.atan2(-moveX, moveZ);
        targetHeading = camYaw + localAngle;
      } else if (Math.abs(inputs.analogSteer ?? 0) > 0.08) {
        hasMoveInput = true;
        walkMagnitude = Math.min(1.0, Math.abs(inputs.analogSteer ?? 0));
        const localAngle = (inputs.analogSteer ?? 0) > 0 ? Math.PI / 2 : -Math.PI / 2;
        targetHeading = camYaw + localAngle;
      }

      if (hasMoveInput && walkMagnitude > 0.04) {
        const diff = Math.atan2(
          Math.sin(targetHeading - this.heading),
          Math.cos(targetHeading - this.heading)
        );
        const rotSens = inputs.sensitivity ?? 1.0;
        this.heading = Math.atan2(
          Math.sin(this.heading + diff * Math.min(1, 24 * dt * rotSens)),
          Math.cos(this.heading + diff * Math.min(1, 24 * dt * rotSens))
        );

        const isSprint = inputs.nitro || walkMagnitude > 0.72;
        const maxWalkSpeed = (isSprint ? 10.4 : 6.4) * THREE.MathUtils.clamp(walkMagnitude, 0.35, 1.0);
        this.speed = THREE.MathUtils.damp(this.speed, maxWalkSpeed, 20, dt);
      } else {
        this.speed = THREE.MathUtils.damp(this.speed, 0, 28, dt);
        if (Math.abs(this.speed) < 0.05) {
          this.speed = 0;
        }
      }

      if (Math.abs(this.speed) > 0.2) {
        this.walkCycle += dt * Math.abs(this.speed) * 1.55;
      }

      // Move directly along targetHeading when input is active so response is 100% immediate!
      const moveDir = hasMoveInput ? targetHeading : this.heading;
      const stepX = Math.sin(moveDir) * this.speed * dt;
      const stepZ = Math.cos(moveDir) * this.speed * dt;
      const footRadius = 0.45;

      let nextX = THREE.MathUtils.clamp(this.position.x + stepX, -2500, 2500);
      let nextZ = THREE.MathUtils.clamp(this.position.z + stepZ, -2500, 2500);

      for (const box of obstacles) {
        const wasInside =
          this.position.x + footRadius > box.minX &&
          this.position.x - footRadius < box.maxX &&
          this.position.z + footRadius > box.minZ &&
          this.position.z - footRadius < box.maxZ;
        if (wasInside) continue; // Allow player to walk freely out if dismounted near an edge

        if (
          nextX + footRadius > box.minX &&
          nextX - footRadius < box.maxX &&
          this.position.z + footRadius > box.minZ &&
          this.position.z - footRadius < box.maxZ
        ) {
          nextX = this.position.x;
          break;
        }
      }
      this.position.x = nextX;

      for (const box of obstacles) {
        const wasInside =
          this.position.x + footRadius > box.minX &&
          this.position.x - footRadius < box.maxX &&
          this.position.z + footRadius > box.minZ &&
          this.position.z - footRadius < box.maxZ;
        if (wasInside) continue;

        if (
          this.position.x + footRadius > box.minX &&
          this.position.x - footRadius < box.maxX &&
          nextZ + footRadius > box.minZ &&
          nextZ - footRadius < box.maxZ
        ) {
          nextZ = this.position.z;
          break;
        }
      }
      this.position.z = nextZ;

      sound.updateEngine(0, false, false);
      return;
    }

    this.jumpY = 0;
    this.jumpVelY = 0;
    this.isJumping = false;
    this.position.y = 0;

    // 1. Calculate stats based on upgrades, mechanical health & fuel (plus bonus if riding Rival's Hijacked Bike!)
    if (this.skidSoundCooldown > 0) {
      this.skidSoundCooldown = Math.max(0, this.skidSoundCooldown - dt);
    }
    const healthPerfFactor =
      this.bikeHealth < 25 ? 0.65 : this.bikeHealth < 55 ? 0.84 : 1.0;
    const fuelPerfFactor = this.fuel <= 0 ? 0.28 : this.fuel < 15 ? 0.78 : 1.0;
    const hijackBonus = this.hasHijackedRivalBike ? 4.0 : 0;
    const baseTopSpeed =
      (18 + upgrades.engineLevel * 4.5 + hijackBonus) * healthPerfFactor * fuelPerfFactor;
    const nitroBoostFactor = upgrades.nitroUnlocked ? 1.62 : 1.48;
    const nitroSpeedMultiplier = this.isNitroActive ? nitroBoostFactor : 1.0;
    const maxSpeed = baseTopSpeed * nitroSpeedMultiplier;

    const baseAccel =
      (11 + upgrades.accelerationLevel * 3.0 + hijackBonus * 0.6) *
      healthPerfFactor *
      fuelPerfFactor;
    const accel = baseAccel * (this.isNitroActive ? 1.85 : 1.0);

    const brakePower = 16 + upgrades.brakesLevel * 3.5;

    const tireGripBonus = (upgrades.tiresLevel - 1) * 0.1;
    let baseGrip = weather.gripMultiplier;

    // Severe Storm & Sheltered Physics
    const isSevereStorm = weather.id === 'severe_storm';
    if (isSheltered) {
      // Under a canopy/viaduct: completely dry asphalt, zero aquaplaning!
      baseGrip = 1.0;
      this.isAquaplaning = false;
    } else if (isSevereStorm) {
      // Open torrential downpour: if speed exceeds 30 km/h (~8.5 m/s), aquaplaning occurs!
      if (Math.abs(this.speed) > 8.5) {
        this.isAquaplaning = true;
        baseGrip = 0.12 + (upgrades.tiresLevel - 1) * 0.035;
      } else {
        // Crawling speed allows tire grooves to disperse floodwater safely
        this.isAquaplaning = false;
        baseGrip = 0.55 + (upgrades.tiresLevel - 1) * 0.08;
      }
    } else {
      this.isAquaplaning = false;
    }

    const effectiveGrip = Math.min(1.0, isSheltered ? 1.0 : baseGrip + (isSevereStorm && this.isAquaplaning ? 0 : tireGripBonus));

    // 2. Nitro Handling (Available on all deliveries; Shop Nitro Pro upgrade extends duration & boost!)
    if (inputs.nitro && this.nitroAvailable >= 0.18 && !this.isNitroActive && this.fuel > 0) {
      this.isNitroActive = true;
      sound.playNitro();
    }
    if (this.isNitroActive) {
      const drainRate = upgrades.nitroUnlocked || this.hasHijackedRivalBike ? 0.25 : 0.34;
      this.nitroAvailable -= dt * drainRate;
      if (this.nitroAvailable <= 0 || this.fuel <= 0) {
        this.nitroAvailable = Math.max(0, this.nitroAvailable);
        this.isNitroActive = false;
      } else if (!inputs.nitro && this.nitroAvailable < 0.72) {
        this.isNitroActive = false;
      }
    } else {
      const rechargeRate = upgrades.nitroUnlocked ? 0.18 : 0.14;
      this.nitroAvailable = Math.min(1.0, this.nitroAvailable + dt * rechargeRate);
    }

    // Consume fuel gradually when riding/accelerating
    if (inputs.forward || this.isNitroActive || Math.abs(this.speed) > 1.0) {
      const fuelBurnRate = this.isNitroActive ? 0.95 : inputs.forward ? 0.32 : 0.08;
      this.fuel = Math.max(0, this.fuel - dt * fuelBurnRate);
    }

    // 3. Progressive Acceleration & Braking Skid (Derrapagem no Freio)
    if (inputs.forward || this.isNitroActive) {
      const speedNorm = Math.min(1, Math.abs(this.speed) / Math.max(10, baseTopSpeed));
      // Progressive torque curve: smooth initial pull, strong mid-range, tapering near redline
      const progressiveCurve = 0.72 + Math.sin(speedNorm * Math.PI) * 0.38;
      this.speed += accel * progressiveCurve * dt * (0.65 + effectiveGrip * 0.35);
      if (this.speed > maxSpeed) {
        this.speed = THREE.MathUtils.damp(this.speed, maxSpeed, 4, dt);
      }
      if (!this.isAquaplaning && effectiveGrip >= 0.75) {
        this.isSkidding = false;
      }
    } else if (inputs.backward) {
      if (this.speed > 0.5) {
        this.speed -= brakePower * dt;
        // Trigger braking skid / drift when braking hard from moderate/high speed
        if (this.speed > 6.5) {
          this.isSkidding = true;
          if (this.skidSoundCooldown <= 0) {
            sound.playSkid();
            this.skidSoundCooldown = 0.22;
          }
        } else {
          this.isSkidding = false;
        }
      } else {
        // Reverse
        this.isSkidding = false;
        this.speed = Math.max(-7, this.speed - accel * 0.65 * dt);
      }
    } else {
      // Rolling resistance & engine drag
      const drag = 4.0;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - drag * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + drag * dt);
      }
      if (!this.isAquaplaning && effectiveGrip >= 0.75) {
        this.isSkidding = false;
      }
    }

    // 4. Smooth Steering & Leaning with Adjustable Sensitivity
    const sensMultiplier = inputs.sensitivity ?? 1.0;
    const turnSensitivity =
      (2.35 - (Math.min(Math.abs(this.speed), 26) / 26) * 0.72) *
      (effectiveGrip * 0.82 + 0.18) *
      sensMultiplier;
    let targetSteer = 0;
    if (inputs.analogSteer !== undefined && Math.abs(inputs.analogSteer) > 0.04) {
      targetSteer = THREE.MathUtils.clamp(inputs.analogSteer, -1, 1);
    } else {
      if (inputs.left) targetSteer += 1;
      if (inputs.right) targetSteer -= 1;
    }

    // Smooth steering damping
    this.steerAngle = THREE.MathUtils.damp(
      this.steerAngle,
      targetSteer * 0.62,
      11.5 * Math.sqrt(sensMultiplier),
      dt
    );

    // Allow steering both while moving and pivoting at low speed
    if (Math.abs(this.speed) > 0.2) {
      const turnDirection = this.speed >= 0 ? 1 : -1;
      const skidYawBoost = this.isSkidding && inputs.backward ? 1.28 : 1.0;
      this.heading += this.steerAngle * turnSensitivity * skidYawBoost * turnDirection * dt;
    } else if (Math.abs(targetSteer) > 0.05) {
      // Pivot handlebars / turn in place slowly
      this.heading += this.steerAngle * 1.4 * dt;
    }

    // Lean angle (roll) physics: leans into corners proportionally to speed and steering
    const speedLeanFactor = Math.min(Math.abs(this.speed), 24) / 24;
    const skidExtraLean = this.isSkidding ? -this.steerAngle * 0.18 : 0;
    const targetLean = -this.steerAngle * speedLeanFactor * 0.72 + skidExtraLean;
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 9.5, dt);

    // Slipping / drift on braking skid, wet weather, or aquaplaning in severe storm
    if (this.isAquaplaning) {
      // Extreme loss of lateral traction during aquaplaning
      this.slipAngle = THREE.MathUtils.damp(this.slipAngle, -this.steerAngle * 0.85, 4.5, dt);
      if (Math.abs(this.steerAngle) > 0.12 || this.speed > 13) {
        // Fishtailing / rear wheel sliding out sideways
        this.heading += this.slipAngle * 1.35 * dt;
        if (!this.isSkidding) {
          this.isSkidding = true;
          if (this.skidSoundCooldown <= 0) {
            sound.playSkid();
            this.skidSoundCooldown = 0.22;
          }
        }
      }
    } else if (inputs.backward && this.speed > 6.5) {
      // Rear wheel drift when braking hard into a turn
      const brakeDriftTarget =
        Math.abs(this.steerAngle) > 0.08
          ? -this.steerAngle * 0.55
          : Math.sin(this.wheelRotation * 0.5) * 0.08;
      this.slipAngle = THREE.MathUtils.damp(this.slipAngle, brakeDriftTarget, 7.5, dt);
    } else if (effectiveGrip < 0.8 && Math.abs(this.steerAngle) > 0.3 && this.speed > 10) {
      this.slipAngle = THREE.MathUtils.damp(this.slipAngle, -this.steerAngle * 0.45, 6, dt);
      if (!this.isSkidding) {
        this.isSkidding = true;
        if (this.skidSoundCooldown <= 0) {
          sound.playSkid();
          this.skidSoundCooldown = 0.22;
        }
      }
    } else {
      this.slipAngle = THREE.MathUtils.damp(this.slipAngle, 0, 6, dt);
      if (!inputs.backward) {
        this.isSkidding = false;
      }
    }


    // 5. "DAR GRAU" (Wheelie) Physics & Scoring
    if (inputs.wheelie && this.speed > 2) {
      this.isWheelie = true;
      this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, 0.65, 8, dt);
      this.wheelieTime += dt;

      if (this.wheelieTime > 0.3) {
        const points = Math.max(1, Math.round(dt * 35));
        this.grauCombo += dt * 1.5;
        if (onGrauScore) {
          onGrauScore(points, Math.floor(this.grauCombo) + 1);
        }
      }
    } else {
      this.isWheelie = false;
      this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, 0, 10, dt);
      this.wheelieTime = 0;
      this.grauCombo = 0;
    }

    // 6. Update position with sub-stepped sliding collision resolution (prevents high-speed tunneling through trees/poles)
    const effectiveHeading = this.heading + this.slipAngle;
    const totalMoveX = Math.sin(effectiveHeading) * this.speed * dt;
    const totalMoveZ = Math.cos(effectiveHeading) * this.speed * dt;
    const totalDist = Math.hypot(totalMoveX, totalMoveZ);
    const subSteps = Math.max(1, Math.ceil(totalDist / 0.45));
    const stepX = totalMoveX / subSteps;
    const stepZ = totalMoveZ / subSteps;

    const bikeRadius = 0.85;
    let hitObstacle = false;

    for (let s = 0; s < subSteps; s++) {
      let nextX = THREE.MathUtils.clamp(this.position.x + stepX, -2500, 2500);
      let nextZ = THREE.MathUtils.clamp(this.position.z + stepZ, -2500, 2500);

      // Resolve X axis against obstacles
      for (const box of obstacles) {
        if (
          nextX + bikeRadius > box.minX &&
          nextX - bikeRadius < box.maxX &&
          this.position.z + bikeRadius > box.minZ &&
          this.position.z - bikeRadius < box.maxZ
        ) {
          hitObstacle = true;
          if (stepX > 0) {
            nextX = box.minX - bikeRadius - 0.02;
          } else if (stepX < 0) {
            nextX = box.maxX + bikeRadius + 0.02;
          }
          break;
        }
      }
      this.position.x = nextX;

      // Resolve Z axis against obstacles
      for (const box of obstacles) {
        if (
          this.position.x + bikeRadius > box.minX &&
          this.position.x - bikeRadius < box.maxX &&
          nextZ + bikeRadius > box.minZ &&
          nextZ - bikeRadius < box.maxZ
        ) {
          hitObstacle = true;
          if (stepZ > 0) {
            nextZ = box.minZ - bikeRadius - 0.02;
          } else if (stepZ < 0) {
            nextZ = box.maxZ + bikeRadius + 0.02;
          }
          break;
        }
      }
      this.position.z = nextZ;

      // Safety push-out if overlapping any obstacle
      for (const box of obstacles) {
        if (
          this.position.x + bikeRadius > box.minX &&
          this.position.x - bikeRadius < box.maxX &&
          this.position.z + bikeRadius > box.minZ &&
          this.position.z - bikeRadius < box.maxZ
        ) {
          hitObstacle = true;
          const penLeft = Math.abs(this.position.x + bikeRadius - box.minX);
          const penRight = Math.abs(box.maxX - (this.position.x - bikeRadius));
          const penBottom = Math.abs(this.position.z + bikeRadius - box.minZ);
          const penTop = Math.abs(box.maxZ - (this.position.z - bikeRadius));
          const minPen = Math.min(penLeft, penRight, penBottom, penTop);

          if (minPen === penLeft) this.position.x = box.minX - bikeRadius - 0.05;
          else if (minPen === penRight) this.position.x = maxXPush(box.maxX, bikeRadius);
          else if (minPen === penBottom) this.position.z = box.minZ - bikeRadius - 0.05;
          else this.position.z = box.maxZ + bikeRadius + 0.05;
        }
      }
    }

    if (hitObstacle && Math.abs(this.speed) > 5) {
      this.speed *= 0.65;
      if (this.crashCooldown <= 0) {
        this.crashCooldown = 0.45;
        sound.playCrash();
        if (onCrash) onCrash();
      }
    }

    // 7. Wheels rotation spin
    this.wheelRotation += (this.speed / 0.35) * dt;

    // 8. Audio update
    const speedRatio = Math.abs(this.speed) / maxSpeed;
    sound.updateEngine(speedRatio, inputs.forward, this.isWheelie);

    if (this.hornCooldown > 0) {
      this.hornCooldown -= dt;
    }

    if (inputs.horn && this.hornCooldown <= 0) {
      sound.playHorn();
      this.hornCooldown = 0.65;
    }
  }

  public getSpeedKmH(): number {
    return Math.abs(Math.round(this.speed * 3.6));
  }
}

function maxXPush(maxX: number, radius: number): number {
  return maxX + radius + 0.05;
}

