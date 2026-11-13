import * as THREE from 'three';
import {
  createTrafficCar,
  createTrafficGuard,
  createPoliceOfficer,
  VehicleArchetype,
  TrafficGuardGroup,
  PoliceOfficerGroup,
} from './proceduralModels';
import {
  VERTICAL_AVENUES_X,
  HORIZONTAL_AVENUES_Z,
  getTrafficSignalPhases,
} from './cityEnvironment';
import { sound } from '../audio/soundEngine';
import { DistrictId, TimeShift } from '../types/game';
import { CITY_SHELTERS } from './shelters';

export const DISTRICT_TRAFFIC_CONFIG: Record<DistrictId, { density: number; speedFactor: number }> = {
  centro: { density: 1.35, speedFactor: 0.90 },
  jardins: { density: 1.15, speedFactor: 0.95 },
  favela: { density: 0.80, speedFactor: 0.85 },
  orla: { density: 1.20, speedFactor: 1.05 },
  industrial: { density: 1.40, speedFactor: 0.80 },
  autodromo: { density: 0.70, speedFactor: 1.20 },
  nova_cidade: { density: 1.25, speedFactor: 1.10 },
};

export const TIME_TRAFFIC_CONFIG: Record<TimeShift, { density: number; speedFactor: number }> = {
  manha: { density: 1.25, speedFactor: 0.90 },
  tarde: { density: 1.00, speedFactor: 1.00 },
  entardecer: { density: 1.30, speedFactor: 0.85 },
  noite: { density: 0.75, speedFactor: 1.10 },
};

export interface TrafficVehicle {
  id: number;
  group: THREE.Group;
  isPolice: boolean;
  isBus: boolean;
  isJamExtra: boolean;
  laneTier: 'inner' | 'outer';
  busStopTimer: number;
  busStopCooldown: number;
  chaseHitCooldown: number;
  hornCooldown: number;
  honkReactionTimer: number;
  honkReactionDir: number;
  lateralOffset: number;
  targetSpeed: number;
  currentSpeed: number;
  direction: 'x_pos' | 'x_neg' | 'z_pos' | 'z_neg';
  minCoord: number;
  maxCoord: number;
  laneCoord: number;
  avenueCenter: number;
  turnCooldown: number;
}

export interface TrafficGuardAgent {
  mesh: TrafficGuardGroup;
  position: THREE.Vector3;
  health: number;
  koTimer: number;
  fineCooldown: number;
  phaseOffset: number;
}

export interface PoliceOfficerAgent {
  vehicleId: number;
  mesh: PoliceOfficerGroup;
  position: THREE.Vector3;
  heading: number;
  active: boolean;
  health: number;
  koTimer: number;
  walkPhase: number;
}

const GUARD_POSTS: Array<{ x: number; z: number; rotY: number }> = [
  { x: -62.2, z: -62.2, rotY: -Math.PI / 4 },
  { x: -2.2, z: -62.2, rotY: -Math.PI / 4 },
  { x: -62.2, z: -7.2, rotY: -Math.PI / 4 },
  { x: -2.2, z: -7.2, rotY: -Math.PI / 4 },
  { x: 57.8, z: -7.2, rotY: -Math.PI / 4 },
  { x: -2.2, z: 52.8, rotY: -Math.PI / 4 },
];

const BUS_STOPS = CITY_SHELTERS.filter(s => s.type === 'bus_stop');

export class TrafficManager {
  public vehicles: TrafficVehicle[] = [];
  public guards: TrafficGuardAgent[] = [];
  public officers: PoliceOfficerAgent[] = [];
  public wantedTimer = 0;
  public policeAssistTimer = 0;
  private assistVehicleId: number | null = null;
  private assistTargetPos = new THREE.Vector3();
  private sirenTimer = 0;
  private isLowMode = false;

  private carColors = [
    0x3b82f6,
    0xef4444,
    0x10b981,
    0xf59e0b,
    0xf8fafc,
    0x334155,
    0x8b5cf6,
    0x06b6d4,
  ];
  private archetypes: VehicleArchetype[] = [
    'bus',
    'sedan',
    'police',
    'taxi',
    'suv',
    'bus',
    'pickup',
    'van',
  ];

  constructor(scene: THREE.Scene, performanceMode: 'low' | 'high' = 'high') {
    this.isLowMode = performanceMode === 'low';
    this.spawnTraffic(scene, performanceMode);
    this.spawnTrafficGuards(scene);
  }

  public get hasOfficersChasingOnFoot(): boolean {
    return this.wantedTimer > 0 && this.officers.some(o => o.active && o.koTimer <= 0);
  }

  public clearWanted() {
    this.wantedTimer = 0;
    for (const o of this.officers) {
      if (o.vehicleId === this.assistVehicleId && this.policeAssistTimer > 0) continue;
      o.active = false;
      o.mesh.visible = false;
    }
  }

  /**
   * Dispatches a 3D Police Cruiser + Officer right to the player's location when calling 190!
   */
  public dispatchPoliceRecovery(playerPos: THREE.Vector3, playerHeading: number) {
    this.wantedTimer = 0;
    this.policeAssistTimer = 14.0;
    const policeCar = this.vehicles.find(v => v.isPolice);
    if (!policeCar) return;

    this.assistVehicleId = policeCar.id;
    // Spawn cruiser 15m ahead of player along their view direction, driving toward player and stopping 4.8m ahead
    const spawnX = playerPos.x + Math.sin(playerHeading) * 15.5 + Math.cos(playerHeading) * 1.8;
    const spawnZ = playerPos.z + Math.cos(playerHeading) * 15.5 - Math.sin(playerHeading) * 1.8;
    this.assistTargetPos.set(
      playerPos.x + Math.sin(playerHeading) * 4.8 + Math.cos(playerHeading) * 1.6,
      0,
      playerPos.z + Math.cos(playerHeading) * 4.8 - Math.sin(playerHeading) * 1.6
    );

    policeCar.group.position.set(spawnX, 0, spawnZ);
    policeCar.group.rotation.y = Math.atan2(
      this.assistTargetPos.x - spawnX,
      this.assistTargetPos.z - spawnZ
    );
    policeCar.currentSpeed = 20.0;

    const officer = this.officers.find(o => o.vehicleId === policeCar.id);
    if (officer) {
      officer.koTimer = 0;
      officer.health = 100;
      officer.active = true;
      officer.position.set(
        this.assistTargetPos.x - Math.cos(playerHeading) * 1.5,
        0,
        this.assistTargetPos.z + Math.sin(playerHeading) * 1.5
      );
      officer.heading = Math.atan2(
        playerPos.x - officer.position.x,
        playerPos.z - officer.position.z
      );
      officer.mesh.position.copy(officer.position);
      officer.mesh.rotation.y = officer.heading;
      officer.mesh.rotation.x = 0;
      officer.mesh.visible = true;
      officer.mesh.updateOverheadHud('🚓 PM 190: "LADRÃO PRESO! MOTO RECUPERADA!"', 100);
    }
  }

