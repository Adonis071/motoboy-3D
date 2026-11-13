import * as THREE from 'three';
import { BikeCustomization, BikeUpgrades } from '../types/game';
import { DeliveryPoint } from './cityMap';

/**
 * High-realism urban asphalt texture with aggregate grain, polished tire tracks,
 * storm drain grates, manhole covers, cat's-eye reflectors, and concrete curbs
 */
export interface RoadTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export function createAsphaltTexture(isLow: boolean = false): RoadTextures {
  const width = isLow ? 512 : 1024;
  const height = isLow ? 512 : 1024;
  const scale = isLow ? 0.5 : 1.0;

  // 1. Albedo (Map)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;

  // 2. Bump Map (Height)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  // 3. Emissive Mask (Reflective Markings)
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = width;
  emissiveCanvas.height = height;
  const eCtx = emissiveCanvas.getContext('2d')!;

  // BASE LAYERS
  aCtx.fillStyle = '#1a1d22';
  aCtx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#808080'; // Mid-gray (no height change)
  bCtx.fillRect(0, 0, width, height);

  eCtx.fillStyle = '#000000'; // No emission
  eCtx.fillRect(0, 0, width, height);

  // NOISE & GRAIN
  const grainCount = isLow ? 4000 : 18000;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const shade = Math.floor(Math.random() * 45 + 15);
    aCtx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 2})`;
    aCtx.fillRect(x, y, 1.2, 1.2);

    // Bump variance (pitting and micro-irregularities)
    const bumpShade = 128 + (Math.random() - 0.5) * (isLow ? 30 : 65);
    bCtx.fillStyle = `rgb(${bumpShade}, ${bumpShade}, ${bumpShade})`;
    bCtx.fillRect(x, y, isLow ? 1.5 : 2.5, isLow ? 1.5 : 2.5);
  }

  // DRAW 4-LANE TIRE TRACKS (Matching inner ±1.75m and outer ±4.35m traffic lanes)
  const drawTireTrack = (centerX: number, widthPx: number = 140) => {
    const cx = centerX * scale;
    const halfW = (widthPx * scale) / 2;
    const grad = aCtx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    grad.addColorStop(0, 'rgba(10, 12, 16, 0)');
    grad.addColorStop(0.22, 'rgba(8, 10, 14, 0.42)');
    grad.addColorStop(0.5, 'rgba(24, 28, 36, 0.12)');
    grad.addColorStop(0.78, 'rgba(8, 10, 14, 0.42)');
    grad.addColorStop(1, 'rgba(10, 12, 16, 0)');
    aCtx.fillStyle = grad;
    aCtx.fillRect(cx - halfW, 0, halfW * 2, height);

    // Tire tracks also affect bump (slight indentation)
    const bGrad = bCtx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    bGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bGrad.addColorStop(0.5, 'rgba(0,0,0,0.14)');
    bGrad.addColorStop(1, 'rgba(0,0,0,0)');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(cx - halfW, 0, halfW * 2, height);
  };
  // Outer lanes (±4.35m) and inner lanes (±1.75m)
  drawTireTrack(194, 130);
  drawTireTrack(384, 130);
  drawTireTrack(640, 130);
  drawTireTrack(830, 130);

  if (!isLow) {
    // ADVANCED DETAILS (Sealed Tar Cracks, Patched Asphalt & Micro-Puddles)
    aCtx.strokeStyle = 'rgba(8, 10, 14, 0.65)';
    bCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    aCtx.lineWidth = 1.4;
    bCtx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      let x = Math.random() * 1024;
      let y = Math.random() * 1024;
      aCtx.beginPath();
      bCtx.beginPath();
      aCtx.moveTo(x, y);
      bCtx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 42;
        y += (Math.random() - 0.5) * 42;
        aCtx.lineTo(x, y);
        bCtx.lineTo(x, y);
      }
      aCtx.stroke();
      bCtx.stroke();
    }

    // Specular / Bump for Asphalt Patches & Damp Spots
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const radius = Math.random() * 75 + 28;
      const grad = aCtx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, 'rgba(30, 41, 59, 0.34)');
      grad.addColorStop(1, 'rgba(30, 41, 59, 0)');
      aCtx.fillStyle = grad;
      aCtx.beginPath();
      aCtx.ellipse(x, y, radius, radius * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
      aCtx.fill();

      bCtx.fillStyle = '#808080';
      bCtx.beginPath();
      bCtx.ellipse(x, y, radius, radius * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // CAST-IRON MANHOLE COVERS (Tampas de Bueiro Metálicas no Asfalto)
  const drawManholeCover = (mx: number, my: number) => {
    const cx = mx * scale;
    const cy = my * scale;
    const r = 20 * scale;

    // Concrete collar ring
    aCtx.fillStyle = '#334155';
    aCtx.beginPath();
    aCtx.arc(cx, cy, r + 5 * scale, 0, Math.PI * 2);
    aCtx.fill();

    // Cast-iron lid
    aCtx.fillStyle = '#1e293b';
    aCtx.beginPath();
    aCtx.arc(cx, cy, r, 0, Math.PI * 2);
    aCtx.fill();

    aCtx.strokeStyle = '#64748b';
    aCtx.lineWidth = 2 * scale;
    aCtx.beginPath();
    aCtx.arc(cx, cy, r - 3 * scale, 0, Math.PI * 2);
    aCtx.stroke();

    // Cross-hatch grip pattern
    aCtx.strokeStyle = '#475569';
    aCtx.lineWidth = 1.2 * scale;
    for (let d = -12; d <= 12; d += 6) {
      const off = d * scale;
      aCtx.beginPath();
      aCtx.moveTo(cx - r * 0.65, cy + off);
      aCtx.lineTo(cx + r * 0.65, cy + off);
      aCtx.stroke();
    }

    // Bump height for manhole lid
    bCtx.fillStyle = '#b8b8b8';
    bCtx.beginPath();
    bCtx.arc(cx, cy, r + 3 * scale, 0, Math.PI * 2);
    bCtx.fill();
  };
  drawManholeCover(380, 220);
  drawManholeCover(644, 740);

  // TRAFFIC MARKINGS (Lines, Motorcycle Corridor, Arrows, Curbs)
  const drawMarking = (color: string, drawFn: (ctx: CanvasRenderingContext2D) => void, isReflective: boolean = true) => {
    aCtx.fillStyle = color;
    drawFn(aCtx);
    if (isReflective) {
      eCtx.fillStyle = '#ffffff';
      drawFn(eCtx);
    }
    bCtx.fillStyle = isLow ? '#949494' : '#a8a8a8';
    drawFn(bCtx);
  };

  // White edge shoulder lines
  drawMarking('#f1f5f9', (ctx) => {
    ctx.fillRect(36 * scale, 0, 5 * scale, height);
    ctx.fillRect(width - 41 * scale, 0, 5 * scale, height);
  });

  // Central double yellow axis line (with dark asphalt gap)
  drawMarking('#eab308', (ctx) => {
    ctx.fillRect(width / 2 - 8 * scale, 0, 4.5 * scale, height);
    ctx.fillRect(width / 2 + 3.5 * scale, 0, 4.5 * scale, height);
  });

  // Dual-lane dashed white dividers (between inner ±1.75m and outer ±4.35m lanes)
  drawMarking('rgba(248, 250, 252, 0.75)', (ctx) => {
    for (let y = 24 * scale; y < height; y += 96 * scale) {
      ctx.fillRect(286 * scale, y, 4.5 * scale, 42 * scale);
      ctx.fillRect((width - 290.5) * scale, y, 4.5 * scale, 42 * scale);
    }
  });

  // Directional lane arrows in all 4 lanes
  drawMarking('rgba(255, 255, 255, 0.32)', (ctx) => {
    const drawArr = (ax: number, ay: number) => {
      const sx = ax * scale;
      const sy = ay * scale;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 10 * scale, sy + 18 * scale);
      ctx.lineTo(sx + 3.5 * scale, sy + 18 * scale);
      ctx.lineTo(sx + 3.5 * scale, sy + 36 * scale);
      ctx.lineTo(sx - 3.5 * scale, sy + 36 * scale);
      ctx.lineTo(sx - 3.5 * scale, sy + 18 * scale);
      ctx.lineTo(sx - 10 * scale, sy + 18 * scale);
      ctx.closePath();
      ctx.fill();
    };
    drawArr(194, 140);
    drawArr(384, 520);
    drawArr(640, 320);
    drawArr(830, 780);
  });

  // Reflective Cat's-Eye Road Studs along double yellow centerline
  for (let y = 32 * scale; y < height; y += 96 * scale) {
    aCtx.fillStyle = '#fde047';
    aCtx.fillRect(width / 2 - 2.5 * scale, y, 5 * scale, 7 * scale);
    eCtx.fillStyle = '#fef08a';
    eCtx.fillRect(width / 2 - 3.5 * scale, y - 1 * scale, 7 * scale, 9 * scale);
    bCtx.fillStyle = '#ffffff';
    bCtx.fillRect(width / 2 - 2.5 * scale, y, 5 * scale, 7 * scale);
  }

  // HIGH-VISIBILITY BRAZILIAN CURBS (Meio-Fio de Concreto Pintado)
  const curbW = 28 * scale;
  for (let y = 0; y < height; y += 128 * scale) {
    const isEven = (y / (128 * scale)) % 2 === 0;
    const curbColor = isEven ? '#f1f5f9' : '#eab308';
    aCtx.fillStyle = curbColor;
    aCtx.fillRect(0, y, curbW, 122 * scale);
    aCtx.fillRect(width - curbW, y, curbW, 122 * scale);

    if (isEven) {
      eCtx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      eCtx.fillRect(0, y, curbW, 122 * scale);
      eCtx.fillRect(width - curbW, y, curbW, 122 * scale);
    }

    bCtx.fillStyle = '#d4d4d8';
    bCtx.fillRect(0, y, curbW, 122 * scale);
    bCtx.fillRect(width - curbW, y, curbW, 122 * scale);

    aCtx.fillStyle = '#1e293b';
    aCtx.fillRect(0, y + 122 * scale, curbW, 6 * scale);
    aCtx.fillRect(width - curbW, y + 122 * scale, curbW, 6 * scale);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = 16;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  bumpMap.anisotropy = 16;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.minFilter = THREE.LinearMipmapLinearFilter;
  emissiveMap.anisotropy = 16;

  return { map, bumpMap, emissiveMap };
}

/**
 * Architectural Brazilian Granite & Smooth Stone Paver Sidewalk / Urban Floor Texture
 * Designed with soft low-contrast mortar joints to eliminate moiré striping at grazing angles.
 */
export function createSidewalkTexture(isLow: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = isLow ? 512 : 1024;
  canvas.height = isLow ? 512 : 1024;
  const ctx = canvas.getContext('2d')!;
  const scale = isLow ? 0.5 : 1.0;

  // Warm-neutral architectural stone base
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Large-format architectural granite slabs (256x256) with subtle tonal variation
  const tileW = 256 * scale;
  const tileH = 256 * scale;
  const tones = [
    '#cbd5e1',
    '#c4d0de',
    '#d1d9e4',
    '#b8c5d6',
    '#cdd7e3',
  ];

  for (let row = 0; row < canvas.height / tileH; row++) {
    for (let col = 0; col < canvas.width / tileW; col++) {
      const x = col * tileW;
      const y = row * tileH;
      const tone = tones[(row * 3 + col * 5) % tones.length];
      const pad = 2 * scale;

      const grad = ctx.createLinearGradient(x, y, x + tileW, y + tileH);
      grad.addColorStop(0, tone);
      grad.addColorStop(1, '#bac7d8');
      ctx.fillStyle = grad;
      ctx.fillRect(x + pad, y + pad, tileW - pad * 2, tileH - pad * 2);
    }
  }

  // Fine natural stone mineral grain
  const grainCount = isLow ? 2000 : 5500;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const isLight = Math.random() > 0.5;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.14)' : 'rgba(51, 65, 85, 0.12)';
    ctx.fillRect(x, y, 2 * scale, 2 * scale);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  return texture;
}

export function createBuildingWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Architectural concrete & dark anodized aluminum frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Horizontal concrete spandrel bands between floors
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, 512, 8);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, y, 512, 2);
  }

  // Office glass windows with realistic interior depth, blinds, and sky reflections
  for (let y = 18; y < 1008; y += 64) {
    for (let x = 16; x < 1000; x += 56) {
      const rand = Math.random();
      if (rand < 0.26) {
        // Warm illuminated office with ceiling light gradient
        const grad = ctx.createLinearGradient(x, y, x, y + 42);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = grad;
      } else if (rand < 0.48) {
        // Cool daylight sky reflection glass
        const grad = ctx.createLinearGradient(x, y, x + 44, y + 42);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
      } else if (rand < 0.65) {
        // Soft neutral office interior
        ctx.fillStyle = '#334155';
      } else {
        // Dark tinted glass
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillRect(x, y, 44, 42);

      // Window frame mullion highlight
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 44, 42);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates a glowing signboard texture for Hamburguerias, Pizzarias, Restaurantes, etc.
 */
export function createStorefrontSignTexture(
  title: string,
  subtitle: string,
  icon: string,
  bgHex: number,
  accentHex: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  const bgStr = '#' + bgHex.toString(16).padStart(6, '0');
  const accStr = '#' + accentHex.toString(16).padStart(6, '0');

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 192);

  // Colored inner banner
  ctx.fillStyle = bgStr;
  ctx.fillRect(10, 10, 492, 172);

  // Neon border
  ctx.strokeStyle = accStr;
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 484, 164);

  // Icon badge on left
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(82, 96, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 82, 100);

  // Restaurant Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title.toUpperCase(), 152, 76);

  // Subtitle / Category badge
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${subtitle.toUpperCase()} • DELIVERY`, 152, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Builds a complete 3D Restaurant / Hamburgueria / Pizzaria / Sushi / Lanchonete storefront
 * with striped awning, glowing windows, rooftop 3D food sculpture, and road pickup bay!
 */
