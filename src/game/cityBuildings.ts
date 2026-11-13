import * as THREE from 'three';
import { sound } from '../audio/soundEngine';

export interface InteractiveAnimal {
  mesh: THREE.Group;
  type: 'cow' | 'chicken' | 'horse';
  x: number;
  z: number;
  angle: number;
  speed: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  type: 'moto_shop' | 'gun_shop';
  x: number;
  z: number;
  width: number;
  depth: number;
  bannerColor: string;
  title: string;
}

export const STORE_LOCATIONS: StoreLocation[] = [
  {
    id: 'moto_shop_centro',
    name: 'Concessionária Moto SP Centro',
    type: 'moto_shop',
    x: -85,
    z: -70,
    width: 24,
    depth: 18,
    bannerColor: '#f59e0b',
    title: 'MOTO SHOP • SHOWROOM 3D',
  },
  {
    id: 'gun_shop_centro',
    name: 'Ammunation Central',
    type: 'gun_shop',
    x: 40,
    z: -85,
    width: 22,
    depth: 16,
    bannerColor: '#dc2626',
    title: 'AMMUNATION • LOJA DE ARMAS',
  },
  {
    id: 'moto_shop_jardins',
    name: 'Moto Elite Jardins',
    type: 'moto_shop',
    x: 80,
    z: -45,
    width: 24,
    depth: 18,
    bannerColor: '#10b981',
    title: 'MOTO ELITE • CUSTOMIZADORA',
  },
  {
    id: 'gun_shop_favela',
    name: 'Loja de Armas da Quebrada',
    type: 'gun_shop',
    x: -85,
    z: 75,
    width: 20,
    depth: 16,
    bannerColor: '#ea580c',
    title: 'TÁTICO & ARMAS QUEBRADA',
  },
];

/**
 * Creates 3D Farm Ranches, Stylish Houses, Skyscrapers, Moto Shops, Gun Shops and Interactive Animals
 */