  private spawnTrafficGuards(scene: THREE.Scene) {
    GUARD_POSTS.forEach((post, idx) => {
      const mesh = createTrafficGuard();
      const pos = new THREE.Vector3(post.x, 0, post.z);
      mesh.position.copy(pos);
      mesh.rotation.y = post.rotY;
      scene.add(mesh);

      this.guards.push({
        mesh,
        position: pos,
        health: 100,
        koTimer: 0,
        fineCooldown: 0,
        phaseOffset: idx * 1.2,
      });
    });
  }

  private spawnTraffic(scene: THREE.Scene, performanceMode: 'low' | 'high') {
    /**
     * Strict Brazilian Right-Hand Traffic (Mão Direita) on the 14m Avenue Grid with Dual Lanes & Corredor de Motos:
     * - Inner Car Lane: ±1.75m from center line
     * - Outer Car/Bus Lane: ±4.35m from center line
     * - Motorcycle Lane-Splitting Corridor ("Corredor"): ±3.05m (between inner & outer lanes) and 0.0m (center line)
     */
    const innerLaneOffset = 1.75;
    const outerLaneOffset = 4.35;
    let vehicleId = 1;
    const isLow = performanceMode === 'low';

    const coreVertX = [-70, -10, 50];
    const coreHorizZ = [-70, -15, 45, 95];

    // 1. Spawn on Core Vertical Avenues (North-South, Z from -125 to +125)
    coreVertX.forEach((aveX, aveIdx) => {
      // Base Southbound (+Z, z_pos)
      const southSpawns = isLow
        ? [aveIdx === 0 ? -52 : -98, 22]
        : [aveIdx === 0 ? -52 : -98, -18, 48];
      southSpawns.forEach((startZ, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'outer' : 'inner';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 3 + sIdx) % this.carColors.length],
          direction: 'z_pos',
          laneCoord: aveX - offset,
          laneTier: tier,
          isJamExtra: false,
          avenueCenter: aveX,
          initialTravelCoord: startZ,
          minCoord: -125,
          maxCoord: 125,
          targetSpeed: 10.2 + ((aveIdx + sIdx) % 3) * 1.4,
        });
      });

      // Base Northbound (-Z, z_neg)
      const northSpawns = isLow ? [-35, 72] : [-82, -24, 72];
      northSpawns.forEach((startZ, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'inner' : 'outer';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 3 + sIdx + 2) % this.carColors.length],
          direction: 'z_neg',
          laneCoord: aveX + offset,
          laneTier: tier,
          isJamExtra: false,
          avenueCenter: aveX,
          initialTravelCoord: startZ,
          minCoord: -125,
          maxCoord: 125,
          targetSpeed: 10.2 + ((aveIdx + sIdx + 1) % 3) * 1.4,
        });
      });

      // RUSH-HOUR TRAFFIC JAM QUEUES (Engarrafamento Duplo com Corredor Central!)
      const jamNorthZ =
        aveIdx === 0
          ? isLow
            ? [-30, -44, -58, 18]
            : [-26, -36, -46, -56, -65, 16, 34]
          : isLow
          ? [-32, 24]
          : [-30, -44, -58, 22];

      jamNorthZ.forEach((jamZ, jIdx) => {
        const tier: 'inner' | 'outer' = jIdx % 2 === 0 ? 'outer' : 'inner';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 5 + jIdx + 1) % this.carColors.length],
          direction: 'z_neg',
          laneCoord: aveX + offset,
          laneTier: tier,
          isJamExtra: true,
          forceNonPolice: true,
          avenueCenter: aveX,
          initialTravelCoord: jamZ,
          minCoord: -125,
          maxCoord: 125,
          targetSpeed: 8.8 + (jIdx % 3) * 1.1,
        });
      });

      const jamSouthZ =
        aveIdx === 0
          ? isLow
            ? [-62, -36, 8]
            : [-64, -40, -28, 6, 24, 38]
          : isLow
          ? [-48, 12]
          : [-52, -32, 12, 32];

      jamSouthZ.forEach((jamZ, jIdx) => {
        const tier: 'inner' | 'outer' = jIdx % 2 === 0 ? 'inner' : 'outer';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 4 + jIdx + 3) % this.carColors.length],
          direction: 'z_pos',
          laneCoord: aveX - offset,
          laneTier: tier,
          isJamExtra: true,
          forceNonPolice: true,
          avenueCenter: aveX,
          initialTravelCoord: jamZ,
          minCoord: -125,
          maxCoord: 125,
          targetSpeed: 8.8 + (jIdx % 3) * 1.1,
        });
      });
    });

    // 2. Spawn on Core Horizontal Avenues (Z = -15 crosses the Bridge all the way to Nova Metrópole X = 425!)
    coreHorizZ.forEach((aveZ, aveIdx) => {
      const isBridgeAvenue = aveZ === -15;
      const maxEastX = isBridgeAvenue ? 425 : 75;
      const eastSpawns = isBridgeAvenue
        ? isLow
          ? [-88, 120, 310]
          : [-98, -25, 115, 225, 330]
        : isLow
        ? [-98]
        : [-98, -38];

      eastSpawns.forEach((startX, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'inner' : 'outer';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 2 + sIdx + 1) % this.carColors.length],
          direction: 'x_pos',
          laneCoord: aveZ + offset,
          laneTier: tier,
          isJamExtra: false,
          avenueCenter: aveZ,
          initialTravelCoord: startX,
          minCoord: -125,
          maxCoord: maxEastX,
          targetSpeed: (isBridgeAvenue ? 11.8 : 9.5) + ((aveIdx + sIdx) % 3) * 1.4,
        });
      });

      const westSpawns = isBridgeAvenue
        ? isLow
          ? [360, 165, -20]
          : [395, 240, 155, 22, -45]
        : isLow
        ? [22]
        : [-42, 22];

      westSpawns.forEach((startX, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'outer' : 'inner';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 2 + sIdx + 4) % this.carColors.length],
          direction: 'x_neg',
          laneCoord: aveZ - offset,
          laneTier: tier,
          isJamExtra: false,
          avenueCenter: aveZ,
          initialTravelCoord: startX,
          minCoord: -125,
          maxCoord: maxEastX,
          targetSpeed: (isBridgeAvenue ? 11.8 : 9.5) + ((aveIdx + sIdx + 1) % 3) * 1.4,
        });
      });

      // Rush-Hour Congestion on Horizontal Avenues & Cable-Stayed Bridge Bottleneck!
      const jamEastX = isBridgeAvenue
        ? isLow
          ? [-56, -34, 82, 165]
          : [-62, -46, -32, 24, 78, 138, 188, 295]
        : isLow
        ? [-52]
        : [-58, -26, 20];

      jamEastX.forEach((jamX, jIdx) => {
        const tier: 'inner' | 'outer' = jIdx % 2 === 0 ? 'outer' : 'inner';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 3 + jIdx + 2) % this.carColors.length],
          direction: 'x_pos',
          laneCoord: aveZ + offset,
          laneTier: tier,
          isJamExtra: true,
          forceNonPolice: true,
          avenueCenter: aveZ,
          initialTravelCoord: jamX,
          minCoord: -125,
          maxCoord: maxEastX,
          targetSpeed: 9.0 + (jIdx % 3) * 1.1,
        });
      });

      const jamWestX = isBridgeAvenue
        ? isLow
          ? [-54, 98, 215]
          : [-58, -32, 36, 108, 185, 265, 340]
        : isLow
        ? [-24]
        : [-55, -22, 34];

      jamWestX.forEach((jamX, jIdx) => {
        const tier: 'inner' | 'outer' = jIdx % 2 === 0 ? 'inner' : 'outer';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(aveIdx * 4 + jIdx + 5) % this.carColors.length],
          direction: 'x_neg',
          laneCoord: aveZ - offset,
          laneTier: tier,
          isJamExtra: true,
          forceNonPolice: true,
          avenueCenter: aveZ,
          initialTravelCoord: jamX,
          minCoord: -125,
          maxCoord: maxEastX,
          targetSpeed: 9.0 + (jIdx % 3) * 1.1,
        });
      });
    });

    // 3. Spawn on Nova Metrópole Vertical Avenues (X = 290, 350, 410)
    const novaVertX = [290, 350, 410];
    novaVertX.forEach((aveX, nIdx) => {
      const southSpawns = isLow ? [-55] : [-85, -25, 25];
      southSpawns.forEach((startZ, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'inner' : 'outer';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(nIdx * 3 + sIdx + 1) % this.carColors.length],
          direction: 'z_pos',
          laneCoord: aveX - offset,
          laneTier: tier,
          isJamExtra: sIdx === 1,
          forceNonPolice: sIdx === 1,
          avenueCenter: aveX,
          initialTravelCoord: startZ,
          minCoord: -135,
          maxCoord: 135,
          targetSpeed: 11.0 + ((nIdx + sIdx) % 3) * 1.5,
        });
      });

      const northSpawns = isLow ? [45] : [-35, 15, 65];
      northSpawns.forEach((startZ, sIdx) => {
        const tier: 'inner' | 'outer' = sIdx % 2 === 0 ? 'outer' : 'inner';
        const offset = tier === 'outer' ? outerLaneOffset : innerLaneOffset;
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(nIdx * 3 + sIdx + 3) % this.carColors.length],
          direction: 'z_neg',
          laneCoord: aveX + offset,
          laneTier: tier,
          isJamExtra: sIdx === 1,
          forceNonPolice: sIdx === 1,
          avenueCenter: aveX,
          initialTravelCoord: startZ,
          minCoord: -135,
          maxCoord: 135,
          targetSpeed: 11.0 + ((nIdx + sIdx + 1) % 3) * 1.5,
        });
      });
    });

    // 3b. Spawn Horizontal Avenue Traffic inside Nova Metrópole (Z = -70, 45, 95 between X = 265 and X = 435)
    [-70, 45, 95].forEach((aveZ, hIdx) => {
      const eastSpawns = isLow ? [295] : [280, 365];
      eastSpawns.forEach((startX, sIdx) => {
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(hIdx * 2 + sIdx + 2) % this.carColors.length],
          direction: 'x_pos',
          laneCoord: aveZ + innerLaneOffset,
          laneTier: 'inner',
          isJamExtra: false,
          avenueCenter: aveZ,
          initialTravelCoord: startX,
          minCoord: 265,
          maxCoord: 435,
          targetSpeed: 10.5 + ((hIdx + sIdx) % 3) * 1.4,
        });
      });

      const westSpawns = isLow ? [385] : [325, 410];
      westSpawns.forEach((startX, sIdx) => {
        this.createVehicle(scene, {
          id: vehicleId++,
          color: this.carColors[(hIdx * 2 + sIdx + 5) % this.carColors.length],
          direction: 'x_neg',
          laneCoord: aveZ - outerLaneOffset,
          laneTier: 'outer',
          isJamExtra: false,
          avenueCenter: aveZ,
          initialTravelCoord: startX,
          minCoord: 265,
          maxCoord: 435,
          targetSpeed: 10.5 + ((hIdx + sIdx + 1) % 3) * 1.4,
        });
      });
    });
  }

  private createVehicle(
    scene: THREE.Scene,
    cfg: {
      id: number;
      color: number;
      direction: TrafficVehicle['direction'];
      laneCoord: number;
      laneTier?: 'inner' | 'outer';
      isJamExtra?: boolean;
      forceNonPolice?: boolean;
      avenueCenter: number;
      initialTravelCoord: number;
      minCoord: number;
      maxCoord: number;
      targetSpeed: number;
    }
  ) {
    let archetype = this.archetypes[(cfg.id - 1) % this.archetypes.length];
    if (cfg.forceNonPolice && archetype === 'police') {
      archetype = cfg.id % 2 === 0 ? 'sedan' : 'taxi';
    }
    const isPolice = archetype === 'police';
    const isBus = archetype === 'bus';
    const isLow = this.isLowMode;
    const carGroup = createTrafficCar(cfg.color, archetype, isLow);

    if (cfg.direction === 'x_pos') {
      carGroup.rotation.y = Math.PI / 2;
      carGroup.position.set(cfg.initialTravelCoord, 0, cfg.laneCoord);
    } else if (cfg.direction === 'x_neg') {
      carGroup.rotation.y = -Math.PI / 2;
      carGroup.position.set(cfg.initialTravelCoord, 0, cfg.laneCoord);
    } else if (cfg.direction === 'z_pos') {
      carGroup.rotation.y = 0;
      carGroup.position.set(cfg.laneCoord, 0, cfg.initialTravelCoord);
    } else {
      carGroup.rotation.y = Math.PI;
      carGroup.position.set(cfg.laneCoord, 0, cfg.initialTravelCoord);
    }

    scene.add(carGroup);

    this.vehicles.push({
      id: cfg.id,
      group: carGroup,
      isPolice,
      isBus,
      isJamExtra: Boolean(cfg.isJamExtra),
      laneTier: cfg.laneTier ?? 'inner',
      busStopTimer: 0,
      busStopCooldown: 0,
      chaseHitCooldown: 0,
      hornCooldown: 0,
      honkReactionTimer: 0,
      honkReactionDir: cfg.id % 2 === 0 ? 1 : -1,
      lateralOffset: 0,
      targetSpeed: isPolice ? cfg.targetSpeed + 1.5 : isBus ? cfg.targetSpeed * 0.88 : cfg.targetSpeed,
      currentSpeed: cfg.targetSpeed,
      direction: cfg.direction,
      minCoord: cfg.minCoord,
      maxCoord: cfg.maxCoord,
      laneCoord: cfg.laneCoord,
      avenueCenter: cfg.avenueCenter,
      turnCooldown: 2 + (cfg.id % 5),
    });

    if (isPolice) {
      const officerMesh = createPoliceOfficer();
      officerMesh.visible = false;
      scene.add(officerMesh);
      this.officers.push({
        vehicleId: cfg.id,
        mesh: officerMesh,
        position: carGroup.position.clone(),
        heading: 0,
        active: false,
        health: 100,
        koTimer: 0,
        walkPhase: cfg.id * 0.9,
      });
    }
  }

  private applyDirectionTransform(v: TrafficVehicle) {
    if (v.direction === 'x_pos') v.group.rotation.y = Math.PI / 2;
    else if (v.direction === 'x_neg') v.group.rotation.y = -Math.PI / 2;
    else if (v.direction === 'z_pos') v.group.rotation.y = 0;
    else v.group.rotation.y = Math.PI;
  }

  /**
   * Player On-Foot Melee Attack (Punch 🥊 or Push 👐) against nearby Traffic Guards or Disembarked Police Officers!
   */
  public applyMeleeHitToAuthorities(
    playerPos: THREE.Vector3,
    damage: number,
    isPush: boolean
  ): { hitGuard: boolean; hitOfficer: boolean; defeatedAny: boolean } {
    let hitGuard = false;
    let hitOfficer = false;
    let defeatedAny = false;

    for (const g of this.guards) {
      if (g.koTimer > 0) continue;
      const dx = g.position.x - playerPos.x;
      const dz = g.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.2) {
        hitGuard = true;
        g.health = Math.max(0, g.health - damage);
        this.wantedTimer = Math.max(this.wantedTimer, 28.0);
        sound.playWhistle();
        if (g.health <= 0) {
          defeatedAny = true;
          g.koTimer = 24.0;
          g.mesh.updateOverheadHud('👮 GUARDA DERROTADO (0% LIFE)', 0);
        } else {
          g.mesh.updateOverheadHud(
            isPush ? '💫 GUARDA EMPURRADO! POLÍCIA!' : '🥊 GUARDA AGREDIDO! POLÍCIA!',
            g.health
          );
        }
      }
    }

    for (const o of this.officers) {
      if (!o.active || o.koTimer > 0) continue;
      const dx = o.position.x - playerPos.x;
      const dz = o.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.4) {
        hitOfficer = true;
        o.health = Math.max(0, o.health - damage);
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        o.position.x += nx * (isPush ? 2.4 : 1.0);
        o.position.z += nz * (isPush ? 2.4 : 1.0);
        if (o.health <= 0) {
          defeatedAny = true;
          o.koTimer = 22.0;
          o.mesh.updateOverheadHud('🚓 POLICIAL DERROTADO (0% LIFE)', 0);
        } else {
          o.mesh.updateOverheadHud(
            isPush ? '💫 POLICIAL EMPURRADO!' : '🥊 POLICIAL ATINGIDO!',
            o.health
          );
        }
      }
    }

    return { hitGuard, hitOfficer, defeatedAny };
  }

  public update(
    dt: number,
    elapsedTime: number,
    playerX?: number,
    playerZ?: number,
    pedestrianPositions?: THREE.Vector3[],
    onPoliceSirenTick?: () => void,
    isPlayerOnFoot: boolean = false,
    playerSpeedKmH: number = 0,
    isPlayerWheelie: boolean = false,
    onTrafficGuardFine?: () => void,
    onPoliceOfficersDisembark?: () => void,
    onPlayerArrested?: () => void,
    districtId: DistrictId = 'centro',
    timeShift: TimeShift = 'tarde',
    isPlayerHonking: boolean = false,
    isTrafficJam: boolean = true,
    lodDistanceScale: number = 1.0
  ) {
    const dCfg = DISTRICT_TRAFFIC_CONFIG[districtId] || DISTRICT_TRAFFIC_CONFIG.centro;
    const tCfg = TIME_TRAFFIC_CONFIG[timeShift] || TIME_TRAFFIC_CONFIG.tarde;
    const speedMult = dCfg.speedFactor * tCfg.speedFactor * (isTrafficJam ? 0.42 : 1.0);
    const guardCullDist = 110 * lodDistanceScale;
    const vehicleCullDistSq = (165 * lodDistanceScale) * (165 * lodDistanceScale);

    // 1. Update Traffic Guards at Intersections
    for (const g of this.guards) {
      if (g.fineCooldown > 0) g.fineCooldown = Math.max(0, g.fineCooldown - dt);

      if (playerX !== undefined && playerZ !== undefined) {
        const dx = playerX - g.position.x;
        const dz = playerZ - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > guardCullDist) {
          g.mesh.visible = false;
          continue;
        }
        g.mesh.visible = true;
      }

      if (g.koTimer > 0) {
        g.koTimer = Math.max(0, g.koTimer - dt);
        g.mesh.rotation.x = THREE.MathUtils.damp(g.mesh.rotation.x, -Math.PI / 2.2, 10, dt);
        g.mesh.position.y = 0.22;
        if (g.koTimer <= 0) {
          g.health = 100;
          g.mesh.rotation.x = 0;
          g.mesh.position.y = 0;
          g.mesh.updateOverheadHud('👮 GUARDA DE TRÂNSITO', 100);
        }
        continue;
      }

      g.mesh.rotation.x = 0;
      g.mesh.position.y = 0;

      // Animate Traffic Guard directing traffic with luminous red baton
      g.mesh.rightArm.rotation.x = -1.25 + Math.sin(elapsedTime * 4.5 + g.phaseOffset) * 0.55;
      g.mesh.leftArm.rotation.z = Math.sin(elapsedTime * 3.0 + g.phaseOffset) * 0.35;

      if (playerX !== undefined && playerZ !== undefined) {
        const dx = playerX - g.position.x;
        const dz = playerZ - g.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 14) {
          g.mesh.rotation.y = Math.atan2(dx, dz);

          if (isPlayerOnFoot) {
            if (g.fineCooldown <= 8.0) {
              g.mesh.updateOverheadHud('👮 GUARDA: "VOCÊ ESTÁ A PÉ, USE A FAIXA!"', g.health);
            }
          } else {
            if (dist < 1.35 && playerSpeedKmH > 15 && g.fineCooldown <= 8.0) {
              g.fineCooldown = 12.0;
              g.health = Math.max(0, g.health - 60);
              this.wantedTimer = 30.0;
              sound.playWhistle();
              sound.playCrash();
              if (g.health <= 0) {
                g.koTimer = 24.0;
                g.mesh.updateOverheadHud('👮 GUARDA DERROTADO (0% LIFE)', 0);
              } else {
                g.mesh.updateOverheadHud('👮 GUARDA ATROPELADO! POLÍCIA!', g.health);
              }
            } else if ((isPlayerWheelie || playerSpeedKmH > 78) && g.fineCooldown <= 0) {
              g.fineCooldown = 12.0;
              sound.playWhistle();
              g.mesh.updateOverheadHud(
                isPlayerWheelie
                  ? '👮 GUARDA: "SEM GRAU! MULTADO!"'
                  : '👮 GUARDA: "ALTA VELOCIDADE! MULTADO!"',
                g.health
              );
              onTrafficGuardFine?.();
            } else if (g.fineCooldown <= 8.0) {
              g.mesh.updateOverheadHud(
                isTrafficJam ? '👮 GUARDA: "ENGARRAFAMENTO! USE O CORREDOR!"' : '👮 GUARDA FISCALIZANDO',
                g.health
              );
            }
          }
        } else if (g.fineCooldown <= 8.0) {
          g.mesh.updateOverheadHud('👮 GUARDA DE TRÂNSITO', g.health);
        }
      }
    }

    // 2. Update Wanted Timer, Police 190 Assist Timer & Disembarked Police Officers
    if (this.policeAssistTimer > 0) {
      this.policeAssistTimer = Math.max(0, this.policeAssistTimer - dt);
      if (this.policeAssistTimer <= 0) {
        const assistOfficer = this.officers.find(o => o.vehicleId === this.assistVehicleId);
        if (assistOfficer && this.wantedTimer <= 0) {
          assistOfficer.active = false;
          assistOfficer.mesh.visible = false;
        }
        this.assistVehicleId = null;
      }
    }

    if (this.wantedTimer > 0) {
      this.wantedTimer = Math.max(0, this.wantedTimer - dt);
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 1.6;
        onPoliceSirenTick?.();
      }
      if (this.wantedTimer <= 0) {
        this.clearWanted();
      }
    }

    // Update Disembarked Police Officers (either Friendly 190 Assist or Wanted Pursuit)
    for (const o of this.officers) {
      if (!o.active) {
        o.mesh.visible = false;
        continue;
      }

      o.mesh.visible = true;

      // Friendly 190 Police Assist Officer standing guard by the recovered bike
      if (this.policeAssistTimer > 0 && o.vehicleId === this.assistVehicleId && this.wantedTimer <= 0) {
        o.mesh.rotation.x = 0;
        if (playerX !== undefined && playerZ !== undefined) {
          o.heading = Math.atan2(playerX - o.position.x, playerZ - o.position.z);
          o.mesh.rotation.y = o.heading;
        }
        o.walkPhase += dt * 4;
        o.mesh.rightArm.rotation.x = -0.8 + Math.sin(o.walkPhase) * 0.25;
        o.mesh.leftArm.rotation.x = 0;
        o.mesh.leftLeg.rotation.x = 0;
        o.mesh.rightLeg.rotation.x = 0;
        o.mesh.updateOverheadHud('🚓 PM 190: "LADRÃO PRESO! MOTO RECUPERADA!"', 100);
        continue;
      }

      if (o.koTimer > 0) {
        o.koTimer = Math.max(0, o.koTimer - dt);
        o.mesh.rotation.x = THREE.MathUtils.damp(o.mesh.rotation.x, -Math.PI / 2.2, 10, dt);
        o.mesh.position.set(o.position.x, 0.22, o.position.z);
        if (o.koTimer <= 0) {
          o.health = 100;
          o.mesh.rotation.x = 0;
          o.mesh.position.y = 0;
          o.mesh.updateOverheadHud('🚓 POLICIAL: "PARADO! PRESO!"', 100);
        }
        continue;
      }

      o.mesh.rotation.x = 0;

      if (playerX !== undefined && playerZ !== undefined && this.wantedTimer > 0) {
        const dx = playerX - o.position.x;
        const dz = playerZ - o.position.z;
        const distToPlayer = Math.hypot(dx, dz);

        if (!isPlayerOnFoot && distToPlayer > 36) {
          o.active = false;
          o.mesh.visible = false;
          continue;
        }

        o.heading = Math.atan2(dx, dz);
        o.mesh.rotation.y = o.heading;
        o.mesh.updateOverheadHud('🚓 POLICIAL: "PARADO! VOCÊ ESTÁ PRESO!"', o.health);

        const officerRunSpeed = 8.3;
        o.position.x += Math.sin(o.heading) * officerRunSpeed * dt;
        o.position.z += Math.cos(o.heading) * officerRunSpeed * dt;
        o.mesh.position.set(o.position.x, 0, o.position.z);

        o.walkPhase += dt * 15;
        const swing = Math.sin(o.walkPhase) * 0.7;
        o.mesh.leftLeg.rotation.x = swing;
        o.mesh.rightLeg.rotation.x = -swing;
        o.mesh.leftArm.rotation.x = -swing * 0.6;
        o.mesh.rightArm.rotation.x = -0.9 + swing * 0.4;

        if (distToPlayer < 2.2) {
          sound.playPoliceArrest();
          this.clearWanted();
          onPlayerArrested?.();
          return;
        }
      } else {
        o.active = false;
        o.mesh.visible = false;
      }
    }

    for (const v of this.vehicles) {
      // Show or hide extra congestion vehicles based on Rush-Hour Traffic Jam mode
      if (v.isJamExtra) {
        if (!isTrafficJam) {
          v.group.visible = false;
          continue;
        }
      }

      // LOD Distance Culling for distant vehicles (> 165m * lodDistanceScale)
      if (
        playerX !== undefined &&
        playerZ !== undefined &&
        !(v.isPolice && (this.wantedTimer > 0 || (this.policeAssistTimer > 0 && v.id === this.assistVehicleId)))
      ) {
        const vdx = v.group.position.x - playerX;
        const vdz = v.group.position.z - playerZ;
        if (vdx * vdx + vdz * vdz > vehicleCullDistSq) {
          v.group.visible = false;
          // Lightweight 1D position wrap while culled
          const step = v.targetSpeed * speedMult * dt;
          if (v.direction === 'x_pos') {
            v.group.position.x += step;
            if (v.group.position.x > v.maxCoord) v.group.position.x = v.minCoord;
          } else if (v.direction === 'x_neg') {
            v.group.position.x -= step;
            if (v.group.position.x < v.minCoord) v.group.position.x = v.maxCoord;
          } else if (v.direction === 'z_pos') {
            v.group.position.z += step;
            if (v.group.position.z > v.maxCoord) v.group.position.z = v.minCoord;
          } else {
            v.group.position.z -= step;
            if (v.group.position.z < v.minCoord) v.group.position.z = v.maxCoord;
          }
          continue;
        }
      }

      v.group.visible = true;

      const vehicleLaneOffset = v.laneTier === 'outer' ? 4.35 : 1.75;

      if (v.turnCooldown > 0) {
        v.turnCooldown = Math.max(0, v.turnCooldown - dt);
      }
      if (v.chaseHitCooldown > 0) {
        v.chaseHitCooldown = Math.max(0, v.chaseHitCooldown - dt);
      }
      if (v.busStopCooldown > 0) {
        v.busStopCooldown = Math.max(0, v.busStopCooldown - dt);
      }
      if (v.hornCooldown > 0) {
        v.hornCooldown = Math.max(0, v.hornCooldown - dt);
      }
      if (v.honkReactionTimer > 0) {
        v.honkReactionTimer = Math.max(0, v.honkReactionTimer - dt);
      }

      // Animate Police Rooftop Giroflex LED Lightbar
      if (v.isPolice) {
        const isHighAlert =
          this.wantedTimer > 0 || (this.policeAssistTimer > 0 && v.id === this.assistVehicleId);
        const redMat = v.group.userData.sirenRedMat as THREE.MeshStandardMaterial | undefined;
        const blueMat = v.group.userData.sirenBlueMat as THREE.MeshStandardMaterial | undefined;
        if (redMat && blueMat) {
          const freq = isHighAlert ? 18 : 6;
          const phase = Math.sin(elapsedTime * freq + v.id) > 0;
          const highIntensity = isHighAlert ? 4.2 : 1.6;
          redMat.emissiveIntensity = phase ? highIntensity : 0.25;
          blueMat.emissiveIntensity = phase ? 0.25 : highIntensity;
        }
      }

      // FRIENDLY 190 POLICE DISPATCH MODE
      if (
        v.isPolice &&
        this.policeAssistTimer > 0 &&
        v.id === this.assistVehicleId &&
        this.wantedTimer <= 0
      ) {
        const dx = this.assistTargetPos.x - v.group.position.x;
        const dz = this.assistTargetPos.z - v.group.position.z;
        const distToStop = Math.hypot(dx, dz);
        if (distToStop > 0.6) {
          v.group.rotation.y = Math.atan2(dx, dz);
          const approachSpeed = Math.min(22, distToStop * 3.5 + 2.0);
          v.currentSpeed = THREE.MathUtils.damp(v.currentSpeed, approachSpeed, 8, dt);
          v.group.position.x += Math.sin(v.group.rotation.y) * v.currentSpeed * dt;
          v.group.position.z += Math.cos(v.group.rotation.y) * v.currentSpeed * dt;
        } else {
          v.currentSpeed = 0;
        }
        continue;
      }

      // ACTIVE POLICE PURSUIT MODE
      if (
        v.isPolice &&
        this.wantedTimer > 0 &&
        playerX !== undefined &&
        playerZ !== undefined
      ) {
        const officer = this.officers.find(o => o.vehicleId === v.id);

        if (officer && officer.active) {
          v.currentSpeed = THREE.MathUtils.damp(v.currentSpeed, 0, 12, dt);
          continue;
        }

        const dx = playerX - v.group.position.x;
        const dz = playerZ - v.group.position.z;
        const distToPlayer = Math.hypot(dx, dz);

        if (distToPlayer < 95) {
          if (
            officer &&
            !officer.active &&
            officer.koTimer <= 0 &&
            distToPlayer < 8.8 &&
            (isPlayerOnFoot || playerSpeedKmH < 48)
          ) {
            v.currentSpeed = 0;
            officer.active = true;
            officer.health = 100;
            officer.position.set(
              v.group.position.x + Math.cos(v.group.rotation.y) * 1.65,
              0,
              v.group.position.z - Math.sin(v.group.rotation.y) * 1.65
            );
            officer.mesh.position.copy(officer.position);
            officer.mesh.visible = true;
            officer.mesh.updateOverheadHud('🚓 POLICIAL: "PARADO! VOCÊ ESTÁ PRESO!"', 100);
            sound.playPoliceArrest();
            onPoliceOfficersDisembark?.();
            continue;
          }

          const targetHeading = Math.atan2(dx, dz);
          let angleDiff = targetHeading - v.group.rotation.y;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          v.group.rotation.y += THREE.MathUtils.clamp(angleDiff, -4.5 * dt, 4.5 * dt);
          const chaseSpeed = distToPlayer > 4 ? 19.5 : 12.0;
          v.currentSpeed = THREE.MathUtils.damp(v.currentSpeed, chaseSpeed, 6, dt);

          v.group.position.x = THREE.MathUtils.clamp(
            v.group.position.x + Math.sin(v.group.rotation.y) * v.currentSpeed * dt,
            -135,
            445
          );
          v.group.position.z = THREE.MathUtils.clamp(
            v.group.position.z + Math.cos(v.group.rotation.y) * v.currentSpeed * dt,
            -180,
            180
          );

          const wheels = v.group.userData.wheels as THREE.Group[] | undefined;
          if (wheels) {
            const wheelSpin = (v.currentSpeed / 0.36) * dt;
            for (const w of wheels) w.rotation.x += wheelSpin;
          }
          continue;
        }
      }

      // Restore grid heading when not chasing
      this.applyDirectionTransform(v);

      let desiredSpeed = v.targetSpeed * speedMult;
      const vx = v.group.position.x;
      const vz = v.group.position.z;

      // 0. Urban Bus Stop Boarding Behavior (Parada de Ônibus)
      if (v.isBus) {
        if (v.busStopTimer > 0) {
          v.busStopTimer = Math.max(0, v.busStopTimer - dt);
          desiredSpeed = 0;
          if (v.busStopTimer <= 0) {
            const updateHud = v.group.userData.updateBusHud as ((s: string) => void) | undefined;
            updateHud?.('🚌 ÔNIBUS CIRCULAR 101');
          }
        } else if (v.busStopCooldown <= 0) {
          for (const stop of BUS_STOPS) {
            const distToStop = Math.hypot(vx - stop.x, vz - stop.z);
            if (distToStop < 6.8) {
              v.busStopTimer = 4.5;
              v.busStopCooldown = 18.0;
              desiredSpeed = 0;
              const updateHud = v.group.userData.updateBusHud as ((s: string) => void) | undefined;
              updateHud?.('🚏 ÔNIBUS NA PARADA • EMBARQUE');
              break;
            }
          }
        }
      }

      // 0.5 RUSH-HOUR STOP-AND-GO TRAFFIC JAM WAVE (Onda de Engarrafamento Anda-e-Para)
      let isStuckInJam = false;
      if (isTrafficJam && !(v.isPolice && this.wantedTimer > 0)) {
        const jamWave = Math.sin(elapsedTime * 1.15 + v.id * 0.72);
        if (jamWave < -0.12) {
          desiredSpeed = 0;
          isStuckInJam = true;
        } else {
          desiredSpeed = Math.min(desiredSpeed, 2.2 + (jamWave + 0.12) * 1.8);
          if (desiredSpeed < 3.0) isStuckInJam = true;
        }
      }

      // 1. Same-lane Intelligent Adaptive Cruise Control (ACC)
      for (const other of this.vehicles) {
        if (!other.group.visible || other.id === v.id || other.direction !== v.direction) continue;
        if (Math.abs(other.laneCoord - v.laneCoord) > 0.65) continue;

        let distAhead = Infinity;
        if (v.direction === 'x_pos') distAhead = other.group.position.x - vx;
        else if (v.direction === 'x_neg') distAhead = vx - other.group.position.x;
        else if (v.direction === 'z_pos') distAhead = other.group.position.z - vz;
        else if (v.direction === 'z_neg') distAhead = vz - other.group.position.z;

        const minSafeDist = v.isBus || other.isBus ? 8.8 : isTrafficJam ? 5.9 : 6.8;
        const detectDist = v.isBus || other.isBus ? 14.5 : isTrafficJam ? 10.5 : 12.0;
        if (distAhead > 0 && distAhead < detectDist) {
          desiredSpeed =
            distAhead < minSafeDist ? 0 : Math.min(desiredSpeed, other.currentSpeed * 0.85);
          if (desiredSpeed < 2.2 && isTrafficJam) {
            isStuckInJam = true;
          }
        }
      }

      // 2. Intelligent Driver Reaction to Player & Horn Honks (Evasive Swerve, Abrir Corredor no Engarrafamento, High-Beam Flash & Hazard Blinkers)
      let targetLateralOffset = 0;
      let driverHudText = '';
      let driverHudColor = '#38bdf8';
      let blinkerMode: 'off' | 'right' | 'hazard' = isStuckInJam ? 'hazard' : 'off';
      let highBeamFlash = false;

      if (isStuckInJam) {
        if (v.isBus) {
          driverHudText = '🚌 ÔNIBUS RETIDO NO ENGARRAFAMENTO';
          driverHudColor = '#f59e0b';
        } else if (v.id % 3 === 0) {
          driverHudText = '🚕 PICO DAS 18H • TUDO TRAVADO! 🚦';
          driverHudColor = '#facc15';
        } else {
          driverHudText = '🚗 ENGARRAFAMENTO • USE O CORREDOR! 🏍️';
          driverHudColor = '#fb7185';
        }
      }

      if (playerX !== undefined && playerZ !== undefined && !(v.isPolice && this.wantedTimer > 0)) {
        const distToPlayerTotal = Math.hypot(playerX - vx, playerZ - vz);

        // Occasional impatient traffic jam honk when stopped near player
        if (isStuckInJam && distToPlayerTotal < 24 && v.hornCooldown <= 0 && Math.sin(elapsedTime * 7 + v.id) > 0.96) {
          v.hornCooldown = 7.5 + (v.id % 4);
          sound.playHorn();
        }

        // A) Trigger Smart Reaction when Player Honks the Horn within 32m!
        if (isPlayerHonking && distToPlayerTotal < 32) {
          v.honkReactionTimer = 3.4;
          // In dual-lane traffic, inner lane shifts toward center line and outer lane shifts toward sidewalk to widen the Corridor!
          const laneSign = v.laneCoord >= v.avenueCenter ? 1 : -1;
          v.honkReactionDir = v.laneTier === 'outer' ? laneSign : -laneSign;
          if (v.hornCooldown <= 0 && distToPlayerTotal < 22) {
            v.hornCooldown = 3.5;
            sound.playHorn();
          }
        }

        // B) Active Smart Reaction to Player's Horn (Pull Over to Open Corridor + Flash Hazards/High Beams!)
        if (v.honkReactionTimer > 0 && distToPlayerTotal < 34) {
          blinkerMode = 'hazard';
          highBeamFlash = true;
          const pullOverAmount = v.isBus ? 0.65 : 0.85;
          targetLateralOffset = v.honkReactionDir * pullOverAmount;

          if (v.isBus) {
            desiredSpeed = desiredSpeed * 0.72;
            driverHudText = '🚌 ÔNIBUS: LIBERANDO O CORREDOR! 🔊';
            driverHudColor = '#38bdf8';
          } else {
            driverHudText = '🔊 ABRINDO CORREDOR NO ENGARRAFAMENTO! ↱';
            driverHudColor = '#00f3ff';
          }
        }

        // C) Proximity Evasive Swerve & Emergency Braking when Player is directly ahead in the lane
        const laneTolerance = isPlayerOnFoot ? 2.4 : 1.95;
        if (v.direction === 'x_pos' || v.direction === 'x_neg') {
          const latDiff = playerZ - v.laneCoord;
          if (Math.abs(latDiff) < laneTolerance) {
            const distPlayer = v.direction === 'x_pos' ? playerX - vx : vx - playerX;
            if (distPlayer > 0 && distPlayer < 12.5) {
              desiredSpeed = isPlayerOnFoot || distPlayer < 6.0 ? 0 : desiredSpeed * 0.32;
              blinkerMode = 'hazard';
              highBeamFlash = true;
              if (!v.isBus) {
                targetLateralOffset = latDiff >= 0 ? -0.85 : 0.85;
              }
              driverHudText =
                distPlayer < 6.0
                  ? '🚨 FREIO DE EMERGÊNCIA • BUZINA!'
                  : '🚗 MOTORISTA: DESVIANDO DO MOTOBOY!';
              driverHudColor = '#facc15';
              if (v.hornCooldown <= 0 && distPlayer < 9.0) {
                v.hornCooldown = 5.5;
                sound.playHorn();
              }
            }
          }
        } else {
          const latDiff = playerX - v.laneCoord;
          if (Math.abs(latDiff) < laneTolerance) {
            const distPlayer = v.direction === 'z_pos' ? playerZ - vz : vz - playerZ;
            if (distPlayer > 0 && distPlayer < 12.5) {
              desiredSpeed = isPlayerOnFoot || distPlayer < 6.0 ? 0 : desiredSpeed * 0.32;
              blinkerMode = 'hazard';
              highBeamFlash = true;
              if (!v.isBus) {
                targetLateralOffset = latDiff >= 0 ? -0.85 : 0.85;
              }
              driverHudText =
                distPlayer < 6.0
                  ? '🚨 FREIO DE EMERGÊNCIA • BUZINA!'
                  : '🚗 MOTORISTA: DESVIANDO DO MOTOBOY!';
              driverHudColor = '#facc15';
              if (v.hornCooldown <= 0 && distPlayer < 9.0) {
                v.hornCooldown = 5.5;
                sound.playHorn();
              }
            }
          }
        }
      }

      // 3. Yield to Pedestrians in Crosswalks ahead of the vehicle
      if (pedestrianPositions) {
        for (const pedPos of pedestrianPositions) {
          if (v.direction === 'x_pos' || v.direction === 'x_neg') {
            if (Math.abs(pedPos.z - v.laneCoord) < 2.1) {
              const distPed = v.direction === 'x_pos' ? pedPos.x - vx : vx - pedPos.x;
              if (distPed > 0 && distPed < 7.5) {
                desiredSpeed = 0;
                blinkerMode = 'hazard';
                break;
              }
            }
          } else {
            if (Math.abs(pedPos.x - v.laneCoord) < 2.1) {
              const distPed = v.direction === 'z_pos' ? pedPos.z - vz : vz - pedPos.z;
              if (distPed > 0 && distPed < 7.5) {
                desiredSpeed = 0;
                blinkerMode = 'hazard';
                break;
              }
            }
          }
        }
      }

      // 4. Dynamic Per-Intersection Signal & Intelligent Right-Hand Turn Decision with Blinkers
      const isHorizontal = v.direction === 'x_pos' || v.direction === 'x_neg';
      const intersections = isHorizontal ? VERTICAL_AVENUES_X : HORIZONTAL_AVENUES_Z;
      const currentPos = isHorizontal ? vx : vz;
      const moveSign = v.direction === 'x_pos' || v.direction === 'z_pos' ? 1 : -1;
      const wantsToTurnAtNext = !v.isBus && !v.isJamExtra && v.turnCooldown <= 0 && v.id % 2 === 0;

      for (const interCoord of intersections) {
        const distToCenter = (interCoord - currentPos) * moveSign;
        const interX = isHorizontal ? interCoord : v.avenueCenter;
        const interZ = isHorizontal ? v.avenueCenter : interCoord;

        if (wantsToTurnAtNext && distToCenter > 0 && distToCenter < 18.0 && blinkerMode === 'off') {
          blinkerMode = 'right';
          if (!driverHudText) {
            driverHudText = '🚗 SETA À DIREITA ↱';
            driverHudColor = '#f59e0b';
          }
        }

        if (distToCenter > 7.2 && distToCenter < 13.8) {
          const phases = getTrafficSignalPhases(elapsedTime, interX, interZ);
          const myPhase = isHorizontal ? phases.horizontal : phases.vertical;
          const hasStopSignal = myPhase === 'red' || myPhase === 'yellow';

          let crossTrafficInside = false;
          for (const other of this.vehicles) {
            if (!other.group.visible) continue;
            const otherIsHoriz = other.direction === 'x_pos' || other.direction === 'x_neg';
            if (otherIsHoriz === isHorizontal) continue;
            if (
              Math.abs(other.group.position.x - interX) < 8.5 &&
              Math.abs(other.group.position.z - interZ) < 8.5
            ) {
              crossTrafficInside = true;
              break;
            }
          }

          if (hasStopSignal || crossTrafficInside) {
            desiredSpeed = 0;
            driverHudText = isTrafficJam
              ? '🚦 SINAL FECHADO • FILA DUPLA NO CORREDOR!'
              : '🚦 AGUARDANDO SINAL VERDE';
            driverHudColor = '#ef4444';
            break;
          }
        }

        // Intelligent Right-Hand Turn at Green Intersection
        if (
          !v.isBus &&
          !v.isJamExtra &&
          v.turnCooldown <= 0 &&
          desiredSpeed > 2 &&
          Math.abs(distToCenter + vehicleLaneOffset) < 0.65 &&
          (wantsToTurnAtNext || Math.random() < 0.25)
        ) {
          let newDir: TrafficVehicle['direction'] = v.direction;
          let newLaneCoord = v.laneCoord;
          let newAveCenter = interCoord;
          let newMin = -125;
          let newMax = 125;

          if (v.direction === 'z_pos') {
            newDir = 'x_neg';
            newLaneCoord = interZ - vehicleLaneOffset;
            newMin = interZ === -15 || interX < 100 ? -125 : 265;
            newMax = interZ === -15 || interX >= 280 ? 425 : 75;
          } else if (v.direction === 'z_neg') {
            if (interX < 45 || interZ === -15 || (interX >= 280 && interX < 405)) {
              newDir = 'x_pos';
              newLaneCoord = interZ + vehicleLaneOffset;
              newMin = interZ === -15 || interX < 100 ? -125 : 265;
              newMax = interZ === -15 || interX >= 280 ? 425 : 75;
            }
          } else if (v.direction === 'x_pos') {
            newDir = 'z_pos';
            newLaneCoord = interX - vehicleLaneOffset;
          } else if (v.direction === 'x_neg') {
            newDir = 'z_neg';
            newLaneCoord = interX + vehicleLaneOffset;
          }

          if (newDir !== v.direction) {
            const targetX = newDir === 'x_pos' || newDir === 'x_neg' ? vx : newLaneCoord;
            const targetZ = newDir === 'x_pos' || newDir === 'x_neg' ? newLaneCoord : vz;
            const laneClear = !this.vehicles.some(
              other =>
                other.group.visible &&
                other.id !== v.id &&
                Math.hypot(other.group.position.x - targetX, other.group.position.z - targetZ) < 11
            );

            if (laneClear) {
              v.direction = newDir;
              v.laneCoord = newLaneCoord;
              v.avenueCenter = newAveCenter;
              v.minCoord = newMin;
              v.maxCoord = newMax;
              v.turnCooldown = 9.0;
              v.lateralOffset = 0;
              v.group.position.set(targetX, 0, targetZ);
              this.applyDirectionTransform(v);
              break;
            }
          }
        }
      }

      // Smoothly damp lateral evasive offset & speed
      v.lateralOffset = THREE.MathUtils.damp(v.lateralOffset, targetLateralOffset, 6, dt);
      v.currentSpeed = THREE.MathUtils.damp(v.currentSpeed, desiredSpeed, 8, dt);

      // Update Smart Driver HUD (shown when within 28m of player and active)
      const updateDriverHud = v.group.userData.updateDriverHud as
        | ((label: string, visible: boolean, color?: string) => void)
        | undefined;
      if (updateDriverHud) {
        const distToPlayer =
          playerX !== undefined && playerZ !== undefined
            ? Math.hypot(playerX - vx, playerZ - vz)
            : 999;
        const showHud = Boolean(driverHudText) && distToPlayer < 26;
        updateDriverHud(driverHudText, showHud, driverHudColor);
      }

      // Update Turn Signals / Hazard Blinkers & High-Beam Flash
      const blinkerPulse = Math.sin(elapsedTime * 14 + v.id) > 0;
      const blinkerLeftMat = v.group.userData.blinkerLeftMat as
        | THREE.MeshStandardMaterial
        | undefined;
      const blinkerRightMat = v.group.userData.blinkerRightMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (blinkerLeftMat && blinkerRightMat) {
        blinkerLeftMat.emissiveIntensity =
          blinkerMode === 'hazard' && blinkerPulse ? 3.2 : 0.12;
        blinkerRightMat.emissiveIntensity =
          (blinkerMode === 'right' || blinkerMode === 'hazard') && blinkerPulse ? 3.2 : 0.12;
      }
      const headMat = v.group.userData.headMat as THREE.MeshStandardMaterial | undefined;
      if (headMat) {
        headMat.emissiveIntensity =
          highBeamFlash && blinkerPulse ? 3.8 : timeShift === 'noite' ? 2.4 : 1.2;
      }

      // Spin 3D wheels & illuminate brake lights when decelerating/stopped
      const wheels = v.group.userData.wheels as THREE.Group[] | undefined;
      if (wheels) {
        const wheelSpin = (v.currentSpeed / 0.36) * dt;
        for (const w of wheels) {
          w.rotation.x += wheelSpin;
        }
      }
      const tailMat = v.group.userData.tailMat as THREE.MeshStandardMaterial | undefined;
      if (tailMat) {
        const isBraking = desiredSpeed < v.currentSpeed - 0.5 || v.currentSpeed < 1.2 || isStuckInJam;
        tailMat.emissiveIntensity = isBraking ? 2.8 : 0.75;
      }

      const step = v.currentSpeed * dt;

      if (v.direction === 'x_pos') {
        v.group.position.x += step;
        v.group.position.z = v.laneCoord + v.lateralOffset;
        if (v.group.position.x > v.maxCoord) v.group.position.x = v.minCoord;
      } else if (v.direction === 'x_neg') {
        v.group.position.x -= step;
        v.group.position.z = v.laneCoord + v.lateralOffset;
        if (v.group.position.x < v.minCoord) v.group.position.x = v.maxCoord;
      } else if (v.direction === 'z_pos') {
        v.group.position.z += step;
        v.group.position.x = v.laneCoord + v.lateralOffset;
        if (v.group.position.z > v.maxCoord) v.group.position.z = v.minCoord;
      } else if (v.direction === 'z_neg') {
        v.group.position.z -= step;
        v.group.position.x = v.laneCoord + v.lateralOffset;
        if (v.group.position.z < v.minCoord) v.group.position.z = v.maxCoord;
      }
    }
  }

  /**
   * Oriented Bounding Box collision check between player and traffic/police/bus vehicles.
   */
  public checkCollision(bikePos: THREE.Vector3): { collided: boolean; isPolice: boolean } {
    for (const v of this.vehicles) {
      if (!v.group.visible) continue;
      if (this.policeAssistTimer > 0 && v.id === this.assistVehicleId) continue;
      const carPos = v.group.position;
      const isHorizontal = v.direction === 'x_pos' || v.direction === 'x_neg';
      const lenHalf = v.isBus ? 3.85 : 2.25;
      const widHalf = v.isBus ? 1.24 : 1.08;
      const halfX = v.isPolice && this.wantedTimer > 0 ? 1.85 : isHorizontal ? lenHalf : widHalf;
      const halfZ = v.isPolice && this.wantedTimer > 0 ? 1.85 : isHorizontal ? widHalf : lenHalf;

      if (
        Math.abs(bikePos.x - carPos.x) < halfX &&
        Math.abs(bikePos.z - carPos.z) < halfZ
      ) {
        if (v.isPolice) {
          this.wantedTimer = 30.0;
        }
        return { collided: true, isPolice: v.isPolice };
      }
    }
    return { collided: false, isPolice: false };
  }
}