export function createRestaurantBuilding(point: DeliveryPoint, isLow: boolean = false): THREE.Group {
  const group = new THREE.Group();
  const offset = point.buildingOffset || { dx: -8, dz: 0, rotationY: Math.PI / 2 };

  // 1. Storefront Building Group (placed beside the road pickup bay)
  const building = new THREE.Group();
  building.position.set(offset.dx, 0, offset.dz);
  building.rotation.y = offset.rotationY;

  const wallMat = new THREE.MeshStandardMaterial({
    color: point.primaryColor,
    roughness: 0.55,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: point.accentColor,
    roughness: 0.35,
    metalness: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
  });
  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
    roughness: 0.15,
  });

  // Main building volume
  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.2, 7.5), wallMat);
  mainBox.position.y = 3.1;
  mainBox.castShadow = !isLow;
  mainBox.receiveShadow = !isLow;
  building.add(mainBox);

  // Roof parapet trim
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.6, 8.0), trimMat);
  roofTrim.position.y = 6.3;
  building.add(roofTrim);

  // Illuminated glass storefront windows & counter
  const glassFront = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.8, 0.2), warmWindowMat);
  glassFront.position.set(0, 1.8, 3.72);
  building.add(glassFront);

  // Door frame
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.5, 0.28), darkMat);
  doorMesh.position.set(0, 1.35, 3.74);
  building.add(doorMesh);

  // Striped Awning (Toldo) over the storefront
  const awningGroup = new THREE.Group();
  awningGroup.position.set(0, 3.4, 4.35);
  awningGroup.rotation.x = 0.32;
  const stripeCount = 7;
  const stripeW = 8.4 / stripeCount;
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (let i = 0; i < stripeCount; i++) {
    const sMat = i % 2 === 0 ? trimMat : whiteMat;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(stripeW, 0.18, 1.8), sMat);
    stripe.position.x = -4.2 + stripeW * (i + 0.5);
    awningGroup.add(stripe);
  }
  building.add(awningGroup);

  // Large Illuminated Billboard Sign on Facade
  const signTex = createStorefrontSignTexture(
    point.shortSign,
    point.categoryLabel,
    point.icon,
    point.primaryColor,
    point.accentColor
  );
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.4, 0.35), [
    trimMat,
    trimMat,
    trimMat,
    trimMat,
    signMat,
    signMat,
  ]);
  signBoard.position.set(0, 5.2, 3.85);
  building.add(signBoard);

  // 3D Rooftop Thematic Prop (Giant Burger, Pizza, Sushi, or Steak Grill!)
  if (point.category === 'hamburgueria' || point.category === 'lanchonete') {
    const burgerGroup = new THREE.Group();
    const bunMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const meatMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const bottomBun = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.3, 0.45, 16), bunMat);
    const patty = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.35, 16), meatMat);
    patty.position.y = 0.4;
    const cheese = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.2), cheeseMat);
    cheese.position.y = 0.6;
    cheese.rotation.y = Math.PI / 4;
    const topBun = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      bunMat
    );
    topBun.position.y = 0.65;
    burgerGroup.add(bottomBun, patty, cheese, topBun);
    burgerGroup.position.set(0, 7.0, 0);
    burgerGroup.castShadow = !isLow;
    building.add(burgerGroup);
  } else if (point.category === 'pizzaria') {
    const pizzaGroup = new THREE.Group();
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
    const pepMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const crust = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.22, 20), crustMat);
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.26, 20), cheeseMat);
    pizzaGroup.add(crust, cheese);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12), pepMat);
      pep.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
      pizzaGroup.add(pep);
    }
    pizzaGroup.rotation.x = Math.PI / 3;
    pizzaGroup.position.set(0, 7.6, 0);
    building.add(pizzaGroup);
  } else if (point.category === 'acai') {
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.3 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 2.2, 16), cupMat);
    cup.position.set(0, 7.6, 0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), creamMat);
    dome.position.set(0, 8.7, 0);
    building.add(cup, dome);
  }

  group.add(building);

  // 2. Road Pickup Bay Marking ("COLETA MOTO") right at (0, 0, 0) of the group
  const bayCanvas = document.createElement('canvas');
  bayCanvas.width = 256;
  bayCanvas.height = 256;
  const bCtx = bayCanvas.getContext('2d')!;
  bCtx.clearRect(0, 0, 256, 256);

  // Dashed yellow/cyan parking box
  bCtx.strokeStyle = '#facc15';
  bCtx.lineWidth = 10;
  bCtx.setLineDash([24, 14]);
  bCtx.strokeRect(16, 16, 224, 224);

  bCtx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  bCtx.fillRect(20, 20, 216, 216);

  bCtx.fillStyle = '#ffffff';
  bCtx.font = '900 30px sans-serif';
  bCtx.textAlign = 'center';
  bCtx.fillText(point.icon + ' COLETA', 128, 115);
  bCtx.fillStyle = '#fde047';
  bCtx.font = 'bold 24px sans-serif';
  bCtx.fillText(point.shortSign, 128, 155);

  const bayTex = new THREE.CanvasTexture(bayCanvas);
  bayTex.colorSpace = THREE.SRGBColorSpace;
  const bayPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 5.5),
    new THREE.MeshBasicMaterial({
      map: bayTex,
      transparent: true,
      depthWrite: false,
    })
  );
  bayPlane.rotation.x = -Math.PI / 2;
  bayPlane.position.y = 0.04;
  group.add(bayPlane);

  group.position.set(point.x, 0, point.z);
  return group;
}