export function buildCityAdvancedBuildings(scene: THREE.Scene): {
  buildingsGroup: THREE.Group;
  animals: InteractiveAnimal[];
} {
  const group = new THREE.Group();
  group.name = 'city_advanced_buildings';
  const animals: InteractiveAnimal[] = [];

  // Materials
  const farmWoodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
  const roofRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
  const houseWallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const houseRoofMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
  const glassTowerMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  // 1. SKYSCRAPERS (Arranha-Céus Megacity com Heliponto & Coroa Neon)
  const skyscraperCoords = [
    { x: -105, z: -105, h: 85, accent: 0x00f3ff },
    { x: -105, z: -55, h: 95, accent: 0xa855f7 },
    { x: 95, z: -105, h: 110, accent: 0x38bdf8 },
    { x: 95, z: -55, h: 90, accent: 0xf43f5e },
  ];

  skyscraperCoords.forEach(tower => {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(tower.x, 0, tower.z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(22, tower.h, 22),
      glassTowerMat
    );
    body.position.y = tower.h / 2;
    towerGroup.add(body);

    // Architectural Steel Exoskeleton Pillars & Illuminated Neon Crown Bands
    const crownBandMat = new THREE.MeshBasicMaterial({ color: tower.accent });
    const crownTop = new THREE.Mesh(new THREE.BoxGeometry(22.6, 1.2, 22.6), crownBandMat);
    crownTop.position.y = tower.h - 2.0;
    const crownMid = new THREE.Mesh(new THREE.BoxGeometry(22.5, 0.8, 22.5), crownBandMat);
    crownMid.position.y = tower.h * 0.62;
    towerGroup.add(crownTop, crownMid);

    // Helipad on rooftop with glowing H-ring
    const helipad = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 })
    );
    helipad.position.y = tower.h + 0.3;
    const helipadRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.22, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    helipadRing.rotation.x = Math.PI / 2;
    helipadRing.position.y = tower.h + 0.65;
    towerGroup.add(helipad, helipadRing);

    group.add(towerGroup);
  });

  // 2. STYLISH HOUSES (Casinhas Estilosas Modernas com Garagem, Varanda Iluminada & Piscina)
  const stylishHouseCoords = [
    { x: 45, z: -25, wallHex: 0xf8fafc, roofHex: 0x0284c7 },
    { x: 75, z: -25, wallHex: 0xfef3c7, roofHex: 0xb45309 },
    { x: 105, z: -25, wallHex: 0xf1f5f9, roofHex: 0x0f766e },
    { x: 45, z: -95, wallHex: 0xffedd5, roofHex: 0x991b1b },
    { x: 75, z: -95, wallHex: 0xe0e7ff, roofHex: 0x4338ca },
  ];

  const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const garageDoorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.35,
  });
  const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.55 });
  const poolWaterMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

  stylishHouseCoords.forEach(hPos => {
    const hGroup = new THREE.Group();
    hGroup.position.set(hPos.x, 0, hPos.z);

    const customWallMat = new THREE.MeshStandardMaterial({ color: hPos.wallHex, roughness: 0.38 });
    const customRoofMat = new THREE.MeshStandardMaterial({ color: hPos.roofHex, roughness: 0.32 });

    const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 6.2, 10), customWallMat);
    walls.position.y = 3.1;
    walls.castShadow = true;
    walls.receiveShadow = true;
    hGroup.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.6, 3.8, 4), customRoofMat);
    roof.position.y = 8.0;
    roof.rotation.y = Math.PI / 4;
    hGroup.add(roof);

    // Brick Chimney on roof
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.8, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 })
    );
    chimney.position.set(3.2, 8.2, -1.8);
    hGroup.add(chimney);

    // Modern glass balcony on second floor
    const balcony = new THREE.Mesh(
      new THREE.BoxGeometry(10.2, 1.15, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })
    );
    balcony.position.set(0, 4.1, 5.2);
    hGroup.add(balcony);

    // Sectional Garage Door (Portão de Garagem) + Driveway Slab
    const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.7, 0.25), garageDoorMat);
    garageDoor.position.set(-3.0, 1.35, 5.05);
    const driveway = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.08, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
    );
    driveway.position.set(-3.0, 0.04, 6.8);
    hGroup.add(garageDoor, driveway);

    // Front Entrance Door, Warm Porch Light & Windows
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.25), woodDoorMat);
    frontDoor.position.set(2.4, 1.25, 5.05);
    const porchLight = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), warmWindowMat);
    porchLight.position.set(2.4, 2.85, 5.25);
    const upperWinL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.25), warmWindowMat);
    upperWinL.position.set(-2.6, 4.8, 5.05);
    const upperWinR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.25), warmWindowMat);
    upperWinR.position.set(2.6, 4.8, 5.05);
    hGroup.add(frontDoor, porchLight, upperWinL, upperWinR);

    // Illuminated Side Swimming Pool & Sun Deck (Piscina Iluminada)
    const poolDeck = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.18, 7.6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
    );
    poolDeck.position.set(8.8, 0.09, 0.5);
    const poolWater = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 6.2), poolWaterMat);
    poolWater.position.set(8.8, 0.12, 0.5);
    hGroup.add(poolDeck, poolWater);

    group.add(hGroup);
  });

  // 3. FARM RANCHES & INTERACTIVE ANIMALS (Fazendas Rurais com Animais)
  const farmCoords = [
    { x: -145, z: -145 },
    { x: 145, z: -145 },
    { x: -145, z: 145 },
    { x: 145, z: 145 },
  ];

  farmCoords.forEach(farm => {
    const farmGroup = new THREE.Group();
    farmGroup.position.set(farm.x, 0, farm.z);

    // Barn (Celeiro de Madeira)
    const barn = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 22), farmWoodMat);
    barn.position.set(0, 4.5, 0);
    farmGroup.add(barn);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(14, 5.5, 4), roofRedMat);
    roof.position.set(0, 11.5, 0);
    roof.rotation.y = Math.PI / 4;
    farmGroup.add(roof);

    // Fence Perimeter (Cerca de Madeira)
    const fenceGeo = new THREE.BoxGeometry(32, 1.5, 0.4);
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xa16207 });
    const f1 = new THREE.Mesh(fenceGeo, fenceMat);
    f1.position.set(0, 0.75, 16);
    farmGroup.add(f1);

    // Spawn Interactive Animals (Vacas, Cavalos, Galinhas)
    const animalTypes: Array<'cow' | 'chicken' | 'horse'> = ['cow', 'horse', 'chicken', 'cow'];
    animalTypes.forEach((aType, aIdx) => {
      const aGroup = new THREE.Group();
      let aColor = 0xffffff;
      let scale = 1.0;

      if (aType === 'cow') {
        aColor = 0x18181b;
        scale = 1.4;
      } else if (aType === 'horse') {
        aColor = 0xb45309;
        scale = 1.3;
      } else {
        aColor = 0xf59e0b;
        scale = 0.5;
      }

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 * scale, 1.0 * scale, 1.8 * scale),
        new THREE.MeshStandardMaterial({ color: aColor, roughness: 0.7 })
      );
      body.position.y = 0.8 * scale;
      aGroup.add(body);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 * scale, 0.7 * scale, 0.8 * scale),
        new THREE.MeshStandardMaterial({ color: aColor, roughness: 0.7 })
      );
      head.position.set(0, 1.4 * scale, 1.0 * scale);
      aGroup.add(head);

      const angle = (aIdx / animalTypes.length) * Math.PI * 2;
      const radius = 10 + aIdx * 3;
      const posX = farm.x + Math.cos(angle) * radius;
      const posZ = farm.z + Math.sin(angle) * radius;

      aGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      farmGroup.add(aGroup);

      animals.push({
        mesh: aGroup,
        type: aType,
        x: posX,
        z: posZ,
        angle,
        speed: 0.6 + Math.random() * 0.4,
      });
    });

    group.add(farmGroup);
  });

  // 4. MOTO SHOPS & GUN SHOPS STOREFRONTS
  STORE_LOCATIONS.forEach(store => {
    const storeGroup = new THREE.Group();
    storeGroup.position.set(store.x, 0, store.z);

    const storeBody = new THREE.Mesh(
      new THREE.BoxGeometry(store.width, 6, store.depth),
      new THREE.MeshStandardMaterial({
        color: store.type === 'moto_shop' ? 0x1e293b : 0x450a0a,
        roughness: 0.5,
      })
    );
    storeBody.position.y = 3;
    storeGroup.add(storeBody);

    // Illuminated Neon Signboard
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = store.type === 'moto_shop' ? '#f59e0b' : '#dc2626';
      ctx.fillRect(0, 0, 384, 96);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(store.title, 192, 48);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.SpriteMaterial({ map: tex });
    const sign = new THREE.Sprite(signMat);
    sign.scale.set(10, 2.5, 1);
    sign.position.set(0, 6.8, store.depth / 2 + 0.1);
    storeGroup.add(sign);

    group.add(storeGroup);
  });

  scene.add(group);
  return { buildingsGroup: group, animals };
}
