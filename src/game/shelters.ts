import * as THREE from 'three';
import { CollisionBox } from './physics';

export interface CityShelter {
  id: string;
  name: string;
  type: 'gas_station' | 'viaduct' | 'marquee' | 'bus_stop';
  x: number;
  z: number;
  width: number;
  depth: number;
  districtId: string;
  icon: string;
  bannerLabel: string;
}

export const CITY_SHELTERS: CityShelter[] = [
  // PARADAS DE ÔNIBUS (DISTRIBUÍDAS NAS AVENIDAS PRINCIPAIS)
  {
    id: 'parada_onibus_centro',
    name: 'Parada de Ônibus Central (Linha 101)',
    type: 'bus_stop',
    x: -75.5,
    z: -32,
    width: 6.5,
    depth: 11,
    districtId: 'centro',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • LINHA 101',
  },
  {
    id: 'parada_onibus_republica',
    name: 'Parada Av. Central',
    type: 'bus_stop',
    x: -15.5,
    z: -28,
    width: 6.5,
    depth: 11,
    districtId: 'centro',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • CENTRO',
  },
  {
    id: 'parada_onibus_jardins',
    name: 'Parada Boulevard Jardins',
    type: 'bus_stop',
    x: 44.5,
    z: -30,
    width: 6.5,
    depth: 11,
    districtId: 'jardins',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • JARDINS',
  },
  {
    id: 'parada_onibus_favela',
    name: 'Parada Terminal do Morro',
    type: 'bus_stop',
    x: -75.5,
    z: 28,
    width: 6.5,
    depth: 11,
    districtId: 'favela',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • QUEBRADA',
  },
  {
    id: 'parada_onibus_orla',
    name: 'Parada Expresso Beira-Mar',
    type: 'bus_stop',
    x: 44.5,
    z: 28,
    width: 6.5,
    depth: 11,
    districtId: 'orla',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • ORLA',
  },
  {
    id: 'parada_onibus_industrial',
    name: 'Parada Distrito Industrial',
    type: 'bus_stop',
    x: -15.5,
    z: -95,
    width: 6.5,
    depth: 11,
    districtId: 'industrial',
    icon: '🚏',
    bannerLabel: '🚏 PARADA DE ÔNIBUS • DISTRITO',
  },

  // CENTRO
  {
    id: 'shelter_posto_centro',
    name: 'Posto Central 24h',
    type: 'gas_station',
    x: -40,
    z: -55,
    width: 24,
    depth: 18,
    districtId: 'centro',
    icon: '⛽',
    bannerLabel: 'POSTO IPIRANGA • ABRIGO SEGURO',
  },
  {
    id: 'shelter_viaduto_centro',
    name: 'Viaduto Urbano Coberto',
    type: 'viaduct',
    x: -10,
    z: -40,
    width: 20,
    depth: 28,
    districtId: 'centro',
    icon: '🌉',
    bannerLabel: 'VIADUTO ELEVADO • TÚNEL SEGURO',
  },
  {
    id: 'shelter_marquise_centro',
    name: 'Marquise da Galeria',
    type: 'marquee',
    x: -70,
    z: -20,
    width: 22,
    depth: 16,
    districtId: 'centro',
    icon: '🏛️',
    bannerLabel: 'MARQUISE COMERCIAL • COBERTURA',
  },

  // JARDINS
  {
    id: 'shelter_posto_jardins',
    name: 'Posto Alameda Jardins',
    type: 'gas_station',
    x: 35,
    z: -45,
    width: 24,
    depth: 18,
    districtId: 'jardins',
    icon: '⛽',
    bannerLabel: 'POSTO SHELL • ABRIGO JARDINS',
  },
  {
    id: 'shelter_marquise_jardins',
    name: 'Marquise Boulevard Gourmet',
    type: 'marquee',
    x: 65,
    z: -70,
    width: 22,
    depth: 16,
    districtId: 'jardins',
    icon: '🏛️',
    bannerLabel: 'MARQUISE BOULEVARD • PISTA SECA',
  },

  // FAVELA
  {
    id: 'shelter_posto_favela',
    name: 'Posto da Quebrada',
    type: 'gas_station',
    x: -40,
    z: 45,
    width: 22,
    depth: 18,
    districtId: 'favela',
    icon: '⛽',
    bannerLabel: 'POSTO DA QUEBRADA • ABRIGO',
  },
  {
    id: 'shelter_ponte_favela',
    name: 'Passarela Coberta do Morro',
    type: 'viaduct',
    x: -20,
    z: 80,
    width: 18,
    depth: 26,
    districtId: 'favela',
    icon: '🌉',
    bannerLabel: 'PASSARELA ELEVADA • TETO SEGURO',
  },

  // ORLA
  {
    id: 'shelter_posto_orla',
    name: 'Posto Beira-Mar',
    type: 'gas_station',
    x: 65,
    z: 45,
    width: 24,
    depth: 18,
    districtId: 'orla',
    icon: '⛽',
    bannerLabel: 'POSTO BR MARÍTIMO • ABRIGO',
  },
  {
    id: 'shelter_galeria_orla',
    name: 'Galeria Coberta da Praia',
    type: 'marquee',
    x: 35,
    z: 75,
    width: 22,
    depth: 18,
    districtId: 'orla',
    icon: '🏛️',
    bannerLabel: 'GALERIA ORLA • PISTA SECA',
  },

  // INDUSTRIAL
  {
    id: 'shelter_galpao_industrial',
    name: 'Galpão de Cargas Coberto',
    type: 'viaduct',
    x: -45,
    z: -145,
    width: 26,
    depth: 22,
    districtId: 'industrial',
    icon: '🏭',
    bannerLabel: 'GALPÃO LOGÍSTICO • ABRIGO',
  },
  {
    id: 'shelter_posto_industrial',
    name: 'Posto Rodo-Portuário',
    type: 'gas_station',
    x: 45,
    z: -145,
    width: 24,
    depth: 18,
    districtId: 'industrial',
    icon: '⛽',
    bannerLabel: 'POSTO RODOVIÁRIO • ABRIGO',
  },

  // AUTÓDROMO
  {
    id: 'shelter_paddock_autodromo',
    name: 'Boxes do Paddock Coberto',
    type: 'viaduct',
    x: -35,
    z: 145,
    width: 26,
    depth: 20,
    districtId: 'autodromo',
    icon: '🏎️',
    bannerLabel: 'PADDOCK VIP • COBERTURA BOX',
  },
  {
    id: 'shelter_posto_autodromo',
    name: 'Posto Arena Show',
    type: 'gas_station',
    x: 35,
    z: 145,
    width: 24,
    depth: 18,
    districtId: 'autodromo',
    icon: '⛽',
    bannerLabel: 'POSTO ARENA • ABRIGO SEGURO',
  },
];

