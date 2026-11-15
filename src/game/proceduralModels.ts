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

  // Storm drain grates along curb gutters (Bocas de Lobo / Grelhas de Drenagem)
  for (let y = 180 * scale; y < height; y += 340 * scale) {
    const gxL = 29 * scale;
    const gxR = width - 45 * scale;
    const gw = 16 * scale;
    const gh = 34 * scale;
    [gxL, gxR].forEach(gx => {
      aCtx.fillStyle = '#090d16';
      aCtx.fillRect(gx, y, gw, gh);
      aCtx.strokeStyle = '#475569';
      aCtx.lineWidth = 1.5 * scale;
      aCtx.strokeRect(gx, y, gw, gh);
      for (let bar = y + 5 * scale; bar < y + gh - 2 * scale; bar += 5 * scale) {
        aCtx.beginPath();
        aCtx.moveTo(gx + 2 * scale, bar);
        aCtx.lineTo(gx + gw - 2 * scale, bar);
        aCtx.stroke();
      }
      bCtx.fillStyle = '#303030';
      bCtx.fillRect(gx, y, gw, gh);
    });
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
 * Authentic Brazilian Interlocking Flagstone / Paver Tile Floor (Piso de Lajota / Bloquete)
 * Warm architectural stone & concrete pavers with beveled edges and zero moiré striping.
 */
export function createSidewalkTexture(isLow: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = isLow ? 512 : 1024;
  canvas.height = isLow ? 512 : 1024;
  const ctx = canvas.getContext('2d')!;
  const scale = isLow ? 0.5 : 1.0;

  // Warm mortar / grout base
  ctx.fillStyle = '#78716c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Interlocking running-bond flagstone pavers (Lajotas 128x128 & 256x128)
  const rows = 8;
  const cols = 8;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  const palette = [
    '#d6d3d1', // Warm stone
    '#cbd5e1', // Light slate lajota
    '#e7e5e4', // Sandstone cream
    '#c7d2fe', // Subtle cool granite tint
    '#d4d4d8', // Urban concrete paver
    '#fed7aa', // Subtle warm terracotta-buff lajota
  ];

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cellW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cellW + offset;
      const y = r * cellH;
      const pad = 3 * scale;
      const tone = palette[(r * 5 + (c + 8) * 3) % palette.length];

      const grad = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      grad.addColorStop(0, tone);
      grad.addColorStop(1, '#a8a29e');
      ctx.fillStyle = grad;
      ctx.fillRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);

      // Subtle top-left bevel highlight on each lajota
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5 * scale;
      ctx.strokeRect(x + pad + 1, y + pad + 1, cellW - pad * 2 - 2, cellH - pad * 2 - 2);
    }
  }

  // Natural mineral speckle & weathering
  const grainCount = isLow ? 2500 : 7000;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const isLight = Math.random() > 0.5;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.16)' : 'rgba(41, 37, 36, 0.14)';
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

/**
 * Decorative Terracotta & Sandstone Flagstone Floor (Piso de Lajota Colonial / Calçamento de Praça)
 * Used in commercial blocks, residential courtyards, and urban plazas.
 */