export function createTrunkLogoTexture(skin: BikeCustomization['trunkSkin']): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  let bgColor = '#18181b';
  let text = 'EXPRESS';
  let textColor = '#ffffff';

  if (skin === 'ifood') {
    bgColor = '#ea1d2c';
    text = 'MOTO-FOOD';
    textColor = '#ffffff';
  } else if (skin === 'amarelo') {
    bgColor = '#ffe600';
    text = 'RAPIDÃO';
    textColor = '#18181b';
  } else if (skin === 'uber') {
    bgColor = '#06c167';
    text = 'FLASH-EATS';
    textColor = '#0f172a';
  } else if (skin === 'graffiti') {
    bgColor = '#7c3aed';
    text = 'GRAU & CORTE';
    textColor = '#38bdf8';
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  // Reflective safety stripes on baú
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(14, 18, 228, 14);
  ctx.fillStyle = '#ef4444';
  for (let x = 14; x < 242; x += 36) {
    ctx.fillRect(x, 18, 18, 14);
  }

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 236);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 134);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Motorcycle Model with high-detail parts, mirrors, shock springs,
 * rider legs/boots, and dynamic nitro flame!
 */
export interface MotorcycleGroup extends THREE.Group {
  frontFork: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  riderMesh: THREE.Group;
  bodyMesh: THREE.Mesh;
  trunkMesh: THREE.Mesh;
  helmetMesh: THREE.Mesh;
  headlightLight: THREE.SpotLight;
  neonMesh: THREE.Mesh;
  neonLight: THREE.PointLight;
  nitroFlameMesh: THREE.Mesh;
  damageSmokeGroup: THREE.Group;
  taillightMat: THREE.MeshStandardMaterial;
  exhaustTip: THREE.Vector3;
}

export function createMotorcycle(
  customization: BikeCustomization,
  _upgrades: BikeUpgrades,
  isLow: boolean = false
): MotorcycleGroup {
  const root = new THREE.Group() as MotorcycleGroup;

  // Materials
  const paintMat = new THREE.MeshStandardMaterial({
    color: customization.paintColor,
    roughness: 0.2,
    metalness: 0.75,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.12,
    metalness: 0.92,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.85,
    metalness: 0.1,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbeb,
    emissiveIntensity: 0.95,
    roughness: 0.1,
  });

  const redGlassMat = new THREE.MeshStandardMaterial({
    color: 0xff1122,
    emissive: 0xff0022,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  root.taillightMat = redGlassMat;

  // 1. MAIN FRAME & CHASSIS
  const frameGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8);
  frameGeo.rotateZ(Math.PI / 4);
  const frameMesh = new THREE.Mesh(frameGeo, darkMetalMat);
  frameMesh.position.set(0, 0.45, 0);
  frameMesh.castShadow = !isLow;
  root.add(frameMesh);

  // 2. SCULPTED FUEL TANK & SIDE FAIRINGS
  const tankGeo = new THREE.BoxGeometry(0.36, 0.3, 0.66);
  const tankMesh = new THREE.Mesh(tankGeo, paintMat);
  tankMesh.position.set(0, 0.73, 0.16);
  tankMesh.castShadow = true;
  root.add(tankMesh);
  root.bodyMesh = tankMesh;

  // Rear tail fairing
  const tailFairing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.45), paintMat);
  tailFairing.position.set(0, 0.64, -0.58);
  root.add(tailFairing);

  // 3. ENGINE BLOCK & COOLING FINS
  const engineGeo = new THREE.BoxGeometry(0.3, 0.35, 0.45);
  const engineMesh = new THREE.Mesh(engineGeo, chromeMat);
  engineMesh.position.set(0, 0.35, 0.05);
  engineMesh.castShadow = true;
  root.add(engineMesh);

  for (let i = -0.12; i <= 0.12; i += 0.06) {
    const finGeo = new THREE.BoxGeometry(0.36, 0.02, 0.4);
    const finMesh = new THREE.Mesh(finGeo, darkMetalMat);
    finMesh.position.set(0, 0.35 + i, 0.05);
    root.add(finMesh);
  }

  // 3.5 ENGINE DAMAGE SMOKE PUFFS (Visible when bikeHealth < 65%)
  const damageSmokeGroup = new THREE.Group();
  damageSmokeGroup.position.set(0, 0.55, 0.15);
  damageSmokeGroup.visible = false;
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.55,
  });
  for (let s = 0; s < 4; s++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12 + s * 0.04, 8, 8), smokeMat.clone());
    puff.position.set((s % 2 === 0 ? 1 : -1) * 0.06, s * 0.22, -s * 0.12);
    damageSmokeGroup.add(puff);
  }
  root.add(damageSmokeGroup);
  root.damageSmokeGroup = damageSmokeGroup;

  // 4. SEAT
  const seatGeo = new THREE.BoxGeometry(0.3, 0.12, 0.72);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const seatMesh = new THREE.Mesh(seatGeo, seatMat);
  seatMesh.position.set(0, 0.69, -0.38);
  seatMesh.castShadow = true;
  root.add(seatMesh);

  // 5. EXHAUST SYSTEM & NITRO FLAME CONE
  const exhaustGeo = new THREE.CylinderGeometry(0.048, 0.062, 1.1, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat =
    customization.exhaustType === 'sport' || customization.exhaustType === 'direto'
      ? new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.18, metalness: 0.92 })
      : chromeMat;
  const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustMesh.position.set(0.19, 0.3, -0.4);
  exhaustMesh.rotation.x = -0.15;
  exhaustMesh.castShadow = !isLow;
  root.add(exhaustMesh);
  root.exhaustTip = new THREE.Vector3(0.19, 0.26, -0.95);

  // Nitro Blue/Cyan Jet Flame at Exhaust Tip
  const flameGeo = new THREE.ConeGeometry(0.09, 0.65, 10);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
  });
  const nitroFlameMesh = new THREE.Mesh(flameGeo, flameMat);
  nitroFlameMesh.position.set(0.19, 0.22, -1.25);
  root.add(nitroFlameMesh);
  root.nitroFlameMesh = nitroFlameMesh;

  // 6. REAR WHEEL, SWINGARM & SHOCK SPRINGS
  const swingarmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.65);
  const swingarmMesh = new THREE.Mesh(swingarmGeo, darkMetalMat);
  swingarmMesh.position.set(0, 0.35, -0.55);
  root.add(swingarmMesh);

  // Dual red rear shock absorbers
  const shockMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.7 });
  const shockGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.38, 8);
  const leftShock = new THREE.Mesh(shockGeo, shockMat);
  leftShock.position.set(-0.14, 0.5, -0.65);
  leftShock.rotation.x = 0.25;
  const rightShock = new THREE.Mesh(shockGeo, shockMat);
  rightShock.position.set(0.14, 0.5, -0.65);
  rightShock.rotation.x = 0.25;
  root.add(leftShock, rightShock);

  const wheelGeo = new THREE.TorusGeometry(0.32, 0.095, 14, 26);
  wheelGeo.rotateY(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.14, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.13, 0.56, 0.045);

  const rearTireMesh = new THREE.Mesh(wheelGeo, rubberMat);
  const rearRimMesh = new THREE.Mesh(rimGeo, chromeMat);
  const rearSpoke1 = new THREE.Mesh(spokeGeo, chromeMat);
  const rearSpoke2 = new THREE.Mesh(spokeGeo, chromeMat);
  rearSpoke2.rotation.x = Math.PI / 2;
  rearTireMesh.add(rearRimMesh, rearSpoke1, rearSpoke2);
  rearTireMesh.position.set(0, 0.32, -0.85);
  rearTireMesh.castShadow = true;
  root.add(rearTireMesh);
  root.rearWheel = rearTireMesh;

  // 7. FRONT FORK, FENDER, MIRRORS & HANDLEBARS
  const frontForkGroup = new THREE.Group();
  frontForkGroup.position.set(0, 0.45, 0.65);
  frontForkGroup.rotation.x = -0.25;

  const forkTubeGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.82, 8);
  const leftFork = new THREE.Mesh(forkTubeGeo, chromeMat);
  leftFork.position.set(-0.11, 0, 0);
  const rightFork = new THREE.Mesh(forkTubeGeo, chromeMat);
  rightFork.position.set(0.11, 0, 0);
  frontForkGroup.add(leftFork, rightFork);

  // Front mudguard (para-lama)
  const fenderGeo = new THREE.BoxGeometry(0.22, 0.08, 0.42);
  const fenderMesh = new THREE.Mesh(fenderGeo, paintMat);
  fenderMesh.position.set(0, -0.02, 0.12);
  frontForkGroup.add(fenderMesh);

  // Handlebars
  const handlebarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8);
  handlebarGeo.rotateZ(Math.PI / 2);
  const handlebarMesh = new THREE.Mesh(handlebarGeo, chromeMat);
  handlebarMesh.position.set(0, 0.42, 0);
  frontForkGroup.add(handlebarMesh);

  // Rear-view mirrors (retrovisores de motoboy)
  const mirrorStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6);
  const mirrorHeadGeo = new THREE.BoxGeometry(0.12, 0.07, 0.03);
  const leftMirror = new THREE.Mesh(mirrorHeadGeo, darkMetalMat);
  leftMirror.position.set(-0.36, 0.56, 0.04);
  const rightMirror = new THREE.Mesh(mirrorHeadGeo, darkMetalMat);
  rightMirror.position.set(0.36, 0.56, 0.04);
  const leftStem = new THREE.Mesh(mirrorStemGeo, chromeMat);
  leftStem.position.set(-0.3, 0.49, 0.02);
  const rightStem = new THREE.Mesh(mirrorStemGeo, chromeMat);
  rightStem.position.set(0.3, 0.49, 0.02);
  frontForkGroup.add(leftMirror, rightMirror, leftStem, rightStem);

  // Grips
  const gripGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.13, 8);
  gripGeo.rotateZ(Math.PI / 2);
  const leftGrip = new THREE.Mesh(gripGeo, rubberMat);
  leftGrip.position.set(-0.33, 0.42, 0);
  const rightGrip = new THREE.Mesh(gripGeo, rubberMat);
  rightGrip.position.set(0.33, 0.42, 0);
  frontForkGroup.add(leftGrip, rightGrip);

  // Headlight casing & lens
  const headlightHousingGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.16, 12);
  headlightHousingGeo.rotateX(Math.PI / 2);
  const headlightHousing = new THREE.Mesh(headlightHousingGeo, darkMetalMat);
  headlightHousing.position.set(0, 0.28, 0.1);
  const headlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 16), glassMat);
  headlightLens.position.set(0, 0, 0.085);
  headlightHousing.add(headlightLens);
  frontForkGroup.add(headlightHousing);

  // Front Wheel
  const frontTireMesh = new THREE.Mesh(wheelGeo, rubberMat);
  const frontRimMesh = new THREE.Mesh(rimGeo, chromeMat);
  const frontSpoke1 = new THREE.Mesh(spokeGeo, chromeMat);
  const frontSpoke2 = new THREE.Mesh(spokeGeo, chromeMat);
  frontSpoke2.rotation.x = Math.PI / 2;
  frontTireMesh.add(frontRimMesh, frontSpoke1, frontSpoke2);
  frontTireMesh.position.set(0, -0.32, 0.08);
  frontTireMesh.castShadow = true;
  frontForkGroup.add(frontTireMesh);
  root.frontWheel = frontTireMesh;

  root.add(frontForkGroup);
  root.frontFork = frontForkGroup;

  // Real 3D Headlight beam spotlight
  const spotLight = new THREE.SpotLight(0xfffbeb, 3.0, 52, Math.PI / 4.5, 0.35, 1);
  spotLight.position.set(0, 0.78, 0.85);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0.2, 18);
  root.add(spotTarget);
  spotLight.target = spotTarget;
  root.add(spotLight);
  root.headlightLight = spotLight;

  // 8. TAILLIGHT & LICENSE PLATE
  const taillightGeo = new THREE.BoxGeometry(0.16, 0.06, 0.05);
  const taillightMesh = new THREE.Mesh(taillightGeo, redGlassMat);
  taillightMesh.position.set(0, 0.66, -0.82);
  root.add(taillightMesh);

  // Amber turn signals (setas)
  const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const blinkerGeo = new THREE.BoxGeometry(0.05, 0.035, 0.04);
  const leftBlinker = new THREE.Mesh(blinkerGeo, blinkerMat);
  leftBlinker.position.set(-0.14, 0.64, -0.8);
  const rightBlinker = new THREE.Mesh(blinkerGeo, blinkerMat);
  rightBlinker.position.set(0.14, 0.64, -0.8);
  root.add(leftBlinker, rightBlinker);

  // 9. DELIVERY BAÚ (TRUNK BOX)
  const trunkTexture = createTrunkLogoTexture(customization.trunkSkin);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: trunkTexture,
    roughness: 0.35,
    metalness: 0.2,
  });
  const trunkGeo = new THREE.BoxGeometry(0.52, 0.48, 0.5);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.position.set(0, 0.96, -0.76);
  trunkMesh.castShadow = true;
  root.add(trunkMesh);
  root.trunkMesh = trunkMesh;

  // 10. MOTOBOY RIDER (Jacket, Reflective Strips, Helmet, Arms & Legs)
  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.65, -0.2);

  // Jacket / Torso
  const torsoGeo = new THREE.BoxGeometry(0.38, 0.5, 0.25);
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.position.set(0, 0.4, 0);
  torsoMesh.rotation.x = 0.25;
  torsoMesh.castShadow = true;
  riderGroup.add(torsoMesh);

  // High-visibility neon safety stripe on jacket back
  const safetyStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.39, 0.07, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xa3e635 })
  );
  safetyStripe.position.set(0, 0.44, 0);
  safetyStripe.rotation.x = 0.25;
  riderGroup.add(safetyStripe);

  // Rider Jeans / Legs & Boots
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.85 });
  const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.48, 8);
  const leftLeg = new THREE.Mesh(legGeo, jeansMat);
  leftLeg.position.set(-0.18, 0.0, 0.08);
  leftLeg.rotation.x = -0.35;
  const rightLeg = new THREE.Mesh(legGeo, jeansMat);
  rightLeg.position.set(0.18, 0.0, 0.08);
  rightLeg.rotation.x = -0.35;
  riderGroup.add(leftLeg, rightLeg);

  // Helmet
  const helmetGeo = new THREE.SphereGeometry(0.185, 18, 18);
  const helmetMat = new THREE.MeshStandardMaterial({
    color: customization.helmetColor,
    roughness: 0.18,
    metalness: 0.55,
  });
  const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
  helmetMesh.position.set(0, 0.79, 0.1);
  helmetMesh.castShadow = true;

  // Visor
  const visorGeo = new THREE.BoxGeometry(0.25, 0.1, 0.12);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.08,
    metalness: 0.92,
  });
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.0, 0.12);
  helmetMesh.add(visorMesh);

  riderGroup.add(helmetMesh);
  root.helmetMesh = helmetMesh;

  // Arms leaning to handlebars
  const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.45, 8);
  armGeo.rotateX(Math.PI / 3);
  const leftArm = new THREE.Mesh(armGeo, torsoMat);
  leftArm.position.set(-0.24, 0.38, 0.18);
  const rightArm = new THREE.Mesh(armGeo, torsoMat);
  rightArm.position.set(0.24, 0.38, 0.18);
  riderGroup.add(leftArm, rightArm);

  root.add(riderGroup);
  root.riderMesh = riderGroup;

  // 11. NEON UNDERGLOW
  const neonColorMap: Record<string, number> = {
    none: 0x000000,
    cyan: 0x00f3ff,
    pink: 0xff007f,
    lime: 0x39ff14,
    gold: 0xffd700,
    purple: 0xa855f7,
  };
  const activeNeon = neonColorMap[customization.neonColor] || 0x000000;
  const isNeonOn = customization.neonColor !== 'none';

  const neonBarGeo = new THREE.BoxGeometry(0.32, 0.025, 0.75);
  const neonMat = new THREE.MeshBasicMaterial({
    color: activeNeon,
    transparent: true,
    opacity: isNeonOn ? 0.85 : 0,
  });
  const neonMesh = new THREE.Mesh(neonBarGeo, neonMat);
  neonMesh.position.set(0, 0.12, 0);
  root.add(neonMesh);
  root.neonMesh = neonMesh;

  const neonLight = new THREE.PointLight(activeNeon, isNeonOn ? 1.8 : 0, 4.5);
  neonLight.position.set(0, 0.08, 0);
  root.add(neonLight);
  root.neonLight = neonLight;

  // 12. RADIAL CONTACT SHADOW GROUNDING PLANE
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const gradient = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = gradient;
  sCtx.fillRect(0, 0, 128, 128);

  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(1.6, 2.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.02, 0);
  root.add(contactShadow);

  return root;
}