/**
 * Checks if a 2D world coordinate (x, z) is currently covered under a shelter roof
 */
export function checkPlayerInShelter(
  x: number,
  z: number
): { isSheltered: boolean; shelter: CityShelter | null } {
  for (let i = 0; i < CITY_SHELTERS.length; i++) {
    const s = CITY_SHELTERS[i];
    const halfW = s.width / 2;
    const halfD = s.depth / 2;
    if (
      x >= s.x - halfW &&
      x <= s.x + halfW &&
      z >= s.z - halfD &&
      z <= s.z + halfD
    ) {
      return { isSheltered: true, shelter: s };
    }
  }
  return { isSheltered: false, shelter: null };
}

/**
 * Computes nearest shelter to player coordinates
 */
export function getNearestShelter(
  x: number,
  z: number
): { shelter: CityShelter; distanceM: number } {
  let nearest = CITY_SHELTERS[0];
  let minD = Infinity;

  for (let i = 0; i < CITY_SHELTERS.length; i++) {
    const s = CITY_SHELTERS[i];
    const dist = Math.hypot(x - s.x, z - s.z);
    if (dist < minD) {
      minD = dist;
      nearest = s;
    }
  }

  return { shelter: nearest, distanceM: Math.round(minD * 8) };
}

/**
 * Generates physical 3D meshes for all shelters and 3D Bus Stops in the scene
 */
