import * as THREE from 'three';

export type LODTier = 0 | 1 | 2 | 3; // 0 = ULTRA, 1 = HIGH, 2 = MEDIUM, 3 = ECO

export interface LODCategoryConfig {
  detailDist: number;
  proxyDist: number;
  cullDist: number;
}

interface LODManagedNode {
  object: THREE.Object3D;
  cx: number;
  cz: number;
  radius: number;
  category: 'micro' | 'medium' | 'large' | 'landmark';
  subDetailMeshes: THREE.Object3D[];
  hullMeshes: THREE.Object3D[];
  shadowCasters: THREE.Mesh[];
  proxyMesh: THREE.Mesh | null;
  currentStage: 0 | 1 | 2 | 3; // 0 = Full Detail, 1 = Hull Only (No Sub-Details), 2 = Low-Poly Proxy, 3 = Culled
}

const BASE_CATEGORY_DISTANCES: Record<LODManagedNode['category'], LODCategoryConfig> = {
  micro: { detailDist: 45, proxyDist: 65, cullDist: 88 },
  medium: { detailDist: 75, proxyDist: 125, cullDist: 175 },
  large: { detailDist: 115, proxyDist: 210, cullDist: 330 },
  landmark: { detailDist: 165, proxyDist: 360, cullDist: 580 },
};

const TIER_DISTANCE_SCALE: Record<LODTier, number> = {
  0: 1.0,  // ULTRA (FPS >= 53)
  1: 0.78, // HIGH  (43 <= FPS < 53)
  2: 0.58, // MEDIUM (32 <= FPS < 43)
  3: 0.42, // ECO   (FPS < 32)
};

const TIER_PIXEL_RATIO_SCALE: Record<LODTier, number> = {
  0: 1.0,
  1: 0.92,
  2: 0.82,
  3: 0.7,
};

/**
 * Dynamic Level of Detail (LOD) & Adaptive Frame-Rate Governor.
 * Monitors real-time FPS with hysteresis, classifies 3D city objects into spatial tiers,
 * generates low-poly horizon proxy meshes, culls sub-details/shadows on distant structures,
 * and scales draw distances & pixel ratio automatically during frame-rate drops.
 */
export class DynamicLODManager {
  private nodes: LODManagedNode[] = [];
  private proxyGroup: THREE.Group;
  private isLowMode: boolean;
  private isSoftwareGl: boolean;
  private basePixelRatio: number;

  // Real-time FPS Exponential Moving Average & Hysteresis State
  public smoothedFps: number = 60;
  public currentTier: LODTier = 0;
  public lodDistanceScale: number = 1.0;
  public animDecimation: number = 1;

  private fpsSampleAccum: number = 0;
  private fpsFrameCount: number = 0;
  private lastTierChangeTime: number = 0;
  private sliceIndex: number = 0;
  private frameCounter: number = 0;
  private lastAppliedPixelRatio: number = -1;

  // Shared geometry for low-poly building proxies (1 unit cube scaled per building)
  private sharedProxyGeo: THREE.BoxGeometry;

  constructor(
    scene: THREE.Scene,
    performanceMode: 'low' | 'high',
    isSoftwareGl: boolean,
    basePixelRatio: number
  ) {
    this.isLowMode = performanceMode === 'low';
    this.isSoftwareGl = isSoftwareGl;
    this.basePixelRatio = basePixelRatio;
    this.currentTier = this.isLowMode ? 1 : 0;
    this.lodDistanceScale = TIER_DISTANCE_SCALE[this.currentTier];

    this.sharedProxyGeo = new THREE.BoxGeometry(1, 1, 1);
    this.proxyGroup = new THREE.Group();
    this.proxyGroup.name = 'lod_horizon_proxies';
    scene.add(this.proxyGroup);
  }

