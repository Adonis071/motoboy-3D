import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BikePhysics, CollisionBox } from './physics';
import { DELIVERY_POINTS } from './cityMap';
import { sound } from '../audio/soundEngine';
import {
  createAsphaltTexture,
  createSidewalkTexture,
  createLajotaFloorTexture,
  createDirtFloorTexture,
  createSandFloorTexture,
  createBuildingWindowTexture,
  createFavelaHouse,
  createRestaurantBuilding,
  createTrafficLightGantry,
  createPedestrian,
  createCharacterHealthBar,
  RoadTextures,
  OverheadHealthBar,
  TrafficLightGroup,
  PedestrianGroup,
} from './proceduralModels';

export interface CityEnvironment {
  groundMesh: THREE.Mesh;
  oceanMesh?: THREE.Mesh;
  collisionBoxes: CollisionBox[];
  animatables: Array<{ update: (dt: number, time: number) => void }>;
  getPedestrianPositions: () => THREE.Vector3[];
  checkPedestrianCollisions: (
    bikePhysics: BikePhysics,
    vehicles: Array<{ group: THREE.Group; currentSpeed: number }>,
    onPlayerHitPedestrian: (damage: number, remainingHealth: number, pedDefeated?: boolean) => void,
    lodDistanceScale?: number
  ) => void;
  applyMeleeToPedestrians: (
    playerPos: THREE.Vector3,
    damage: number,
    pushForce: number
  ) => { hit: boolean; defeated: boolean };
  reactPedestriansToHorn: (playerPos: THREE.Vector3) => void;
  triggerPedestrianPanicNear: (center: THREE.Vector3, radius?: number, reason?: string) => void;
  applySpecialExecutionToZombies: (playerPos: THREE.Vector3) => boolean;
  checkTrainingRings: (
    bikePos: THREE.Vector3,
    isWheelie: boolean,
    isTrainingMode: boolean,
    onPassRing: (bonusCoins: number, isWheelieBonus: boolean) => void
  ) => void;
  updateNightGhosts: (
    dt: number,
    elapsedTime: number,
    isDarkNight: boolean,
    playerPos: THREE.Vector3,
    playerHeading: number,
    headlightOn: boolean,
    onGhostScare: () => void
  ) => void;
  updateRoadEmissive: (isNight: boolean) => void;
  updateRoadWetness: (wetness: number) => void;
}

// Urban Avenue Grid Constants (shared with traffic.ts and rivalAI.ts)
export const VERTICAL_AVENUES_X = [
  -2400, -1800, -1200, -600, -70, -10, 50, 290, 350, 410, 600, 1200, 1800, 2400
];
export const HORIZONTAL_AVENUES_Z = [
  -2400, -1800, -1200, -600, -145, -70, -15, 45, 95, 145, 600, 1200, 1800, 2400
];
export const AVENUE_WIDTH = 14; // center ± 7m

export interface IntersectionSignalState {
  vertical: 'green' | 'yellow' | 'red';
  verticalRemaining: number;
  horizontal: 'green' | 'yellow' | 'red';
  horizontalRemaining: number;
}

/**
 * Dynamic 18-second Brazilian Traffic Signal Cycle with "Onda Verde" per-intersection phase offset
 * and live digital countdown timer seconds
 */
export function getTrafficSignalPhases(
  elapsedTime: number,
  aveX: number = -70,
  aveZ: number = -70
): IntersectionSignalState {
  // Subtle Green-Wave ("Onda Verde") offset per intersection
  const waveOffset = (aveX + 70) * 0.02 + (aveZ + 70) * 0.015;
  const totalCycle = 18.0;
  const cycle = (((elapsedTime + waveOffset) % totalCycle) + totalCycle) % totalCycle;

  if (cycle < 7.0) {
    return {
      vertical: 'green',
      verticalRemaining: 7.0 - cycle,
      horizontal: 'red',
      horizontalRemaining: 9.0 - cycle,
    };
  } else if (cycle < 9.0) {
    return {
      vertical: 'yellow',
      verticalRemaining: 9.0 - cycle,
      horizontal: 'red',
      horizontalRemaining: 9.0 - cycle,
    };
  } else if (cycle < 16.0) {
    return {
      vertical: 'red',
      verticalRemaining: 18.0 - cycle,
      horizontal: 'green',
      horizontalRemaining: 16.0 - cycle,
    };
  } else {
    return {
      vertical: 'red',
      verticalRemaining: 18.0 - cycle,
      horizontal: 'yellow',
      horizontalRemaining: 18.0 - cycle,
    };
  }
}