export function createLajotaFloorTexture(isLow: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = isLow ? 512 : 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const scale = isLow ? 0.5 : 1.0;

  // Deep cement mortar bed
  ctx.fillStyle = '#57534e';
  ctx.fillRect(0, 0, size, size);

  const grid = 8;
  const tile = size / grid;
  const lajotaColors = [
    '#c2410c', // Terracotta red-orange
    '#b45309', // Warm ochre clay
    '#d97706', // Golden baked clay
    '#9a3412', // Deep kiln brick
    '#d6d3d1', // Contrast sandstone inset
  ];

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const x = c * tile;
      const y = r * tile;
      const pad = 4 * scale;
      const isAccent = (r + c) % 4 === 0;
      const baseColor = isAccent ? '#e7e5e4' : lajotaColors[(r * 3 + c * 7) % 4];

      const grad = ctx.createLinearGradient(x, y, x + tile, y + tile);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(1, isAccent ? '#cbd5e1' : '#7c2d12');
      ctx.fillStyle = grad;
      ctx.fillRect(x + pad, y + pad, tile - pad * 2, tile - pad * 2);

      // Inner bevel groove on each lajota
      ctx.strokeStyle = 'rgba(255, 247, 237, 0.28)';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(x + pad + 4 * scale, y + pad + 4 * scale, tile - (pad + 4 * scale) * 2, tile - (pad + 4 * scale) * 2);
    }
  }

  // Ceramic / stone surface texture grain
  const specks = isLow ? 2500 : 6500;
  for (let i = 0; i < specks; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(28,25,23,0.16)';
    ctx.fillRect(x, y, 2 * scale, 2 * scale);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Realistic Compacted Earth, Red Clay & Gravel Floor (Piso de Terra Batida / Cascalho)
 * Used in Favela / Morro do Sol, rural Farm Ranches, and off-road shortcuts.
 */
export function createDirtFloorTexture(isLow: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = isLow ? 512 : 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const scale = isLow ? 0.5 : 1.0;

  // Base Brazilian "Terra Vermelha / Terra Batida" ochre-brown soil
  const baseGrad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
  baseGrad.addColorStop(0, '#9a5b32');
  baseGrad.addColorStop(0.5, '#854d27');
  baseGrad.addColorStop(1, '#713f1e');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Organic soil patches (damp clay, dry dust, and subtle scrub moss patches)
  for (let i = 0; i < (isLow ? 28 : 55); i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const pr = (Math.random() * 90 + 35) * scale;
    const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    const rand = Math.random();
    if (rand < 0.45) {
      // Dry golden dust patch
      pGrad.addColorStop(0, 'rgba(180, 118, 66, 0.45)');
      pGrad.addColorStop(1, 'rgba(180, 118, 66, 0)');
    } else if (rand < 0.82) {
      // Darker compacted clay
      pGrad.addColorStop(0, 'rgba(78, 42, 20, 0.48)');
      pGrad.addColorStop(1, 'rgba(78, 42, 20, 0)');
    } else {
      // Subtle wild grass / moss tuft on dirt
      pGrad.addColorStop(0, 'rgba(63, 98, 18, 0.38)');
      pGrad.addColorStop(1, 'rgba(63, 98, 18, 0)');
    }
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle motorcycle / tire ruts in the dirt
  ctx.strokeStyle = 'rgba(59, 31, 14, 0.35)';
  ctx.lineWidth = 10 * scale;
  for (let t = 0; t < 4; t++) {
    ctx.beginPath();
    const startX = (140 + t * 220) * scale;
    for (let y = 0; y <= size; y += 32 * scale) {
      const wx = startX + Math.sin(y * 0.015 + t) * 18 * scale;
      if (y === 0) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }

  // Scattered gravel stones, pebbles & coarse sand grains
  const pebbleCount = isLow ? 3500 : 10000;
  for (let i = 0; i < pebbleCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = (Math.random() * 2.8 + 0.8) * scale;
    const shade = Math.random();
    if (shade < 0.35) {
      ctx.fillStyle = '#d6c7b2'; // Light quartz pebble
    } else if (shade < 0.7) {
      ctx.fillStyle = '#5c3419'; // Dark earth clod
    } else {
      ctx.fillStyle = '#b87d4b'; // Ochre grain
    }
    ctx.fillRect(x, y, r, r);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Golden Coastal Beach Sand Texture (Piso de Areia de Praia / Dunas)
 * Features wind-sculpted ripples, quartz sparkle, and shells/pebbles.
 */
export function createSandFloorTexture(isLow: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = isLow ? 512 : 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const scale = isLow ? 0.5 : 1.0;

  // Warm golden Brazilian beach sand gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.5, '#fde047');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft wind-blown sand dune ripples
  for (let y = 0; y < size; y += 20 * scale) {
    ctx.strokeStyle = 'rgba(180, 110, 12, 0.22)';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 24 * scale) {
      const wy = y + Math.sin(x * 0.025 + y * 0.05) * 5 * scale;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 251, 235, 0.35)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 24 * scale) {
      const wy = y + 3 * scale + Math.sin(x * 0.025 + y * 0.05) * 5 * scale;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  // Fine quartz sand sparkle & tiny seashell flecks
  const grainCount = isLow ? 3500 : 9500;
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.45 ? 'rgba(255, 255, 255, 0.42)' : 'rgba(161, 98, 7, 0.26)';
    ctx.fillRect(x, y, 2 * scale, 2 * scale);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

export function createBuildingWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Architectural concrete & dark anodized aluminum frame
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Horizontal concrete floor slabs / spandrel bands across entire 1024x1024 atlas
  for (let y = 0; y < 1024; y += 64) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, 1024, 12);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, y, 1024, 3);
  }

  // Office & apartment glass windows with interior depth, blinds, sky reflections & split AC units
  for (let y = 18; y < 1008; y += 64) {
    for (let x = 16; x < 1000; x += 56) {
      const rand = Math.random();
      if (rand < 0.28) {
        // Warm illuminated night window with ceiling light gradient
        const grad = ctx.createLinearGradient(x, y, x, y + 42);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = grad;
      } else if (rand < 0.5) {
        // Cool daylight sky reflection glass
        const grad = ctx.createLinearGradient(x, y, x + 44, y + 42);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
      } else if (rand < 0.68) {
        // Emerald / cyan modern studio glow
        ctx.fillStyle = '#334155';
      } else {
        // Dark tinted glass
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillRect(x, y, 44, 42);

      // Venetian blinds / curtain detail on lit windows
      if (rand < 0.28 && Math.random() < 0.45) {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.28)';
        for (let by = y + 4; by < y + 24; by += 5) {
          ctx.fillRect(x + 2, by, 40, 2);
        }
      }

      // Window frame mullion highlight
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, 44, 42);

      // Exterior Split Air-Conditioner condenser unit under ~22% of windows
      if (((x + y) % 5 === 0) && x + 52 < 1018) {
        const acX = x + 28;
        const acY = y + 32;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(acX, acY, 18, 12);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(acX + 6, acY + 6, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(acX, acY, 18, 12);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates a glowing signboard texture for Hamburguerias, Pizzarias, Padarias, Farmácias, Mercados, etc.
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
 * Builds a complete 3D Storefront (Pizzaria, Padaria, Farmácia, Mercado, Hamburgueria, Sushi, Açaí)
 * with striped awning, glowing windows, rooftop water tank (caixa d'água), split AC unit, and 3D rooftop sign!
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
    roughness: 0.52,
    metalness: 0.16,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: point.accentColor,
    roughness: 0.32,
    metalness: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
  });
  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.8,
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

  // Rooftop Blue Water Tank (Caixa d'Água Azul) + Exterior AC Split Unit
  if (!isLow) {
    const waterTankMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38, metalness: 0.15 });
    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.82, 1.15, 12), waterTankMat);
    waterTank.position.set(-2.8, 7.1, -1.9);
    const tankLid = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 0.98, 0.14, 12), waterTankMat);
    tankLid.position.set(-2.8, 7.72, -1.9);
    const acBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.62, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.3 })
    );
    acBox.position.set(3.4, 4.1, 3.88);
    building.add(waterTank, tankLid, acBox);
  }

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

  // 3D Rooftop Thematic Prop (Burger, Pizza, Açaí, Sushi, Padaria, Farmácia, Mercado)
  const lowerName = (point.name + ' ' + point.shortSign + ' ' + point.categoryLabel).toLowerCase();
  if (lowerName.includes('farm') || lowerName.includes('drog')) {
    const crossGroup = new THREE.Group();
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.4, 0.45), crossMat);
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.45), crossMat);
    crossGroup.add(vBar, hBar);
    crossGroup.position.set(0, 7.9, 0);
    building.add(crossGroup);
  } else if (lowerName.includes('padaria') || lowerName.includes('pão') || lowerName.includes('confeitaria')) {
    const breadGroup = new THREE.Group();
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    const loaf = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10), crustMat);
    loaf.scale.set(1.5, 0.75, 0.9);
    breadGroup.add(loaf);
    breadGroup.position.set(0, 7.4, 0);
    building.add(breadGroup);
  } else if (point.category === 'hamburgueria' || point.category === 'lanchonete') {
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

  // Reflective safety stripes on baú / mochila térmica
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(14, 18, 228, 14);
  ctx.fillStyle = '#ef4444';
  for (let x = 14; x < 242; x += 36) {
    ctx.fillRect(x, 18, 18, 14);
  }

  // Emerald & Orange stylized brand badge
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.arc(128, 94, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', 128, 96);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 236);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = '900 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 162);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let _sharedTireTreadTex: THREE.CanvasTexture | null = null;
export function createTireTreadTexture(): THREE.CanvasTexture {
  if (_sharedTireTreadTex) return _sharedTireTreadTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#12151a';
  ctx.fillRect(0, 0, 128, 256);

  // Center circumferential drainage grooves
  ctx.fillStyle = '#07090c';
  ctx.fillRect(54, 0, 6, 256);
  ctx.fillRect(68, 0, 6, 256);

  // Diagonal V-shaped sporty motorcycle tire tread grooves
  ctx.strokeStyle = '#242933';
  ctx.lineWidth = 6;
  for (let y = 0; y < 256; y += 24) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(14, y + 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(68, y + 12);
    ctx.lineTo(114, y + 28);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  _sharedTireTreadTex = tex;
  return tex;
}

const _decalTexCache = new Map<string, THREE.CanvasTexture>();
export function createBikeDecalTexture(style: BikeCustomization['decalStyle'] = 'none'): THREE.CanvasTexture {
  const key = style || 'none';
  if (_decalTexCache.has(key)) return _decalTexCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);

  if (key === 'flame_orange') {
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.6, '#facc15');
    grad.addColorStop(1, 'rgba(249,115,22,0)');
    ctx.fillStyle = grad;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(10, 20 + i * 24);
      ctx.quadraticCurveTo(130, 8 + i * 24, 235 - i * 20, 32 + i * 24);
      ctx.lineTo(10, 38 + i * 24);
      ctx.closePath();
      ctx.fill();
    }
  } else if (key === 'emerald_stripe') {
    ctx.fillStyle = '#10b981';
    ctx.fillRect(12, 26, 232, 22);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(12, 56, 232, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px sans-serif';
    ctx.fillText('244 PRO', 120, 98);
  } else if (key === 'grau_king') {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, 224, 96);
    ctx.fillRect(20, 20, 216, 88);
    ctx.fillStyle = '#090d16';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑 GRAU 244', 128, 64);
  } else if (key === 'carbon_pro') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10, 14, 236, 100);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    for (let x = -128; x < 256; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 128, 128);
      ctx.stroke();
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 16, 232, 96);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _decalTexCache.set(key, tex);
  return tex;
}