export type VehicleArchetype = 'sedan' | 'suv' | 'pickup' | 'taxi' | 'van' | 'police' | 'bus';

/**
 * Creates a Mercosul license plate texture
 */
function createLicensePlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 48);

  // Mercosul blue top band
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, 128, 14);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BRASIL', 64, 10);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 20px monospace';
  ctx.fillText('MTB2E26', 64, 38);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _sharedPlateTex: THREE.CanvasTexture | null = null;
let _sharedCarShadowTex: THREE.CanvasTexture | null = null;
let _sharedBusDestinationTex: THREE.CanvasTexture | null = null;

function getBusDestinationTexture(): THREE.CanvasTexture {
  if (_sharedBusDestinationTex) return _sharedBusDestinationTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 44);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚌 101 CENTRO • ORLA', 128, 25);
  _sharedBusDestinationTex = new THREE.CanvasTexture(canvas);
  _sharedBusDestinationTex.colorSpace = THREE.SRGBColorSpace;
  return _sharedBusDestinationTex;
}

function getCarShadowTexture(): THREE.CanvasTexture {
  if (_sharedCarShadowTex) return _sharedCarShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  _sharedCarShadowTex = new THREE.CanvasTexture(canvas);
  return _sharedCarShadowTex;
}

/**
 * Creates high-detail 3D traffic vehicles (Sedan, Taxi, SUV, Pickup, Delivery Van, Police Cruiser, Urban Bus)
 */