  /**
   * Indexes the 3D scene once after city construction, computing world-space centroids,
   * bounding radii, high-frequency sub-meshes, and low-poly horizon proxies.
   */
  public classifyScene(scene: THREE.Scene, excludedObjects: Set<THREE.Object3D>) {
    const tempBox = new THREE.Box3();
    const tempSize = new THREE.Vector3();
    const tempCenter = new THREE.Vector3();
    const childBox = new THREE.Box3();
    const childSize = new THREE.Vector3();

    scene.updateMatrixWorld(true);

    const candidates: THREE.Object3D[] = [];
    for (const child of scene.children) {
      if (child.name === 'nova_metropole_other_city') {
        candidates.push(...child.children);
      } else {
        candidates.push(child);
      }
    }

    for (const child of candidates) {
      if (
        !child.visible ||
        excludedObjects.has(child) ||
        child === this.proxyGroup ||
        child instanceof THREE.Light ||
        child instanceof THREE.Camera ||
        child instanceof THREE.Sprite ||
        'screamSprite' in child ||
        child.userData?.isDynamic
      ) {
        continue;
      }

      // Skip infinite/giant ground planes, avenue strips, and sky domes
      tempBox.setFromObject(child);
      if (tempBox.isEmpty()) continue;

      tempBox.getSize(tempSize);
      tempBox.getCenter(tempCenter);

      const maxHorizontalSpan = Math.max(tempSize.x, tempSize.z);
      if (maxHorizontalSpan > 350) {
        // Giant terrain, ocean, avenue network, or sky dome -> never cull as a single object
        continue;
      }

      const radius = Math.hypot(tempSize.x, tempSize.y, tempSize.z) * 0.5;
      if (radius < 0.05) continue;

      let category: LODManagedNode['category'] = 'micro';
      if (radius >= 65 || child.name === 'intercity_cable_stayed_bridge') {
        category = 'landmark';
      } else if (radius >= 13) {
        category = 'large';
      } else if (radius >= 2.2) {
        category = 'medium';
      }

      const subDetailMeshes: THREE.Object3D[] = [];
      const hullMeshes: THREE.Object3D[] = [];
      const shadowCasters: THREE.Mesh[] = [];
      let primaryColorHex = 0x64748b;
      let largestMeshVolume = 0;

      if (child.children.length > 2) {
        child.traverse(sub => {
          if (sub === child) return;
          if (sub instanceof THREE.Mesh) {
            if (sub.castShadow) {
              shadowCasters.push(sub);
            }
            childBox.setFromObject(sub);
            if (!childBox.isEmpty()) {
              childBox.getSize(childSize);
              const subRadius = Math.hypot(childSize.x, childSize.y, childSize.z) * 0.5;
              const volume = childSize.x * childSize.y * childSize.z;

              if (volume > largestMeshVolume) {
                largestMeshVolume = volume;
                const mat = Array.isArray(sub.material) ? sub.material[0] : sub.material;
                if (mat && 'color' in mat && mat.color instanceof THREE.Color) {
                  primaryColorHex = mat.color.getHex();
                }
              }

              // Classify small decorative children (windows, AC units, railings, spectators, lamps) as sub-detail
              const subThreshold =
                category === 'landmark' ? 4.2 : category === 'large' ? 2.6 : 1.15;
              if (subRadius < subThreshold && subRadius < radius * 0.42) {
                subDetailMeshes.push(sub);
              } else {
                hullMeshes.push(sub);
              }
            }
          } else if (sub instanceof THREE.PointLight || sub instanceof THREE.SpotLight) {
            subDetailMeshes.push(sub);
          }
        });
      }

      // Create a single-draw-call Low-Poly Proxy Silhouette for medium & large structures
      let proxyMesh: THREE.Mesh | null = null;
      if ((category === 'large' || category === 'medium') && tempSize.y >= 3.2 && hullMeshes.length > 0) {
        const proxyMat = new THREE.MeshLambertMaterial({
          color: primaryColorHex,
        });
        proxyMesh = new THREE.Mesh(this.sharedProxyGeo, proxyMat);
        proxyMesh.scale.set(
          Math.max(1.5, tempSize.x * 0.92),
          Math.max(2.0, tempSize.y * 0.95),
          Math.max(1.5, tempSize.z * 0.92)
        );
        proxyMesh.position.set(tempCenter.x, tempCenter.y, tempCenter.z);
        proxyMesh.visible = false;
        proxyMesh.matrixAutoUpdate = false;
        proxyMesh.updateMatrix();
        this.proxyGroup.add(proxyMesh);
      }

      this.nodes.push({
        object: child,
        cx: tempCenter.x,
        cz: tempCenter.z,
        radius,
        category,
        subDetailMeshes,
        hullMeshes,
        shadowCasters,
        proxyMesh,
        currentStage: 0,
      });
    }
  }