export function populateHelmetStyleExtras(
  group: THREE.Group,
  style: BikeCustomization['helmetStyle'] = 'street',
  helmetColor: string = '#111827'
) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.2, metalness: 0.6 });
  const neonTrimMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

  if (style === 'modular') {
    // Flip-up modular chin bar + top air vent
    const chinBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.14), darkMat);
    chinBar.position.set(0, -0.08, 0.11);
    const topVent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.14), neonTrimMat);
    topVent.position.set(0, 0.17, 0.02);
    group.add(chinBar, topVent);
  } else if (style === 'cross') {
    // Motocross / Trilha extended sun peak + chin guard
    const sunPeak = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), accentMat);
    sunPeak.position.set(0, 0.11, 0.14);
    sunPeak.rotation.x = -0.18;
    const crossChin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), darkMat);
    crossChin.position.set(0, -0.09, 0.14);
    group.add(sunPeak, crossChin);
  } else if (style === 'aeropro') {
    // Racing Aero Spoiler Wing + Orange/Emerald accent fin
    const aeroWing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), darkMat);
    aeroWing.position.set(0, 0.08, -0.14);
    aeroWing.rotation.x = 0.28;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    fin.position.set(0, 0.16, -0.04);
    group.add(aeroWing, fin);
  }
}

/**
 * Procedural Motorcycle Model with high-detail parts, mirrors, shock springs,
 * rider legs/boots, and dynamic nitro flame!
 */
export function getRiderOutfitColors(outfit?: string): {
  jacket: number;
  stripe: number;
  pants: number;
} {
  switch (outfit) {
    case 'neon_windbreaker':
      return { jacket: 0x059669, stripe: 0xfacc15, pants: 0x0f172a };
    case 'leather_pro':
      return { jacket: 0x991b1b, stripe: 0xf8fafc, pants: 0x18181b };
    case 'cyber_armor':
      return { jacket: 0x1e1b4b, stripe: 0x00f3ff, pants: 0x090d16 };
    case 'rain_suit':
      return { jacket: 0xca8a04, stripe: 0xe2e8f0, pants: 0x1e293b };
    case 'classic':
    default:
      return { jacket: 0x0f172a, stripe: 0x10b981, pants: 0x1d4ed8 };
  }
}