export function createTrafficCar(
  colorHex: number,
  archetype: VehicleArchetype = 'sedan',
  isLow: boolean = false
): THREE.Group {
  const car = new THREE.Group();

  const effectiveColor =
    archetype === 'taxi'
      ? 0xfacc15
      : archetype === 'police'
      ? 0xf8fafc
      : archetype === 'bus'
      ? 0x0ea5e9
      : colorHex;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: effectiveColor,
    roughness: 0.22,
    metalness: 0.68,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.6,
    metalness: 0.3,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.92,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.92,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x141619,
    roughness: 0.88,
  });

  // =========================================================================
  // DEDICATED 3D BRAZILIAN URBAN TRANSIT BUS (ÔNIBUS CIRCULAR)
  // =========================================================================
  if (archetype === 'bus') {
    const busWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.35,
    });
    const busStripeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });

    // 1. Bus Contact Shadow
    const busShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 8.6),
      new THREE.MeshBasicMaterial({
        map: getCarShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    busShadow.rotation.x = -Math.PI / 2;
    busShadow.position.y = 0.025;
    car.add(busShadow);

    // 2. Lower Bus Body (Vibrant Blue/Emerald Livery) & White Upper Cabin
    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(2.18, 1.15, 7.8), bodyMat);
    lowerHull.position.set(0, 0.92, 0);
    lowerHull.castShadow = !isLow;
    lowerHull.receiveShadow = !isLow;
    car.add(lowerHull);

    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.14, 1.22, 7.72), busWhiteMat);
    upperCabin.position.set(0, 2.08, 0);
    upperCabin.castShadow = !isLow;
    car.add(upperCabin);

    // Horizontal Amber Transit Livery Stripe
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(2.21, 0.18, 7.82), busStripeMat);
    sideStripe.position.set(0, 1.46, 0);
    car.add(sideStripe);

    // 3. Rooftop Air Conditioning Units
    const acPod1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 1.8), chromeMat);
    acPod1.position.set(0, 2.78, 1.2);
    const acPod2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 1.8), chromeMat);
    acPod2.position.set(0, 2.78, -1.5);
    car.add(acPod1, acPod2);

    // 4. Panoramic Front Windshield & Illuminated Digital LED Destination Sign ("101 CENTRO • ORLA")
    const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.92, 0.12), glassMat);
    frontWindshield.position.set(0, 1.92, 3.86);
    car.add(frontWindshield);

    const destSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.32),
      new THREE.MeshBasicMaterial({ map: getBusDestinationTexture() })
    );
    destSign.position.set(0, 2.5, 3.88);
    car.add(destSign);

    // 5. Panoramic Passenger Side Windows & Folding Boarding Doors
    const sideWindowBand = new THREE.Mesh(new THREE.BoxGeometry(2.17, 0.78, 6.6), glassMat);
    sideWindowBand.position.set(0, 2.04, -0.2);
    car.add(sideWindowBand);

    // Front & Rear Folding Boarding Doors on Right Side (-X local)
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.85, 0.95), doorFrameMat);
    frontDoor.position.set(-1.08, 1.32, 2.75);
    const rearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.85, 0.95), doorFrameMat);
    rearDoor.position.set(-1.08, 1.32, -1.95);
    car.add(frontDoor, rearDoor);

    // 6. Heavy-Duty Bumpers, Headlights & Rear Brake Lights
    const busBumperGeo = new THREE.BoxGeometry(2.24, 0.32, 0.28);
    const fBumper = new THREE.Mesh(busBumperGeo, darkTrimMat);
    fBumper.position.set(0, 0.45, 3.88);
    const rBumper = new THREE.Mesh(busBumperGeo, darkTrimMat);
    rBumper.position.set(0, 0.45, -3.88);
    car.add(fBumper, rBumper);

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 1.5,
    });
    const lHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), headMat);
    lHead.position.set(-0.75, 0.78, 3.91);
    const rHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), headMat);
    rHead.position.set(0.75, 0.78, 3.91);
    car.add(lHead, rHead);

    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff1122,
      emissive: 0xff0022,
      emissiveIntensity: 0.85,
    });
    const lTail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.08), tailMat);
    lTail.position.set(-0.82, 0.88, -3.91);
    const rTail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.08), tailMat);
    rTail.position.set(0.82, 0.88, -3.91);
    const topBrakeBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.08), tailMat);
    topBrakeBar.position.set(0, 2.54, -3.88);
    car.add(lTail, rTail, topBrakeBar);

    // 7. 6 Heavy-Duty Bus Wheels (Front + Twin Rear Axles)
    const busWheelRadius = 0.42;
    const busTireGeo = new THREE.CylinderGeometry(busWheelRadius, busWheelRadius, 0.3, 14);
    busTireGeo.rotateZ(Math.PI / 2);
    const busRimGeo = new THREE.CylinderGeometry(busWheelRadius * 0.58, busWheelRadius * 0.58, 0.32, 10);
    busRimGeo.rotateZ(Math.PI / 2);

    const busWheelCoords = [
      { x: -1.04, y: busWheelRadius, z: 2.35 },
      { x: 1.04, y: busWheelRadius, z: 2.35 },
      { x: -1.04, y: busWheelRadius, z: -1.45 },
      { x: 1.04, y: busWheelRadius, z: -1.45 },
      { x: -1.04, y: busWheelRadius, z: -2.55 },
      { x: 1.04, y: busWheelRadius, z: -2.55 },
    ];
    const busWheels: THREE.Group[] = [];
    busWheelCoords.forEach(wp => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(busTireGeo, tireMat), new THREE.Mesh(busRimGeo, chromeMat));
      wg.position.set(wp.x, wp.y, wp.z);
      car.add(wg);
      busWheels.push(wg);
    });

    // 8. Overhead 3D Bus Route Badge
    const busHud = createCharacterHealthBar('🚌 ÔNIBUS CIRCULAR 101', 100, '#0ea5e9');
    busHud.sprite.position.set(0, 3.45, 0);
    car.add(busHud.sprite);

    car.userData.wheels = busWheels;
    car.userData.tailMat = tailMat;
    car.userData.updateBusHud = (label: string, color: string = '#0ea5e9') => {
      busHud.update(label, 100, color);
    };
    return car;
  }

  // 1. Ground Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(2.2, 4.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getCarShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.025;
  car.add(shadowMesh);

  // 2. Main Sculpted Lower Body & Wheel Arches
  const bodyHeight = archetype === 'suv' || archetype === 'van' ? 0.58 : 0.48;
  const chassisGeo = new THREE.BoxGeometry(1.74, bodyHeight, 3.85);
  const chassisMesh = new THREE.Mesh(chassisGeo, bodyMat);
  chassisMesh.position.set(0, 0.34 + bodyHeight / 2, 0);
  chassisMesh.castShadow = !isLow;
  chassisMesh.receiveShadow = !isLow;
  car.add(chassisMesh);

  // Side rocker skirts
  const skirtGeo = new THREE.BoxGeometry(1.78, 0.12, 2.4);
  const skirtMesh = new THREE.Mesh(skirtGeo, darkTrimMat);
  skirtMesh.position.set(0, 0.32, 0);
  car.add(skirtMesh);

  // Front & Rear Bumpers
  const bumperGeo = new THREE.BoxGeometry(1.8, 0.24, 0.22);
  const frontBumper = new THREE.Mesh(bumperGeo, darkTrimMat);
  frontBumper.position.set(0, 0.36, 1.9);
  const rearBumper = new THREE.Mesh(bumperGeo, darkTrimMat);
  rearBumper.position.set(0, 0.36, -1.9);
  car.add(frontBumper, rearBumper);

  // Front Grille & Chrome Bar
  const grilleGeo = new THREE.BoxGeometry(0.95, 0.22, 0.06);
  const grilleMesh = new THREE.Mesh(grilleGeo, darkTrimMat);
  grilleMesh.position.set(0, 0.54, 1.92);
  const grilleChrome = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.08), chromeMat);
  grilleChrome.position.set(0, 0.58, 1.92);
  car.add(grilleMesh, grilleChrome);

  // Mercosul License Plates (Front & Rear)
  if (!_sharedPlateTex) _sharedPlateTex = createLicensePlateTexture();
  const plateMat = new THREE.MeshBasicMaterial({ map: _sharedPlateTex });
  const plateGeo = new THREE.PlaneGeometry(0.42, 0.15);
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(0, 0.35, 2.02);
  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(0, 0.35, -2.02);
  rearPlate.rotation.y = Math.PI;
  car.add(frontPlate, rearPlate);

  // 3. Archetype-Specific Upper Cabin & Features
  if (archetype === 'van') {
    // High-roof Delivery Van
    const vanCabin = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.95, 3.1), bodyMat);
    vanCabin.position.set(0, 1.25, -0.25);
    vanCabin.castShadow = true;
    car.add(vanCabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.55, 0.15), glassMat);
    windshield.position.set(0, 1.22, 1.28);
    windshield.rotation.x = -0.22;
    car.add(windshield);

    // Side commercial stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.71, 0.18, 2.6),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    stripe.position.set(0, 1.15, -0.35);
    car.add(stripe);
  } else if (archetype === 'pickup') {
    // Front Cab
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.52, 1.35), glassMat);
    cabGlass.position.set(0, 1.02, 0.35);
    cabGlass.castShadow = true;
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.25), bodyMat);
    cabRoof.position.set(0, 1.3, 0.35);
    car.add(cabGlass, cabRoof);

    // Open Cargo Bed walls & Cargo Crates
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), darkTrimMat);
    bedFloor.position.set(0, 0.72, -1.05);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.65), crateMat);
    crate1.position.set(-0.32, 0.92, -0.95);
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.6), crateMat);
    crate2.position.set(0.32, 0.89, -1.15);
    car.add(bedFloor, crate1, crate2);

    // Chrome Roll Bar (Santo-Antônio)
    const rollBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.48, 0.08), chromeMat);
    rollBar.position.set(0, 1.05, -0.32);
    car.add(rollBar);
  } else if (archetype === 'suv') {
    // Tall Muscular SUV Cabin
    const suvGlass = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.54, 2.45), glassMat);
    suvGlass.position.set(0, 1.1, -0.25);
    suvGlass.castShadow = true;
    const suvRoof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.35), bodyMat);
    suvRoof.position.set(0, 1.39, -0.25);
    car.add(suvGlass, suvRoof);

    // Roof Rack Rails
    const railGeo = new THREE.BoxGeometry(0.06, 0.07, 1.9);
    const leftRail = new THREE.Mesh(railGeo, darkTrimMat);
    leftRail.position.set(-0.58, 1.46, -0.25);
    const rightRail = new THREE.Mesh(railGeo, darkTrimMat);
    rightRail.position.set(0.58, 1.46, -0.25);
    car.add(leftRail, rightRail);

    // Tailgate Spare Tire
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(0, 0.78, -1.98);
    car.add(spareTire);
  } else {
    // Sedan, Taxi, or Police Cruiser
    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.46, 1.95), glassMat);
    cabinGlass.position.set(0, 0.96, -0.15);
    cabinGlass.castShadow = true;
    const cabinRoof = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.07, 1.65),
      archetype === 'police' ? darkTrimMat : bodyMat
    );
    cabinRoof.position.set(0, 1.21, -0.15);
    car.add(cabinGlass, cabinRoof);

    if (archetype === 'police') {
      // Tactical Police Hood & Trunk Dark Accent + Red/Blue Side Stripes
      const policeHood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.04, 1.15), darkTrimMat);
      policeHood.position.set(0, 0.83, 1.25);
      car.add(policeHood);

      const blueStripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.77, 0.12, 3.3),
        new THREE.MeshBasicMaterial({ color: 0x1d4ed8 })
      );
      blueStripe.position.set(0, 0.62, 0);
      const redStripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.78, 0.06, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      redStripe.position.set(0, 0.52, -0.2);
      car.add(blueStripe, redStripe);

      // Front Police Push-Bar ("Quebra-Mato")
      const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.12), darkTrimMat);
      pushBar.position.set(0, 0.48, 2.02);
      car.add(pushBar);

      // Rooftop 3D Police Giroflex Lightbar (Red + Blue LED domes)
      const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.24), chromeMat);
      sirenBase.position.set(0, 1.28, -0.05);

      const sirenRedMat = new THREE.MeshStandardMaterial({
        color: 0xff1122,
        emissive: 0xff0022,
        emissiveIntensity: 2.2,
      });
      const sirenBlueMat = new THREE.MeshStandardMaterial({
        color: 0x0066ff,
        emissive: 0x0088ff,
        emissiveIntensity: 2.2,
      });

      const redDome = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.22), sirenRedMat);
      redDome.position.set(-0.27, 1.35, -0.05);
      const blueDome = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.22), sirenBlueMat);
      blueDome.position.set(0.27, 1.35, -0.05);
      car.add(sirenBase, redDome, blueDome);

      car.userData.sirenRedMat = sirenRedMat;
      car.userData.sirenBlueMat = sirenBlueMat;
    } else if (archetype === 'taxi') {
      // Blue Taxi Side Stripe
      const taxiStripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.77, 0.1, 3.2),
        new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      );
      taxiStripe.position.set(0, 0.58, 0);
      car.add(taxiStripe);

      // Illuminated Rooftop TAXI Sign
      const taxiSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.18, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfef08a,
          emissiveIntensity: 0.9,
        })
      );
      taxiSign.position.set(0, 1.33, 0.1);
      car.add(taxiSign);
    } else {
      // Sport rear spoiler on Sedan
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.06, 0.22), bodyMat);
      spoiler.position.set(0, 0.84, -1.78);
      car.add(spoiler);
    }
  }

  // 4. Side Wing Mirrors (Retrovisores)
  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.12);
  const leftMirror = new THREE.Mesh(mirrorGeo, bodyMat);
  leftMirror.position.set(-0.94, 0.86, 0.65);
  const rightMirror = new THREE.Mesh(mirrorGeo, bodyMat);
  rightMirror.position.set(0.94, 0.86, 0.65);
  car.add(leftMirror, rightMirror);

  // 5. LED Headlights + Amber Turn Signals
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef9c3,
    emissiveIntensity: 1.2,
  });
  const headGeo = new THREE.BoxGeometry(0.32, 0.13, 0.06);
  const leftHead = new THREE.Mesh(headGeo, headMat);
  leftHead.position.set(-0.6, 0.56, 1.92);
  const rightHead = new THREE.Mesh(headGeo, headMat);
  rightHead.position.set(0.6, 0.56, 1.92);
  car.add(leftHead, rightHead);

  // 6. Rear Brake Lights & Lightbar (exposed in userData for dynamic braking glow)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1122,
    emissive: 0xff0022,
    emissiveIntensity: 0.75,
  });
  const tailGeo = new THREE.BoxGeometry(0.36, 0.14, 0.06);
  const leftTail = new THREE.Mesh(tailGeo, tailMat);
  leftTail.position.set(-0.58, 0.58, -1.92);
  const rightTail = new THREE.Mesh(tailGeo, tailMat);
  rightTail.position.set(0.58, 0.58, -1.92);
  const centerTailBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), tailMat);
  centerTailBar.position.set(0, 0.61, -1.92);
  car.add(leftTail, rightTail, centerTailBar);

  // 7. 4 Detailed Wheels with Tires + Alloy Rims
  const wheelRadius = archetype === 'suv' || archetype === 'pickup' ? 0.34 : 0.3;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, 0.25, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.26, wheelRadius * 1.1, 0.06);

  const wheelPositions = [
    { x: -0.84, y: wheelRadius, z: 1.18 },
    { x: 0.84, y: wheelRadius, z: 1.18 },
    { x: -0.84, y: wheelRadius, z: -1.18 },
    { x: 0.84, y: wheelRadius, z: -1.18 },
  ];

  const wheels: THREE.Group[] = [];
  wheelPositions.forEach(wp => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, chromeMat);
    const spoke1 = new THREE.Mesh(spokeGeo, darkTrimMat);
    const spoke2 = new THREE.Mesh(spokeGeo, darkTrimMat);
    spoke2.rotation.x = Math.PI / 2;
    wGroup.add(tire, rim, spoke1, spoke2);
    wGroup.position.set(wp.x, wp.y, wp.z);
    wGroup.castShadow = !isLow;
    car.add(wGroup);
    wheels.push(wGroup);
  });

  // 5.5 Amber LED Turn Signals / Blinkers (Setas Esquerda/Direita & Pisca-Alerta)
  const blinkerLeftMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15,
  });
  const blinkerRightMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15,
  });
  const blinkerGeo = new THREE.BoxGeometry(0.14, 0.11, 0.08);
  const flBlinker = new THREE.Mesh(blinkerGeo, blinkerLeftMat);
  flBlinker.position.set(0.82, 0.56, 1.91);
  const rlBlinker = new THREE.Mesh(blinkerGeo, blinkerLeftMat);
  rlBlinker.position.set(0.82, 0.58, -1.91);
  const frBlinker = new THREE.Mesh(blinkerGeo, blinkerRightMat);
  frBlinker.position.set(-0.82, 0.56, 1.91);
  const rrBlinker = new THREE.Mesh(blinkerGeo, blinkerRightMat);
  rrBlinker.position.set(-0.82, 0.58, -1.91);
  car.add(flBlinker, rlBlinker, frBlinker, rrBlinker);

  // 8. Smart Driver Overhead Status Badge (Visible when reacting to player, turning, or honking!)
  const driverHud = createCharacterHealthBar('🚗 MOTORISTA ATENTO', 100, '#38bdf8');
  driverHud.sprite.position.set(0, 2.15, 0);
  driverHud.sprite.scale.set(2.3, 0.55, 1);
  driverHud.sprite.visible = false;
  car.add(driverHud.sprite);

  car.userData.wheels = wheels;
  car.userData.tailMat = tailMat;
  car.userData.headMat = headMat;
  car.userData.blinkerLeftMat = blinkerLeftMat;
  car.userData.blinkerRightMat = blinkerRightMat;
  car.userData.updateDriverHud = (label: string, visible: boolean, color: string = '#38bdf8') => {
    driverHud.sprite.visible = visible;
    if (visible) {
      driverHud.update(label, 100, color);
    }
  };

  return car;
}