  /**
   * Samples frame delta time, updates the adaptive FPS tier with hysteresis,
   * adjusts dynamic resolution if needed, and evaluates a time-sliced batch of LOD nodes.
   */
  public update(
    rawDt: number,
    elapsedTime: number,
    playerX: number,
    playerZ: number,
    cameraYaw: number,
    renderer: THREE.WebGLRenderer
  ) {
    this.frameCounter++;

    // 1. Real-time FPS monitoring over a 0.45s rolling window
    if (rawDt > 0.001 && rawDt < 0.5) {
      const instantFps = 1.0 / rawDt;
      this.smoothedFps = this.smoothedFps * 0.92 + instantFps * 0.08;
      this.fpsSampleAccum += rawDt;
      this.fpsFrameCount++;

      if (this.fpsSampleAccum >= 0.45) {
        const windowFps = this.fpsFrameCount / this.fpsSampleAccum;
        this.fpsSampleAccum = 0;
        this.fpsFrameCount = 0;
        this.evaluateQualityTier(windowFps, elapsedTime, renderer);
      }
    }

    // 2. Time-sliced spatial LOD evaluation (processes 1/6th of scene nodes per frame = zero CPU spikes)
    const totalNodes = this.nodes.length;
    if (totalNodes === 0) return;

    const numSlices = 6;
    const sliceSize = Math.ceil(totalNodes / numSlices);
    const startIdx = this.sliceIndex * sliceSize;
    const endIdx = Math.min(totalNodes, startIdx + sliceSize);
    this.sliceIndex = (this.sliceIndex + 1) % numSlices;

    const scale = this.lodDistanceScale;
    const forwardX = Math.sin(cameraYaw);
    const forwardZ = Math.cos(cameraYaw);

    for (let i = startIdx; i < endIdx; i++) {
      const node = this.nodes[i];
      const dx = node.cx - playerX;
      const dz = node.cz - playerZ;
      const distSq = dx * dx + dz * dz;

      // Directional bias: objects behind the camera get a 30% tighter LOD distance
      const dotForward = dx * forwardX + dz * forwardZ;
      const isBehindCamera = distSq > 400 && dotForward < -0.25 * Math.sqrt(distSq);
      const dirFactor = isBehindCamera ? 0.7 : 1.0;

      const baseCfg = BASE_CATEGORY_DISTANCES[node.category];
      const effScale = scale * dirFactor;

      const detailDist = baseCfg.detailDist * effScale;
      const proxyDist = baseCfg.proxyDist * effScale;
      const cullDist = baseCfg.cullDist * effScale;

      let targetStage: 0 | 1 | 2 | 3 = 0;
      if (distSq > cullDist * cullDist) {
        targetStage = 3; // Culled
      } else if (distSq > proxyDist * proxyDist) {
        targetStage = 2; // Low-poly horizon proxy (or hull-only if no proxy)
      } else if (distSq > detailDist * detailDist) {
        targetStage = 1; // Hull only (cull sub-details & disable shadows)
      } else {
        targetStage = 0; // Full detail
      }

      if (targetStage !== node.currentStage) {
        this.applyNodeStage(node, targetStage);
      }
    }
  }