export interface MotorcycleGroup extends THREE.Group {
  frontFork: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  riderMesh: THREE.Group;
  riderTorso: THREE.Group;
  riderLeftLeg: THREE.Group;
  riderRightLeg: THREE.Group;
  riderLeftArm: THREE.Group;
  riderRightArm: THREE.Group;
  backpackMesh: THREE.Group;
  bodyMesh: THREE.Mesh;
  trunkMesh: THREE.Mesh;
  helmetMesh: THREE.Mesh;
  helmetExtrasGroup: THREE.Group;
  decalMat: THREE.MeshStandardMaterial;
  jacketMat: THREE.MeshStandardMaterial;
  stripeMat: THREE.MeshBasicMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  headlightLight: THREE.SpotLight;
  headlightLensMat: THREE.MeshStandardMaterial;
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
    roughness: 0.18,
    metalness: 0.78,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.12,
    metalness: 0.94,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.68,
  });

  const tireTreadTex = createTireTreadTexture();
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x181b20,
    map: tireTreadTex,
    bumpMap: tireTreadTex,
    bumpScale: 0.025,
    roughness: 0.82,
    metalness: 0.12,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbeb,
    emissiveIntensity: 1.15,
    roughness: 0.08,
  });
  root.headlightLensMat = glassMat;

  const redGlassMat = new THREE.MeshStandardMaterial({
    color: 0xff1122,
    emissive: 0xff0022,
    emissiveIntensity: 0.9,
    roughness: 0.18,
  });
  root.taillightMat = redGlassMat;

  // 1. MAIN FRAME & CHASSIS
  const frameGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8);
  frameGeo.rotateZ(Math.PI / 4);
  const frameMesh = new THREE.Mesh(frameGeo, darkMetalMat);
  frameMesh.position.set(0, 0.45, 0);
  frameMesh.castShadow = !isLow;
  root.add(frameMesh);

  // 2. SCULPTED FUEL TANK, SIDE FAIRINGS & DECAL OVERLAY
  const tankGeo = new THREE.BoxGeometry(0.37, 0.3, 0.68);
  const tankMesh = new THREE.Mesh(tankGeo, paintMat);
  tankMesh.position.set(0, 0.73, 0.16);
  tankMesh.castShadow = true;
  root.add(tankMesh);
  root.bodyMesh = tankMesh;

  // Tank Sticker / Decal Overlay
  const decalStyle = customization.decalStyle || 'none';
  const decalMat = new THREE.MeshStandardMaterial({
    map: createBikeDecalTexture(decalStyle),
    transparent: true,
    opacity: decalStyle === 'none' ? 0 : 0.95,
    roughness: 0.25,
    metalness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  root.decalMat = decalMat;
  const decalMesh = new THREE.Mesh(new THREE.BoxGeometry(0.382, 0.22, 0.56), decalMat);
  decalMesh.position.set(0, 0.74, 0.16);
  root.add(decalMesh);

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

  // 4. ERGONOMIC TWO-TIER SEAT
  const seatGeo = new THREE.BoxGeometry(0.31, 0.12, 0.72);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.82 });
  const seatMesh = new THREE.Mesh(seatGeo, seatMat);
  seatMesh.position.set(0, 0.69, -0.38);
  seatMesh.castShadow = true;
  root.add(seatMesh);

  // 5. EXHAUST SYSTEM (Header Pipe + Muffler + Heat Shield) & NITRO FLAME CONE
  const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.065, 1.12, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustMat =
    customization.exhaustType === 'sport' || customization.exhaustType === 'direto'
      ? new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.16, metalness: 0.94 })
      : chromeMat;
  const exhaustMesh = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustMesh.position.set(0.19, 0.3, -0.4);
  exhaustMesh.rotation.x = -0.15;
  exhaustMesh.castShadow = !isLow;
  root.add(exhaustMesh);

  // Exhaust collector bend from engine + perforated heat shield
  const headerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.42, 8), chromeMat);
  headerPipe.position.set(0.16, 0.33, 0.22);
  headerPipe.rotation.x = Math.PI / 3;
  root.add(headerPipe);
  root.exhaustTip = new THREE.Vector3(0.19, 0.26, -0.95);

  // Nitro Blue/Cyan Jet Flame at Exhaust Tip
  const flameGeo = new THREE.ConeGeometry(0.095, 0.68, 10);
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

  // 6. REAR WHEEL (6 Spokes + Ventilated Brake Disc + Treaded Tire), SWINGARM & SHOCK SPRINGS
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

  const wheelGeo = new THREE.TorusGeometry(0.32, 0.095, 14, 28);
  wheelGeo.rotateY(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const outerRimRingGeo = new THREE.TorusGeometry(0.235, 0.022, 8, 24);
  outerRimRingGeo.rotateY(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.055, 0.48, 0.032);
  const brakeDiscGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.018, 16);
  brakeDiscGeo.rotateZ(Math.PI / 2);

  const buildDetailedWheel = () => {
    const tire = new THREE.Mesh(wheelGeo, rubberMat);
    const hub = new THREE.Mesh(rimGeo, chromeMat);
    const alloyRim = new THREE.Mesh(outerRimRingGeo, chromeMat);
    const brakeDisc = new THREE.Mesh(brakeDiscGeo, chromeMat);
    brakeDisc.position.x = -0.065;
    tire.add(hub, alloyRim, brakeDisc);
    // 6-spoke star alloy wheel
    for (let s = 0; s < 3; s++) {
      const sp = new THREE.Mesh(spokeGeo, chromeMat);
      sp.rotation.x = (s * Math.PI) / 3;
      tire.add(sp);
    }
    return tire;
  };

  const rearTireMesh = buildDetailedWheel();
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

  // Rear-view mirrors with reflective glass lenses (retrovisores de motoboy)
  const mirrorStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6);
  const mirrorHeadGeo = new THREE.BoxGeometry(0.13, 0.075, 0.032);
  const mirrorGlassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    roughness: 0.04,
    metalness: 0.98,
  });
  const leftMirror = new THREE.Mesh(mirrorHeadGeo, darkMetalMat);
  leftMirror.position.set(-0.36, 0.56, 0.04);
  const leftMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), mirrorGlassMat);
  leftMirrorGlass.position.set(0, 0, -0.018);
  leftMirrorGlass.rotation.y = Math.PI;
  leftMirror.add(leftMirrorGlass);

  const rightMirror = new THREE.Mesh(mirrorHeadGeo, darkMetalMat);
  rightMirror.position.set(0.36, 0.56, 0.04);
  const rightMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), mirrorGlassMat);
  rightMirrorGlass.position.set(0, 0, -0.018);
  rightMirrorGlass.rotation.y = Math.PI;
  rightMirror.add(rightMirrorGlass);

  const leftStem = new THREE.Mesh(mirrorStemGeo, chromeMat);
  leftStem.position.set(-0.3, 0.49, 0.02);
  const rightStem = new THREE.Mesh(mirrorStemGeo, chromeMat);
  rightStem.position.set(0.3, 0.49, 0.02);
  frontForkGroup.add(leftMirror, rightMirror, leftStem, rightStem);

  // Grips + Hand Levers (Manetes de freio/embreagem)
  const gripGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.13, 8);
  gripGeo.rotateZ(Math.PI / 2);
  const leftGrip = new THREE.Mesh(gripGeo, rubberMat);
  leftGrip.position.set(-0.33, 0.42, 0);
  const rightGrip = new THREE.Mesh(gripGeo, rubberMat);
  rightGrip.position.set(0.33, 0.42, 0);
  frontForkGroup.add(leftGrip, rightGrip);

  // Headlight casing & glowing lens
  const headlightHousingGeo = new THREE.CylinderGeometry(0.115, 0.09, 0.16, 12);
  headlightHousingGeo.rotateX(Math.PI / 2);
  const headlightHousing = new THREE.Mesh(headlightHousingGeo, darkMetalMat);
  headlightHousing.position.set(0, 0.28, 0.1);
  const headlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.098, 16), glassMat);
  headlightLens.position.set(0, 0, 0.085);
  headlightHousing.add(headlightLens);
  frontForkGroup.add(headlightHousing);

  // Front Wheel (6 Spokes + Brake Disc + Treaded Tire)
  const frontTireMesh = buildDetailedWheel();
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
  const taillightGeo = new THREE.BoxGeometry(0.17, 0.065, 0.05);
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

  // 9. DELIVERY BAÚ (REAR TRUNK BOX)
  const trunkTexture = createTrunkLogoTexture(customization.trunkSkin);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: trunkTexture,
    roughness: 0.32,
    metalness: 0.22,
  });
  const trunkGeo = new THREE.BoxGeometry(0.48, 0.42, 0.46);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.position.set(0, 0.93, -0.78);
  trunkMesh.castShadow = true;
  root.add(trunkMesh);
  root.trunkMesh = trunkMesh;

  // 10. MOTOBOY RIDER (Proportional Torso, Jacket, Thermal Backpack with Logo, Helmet with Visor, Articulated Arms & Legs/Boots)
  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.65, -0.2);

  const outfitColors = getRiderOutfitColors(customization.riderOutfit);
  const torsoMat = new THREE.MeshStandardMaterial({ color: outfitColors.jacket, roughness: 0.72 });
  root.jacketMat = torsoMat;

  const stripeMat = new THREE.MeshBasicMaterial({ color: outfitColors.stripe });
  root.stripeMat = stripeMat;

  // Articulated Upper Body Pivot (for smooth torso lean in curves + thermal backpack sway)
  const riderTorso = new THREE.Group();
  riderTorso.position.set(0, 0.14, 0);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.24), torsoMat);
  torsoMesh.position.set(0, 0.26, 0);
  torsoMesh.rotation.x = 0.24;
  torsoMesh.castShadow = true;
  riderTorso.add(torsoMesh);

  // Collar + High-visibility neon safety stripe on jacket
  const safetyStripe = new THREE.Mesh(new THREE.BoxGeometry(0.395, 0.075, 0.255), stripeMat);
  safetyStripe.position.set(0, 0.3, 0);
  safetyStripe.rotation.x = 0.24;
  riderTorso.add(safetyStripe);

  // Thermal Delivery Backpack on Rider's Back (Mochila Térmica com Logo e Faixas Refletivas)
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.34, -0.2);
  backpackGroup.rotation.x = 0.22;
  const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.28), trunkMat);
  bagBody.castShadow = !isLow;
  const bagTopLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.06, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  bagTopLid.position.y = 0.21;
  const bagReflectiveStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.43, 0.045, 0.29),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  bagReflectiveStrip.position.y = -0.12;
  backpackGroup.add(bagBody, bagTopLid, bagReflectiveStrip);
  riderTorso.add(backpackGroup);
  root.backpackMesh = backpackGroup;

  // Helmet with Reflective Visor + Style Extras
  const helmetGeo = new THREE.SphereGeometry(0.185, 18, 18);
  const helmetMat = new THREE.MeshStandardMaterial({
    color: customization.helmetColor,
    roughness: 0.16,
    metalness: 0.58,
  });
  const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
  helmetMesh.position.set(0, 0.65, 0.1);
  helmetMesh.castShadow = true;

  // Curved Reflective Visor
  const visorGeo = new THREE.BoxGeometry(0.255, 0.105, 0.13);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.06,
    metalness: 0.95,
  });
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.0, 0.12);
  helmetMesh.add(visorMesh);

  const helmetExtrasGroup = new THREE.Group();
  populateHelmetStyleExtras(helmetExtrasGroup, customization.helmetStyle || 'street', customization.helmetColor);
  helmetMesh.add(helmetExtrasGroup);
  root.helmetExtrasGroup = helmetExtrasGroup;

  riderTorso.add(helmetMesh);
  root.helmetMesh = helmetMesh;

  // Articulated Arms & Gloves gripping handlebars
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55 });
  const buildRiderArm = (side: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.23, 0.42, 0.06);
    const armCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.46, 8), torsoMat);
    armCyl.rotation.x = Math.PI / 2.9;
    armCyl.position.set(0, -0.06, 0.16);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), gloveMat);
    glove.position.set(0, -0.16, 0.36);
    armPivot.add(armCyl, glove);
    return armPivot;
  };
  const leftArmGroup = buildRiderArm(-1);
  const rightArmGroup = buildRiderArm(1);
  riderTorso.add(leftArmGroup, rightArmGroup);
  root.riderLeftArm = leftArmGroup;
  root.riderRightArm = rightArmGroup;

  riderGroup.add(riderTorso);
  root.riderTorso = riderTorso;

  // Articulated Rider Jeans / Legs & Riding Boots (Left leg pivots down to the ground when stopped!)
  const jeansMat = new THREE.MeshStandardMaterial({ color: outfitColors.pants, roughness: 0.82 });
  root.pantsMat = jeansMat;
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.2 });
  const bootSoleMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 });

  const buildRiderLeg = (side: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.17, 0.12, 0.04);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.46, 8), jeansMat);
    thigh.position.set(0, -0.18, 0.06);
    thigh.rotation.x = -0.32;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.22), bootMat);
    boot.position.set(0, -0.4, 0.02);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.025, 0.225), bootSoleMat);
    sole.position.set(0, -0.46, 0.02);
    legPivot.add(thigh, boot, sole);
    return legPivot;
  };
  const leftLegGroup = buildRiderLeg(-1);
  const rightLegGroup = buildRiderLeg(1);
  riderGroup.add(leftLegGroup, rightLegGroup);
  root.riderLeftLeg = leftLegGroup;
  root.riderRightLeg = rightLegGroup;

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