/**
 * Creates delivery waypoint beacon with light pillar, pulsing ground rings, and floating marker
 */
export function createDeliveryBeacon(isPickup: boolean): THREE.Group {
  const group = new THREE.Group();
  const color = isPickup ? 0xf59e0b : 0x10b981; // Warm Amber for Restaurant Pickup, Emerald for Customer Delivery

  // Vertical light cylinder beam
  const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 22, 20, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 11;
  beam.name = 'beaconBeam';
  group.add(beam);

  // Outer Ground Ring
  const ringGeo = new THREE.RingGeometry(2.2, 2.8, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.08;
  ring.name = 'beaconRing';
  group.add(ring);

  // Inner Ground Ring
  const innerRingGeo = new THREE.RingGeometry(1.1, 1.4, 24);
  innerRingGeo.rotateX(-Math.PI / 2);
  const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
  innerRing.position.y = 0.08;
  group.add(innerRing);

  // Floating 3D Octahedron Marker
  const diamondGeo = new THREE.OctahedronGeometry(0.95, 0);
  const diamondMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.3,
  });
  const diamond = new THREE.Mesh(diamondGeo, diamondMat);
  diamond.position.y = 3.2;
  diamond.name = 'beaconDiamond';
  group.add(diamond);

  return group;
}

/**
 * Helper to update Delivery Beacon color dynamically when switching between Pickup (Restaurant) and Deliver (Customer)
 */
export function updateDeliveryBeaconColor(beaconGroup: THREE.Group, isPickup: boolean) {
  const colorHex = isPickup ? 0xf59e0b : 0x10b981;
  beaconGroup.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
      if (mat && 'color' in mat) {
        mat.color.setHex(colorHex);
      }
      if (mat && 'emissive' in mat) {
        (mat as THREE.MeshStandardMaterial).emissive.setHex(colorHex);
      }
    }
  });
}

/**
 * Creates a Brazilian favela stacked house
 */
export function createFavelaHouse(colorHex: number, heightTiers: number = 2): THREE.Group {
  const house = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 });
  const blueTankMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });

  for (let i = 0; i < heightTiers; i++) {
    const w = 4.5 - i * 0.4;
    const h = 2.6;
    const d = 4.2 - i * 0.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    box.position.set((Math.random() - 0.5) * 0.4, h * 0.5 + i * h, (Math.random() - 0.5) * 0.4);
    box.castShadow = true;
    box.receiveShadow = true;
    house.add(box);
  }

  // Caixa d'água on rooftop
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.7, 12), blueTankMat);
  tank.position.set(0.8, heightTiers * 2.6 + 0.35, 0.5);
  tank.castShadow = true;
  house.add(tank);

  return house;
}

/**
 * 3D Cantilevered Brazilian Traffic Signal Gantry (Semáforo de Pórtico + Cronômetro Digital LED + Semáforo de Pedestre)
 */
export interface TrafficLightGroup extends THREE.Group {
  setPhase: (state: 'green' | 'yellow' | 'red', remainingSec?: number) => void;
}