  private applyNodeStage(node: LODManagedNode, stage: 0 | 1 | 2 | 3) {
    node.currentStage = stage;

    if (stage === 3) {
      // Stage 3: Completely culled beyond horizon threshold
      node.object.visible = false;
      if (node.proxyMesh) node.proxyMesh.visible = false;
      return;
    }

    if (stage === 2 && node.proxyMesh) {
      // Stage 2: Replace complex multi-part group with 1-draw-call low-poly proxy box
      node.object.visible = false;
      node.proxyMesh.visible = true;
      return;
    }

    // Stage 0 or Stage 1 (or Stage 2 without proxyMesh)
    node.object.visible = true;
    if (node.proxyMesh) node.proxyMesh.visible = false;

    const showSubDetails = stage === 0;
    for (let i = 0; i < node.subDetailMeshes.length; i++) {
      node.subDetailMeshes[i].visible = showSubDetails;
    }

    const enableShadows = stage === 0 && this.currentTier <= 1;
    for (let i = 0; i < node.shadowCasters.length; i++) {
      node.shadowCasters[i].castShadow = enableShadows;
    }
  }

  private evaluateQualityTier(windowFps: number, elapsedTime: number, renderer: THREE.WebGLRenderer) {
    const minTier: LODTier = this.isLowMode ? 1 : 0;
    let desiredTier: LODTier = this.currentTier;

    // Fast step-down when FPS drops below target thresholds
    if (windowFps < 31) {
      desiredTier = 3;
    } else if (windowFps < 42 && this.currentTier < 2) {
      desiredTier = 2;
    } else if (windowFps < 51 && this.currentTier < 1) {
      desiredTier = 1;
    } else if (windowFps >= 56 && this.currentTier > minTier) {
      // Conservative step-up with hysteresis margin
      if (this.currentTier === 3 && windowFps >= 40) desiredTier = 2;
      else if (this.currentTier === 2 && windowFps >= 50) desiredTier = 1;
      else if (this.currentTier === 1 && windowFps >= 56) desiredTier = minTier;
    }

    const cooldown = desiredTier > this.currentTier ? 0.45 : 1.6;
    if (desiredTier !== this.currentTier && elapsedTime - this.lastTierChangeTime >= cooldown) {
      this.currentTier = desiredTier;
      this.lastTierChangeTime = elapsedTime;
      this.lodDistanceScale = TIER_DISTANCE_SCALE[this.currentTier];
      this.animDecimation = this.currentTier === 0 ? 1 : this.currentTier === 1 ? 2 : this.currentTier === 2 ? 3 : 4;

      // Dynamically adjust pixel ratio on hardware WebGL to reduce fragment shader load
      if (!this.isSoftwareGl) {
        const targetPR = Math.max(
          0.75,
          Math.round(this.basePixelRatio * TIER_PIXEL_RATIO_SCALE[this.currentTier] * 100) / 100
        );
        if (Math.abs(targetPR - this.lastAppliedPixelRatio) > 0.04) {
          this.lastAppliedPixelRatio = targetPR;
          renderer.setPixelRatio(targetPR);
        }
      }
    }
  }

  /**
   * Returns whether a given frame should execute secondary ambient animations
   * based on the current adaptive FPS decimation factor.
   */
  public shouldUpdateSecondaryAnim(): boolean {
    if (this.animDecimation <= 1) return true;
    return this.frameCounter % this.animDecimation === 0;
  }

  /**
   * Returns whether heavy post-processing shaders should run on the current frame.
   * Automatically bypasses EffectComposer in MEDIUM/ECO tiers unless Nitro warp is active.
   */
  public shouldUsePostProcessing(nitroEffectIntensity: number): boolean {
    if (this.isLowMode || this.isSoftwareGl) return false;
    if (nitroEffectIntensity > 0.04) return true;
    return this.currentTier <= 1;
  }

  public dispose() {
    this.sharedProxyGeo.dispose();
    this.proxyGroup.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    });
  }
}