export type VehicleArchetype = 'sedan' | 'suv' | 'pickup' | 'taxi' | 'van' | 'truck' | 'police' | 'bus';

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
 * Creates high-detail 3D traffic vehicles (Sedan, Taxi, SUV, Pickup, Delivery Van, Urban Box Truck, Police Cruiser, Urban Bus)
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
      : archetype === 'truck'
      ? 0xf8fafc
      : colorHex;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: effectiveColor,
    roughness: 0.2,
    metalness: 0.72,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.58,
    metalness: 0.35,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.14,
    metalness: 0.94,
  });

  // Reflective automotive glass with subtle sky-blue tint
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0x0284c7,
    emissiveIntensity: 0.14,
    roughness: 0.05,
    metalness: 0.96,
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
  const shadowGeo = new THREE.PlaneGeometry(2.2, archetype === 'truck' ? 5.2 : 4.4);
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
  const bodyHeight = archetype === 'suv' || archetype === 'van' || archetype === 'truck' ? 0.58 : 0.48;
  const chassisGeo = new THREE.BoxGeometry(1.74, bodyHeight, archetype === 'truck' ? 4.35 : 3.85);
  const chassisMesh = new THREE.Mesh(chassisGeo, archetype === 'truck' ? darkTrimMat : bodyMat);
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
  const halfLen = archetype === 'truck' ? 2.15 : 1.9;
  const bumperGeo = new THREE.BoxGeometry(1.82, 0.24, 0.22);
  const frontBumper = new THREE.Mesh(bumperGeo, darkTrimMat);
  frontBumper.position.set(0, 0.36, halfLen);
  const rearBumper = new THREE.Mesh(bumperGeo, darkTrimMat);
  rearBumper.position.set(0, 0.36, -halfLen);
  car.add(frontBumper, rearBumper);

  // Front Grille & Chrome Bar
  const grilleGeo = new THREE.BoxGeometry(0.95, 0.22, 0.06);
  const grilleMesh = new THREE.Mesh(grilleGeo, darkTrimMat);
  grilleMesh.position.set(0, 0.54, halfLen + 0.02);
  const grilleChrome = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.08), chromeMat);
  grilleChrome.position.set(0, 0.58, halfLen + 0.02);
  car.add(grilleMesh, grilleChrome);

  // Mercosul License Plates (Front & Rear)
  if (!_sharedPlateTex) _sharedPlateTex = createLicensePlateTexture();
  const plateMat = new THREE.MeshBasicMaterial({ map: _sharedPlateTex });
  const plateGeo = new THREE.PlaneGeometry(0.42, 0.15);
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(0, 0.35, halfLen + 0.12);
  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(0, 0.35, -halfLen - 0.12);
  rearPlate.rotation.y = Math.PI;
  car.add(frontPlate, rearPlate);

  // 3. Archetype-Specific Upper Cabin & Features
  if (archetype === 'truck') {
    // Urban Box Truck (Caminhão Baú VUC de Entregas)
    const cabMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.24, metalness: 0.65 });
    const cabBox = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.18, 1.25), cabMat);
    cabBox.position.set(0, 1.15, 1.48);
    cabBox.castShadow = !isLow;
    const truckWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.62, 0.12), glassMat);
    truckWindshield.position.set(0, 1.32, 2.08);
    // Aerodynamic wind deflector on cab roof
    const windDeflector = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.36, 0.65), cabMat);
    windDeflector.position.set(0, 1.85, 1.35);
    windDeflector.rotation.x = -0.28;

    // Large Corrugated Aluminum Cargo Box (Baú de Carga)
    const cargoBoxMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.4,
    });
    const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.72, 2.95), cargoBoxMat);
    cargoBox.position.set(0, 1.48, -0.68);
    cargoBox.castShadow = !isLow;

    // Emerald & Orange Logistics Livery Stripes on Cargo Box
    const stripeEmerald = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.2, 2.85),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    stripeEmerald.position.set(0, 1.55, -0.68);
    const stripeOrange = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.1, 2.85),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    stripeOrange.position.set(0, 1.36, -0.68);

    car.add(cabBox, truckWindshield, windDeflector, cargoBox, stripeEmerald, stripeOrange);
  } else if (archetype === 'van') {
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
  leftHead.position.set(-0.6, 0.56, halfLen + 0.02);
  const rightHead = new THREE.Mesh(headGeo, headMat);
  rightHead.position.set(0.6, 0.56, halfLen + 0.02);
  car.add(leftHead, rightHead);

  // 6. Rear Brake Lights & Lightbar (exposed in userData for dynamic braking glow)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1122,
    emissive: 0xff0022,
    emissiveIntensity: 0.75,
  });
  const tailGeo = new THREE.BoxGeometry(0.36, 0.14, 0.06);
  const leftTail = new THREE.Mesh(tailGeo, tailMat);
  leftTail.position.set(-0.58, 0.58, -halfLen - 0.02);
  const rightTail = new THREE.Mesh(tailGeo, tailMat);
  rightTail.position.set(0.58, 0.58, -halfLen - 0.02);
  const centerTailBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), tailMat);
  centerTailBar.position.set(0, 0.61, -halfLen - 0.02);
  car.add(leftTail, rightTail, centerTailBar);

  // 7. 4 Detailed Wheels with Tires + Alloy Rims
  const wheelRadius = archetype === 'suv' || archetype === 'pickup' || archetype === 'truck' ? 0.35 : 0.3;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, 0.25, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.26, wheelRadius * 1.1, 0.06);

  const wheelZ = archetype === 'truck' ? 1.38 : 1.18;
  const wheelPositions = [
    { x: -0.84, y: wheelRadius, z: wheelZ },
    { x: 0.84, y: wheelRadius, z: wheelZ },
    { x: -0.84, y: wheelRadius, z: -wheelZ },
    { x: 0.84, y: wheelRadius, z: -wheelZ },
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
  flBlinker.position.set(0.82, 0.56, halfLen + 0.01);
  const rlBlinker = new THREE.Mesh(blinkerGeo, blinkerLeftMat);
  rlBlinker.position.set(0.82, 0.58, -halfLen - 0.01);
  const frBlinker = new THREE.Mesh(blinkerGeo, blinkerRightMat);
  frBlinker.position.set(-0.82, 0.56, halfLen + 0.01);
  const rrBlinker = new THREE.Mesh(blinkerGeo, blinkerRightMat);
  rrBlinker.position.set(-0.82, 0.58, -halfLen - 0.01);
  car.add(flBlinker, rlBlinker, frBlinker, rrBlinker);

  // 8. Smart Driver Overhead Status Badge (Visible when reacting to player, turning, or honking!)
  const driverHud = createCharacterHealthBar('🚗 MOTORISTA ATENTO', 100, '#38bdf8');
  driverHud.sprite.position.set(0, archetype === 'truck' ? 2.55 : 2.15, 0);
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
 * Articulated 3D Urban Pedestrian & Customer with 12+ combinatorial variations
 * (height scale, clothing, skin tone, hairstyles/hats, and accessories)
 */
export interface PedestrianGroup extends THREE.Group {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  headGroup: THREE.Group;
  screamSprite: THREE.Sprite;
  baseScaleY: number;
  baseScaleXZ: number;
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
  isLow: boolean = false,
  variantIdx: number = 0
): PedestrianGroup {
  const ped = new THREE.Group() as PedestrianGroup;

  // Height & build variation across 12+ combinations
  const heightScales = [0.92, 0.97, 1.0, 1.04, 1.08, 0.95, 1.02, 1.06];
  const widthScales = [0.95, 1.0, 1.05, 0.98, 1.02, 1.08, 0.94, 1.0];
  ped.baseScaleY = heightScales[variantIdx % heightScales.length];
  ped.baseScaleXZ = widthScales[variantIdx % widthScales.length];
  ped.scale.set(ped.baseScaleXZ, ped.baseScaleY, ped.baseScaleXZ);

  const hairColors = [0x1c1917, 0x451a03, 0x78350f, 0xd97706, 0x090d16, 0x991b1b];
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.68 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.78 });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: variantIdx % 3 === 0 ? 0xf8fafc : 0x1e293b,
    roughness: 0.55,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColors[variantIdx % hairColors.length],
    roughness: 0.82,
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

  // Torso + subtle collar/belt accent
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirtMat);
  torso.position.y = 1.04;
  torso.castShadow = !isLow;
  ped.add(torso);

  // Articulated Head Group (can turn slightly when waiting at traffic lights or waving)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.48, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, isLow ? 7 : 12, isLow ? 5 : 10), skinMat);
  head.castShadow = !isLow;
  headGroup.add(head);

  // 4 Distinct Hairstyle / Cap Variations
  const hairStyle = variantIdx % 4;
  if (hairStyle === 0) {
    // Classic short hair dome
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, isLow ? 7 : 12, isLow ? 4 : 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hair.position.y = 0.02;
    hair.rotation.x = -0.15;
    headGroup.add(hair);
  } else if (hairStyle === 1) {
    // Voluminous curly afro / puff
    const afro = new THREE.Mesh(new THREE.SphereGeometry(0.215, isLow ? 7 : 10, isLow ? 5 : 8), hairMat);
    afro.position.set(0, 0.06, -0.02);
    headGroup.add(afro);
  } else if (hairStyle === 2) {
    // Urban Baseball Cap with front visor
    const capMat = new THREE.MeshStandardMaterial({
      color: variantIdx % 2 === 0 ? 0x10b981 : 0xf97316,
      roughness: 0.45,
    });
    const capCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.182, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      capMat
    );
    capCrown.position.y = 0.02;
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.16), capMat);
    capBrim.position.set(0, 0.03, 0.14);
    headGroup.add(capCrown, capBrim);
  } else {
    // Ponytail / Bun hairstyle
    const hairBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hairBase.position.y = 0.02;
    const ponytail = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), hairMat);
    ponytail.position.set(0, 0.02, -0.19);
    headGroup.add(hairBase, ponytail);
  }

  // Optional Sunglasses or Headphones on Head
  if (!isLow && (variantIdx % 5 === 1 || variantIdx % 5 === 3)) {
    const darkAccMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2, metalness: 0.8 });
    if (variantIdx % 2 === 0) {
      // Stylish Sunglasses
      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.05), darkAccMat);
      glasses.position.set(0, 0.01, 0.155);
      headGroup.add(glasses);
    } else {
      // Over-ear Headphones
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.09), darkAccMat);
      earL.position.set(-0.175, 0.0, 0);
      const earR = earL.clone();
      earR.position.x = 0.175;
      headGroup.add(earL, earR);
    }
  }

  ped.add(headGroup);
  ped.headGroup = headGroup;

  // Optional Backpack on back (when hasAccessory or even variant)
  if ((hasAccessory || variantIdx % 4 === 0) && !isLow) {
    const packMat = new THREE.MeshStandardMaterial({
      color: variantIdx % 2 === 0 ? 0xf97316 : 0x10b981,
      roughness: 0.5,
    });
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

    // Optional Shopping Bag in left hand for shoppers
    if (!isLow && side === 1 && variantIdx % 5 === 2) {
      const bagMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
      const shopBag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.22), bagMat);
      shopBag.position.set(0.05, -0.56, 0);
      armGroup.add(shopBag);
    }
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
  torsoGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  helmetMesh: THREE.Mesh;
  backpackMesh: THREE.Group;
  deliveryPackageMesh: THREE.Group;
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

  // Upper Body Torso Group (leans forward when running vs walking)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.76, 0);

  // Torso + Neon Safety Stripe
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.26), jacketMat);
  torso.position.y = 0.29;
  torso.castShadow = true;
  torsoGroup.add(torso);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.08, 0.27),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  stripe.position.y = 0.34;
  torsoGroup.add(stripe);

  // Thermal Delivery Backpack on Rider's Back in "A PÉ" mode
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.32, -0.24);
  const bagMat = new THREE.MeshStandardMaterial({
    map: createTrunkLogoTexture('ifood'),
    roughness: 0.35,
  });
  const bagBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.26), bagMat);
  bagBox.castShadow = true;
  backpackGroup.add(bagBox);
  torsoGroup.add(backpackGroup);
  player.backpackMesh = backpackGroup;

  // Helmet + Visor
  const helmetMat = new THREE.MeshStandardMaterial({
    color: helmetColor,
    roughness: 0.18,
    metalness: 0.55,
  });
  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16), helmetMat);
  helmetMesh.position.y = 0.78;
  helmetMesh.castShadow = true;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.11, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1, metalness: 0.9 })
  );
  visor.position.set(0, 0, 0.14);
  helmetMesh.add(visor);
  torsoGroup.add(helmetMesh);
  player.helmetMesh = helmetMesh;

  // Articulated Arms attached to torsoGroup
  const makeArm = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * 0.28, 0.52, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.13), jacketMat);
    arm.position.y = -0.2;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), gloveMat);
    glove.position.y = -0.44;
    g.add(arm, glove);
    return g;
  };
  player.leftArm = makeArm(1);
  player.rightArm = makeArm(-1);
  torsoGroup.add(player.leftArm, player.rightArm);

  // 3D Delivery Package held out in front when delivering an order on foot
  const pkgGroup = new THREE.Group();
  pkgGroup.position.set(0, 0.2, 0.34);
  pkgGroup.visible = false;
  const kraftMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
  const sealMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const pkgBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.22), kraftMat);
  const pkgSeal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.23), sealMat);
  pkgSeal.position.y = 0.11;
  pkgGroup.add(pkgBox, pkgSeal);
  torsoGroup.add(pkgGroup);
  player.deliveryPackageMesh = pkgGroup;

  player.add(torsoGroup);
  player.torsoGroup = torsoGroup;

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