const _timerMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getSharedTimerMaterial(state: 'green' | 'yellow' | 'red', secInt: number): THREE.MeshBasicMaterial {
  const key = `${state}_${secInt}`;
  const existing = _timerMatCache.get(key);
  if (existing) return existing;

  const isGreen = state === 'green';
  const isYellow = state === 'yellow';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const tCtx = canvas.getContext('2d')!;
  tCtx.fillStyle = '#090d16';
  tCtx.fillRect(0, 0, 64, 64);
  tCtx.strokeStyle = isGreen ? '#22c55e' : isYellow ? '#facc15' : '#ef4444';
  tCtx.lineWidth = 4;
  tCtx.strokeRect(3, 3, 58, 58);

  tCtx.fillStyle = isGreen ? '#4ade80' : isYellow ? '#fde047' : '#f87171';
  tCtx.font = '900 34px monospace';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText(String(secInt).padStart(2, '0'), 32, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  _timerMatCache.set(key, mat);
  return mat;
}

let _gantryPoleMat: THREE.MeshStandardMaterial | null = null;
let _gantryHousingMat: THREE.MeshStandardMaterial | null = null;
let _gantryYellowBorderMat: THREE.MeshStandardMaterial | null = null;

export function createTrafficLightGantry(isLow: boolean = false): TrafficLightGroup {
  const group = new THREE.Group() as TrafficLightGroup;

  if (!_gantryPoleMat) {
    _gantryPoleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.8,
    });
    _gantryHousingMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.6,
      metalness: 0.3,
    });
    _gantryYellowBorderMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
    });
  }
  const poleMat = _gantryPoleMat!;
  const housingMat = _gantryHousingMat!;
  const yellowBorderMat = _gantryYellowBorderMat!;

  // 1. Vertical Heavy Steel Pole (5.6m tall)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 5.6, isLow ? 6 : 8), poleMat);
  pole.position.y = 2.8;
  pole.castShadow = !isLow;
  group.add(pole);

  // 2. Horizontal Cantilever Arm extending over the traffic lane (+X local direction)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.8, isLow ? 5 : 6), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(1.85, 5.25, 0);
  group.add(arm);

  // 3. Main Overhead Signal Head Box (faces both +Z and -Z along the avenue)
  const signalBox = new THREE.Group();
  signalBox.position.set(2.85, 4.95, 0);

  const borderFrame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.56, 0.32), yellowBorderMat);
  const innerBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.44, 0.38), housingMat);
  signalBox.add(borderFrame, innerBox);

  const redMat = new THREE.MeshBasicMaterial({ color: 0x3b0a0a });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0x3b2506 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  const lensGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.44, isLow ? 6 : 10);
  lensGeo.rotateX(Math.PI / 2);

  const redLens = new THREE.Mesh(lensGeo, redMat);
  redLens.position.y = 0.44;

  const yellowLens = new THREE.Mesh(lensGeo, yellowMat);
  yellowLens.position.y = 0;

  const greenLens = new THREE.Mesh(lensGeo, greenMat);
  greenLens.position.y = -0.44;

  signalBox.add(redLens, yellowLens, greenLens);
  group.add(signalBox);

  // 3.5 Digital LED Countdown Display using pre-baked cached materials (zero per-frame canvas redraws!)
  const initialTimerMat = getSharedTimerMaterial('green', 7);
  const timerMaterials: THREE.Material[] = [
    housingMat,
    housingMat,
    housingMat,
    housingMat,
    initialTimerMat,
    initialTimerMat,
  ];
  const timerBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.34), timerMaterials);
  timerBox.position.set(1.95, 4.95, 0);
  group.add(timerBox);

  let currentKey = '';
  group.setPhase = (state: 'green' | 'yellow' | 'red', remainingSec: number = 0) => {
    const secInt = Math.max(1, Math.min(18, Math.ceil(remainingSec)));
    const nextKey = `${state}_${secInt}`;
    if (currentKey === nextKey) return;
    currentKey = nextKey;

    redMat.color.setHex(state === 'red' ? 0xef4444 : 0x3b0a0a);
    yellowMat.color.setHex(state === 'yellow' ? 0xfacc15 : 0x3b2506);
    greenMat.color.setHex(state === 'green' ? 0x22c55e : 0x052e16);

    const sharedMat = getSharedTimerMaterial(state, secInt);
    timerMaterials[4] = sharedMat;
    timerMaterials[5] = sharedMat;
  };

  return group;
}

/**
 * Articulated 3D Urban Pedestrian with swinging arms, legs & scream speech bubble
 */
export interface PedestrianGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  screamSprite: THREE.Sprite;
}

let sharedScreamTex: THREE.CanvasTexture | null = null;
function getScreamBubbleTexture(): THREE.CanvasTexture {
  if (sharedScreamTex) return sharedScreamTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 68, 18);
  ctx.fill();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 68, 18);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('😱 AAAHH! CUIDADO!', 128, 38);

  sharedScreamTex = new THREE.CanvasTexture(canvas);
  sharedScreamTex.colorSpace = THREE.SRGBColorSpace;
  return sharedScreamTex;
}

export function createPedestrian(
  shirtColor: number,
  pantsColor: number,
  skinColor: number,
  hasAccessory: boolean = false,
  isLow: boolean = false
): PedestrianGroup {
  const ped = new THREE.Group() as PedestrianGroup;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: shirtColor % 2 === 0 ? 0x1c1917 : 0x451a03,
    roughness: 0.85,
  });

  // Ground shadow disc (Disabled in extreme low)
  if (!isLow) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 12),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    ped.add(shadow);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirtMat);
  torso.position.y = 1.04;
  torso.castShadow = !isLow;
  ped.add(torso);

  // Head + Hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, isLow ? 7 : 12, isLow ? 5 : 10), skinMat);
  head.position.y = 1.48;
  head.castShadow = !isLow;
  ped.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, isLow ? 7 : 12, isLow ? 4 : 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hair.position.y = 1.5;
  hair.rotation.x = -0.15;
  ped.add(hair);

  // Optional Backpack or Shopping Bag (Only in high quality)
  if (hasAccessory && !isLow) {
    const packMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), packMat);
    pack.position.set(0, 1.06, -0.18);
    ped.add(pack);
  }

  // Left & Right Arms (pivoted at shoulder y = 1.26)
  const createArm = (side: number) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.27, 1.26, 0);
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), shirtMat);
    upperArm.position.y = -0.2;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, isLow ? 5 : 8, isLow ? 4 : 8), skinMat);
    hand.position.y = -0.44;
    armGroup.add(upperArm, hand);
    return armGroup;
  };

  ped.leftArm = createArm(1);
  ped.rightArm = createArm(-1);
  ped.add(ped.leftArm, ped.rightArm);

  // Left & Right Legs (pivoted at hip y = 0.76)
  const createLeg = (side: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.11, 0.76, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.68, 0.16), pantsMat);
    legMesh.position.y = -0.34;
    legMesh.castShadow = !isLow;
    const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.24), shoeMat);
    shoeMesh.position.set(0, -0.71, 0.04);
    legGroup.add(legMesh, shoeMesh);
    return legGroup;
  };

  ped.leftLeg = createLeg(1);
  ped.rightLeg = createLeg(-1);
  ped.add(ped.leftLeg, ped.rightLeg);

  // Overhead Scream Speech Bubble ("😱 AAAHH! CUIDADO!")
  const screamMat = new THREE.SpriteMaterial({
    map: getScreamBubbleTexture(),
    depthTest: false,
  });
  const screamSprite = new THREE.Sprite(screamMat);
  screamSprite.scale.set(2.3, 0.72, 1);
  screamSprite.position.set(0, 2.25, 0);
  screamSprite.visible = false;
  ped.add(screamSprite);
  ped.screamSprite = screamSprite;

  return ped;
}

export function createTauntBubbleTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 84;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 352, 74, 20);
  ctx.fill();

  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(4, 4, 352, 74, 20);
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 180, 41);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface OnFootMotoboyGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  helmetMesh: THREE.Mesh;
}

export function createOnFootMotoboy(helmetColor: string): OnFootMotoboyGroup {
  const player = new THREE.Group() as OnFootMotoboyGroup;

  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.8 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });

  // Ground shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 14),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  player.add(shadow);

  // Torso + Neon Safety Stripe
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.26), jacketMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  player.add(torso);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.08, 0.27),
    new THREE.MeshBasicMaterial({ color: 0xa3e635 })
  );
  stripe.position.y = 1.1;
  player.add(stripe);

  // Helmet + Visor
  const helmetMat = new THREE.MeshStandardMaterial({
    color: helmetColor,
    roughness: 0.18,
    metalness: 0.55,
  });
  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16), helmetMat);
  helmetMesh.position.y = 1.54;
  helmetMesh.castShadow = true;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.11, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1, metalness: 0.9 })
  );
  visor.position.set(0, 0, 0.14);
  helmetMesh.add(visor);
  player.add(helmetMesh);
  player.helmetMesh = helmetMesh;

  // Articulated Arms
  const makeArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.28, 1.28, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), jacketMat);
    arm.position.y = -0.2;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), gloveMat);
    glove.position.y = -0.44;
    g.add(arm, glove);
    return g;
  };
  player.leftArm = makeArm(1);
  player.rightArm = makeArm(-1);
  player.add(player.leftArm, player.rightArm);

  // Articulated Legs
  const makeLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.12, 0.76, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.17), jeansMat);
    leg.position.y = -0.34;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.25), bootMat);
    boot.position.set(0, -0.71, 0.04);
    g.add(leg, boot);
    return g;
  };
  player.leftLeg = makeLeg(1);
  player.rightLeg = makeLeg(-1);
  player.add(player.leftLeg, player.rightLeg);

  return player;
}

export interface OverheadHealthBar {
  sprite: THREE.Sprite;
  update: (label: string, hpPct: number, borderColor?: string) => void;
}

/**
 * Creates a 3D overhead nameplate + health bar ("Barra de Life") for any character in the game
 */