export function buildCityEnvironment(
  scene: THREE.Scene,
  performanceMode: 'low' | 'medium' | 'high' = 'high'
): CityEnvironment {
  const isLow = performanceMode === 'low';

  const collisionBoxes: CollisionBox[] = [];
  const animatables: Array<{ update: (dt: number, time: number) => void }> = [];

  // 1. REALISTIC INTERLOCKING PAVER / FLAGSTONE SIDEWALK TERRAIN (PISO DE LAJOTA URBANO)
  const sidewalkTex = createSidewalkTexture(isLow);
  sidewalkTex.wrapS = sidewalkTex.wrapT = THREE.RepeatWrapping;
  sidewalkTex.repeat.set(550, 550); // Crisp architectural lajota stone proportions without moiré
  sidewalkTex.colorSpace = THREE.SRGBColorSpace;
  sidewalkTex.generateMipmaps = true;
  sidewalkTex.minFilter = THREE.LinearMipmapLinearFilter;
  sidewalkTex.magFilter = THREE.LinearFilter;

  const groundGeo = new THREE.PlaneGeometry(5000, 5000);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    bumpMap: sidewalkTex,
    bumpScale: isLow ? 0.02 : 0.045,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.02,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.05; // Prevent coplanar z-fighting and color flashing when camera moves
  groundMesh.receiveShadow = !isLow;
  groundMesh.frustumCulled = false;
  groundMesh.userData.isGiantPlane = true;
  scene.add(groundMesh);

  // 1.5 GREEN URBAN PARK / LAWN PLOTS & ARCHITECTURAL PLAZA FLOORS INSIDE CITY BLOCKS (Merged via mergeGeometries!)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#15803d';
  gCtx.fillRect(0, 0, 256, 256);
  // Subtle mowed-lawn stripes & botanical turf grain
  for (let stripe = 0; stripe < 256; stripe += 32) {
    gCtx.fillStyle = (stripe / 32) % 2 === 0 ? 'rgba(22, 163, 74, 0.38)' : 'rgba(20, 83, 45, 0.25)';
    gCtx.fillRect(stripe, 0, 16, 256);
  }
  for (let i = 0; i < 1800; i++) {
    gCtx.fillStyle = Math.random() > 0.5 ? '#22c55e' : '#14532d';
    gCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(6, 6);
  grassTex.colorSpace = THREE.SRGBColorSpace;

  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    bumpMap: grassTex,
    bumpScale: 0.02,
    roughness: 0.85,
    metalness: 0.02,
  });
  const lawnBorderMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.55,
    metalness: 0.12,
  });
  const greenPlots = [
    { x: -40, z: -42, w: 32, d: 30 },
    { x: 20, z: -42, w: 34, d: 30 },
    { x: 20, z: -102, w: 34, d: 28 },
    { x: 70, z: -56, w: 20, d: 44 },
  ];
  const borderGeos: THREE.BufferGeometry[] = [];
  const lawnGeos: THREE.BufferGeometry[] = [];
  greenPlots.forEach(gp => {
    const bGeo = new THREE.BoxGeometry(gp.w + 1.2, 0.14, gp.d + 1.2);
    bGeo.translate(gp.x, 0.07, gp.z);
    borderGeos.push(bGeo);

    const lGeo = new THREE.BoxGeometry(gp.w, 0.16, gp.d);
    lGeo.translate(gp.x, 0.08, gp.z);
    lawnGeos.push(lGeo);
  });
  const mergedBorders = new THREE.Mesh(mergeGeometries(borderGeos), lawnBorderMat);
  mergedBorders.receiveShadow = !isLow;
  mergedBorders.geometry.computeBoundingSphere();
  mergedBorders.userData.isGiantPlane = true;
  scene.add(mergedBorders);

  const mergedLawns = new THREE.Mesh(mergeGeometries(lawnGeos), grassMat);
  mergedLawns.receiveShadow = !isLow;
  mergedLawns.geometry.computeBoundingSphere();
  mergedLawns.userData.isGiantPlane = true;
  scene.add(mergedLawns);

  // 1.6 ARCHITECTURAL DISTRICT PLAZAS (Centro Granite Compass Plazas, Industrial Concrete Aprons & Nova Metrópole Marble Esplanades)
  const createGranitePlazaTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d6dde6';
    ctx.fillRect(0, 0, 512, 512);

    // Checkerboard polished granite slabs
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#e2e8f0' : '#cbd5e1';
        ctx.fillRect(col * 64 + 2, r * 64 + 2, 60, 60);
      }
    }
    // Outer basalt & terracotta border frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 472, 472);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 440, 440);

    // Central Compass Rose Medallion (Rosa dos Ventos)
    ctx.save();
    ctx.translate(256, 256);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 84, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i % 2 === 0 ? '#0f172a' : '#d97706';
      ctx.beginPath();
      ctx.moveTo(0, -78);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const createIndustrialFloorTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);
    // Brushed reinforced concrete slabs
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#64748b' : '#526277';
        ctx.fillRect(col * 128 + 3, r * 128 + 3, 122, 122);
      }
    }
    // Yellow & Black industrial hazard perimeter stripes
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 512, 22);
    ctx.fillRect(0, 490, 512, 22);
    ctx.fillStyle = '#0f172a';
    for (let s = -32; s < 512; s += 32) {
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s + 16, 0);
      ctx.lineTo(s + 32, 22);
      ctx.lineTo(s + 16, 22);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s, 490);
      ctx.lineTo(s + 16, 490);
      ctx.lineTo(s + 32, 512);
      ctx.lineTo(s + 16, 512);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const createCrystalPlazaTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#1e293b' : '#172033';
        ctx.fillRect(col * 64 + 2, r * 64 + 2, 60, 60);
      }
    }
    // Gold & Cyan architectural luxury veins
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 3;
    for (let g = 64; g < 512; g += 128) {
      ctx.strokeRect(g - 48, g - 48, 96, 96);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, 476, 476);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const granitePlazaMat = new THREE.MeshStandardMaterial({
    map: createGranitePlazaTexture(),
    roughness: 0.48,
    metalness: 0.14,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const industrialFloorMat = new THREE.MeshStandardMaterial({
    map: createIndustrialFloorTexture(),
    roughness: 0.65,
    metalness: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const crystalPlazaMat = new THREE.MeshStandardMaterial({
    map: createCrystalPlazaTexture(),
    roughness: 0.32,
    metalness: 0.42,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Piso de Lajota Colonial / Terracota (Calçamento de Lajota para Centro & Jardins)
  const lajotaTex = createLajotaFloorTexture(isLow);
  lajotaTex.repeat.set(6, 6);
  const lajotaFloorMat = new THREE.MeshStandardMaterial({
    map: lajotaTex,
    bumpMap: lajotaTex,
    bumpScale: isLow ? 0.025 : 0.055,
    roughness: 0.68,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Piso de Terra Batida & Cascalho (Favela / Morro do Sol & Terrenos Rurais)
  const dirtTex = createDirtFloorTexture(isLow);
  dirtTex.repeat.set(5, 5);
  const dirtFloorMat = new THREE.MeshStandardMaterial({
    map: dirtTex,
    bumpMap: dirtTex,
    bumpScale: isLow ? 0.035 : 0.075,
    roughness: 0.92,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Piso de Areia de Praia Dourada (Orla da Praia & Quiosques Costeiros)
  const beachBlockSandTex = createSandFloorTexture(isLow);
  beachBlockSandTex.repeat.set(5, 5);
  const beachBlockSandMat = new THREE.MeshStandardMaterial({
    map: beachBlockSandTex,
    bumpMap: beachBlockSandTex,
    bumpScale: isLow ? 0.025 : 0.05,
    roughness: 0.88,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const addMergedFloorBlocks = (
    blocks: Array<{ x: number; z: number; w: number; d: number }>,
    y: number,
    mat: THREE.Material
  ) => {
    const geos = blocks.map(b => {
      const g = new THREE.PlaneGeometry(b.w, b.d);
      g.rotateX(-Math.PI / 2);
      g.translate(b.x, y, b.z);
      return g;
    });
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.receiveShadow = !isLow;
    m.geometry.computeBoundingSphere();
    m.userData.isGiantPlane = true;
    scene.add(m);
  };

  // 1) Place Piso de Lajota (Terracotta & Sandstone Flagstone Plazas in Centro & Jardins)
  addMergedFloorBlocks(
    [
      { x: -40, z: -102, w: 44, d: 44 },
      { x: 20, z: 18, w: 44, d: 44 },
      { x: 78, z: -42, w: 34, d: 44 },
      { x: 78, z: -102, w: 34, d: 44 },
    ],
    0.012,
    lajotaFloorMat
  );

  // Place Centro Compass Medallion Plaza
  addMergedFloorBlocks([{ x: -40, z: -42, w: 42, d: 42 }], 0.014, granitePlazaMat);

  // 2) Place Piso de Terra Batida (Compacted Earth & Gravel in Favela / Morro do Sol)
  addMergedFloorBlocks(
    [
      { x: -100, z: 18, w: 46, d: 46 },
      { x: -40, z: 18, w: 46, d: 46 },
      { x: -100, z: 82, w: 46, d: 48 },
      { x: -40, z: 82, w: 46, d: 48 },
      { x: -96, z: 138, w: 54, d: 38 },
    ],
    0.012,
    dirtFloorMat
  );

  // 3) Place Piso de Areia de Praia (Golden Coastal Sand in Orla da Praia & Kiosk Zone)
  addMergedFloorBlocks(
    [
      { x: 20, z: 82, w: 46, d: 46 },
      { x: 74, z: 18, w: 34, d: 46 },
      { x: 74, z: 82, w: 34, d: 52 },
      { x: 74, z: 136, w: 34, d: 42 },
    ],
    0.013,
    beachBlockSandMat
  );

  // 4) Place Polo Industrial Heavy-Duty Concrete & Asphalt Aprons
  addMergedFloorBlocks(
    [
      { x: -100, z: -102, w: 44, d: 44 },
      { x: -100, z: -42, w: 44, d: 44 },
    ],
    0.012,
    industrialFloorMat
  );

  // 5) Place Nova Metrópole Obsidian & Gold Marble Esplanades
  addMergedFloorBlocks(
    [
      { x: 350, z: -102, w: 42, d: 42 },
      { x: 350, z: -42, w: 42, d: 42 },
      { x: 350, z: 18, w: 42, d: 42 },
      { x: 350, z: 82, w: 42, d: 40 },
    ],
    0.012,
    crystalPlazaMat
  );

  // 2. DEDICATED ASPHALT AVENUE NETWORK (Vertical & Horizontal 14m Avenues - Merged into 2 Draw Calls!)
  const vRoadTextures = createAsphaltTexture(isLow);

  // Configure Vertical Road Textures (220 tiles across 5000m = ultra-crisp 22.7m per tile!)
  vRoadTextures.map.repeat.set(1, 220);
  vRoadTextures.bumpMap.repeat.set(1, 220);
  vRoadTextures.emissiveMap.repeat.set(1, 220);

  const vRoadMat = new THREE.MeshStandardMaterial({
    map: vRoadTextures.map,
    bumpMap: vRoadTextures.bumpMap,
    bumpScale: isLow ? 0.018 : 0.065,
    emissiveMap: vRoadTextures.emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.14,
    roughness: 0.58,
    metalness: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const vRoadGeos: THREE.BufferGeometry[] = [];
  VERTICAL_AVENUES_X.forEach(ax => {
    const vGeo = new THREE.PlaneGeometry(AVENUE_WIDTH, 5000);
    vGeo.rotateX(-Math.PI / 2);
    vGeo.translate(ax, 0.022, 0);
    vRoadGeos.push(vGeo);
  });
  const vRoadsMerged = new THREE.Mesh(mergeGeometries(vRoadGeos), vRoadMat);
  vRoadsMerged.receiveShadow = !isLow;
  vRoadsMerged.frustumCulled = false;
  vRoadsMerged.userData.isGiantPlane = true;
  scene.add(vRoadsMerged);

  // Horizontal Avenues (East-West along X)
  const hRoadTextures = createAsphaltTexture(isLow);

  // Configure Horizontal Road Textures (U=1 across 14m width, V=140 along avenue length)
  [hRoadTextures.map, hRoadTextures.bumpMap, hRoadTextures.emissiveMap].forEach(tex => {
    tex.repeat.set(1, 140);
  });

  const hRoadMat = new THREE.MeshStandardMaterial({
    map: hRoadTextures.map,
    bumpMap: hRoadTextures.bumpMap,
    bumpScale: isLow ? 0.015 : 0.045,
    emissiveMap: hRoadTextures.emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.14,
    roughness: 0.62,
    metalness: 0.15,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const hRoadGeos: THREE.BufferGeometry[] = [];
  HORIZONTAL_AVENUES_Z.forEach(az => {
    if (az === -15) {
      // Main Intercity Highway Avenue Z = -15 crosses the Ocean Bay via the 3D Cable-Stayed Bridge!
      const hGeo = new THREE.PlaneGeometry(AVENUE_WIDTH, 5000);
      hGeo.rotateX(-Math.PI / 2);
      hGeo.rotateY(Math.PI / 2);
      hGeo.translate(0, 0.028, az);
      hRoadGeos.push(hGeo);
    } else {
      // West City segment (stops before the Ocean Bay at X = 90)
      const westLen = 2590;
      const westGeo = new THREE.PlaneGeometry(AVENUE_WIDTH, westLen);
      westGeo.rotateX(-Math.PI / 2);
      westGeo.rotateY(Math.PI / 2);
      westGeo.translate(-2500 + westLen / 2, 0.028, az);
      hRoadGeos.push(westGeo);

      // East City ("Nova Metrópole") segment (starts after the Ocean Bay at X = 260)
      const eastLen = 2240;
      const eastGeo = new THREE.PlaneGeometry(AVENUE_WIDTH, eastLen);
      eastGeo.rotateX(-Math.PI / 2);
      eastGeo.rotateY(Math.PI / 2);
      eastGeo.translate(260 + eastLen / 2, 0.028, az);
      hRoadGeos.push(eastGeo);
    }
  });
  const hRoadsMerged = new THREE.Mesh(mergeGeometries(hRoadGeos), hRoadMat);
  hRoadsMerged.receiveShadow = !isLow;
  hRoadsMerged.frustumCulled = false;
  hRoadsMerged.userData.isGiantPlane = true;
  scene.add(hRoadsMerged);

  // 2.5 REALISTIC INTERSECTION CROSSWALKS (Faixas de Pedestre + Caixa Amarela Anti-Bloqueio + Piso Tátil)
  const interCanvas = document.createElement('canvas');
  interCanvas.width = 512;
  interCanvas.height = 512;
  const iCtx = interCanvas.getContext('2d')!;
  iCtx.fillStyle = '#181b20';
  iCtx.fillRect(0, 0, 512, 512);

  // Asphalt micro-aggregate grain on intersection
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = Math.floor(Math.random() * 28 + 20);
    iCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
    iCtx.fillRect(x, y, 1.5, 1.5);
  }

  // Brazilian Yellow Box-Junction Anti-Gridlock Grid in the center of the intersection (Caixa Amarela)
  iCtx.save();
  iCtx.beginPath();
  iCtx.rect(112, 112, 288, 288);
  iCtx.clip();
  iCtx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
  iCtx.lineWidth = 6;
  iCtx.strokeRect(115, 115, 282, 282);
  iCtx.lineWidth = 4;
  for (let d = -288; d <= 288; d += 48) {
    iCtx.beginPath();
    iCtx.moveTo(112 + d, 112);
    iCtx.lineTo(112 + d + 288, 400);
    iCtx.stroke();
    iCtx.beginPath();
    iCtx.moveTo(400 - d, 112);
    iCtx.lineTo(400 - d - 288, 400);
    iCtx.stroke();
  }
  iCtx.restore();

  // Red pedestrian safety background bands under zebra stripes (Brazilian urban standard)
  iCtx.fillStyle = 'rgba(185, 28, 28, 0.78)';
  iCtx.fillRect(46, 10, 420, 52); // North crosswalk band
  iCtx.fillRect(46, 450, 420, 52); // South crosswalk band
  iCtx.fillRect(10, 46, 52, 420); // West crosswalk band
  iCtx.fillRect(450, 46, 52, 420); // East crosswalk band

  // Crisp white zebra crosswalk stripes on all 4 edges
  iCtx.fillStyle = '#f8fafc';
  for (let s = 56; s < 456; s += 36) {
    iCtx.fillRect(s, 14, 20, 44); // North
    iCtx.fillRect(s, 454, 20, 44); // South
    iCtx.fillRect(14, s, 44, 20); // West
    iCtx.fillRect(454, s, 44, 20); // East
  }

  // White Stop Bars (Faixas de Retenção de Semáforo)
  iCtx.fillStyle = '#ffffff';
  iCtx.fillRect(48, 68, 195, 8);
  iCtx.fillRect(269, 436, 195, 8);
  iCtx.fillRect(68, 269, 8, 195);
  iCtx.fillRect(436, 48, 8, 195);

  // Yellow tactile warning pavers on the 4 sidewalk corners
  iCtx.fillStyle = '#facc15';
  iCtx.fillRect(0, 0, 42, 42);
  iCtx.fillRect(470, 0, 42, 42);
  iCtx.fillRect(0, 470, 42, 42);
  iCtx.fillRect(470, 470, 42, 42);

  const interTex = new THREE.CanvasTexture(interCanvas);
  interTex.colorSpace = THREE.SRGBColorSpace;
  
  // Intersection bump mapping (simpler noise-based bump for intersections)
  const interBumpCanvas = document.createElement('canvas');
  interBumpCanvas.width = 512;
  interBumpCanvas.height = 512;
  const ibCtx = interBumpCanvas.getContext('2d')!;
  ibCtx.fillStyle = '#808080';
  ibCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 128 + (Math.random() - 0.5) * 30;
    ibCtx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ibCtx.fillRect(x, y, 1.5, 1.5);
  }
  const interBumpMap = new THREE.CanvasTexture(interBumpCanvas);
  interBumpMap.wrapS = interBumpMap.wrapT = THREE.RepeatWrapping;

  // Intersection emissive mask (reflective paint for crosswalks)
  const interEmissiveCanvas = document.createElement('canvas');
  interEmissiveCanvas.width = 512;
  interEmissiveCanvas.height = 512;
  const ieCtx = interEmissiveCanvas.getContext('2d')!;
  ieCtx.fillStyle = '#000000';
  ieCtx.fillRect(0, 0, 512, 512);
  ieCtx.fillStyle = '#ffffff';
  // Zebra stripes
  for (let s = 56; s < 456; s += 36) {
    ieCtx.fillRect(s, 14, 20, 44); // North
    ieCtx.fillRect(s, 454, 20, 44); // South
    ieCtx.fillRect(14, s, 44, 20); // West
    ieCtx.fillRect(454, s, 44, 20); // East
  }
  // Stop Bars
  ieCtx.fillRect(48, 68, 195, 8);
  ieCtx.fillRect(269, 436, 195, 8);
  ieCtx.fillRect(68, 269, 8, 195);
  ieCtx.fillRect(436, 48, 8, 195);

  const interEmissiveMap = new THREE.CanvasTexture(interEmissiveCanvas);

  const interMat = new THREE.MeshStandardMaterial({
    map: interTex,
    bumpMap: interBumpMap,
    bumpScale: 0.025,
    emissiveMap: interEmissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.1,
    roughness: 0.68,
    metalness: 0.14,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  // 2.6 STREET DEBRIS & DETAILS (GPU InstancedMesh = 1 Draw Call for 200 items!)
  if (!isLow) {
    const debrisColors = [0x94a3b8, 0x475569, 0x1e293b, 0xa3e635]; // Concrete, dark trash, dead leaves
    const debrisGeo = new THREE.PlaneGeometry(0.15, 0.15);
    debrisGeo.rotateX(-Math.PI / 2);
    const debrisMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    const debrisInstanced = new THREE.InstancedMesh(debrisGeo, debrisMat, 200);
    debrisInstanced.frustumCulled = false;
    debrisInstanced.renderOrder = 2;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    for (let i = 0; i < 200; i++) {
      const isLeaf = Math.random() < 0.3;
      const colHex = isLeaf
        ? 0x15803d
        : debrisColors[Math.floor(Math.random() * debrisColors.length)];
      const aveX = VERTICAL_AVENUES_X[Math.floor(Math.random() * VERTICAL_AVENUES_X.length)];
      const x = aveX + (Math.random() - 0.5) * 16;
      const z = (Math.random() - 0.5) * 300;
      dummy.position.set(x, 0.04, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      debrisInstanced.setMatrixAt(i, dummy.matrix);
      debrisInstanced.setColorAt(i, tempColor.setHex(colHex));
    }
    debrisInstanced.instanceMatrix.needsUpdate = true;
    if (debrisInstanced.instanceColor) debrisInstanced.instanceColor.needsUpdate = true;
    scene.add(debrisInstanced);
  }

  // 2.8 DYNAMIC 3D TRAFFIC LIGHT GANTRIES (SEMÁFOROS COM CRONÔMETRO DIGITAL) AT ALL 12 INTERSECTIONS
  const intersectionNodes: Array<{
    ax: number;
    az: number;
    vSignal: TrafficLightGroup;
    hSignal: TrafficLightGroup;
  }> = [];

  const intersectionGeos: THREE.BufferGeometry[] = [];
  VERTICAL_AVENUES_X.forEach((ax, aveIdx) => {
    HORIZONTAL_AVENUES_Z.forEach((az, zIdx) => {
      const isCoreIntersection =
        (Math.abs(ax) <= 100 || (ax >= 280 && ax <= 420)) && Math.abs(az) <= 160;
      if (!isCoreIntersection && isLow) return;

      const iGeo = new THREE.PlaneGeometry(AVENUE_WIDTH + 1.8, AVENUE_WIDTH + 1.8);
      iGeo.rotateX(-Math.PI / 2);
      iGeo.translate(ax, 0.036, az);
      intersectionGeos.push(iGeo);

      if (!isCoreIntersection) return;
      if (isLow && (aveIdx + zIdx) % 2 !== 0) return;

      // 1) Traffic Light Gantry for Vertical Avenue (North/South traffic)
      const vSignal = createTrafficLightGantry(isLow);
      vSignal.position.set(ax - 8.2, 0, az - 8.2);
      vSignal.rotation.y = 0;
      scene.add(vSignal);

      collisionBoxes.push({
        minX: ax - 8.65,
        maxX: ax - 7.75,
        minZ: az - 8.65,
        maxZ: az - 7.75,
      });

      // 2) Traffic Light Gantry for Horizontal Avenue (East/West traffic)
      const hSignal = createTrafficLightGantry(isLow);
      hSignal.position.set(ax + 8.2, 0, az - 8.2);
      hSignal.rotation.y = -Math.PI / 2;
      scene.add(hSignal);

      collisionBoxes.push({
        minX: ax + 7.75,
        maxX: ax + 8.65,
        minZ: az - 8.65,
        maxZ: az - 7.75,
      });

      intersectionNodes.push({ ax, az, vSignal, hSignal });
    });
  });

  if (intersectionGeos.length > 0) {
    const intersectionsMerged = new THREE.Mesh(mergeGeometries(intersectionGeos), interMat);
    intersectionsMerged.receiveShadow = !isLow;
    intersectionsMerged.frustumCulled = false;
    intersectionsMerged.userData.isGiantPlane = true;
    scene.add(intersectionsMerged);
  }

  // Animate all 24 Traffic Light Gantries with their live LED countdown timers!
  animatables.push({
    update: (_dt, time) => {
      for (const node of intersectionNodes) {
        const phases = getTrafficSignalPhases(time, node.ax, node.az);
        node.vSignal.setPhase(phases.vertical, phases.verticalRemaining);
        node.hSignal.setPhase(phases.horizontal, phases.horizontalRemaining);
      }
    },
  });

  // 3. COMMERCIAL RESTAURANTS (Hamburguerias, Pizzarias, Padaria, Farmácia, Mercado, Sushi, Açaí) & WAVING 3D CUSTOMERS
  const extraStorefronts: typeof DELIVERY_POINTS = [
    {
      id: 'store_padaria_centro',
      name: 'Padaria & Confeitaria Pão Dourado',
      shortSign: 'PADARIA PÃO DOURADO',
      categoryLabel: 'Padaria & Café',
      category: 'lanchonete',
      type: 'restaurant',
      districtId: 'centro',
      x: -15.5,
      z: -95,
      buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
      primaryColor: 0xb45309,
      accentColor: 0xfacc15,
      icon: '🥖',
    },
    {
      id: 'store_farmacia_centro',
      name: 'Farmácia & Drogaria Vida 24h',
      shortSign: 'FARMÁCIA VIDA 24H',
      categoryLabel: 'Farmácia Express',
      category: 'restaurante',
      type: 'restaurant',
      districtId: 'centro',
      x: -5.5,
      z: 18,
      buildingOffset: { dx: 7.5, dz: 0, rotationY: -Math.PI / 2 },
      primaryColor: 0x0f172a,
      accentColor: 0x10b981,
      icon: '💊',
    },
    {
      id: 'store_mercado_jardins',
      name: 'Supermercado & Hortifruti Bom Preço',
      shortSign: 'MERCADO BOM PREÇO',
      categoryLabel: 'Supermercado Delivery',
      category: 'restaurante',
      type: 'restaurant',
      districtId: 'jardins',
      x: 44.5,
      z: -95,
      buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
      primaryColor: 0x047857,
      accentColor: 0xf97316,
      icon: '🛒',
    },
  ];

  const customerActors: Array<{
    mesh: PedestrianGroup;
    x: number;
    z: number;
    phase: number;
  }> = [];

  [...DELIVERY_POINTS, ...extraStorefronts].forEach((point, ptIdx) => {
    if (point.type === 'restaurant') {
      const restGroup = createRestaurantBuilding(point, isLow);
      scene.add(restGroup);

      // Register solid collision box for the 3D storefront building
      const off = point.buildingOffset || { dx: -7.5, dz: 0, rotationY: 0 };
      const bx = point.x + off.dx;
      const bz = point.z + off.dz;
      collisionBoxes.push({
        minX: bx - 4.8,
        maxX: bx + 4.8,
        minZ: bz - 4.8,
        maxZ: bz + 4.8,
      });
    } else {
      // Customer Dropoff Bay Marking on the road curb
      const custCanvas = document.createElement('canvas');
      custCanvas.width = 256;
      custCanvas.height = 256;
      const cCtx = custCanvas.getContext('2d')!;
      cCtx.strokeStyle = '#10b981';
      cCtx.lineWidth = 10;
      cCtx.setLineDash([22, 14]);
      cCtx.strokeRect(16, 16, 224, 224);

      cCtx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      cCtx.fillRect(20, 20, 216, 216);

      cCtx.fillStyle = '#ffffff';
      cCtx.font = '900 28px sans-serif';
      cCtx.textAlign = 'center';
      cCtx.fillText(point.icon + ' ENTREGA', 128, 115);
      cCtx.fillStyle = '#6ee7b7';
      cCtx.font = 'bold 22px sans-serif';
      cCtx.fillText(point.shortSign, 128, 154);

      const custTex = new THREE.CanvasTexture(custCanvas);
      custTex.colorSpace = THREE.SRGBColorSpace;
      const custBay = new THREE.Mesh(
        new THREE.PlaneGeometry(4.8, 4.8),
        new THREE.MeshBasicMaterial({
          map: custTex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -5,
          polygonOffsetUnits: -5,
        })
      );
      custBay.rotation.x = -Math.PI / 2;
      custBay.position.set(point.x, 0.046, point.z);
      custBay.renderOrder = 3;
      custBay.frustumCulled = false;
      scene.add(custBay);

      // 3D Waiting Customer Actor on the sidewalk beside the delivery bay (waves when player approaches!)
      const custSkins = [0xfde68a, 0xf59e0b, 0xd97706, 0x92400e, 0xfcd34d];
      const custPants = [0x1e293b, 0x1e3a8a, 0x27272a, 0x334155];
      const custMesh = createPedestrian(
        point.primaryColor || 0x10b981,
        custPants[ptIdx % custPants.length],
        custSkins[ptIdx % custSkins.length],
        ptIdx % 2 === 0,
        isLow,
        ptIdx + 3
      );
      const curbOffsetX = point.x < 0 ? -2.3 : 2.3;
      custMesh.position.set(point.x + curbOffsetX, 0, point.z);
      custMesh.rotation.y = curbOffsetX < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(custMesh);
      customerActors.push({
        mesh: custMesh,
        x: point.x + curbOffsetX,
        z: point.z,
        phase: ptIdx * 1.1,
      });
    }
  });

  // 4. OCEAN BAY CHANNEL (X: 96 to 254) + MONUMENTAL 3D CABLE-STAYED BRIDGE + SECOND CITY ("NOVA METRÓPOLE")
  const oceanGeo = new THREE.PlaneGeometry(158, 640, 24, 24);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.78,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(175, 0.025, 0);
  oceanMesh.renderOrder = 1;
  oceanMesh.frustumCulled = false;
  oceanMesh.userData.isGiantPlane = true;
  scene.add(oceanMesh);

  // West Beach Sand Strip (Orla da Praia, X = 80 to 99) & East Beach Sand Strip (Nova Metrópole, X = 250 to 268)
  const sandTex = createSandFloorTexture(isLow);
  sandTex.repeat.set(3, 38);

  const sandMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    bumpMap: sandTex,
    bumpScale: 0.04,
    roughness: 0.86,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const sandStripGeos = [
    { w: 22, d: 290, x: 89, z: -170 },
    { w: 22, d: 310, x: 89, z: 150 },
    { w: 20, d: 290, x: 259, z: -170 },
    { w: 20, d: 310, x: 259, z: 150 },
  ].map(s => {
    const g = new THREE.PlaneGeometry(s.w, s.d);
    g.rotateX(-Math.PI / 2);
    g.translate(s.x, 0.032, s.z);
    return g;
  });
  const mergedCoastalSand = new THREE.Mesh(mergeGeometries(sandStripGeos), sandMat);
  mergedCoastalSand.userData.isGiantPlane = true;
  mergedCoastalSand.geometry.computeBoundingSphere();
  scene.add(mergedCoastalSand);

  // Iconic Brazilian Copacabana Portuguese Wave Mosaic Boardwalk + Red Coastal Bike Path (Calçadão de Pedra Portuguesa + Ciclovia)
  const copaCanvas = document.createElement('canvas');
  copaCanvas.width = 512;
  copaCanvas.height = 512;
  const ccCtx = copaCanvas.getContext('2d')!;
  ccCtx.fillStyle = '#f8fafc';
  ccCtx.fillRect(0, 0, 512, 512);
  // Black & White sinuous Copacabana wave bands (left 340px)
  ccCtx.fillStyle = '#0f172a';
  for (let band = -64; band < 576; band += 64) {
    ccCtx.beginPath();
    for (let x = 0; x <= 340; x += 8) {
      const y = band + Math.sin((x / 340) * Math.PI * 4) * 18;
      if (x === 0) ccCtx.moveTo(x, y);
      else ccCtx.lineTo(x, y);
    }
    for (let x = 340; x >= 0; x -= 8) {
      const y = band + 32 + Math.sin((x / 340) * Math.PI * 4) * 18;
      ccCtx.lineTo(x, y);
    }
    ccCtx.closePath();
    ccCtx.fill();
  }
  // Stone mosaic mortar grid lines
  ccCtx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
  ccCtx.lineWidth = 1;
  for (let gx = 0; gx < 340; gx += 8) {
    ccCtx.beginPath();
    ccCtx.moveTo(gx, 0);
    ccCtx.lineTo(gx, 512);
    ccCtx.stroke();
  }
  // Red Coastal Bike Path (Ciclovia da Orla) on right 172px
  ccCtx.fillStyle = '#b91c1c';
  ccCtx.fillRect(340, 0, 172, 512);
  ccCtx.fillStyle = '#f8fafc';
  ccCtx.fillRect(340, 0, 8, 512);
  ccCtx.fillRect(504, 0, 8, 512);
  // Dashed yellow centerline inside bike path
  ccCtx.fillStyle = '#facc15';
  for (let by = 16; by < 512; by += 64) {
    ccCtx.fillRect(422, by, 6, 34);
  }
  const copaTex = new THREE.CanvasTexture(copaCanvas);
  copaTex.wrapS = copaTex.wrapT = THREE.RepeatWrapping;
  copaTex.repeat.set(1, 42);
  copaTex.colorSpace = THREE.SRGBColorSpace;

  const copaMat = new THREE.MeshStandardMaterial({
    map: copaTex,
    bumpMap: copaTex,
    bumpScale: 0.025,
    roughness: 0.62,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const boardwalkGeos = [
    { x: 80.2, z: -170, d: 290 },
    { x: 80.2, z: 150, d: 310 },
    { x: 268.2, z: -170, d: 290 },
    { x: 268.2, z: 150, d: 310 },
  ].map(bw => {
    const g = new THREE.PlaneGeometry(7.2, bw.d);
    g.rotateX(-Math.PI / 2);
    g.translate(bw.x, 0.038, bw.z);
    return g;
  });
  const mergedBoardwalks = new THREE.Mesh(mergeGeometries(boardwalkGeos), copaMat);
  mergedBoardwalks.userData.isGiantPlane = true;
  mergedBoardwalks.geometry.computeBoundingSphere();
  scene.add(mergedBoardwalks);

  // Solid Coastal Seawall Barriers along the Ocean Channel (leaving the Z = -15 Bridge Corridor open!)
  collisionBoxes.push(
    { minX: 98, maxX: 252, minZ: -320, maxZ: -23.5 },
    { minX: 98, maxX: 252, minZ: -6.5, maxZ: 320 }
  );

  // 4.2 MONUMENTAL 3D CABLE-STAYED SUSPENSION BRIDGE (PONTE ESTAIADA INTERMUNICIPAL, X = 88 to 262, Z = -15)
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'intercity_cable_stayed_bridge';

  const bridgeConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.45,
    metalness: 0.25,
  });
  const bridgeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.85,
  });
  const bridgeCableMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.9,
  });
  const bridgeNeonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
  const bridgeNeonGoldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // A) Bridge Structural Deck Roadway, Expansion Joints, Guardrails & Illuminated Neon Strips (Length = 174m)
  const bridgeCenterX = 175;
  const bridgeCenterZ = -15;
  const bridgeLength = 174;

  // Dedicated high-detail Bridge Asphalt Roadway Deck (elevated above the ocean mesh!)
  const bridgeRoadTextures = createAsphaltTexture(isLow);
  [bridgeRoadTextures.map, bridgeRoadTextures.bumpMap, bridgeRoadTextures.emissiveMap].forEach(tex => {
    tex.rotation = Math.PI / 2;
    tex.center.set(0.5, 0.5);
    tex.repeat.set(9, 1);
  });
  const bridgeRoadMat = new THREE.MeshStandardMaterial({
    map: bridgeRoadTextures.map,
    bumpMap: bridgeRoadTextures.bumpMap,
    bumpScale: 0.05,
    emissiveMap: bridgeRoadTextures.emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.18,
    roughness: 0.55,
    metalness: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const bridgeDeckRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(bridgeLength, AVENUE_WIDTH),
    bridgeRoadMat
  );
  bridgeDeckRoad.rotation.x = -Math.PI / 2;
  bridgeDeckRoad.position.set(bridgeCenterX, 0.068, bridgeCenterZ);
  bridgeDeckRoad.receiveShadow = true;
  bridgeDeckRoad.frustumCulled = false;
  bridgeGroup.add(bridgeDeckRoad);

  // Concrete Box-Girder Under-Deck Structure & Transverse Steel Expansion Joints
  const bridgeUnderDeck = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength, 0.7, 17.6),
    bridgeConcreteMat
  );
  bridgeUnderDeck.position.set(bridgeCenterX, -0.32, bridgeCenterZ);
  bridgeGroup.add(bridgeUnderDeck);

  for (let jx = 96; jx <= 254; jx += 22) {
    const expJoint = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.02, AVENUE_WIDTH - 0.8),
      bridgeSteelMat
    );
    expJoint.position.set(jx, 0.065, bridgeCenterZ);
    bridgeGroup.add(expJoint);
  }

  const northParapet = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength, 1.35, 0.9),
    bridgeConcreteMat
  );
  northParapet.position.set(bridgeCenterX, 0.68, bridgeCenterZ - 8.4);
  const southParapet = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength, 1.35, 0.9),
    bridgeConcreteMat
  );
  southParapet.position.set(bridgeCenterX, 0.68, bridgeCenterZ + 8.4);

  const northNeonTube = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength, 0.22, 0.98),
    bridgeNeonCyanMat
  );
  northNeonTube.position.set(bridgeCenterX, 1.42, bridgeCenterZ - 8.4);
  const southNeonTube = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength, 0.22, 0.98),
    bridgeNeonCyanMat
  );
  southNeonTube.position.set(bridgeCenterX, 1.42, bridgeCenterZ + 8.4);

  // Side Pedestrian/Cyclist Boardwalks on the Bridge
  const boardwalkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
  const northWalkway = new THREE.Mesh(new THREE.BoxGeometry(bridgeLength, 0.16, 1.3), boardwalkMat);
  northWalkway.position.set(bridgeCenterX, 0.11, bridgeCenterZ - 7.3);
  const southWalkway = new THREE.Mesh(new THREE.BoxGeometry(bridgeLength, 0.16, 1.3), boardwalkMat);
  southWalkway.position.set(bridgeCenterX, 0.11, bridgeCenterZ + 7.3);

  bridgeGroup.add(
    northParapet,
    southParapet,
    northNeonTube,
    southNeonTube,
    northWalkway,
    southWalkway
  );

  // Register solid guardrails along the bridge edges so vehicles never fall into the sea
  collisionBoxes.push(
    { minX: 88, maxX: 262, minZ: bridgeCenterZ - 9.2, maxZ: bridgeCenterZ - 7.8 },
    { minX: 88, maxX: 262, minZ: bridgeCenterZ + 7.8, maxZ: bridgeCenterZ + 9.2 }
  );

  // B) Twin 68m Colossal H-Frame Cable-Stayed Pylon Towers (Torres Estaiadas em X = 140 e X = 210)
  const pylonXCoords = [140, 210];
  const towerHeight = 68;

  pylonXCoords.forEach((px, pIdx) => {
    // North & South Tower Legs straddling the 18m bridge deck
    const legN = new THREE.Mesh(new THREE.BoxGeometry(3.4, towerHeight, 2.8), bridgeConcreteMat);
    legN.position.set(px, towerHeight / 2, bridgeCenterZ - 9.4);
    legN.castShadow = true;
    const legS = new THREE.Mesh(new THREE.BoxGeometry(3.4, towerHeight, 2.8), bridgeConcreteMat);
    legS.position.set(px, towerHeight / 2, bridgeCenterZ + 9.4);
    legS.castShadow = true;

    // Upper & Mid Horizontal Cross-Girders (Vigas Transversais)
    const crossUpper = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.8, 21.6), bridgeConcreteMat);
    crossUpper.position.set(px, 56, bridgeCenterZ);
    const crossMid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 21.6), bridgeConcreteMat);
    crossMid.position.set(px, 32, bridgeCenterZ);

    // Neon Crown & Vertical LED Stripes on the Pylon Towers
    const crossNeonUpper = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.65, 21.8),
      pIdx === 0 ? bridgeNeonCyanMat : bridgeNeonGoldMat
    );
    crossNeonUpper.position.set(px, 57.6, bridgeCenterZ);
    const crossNeonMid = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.5, 21.8),
      pIdx === 0 ? bridgeNeonGoldMat : bridgeNeonCyanMat
    );
    crossNeonMid.position.set(px, 32, bridgeCenterZ);

    // Aviation Red Strobe Beacons on Pylon Summits
    const beaconN = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), beaconRedMat);
    beaconN.position.set(px, towerHeight + 0.6, bridgeCenterZ - 9.4);
    const beaconS = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), beaconRedMat);
    beaconS.position.set(px, towerHeight + 0.6, bridgeCenterZ + 9.4);

    bridgeGroup.add(
      legN,
      legS,
      crossUpper,
      crossMid,
      crossNeonUpper,
      crossNeonMid,
      beaconN,
      beaconS
    );

    // C) Fan of 16 Diagonal Steel Stay Cables per Pylon Tower (32 Stay Cables Total!)
    const cableSpanOffsets = [-34, -24, -15, -7, 7, 15, 24, 34];
    cableSpanOffsets.forEach(dx => {
      [-8.6, 8.6].forEach(dz => {
        const startPt = new THREE.Vector3(px, 58, bridgeCenterZ + (dz < 0 ? -9.1 : 9.1));
        const endPt = new THREE.Vector3(px + dx, 1.35, bridgeCenterZ + dz);
        const cableVec = new THREE.Vector3().subVectors(endPt, startPt);
        const cableLen = cableVec.length();
        const cableMid = new THREE.Vector3().addVectors(startPt, endPt).multiplyScalar(0.5);

        const cableMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, cableLen, 6),
          bridgeCableMat
        );
        cableMesh.position.copy(cableMid);
        cableMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          cableVec.clone().normalize()
        );
        bridgeGroup.add(cableMesh);
      });
    });
  });

  // D) Overhead LED Bridge Lighting Arches & Entrance/Exit Highway Portals
  const buildBridgePortal = (xPos: number, titleText: string, subText: string, borderHex: string) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(xPos, 0, bridgeCenterZ);

    const postN = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 8.5, 10), bridgeSteelMat);
    postN.position.set(0, 4.25, -8.8);
    const postS = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 8.5, 10), bridgeSteelMat);
    postS.position.set(0, 4.25, 8.8);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 18.4), bridgeSteelMat);
    beam.position.set(0, 8.2, 0);
    pGroup.add(postN, postS, beam);

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 112;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 512, 112);
      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 504, 104);
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(titleText, 256, 44);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(subText, 256, 82);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 2.3, 14.2),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.position.set(0, 8.4, 0);
    pGroup.add(board);
    bridgeGroup.add(pGroup);
  };

  buildBridgePortal(
    90,
    '🌉 PONTE ESTAIADA INTERMUNICIPAL',
    'SIGA EM FRENTE ➔ NOVA METRÓPOLE (OUTRA CIDADE)',
    '#00f3ff'
  );
  buildBridgePortal(
    260,
    '🏙️ BEM-VINDO A NOVA METRÓPOLE',
    'ILHA DE CRISTAL • GRAND CASSINO & TORRE PANORÂMICA',
    '#facc15'
  );

  scene.add(bridgeGroup);

  // E) Animated 3D Ships Sailing in the Ocean Bay Channel under the Bridge
  const createOceanVessel = (hullColor: number, xPos: number, zStart: number) => {
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 2.6, 22),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.4 })
    );
    hull.position.y = 1.1;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(5.8, 3.4, 7.5),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    cabin.position.set(0, 3.8, -3.5);
    const bridgeWin = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.9, 7.7),
      bridgeNeonCyanMat
    );
    bridgeWin.position.set(0, 4.5, -3.5);
    ship.add(hull, cabin, bridgeWin);
    ship.position.set(xPos, 0.05, zStart);
    scene.add(ship);
    return ship;
  };

  const ship1 = createOceanVessel(0xdc2626, 162, -95);
  ship1.userData.isDynamic = true;
  const ship2 = createOceanVessel(0x0284c7, 192, 95);
  ship2.userData.isDynamic = true;

  animatables.push({
    update: (dt, time) => {
      oceanMesh.position.y = 0.015 + Math.sin(time * 2) * 0.022;
      // Sail ships gently along the bay channel
      ship1.position.z += 4.2 * dt;
      if (ship1.position.z > 190) ship1.position.z = -190;
      ship1.position.y = 0.05 + Math.sin(time * 1.8) * 0.14;

      ship2.position.z -= 3.8 * dt;
      if (ship2.position.z < -190) ship2.position.z = 190;
      ship2.position.y = 0.05 + Math.cos(time * 1.8) * 0.14;
    },
  });

  // 4.5 SECOND CITY ACROSS THE BRIDGE: "NOVA METRÓPOLE • ILHA DE CRISTAL" (X = 265 to 455, Z = -180 to +180)
  const newCityGroup = new THREE.Group();
  newCityGroup.name = 'nova_metropole_other_city';

  // 1) Futuristic Glass & Neon Skyscrapers of Nova Metrópole
  const novaTowers = [
    { x: 320, z: -105, w: 20, d: 20, h: 92, neon: 0x00f3ff },
    { x: 380, z: -105, w: 22, d: 22, h: 112, neon: 0xa855f7 },
    { x: 320, z: -42, w: 18, d: 18, h: 78, neon: 0x34d399 },
    { x: 380, z: -42, w: 20, d: 20, h: 98, neon: 0xfacc15 },
    { x: 435, z: -105, w: 20, d: 20, h: 86, neon: 0xf43f5e },
    { x: 435, z: -42, w: 18, d: 18, h: 74, neon: 0x00f3ff },
    { x: 435, z: 20, w: 20, d: 20, h: 88, neon: 0xa855f7 },
  ].filter((_, i) => !isLow || i % 2 === 0);

  const novaGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.18,
    metalness: 0.88,
  });

  novaTowers.forEach(nt => {
    const tGrp = new THREE.Group();
    tGrp.position.set(nt.x, 0, nt.z);

    const towerBody = new THREE.Mesh(new THREE.BoxGeometry(nt.w, nt.h, nt.d), novaGlassMat);
    towerBody.position.y = nt.h / 2;
    towerBody.castShadow = true;
    towerBody.receiveShadow = true;
    tGrp.add(towerBody);

    const neonMat = new THREE.MeshBasicMaterial({ color: nt.neon });
    const crownBand = new THREE.Mesh(new THREE.BoxGeometry(nt.w + 0.6, 1.3, nt.d + 0.6), neonMat);
    crownBand.position.y = nt.h - 1.5;
    const midBand = new THREE.Mesh(new THREE.BoxGeometry(nt.w + 0.5, 0.8, nt.d + 0.5), neonMat);
    midBand.position.y = nt.h * 0.55;
    const lobbyBand = new THREE.Mesh(new THREE.BoxGeometry(nt.w + 0.8, 3.2, nt.d + 0.8), neonMat);
    lobbyBand.position.y = 1.8;
    tGrp.add(crownBand, midBand, lobbyBand);

    newCityGroup.add(tGrp);

    collisionBoxes.push({
      minX: nt.x - (nt.w + 1.2) / 2,
      maxX: nt.x + (nt.w + 1.2) / 2,
      minZ: nt.z - (nt.d + 1.2) / 2,
      maxZ: nt.z + (nt.d + 1.2) / 2,
    });
  });

  // 2) Iconic 115m Rotating Observation Needle Tower ("Torre Panorâmica de Cristal", X = 320, Z = 16)
  const needleGroup = new THREE.Group();
  needleGroup.position.set(320, 0, 16);
  const needleShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 4.8, 96, 16),
    bridgeConcreteMat
  );
  needleShaft.position.y = 48;
  const needlePod = new THREE.Group();
  needlePod.position.y = 82;
  const podDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(11.5, 9.5, 5.5, 24),
    novaGlassMat
  );
  const podNeonRing = new THREE.Mesh(
    new THREE.TorusGeometry(11.6, 0.38, 10, 32),
    bridgeNeonCyanMat
  );
  podNeonRing.rotation.x = Math.PI / 2;
  needlePod.add(podDisc, podNeonRing);
  const needleSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 1.2, 24, 10),
    bridgeSteelMat
  );
  needleSpire.position.y = 104;
  needleGroup.add(needleShaft, needlePod, needleSpire);
  newCityGroup.add(needleGroup);

  collisionBoxes.push({
    minX: 320 - 5.5,
    maxX: 320 + 5.5,
    minZ: 16 - 5.5,
    maxZ: 16 + 5.5,
  });

  // 3) Grand Casino & Resort Palace ("🎰 GRAND CASSINO & RESORT • NOVA METRÓPOLE", X = 380, Z = 18)
  const casinoGroup = new THREE.Group();
  casinoGroup.position.set(380, 0, 18);
  const casinoBase = new THREE.Mesh(
    new THREE.BoxGeometry(26, 16, 22),
    new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.3, metalness: 0.6 })
  );
  casinoBase.position.y = 8;
  const casinoGoldDome = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0xca8a04,
      emissiveIntensity: 0.4,
    })
  );
  casinoGoldDome.position.y = 16;
  const casinoNeonTrim = new THREE.Mesh(
    new THREE.BoxGeometry(26.6, 1.1, 22.6),
    bridgeNeonGoldMat
  );
  casinoNeonTrim.position.y = 15.2;
  casinoGroup.add(casinoBase, casinoGoldDome, casinoNeonTrim);
  newCityGroup.add(casinoGroup);

  collisionBoxes.push({
    minX: 380 - 13.5,
    maxX: 380 + 13.5,
    minZ: 18 - 11.5,
    maxZ: 18 + 11.5,
  });

  // 4) Luxury Waterfront Villas & Green Lawns in Southern Nova Metrópole (X = 320..385, Z = 70..120)
  const novaVillaCoords = [
    { x: 320, z: 72, color: 0xfef3c7 },
    { x: 380, z: 72, color: 0xe0e7ff },
    { x: 320, z: 120, color: 0xdcfce7 },
    { x: 380, z: 120, color: 0xfce7f3 },
  ];
  novaVillaCoords.forEach(nv => {
    const vGrp = new THREE.Group();
    vGrp.position.set(nv.x, 0, nv.z);
    const vBody = new THREE.Mesh(
      new THREE.BoxGeometry(13, 7, 12),
      new THREE.MeshStandardMaterial({ color: nv.color, roughness: 0.5 })
    );
    vBody.position.y = 3.5;
    const vRoof = new THREE.Mesh(
      new THREE.ConeGeometry(10.5, 4.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    vRoof.rotation.y = Math.PI / 4;
    vRoof.position.y = 9.1;
    const vPool = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.2, 7.5),
      bridgeNeonCyanMat
    );
    vPool.position.set(10.2, 0.1, 0);
    vGrp.add(vBody, vRoof, vPool);
    newCityGroup.add(vGrp);

    collisionBoxes.push({
      minX: nv.x - 7.0,
      maxX: nv.x + 7.0,
      minZ: nv.z - 6.5,
      maxZ: nv.z + 6.5,
    });
  });

  scene.add(newCityGroup);

  animatables.push({
    update: (dt) => {
      needlePod.rotation.y += dt * 0.65;
    },
  });

  // 5. DISTRICT 1: CENTRO (Realistic Skyscrapers with Ground Lobbies, Rooftop Helipads & Antennas)
  const winTex = createBuildingWindowTexture();
  winTex.repeat.set(2, 6);

  const skyscraperColors = [0x334155, 0x1e293b, 0x3b4252, 0x2e3440];
  const downtownBlocks = [
    { x: -102, z: -102, w: 20, d: 20, h: 46 },
    { x: -40, z: -104, w: 18, d: 18, h: 58 },
    { x: -102, z: -42, w: 18, d: 18, h: 50 },
    { x: -40, z: -42, w: 18, d: 18, h: 66 },
    { x: -102, z: -124, w: 16, d: 14, h: 40 },
    { x: -40, z: -124, w: 16, d: 14, h: 42 },
  ].filter((_, i) => !isLow || i % 2 === 0);

  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.6,
  });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    roughness: 0.15,
  });

  downtownBlocks.forEach((b, idx) => {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(b.x, 0, b.z);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.2, 4.2, b.d + 1.2), podiumMat);
    podium.position.y = 2.1;
    podium.castShadow = true;
    podium.receiveShadow = true;
    towerGroup.add(podium);

    const lobbyGlass = new THREE.Mesh(
      new THREE.BoxGeometry(b.w * 0.65, 3.2, b.d + 1.35),
      lobbyGlassMat
    );
    lobbyGlass.position.y = 1.6;
    towerGroup.add(lobbyGlass);

    const mat = new THREE.MeshStandardMaterial({
      color: skyscraperColors[idx % skyscraperColors.length],
      map: winTex,
      roughness: 0.22,
      metalness: 0.76,
    });
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = b.h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    towerGroup.add(mesh);

    const crownGeo = new THREE.BoxGeometry(b.w + 0.6, 0.9, b.d + 0.6);
    const crownMat = new THREE.MeshBasicMaterial({
      color: idx % 2 === 0 ? 0x38bdf8 : 0xf59e0b,
    });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = b.h + 0.45;
    towerGroup.add(crown);

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.22, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
    );
    spire.position.y = b.h + 3.5;
    towerGroup.add(spire);

    scene.add(towerGroup);

    collisionBoxes.push({
      minX: b.x - (b.w + 1.2) / 2,
      maxX: b.x + (b.w + 1.2) / 2,
      minZ: b.z - (b.d + 1.2) / 2,
      maxZ: b.z + (b.d + 1.2) / 2,
    });
  });

  // 6. DISTRICT 2: JARDINS (Detailed Residential Villas with Windows, Doors & Garden Hedges)
  const villaColors = [0xfef3c7, 0xfce7f3, 0xe0e7ff, 0xdcfce7, 0xffedd5];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
  const villaWinMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xfef08a,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });

  const villaPositions = [
    { x: 10, z: -104 },
    { x: 31, z: -104 },
    { x: 10, z: -42 },
    { x: 31, z: -42 },
    { x: 68, z: 18 },
  ].filter((_, i) => !isLow || i % 2 === 0);

  const villaDoorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const villaGarageMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.35,
  });
  const villaPorchGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  villaPositions.forEach((pos, idx) => {
    const color = villaColors[idx % villaColors.length];
    const villaGroup = new THREE.Group();
    const w = 11;
    const h = 6.5;
    const d = 12;

    const wallGeo = new THREE.BoxGeometry(w, h, d);
    const wallMat = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.y = h / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    villaGroup.add(wallMesh);

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, d + 0.15), villaWinMat);
    win1.position.set(-2.6, 4.4, 0);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, d + 0.15), villaWinMat);
    win2.position.set(2.6, 4.4, 0);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 1.1, d + 1.4), hedgeMat);
    hedge.position.y = 0.55;
    villaGroup.add(win1, win2, hedge);

    // Garage Door, Front Entrance Door & Warm Porch Light on Villa Facade
    const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 0.25), villaGarageMat);
    garageDoor.position.set(-2.5, 1.25, d / 2 + 0.08);
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.25), villaDoorMat);
    frontDoor.position.set(2.4, 1.2, d / 2 + 0.08);
    const porchLamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), villaPorchGlowMat);
    porchLamp.position.set(2.4, 2.75, d / 2 + 0.25);
    villaGroup.add(garageDoor, frontDoor, porchLamp);

    const roofGeo = new THREE.ConeGeometry(9.2, 3.8, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = h + 1.9;
    roofMesh.castShadow = true;
    villaGroup.add(roofMesh);

    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.6, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 })
    );
    chimney.position.set(2.8, h + 2.2, -2.0);
    villaGroup.add(chimney);

    villaGroup.position.set(pos.x, 0, pos.z);
    scene.add(villaGroup);

    collisionBoxes.push({
      minX: pos.x - (w + 1.4) / 2,
      maxX: pos.x + (w + 1.4) / 2,
      minZ: pos.z - (d + 1.4) / 2,
      maxZ: pos.z + (d + 1.4) / 2,
    });
  });

  // 6.5 DIGITAL OVERHEAD AVENUE PORTALS & SPEED RADAR GANTRIES (Pórticos Digitais de Trânsito)
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.25,
  });
  const gantryPortals = [
    { x: -70, z: -46, text: '⚡ AV. CENTRAL • RADAR 60 KM/H • FAIXA AZUL ÔNIBUS', border: '#00f3ff' },
    { x: -10, z: -46, text: '🏙️ CORREDOR EXPRESSO • TRÁFEGO INTELIGENTE ATIVO', border: '#facc15' },
    { x: 50, z: -46, text: '🌴 JARDINS & ORLA • RESPEITE O SEMÁFORO', border: '#34d399' },
  ];

  gantryPortals.forEach(gp => {
    const gGroup = new THREE.Group();
    gGroup.position.set(gp.x, 0, gp.z);

    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 7.6, 10), gantrySteelMat);
    pillarL.position.set(-8.6, 3.8, 0);
    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 7.6, 10), gantrySteelMat);
    pillarR.position.set(8.6, 3.8, 0);
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.55, 0.55), gantrySteelMat);
    crossBeam.position.set(0, 7.4, 0);
    gGroup.add(pillarL, pillarR, crossBeam);

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#020617';
      sCtx.fillRect(0, 0, 512, 96);
      sCtx.strokeStyle = gp.border;
      sCtx.lineWidth = 6;
      sCtx.strokeRect(4, 4, 504, 88);
      sCtx.fillStyle = '#fef08a';
      sCtx.font = '900 18px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.textBaseline = 'middle';
      sCtx.fillText(gp.text, 256, 48);
    }
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(12.8, 1.85, 0.35),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signBoard.position.set(0, 7.5, 0);
    gGroup.add(signBoard);

    scene.add(gGroup);
  });

  // 7. LUSH GREEN URBAN TREES (Placed on sidewalks outside avenues + SOLID COLLISION BOXES!)
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62 });
  const treeFoliageLightMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
  const treeCoords = [
    { x: -60, z: -28 },
    { x: -60, z: -56 },
    { x: -60, z: -86 },
    { x: -20, z: -28 },
    { x: -20, z: -56 },
    { x: -20, z: -86 },
    { x: 2, z: -28 },
    { x: 2, z: -56 },
    { x: 2, z: -88 },
    { x: 36, z: -28 },
    { x: 36, z: -88 },
    { x: 60, z: -28 },
    { x: 60, z: -56 },
  ].filter((_, i) => !isLow || i % 2 === 0);

  // Urban Trees rendered via GPU InstancedMesh (4 Draw Calls for all 13 trees!)
  const sharedPlanterMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
  const treePlanterGeo = new THREE.CylinderGeometry(1.15, 1.2, 0.38, 10);
  treePlanterGeo.translate(0, 0.19, 0);

  const treeTrunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 3.0, 8);
  treeTrunkGeo.translate(0, 1.5, 0);

  const crownMainGeo1 = new THREE.SphereGeometry(1.85, 10, 8);
  crownMainGeo1.translate(0, 3.6, 0);
  const crownMainGeo3 = new THREE.SphereGeometry(1.2, 8, 8);
  crownMainGeo3.translate(-0.5, 4.1, -0.4);
  const treeCrownDarkGeo = mergeGeometries([crownMainGeo1, crownMainGeo3]);

  const treeCrownLightGeo = new THREE.SphereGeometry(1.35, 8, 8);
  treeCrownLightGeo.translate(0.55, 4.5, 0.35);

  const treeCount = treeCoords.length;
  const treePlanterInst = new THREE.InstancedMesh(treePlanterGeo, sharedPlanterMat, treeCount);
  const treeTrunkInst = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, treeCount);
  const treeCrownDarkInst = new THREE.InstancedMesh(treeCrownDarkGeo, treeFoliageMat, treeCount);
  const treeCrownLightInst = new THREE.InstancedMesh(treeCrownLightGeo, treeFoliageLightMat, treeCount);

  treeTrunkInst.castShadow = !isLow;
  treeCrownDarkInst.castShadow = !isLow;
  treePlanterInst.frustumCulled = false;
  treeTrunkInst.frustumCulled = false;
  treeCrownDarkInst.frustumCulled = false;
  treeCrownLightInst.frustumCulled = false;

  const instDummy = new THREE.Object3D();
  treeCoords.forEach((tc, idx) => {
    instDummy.position.set(tc.x, 0, tc.z);
    instDummy.rotation.set(0, idx * 0.7, 0);
    instDummy.updateMatrix();
    treePlanterInst.setMatrixAt(idx, instDummy.matrix);
    treeTrunkInst.setMatrixAt(idx, instDummy.matrix);
    treeCrownDarkInst.setMatrixAt(idx, instDummy.matrix);
    treeCrownLightInst.setMatrixAt(idx, instDummy.matrix);

    collisionBoxes.push({
      minX: tc.x - 1.35,
      maxX: tc.x + 1.35,
      minZ: tc.z - 1.35,
      maxZ: tc.z + 1.35,
    });
  });
  treePlanterInst.instanceMatrix.needsUpdate = true;
  treeTrunkInst.instanceMatrix.needsUpdate = true;
  treeCrownDarkInst.instanceMatrix.needsUpdate = true;
  treeCrownLightInst.instanceMatrix.needsUpdate = true;
  scene.add(treePlanterInst, treeTrunkInst, treeCrownDarkInst, treeCrownLightInst);

  // 8. DISTRICT 3: FAVELA / MORRO DO SOL
  const favelaColors = [0xd97706, 0xb45309, 0x0284c7, 0x16a34a, 0x9333ea, 0xef4444, 0xf59e0b];
  const favelaClusters = [
    { x: -102, z: 18, tiers: 2 },
    { x: -92, z: 26, tiers: 3 },
    { x: -102, z: 68, tiers: 3 },
    { x: -92, z: 76, tiers: 2 },
    { x: -46, z: 18, tiers: 2 },
    { x: -34, z: 24, tiers: 3 },
    { x: -46, z: 68, tiers: 3 },
    { x: -34, z: 74, tiers: 4 },
    { x: -96, z: 114, tiers: 3 },
  ];

  favelaClusters.forEach((cl, idx) => {
    const col = favelaColors[idx % favelaColors.length];
    const house = createFavelaHouse(col, cl.tiers);
    house.position.set(cl.x, 0, cl.z);
    scene.add(house);

    collisionBoxes.push({
      minX: cl.x - 3.6,
      maxX: cl.x + 3.6,
      minZ: cl.z - 3.6,
      maxZ: cl.z + 3.6,
    });
  });

  // 9. DISTRICT 4: ORLA DA PRAIA (Palm Trees & Kiosks - Shared Geometries & GPU InstancedMesh!)
  const kioskPositions = [
    { x: 74, z: 18 },
    { x: 74, z: 70 },
    { x: 74, z: 114 },
  ];
  const sharedKioskWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const sharedKioskThatchMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.95 });
  const sharedKioskCounterGeo = new THREE.CylinderGeometry(2.5, 2.5, 1.6, 12);
  const sharedKioskRoofGeo = new THREE.ConeGeometry(3.8, 1.8, 12);

  kioskPositions.forEach(k => {
    const kioskGroup = new THREE.Group();
    const counter = new THREE.Mesh(sharedKioskCounterGeo, sharedKioskWoodMat);
    counter.position.y = 0.8;
    kioskGroup.add(counter);

    const roof = new THREE.Mesh(sharedKioskRoofGeo, sharedKioskThatchMat);
    roof.position.y = 2.5;
    kioskGroup.add(roof);

    kioskGroup.position.set(k.x, 0, k.z);
    scene.add(kioskGroup);

    collisionBoxes.push({
      minX: k.x - 2.9,
      maxX: k.x + 2.9,
      minZ: k.z - 2.9,
      maxZ: k.z + 2.9,
    });
  });

  // Palm trees along beach boardwalk rendered via GPU InstancedMesh (3 Draw Calls total!)
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
  const palmZCoords = [5, 18, 30, 60, 72, 82, 110, 122].filter((_, i) => !isLow || i % 2 === 0);

  const palmTrunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 6, 8);
  palmTrunkGeo.translate(0, 3, 0);

  const palmPlanterGeo = new THREE.CylinderGeometry(1.0, 1.05, 0.3, 10);
  palmPlanterGeo.translate(0, 0.15, 0);

  const palmLeafGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const lGeo = new THREE.ConeGeometry(0.8, 3.5, 5);
    lGeo.rotateX(Math.PI / 3);
    lGeo.rotateY((i * Math.PI) / 3);
    lGeo.translate(0, 5.8, 0);
    palmLeafGeos.push(lGeo);
  }
  const mergedPalmCrownGeo = mergeGeometries(palmLeafGeos);

  const palmCount = palmZCoords.length;
  const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, palmMat, palmCount);
  const palmPlanterInst = new THREE.InstancedMesh(palmPlanterGeo, sharedPlanterMat, palmCount);
  const palmCrownInst = new THREE.InstancedMesh(mergedPalmCrownGeo, leafMat, palmCount);

  palmTrunkInst.castShadow = !isLow;
  palmTrunkInst.frustumCulled = false;
  palmPlanterInst.frustumCulled = false;
  palmCrownInst.frustumCulled = false;

  palmZCoords.forEach((z, idx) => {
    instDummy.position.set(63, 0, z);
    instDummy.rotation.set(0, idx * 0.5, 0);
    instDummy.updateMatrix();
    palmTrunkInst.setMatrixAt(idx, instDummy.matrix);
    palmPlanterInst.setMatrixAt(idx, instDummy.matrix);
    palmCrownInst.setMatrixAt(idx, instDummy.matrix);

    collisionBoxes.push({
      minX: 63 - 1.3,
      maxX: 63 + 1.3,
      minZ: z - 1.3,
      maxZ: z + 1.3,
    });
  });
  palmTrunkInst.instanceMatrix.needsUpdate = true;
  palmPlanterInst.instanceMatrix.needsUpdate = true;
  palmCrownInst.instanceMatrix.needsUpdate = true;
  scene.add(palmTrunkInst, palmPlanterInst, palmCrownInst);

  // 10. MODERN CANTILEVERED COBRA-HEAD LED STREETLIGHTS ON SIDEWALKS (GPU InstancedMesh = 4 Draw Calls total!)
  const lampPositions = [
    { x: -61, z: -50, rotY: Math.PI },
    { x: -79, z: -50, rotY: 0 },
    { x: -19, z: -50, rotY: 0 },
    { x: -1, z: -50, rotY: Math.PI },
    { x: 41, z: -50, rotY: 0 },
    { x: -61, z: 12, rotY: Math.PI },
    { x: -19, z: 12, rotY: 0 },
    { x: 41, z: 12, rotY: 0 },
    { x: -61, z: 65, rotY: Math.PI },
    { x: -19, z: 65, rotY: 0 },
    { x: 41, z: 65, rotY: 0 },
  ];

  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85,
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.2, 8);
  poleGeo.translate(0, 3.1, 0);

  const armGeo = new THREE.CylinderGeometry(0.06, 0.09, 2.0, 8);
  armGeo.rotateZ(-Math.PI / 2.4);
  armGeo.translate(0.85, 6.0, 0);

  const fixtureGeo = new THREE.BoxGeometry(0.65, 0.14, 0.32);
  fixtureGeo.translate(1.75, 6.22, 0);

  const bulbGeo = new THREE.PlaneGeometry(0.5, 0.24);
  bulbGeo.rotateX(Math.PI / 2);
  bulbGeo.translate(1.75, 6.14, 0);

  const lampCount = lampPositions.length;
  const poleInst = new THREE.InstancedMesh(poleGeo, lampPoleMat, lampCount);
  const armInst = new THREE.InstancedMesh(armGeo, lampPoleMat, lampCount);
  const fixtureInst = new THREE.InstancedMesh(fixtureGeo, lampPoleMat, lampCount);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, lampGlowMat, lampCount);

  poleInst.castShadow = !isLow;
  poleInst.frustumCulled = false;
  armInst.frustumCulled = false;
  fixtureInst.frustumCulled = false;
  bulbInst.frustumCulled = false;

  const lampDummy = new THREE.Object3D();
  lampPositions.forEach((l, idx) => {
    lampDummy.position.set(l.x, 0, l.z);
    lampDummy.rotation.set(0, l.rotY, 0);
    lampDummy.updateMatrix();
    poleInst.setMatrixAt(idx, lampDummy.matrix);
    armInst.setMatrixAt(idx, lampDummy.matrix);
    fixtureInst.setMatrixAt(idx, lampDummy.matrix);
    bulbInst.setMatrixAt(idx, lampDummy.matrix);

    collisionBoxes.push({
      minX: l.x - 0.5,
      maxX: l.x + 0.5,
      minZ: l.z - 0.5,
      maxZ: l.z + 0.5,
    });
  });

  poleInst.instanceMatrix.needsUpdate = true;
  armInst.instanceMatrix.needsUpdate = true;
  fixtureInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  scene.add(poleInst, armInst, fixtureInst, bulbInst);

  // 10.5 GPU-INSTANCED URBAN STREET DETAILS (Lombadas, Lixeiras, Bancos de Praça & Fios nos Postes = 4 Draw Calls!)
  {
    const propDummy = new THREE.Object3D();

    // A) Speed Bumps (Lombadas / Quebra-Molas com faixas amarelas) on avenues
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 256;
    bumpCanvas.height = 64;
    const bCtx = bumpCanvas.getContext('2d')!;
    bCtx.fillStyle = '#1e293b';
    bCtx.fillRect(0, 0, 256, 64);
    bCtx.fillStyle = '#facc15';
    for (let x = -32; x < 256; x += 32) {
      bCtx.beginPath();
      bCtx.moveTo(x, 0);
      bCtx.lineTo(x + 16, 0);
      bCtx.lineTo(x + 32, 64);
      bCtx.lineTo(x + 16, 64);
      bCtx.closePath();
      bCtx.fill();
    }
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.colorSpace = THREE.SRGBColorSpace;
    const bumpGeo = new THREE.CylinderGeometry(0.45, 0.45, 12.6, 10, 1, false, 0, Math.PI);
    bumpGeo.rotateZ(Math.PI / 2);
    bumpGeo.scale(1, 0.22, 1.8);
    const bumpMat = new THREE.MeshStandardMaterial({ map: bumpTex, roughness: 0.72 });
    const speedBumpCoords = [
      { x: -70, z: -48, rotY: 0 },
      { x: -70, z: 12, rotY: 0 },
      { x: -10, z: -42, rotY: 0 },
      { x: -10, z: 18, rotY: 0 },
      { x: 50, z: -42, rotY: 0 },
      { x: 50, z: 18, rotY: 0 },
      { x: -40, z: -70, rotY: Math.PI / 2 },
      { x: 20, z: -70, rotY: Math.PI / 2 },
      { x: -40, z: -15, rotY: Math.PI / 2 },
      { x: 20, z: 45, rotY: Math.PI / 2 },
      { x: 290, z: -42, rotY: 0 },
      { x: 350, z: 18, rotY: 0 },
    ];
    const speedBumpInst = new THREE.InstancedMesh(bumpGeo, bumpMat, speedBumpCoords.length);
    speedBumpCoords.forEach((sb, idx) => {
      propDummy.position.set(sb.x, 0.02, sb.z);
      propDummy.rotation.set(0, sb.rotY, 0);
      propDummy.scale.set(1, 1, 1);
      propDummy.updateMatrix();
      speedBumpInst.setMatrixAt(idx, propDummy.matrix);
    });
    speedBumpInst.instanceMatrix.needsUpdate = true;
    speedBumpInst.geometry.computeBoundingSphere();
    scene.add(speedBumpInst);

    // B) Sidewalk Trash Cans (Lixeiras Urbanas Verde Esmeralda & Laranja)
    const trashGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.88, 8);
    const trashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.25 });
    const trashCoords: Array<{ x: number; z: number; color: number }> = [];
    [-70, -10, 50, 290, 350].forEach((ax, aIdx) => {
      [-92, -52, -28, 8, 32, 68].forEach((zPos, zIdx) => {
        trashCoords.push({
          x: ax + (zIdx % 2 === 0 ? -8.4 : 8.4),
          z: zPos,
          color: (aIdx + zIdx) % 2 === 0 ? 0x10b981 : 0xf97316,
        });
      });
    });
    const trashInst = new THREE.InstancedMesh(trashGeo, trashMat, trashCoords.length);
    const trashColor = new THREE.Color();
    trashCoords.forEach((tc, idx) => {
      propDummy.position.set(tc.x, 0.44, tc.z);
      propDummy.rotation.set(0, 0, 0);
      propDummy.scale.set(1, 1, 1);
      propDummy.updateMatrix();
      trashInst.setMatrixAt(idx, propDummy.matrix);
      trashInst.setColorAt(idx, trashColor.setHex(tc.color));
    });
    trashInst.instanceMatrix.needsUpdate = true;
    if (trashInst.instanceColor) trashInst.instanceColor.needsUpdate = true;
    trashInst.geometry.computeBoundingSphere();
    scene.add(trashInst);

    // C) Wooden Park Benches (Bancos de Praça) along Plazas & Sidewalks
    const seatGeo = new THREE.BoxGeometry(1.8, 0.12, 0.55);
    seatGeo.translate(0, 0.46, 0);
    const backGeo = new THREE.BoxGeometry(1.8, 0.42, 0.1);
    backGeo.translate(0, 0.72, -0.22);
    const legLGeo = new THREE.BoxGeometry(0.12, 0.46, 0.52);
    legLGeo.translate(-0.75, 0.23, 0);
    const legRGeo = new THREE.BoxGeometry(0.12, 0.46, 0.52);
    legRGeo.translate(0.75, 0.23, 0);
    const benchGeo = mergeGeometries([seatGeo, backGeo, legLGeo, legRGeo]);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
    const benchCoords = [
      { x: -32, z: -32, rotY: 0 },
      { x: -48, z: -32, rotY: 0 },
      { x: -32, z: -52, rotY: Math.PI },
      { x: 12, z: -32, rotY: 0 },
      { x: 28, z: -32, rotY: 0 },
      { x: 12, z: -52, rotY: Math.PI },
      { x: 78.5, z: -45, rotY: Math.PI / 2 },
      { x: 78.5, z: -85, rotY: Math.PI / 2 },
      { x: 78.5, z: 35, rotY: Math.PI / 2 },
      { x: 78.5, z: 75, rotY: Math.PI / 2 },
      { x: 342, z: -32, rotY: 0 },
      { x: 358, z: -32, rotY: 0 },
    ];
    const benchInst = new THREE.InstancedMesh(benchGeo, benchMat, benchCoords.length);
    benchCoords.forEach((bc, idx) => {
      propDummy.position.set(bc.x, 0, bc.z);
      propDummy.rotation.set(0, bc.rotY, 0);
      propDummy.scale.set(1, 1, 1);
      propDummy.updateMatrix();
      benchInst.setMatrixAt(idx, propDummy.matrix);
    });
    benchInst.instanceMatrix.needsUpdate = true;
    benchInst.geometry.computeBoundingSphere();
    scene.add(benchInst);

    // D) Overhead Utility Wires (Fios nos Postes) along Core Vertical Avenues
    if (!isLow) {
      const wireGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 4);
      wireGeo.rotateX(Math.PI / 2);
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const wireSpans: Array<{ x: number; z1: number; z2: number }> = [];
      [-78.5, -61.5, -18.5, -1.5, 41.5, 58.5].forEach(wx => {
        for (let wz = -105; wz < 105; wz += 35) {
          wireSpans.push({ x: wx, z1: wz, z2: wz + 35 });
        }
      });
      const wireInst = new THREE.InstancedMesh(wireGeo, wireMat, wireSpans.length);
      wireSpans.forEach((ws, idx) => {
        const len = Math.abs(ws.z2 - ws.z1);
        propDummy.position.set(ws.x, 6.45, (ws.z1 + ws.z2) * 0.5);
        propDummy.rotation.set(0, 0, 0);
        propDummy.scale.set(1, 1, len);
        propDummy.updateMatrix();
        wireInst.setMatrixAt(idx, propDummy.matrix);
      });
      wireInst.instanceMatrix.needsUpdate = true;
      wireInst.geometry.computeBoundingSphere();
      scene.add(wireInst);
    }
  }

  // 11. ANIMATED 3D PEDESTRIANS WITH SOLID COLLISION, HEALTH BAR, SCREAM REACTION & CROSSWALK AI
  interface PedestrianAgent {
    mesh: PedestrianGroup;
    healthBar: OverheadHealthBar | null;
    health: number;
    koTimer: number;
    axis: 'x' | 'z';
    fixedCoord: number;
    minTravel: number;
    maxTravel: number;
    currentTravel: number;
    dir: 1 | -1;
    speed: number;
    phaseOffset: number;
    isCrosswalk: boolean;
    interX?: number;
    interZ?: number;
    crossesAvenueType?: 'vertical' | 'horizontal';
    hitCooldown: number;
    panicTimer: number;
    fleeTimer: number;
    fleeTargetX: number;
    fleeTargetZ: number;
    knockbackX: number;
    knockbackZ: number;
    fadeAlpha: number;
  }

  const pedestrians: PedestrianAgent[] = [];
  const shirtPalette = [
    0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4, 0xf8fafc,
  ];
  const pantsPalette = [0x1e293b, 0x334155, 0x1e3a8a, 0x27272a, 0x451a03];
  const skinPalette = [0xfde68a, 0xf59e0b, 0xd97706, 0x92400e, 0xfcd34d];

  const ensurePedHealthBar = (p: PedestrianAgent): OverheadHealthBar => {
    if (!p.healthBar) {
      p.healthBar = createCharacterHealthBar('🚶 PEDESTRE', p.health, '#38bdf8');
      p.healthBar.sprite.position.set(0, 2.05, 0);
      p.healthBar.sprite.scale.set(1.85, 0.48, 1);
      p.mesh.add(p.healthBar.sprite);
    }
    p.healthBar.sprite.visible = true;
    return p.healthBar;
  };

  let pedIdx = 0;
  const addPedestrianAgent = (
    cfg: Omit<
      PedestrianAgent,
      | 'mesh'
      | 'healthBar'
      | 'health'
      | 'koTimer'
      | 'phaseOffset'
      | 'hitCooldown'
      | 'panicTimer'
      | 'fleeTimer'
      | 'fleeTargetX'
      | 'fleeTargetZ'
      | 'knockbackX'
      | 'knockbackZ'
      | 'fadeAlpha'
    >
  ) => {
    const shirt = shirtPalette[pedIdx % shirtPalette.length];
    const pants = pantsPalette[(pedIdx * 3) % pantsPalette.length];
    const skin = skinPalette[(pedIdx * 2) % skinPalette.length];
    const mesh = createPedestrian(shirt, pants, skin, pedIdx % 3 === 0, isLow, pedIdx);
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.frustumCulled = true;
        child.geometry.computeBoundingSphere();
      }
    });
    mesh.userData.isDynamic = true;

    if (cfg.axis === 'z') {
      mesh.position.set(cfg.fixedCoord, 0, cfg.currentTravel);
      mesh.rotation.y = cfg.dir > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(cfg.currentTravel, 0, cfg.fixedCoord);
      mesh.rotation.y = cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    scene.add(mesh);
    pedestrians.push({
      ...cfg,
      mesh,
      healthBar: null,
      health: 100,
      koTimer: 0,
      phaseOffset: pedIdx * 1.3,
      hitCooldown: 0,
      panicTimer: 0,
      fleeTimer: 0,
      fleeTargetX: 0,
      fleeTargetZ: 0,
      knockbackX: 0,
      knockbackZ: 0,
      fadeAlpha: 1.0,
    });
    pedIdx++;
  };

  const CORE_VERT_X = [-70, -10, 50, 290, 350, 410];
  const CORE_HORIZ_Z = [-70, -15, 45, 95];

  // A) Sidewalk Pedestrians strolling along Core Vertical Avenues (Both Main City & Nova Metrópole!)
  CORE_VERT_X.forEach((ax, aIdx) => {
    const segments = [
      { min: -115, max: -79 },
      { min: -61, max: -24 },
      { min: -6, max: 36 },
      { min: 54, max: 86 },
      { min: 102, max: 135 },
    ];
    segments.forEach((seg, sIdx) => {
      if (isLow && sIdx % 2 !== 0) return;
      // Add pedestrians on BOTH West and East sidewalks of busy avenues
      [-1, 1].forEach((side, sideIdx) => {
        if (isLow && sideIdx > 0) return;
        if (!isLow && (aIdx + sIdx + sideIdx) % 3 === 0) return;
        addPedestrianAgent({
          axis: 'z',
          fixedCoord: ax + side * 9.2,
          minTravel: seg.min,
          maxTravel: seg.max,
          currentTravel: (seg.min + seg.max) / 2 + (sideIdx === 0 ? -5 : 5),
          dir: (sIdx + sideIdx) % 2 === 0 ? 1 : -1,
          speed: 1.55 + ((sIdx + sideIdx) % 3) * 0.25,
          isCrosswalk: false,
        });
      });
    });
  });

  // B) Sidewalk Pedestrians strolling along Core Horizontal Avenues (Main City + Nova Metrópole + Bridge Walkways!)
  CORE_HORIZ_Z.forEach((az, zIdx) => {
    const segments = [
      { min: -112, max: -79 },
      { min: -61, max: -19 },
      { min: -1, max: 41 },
      // Nova Metrópole Horizontal Sidewalks
      { min: 299, max: 341 },
      { min: 359, max: 401 },
    ];
    segments.forEach((seg, sIdx) => {
      if (isLow && sIdx % 2 !== 0) return;
      const side = (zIdx + sIdx) % 2 === 0 ? -1 : 1;
      addPedestrianAgent({
        axis: 'x',
        fixedCoord: az + side * 9.2,
        minTravel: seg.min,
        maxTravel: seg.max,
        currentTravel: (seg.min + seg.max) / 2,
        dir: (zIdx + sIdx) % 2 === 0 ? 1 : -1,
        speed: 1.5 + ((zIdx + sIdx) % 3) * 0.25,
        isCrosswalk: false,
      });
    });
  });

  // B2) Bridge Boardwalk Pedestrians Strolling Across the Ponte Estaiada (Z = -15 ± 7.3m, X = 95..255)
  [-7.3, 7.3].forEach((bridgeSideOffset, bIdx) => {
    const bridgeSpawns = isLow ? [135, 215] : [115, 160, 205, 240];
    bridgeSpawns.forEach((startX, sIdx) => {
      addPedestrianAgent({
        axis: 'x',
        fixedCoord: -15 + bridgeSideOffset,
        minTravel: 94,
        maxTravel: 256,
        currentTravel: startX,
        dir: (bIdx + sIdx) % 2 === 0 ? 1 : -1,
        speed: 1.65 + (sIdx % 2) * 0.3,
        isCrosswalk: false,
      });
    });
  });

  // C) Crosswalk Pedestrians crossing on the Zebra Stripes at Core Intersections (Both Cities!)
  CORE_VERT_X.forEach((ax, aIdx) => {
    CORE_HORIZ_Z.forEach((az, zIdx) => {
      if (isLow && (aIdx + zIdx) % 2 !== 0) return;
      addPedestrianAgent({
        axis: 'x',
        fixedCoord: az - 6.2,
        minTravel: ax - 8.5,
        maxTravel: ax + 8.5,
        currentTravel: (aIdx + zIdx) % 2 === 0 ? ax - 8.2 : ax + 8.2,
        dir: (aIdx + zIdx) % 2 === 0 ? 1 : -1,
        speed: 2.15,
        isCrosswalk: true,
        interX: ax,
        interZ: az,
        crossesAvenueType: 'vertical',
      });
    });
  });

  // Track player position & dynamic LOD scale for pedestrian distance culling
  let lastLodPlayerX = -67.2;
  let lastLodPlayerZ = -28.0;
  let currentPedLodScale = 1.0;
  const maxActivePedestrians = isLow ? 12 : performanceMode === 'medium' ? 18 : 24;

  // Animate all 3D Pedestrians (walking cycle + traffic signal compliance + panic/scream + KO state + Object Pool Cap & Hysteresis)
  animatables.push({
    update: (dt, time) => {
      // Hysteresis: unload radius (92m) is strictly larger than load radius (75m) inside the fog horizon
      const pedLoadDistSq = (75 * currentPedLodScale) * (75 * currentPedLodScale);
      const pedUnloadDistSq = (92 * currentPedLodScale) * (92 * currentPedLodScale);
      const pedDetailDistSq = (45 * currentPedLodScale) * (45 * currentPedLodScale);
      let activePedCount = 0;

      for (const p of pedestrians) {
        if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - dt);

        const pdx = p.mesh.position.x - lastLodPlayerX;
        const pdz = p.mesh.position.z - lastLodPlayerZ;
        const distSq = pdx * pdx + pdz * pdz;

        const thresholdSq = p.mesh.visible ? pedUnloadDistSq : pedLoadDistSq;

        if (
          (distSq > thresholdSq || activePedCount >= maxActivePedestrians) &&
          p.koTimer <= 0 &&
          p.panicTimer <= 0
        ) {
          p.mesh.visible = false;
          if (p.healthBar) p.healthBar.sprite.visible = false;
          // Lightweight 1D travel integration while in inactive pool
          p.currentTravel += p.dir * p.speed * dt;
          if (p.currentTravel >= p.maxTravel) {
            p.currentTravel = p.maxTravel;
            p.dir = -1;
          } else if (p.currentTravel <= p.minTravel) {
            p.currentTravel = p.minTravel;
            p.dir = 1;
          }
          if (p.axis === 'z') {
            p.mesh.position.z = p.currentTravel;
          } else {
            p.mesh.position.x = p.currentTravel;
          }
          continue;
        }

        activePedCount++;

        if (!p.mesh.visible) {
          p.mesh.visible = true;
          p.fadeAlpha = 0.0;
        }

        if (p.fadeAlpha < 1.0) {
          p.fadeAlpha = Math.min(1.0, p.fadeAlpha + dt / 0.35);
          const s = 0.86 + 0.14 * p.fadeAlpha;
          p.mesh.scale.set(
            p.mesh.baseScaleXZ * s,
            p.mesh.baseScaleY * (0.84 + 0.16 * p.fadeAlpha),
            p.mesh.baseScaleXZ * s
          );
        } else {
          p.mesh.scale.set(p.mesh.baseScaleXZ, p.mesh.baseScaleY, p.mesh.baseScaleXZ);
        }

        if (p.koTimer > 0) {
          p.koTimer = Math.max(0, p.koTimer - dt);
          p.mesh.screamSprite.visible = false;
          p.mesh.rotation.x = THREE.MathUtils.damp(p.mesh.rotation.x, -Math.PI / 2.2, 10, dt);
          p.mesh.position.y = 0.22;
          if (p.koTimer <= 0) {
            p.health = 100;
            p.mesh.rotation.x = 0;
            p.mesh.position.y = 0;
            if (p.healthBar) p.healthBar.sprite.visible = false;
          }
          continue;
        }

        p.mesh.rotation.x = 0;

        if (p.panicTimer > 0) {
          p.panicTimer = Math.max(0, p.panicTimer - dt);
          p.mesh.screamSprite.visible = p.panicTimer > 0;
        } else {
          p.mesh.screamSprite.visible = false;
        }

        // Decay knockback offset
        p.knockbackX = THREE.MathUtils.damp(p.knockbackX, 0, 6, dt);
        p.knockbackZ = THREE.MathUtils.damp(p.knockbackZ, 0, 6, dt);

        let isWaitingAtRed = false;

        if (p.isCrosswalk && p.crossesAvenueType === 'vertical' && p.panicTimer <= 0) {
          const phases = getTrafficSignalPhases(time, p.interX ?? -70, p.interZ ?? -70);
          const carLight = phases.vertical;
          const distFromCenter = Math.abs(
            p.currentTravel - (p.minTravel + p.maxTravel) / 2
          );
          if (carLight !== 'red' && distFromCenter > 6.5) {
            isWaitingAtRed = true;
          }
        }

        const effectiveSpeed = p.panicTimer > 0 ? p.speed * 1.9 : p.speed;

        if (!isWaitingAtRed) {
          p.currentTravel += p.dir * effectiveSpeed * dt;
          if (p.currentTravel >= p.maxTravel) {
            p.currentTravel = p.maxTravel;
            p.dir = -1;
          } else if (p.currentTravel <= p.minTravel) {
            p.currentTravel = p.minTravel;
            p.dir = 1;
          }

          if (p.axis === 'z') {
            p.mesh.position.x = p.fixedCoord + p.knockbackX;
            p.mesh.position.z = p.currentTravel + p.knockbackZ;
            p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
          } else {
            p.mesh.position.x = p.currentTravel + p.knockbackX;
            p.mesh.position.z = p.fixedCoord + p.knockbackZ;
            p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }

          // Skip per-limb trigonometric updates if beyond mid-detail LOD distance
          if (distSq <= pedDetailDistSq) {
            const swing = Math.sin(time * effectiveSpeed * 5.4 + p.phaseOffset) * 0.6;
            p.mesh.leftLeg.rotation.x = swing;
            p.mesh.rightLeg.rotation.x = -swing;
            p.mesh.headGroup.rotation.y = 0;

            if (p.panicTimer > 0) {
              // Raise both arms in shock when hit/panicked!
              p.mesh.leftArm.rotation.x = -2.55 + Math.sin(time * 22) * 0.25;
              p.mesh.rightArm.rotation.x = -2.55 - Math.sin(time * 22) * 0.25;
            } else {
              p.mesh.leftArm.rotation.x = -swing * 0.8;
              p.mesh.rightArm.rotation.x = swing * 0.8;
            }
            p.mesh.position.y =
              Math.abs(Math.sin(time * effectiveSpeed * 5.4 + p.phaseOffset)) * 0.04;
          }
        } else {
          // Waiting at traffic light: stand still, breathe gently, and look both ways
          p.mesh.leftLeg.rotation.x = 0;
          p.mesh.rightLeg.rotation.x = 0;
          p.mesh.leftArm.rotation.x = Math.sin(time * 2 + p.phaseOffset) * 0.06;
          p.mesh.rightArm.rotation.x = -Math.sin(time * 2 + p.phaseOffset) * 0.06;
          p.mesh.headGroup.rotation.y = Math.sin(time * 1.8 + p.phaseOffset) * 0.38;
          p.mesh.position.y = 0;
        }
      }

      // Animate 3D Waiting Customers at Delivery Dropoff Points (wave arm enthusiastically when player is nearby!)
      for (const ca of customerActors) {
        const cdx = lastLodPlayerX - ca.x;
        const cdz = lastLodPlayerZ - ca.z;
        const cDistSq = cdx * cdx + cdz * cdz;
        if (cDistSq > pedUnloadDistSq) {
          ca.mesh.visible = false;
          continue;
        }
        ca.mesh.visible = true;
        if (cDistSq < 625) {
          // Player within 25m: face player and wave right arm!
          ca.mesh.rotation.y = Math.atan2(cdx, cdz);
          ca.mesh.rightArm.rotation.x = -2.45 + Math.sin(time * 8.5 + ca.phase) * 0.35;
          ca.mesh.rightArm.rotation.z = -0.25 + Math.cos(time * 8.5 + ca.phase) * 0.22;
          ca.mesh.leftArm.rotation.x = Math.sin(time * 3.0 + ca.phase) * 0.12;
          ca.mesh.position.y = Math.abs(Math.sin(time * 4.2 + ca.phase)) * 0.04;
        } else {
          ca.mesh.rightArm.rotation.x = Math.sin(time * 2.0 + ca.phase) * 0.08;
          ca.mesh.rightArm.rotation.z = 0;
          ca.mesh.leftArm.rotation.x = -Math.sin(time * 2.0 + ca.phase) * 0.08;
          ca.mesh.position.y = 0;
        }
      }
    },
  });

  // Expose live pedestrian positions so TrafficManager can intelligently yield at crosswalks
  const pedPositionsCache: THREE.Vector3[] = pedestrians.map(() => new THREE.Vector3());
  const getPedestrianPositions = () => {
    for (let i = 0; i < pedestrians.length; i++) {
      pedPositionsCache[i].copy(pedestrians[i].mesh.position);
    }
    return pedPositionsCache;
  };

  // Solid collision check between Pedestrians <-> Player Motorcycle & Traffic Cars
  const checkPedestrianCollisions = (
    bikePhysics: BikePhysics,
    vehicles: Array<{ group: THREE.Group; currentSpeed: number }>,
    onPlayerHitPedestrian: (damage: number, remainingHealth: number, pedDefeated?: boolean) => void,
    lodDistanceScale: number = 1.0
  ) => {
    const bikePos = bikePhysics.position;
    lastLodPlayerX = bikePos.x;
    lastLodPlayerZ = bikePos.z;
    currentPedLodScale = lodDistanceScale;
    const minBikeSep = 1.25; // Solid radius: motorcycle never passes through pedestrian body!

    // Kick any interactive 3D Soccer Balls when player approaches on bike or on foot (runs once per frame)
    for (const sb of soccerBalls) {
      const bdx = sb.worldX - bikePos.x;
      const bdz = sb.worldZ - bikePos.z;
      const bDist = Math.hypot(bdx, bdz);
      if (bDist < 2.2) {
        const kickSpeed = Math.max(14.5, Math.abs(bikePhysics.speed) * 1.65 + 10.0);
        const dirX = bDist > 0.05 ? bdx / bDist : Math.sin(bikePhysics.heading);
        const dirZ = bDist > 0.05 ? bdz / bDist : Math.cos(bikePhysics.heading);
        sb.vx = dirX * kickSpeed;
        sb.vz = dirZ * kickSpeed;
        sb.vy = 4.8;
        sound.playPush();
      }
    }

    for (const p of pedestrians) {
      if (p.koTimer > 0) continue;
      const px = p.mesh.position.x;
      const pz = p.mesh.position.z;

      // 1. Check Player (On-Foot vs Riding Motorcycle) vs Pedestrian
      const dx = bikePos.x - px;
      const dz = bikePos.z - pz;
      const dist = Math.hypot(dx, dz);

      if (bikePhysics.isOnFoot) {
        // Player is walking on foot (WITHOUT motorcycle) -> gentle pedestrian separation only, no crash!
        const minFootSep = 0.78;
        if (dist < minFootSep) {
          const nx = dist > 0.001 ? dx / dist : Math.sin(bikePhysics.heading);
          const nz = dist > 0.001 ? dz / dist : Math.cos(bikePhysics.heading);
          bikePos.x = px + nx * (minFootSep + 0.04);
          bikePos.z = pz + nz * (minFootSep + 0.04);
        }
        // Also deflect pedestrians gently around the parked motorcycle
        const pdx = px - bikePhysics.parkedBikePosition.x;
        const pdz = pz - bikePhysics.parkedBikePosition.z;
        const pDist = Math.hypot(pdx, pdz);
        if (pDist < 1.15 && pDist > 0.001) {
          p.knockbackX = (pdx / pDist) * 0.45;
          p.knockbackZ = (pdz / pDist) * 0.45;
        }
      } else if (dist < minBikeSep) {
        const nx = dist > 0.001 ? dx / dist : Math.sin(bikePhysics.heading);
        const nz = dist > 0.001 ? dz / dist : Math.cos(bikePhysics.heading);

        // Push motorcycle solidly outside the pedestrian's body so it NEVER passes through!
        bikePos.x = px + nx * (minBikeSep + 0.08);
        bikePos.z = pz + nz * (minBikeSep + 0.08);

        // Knock pedestrian away from impact
        p.knockbackX = -nx * 1.45;
        p.knockbackZ = -nz * 1.45;
        p.panicTimer = 2.6;
        p.mesh.screamSprite.visible = true;

        if (p.hitCooldown <= 0) {
          p.hitCooldown = 1.35;
          sound.playPedestrianScream();
          sound.playCrash();

          const pedDmg = Math.max(35, Math.round(Math.abs(bikePhysics.speed) * 2.5 + 25));
          p.health = Math.max(0, p.health - pedDmg);
          const pedDefeated = p.health <= 0;
          const hb = ensurePedHealthBar(p);
          if (pedDefeated) {
            p.koTimer = 20.0;
            hb.update('🚶 PEDESTRE', 0, '#ef4444');
          } else {
            hb.update('😱 PEDESTRE FERIDO', p.health, '#f59e0b');
          }

          const impactDmg = Math.max(
            14,
            Math.min(34, Math.round(Math.abs(bikePhysics.speed) * 1.2 + 10))
          );
          const remainingHealth = bikePhysics.applyDamage(impactDmg);

          // Recoil motorcycle speed on impact
          bikePhysics.speed =
            -Math.sign(bikePhysics.speed || 1) *
            Math.max(3.8, Math.abs(bikePhysics.speed) * 0.45);
          bikePhysics.crashCooldown = 0.7;

          onPlayerHitPedestrian(impactDmg, remainingHealth, pedDefeated);
        }
      }

      // 2. Check Traffic Cars vs Pedestrian (only when near player to avoid O(N*M) across the map)
      if (Math.abs(dx) < 45 && Math.abs(dz) < 45) {
        for (const v of vehicles) {
          const vdx = px - v.group.position.x;
          const vdz = pz - v.group.position.z;
          if (Math.abs(vdx) > 2.2 || Math.abs(vdz) > 2.2) continue;
          const vDist = Math.hypot(vdx, vdz);
          if (vDist < 1.9) {
            v.currentSpeed = 0;
            if (p.hitCooldown <= 0) {
              p.hitCooldown = 1.6;
              p.panicTimer = 2.4;
              p.mesh.screamSprite.visible = true;
              p.health = Math.max(0, p.health - 30);
              const hb = ensurePedHealthBar(p);
              if (p.health <= 0) {
                p.koTimer = 18.0;
                hb.update('🚶 PEDESTRE', 0, '#ef4444');
              } else {
                hb.update('😱 PEDESTRE', p.health, '#f59e0b');
              }
              const vnx = vDist > 0.001 ? vdx / vDist : 1;
              const vnz = vDist > 0.001 ? vdz / vDist : 0;
              p.knockbackX = vnx * 1.3;
              p.knockbackZ = vnz * 1.3;
              sound.playPedestrianScream();
            }
          }
        }
      }
    }
  };

  // On-foot melee attack (Punch / Push) against nearby Pedestrians
  const applyMeleeToPedestrians = (
    playerPos: THREE.Vector3,
    damage: number,
    pushForce: number
  ): { hit: boolean; defeated: boolean } => {
    let hit = false;
    let defeated = false;
    for (const p of pedestrians) {
      if (p.koTimer > 0) continue;
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.8) {
        hit = true;
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        p.knockbackX = nx * pushForce;
        p.knockbackZ = nz * pushForce;
        p.panicTimer = 3.0;
        p.mesh.screamSprite.visible = true;
        sound.playPedestrianScream();

        p.health = Math.max(0, p.health - damage);
        const hb = ensurePedHealthBar(p);
        if (p.health <= 0) {
          defeated = true;
          p.koTimer = 22.0;
          hb.update('🚶 PEDESTRE', 0, '#ef4444');
        } else {
          hb.update('😱 PEDESTRE', p.health, '#f59e0b');
        }
      }
    }
    return { hit, defeated };
  };

  // Pedestrians react when Player honks the Horn nearby!
  const reactPedestriansToHorn = (playerPos: THREE.Vector3) => {
    for (const p of pedestrians) {
      if (p.koTimer > 0) continue;
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 18.0) {
        p.panicTimer = Math.max(p.panicTimer, 4.0);
        p.fleeTimer = Math.max(p.fleeTimer, 4.0);
        p.mesh.screamSprite.visible = true;
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        p.fleeTargetX = nx;
        p.fleeTargetZ = nz;
        p.knockbackX = nx * 1.0;
        p.knockbackZ = nz * 1.0;
        const hb = ensurePedHealthBar(p);
        hb.update('😱 BUZINA! SAIA DA FRENTE!', p.health, '#38bdf8');
      }
    }
  };

  // Pedestrians panic and flee when a nearby crime, shootout, police pursuit, or crash happens!
  const triggerPedestrianPanicNear = (center: THREE.Vector3, radius: number = 24, reason: string = '🏃 CORRE! ASSALTO / PERSEGUIÇÃO!') => {
    for (const p of pedestrians) {
      if (p.koTimer > 0) continue;
      const dx = p.mesh.position.x - center.x;
      const dz = p.mesh.position.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        p.panicTimer = Math.max(p.panicTimer, 5.5);
        p.fleeTimer = Math.max(p.fleeTimer, 5.5);
        p.mesh.screamSprite.visible = true;
        const nx = dist > 0.001 ? dx / dist : (Math.random() - 0.5);
        const nz = dist > 0.001 ? dz / dist : (Math.random() - 0.5);
        p.fleeTargetX = nx;
        p.fleeTargetZ = nz;
        p.knockbackX = nx * 1.4;
        p.knockbackZ = nz * 1.4;
        const hb = ensurePedHealthBar(p);
        hb.update(reason, p.health, '#ef4444');
      }
    }
  };

  // 12. NEW SCENARIO 5: POLO INDUSTRIAL & PORTO (Z = -180 to -125)
  const warehouseMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.6,
    metalness: 0.5,
  });
  const warehouseRoofMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    roughness: 0.5,
    metalness: 0.4,
  });
  const warehouses = [
    { x: -102, z: -168, w: 26, d: 18, h: 11 },
    { x: -40, z: -168, w: 28, d: 18, h: 12 },
    { x: 20, z: -168, w: 26, d: 18, h: 11 },
  ];
  warehouses.forEach(wh => {
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(wh.w, wh.h, wh.d), warehouseMat);
    box.position.y = wh.h / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(wh.w + 1, 1.2, wh.d + 1),
      warehouseRoofMat
    );
    roof.position.y = wh.h + 0.6;
    grp.add(box, roof);

    // Tall industrial smokestack tower
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 22, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
    );
    chimney.position.set(wh.w * 0.3, 11, -wh.d * 0.25);
    const beaconRing = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.18, 1.2, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beaconRing.position.set(wh.w * 0.3, 21, -wh.d * 0.25);
    grp.add(chimney, beaconRing);

    grp.position.set(wh.x, 0, wh.z);
    scene.add(grp);

    collisionBoxes.push({
      minX: wh.x - wh.w / 2,
      maxX: wh.x + wh.w / 2,
      minZ: wh.z - wh.d / 2,
      maxZ: wh.z + wh.d / 2,
    });
  });

  // Colorful Stacked Port Shipping Containers (Contêineres Portuários)
  const containerColors = [0xea580c, 0x0284c7, 0xdc2626, 0x16a34a, 0xeab308];
  const containerStacks = [
    { x: 68, z: -168, stacks: 3 },
    { x: 68, z: -158, stacks: 2 },
    { x: 68, z: -130, stacks: 3 },
  ];
  containerStacks.forEach((cs, cIdx) => {
    for (let s = 0; s < cs.stacks; s++) {
      const cMesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 3.0, 4.2),
        new THREE.MeshStandardMaterial({
          color: containerColors[(cIdx + s) % containerColors.length],
          roughness: 0.45,
          metalness: 0.6,
        })
      );
      cMesh.position.set(cs.x, 1.5 + s * 3.05, cs.z);
      cMesh.castShadow = true;
      scene.add(cMesh);
    }
    collisionBoxes.push({
      minX: cs.x - 5.2,
      maxX: cs.x + 5.2,
      minZ: cs.z - 2.3,
      maxZ: cs.z + 2.3,
    });
  });

  // 13. FULL 3D SOCCER STADIUM COMPLEX (ESTÁDIO DE FUTEBOL MARACANÃ 3D COM GRAMADO, TRAVES, PLACAR & BOLA INTERATIVA!)
  interface InteractiveSoccerBall {
    mesh: THREE.Group;
    stadiumCenterX: number;
    stadiumCenterZ: number;
    localX: number;
    localZ: number;
    y: number;
    worldX: number;
    worldZ: number;
    vx: number;
    vz: number;
    vy: number;
    homeScore: number;
    awayScore: number;
    goalCelebrationTimer: number;
    updateScoreboard: (text: string, subText: string, isGoal: boolean) => void;
  }

  const soccerBalls: InteractiveSoccerBall[] = [];

  // Create procedural striped soccer pitch texture (Gramado Oficial Listado + Linhas Brancas)
  const createSoccerPitchTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    // Alternating mowed turf stripes
    const stripes = 12;
    const stripeW = canvas.width / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#16a34a';
      ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
    }

    // Crisp white pitch markings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;

    // Outer touchline & goal lines
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    // Halfway line & center circle
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 24);
    ctx.lineTo(canvas.width / 2, canvas.height - 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 48, 0, Math.PI * 2);
    ctx.stroke();

    // Center kickoff spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Penalty Boxes (Grande Área)
    ctx.strokeRect(24, canvas.height / 2 - 96, 76, 192);
    ctx.strokeRect(canvas.width - 100, canvas.height / 2 - 96, 76, 192);

    // Left & Right Goal Areas (Pequena Área)
    ctx.strokeRect(24, canvas.height / 2 - 48, 32, 96);
    ctx.strokeRect(canvas.width - 56, canvas.height / 2 - 48, 32, 96);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const pitchTex = createSoccerPitchTexture();

  const buildSoccerStadiumComplex = (
    stadiumX: number,
    stadiumZ: number,
    stadiumTitle: string,
    homeTeam: string,
    awayTeam: string
  ) => {
    const stadiumGroup = new THREE.Group();
    stadiumGroup.position.set(stadiumX, 0, stadiumZ);

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55 });
    const darkFacadeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.65,
    });
    const canopyWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.2,
    });
    const postWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.4,
    });
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    const neonGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const neonGoldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const floodlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });

    // 1. Official Striped Soccer Turf Field (34m x 24m)
    const pitchMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 24),
      new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.8 })
    );
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.position.y = 0.05;
    pitchMesh.receiveShadow = true;
    stadiumGroup.add(pitchMesh);

    // 2. Two 3D Official Goalposts with Nets (Traves de Futebol em X = -15.2 e X = +15.2)
    [-15.2, 15.2].forEach(gx => {
      const gSign = Math.sign(gx);
      const goalGroup = new THREE.Group();
      goalGroup.position.set(gx, 0, 0);

      const postFL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 8), postWhiteMat);
      postFL.position.set(0, 1.4, -3.4);
      const postFR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 8), postWhiteMat);
      postFR.position.set(0, 1.4, 3.4);
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.9, 8), postWhiteMat);
      crossbar.rotation.x = Math.PI / 2;
      crossbar.position.set(0, 2.8, 0);

      const netBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.75, 6.75), netMat);
      netBox.position.set(gSign * 0.9, 1.38, 0);

      goalGroup.add(postFL, postFR, crossbar, netBox);
      stadiumGroup.add(goalGroup);
    });

    // 3. Tiered Grandstands (Arquibancadas em 3 Níveis Coloridos) with an 8.5m Open North Tunnel!
    const seatColors = [0x0284c7, 0xfacc15, 0x16a34a];
    for (let tier = 0; tier < 3; tier++) {
      const tierMat = new THREE.MeshStandardMaterial({
        color: seatColors[tier % seatColors.length],
        roughness: 0.5,
      });
      const tierH = 2.4;
      const tierY = 1.2 + tier * 2.4;
      const offsetOut = tier * 2.2;

      // South Grandstand (Full length along Z = +14.5 + offsetOut)
      const southStand = new THREE.Mesh(
        new THREE.BoxGeometry(38 + offsetOut * 2, tierH, 2.4),
        tierMat
      );
      southStand.position.set(0, tierY, 13.5 + offsetOut);
      stadiumGroup.add(southStand);

      // West & East Grandstands (Behind both goals)
      const westStand = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, tierH, 28 + offsetOut * 2),
        tierMat
      );
      westStand.position.set(-18.5 - offsetOut, tierY, 0);
      const eastStand = westStand.clone();
      eastStand.position.set(18.5 + offsetOut, tierY, 0);
      stadiumGroup.add(westStand, eastStand);

      // North Grandstand split in 2 halves leaving an 8.5m-wide Players' Entrance Tunnel at X = 0!
      const northHalfW = 14.5 + offsetOut;
      const northStandL = new THREE.Mesh(new THREE.BoxGeometry(northHalfW, tierH, 2.4), tierMat);
      northStandL.position.set(-11.8 - offsetOut / 2, tierY, -13.5 - offsetOut);
      const northStandR = new THREE.Mesh(new THREE.BoxGeometry(northHalfW, tierH, 2.4), tierMat);
      northStandR.position.set(11.8 + offsetOut / 2, tierY, -13.5 - offsetOut);
      stadiumGroup.add(northStandL, northStandR);
    }

    // Exterior Stadium Facade Wall & Maracanã-Style Tensioned Canopy Roof
    const northPortalArch = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 3.2, 4.5),
      darkFacadeMat
    );
    northPortalArch.position.set(0, 7.6, -15.5);
    const portalNeonFrame = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 0.45, 4.7),
      neonGreenMat
    );
    portalNeonFrame.position.set(0, 9.3, -15.5);
    stadiumGroup.add(northPortalArch, portalNeonFrame);

    // Canopy Roof Segments
    const roofSouth = new THREE.Mesh(new THREE.BoxGeometry(48, 0.6, 6.5), canopyWhiteMat);
    roofSouth.position.set(0, 9.2, 16.5);
    const roofWest = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 36), canopyWhiteMat);
    roofWest.position.set(-21.5, 9.2, 0);
    const roofEast = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 36), canopyWhiteMat);
    roofEast.position.set(21.5, 9.2, 0);
    stadiumGroup.add(roofSouth, roofWest, roofEast);

    // 4. Four Towering 26m Corner Stadium Floodlight Masts (Torres de Refletores)
    const cornerCoords = [
      { x: -22, z: -17 },
      { x: 22, z: -17 },
      { x: -22, z: 17 },
      { x: 22, z: 17 },
    ];
    cornerCoords.forEach(cc => {
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 25, 8),
        concreteMat
      );
      mast.position.set(cc.x, 12.5, cc.z);
      const lightPanel = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 2.4, 0.65),
        floodlightGlowMat
      );
      lightPanel.position.set(cc.x, 25.2, cc.z);
      lightPanel.lookAt(stadiumX, 0, stadiumZ);
      stadiumGroup.add(mast, lightPanel);
    });

    // 5. Giant Digital LED Scoreboard & Entrance Banner ("⚽ ESTÁDIO DE FUTEBOL MARACANÃ 3D")
    const scoreCanvas = document.createElement('canvas');
    scoreCanvas.width = 512;
    scoreCanvas.height = 128;
    const scoreTex = new THREE.CanvasTexture(scoreCanvas);
    scoreTex.colorSpace = THREE.SRGBColorSpace;

    const updateScoreboard = (headline: string, subline: string, isGoal: boolean) => {
      const sCtx = scoreCanvas.getContext('2d');
      if (!sCtx) return;
      sCtx.fillStyle = isGoal ? '#064e3b' : '#020617';
      sCtx.fillRect(0, 0, 512, 128);
      sCtx.strokeStyle = isGoal ? '#facc15' : '#22c55e';
      sCtx.lineWidth = 8;
      sCtx.strokeRect(4, 4, 504, 120);
      sCtx.fillStyle = '#fef08a';
      sCtx.font = '900 26px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText(headline, 256, 46);
      sCtx.fillStyle = '#4ade80';
      sCtx.font = 'bold 21px sans-serif';
      sCtx.fillText(subline, 256, 90);
      scoreTex.needsUpdate = true;
    };

    updateScoreboard(
      stadiumTitle,
      `⚽ ${homeTeam} 2 x 1 ${awayTeam} • CHUTE A BOLA PRO GOL!`,
      false
    );

    const scoreSpriteNorth = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: scoreTex, transparent: true })
    );
    scoreSpriteNorth.scale.set(16, 4.0, 1);
    scoreSpriteNorth.position.set(0, 12.8, -15.5);

    const scoreSpriteSouth = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: scoreTex, transparent: true })
    );
    scoreSpriteSouth.scale.set(18, 4.5, 1);
    scoreSpriteSouth.position.set(0, 13.8, 16.5);
    stadiumGroup.add(scoreSpriteNorth, scoreSpriteSouth);

    // Helper to create an overhead Jersey Number & Role Badge for Stadium Players
    const createPlayerBadgeSprite = (label: string, bgColor: string, borderColor: string, textColor: string) => {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 256;
      pCanvas.height = 64;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        pCtx.fillStyle = bgColor;
        pCtx.fillRect(4, 4, 248, 56);
        pCtx.strokeStyle = borderColor;
        pCtx.lineWidth = 4;
        pCtx.strokeRect(4, 4, 248, 56);
        pCtx.fillStyle = textColor;
        pCtx.font = '900 22px sans-serif';
        pCtx.textAlign = 'center';
        pCtx.textBaseline = 'middle';
        pCtx.fillText(label, 128, 33);
      }
      const pTex = new THREE.CanvasTexture(pCanvas);
      pTex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: pTex, transparent: true, depthTest: false })
      );
      sprite.scale.set(2.35, 0.58, 1);
      sprite.position.set(0, 2.25, 0);
      return sprite;
    };

    // 6. Animated 3D Goalkeepers defending both goals
    const keepers: Array<{
      mesh: ReturnType<typeof createPedestrian>;
      goalX: number;
      baseZ: number;
      phase: number;
      saveCooldown: number;
    }> = [];
    [-14.2, 14.2].forEach((kx, kIdx) => {
      const kMesh = createPedestrian(
        kIdx === 0 ? 0x10b981 : 0x06b6d4,
        0x0f172a,
        0xfde68a,
        false,
        isLow
      );
      kMesh.position.set(kx, 0, 0);
      kMesh.rotation.y = kIdx === 0 ? Math.PI / 2 : -Math.PI / 2;
      kMesh.add(
        createPlayerBadgeSprite(
          kIdx === 0 ? '🧤 #1 GOLEIRO' : '🧤 #12 GOLEIRO',
          'rgba(2, 6, 23, 0.88)',
          kIdx === 0 ? '#10b981' : '#06b6d4',
          '#f8fafc'
        )
      );
      stadiumGroup.add(kMesh);
      keepers.push({ mesh: kMesh, goalX: kx, baseZ: 0, phase: kIdx * 1.7, saveCooldown: 0 });
    });

    // 6.5 Full 3D Soccer Match Squads on the Pitch (Time da Casa 5x5 Time Visitante + Árbitro!)
    interface StadiumFieldPlayer {
      mesh: ReturnType<typeof createPedestrian>;
      team: 'home' | 'away' | 'referee';
      label: string;
      baseX: number;
      baseZ: number;
      x: number;
      z: number;
      phase: number;
      kickCooldown: number;
    }

    const fieldPlayers: StadiumFieldPlayer[] = [];
    const rosterSpecs: Array<{
      team: 'home' | 'away' | 'referee';
      label: string;
      baseX: number;
      baseZ: number;
      shirt: number;
      shorts: number;
      skin: number;
    }> = [
      // Home Team (Camisa Canarinho Amarela + Calção Azul - Ataca para Leste +X)
      { team: 'home', label: '⚽ #10 CRAQUE', baseX: -2.2, baseZ: -1.6, shirt: 0xfacc15, shorts: 0x1d4ed8, skin: 0xd97706 },
      { team: 'home', label: '⚽ #9 ARTILHEIRO', baseX: 3.8, baseZ: 2.4, shirt: 0xfacc15, shorts: 0x1d4ed8, skin: 0xfde68a },
      { team: 'home', label: '⚽ #8 MEIA', baseX: -5.2, baseZ: 4.8, shirt: 0xfacc15, shorts: 0x1d4ed8, skin: 0xb45309 },
      { team: 'home', label: '⚽ #7 PONTA', baseX: -4.8, baseZ: -5.4, shirt: 0xfacc15, shorts: 0x1d4ed8, skin: 0xfde68a },
      { team: 'home', label: '🛡️ #4 ZAGUEIRO', baseX: -9.6, baseZ: 0.6, shirt: 0xfacc15, shorts: 0x1d4ed8, skin: 0x92400e },

      // Away Team (Camisa Rubro-Negra Vermelha + Calção Preto - Ataca para Oeste -X)
      { team: 'away', label: '🔥 #9 ATACANTE', baseX: 2.2, baseZ: 1.6, shirt: 0xef4444, shorts: 0x09090b, skin: 0xfde68a },
      { team: 'away', label: '🔥 #10 CAMISA 10', baseX: -3.8, baseZ: -2.4, shirt: 0xef4444, shorts: 0x09090b, skin: 0xd97706 },
      { team: 'away', label: '🔥 #11 PONTA', baseX: 5.2, baseZ: -4.8, shirt: 0xef4444, shorts: 0x09090b, skin: 0x92400e },
      { team: 'away', label: '🔥 #5 VOLANTE', baseX: 4.8, baseZ: 5.4, shirt: 0xef4444, shorts: 0x09090b, skin: 0xfde68a },
      { team: 'away', label: '🛡️ #3 ZAGUEIRO', baseX: 9.6, baseZ: -0.6, shirt: 0xef4444, shorts: 0x09090b, skin: 0xb45309 },

      // Match Referee (Árbitro Oficial acompanhando o lance)
      { team: 'referee', label: '🟨 ÁRBITRO FIFA', baseX: 0.0, baseZ: -6.8, shirt: 0x111827, shorts: 0x09090b, skin: 0xfde68a },
    ];

    rosterSpecs.forEach((spec, idx) => {
      const pMesh = createPedestrian(spec.shirt, spec.shorts, spec.skin, false, isLow);
      pMesh.position.set(spec.baseX, 0, spec.baseZ);
      pMesh.rotation.y = spec.team === 'home' ? Math.PI / 2 : spec.team === 'away' ? -Math.PI / 2 : 0;

      const badgeBorder =
        spec.team === 'home' ? '#facc15' : spec.team === 'away' ? '#ef4444' : '#22d3ee';
      const badgeText =
        spec.team === 'home' ? '#fef08a' : spec.team === 'away' ? '#fecaca' : '#e0f2fe';
      pMesh.add(
        createPlayerBadgeSprite(spec.label, 'rgba(2, 6, 23, 0.88)', badgeBorder, badgeText)
      );

      stadiumGroup.add(pMesh);
      fieldPlayers.push({
        mesh: pMesh,
        team: spec.team,
        label: spec.label,
        baseX: spec.baseX,
        baseZ: spec.baseZ,
        x: spec.baseX,
        z: spec.baseZ,
        phase: idx * 0.95,
        kickCooldown: 0.5 + (idx % 3) * 0.3,
      });
    });

    // 6.8 Cheering 3D Crowd Spectators in the Grandstands (Torcida Vibrando na Arquibancada!)
    const grandstandFans: Array<{
      mesh: ReturnType<typeof createPedestrian>;
      baseY: number;
      phase: number;
    }> = [];
    const fanSpots = [
      // South Grandstand Tiers
      { x: -12, y: 3.1, z: 15.2, rotY: Math.PI, shirt: 0xfacc15 },
      { x: -6, y: 4.9, z: 16.8, rotY: Math.PI, shirt: 0x22c55e },
      { x: 0, y: 3.1, z: 15.2, rotY: Math.PI, shirt: 0xfacc15 },
      { x: 6, y: 4.9, z: 16.8, rotY: Math.PI, shirt: 0xef4444 },
      { x: 12, y: 3.1, z: 15.2, rotY: Math.PI, shirt: 0x38bdf8 },
      // North Grandstand Tiers (Left & Right of Entrance Tunnel)
      { x: -12, y: 3.1, z: -15.2, rotY: 0, shirt: 0xfacc15 },
      { x: -8, y: 4.9, z: -16.8, rotY: 0, shirt: 0x22c55e },
      { x: 8, y: 4.9, z: -16.8, rotY: 0, shirt: 0xef4444 },
      { x: 12, y: 3.1, z: -15.2, rotY: 0, shirt: 0xfacc15 },
      // West & East Grandstands behind the Goals
      { x: -19.2, y: 3.1, z: -5.5, rotY: Math.PI / 2, shirt: 0xfacc15 },
      { x: -20.8, y: 4.9, z: 0, rotY: Math.PI / 2, shirt: 0x22c55e },
      { x: -19.2, y: 3.1, z: 5.5, rotY: Math.PI / 2, shirt: 0xfacc15 },
      { x: 19.2, y: 3.1, z: -5.5, rotY: -Math.PI / 2, shirt: 0xef4444 },
      { x: 20.8, y: 4.9, z: 0, rotY: -Math.PI / 2, shirt: 0x38bdf8 },
      { x: 19.2, y: 3.1, z: 5.5, rotY: -Math.PI / 2, shirt: 0xef4444 },
    ];
    fanSpots.forEach((fs, fIdx) => {
      const fanMesh = createPedestrian(fs.shirt, 0x1e293b, 0xfde68a, false, isLow);
      fanMesh.position.set(fs.x, fs.y, fs.z);
      fanMesh.rotation.y = fs.rotY;
      stadiumGroup.add(fanMesh);
      grandstandFans.push({ mesh: fanMesh, baseY: fs.y, phase: fIdx * 0.8 });
    });

    // 7. Interactive 3D Soccer Ball at Center Circle (Bola de Futebol 3D Interativa!)
    const ballGroup = new THREE.Group();
    const ballWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    const ballPentagons = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.635, 1),
      new THREE.MeshBasicMaterial({ color: 0x09090b, wireframe: true })
    );
    const ballRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.06, 8, 20),
      neonGoldMat
    );
    ballRing.rotation.x = Math.PI / 2;
    ballRing.position.y = -0.52;
    ballGroup.add(ballWhite, ballPentagons, ballRing);
    ballGroup.position.set(0, 0.62, 0);
    stadiumGroup.add(ballGroup);

    const ballState: InteractiveSoccerBall = {
      mesh: ballGroup,
      stadiumCenterX: stadiumX,
      stadiumCenterZ: stadiumZ,
      localX: 0,
      localZ: 0,
      y: 0.62,
      worldX: stadiumX,
      worldZ: stadiumZ,
      vx: 0,
      vz: 0,
      vy: 0,
      homeScore: 2,
      awayScore: 1,
      goalCelebrationTimer: 0,
      updateScoreboard,
    };
    soccerBalls.push(ballState);

    scene.add(stadiumGroup);

    // Register solid collision boxes for the 4 grandstand walls while leaving the North Tunnel (X: -4.2..+4.2) and the entire 34x24 pitch open!
    collisionBoxes.push(
      // South Grandstand Wall
      { minX: stadiumX - 23, maxX: stadiumX + 23, minZ: stadiumZ + 12.2, maxZ: stadiumZ + 19.5 },
      // West Grandstand Wall
      { minX: stadiumX - 23.5, maxX: stadiumX - 16.8, minZ: stadiumZ - 17, maxZ: stadiumZ + 17 },
      // East Grandstand Wall
      { minX: stadiumX + 16.8, maxX: stadiumX + 23.5, minZ: stadiumZ - 17, maxZ: stadiumZ + 17 },
      // North-West Grandstand Wall (Left of entrance tunnel)
      { minX: stadiumX - 23, maxX: stadiumX - 4.4, minZ: stadiumZ - 19.5, maxZ: stadiumZ - 12.2 },
      // North-East Grandstand Wall (Right of entrance tunnel)
      { minX: stadiumX + 4.4, maxX: stadiumX + 23, minZ: stadiumZ - 19.5, maxZ: stadiumZ - 12.2 }
    );

    animatables.push({
      update: (dt, time) => {
        const sdx = lastLodPlayerX - stadiumX;
        const sdz = lastLodPlayerZ - stadiumZ;
        const maxStadiumAnimDist = 185 * currentPedLodScale;
        if (sdx * sdx + sdz * sdz > maxStadiumAnimDist * maxStadiumAnimDist) return;

        const isGoalParty = ballState.goalCelebrationTimer > 0;

        // 1) Animate Goalkeepers tracking the ball + diving/saving shots near the goal box
        for (const kp of keepers) {
          if (kp.saveCooldown > 0) kp.saveCooldown = Math.max(0, kp.saveCooldown - dt);
          const targetKeeperZ = THREE.MathUtils.clamp(
            ballState.localZ * 0.72 + Math.sin(time * 2.8 + kp.phase) * 0.9,
            -2.75,
            2.75
          );
          kp.mesh.position.z = THREE.MathUtils.damp(kp.mesh.position.z, targetKeeperZ, 5.5, dt);
          kp.mesh.position.y = Math.abs(Math.sin(time * 5.6 + kp.phase)) * 0.22;
          kp.mesh.leftArm.rotation.x = -1.2 + Math.sin(time * 6 + kp.phase) * 0.35;
          kp.mesh.rightArm.rotation.x = -1.2 - Math.sin(time * 6 + kp.phase) * 0.35;

          // Goalkeeper save/clearance if ball comes close to the keeper!
          const distBallToKeeper = Math.hypot(
            ballState.localX - kp.goalX,
            ballState.localZ - kp.mesh.position.z
          );
          if (distBallToKeeper < 1.35 && kp.saveCooldown <= 0 && !isGoalParty) {
            kp.saveCooldown = 1.4;
            const clearDirX = kp.goalX < 0 ? 1 : -1;
            ballState.vx = clearDirX * (12.5 + Math.random() * 4.5);
            ballState.vz = (Math.random() - 0.5) * 9.0;
            ballState.vy = 4.6;
          }
        }

        // 2) Find closest Home & Away players to the ball so they actively press/dribble/shoot!
        let closestHomeIdx = -1;
        let closestHomeDist = Infinity;
        let closestAwayIdx = -1;
        let closestAwayDist = Infinity;

        for (let i = 0; i < fieldPlayers.length; i++) {
          const fp = fieldPlayers[i];
          if (fp.kickCooldown > 0) fp.kickCooldown = Math.max(0, fp.kickCooldown - dt);
          const d = Math.hypot(ballState.localX - fp.x, ballState.localZ - fp.z);
          if (fp.team === 'home' && d < closestHomeDist) {
            closestHomeDist = d;
            closestHomeIdx = i;
          } else if (fp.team === 'away' && d < closestAwayDist) {
            closestAwayDist = d;
            closestAwayIdx = i;
          }
        }

        // 3) Update all 10 Field Players + Referee (Tactical Movement, Running Stride & Ball Kicking)
        for (let i = 0; i < fieldPlayers.length; i++) {
          const fp = fieldPlayers[i];

          if (isGoalParty) {
            // Goal celebration: jump and wave both arms toward the crowd!
            fp.mesh.position.y = Math.abs(Math.sin(time * 9.5 + fp.phase)) * 0.38;
            fp.mesh.leftArm.rotation.x = -2.65 + Math.sin(time * 14 + fp.phase) * 0.25;
            fp.mesh.rightArm.rotation.x = -2.65 - Math.sin(time * 14 + fp.phase) * 0.25;
            fp.mesh.leftLeg.rotation.x = 0.25;
            fp.mesh.rightLeg.rotation.x = -0.25;
            fp.mesh.rotation.y += dt * 3.5;
            continue;
          }

          let targetX = fp.baseX;
          let targetZ = fp.baseZ;
          let moveSpeed = 3.4;

          if (fp.team === 'referee') {
            // Referee tracks the ball from the flank without getting in the way
            targetX = THREE.MathUtils.clamp(ballState.localX * 0.55, -10.5, 10.5);
            targetZ = THREE.MathUtils.clamp(ballState.localZ - 4.8, -9.8, 9.8);
            moveSpeed = 3.8;
          } else if (i === closestHomeIdx || i === closestAwayIdx) {
            // Active ball chaser sprints directly toward the ball!
            targetX = ballState.localX;
            targetZ = ballState.localZ;
            moveSpeed = 4.55;
          } else {
            // Teammates shift dynamically with the play and weave into open space
            const attackShiftX = ballState.localX * 0.38 + Math.sin(time * 1.6 + fp.phase) * 2.1;
            const attackShiftZ = ballState.localZ * 0.28 + Math.cos(time * 1.4 + fp.phase) * 1.8;
            targetX = THREE.MathUtils.clamp(fp.baseX + attackShiftX, -13.2, 13.2);
            targetZ = THREE.MathUtils.clamp(fp.baseZ + attackShiftZ, -9.8, 9.8);
            moveSpeed = 3.2;
          }

          const dx = targetX - fp.x;
          const dz = targetZ - fp.z;
          const distToTarget = Math.hypot(dx, dz);

          if (distToTarget > 0.15) {
            const step = Math.min(distToTarget, moveSpeed * dt);
            fp.x += (dx / distToTarget) * step;
            fp.z += (dz / distToTarget) * step;
            fp.mesh.rotation.y = Math.atan2(dx, dz);

            // Animated running stride
            const runCycle = Math.sin(time * moveSpeed * 4.2 + fp.phase) * 0.68;
            fp.mesh.leftLeg.rotation.x = runCycle;
            fp.mesh.rightLeg.rotation.x = -runCycle;
            fp.mesh.leftArm.rotation.x = -runCycle * 0.85;
            fp.mesh.rightArm.rotation.x = runCycle * 0.85;
            fp.mesh.position.y = Math.abs(Math.sin(time * moveSpeed * 4.2 + fp.phase)) * 0.08;
          } else {
            fp.mesh.leftLeg.rotation.x = 0;
            fp.mesh.rightLeg.rotation.x = 0;
            fp.mesh.leftArm.rotation.x = 0;
            fp.mesh.rightArm.rotation.x = 0;
            fp.mesh.position.y = 0;
          }

          fp.mesh.position.x = fp.x;
          fp.mesh.position.z = fp.z;

          // If this field player reaches the ball, they pass or shoot toward the opponent's goal!
          if (fp.team !== 'referee' && fp.kickCooldown <= 0) {
            const distToBall = Math.hypot(ballState.localX - fp.x, ballState.localZ - fp.z);
            if (distToBall < 1.08 && ballState.y < 1.25) {
              fp.kickCooldown = 1.15;
              const goalTargetX = fp.team === 'home' ? 15.2 : -15.2;
              const goalTargetZ = (Math.sin(time * 3.7 + fp.phase) * 0.65) * 2.4;
              const shotDx = goalTargetX - ballState.localX;
              const shotDz = goalTargetZ - ballState.localZ;
              const shotDist = Math.max(0.1, Math.hypot(shotDx, shotDz));
              const shotPower = shotDist < 9.5 ? 13.5 : 10.2;
              ballState.vx = (shotDx / shotDist) * shotPower;
              ballState.vz = (shotDz / shotDist) * shotPower + (Math.random() - 0.5) * 2.2;
              ballState.vy = shotDist < 9.5 ? 3.4 : 2.1;
              // Kick swing animation
              fp.mesh.rightLeg.rotation.x = -1.15;
            }
          }
        }

        // 4) Animate Grandstand Spectators cheering and jumping
        for (const fan of grandstandFans) {
          const cheerSpeed = isGoalParty ? 11.0 : 4.5;
          const jumpHeight = isGoalParty ? 0.32 : 0.12;
          fan.mesh.position.y = fan.baseY + Math.abs(Math.sin(time * cheerSpeed + fan.phase)) * jumpHeight;
          fan.mesh.leftArm.rotation.x = -2.35 + Math.sin(time * cheerSpeed + fan.phase) * 0.35;
          fan.mesh.rightArm.rotation.x = -2.35 - Math.sin(time * cheerSpeed + fan.phase) * 0.35;
        }

        // 5) Update Interactive 3D Soccer Ball physics
        if (ballState.goalCelebrationTimer > 0) {
          ballState.goalCelebrationTimer = Math.max(0, ballState.goalCelebrationTimer - dt);
          if (ballState.goalCelebrationTimer <= 0) {
            ballState.updateScoreboard(
              stadiumTitle,
              `⚽ ${homeTeam} ${ballState.homeScore} x ${ballState.awayScore} ${awayTeam} • PARTIDA AO VIVO!`,
              false
            );
          }
        }

        ballState.localX += ballState.vx * dt;
        ballState.localZ += ballState.vz * dt;
        ballState.y += ballState.vy * dt;

        if (ballState.y > 0.62) {
          ballState.vy -= 18.0 * dt;
        } else {
          ballState.y = 0.62;
          if (Math.abs(ballState.vy) > 1.5) {
            ballState.vy = -ballState.vy * 0.45;
          } else {
            ballState.vy = 0;
          }
        }

        // Turf rolling friction
        ballState.vx = THREE.MathUtils.damp(ballState.vx, 0, 1.5, dt);
        ballState.vz = THREE.MathUtils.damp(ballState.vz, 0, 1.5, dt);

        // Spin ball mesh
        ballWhite.rotation.z -= ballState.vx * dt * 1.4;
        ballWhite.rotation.x += ballState.vz * dt * 1.4;
        ballPentagons.rotation.copy(ballWhite.rotation);

        // Check if a GOAL was scored in the West or East Goalpost!
        if (Math.abs(ballState.localX) > 14.2 && Math.abs(ballState.localZ) < 3.35) {
          sound.playCash();
          if (ballState.localX > 0) {
            ballState.homeScore += 1;
          } else {
            ballState.awayScore += 1;
          }
          ballState.goalCelebrationTimer = 4.0;
          ballState.updateScoreboard(
            '⚽ GOOOOL NO ESTÁDIO MARACANÃ 3D!! 🎉',
            `${homeTeam} ${ballState.homeScore} x ${ballState.awayScore} ${awayTeam} • TORCIDA EM FESTA!`,
            true
          );
          // Reset ball to center circle
          ballState.localX = 0;
          ballState.localZ = 0;
          ballState.vx = 0;
          ballState.vz = 0;
          ballState.vy = 5.5;
        }

        // Bounce off stadium pitch perimeter boards
        if (ballState.localX > 15.8) {
          ballState.localX = 15.8;
          ballState.vx = -Math.abs(ballState.vx) * 0.7;
        } else if (ballState.localX < -15.8) {
          ballState.localX = -15.8;
          ballState.vx = Math.abs(ballState.vx) * 0.7;
        }
        if (ballState.localZ > 11.2) {
          ballState.localZ = 11.2;
          ballState.vz = -Math.abs(ballState.vz) * 0.7;
        } else if (ballState.localZ < -11.2) {
          ballState.localZ = -11.2;
          ballState.vz = Math.abs(ballState.vz) * 0.7;
        }

        ballState.mesh.position.set(ballState.localX, ballState.y, ballState.localZ);
        ballState.worldX = stadiumX + ballState.localX;
        ballState.worldZ = stadiumZ + ballState.localZ;
      },
    });
  };

  // Spawn Main City 3D Soccer Stadium ("Estádio Maracanã 3D • Arena MotoGrau FC") at X = -40, Z = 174 (clear of Z = 145 avenue)
  buildSoccerStadiumComplex(
    -40,
    174,
    '⚽ ESTÁDIO MARACANÃ 3D • ARENA MOTOGRAU',
    'MOTOGRAU FC',
    'FALCÃO FC'
  );

  // Spawn Second City ("Nova Metrópole") 3D Soccer Stadium at X = 448, Z = -174 (clear of X = 350 & X = 410 avenues)
  buildSoccerStadiumComplex(
    448,
    -174,
    '⚽ ARENA ILHA DE CRISTAL • NOVA METRÓPOLE',
    'CRISTAL FC',
    'ATLÂNTICO FC'
  );

  // 13.5 CUSTOMIZED 3D AMUSEMENT PARK COMPLEX (PARQUE DE DIVERSÕES COMPLETO & ANIMADO)
  const buildAmusementParkComplex = (
    parkCenterX: number,
    parkCenterZ: number,
    parkTitle: string,
    facingAngleY: number = -Math.PI / 2
  ) => {
    const parkGroup = new THREE.Group();
    parkGroup.position.set(parkCenterX, 0, parkCenterZ);
    parkGroup.rotation.y = facingAngleY;

    // Shared High-Contrast Festive & Neon Materials
    const steelSupportMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.82,
      roughness: 0.25,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.65,
      roughness: 0.25,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
    });
    const carnivalRedMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.35,
      metalness: 0.2,
    });
    const carnivalBlueMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.3,
    });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const neonYellowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const neonPurpleMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const neonGreenMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

    // 1. FESTIVE CHECKERBOARD PROMENADE FLOOR & RED CARPET WALKWAY
    const plazaFloor = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.14, 34),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.65 })
    );
    plazaFloor.position.set(0, 0.07, 0);
    plazaFloor.receiveShadow = true;
    parkGroup.add(plazaFloor);

    const redCarpet = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.17, 32),
      carnivalRedMat
    );
    redCarpet.position.set(0, 0.085, 0);
    parkGroup.add(redCarpet);

    // 2. MONUMENTAL ENTRANCE PORTAL ARCHWAY + TICKET BOOTH (Pórtico Iluminado & Bilheteria VIP)
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0, 15.5);

    const leftPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.8, 8.2, 12),
      carnivalRedMat
    );
    leftPillar.position.set(-4.6, 4.1, 0);
    const rightPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.8, 8.2, 12),
      carnivalRedMat
    );
    rightPillar.position.set(4.6, 4.1, 0);

    // Gold spiral rings on entrance pillars
    for (let r = 1; r <= 3; r++) {
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.1, 8, 16), goldTrimMat);
      ringL.rotation.x = Math.PI / 2;
      ringL.position.set(-4.6, r * 2.1, 0);
      const ringR = ringL.clone();
      ringR.position.set(4.6, r * 2.1, 0);
      archGroup.add(ringL, ringR);
    }

    const archHeader = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 2.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.3, metalness: 0.5 })
    );
    archHeader.position.set(0, 8.4, 0);
    const archNeonBorder = new THREE.Mesh(
      new THREE.BoxGeometry(11.7, 2.35, 0.9),
      neonYellowMat
    );
    archNeonBorder.position.set(0, 8.4, 0);
    archGroup.add(leftPillar, rightPillar, archNeonBorder, archHeader);

    // Overhead Canvas Banner Sprite on Entrance Arch
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 112;
    const bCtx = bannerCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = '#1e1b4b';
      bCtx.fillRect(0, 0, 512, 112);
      bCtx.strokeStyle = '#facc15';
      bCtx.lineWidth = 8;
      bCtx.strokeRect(6, 6, 500, 100);
      bCtx.fillStyle = '#fef08a';
      bCtx.font = '900 30px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(parkTitle, 256, 42);
      bCtx.fillStyle = '#22d3ee';
      bCtx.font = 'bold 20px sans-serif';
      bCtx.fillText('🎠 CARROSSEL • 🎡 RODA-GIGANTE • 🎢 MONTANHA-RUSSA • 🗼 TORRE', 256, 80);
    }
    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    const bannerSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: bannerTex, transparent: true })
    );
    bannerSprite.scale.set(13.5, 3.0, 1);
    bannerSprite.position.set(0, 11.2, 0);
    archGroup.add(bannerSprite);

    // Ticket Booth (Bilheteria 3D) beside the arch
    const booth = new THREE.Group();
    booth.position.set(-7.5, 0, 0);
    const boothBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.8, 2.6),
      carnivalBlueMat
    );
    boothBase.position.y = 1.4;
    const boothGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 1.1, 2.0),
      neonYellowMat
    );
    boothGlass.position.y = 1.85;
    const boothRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 1.5, 8),
      carnivalRedMat
    );
    boothRoof.position.y = 3.55;
    booth.add(boothBase, boothGlass, boothRoof);
    archGroup.add(booth);
    parkGroup.add(archGroup);

    // 3. DOUBLE-RIM GIANT FERRIS WHEEL WITH SELF-LEVELING GONDOLAS (Roda-Gigante Panorâmica)
    const ferrisStation = new THREE.Group();
    ferrisStation.position.set(-8.5, 0, -7.5);

    const fLegFL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 18.5, 8), steelSupportMat);
    fLegFL.position.set(-2.2, 8.8, 2.2);
    fLegFL.rotation.z = -0.12;
    const fLegFR = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 18.5, 8), steelSupportMat);
    fLegFR.position.set(2.2, 8.8, 2.2);
    fLegFR.rotation.z = 0.12;
    const fLegBL = fLegFL.clone();
    fLegBL.position.z = -2.2;
    const fLegBR = fLegFR.clone();
    fLegBR.position.z = -2.2;
    ferrisStation.add(fLegFL, fLegFR, fLegBL, fLegBR);

    const ferrisWheelRotator = new THREE.Group();
    ferrisWheelRotator.position.set(0, 17.5, 0);

    const rimFront = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.3, 12, 32), neonPinkMat);
    rimFront.position.z = 1.1;
    const rimBack = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.3, 12, 32), neonPinkMat);
    rimBack.position.z = -1.1;
    const innerStarRim = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.22, 10, 24), neonCyanMat);
    const hubAxle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 3.2, 12),
      goldTrimMat
    );
    hubAxle.rotation.x = Math.PI / 2;
    ferrisWheelRotator.add(rimFront, rimBack, innerStarRim, hubAxle);

    const gondolaPivots: THREE.Group[] = [];
    const gondolaPalette = [neonYellowMat, neonCyanMat, neonGreenMat, neonPurpleMat];
    for (let s = 0; s < 10; s++) {
      const angle = (s * Math.PI * 2) / 10;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 21, 6),
        steelSupportMat
      );
      spoke.rotation.z = angle;
      ferrisWheelRotator.add(spoke);

      const gPivot = new THREE.Group();
      gPivot.position.set(Math.cos(angle) * 10.5, Math.sin(angle) * 10.5, 0);

      const hanger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
        steelSupportMat
      );
      hanger.position.y = -0.6;
      const cabinBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 1.45, 1.55),
        gondolaPalette[s % gondolaPalette.length]
      );
      cabinBody.position.y = -1.35;
      const cabinRoof = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, 0.55, 6),
        carnivalRedMat
      );
      cabinRoof.position.y = -0.45;
      gPivot.add(hanger, cabinBody, cabinRoof);

      ferrisWheelRotator.add(gPivot);
      gondolaPivots.push(gPivot);
    }

    ferrisStation.add(ferrisWheelRotator);
    parkGroup.add(ferrisStation);

    // 4. ANIMATED ROYAL CAROUSEL (Carrossel Imperial com Cavalinhos que Sobem e Descem)
    const carouselGroup = new THREE.Group();
    carouselGroup.position.set(8.2, 0, 5.2);

    const carouselBase = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.5, 0.65, 20),
      goldTrimMat
    );
    carouselBase.position.y = 0.32;
    const centerColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 5.4, 14),
      neonYellowMat
    );
    centerColumn.position.y = 3.0;
    const carouselCanopy = new THREE.Mesh(
      new THREE.ConeGeometry(5.6, 2.8, 16),
      carnivalRedMat
    );
    carouselCanopy.position.y = 6.8;
    const canopyTrim = new THREE.Mesh(
      new THREE.TorusGeometry(5.4, 0.22, 10, 24),
      neonCyanMat
    );
    canopyTrim.rotation.x = Math.PI / 2;
    canopyTrim.position.y = 5.45;
    carouselGroup.add(carouselBase, centerColumn, carouselCanopy, canopyTrim);

    const carouselSpinner = new THREE.Group();
    carouselSpinner.position.y = 0.65;
    const horseNodes: Array<{ mesh: THREE.Group; phase: number }> = [];

    for (let h = 0; h < 8; h++) {
      const hAngle = (h * Math.PI * 2) / 8;
      const radius = 3.7;
      const hx = Math.cos(hAngle) * radius;
      const hz = Math.sin(hAngle) * radius;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 4.8, 8),
        goldTrimMat
      );
      pole.position.set(hx, 2.4, hz);
      carouselSpinner.add(pole);

      const horseGroup = new THREE.Group();
      horseGroup.position.set(hx, 1.8, hz);
      horseGroup.rotation.y = -hAngle;

      const hBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.55, 1.35),
        h % 2 === 0 ? neonPinkMat : neonCyanMat
      );
      const hHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.65, 0.45),
        neonYellowMat
      );
      hHead.position.set(0, 0.45, 0.52);
      horseGroup.add(hBody, hHead);
      carouselSpinner.add(horseGroup);
      horseNodes.push({ mesh: horseGroup, phase: h * 0.9 });
    }
    carouselGroup.add(carouselSpinner);
    parkGroup.add(carouselGroup);

    // 5. KAMIKAZE FREE-FALL DROP TOWER (Torre de Queda Livre Turbo de 28m)
    const dropTowerGroup = new THREE.Group();
    dropTowerGroup.position.set(9.0, 0, -9.5);

    const towerMast = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 27, 2.1),
      steelSupportMat
    );
    towerMast.position.y = 13.5;
    const towerNeonStripeL = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 26.5, 2.25),
      neonPurpleMat
    );
    towerNeonStripeL.position.set(-0.95, 13.5, 0);
    const towerNeonStripeR = towerNeonStripeL.clone();
    towerNeonStripeR.position.x = 0.95;

    const towerCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.2, 2.4, 12),
      carnivalRedMat
    );
    towerCrown.position.y = 27.5;
    const crownBeacon = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.25, 10, 20),
      neonYellowMat
    );
    crownBeacon.rotation.x = Math.PI / 2;
    crownBeacon.position.y = 28.2;
    dropTowerGroup.add(
      towerMast,
      towerNeonStripeL,
      towerNeonStripeR,
      towerCrown,
      crownBeacon
    );

    const dropCarriage = new THREE.Group();
    const carriageRing = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 1.3, 4.4),
      neonCyanMat
    );
    const carriageSeats = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.75, 4.8),
      carnivalRedMat
    );
    carriageSeats.position.y = -0.3;
    dropCarriage.add(carriageRing, carriageSeats);
    dropCarriage.position.y = 3.0;
    dropTowerGroup.add(dropCarriage);
    parkGroup.add(dropTowerGroup);

    // 6. SWINGING PIRATE VIKING SHIP (Barco Viking Oscilante)
    const vikingStation = new THREE.Group();
    vikingStation.position.set(-8.5, 0, 6.2);

    const vFrameL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.48, 12.5, 8),
      carnivalBlueMat
    );
    vFrameL.position.set(-2.8, 6.0, 0);
    vFrameL.rotation.z = -0.18;
    const vFrameR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.48, 12.5, 8),
      carnivalBlueMat
    );
    vFrameR.position.set(2.8, 6.0, 0);
    vFrameR.rotation.z = 0.18;
    const vTopBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 6.4, 8),
      goldTrimMat
    );
    vTopBar.rotation.z = Math.PI / 2;
    vTopBar.position.set(0, 11.8, 0);
    vikingStation.add(vFrameL, vFrameR, vTopBar);

    const vikingPendulum = new THREE.Group();
    vikingPendulum.position.set(0, 11.8, 0);

    const hangerArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 8.2, 8),
      goldTrimMat
    );
    hangerArm.position.y = -4.1;

    const shipHull = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 1.5, 6.8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 })
    );
    shipHull.position.y = -8.2;
    const shipTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.35, 7.1),
      neonYellowMat
    );
    shipTrim.position.y = -7.55;
    vikingPendulum.add(hangerArm, shipHull, shipTrim);
    vikingStation.add(vikingPendulum);
    parkGroup.add(vikingStation);

    // 7. NEON ROLLER COASTER 360° LOOP & MOVING COASTER TRAIN (Montanha-Russa Looping)
    const coasterGroup = new THREE.Group();
    coasterGroup.position.set(0, 0, -13.5);

    const loopRadius = 7.5;
    const loopTrack1 = new THREE.Mesh(
      new THREE.TorusGeometry(loopRadius, 0.25, 10, 32),
      neonGreenMat
    );
    loopTrack1.position.set(0, loopRadius + 1.2, 0);
    const loopTrack2 = new THREE.Mesh(
      new THREE.TorusGeometry(loopRadius - 0.65, 0.18, 10, 32),
      steelSupportMat
    );
    loopTrack2.position.set(0, loopRadius + 1.2, 0);
    coasterGroup.add(loopTrack1, loopTrack2);

    const coasterTrain = new THREE.Group();
    for (let c = 0; c < 3; c++) {
      const carMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.95, 1.3),
        c === 0 ? neonPinkMat : neonYellowMat
      );
      carMesh.position.x = -c * 1.85;
      coasterTrain.add(carMesh);
    }
    coasterGroup.add(coasterTrain);
    parkGroup.add(coasterGroup);

    // 8. CIRCUS BIG TOP TENT & POPCORN / COTTON CANDY STALLS (Tenda de Circo & Barracas)
    const circusTent = new THREE.Group();
    circusTent.position.set(0, 0, -1.5);
    const tentWalls = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 3.0, 16),
      carnivalRedMat
    );
    tentWalls.position.y = 1.5;
    const tentRoof = new THREE.Mesh(
      new THREE.ConeGeometry(4.4, 3.2, 16),
      goldTrimMat
    );
    tentRoof.position.y = 4.6;
    circusTent.add(tentWalls, tentRoof);
    parkGroup.add(circusTent);

    scene.add(parkGroup);

    // Register solid collision boxes for the major rides while leaving the central walkway drivable!
    collisionBoxes.push(
      {
        minX: parkCenterX - 12,
        maxX: parkCenterX - 5,
        minZ: parkCenterZ - 12,
        maxZ: parkCenterZ - 3,
      },
      {
        minX: parkCenterX + 4,
        maxX: parkCenterX + 13,
        minZ: parkCenterZ + 1,
        maxZ: parkCenterZ + 10,
      },
      {
        minX: parkCenterX + 5,
        maxX: parkCenterX + 13,
        minZ: parkCenterZ - 13,
        maxZ: parkCenterZ - 6,
      },
      {
        minX: parkCenterX - 3.5,
        maxX: parkCenterX + 3.5,
        minZ: parkCenterZ - 5,
        maxZ: parkCenterZ + 2,
      }
    );

    // Animate all rides in this Amusement Park at 60 FPS (with distance LOD culling when far)!
    animatables.push({
      update: (dt, time) => {
        const pdx = lastLodPlayerX - parkCenterX;
        const pdz = lastLodPlayerZ - parkCenterZ;
        const maxParkAnimDist = 225 * currentPedLodScale;
        if (pdx * pdx + pdz * pdz > maxParkAnimDist * maxParkAnimDist) return;

        // 1) Rotate Giant Ferris Wheel + counter-rotate gondolas so cabins stay upright
        ferrisWheelRotator.rotation.z += dt * 0.55;
        for (const gp of gondolaPivots) {
          gp.rotation.z = -ferrisWheelRotator.rotation.z;
        }

        // 2) Spin Royal Carousel + bob horses up and down
        carouselSpinner.rotation.y += dt * 1.45;
        for (const hn of horseNodes) {
          hn.mesh.position.y = 1.85 + Math.sin(time * 4.5 + hn.phase) * 0.48;
        }

        // 3) Kamikaze Free-Fall Drop Tower cycle (Climb -> Suspense Hold -> High-Speed Free Fall!)
        const dropCycle = time % 7.0;
        let targetY = 3.0;
        if (dropCycle < 4.2) {
          // Smooth climb to 25m
          targetY = 3.0 + (dropCycle / 4.2) * 22.0;
        } else if (dropCycle < 5.3) {
          // Suspense pause at the top with vibration
          targetY = 25.0 + Math.sin(time * 35) * 0.15;
        } else if (dropCycle < 6.0) {
          // Free-fall plunge!
          const fallProgress = (dropCycle - 5.3) / 0.7;
          targetY = 25.0 - fallProgress * fallProgress * 22.0;
        } else {
          targetY = 3.0;
        }
        dropCarriage.position.y = targetY;

        // 4) Swing Pirate Viking Ship like a giant pendulum
        vikingPendulum.rotation.x = Math.sin(time * 2.15) * 0.88;

        // 5) Orbit Coaster Train around the 360° Neon Loop
        const loopAngle = time * 3.4;
        coasterTrain.position.set(
          Math.cos(loopAngle) * loopRadius,
          loopRadius + 1.2 + Math.sin(loopAngle) * loopRadius,
          0
        );
        coasterTrain.rotation.z = loopAngle + Math.PI / 2;
      },
    });
  };

  // Spawn Custom Amusement Park #1 in the Central Plaza block center (X = 20, Z = 15)
  buildAmusementParkComplex(
    20,
    15,
    '🎡 PARQUE DE DIVERSÕES PLAYCENTER 3D',
    0
  );

  // Spawn Custom Amusement Park #2 in the Arena & Autódromo District (X = 20, Z = 174, clear of Z = 145 avenue)
  buildAmusementParkComplex(
    20,
    174,
    '🎢 LUNA PARK NEON • ARENA SHOW',
    Math.PI
  );

  // 14. 3D TRAINING MODE SLALOM & STUNT RINGS (Anéis de Treinamento & Grau)
  interface TrainingRingNode {
    mesh: THREE.Group;
    x: number;
    z: number;
    cooldown: number;
  }

  const trainingRings: TrainingRingNode[] = [];
  const ringCoords = [
    { x: -67.2, z: -48, rotY: 0 },
    { x: -67.2, z: -88, rotY: 0 },
    { x: -67.2, z: -120, rotY: 0 },
    { x: -38, z: -72.8, rotY: Math.PI / 2 },
    { x: 18, z: -72.8, rotY: Math.PI / 2 },
    { x: 47.2, z: -42, rotY: 0 },
    { x: 47.2, z: 18, rotY: 0 },
    { x: -12.8, z: 22, rotY: 0 },
    { x: -12.8, z: 75, rotY: 0 },
    { x: -12.8, z: 122, rotY: 0 },
  ];

  const ringTorusGeo = new THREE.TorusGeometry(2.6, 0.22, 12, 28);
  ringCoords.forEach((rc, idx) => {
    const rGroup = new THREE.Group();
    const rMat = new THREE.MeshBasicMaterial({
      color: idx % 2 === 0 ? 0x00f3ff : 0xfacc15,
    });
    const torus = new THREE.Mesh(ringTorusGeo, rMat);
    torus.position.y = 2.4;
    rGroup.add(torus);

    rGroup.position.set(rc.x, 0, rc.z);
    rGroup.rotation.y = rc.rotY;
    rGroup.visible = false; // Shown automatically when in Training Mode!
    scene.add(rGroup);

    trainingRings.push({
      mesh: rGroup,
      x: rc.x,
      z: rc.z,
      cooldown: 0,
    });
  });

  animatables.push({
    update: (dt, time) => {
      for (const tr of trainingRings) {
        if (tr.cooldown > 0) tr.cooldown = Math.max(0, tr.cooldown - dt);
        if (tr.mesh.visible) {
          tr.mesh.children[0].position.y = 2.4 + Math.sin(time * 4 + tr.x) * 0.22;
        }
      }
    },
  });

  const checkTrainingRings = (
    bikePos: THREE.Vector3,
    isWheelie: boolean,
    isTrainingMode: boolean,
    onPassRing: (bonusCoins: number, isWheelieBonus: boolean) => void
  ) => {
    for (const tr of trainingRings) {
      tr.mesh.visible = isTrainingMode && tr.cooldown <= 0;
      if (!isTrainingMode || tr.cooldown > 0) continue;

      const dist = Math.hypot(bikePos.x - tr.x, bikePos.z - tr.z);
      if (dist < 3.4) {
        tr.cooldown = 8.0; // Respawns after 8s
        tr.mesh.visible = false;
        sound.playCash();
        const bonus = isWheelie ? 30 : 15;
        onPassRing(bonus, isWheelie);
      }
    }
  };

  // 15. 3D NIGHT GHOSTS SYSTEM (FANTASMAS DA ESCURIDÃO À NOITE)
  interface NightGhostAgent {
    group: THREE.Group;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    tendrils: THREE.Mesh[];
    auraRing: THREE.Mesh;
    shroudMat: THREE.MeshStandardMaterial;
    homeX: number;
    homeZ: number;
    x: number;
    z: number;
    phase: number;
    repelCooldown: number;
    scareCooldown: number;
    lastHudText: string;
    hudCanvas: HTMLCanvasElement;
    hudTex: THREE.CanvasTexture;
  }

  const nightGhosts: NightGhostAgent[] = [];
  const ghostSpawnPoints = [
    { x: -68, z: -26, color: 0x22d3ee }, // Centro (Right ahead of player's start avenue!)
    { x: -68, z: -56, color: 0xa855f7 }, // Centro North
    { x: -24, z: -15, color: 0x34d399 }, // Central Intersection
    { x: 16, z: 18, color: 0xf43f5e },   // Amusement Park PlayCenter
    { x: -10, z: 28, color: 0x22d3ee },  // Central / Morro avenue
    { x: -68, z: 42, color: 0xa855f7 },  // Morro do Sol
    { x: 48, z: -35, color: 0x34d399 },  // Jardins Boulevard
    { x: 50, z: 38, color: 0x22d3ee },   // Orla da Praia
    { x: -40, z: -145, color: 0xa855f7 },// Polo Industrial
    { x: 20, z: 155, color: 0xf43f5e },  // Arena & Autódromo
  ];

  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
  const mouthDarkMat = new THREE.MeshBasicMaterial({ color: 0x020617 });

  ghostSpawnPoints.forEach((sp, idx) => {
    const gGroup = new THREE.Group();
    gGroup.position.set(sp.x, 1.4, sp.z);
    gGroup.visible = false; // Visible only at Night (Modo Escuridão)!

    const shroudMat = new THREE.MeshStandardMaterial({
      color: sp.color,
      emissive: sp.color,
      emissiveIntensity: 1.65,
      roughness: 0.2,
      transparent: true,
      opacity: 0.78,
    });

    // 1. Spectral Dome Head & Flowing Ectoplasm Shroud Body
    const headDome = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), shroudMat);
    headDome.position.y = 1.65;
    gGroup.add(headDome);

    const shroudBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 1.08, 1.85, 14, 1, true),
      shroudMat
    );
    shroudBody.position.y = 0.75;
    gGroup.add(shroudBody);

    // 2. Tattered Floating Bottom Tendrils (Franjas Ectoplasmáticas)
    const tendrils: THREE.Mesh[] = [];
    for (let t = 0; t < 6; t++) {
      const tAngle = (t * Math.PI * 2) / 6;
      const tendril = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.75, 6),
        shroudMat
      );
      tendril.rotation.x = Math.PI;
      tendril.position.set(Math.cos(tAngle) * 0.82, -0.25, Math.sin(tAngle) * 0.82);
      gGroup.add(tendril);
      tendrils.push(tendril);
    }

    // 3. Hollow Glowing Red Spectral Eyes & Wailing Mouth
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeGlowMat);
    eyeL.position.set(-0.24, 1.72, 0.58);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeGlowMat);
    eyeR.position.set(0.24, 1.72, 0.58);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 10), mouthDarkMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 1.38, 0.57);
    gGroup.add(eyeL, eyeR, mouth);

    // 4. Outstretched Spectral Arms
    const armGeo = new THREE.ConeGeometry(0.24, 1.15, 8);
    armGeo.rotateX(Math.PI / 2);
    const leftArm = new THREE.Mesh(armGeo, shroudMat);
    leftArm.position.set(-0.78, 1.15, 0.45);
    leftArm.rotation.y = 0.25;
    const rightArm = new THREE.Mesh(armGeo, shroudMat);
    rightArm.position.set(0.78, 1.15, 0.45);
    rightArm.rotation.y = -0.25;
    gGroup.add(leftArm, rightArm);

    // 5. Spectral Vortex Halo Ring on the Ground Beneath
    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({
        color: sp.color,
        transparent: true,
        opacity: 0.65,
      })
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = -0.55;
    gGroup.add(auraRing);

    // 6. Overhead Ghost HUD Badge
    const hudCanvas = document.createElement('canvas');
    hudCanvas.width = 360;
    hudCanvas.height = 72;
    const hudTex = new THREE.CanvasTexture(hudCanvas);
    hudTex.colorSpace = THREE.SRGBColorSpace;
    const hudSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hudTex, transparent: true, depthTest: false })
    );
    hudSprite.scale.set(3.8, 0.76, 1);
    hudSprite.position.set(0, 2.75, 0);
    gGroup.add(hudSprite);

    const drawGhostBadge = (text: string, borderColor: string) => {
      const ctx = hudCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 360, 72);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(4, 4, 352, 64);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 352, 64);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 21px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 180, 36);
      hudTex.needsUpdate = true;
    };
    drawGhostBadge('👻 FANTASMA DA ESCURIDÃO', '#22d3ee');

    scene.add(gGroup);

    nightGhosts.push({
      group: gGroup,
      leftArm,
      rightArm,
      tendrils,
      auraRing,
      shroudMat,
      homeX: sp.x,
      homeZ: sp.z,
      x: sp.x,
      z: sp.z,
      phase: idx * 1.15,
      repelCooldown: 0,
      scareCooldown: 0,
      lastHudText: '👻 FANTASMA DA ESCURIDÃO',
      hudCanvas,
      hudTex,
    });
  });

  // 15.5 3D SINISTER STREET CREATURES IN TOTAL DARKNESS MODE (CRIATURAS SINISTRAS PELAS RUAS)
  interface SinisterStreetCreatureAgent {
    group: THREE.Group;
    legs: THREE.Mesh[];
    spineSpikes: THREE.Mesh[];
    shadowRing: THREE.Mesh;
    veinMat: THREE.MeshStandardMaterial;
    homeX: number;
    homeZ: number;
    x: number;
    z: number;
    phase: number;
    repelCooldown: number;
    attackCooldown: number;
    lastHudText: string;
    hudCanvas: HTMLCanvasElement;
    hudTex: THREE.CanvasTexture;
  }

  const sinisterCreatures: SinisterStreetCreatureAgent[] = [];
  const creatureSpawnPoints = [
    { x: -70, z: -36, veinColor: 0xe11d48 }, // Av. Central right near player spawn!
    { x: -70, z: -64, veinColor: 0x9333ea }, // Av. Central North Intersection
    { x: -42, z: -15, veinColor: 0xe11d48 }, // Central Cross Avenue
    { x: -10, z: -32, veinColor: 0xdc2626 }, // Central Corridor
    { x: 22, z: -15, veinColor: 0x9333ea },  // PlayCenter / Jardins Entrance
    { x: 50, z: -52, veinColor: 0xe11d48 },  // Jardins Boulevard
    { x: -70, z: 24, veinColor: 0xdc2626 },  // Morro do Sol Approach
    { x: 50, z: 22, veinColor: 0x9333ea },   // Orla da Praia Avenue
  ];

  const obsidianHideMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.35,
    metalness: 0.75,
  });
  const bloodEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  const boneHornMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.4,
    metalness: 0.3,
  });

  creatureSpawnPoints.forEach((cp, idx) => {
    const cGroup = new THREE.Group();
    cGroup.position.set(cp.x, 0, cp.z);
    cGroup.visible = false; // Prowls the streets in Total Darkness Mode!

    const veinMat = new THREE.MeshStandardMaterial({
      color: cp.veinColor,
      emissive: cp.veinColor,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    });

    // 1. Predatory Armored Torso & Glowing Abyssal Core
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 2.05), obsidianHideMat);
    torso.position.set(0, 0.78, 0);
    torso.castShadow = true;
    const abyssalCore = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.28, 1.65), veinMat);
    abyssalCore.position.set(0, 0.78, 0);
    cGroup.add(torso, abyssalCore);

    // 2. Sinister Horned Skull Head + 4 Glowing Blood-Red Eyes + Fangs
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.68, 0.88), obsidianHideMat);
    head.position.set(0, 1.05, 1.15);
    cGroup.add(head);

    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 6), boneHornMat);
    hornL.position.set(-0.34, 1.52, 1.05);
    hornL.rotation.x = 0.35;
    hornL.rotation.z = 0.28;
    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.75, 6), boneHornMat);
    hornR.position.set(0.34, 1.52, 1.05);
    hornR.rotation.x = 0.35;
    hornR.rotation.z = -0.28;
    cGroup.add(hornL, hornR);

    // 4 Glowing Crimson Eyes (Spider/Demon Predator Look)
    const eyeCoords = [
      [-0.24, 1.16, 1.59],
      [0.24, 1.16, 1.59],
      [-0.13, 1.02, 1.6],
      [0.13, 1.02, 1.6],
    ];
    eyeCoords.forEach(([ex, ey, ez]) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), bloodEyeMat);
      eye.position.set(ex, ey, ez);
      cGroup.add(eye);
    });

    // 3. Dorsal Crimson Spine Spikes along the back
    const spineSpikes: THREE.Mesh[] = [];
    for (let s = 0; s < 4; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.58, 6), veinMat);
      spike.position.set(0, 1.32, 0.55 - s * 0.45);
      spike.rotation.x = -0.25;
      cGroup.add(spike);
      spineSpikes.push(spike);
    }

    // 4. Four Articulated Clawed Prowler Limbs (Patas Articuladas com Garras)
    const legs: THREE.Mesh[] = [];
    const legOffsets = [
      { x: -0.72, z: 0.68, rotZ: 0.32 },
      { x: 0.72, z: 0.68, rotZ: -0.32 },
      { x: -0.72, z: -0.68, rotZ: 0.32 },
      { x: 0.72, z: -0.68, rotZ: -0.32 },
    ];
    legOffsets.forEach(lo => {
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.06, 1.05, 6), obsidianHideMat);
      legMesh.position.set(lo.x, 0.5, lo.z);
      legMesh.rotation.z = lo.rotZ;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 5), veinMat);
      claw.position.set(0, -0.52, 0.15);
      claw.rotation.x = Math.PI / 2;
      legMesh.add(claw);
      cGroup.add(legMesh);
      legs.push(legMesh);
    });

    // 5. Blood-Crimson Shadow Mist Ring on the Street Asphalt
    const shadowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.09, 8, 24),
      new THREE.MeshBasicMaterial({
        color: cp.veinColor,
        transparent: true,
        opacity: 0.72,
      })
    );
    shadowRing.rotation.x = Math.PI / 2;
    shadowRing.position.y = 0.08;
    cGroup.add(shadowRing);

    // 6. Overhead Sinister Creature HUD Badge
    const hudCanvas = document.createElement('canvas');
    hudCanvas.width = 384;
    hudCanvas.height = 72;
    const hudTex = new THREE.CanvasTexture(hudCanvas);
    hudTex.colorSpace = THREE.SRGBColorSpace;
    const hudSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hudTex, transparent: true, depthTest: false })
    );
    hudSprite.scale.set(4.1, 0.78, 1);
    hudSprite.position.set(0, 2.25, 0);
    cGroup.add(hudSprite);

    const drawCreatureBadge = (text: string, borderColor: string) => {
      const ctx = hudCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 384, 72);
      ctx.fillStyle = 'rgba(9, 4, 18, 0.92)';
      ctx.fillRect(4, 4, 376, 64);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 376, 64);
      ctx.fillStyle = '#fecdd3';
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 192, 36);
      hudTex.needsUpdate = true;
    };
    drawCreatureBadge('👹 CRIATURA SINISTRA DAS RUAS', '#e11d48');

    scene.add(cGroup);

    sinisterCreatures.push({
      group: cGroup,
      legs,
      spineSpikes,
      shadowRing,
      veinMat,
      homeX: cp.x,
      homeZ: cp.z,
      x: cp.x,
      z: cp.z,
      phase: idx * 1.4,
      repelCooldown: 0,
      attackCooldown: 0,
      lastHudText: '👹 CRIATURA SINISTRA DAS RUAS',
      hudCanvas,
      hudTex,
    });
  });

  // 15.6 3D NIGHT ZOMBIES (ZUMBIS NA RUA À NOITE)
  interface NightZombieAgent {
    group: THREE.Group;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    homeX: number;
    homeZ: number;
    x: number;
    z: number;
    phase: number;
    repelCooldown: number;
    attackCooldown: number;
    lastHudText: string;
    hudCanvas: HTMLCanvasElement;
    hudTex: THREE.CanvasTexture;
  }

  const nightZombies: NightZombieAgent[] = [];
  const zombieSpawnPoints = [
    { x: -70, z: -45 },
    { x: -70, z: 25 },
    { x: 50, z: -25 },
    { x: 50, z: 45 },
    { x: -10, z: -105 },
    { x: -10, z: 105 },
    { x: 290, z: -30 },
  ];

  const zombieSkinMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85 });
  const zombieClothMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.7 });
  const zombieEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

  zombieSpawnPoints.forEach((zp, idx) => {
    const zGroup = new THREE.Group();
    zGroup.position.set(zp.x, 0, zp.z);
    zGroup.visible = false;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 0.38), zombieClothMat);
    torso.position.y = 0.9;
    torso.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), zombieSkinMat);
    head.position.set(0, 1.52, 0);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), zombieEyeMat);
    eyeL.position.set(-0.12, 1.58, 0.22);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), zombieEyeMat);
    eyeR.position.set(0.12, 1.58, 0.22);

    const armGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
    armGeo.translate(0, -0.3, 0);
    const leftArm = new THREE.Mesh(armGeo, zombieSkinMat);
    leftArm.position.set(-0.45, 1.25, 0.2);
    leftArm.rotation.x = -Math.PI / 2;

    const rightArm = new THREE.Mesh(armGeo, zombieSkinMat);
    rightArm.position.set(0.45, 1.25, 0.2);
    rightArm.rotation.x = -Math.PI / 2;

    const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.24);
    legGeo.translate(0, -0.42, 0);
    const leftLeg = new THREE.Mesh(legGeo, zombieClothMat);
    leftLeg.position.set(-0.18, 0.85, 0);

    const rightLeg = new THREE.Mesh(legGeo, zombieClothMat);
    rightLeg.position.set(0.18, 0.85, 0);

    zGroup.add(torso, head, eyeL, eyeR, leftArm, rightArm, leftLeg, rightLeg);

    const hudCanvas = document.createElement('canvas');
    hudCanvas.width = 320;
    hudCanvas.height = 64;
    const hudTex = new THREE.CanvasTexture(hudCanvas);
    hudTex.colorSpace = THREE.SRGBColorSpace;
    const hudSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hudTex, transparent: true, depthTest: false })
    );
    hudSprite.scale.set(3.5, 0.7, 1);
    hudSprite.position.set(0, 2.2, 0);
    zGroup.add(hudSprite);

    const drawZombieBadge = (text: string, color: string) => {
      const ctx = hudCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 320, 64);
      ctx.fillStyle = 'rgba(20, 10, 10, 0.9)';
      ctx.fillRect(2, 2, 316, 60);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 316, 60);
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 160, 32);
      hudTex.needsUpdate = true;
    };
    drawZombieBadge('🧟 ZUMBI DA NOITE', '#ef4444');

    scene.add(zGroup);

    nightZombies.push({
      group: zGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      homeX: zp.x,
      homeZ: zp.z,
      x: zp.x,
      z: zp.z,
      phase: idx * 1.5,
      repelCooldown: 0,
      attackCooldown: 0,
      lastHudText: '🧟 ZUMBI DA NOITE',
      hudCanvas,
      hudTex,
    });
  });

  const updateNightGhosts = (
    dt: number,
    elapsedTime: number,
    isDarkNight: boolean,
    playerPos: THREE.Vector3,
    playerHeading: number,
    headlightOn: boolean,
    onGhostScare: () => void
  ) => {
    // A) Update Floating Spectral Ghosts
    for (const g of nightGhosts) {
      g.group.visible = isDarkNight;
      if (!isDarkNight) continue;

      if (g.repelCooldown > 0) g.repelCooldown = Math.max(0, g.repelCooldown - dt);
      if (g.scareCooldown > 0) g.scareCooldown = Math.max(0, g.scareCooldown - dt);

      // Levitation & eerie spectral animations
      const floatY = 1.25 + Math.sin(elapsedTime * 3.2 + g.phase) * 0.42;
      g.group.position.y = floatY;
      g.leftArm.position.y = 1.15 + Math.sin(elapsedTime * 5.0 + g.phase) * 0.16;
      g.rightArm.position.y = 1.15 + Math.cos(elapsedTime * 5.0 + g.phase) * 0.16;
      g.auraRing.rotation.z = elapsedTime * 2.5;
      g.auraRing.scale.setScalar(0.92 + Math.sin(elapsedTime * 4 + g.phase) * 0.12);

      for (let t = 0; t < g.tendrils.length; t++) {
        g.tendrils[t].position.y = -0.25 + Math.sin(elapsedTime * 6.5 + t + g.phase) * 0.12;
      }

      const dxToPlayer = playerPos.x - g.x;
      const dzToPlayer = playerPos.z - g.z;
      const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

      // Check if player's motorcycle headlight beam is shining directly on this Ghost!
      let isHitByHeadlight = false;
      if (headlightOn && distToPlayer < 17.5 && distToPlayer > 0.2) {
        const dirFromPlayerX = (g.x - playerPos.x) / distToPlayer;
        const dirFromPlayerZ = (g.z - playerPos.z) / distToPlayer;
        const fwdX = Math.sin(playerHeading);
        const fwdZ = Math.cos(playerHeading);
        const dot = dirFromPlayerX * fwdX + dirFromPlayerZ * fwdZ;
        if (dot > 0.72) {
          isHitByHeadlight = true;
        }
      }

      const updateHudText = (newText: string, borderColor: string) => {
        if (g.lastHudText === newText) return;
        g.lastHudText = newText;
        const ctx = g.hudCanvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 360, 72);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.fillRect(4, 4, 352, 64);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 352, 64);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(newText, 180, 36);
        g.hudTex.needsUpdate = true;
      };

      if (isHitByHeadlight) {
        // Repelled by headlight beam! Ghost recoils backward and shimmers
        g.repelCooldown = 1.2;
        const repelDirX = (g.x - playerPos.x) / Math.max(0.5, distToPlayer);
        const repelDirZ = (g.z - playerPos.z) / Math.max(0.5, distToPlayer);
        g.x += repelDirX * 9.5 * dt;
        g.z += repelDirZ * 9.5 * dt;
        g.group.rotation.y += dt * 10.0;
        g.shroudMat.emissiveIntensity = 3.2;
        updateHudText('🔦 REPELIDO PELO FAROL!', '#facc15');
      } else if (distToPlayer < 42 && g.repelCooldown <= 0) {
        // Ghost stalks/glides toward the player through the darkness!
        const angleToPlayer = Math.atan2(dxToPlayer, dzToPlayer);
        g.group.rotation.y = angleToPlayer;
        const stalkSpeed = 6.2;
        const swayX = Math.cos(angleToPlayer) * Math.sin(elapsedTime * 3.5 + g.phase) * 2.2;
        const swayZ = -Math.sin(angleToPlayer) * Math.sin(elapsedTime * 3.5 + g.phase) * 2.2;
        g.x += (Math.sin(angleToPlayer) * stalkSpeed + swayX) * dt;
        g.z += (Math.cos(angleToPlayer) * stalkSpeed + swayZ) * dt;
        g.shroudMat.emissiveIntensity = 1.85;
        updateHudText('👻 ASSOMBRAÇÃO! USE O FAROL!', '#f43f5e');

        // Ghost touches the player -> Spooky Haunt Scare!
        if (distToPlayer < 2.35 && g.scareCooldown <= 0) {
          g.scareCooldown = 5.5;
          g.repelCooldown = 2.5;
          // Push ghost back after scare so it doesn't spam
          g.x -= Math.sin(angleToPlayer) * 7.5;
          g.z -= Math.cos(angleToPlayer) * 7.5;
          sound.playGhostWail();
          onGhostScare();
        }
      } else {
        // Patrol in eerie figure-8 around home haunt spot
        const targetX = g.homeX + Math.cos(elapsedTime * 0.85 + g.phase) * 9.5;
        const targetZ = g.homeZ + Math.sin(elapsedTime * 1.7 + g.phase) * 6.5;
        const dxHome = targetX - g.x;
        const dzHome = targetZ - g.z;
        g.x += dxHome * 1.8 * dt;
        g.z += dzHome * 1.8 * dt;
        g.group.rotation.y = Math.atan2(dxHome, dzHome);
        g.shroudMat.emissiveIntensity = 1.5;
        updateHudText('👻 FANTASMA DA ESCURIDÃO', '#22d3ee');
      }

      g.group.position.x = g.x;
      g.group.position.z = g.z;
    }

    // B) Update 3D Sinister Street Creatures Prowling on the Asphalt
    for (const c of sinisterCreatures) {
      c.group.visible = isDarkNight;
      if (!isDarkNight) continue;

      if (c.repelCooldown > 0) c.repelCooldown = Math.max(0, c.repelCooldown - dt);
      if (c.attackCooldown > 0) c.attackCooldown = Math.max(0, c.attackCooldown - dt);

      // Animate 4 clawed legs in a rapid predatory crawl/sprint cycle
      const stride = Math.sin(elapsedTime * 14.0 + c.phase) * 0.65;
      c.legs[0].rotation.x = stride;
      c.legs[1].rotation.x = -stride;
      c.legs[2].rotation.x = -stride;
      c.legs[3].rotation.x = stride;

      // Pulse dorsal spine spikes & shadow ring
      c.shadowRing.rotation.z = -elapsedTime * 3.2;
      c.shadowRing.scale.setScalar(0.95 + Math.sin(elapsedTime * 6.0 + c.phase) * 0.14);
      for (let s = 0; s < c.spineSpikes.length; s++) {
        c.spineSpikes[s].scale.y = 1.0 + Math.sin(elapsedTime * 8.0 + s + c.phase) * 0.25;
      }

      const dxToPlayer = playerPos.x - c.x;
      const dzToPlayer = playerPos.z - c.z;
      const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

      // Check if player's headlight beam is shining directly on this Sinister Creature!
      let isHitByHeadlight = false;
      if (headlightOn && distToPlayer < 18.5 && distToPlayer > 0.2) {
        const dirFromPlayerX = (c.x - playerPos.x) / distToPlayer;
        const dirFromPlayerZ = (c.z - playerPos.z) / distToPlayer;
        const fwdX = Math.sin(playerHeading);
        const fwdZ = Math.cos(playerHeading);
        const dot = dirFromPlayerX * fwdX + dirFromPlayerZ * fwdZ;
        if (dot > 0.7) {
          isHitByHeadlight = true;
        }
      }

      const updateCreatureHud = (newText: string, borderColor: string) => {
        if (c.lastHudText === newText) return;
        c.lastHudText = newText;
        const ctx = c.hudCanvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 384, 72);
        ctx.fillStyle = 'rgba(9, 4, 18, 0.92)';
        ctx.fillRect(4, 4, 376, 64);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 376, 64);
        ctx.fillStyle = '#fecdd3';
        ctx.font = '900 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(newText, 192, 36);
        c.hudTex.needsUpdate = true;
      };

      if (isHitByHeadlight) {
        // Blinded by high-beam headlight! Creature recoils backward across the asphalt
        c.repelCooldown = 1.35;
        const repelDirX = (c.x - playerPos.x) / Math.max(0.5, distToPlayer);
        const repelDirZ = (c.z - playerPos.z) / Math.max(0.5, distToPlayer);
        c.x += repelDirX * 10.5 * dt;
        c.z += repelDirZ * 10.5 * dt;
        c.group.rotation.y += dt * 12.0;
        c.veinMat.emissiveIntensity = 3.8;
        updateCreatureHud('🔦 CRIATURA CEGADA PELO FAROL!', '#facc15');
      } else if (distToPlayer < 46 && c.repelCooldown <= 0) {
        // Creature sprints along the street toward the player!
        const angleToPlayer = Math.atan2(dxToPlayer, dzToPlayer);
        c.group.rotation.y = angleToPlayer;
        const prowlSpeed = 7.4;
        const weaveX = Math.cos(angleToPlayer) * Math.sin(elapsedTime * 5.2 + c.phase) * 2.6;
        const weaveZ = -Math.sin(angleToPlayer) * Math.sin(elapsedTime * 5.2 + c.phase) * 2.6;
        c.x += (Math.sin(angleToPlayer) * prowlSpeed + weaveX) * dt;
        c.z += (Math.cos(angleToPlayer) * prowlSpeed + weaveZ) * dt;
        c.group.position.y = Math.abs(Math.sin(elapsedTime * 14.0 + c.phase)) * 0.18;
        c.veinMat.emissiveIntensity = 2.6;
        updateCreatureHud('👹 CRIATURA CAÇANDO! USE O FAROL!', '#ef4444');

        // Creature lunges at the player!
        if (distToPlayer < 2.45 && c.attackCooldown <= 0) {
          c.attackCooldown = 5.0;
          c.repelCooldown = 2.2;
          c.x -= Math.sin(angleToPlayer) * 8.0;
          c.z -= Math.cos(angleToPlayer) * 8.0;
          sound.playGhostWail();
          onGhostScare();
        }
      } else {
        // Prowl in a predatory loop along its street sector
        const targetX = c.homeX + Math.sin(elapsedTime * 1.1 + c.phase) * 8.5;
        const targetZ = c.homeZ + Math.cos(elapsedTime * 1.1 + c.phase) * 11.0;
        const dxHome = targetX - c.x;
        const dzHome = targetZ - c.z;
        c.x += dxHome * 2.1 * dt;
        c.z += dzHome * 2.1 * dt;
        c.group.rotation.y = Math.atan2(dxHome, dzHome);
        c.group.position.y = Math.abs(Math.sin(elapsedTime * 8.0 + c.phase)) * 0.08;
        c.veinMat.emissiveIntensity = 1.9;
        updateCreatureHud('👹 CRIATURA SINISTRA DAS RUAS', '#e11d48');
      }

      c.group.position.x = c.x;
      c.group.position.z = c.z;
    }

    // D) Update Night Zombies
    for (const z of nightZombies) {
      z.group.visible = isDarkNight;
      if (!isDarkNight) continue;

      if (z.repelCooldown > 0) z.repelCooldown = Math.max(0, z.repelCooldown - dt);
      if (z.attackCooldown > 0) z.attackCooldown = Math.max(0, z.attackCooldown - dt);

      const walkCycle = Math.sin(elapsedTime * 6.0 + z.phase) * 0.45;
      z.leftLeg.rotation.x = walkCycle;
      z.rightLeg.rotation.x = -walkCycle;

      const dxToPlayer = playerPos.x - z.x;
      const dzToPlayer = playerPos.z - z.z;
      const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

      let isHitByHeadlight = false;
      if (headlightOn && distToPlayer < 18.0 && distToPlayer > 0.2) {
        const dirFromPlayerX = (z.x - playerPos.x) / distToPlayer;
        const dirFromPlayerZ = (z.z - playerPos.z) / distToPlayer;
        const fwdX = Math.sin(playerHeading);
        const fwdZ = Math.cos(playerHeading);
        const dot = dirFromPlayerX * fwdX + dirFromPlayerZ * fwdZ;
        if (dot > 0.7) isHitByHeadlight = true;
      }

      if (isHitByHeadlight) {
        z.repelCooldown = 1.0;
        const repelDirX = (z.x - playerPos.x) / Math.max(0.5, distToPlayer);
        const repelDirZ = (z.z - playerPos.z) / Math.max(0.5, distToPlayer);
        z.x += repelDirX * 7.5 * dt;
        z.z += repelDirZ * 7.5 * dt;
      } else if (distToPlayer < 32 && z.repelCooldown <= 0) {
        const angleToPlayer = Math.atan2(dxToPlayer, dzToPlayer);
        z.group.rotation.y = angleToPlayer;
        const zombieSpeed = 4.8;
        z.x += Math.sin(angleToPlayer) * zombieSpeed * dt;
        z.z += Math.cos(angleToPlayer) * zombieSpeed * dt;

        if (distToPlayer < 2.2 && z.attackCooldown <= 0) {
          z.attackCooldown = 4.5;
          z.repelCooldown = 2.0;
          z.x -= Math.sin(angleToPlayer) * 6.0;
          z.z -= Math.cos(angleToPlayer) * 6.0;
          sound.playGhostWail();
          onGhostScare();
        }
      } else {
        const targetX = z.homeX + Math.sin(elapsedTime * 0.8 + z.phase) * 6.0;
        const targetZ = z.homeZ + Math.cos(elapsedTime * 0.8 + z.phase) * 6.0;
        const dxHome = targetX - z.x;
        const dzHome = targetZ - z.z;
        z.x += dxHome * 1.5 * dt;
        z.z += dzHome * 1.5 * dt;
        z.group.rotation.y = Math.atan2(dxHome, dzHome);
      }

      z.group.position.x = z.x;
      z.group.position.z = z.z;
    }
  };

  const applySpecialExecutionToZombies = (playerPos: THREE.Vector3): boolean => {
    let executed = false;
    for (const z of nightZombies) {
      if (!z.group.visible) continue;
      const dist = Math.hypot(z.x - playerPos.x, z.z - playerPos.z);
      if (dist < 5.5) {
        executed = true;
        z.group.visible = false;
        z.x = 99999;
        z.z = 99999;
        sound.playGhostWail();
      }
    }
    for (const c of sinisterCreatures) {
      if (!c.group.visible) continue;
      const dist = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
      if (dist < 5.5) {
        executed = true;
        c.group.visible = false;
        c.x = 99999;
        c.z = 99999;
        sound.playGhostWail();
      }
    }
    return executed;
  };

  return {
    groundMesh,
    oceanMesh,
    collisionBoxes,
    animatables,
    getPedestrianPositions,
    checkPedestrianCollisions,
    applyMeleeToPedestrians,
    reactPedestriansToHorn,
    triggerPedestrianPanicNear,
    applySpecialExecutionToZombies,
    checkTrainingRings,
    updateNightGhosts,
    updateRoadEmissive: (isNight: boolean) => {
      const targetIntensity = isNight ? 2.2 : 0.1;
      vRoadMat.emissiveIntensity = targetIntensity;
      hRoadMat.emissiveIntensity = targetIntensity;
      interMat.emissiveIntensity = targetIntensity;
    },
    updateRoadWetness: (wetness: number) => {
      const w = Math.max(0, Math.min(1, wetness));
      vRoadMat.roughness = 0.58 - w * 0.44;
      vRoadMat.metalness = 0.18 + w * 0.52;
      hRoadMat.roughness = 0.62 - w * 0.46;
      hRoadMat.metalness = 0.15 + w * 0.54;
      interMat.roughness = 0.68 - w * 0.48;
      interMat.metalness = 0.14 + w * 0.52;
      groundMat.roughness = 0.78 - w * 0.35;
    },
  };
}