export function buildCityShelters3D(scene: THREE.Scene): {
  shelterGroup: THREE.Group;
  collisionBoxes: CollisionBox[];
} {
  const shelterGroup = new THREE.Group();
  shelterGroup.name = 'city_shelters';
  const collisionBoxes: CollisionBox[] = [];

  // Shared Materials
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.2,
  });

  const busRoofMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.25,
    metalness: 0.45,
  });

  const busGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.15,
    metalness: 0.7,
    transparent: true,
    opacity: 0.55,
  });

  const benchMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.4,
    metalness: 0.2,
  });

  const totemPoleMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.35,
    metalness: 0.4,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.6,
  });

  const neonTrimMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
  });

  const busTrimMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  const lightPanelMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
  });

  const dryFloorMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
  });

  const busPlatformMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.75,
  });

  CITY_SHELTERS.forEach(shelter => {
    const group = new THREE.Group();
    group.position.set(shelter.x, 0, shelter.z);

    if (shelter.type === 'bus_stop') {
      const roofHeight = 3.45;
      // 1. Concrete Boarding Sidewalk Platform + Yellow Tactile Curb Strip
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.16, 8.6),
        busPlatformMat
      );
      platform.position.set(0, 0.08, 0);
      group.add(platform);

      const tactileStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.17, 8.4),
        totemPoleMat
      );
      tactileStrip.position.set(1.45, 0.085, 0);
      group.add(tactileStrip);

      // 2. Curved/Arched Blue Polycarbonate Bus Stop Canopy Roof
      const roofMain = new THREE.Mesh(
        new THREE.BoxGeometry(3.3, 0.22, 8.2),
        busRoofMat
      );
      roofMain.position.set(0, roofHeight, 0);
      roofMain.rotation.z = 0.06;
      group.add(roofMain);

      const roofTrim = new THREE.Mesh(
        new THREE.BoxGeometry(3.45, 0.1, 8.35),
        busTrimMat
      );
      roofTrim.position.set(0, roofHeight - 0.1, 0);
      roofTrim.rotation.z = 0.06;
      group.add(roofTrim);

      // Under-canopy LED lighting bar
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.06, 6.8),
        lightPanelMat
      );
      ledStrip.position.set(0.2, roofHeight - 0.14, 0);
      group.add(ledStrip);

      // 3. Rear Support Pillars & Tempered Glass Back Windscreen
      for (const zOff of [-3.6, 0, 3.6]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, roofHeight, 10),
          pillarMat
        );
        post.position.set(-1.35, roofHeight / 2, zOff);
        group.add(post);
      }

      const backGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.55, 7.1),
        busGlassMat
      );
      backGlass.position.set(-1.35, 1.5, 0);
      group.add(backGlass);

      // Side Glass Windbreak Panel
      const sideGlass = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.55, 0.1),
        busGlassMat
      );
      sideGlass.position.set(-0.2, 1.5, -3.6);
      group.add(sideGlass);

      // 4. Ergonomic Red Waiting Bench (Banco da Parada de Ônibus)
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.12, 4.6),
        benchMat
      );
      seat.position.set(-0.75, 0.56, 0.2);
      group.add(seat);

      const backrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.52, 4.6),
        benchMat
      );
      backrest.position.set(-1.08, 0.84, 0.2);
      group.add(backrest);

      for (const legZ of [-1.8, 0.2, 2.2]) {
        const benchLeg = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.5, 0.12),
          pillarMat
        );
        benchLeg.position.set(-0.75, 0.28, legZ);
        group.add(benchLeg);
      }

      // 5. Roadside "PONTO DE ÔNIBUS" Totem Signpost at the Front Curb
      const totemPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.1, 8),
        totemPoleMat
      );
      totemPole.position.set(1.3, 1.55, 3.9);
      group.add(totemPole);

      const totemBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.95, 0.65),
        busRoofMat
      );
      totemBoard.position.set(1.3, 2.75, 3.9);
      group.add(totemBoard);

      // 6. Two Waiting 3D Passengers under the Bus Stop Shelter
      const passengerColors = [0xf97316, 0x10b981];
      passengerColors.forEach((pColor, idx) => {
        const pax = new THREE.Group();
        const torso = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.65, 0.28),
          new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.5 })
        );
        torso.position.y = 0.95;
        pax.add(torso);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.19, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 })
        );
        head.position.y = 1.48;
        pax.add(head);

        const legs = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.62, 0.24),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
        );
        legs.position.y = 0.35;
        pax.add(legs);

        pax.position.set(idx === 0 ? -0.45 : 0.35, 0.12, idx === 0 ? -1.4 : 2.3);
        pax.rotation.y = Math.PI / 2;
        group.add(pax);
      });

      // Collision box only for the back wall/bench so motorcycles & buses can pull right up to the curb
      collisionBoxes.push({
        minX: shelter.x - 1.55,
        maxX: shelter.x - 0.9,
        minZ: shelter.z - 3.8,
        maxZ: shelter.z + 3.8,
      });

      // 7. Overhead Illuminated Bus Stop Sign Sprite
      const canvas = document.createElement('canvas');
      canvas.width = 420;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0c4a6e';
        ctx.fillRect(0, 0, 420, 96);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 412, 88);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 27px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shelter.bannerLabel, 210, 48);
      }

      const signTex = new THREE.CanvasTexture(canvas);
      signTex.colorSpace = THREE.SRGBColorSpace;
      const signMat = new THREE.SpriteMaterial({ map: signTex, transparent: true });
      const signSprite = new THREE.Sprite(signMat);
      signSprite.scale.set(5.2, 1.2, 1);
      signSprite.position.set(0, roofHeight + 1.1, 0);
      group.add(signSprite);

      shelterGroup.add(group);
      return;
    }

    const roofHeight = shelter.type === 'viaduct' ? 5.8 : 4.8;
    const roofThickness = shelter.type === 'viaduct' ? 1.4 : 0.65;

    // 1. Dry asphalt floor pad under shelter
    const floorGeo = new THREE.PlaneGeometry(shelter.width, shelter.depth);
    const floor = new THREE.Mesh(floorGeo, dryFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.03;
    group.add(floor);

    // 2. Main Overhanging Roof Canopy
    const roofGeo = new THREE.BoxGeometry(shelter.width, roofThickness, shelter.depth);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.position.y = roofHeight;
    group.add(roof);

    // 3. Neon Trim on Roof Edge
    const trimGeo = new THREE.BoxGeometry(shelter.width + 0.3, 0.25, shelter.depth + 0.3);
    const trim = new THREE.Mesh(trimGeo, neonTrimMat);
    trim.position.y = roofHeight - roofThickness / 2;
    group.add(trim);

    // 4. Overhead Illuminated LED Light Panels under ceiling
    const numPanels = 4;
    for (let p = 0; p < numPanels; p++) {
      const pX = (p % 2 === 0 ? -1 : 1) * (shelter.width * 0.25);
      const pZ = (p < 2 ? -1 : 1) * (shelter.depth * 0.25);

      const panelGeo = new THREE.PlaneGeometry(3.5, 3.5);
      const panel = new THREE.Mesh(panelGeo, lightPanelMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(pX, roofHeight - roofThickness / 2 - 0.02, pZ);
      group.add(panel);
    }

    // 5. Overhead Soft Ambient Point Light
    const shelterLight = new THREE.PointLight(0xfef08a, 1.2, 28);
    shelterLight.position.set(0, roofHeight - 0.5, 0);
    group.add(shelterLight);

    // 6. Support Pillars / Posts (positioned at perimeter corners so vehicles drive underneath freely!)
    const pillarRadius = shelter.type === 'viaduct' ? 0.65 : 0.35;
    const pillarGeo = new THREE.CylinderGeometry(pillarRadius, pillarRadius, roofHeight, 10);

    const cornerX = shelter.width * 0.42;
    const cornerZ = shelter.depth * 0.42;

    const corners = [
      { x: -cornerX, z: -cornerZ },
      { x: cornerX, z: -cornerZ },
      { x: -cornerX, z: cornerZ },
      { x: cornerX, z: cornerZ },
    ];

    corners.forEach(c => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(c.x, roofHeight / 2, c.z);
      group.add(pillar);

      // Add collision box for the pillar
      collisionBoxes.push({
        minX: shelter.x + c.x - pillarRadius,
        maxX: shelter.x + c.x + pillarRadius,
        minZ: shelter.z + c.z - pillarRadius,
        maxZ: shelter.z + c.z + pillarRadius,
      });
    });

    // 7. Overhead Signboard Banner Sprite: "ABRIGO SEGURO"
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 384, 96);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 376, 88);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shelter.bannerLabel, 192, 48);
    }

    const signTex = new THREE.CanvasTexture(canvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.SpriteMaterial({ map: signTex, transparent: true });
    const signSprite = new THREE.Sprite(signMat);
    signSprite.scale.set(6.0, 1.5, 1);
    signSprite.position.set(0, roofHeight + 1.2, 0);
    group.add(signSprite);

    shelterGroup.add(group);
  });

  scene.add(shelterGroup);
  return { shelterGroup, collisionBoxes };
}