export function createCharacterHealthBar(
  initialLabel: string,
  initialHpPct: number = 100,
  defaultBorderColor: string = '#10b981'
): OverheadHealthBar {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 84;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  sprite.scale.set(2.5, 0.66, 1);

  let lastKey = '';

  const update = (label: string, hpPct: number, borderColor: string = defaultBorderColor) => {
    const clampedHp = Math.max(0, Math.min(100, Math.round(hpPct)));
    const key = `${label}_${clampedHp}_${borderColor}`;
    if (key === lastKey) return;
    lastKey = key;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 84);

    // Dark badge pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(6, 4, 308, 76, 16);
    ctx.fill();

    ctx.strokeStyle = clampedHp <= 0 ? '#ef4444' : borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(6, 4, 308, 76, 16);
    ctx.stroke();

    // Top text label
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clampedHp <= 0 ? `💀 NOCAUTE • ${label}` : label, 160, 26);

    // Health bar track
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(22, 46, 276, 22, 9);
    ctx.fill();

    // Health bar fill
    const barColor =
      clampedHp > 60 ? '#10b981' : clampedHp > 30 ? '#f59e0b' : '#ef4444';
    if (clampedHp > 0) {
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(24, 48, Math.max(12, (272 * clampedHp) / 100), 18, 7);
      ctx.fill();
    }

    // HP % readout inside bar
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px monospace';
    ctx.fillText(`❤️ LIFE ${clampedHp}%`, 160, 57);

    tex.needsUpdate = true;
  };

  update(initialLabel, initialHpPct, defaultBorderColor);
  return { sprite, update };
}

export interface ArmedBanditGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  muzzleFlash: THREE.Mesh;
  alertSprite: THREE.Sprite;
  updateOverheadHud: (label: string, hpPct: number) => void;
}

export function createArmedBandit(): ArmedBanditGroup {
  const bandit = new THREE.Group() as ArmedBanditGroup;

  const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.75 });
  const redTrimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
  const cargoPantsMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.65 });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Ground shadow + red danger ring
  const dangerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.62, 20),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })
  );
  dangerRing.rotation.x = -Math.PI / 2;
  dangerRing.position.y = 0.03;
  bandit.add(dangerRing);

  // Torso (Dark Hoodie with red chest stripe)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.58, 0.26), hoodieMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  bandit.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.27), redTrimMat);
  chestStripe.position.y = 1.14;
  bandit.add(chestStripe);

  // Head + Black Bandit Bandana Mask + Red Cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat);
  head.position.y = 1.49;
  bandit.add(head);

  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.28), hoodieMat);
  mask.position.set(0, 1.44, 0.04);
  bandit.add(mask);

  const capCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    redTrimMat
  );
  capCrown.position.y = 1.52;
  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.18), redTrimMat);
  capVisor.position.set(0, 1.53, 0.15);
  bandit.add(capCrown, capVisor);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(0.28, 1.28, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), hoodieMat);
  lUpper.position.y = -0.2;
  leftArm.add(lUpper);
  bandit.leftArm = leftArm;
  bandit.add(leftArm);

  // Right Arm (Extended aiming a 3D Pistol forward!)
  const rightArm = new THREE.Group();
  rightArm.position.set(-0.28, 1.28, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), hoodieMat);
  rUpper.position.y = -0.2;
  rightArm.add(rUpper);

  // 3D Pistol attached to Right Hand
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, -0.44, 0.12);
  gunGroup.rotation.x = Math.PI / 2;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), gunMetalMat);
  barrel.position.set(0, 0.04, 0.08);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.08), gunMetalMat);
  grip.position.set(0, -0.05, -0.02);
  gunGroup.add(barrel, grip);

  // Muzzle Flash Sphere
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
    })
  );
  muzzleFlash.position.set(0, 0.04, 0.26);
  gunGroup.add(muzzleFlash);
  bandit.muzzleFlash = muzzleFlash;

  rightArm.add(gunGroup);
  rightArm.rotation.x = -Math.PI / 2.2; // Aiming gun forward
  bandit.rightArm = rightArm;
  bandit.add(rightArm);

  // Legs
  const makeLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.12, 0.76, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.17), cargoPantsMat);
    leg.position.y = -0.34;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.24), redTrimMat);
    shoe.position.set(0, -0.71, 0.04);
    g.add(leg, shoe);
    return g;
  };
  bandit.leftLeg = makeLeg(1);
  bandit.rightLeg = makeLeg(-1);
  bandit.add(bandit.leftLeg, bandit.rightLeg);

  // Overhead Alert + Health Bar Sprite ("🔫 LADRÃO DE MOTO!")
  const overhead = createCharacterHealthBar('🔫 LADRÃO DE MOTO', 100, '#f87171');
  overhead.sprite.position.set(0, 2.3, 0);
  bandit.add(overhead.sprite);
  bandit.alertSprite = overhead.sprite;
  bandit.updateOverheadHud = (label: string, hpPct: number) => {
    overhead.update(label, hpPct, '#f87171');
  };

  return bandit;
}

export interface TrafficGuardGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  batonMat: THREE.MeshStandardMaterial;
  updateOverheadHud: (label: string, hpPct: number, borderColor?: string) => void;
}

/**
 * Creates a 3D Brazilian Traffic Guard (Guarda de Trânsito / Agente CET) with
 * neon-lime reflective vest, silver stripes, white peaked cap, and glowing red traffic baton.
 */
export function createTrafficGuard(): TrafficGuardGroup {
  const guard = new THREE.Group() as TrafficGuardGroup;

  const vestMat = new THREE.MeshStandardMaterial({
    color: 0xa3e635,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.25,
    roughness: 0.45,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe2e8f0,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.6,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b66, roughness: 0.65 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3 });

  // Ground authority ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 20),
    new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  guard.add(ring);

  // Torso (High-visibility neon-lime vest + reflective silver bands)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.26), vestMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  guard.add(torso);

  const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.27), stripeMat);
  band1.position.y = 0.94;
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.27), stripeMat);
  band2.position.y = 1.12;
  guard.add(band1, band2);

  // Head + White Traffic Officer Peaked Cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat);
  head.position.y = 1.49;
  guard.add(head);

  const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.11, 14), capMat);
  capCrown.position.y = 1.62;
  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), visorMat);
  capVisor.position.set(0, 1.56, 0.14);
  guard.add(capCrown, capVisor);

  // Left Arm (Whistle / Stop hand signal)
  const leftArm = new THREE.Group();
  leftArm.position.set(0.28, 1.28, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), vestMat);
  lUpper.position.y = -0.2;
  leftArm.add(lUpper);
  guard.leftArm = leftArm;
  guard.add(leftArm);

  // Right Arm (Holding luminous LED Traffic Baton!)
  const rightArm = new THREE.Group();
  rightArm.position.set(-0.28, 1.28, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.45, 0.13), vestMat);
  rUpper.position.y = -0.2;
  rightArm.add(rUpper);

  const batonMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  guard.batonMat = batonMat;
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), batonMat);
  baton.position.set(0, -0.45, 0.16);
  baton.rotation.x = Math.PI / 2.2;
  rightArm.add(baton);
  guard.rightArm = rightArm;
  guard.add(rightArm);

  // Legs
  const makeLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.12, 0.76, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.17), pantsMat);
    leg.position.y = -0.34;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.24), visorMat);
    shoe.position.set(0, -0.71, 0.04);
    g.add(leg, shoe);
    return g;
  };
  guard.leftLeg = makeLeg(1);
  guard.rightLeg = makeLeg(-1);
  guard.add(guard.leftLeg, guard.rightLeg);

  const overhead = createCharacterHealthBar('👮 GUARDA DE TRÂNSITO', 100, '#a3e635');
  overhead.sprite.position.set(0, 2.35, 0);
  guard.add(overhead.sprite);
  guard.updateOverheadHud = (label: string, hpPct: number, borderColor = '#a3e635') => {
    overhead.update(label, hpPct, borderColor);
  };

  return guard;
}

export interface PoliceOfficerGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  updateOverheadHud: (label: string, hpPct: number, borderColor?: string) => void;
}

/**
 * Creates a 3D Tactical Police Officer (Policial Militar) who disembarks from the Police Cruiser
 * to chase and arrest the player on foot when the police cruiser catches up!
 */
export function createPoliceOfficer(): PoliceOfficerGroup {
  const officer = new THREE.Group() as PoliceOfficerGroup;

  const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.5,
    metalness: 0.3,
  });
  const badgeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.2,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.65 });
  const redBlueRingMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.62, 20), redBlueRingMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  officer.add(ring);

  // Torso + Tactical Ballistic Vest + Gold Police Shield
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.58, 0.26), uniformMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  officer.add(torso);

  const tacticalVest = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.44, 0.29), vestMat);
  tacticalVest.position.y = 1.08;
  officer.add(tacticalVest);

  const shieldBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.31), badgeGoldMat);
  shieldBadge.position.set(0.11, 1.16, 0);
  officer.add(shieldBadge);

  // Head + Tactical Beret / Police Cap
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat);
  head.position.y = 1.49;
  officer.add(head);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.1, 12), vestMat);
  cap.position.y = 1.61;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), vestMat);
  visor.position.set(0, 1.55, 0.14);
  officer.add(cap, visor);

  // Left & Right Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(0.28, 1.28, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), uniformMat);
  lUpper.position.y = -0.2;
  leftArm.add(lUpper);
  officer.leftArm = leftArm;
  officer.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(-0.28, 1.28, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), uniformMat);
  rUpper.position.y = -0.2;
  rightArm.add(rUpper);

  // Tactical Tonfa / Handcuffs in right hand
  const tonfa = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 8), vestMat);
  tonfa.position.set(0, -0.42, 0.12);
  tonfa.rotation.x = Math.PI / 2;
  rightArm.add(tonfa);
  officer.rightArm = rightArm;
  officer.add(rightArm);

  // Legs
  const makeLeg = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.12, 0.76, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.17), uniformMat);
    leg.position.y = -0.34;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.25), vestMat);
    boot.position.set(0, -0.7, 0.04);
    g.add(leg, boot);
    return g;
  };
  officer.leftLeg = makeLeg(1);
  officer.rightLeg = makeLeg(-1);
  officer.add(officer.leftLeg, officer.rightLeg);

  const overhead = createCharacterHealthBar('🚓 POLICIAL: "PARADO!"', 100, '#3b82f6');
  overhead.sprite.position.set(0, 2.35, 0);
  officer.add(overhead.sprite);
  officer.updateOverheadHud = (label: string, hpPct: number, borderColor = '#3b82f6') => {
    overhead.update(label, hpPct, borderColor);
  };

  return officer;
}



