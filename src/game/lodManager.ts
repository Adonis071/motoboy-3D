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
  currentStage: 0 | 1 | 2 | 3; // 0 = Full Detail, 1 = Hull Only (No Sub-Details), 2 = Low-Poly Proxy, 3 = Culled inside fog
  baseScale: THREE.Vector3;
  fadeAlpha: number;
}

// Tuned to match camera.far (165m-250m) & horizon fog so objects transition and cull inside fog without pop-in
const BASE_CATEGORY_DISTANCES: Record<LODManagedNode['category'], LODCategoryConfig> = {
  micro: { detailDist: 36, proxyDist: 62, cullDist: 92 },
  medium: { detailDist: 58, proxyDist: 98, cullDist: 148 },
  large: { detailDist: 82, proxyDist: 138, cullDist: 192 },
  landmark: { detailDist: 110, proxyDist: 175, cullDist: 235 },
};

// Hysteresis margins (unload radius > load radius so objects never flicker at the threshold)
const HYSTERESIS_MARGIN: Record<LODManagedNode['category'], { detail: number; proxy: number; cull: number }> = {
  micro: { detail: 8, proxy: 12, cull: 16 },
  medium: { detail: 12, proxy: 16, cull: 22 },
  large: { detail: 15, proxy: 20, cull: 26 },
  landmark: { detail: 18, proxy: 24, cull: 32 },
};

const TIER_DISTANCE_SCALE: Record<LODTier, number> = {
  0: 1.0,  // ULTRA (FPS >= 53)
  1: 0.88, // HIGH  (43 <= FPS < 53)
  2: 0.76, // MEDIUM (32 <= FPS < 43)
  3: 0.65, // ECO   (FPS < 32)
};

const TIER_PIXEL_RATIO_SCALE: Record<LODTier, number> = {
  0: 1.0,
  1: 0.9,
  2: 0.8,
  3: 0.7,
};

/**
 * Dynamic Level of Detail (LOD) & Adaptive Frame-Rate Governor.
 * Monitors real-time FPS with hysteresis, classifies 3D city objects into spatial tiers,
 * generates low-poly horizon proxy meshes with shared materials, culls sub-details/shadows
 * on distant structures, and scales draw distances & pixel ratio automatically during frame-rate drops.
 */
export class DynamicLODManager {
  private nodes: LODManagedNode[] = [];
  private fadingNodes: Set<LODManagedNode> = new Set();
  private proxyGroup: THREE.Group;
  private proxyMaterialCache: Map<number, THREE.MeshLambertMaterial> = new Map();
  private isLowMode: boolean;
  private isMediumMode: boolean;
  private isSoftwareGl: boolean;
  private basePixelRatio: number;
  private baseCameraFar: number;

  // Real-time FPS Exponential Moving Average & Hysteresis State
  public smoothedFps: number = 60;
  public currentTier: LODTier = 0;
  public lodDistanceScale: number = 1.0;
  public animDecimation: number = 1;
  public targetCameraFar: number = 210;
  public totalManagedNodes: number = 0;
  public visibleManagedNodes: number = 0;

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
    performanceMode: 'low' | 'medium' | 'high',
    isSoftwareGl: boolean,
    basePixelRatio: number
  ) {
    this.isLowMode = performanceMode === 'low';
    this.isMediumMode = performanceMode === 'medium';
    this.isSoftwareGl = isSoftwareGl;
    this.basePixelRatio = Math.min(basePixelRatio, performanceMode === 'low' ? 1.0 : performanceMode === 'medium' ? 1.25 : 1.5);
    this.baseCameraFar = performanceMode === 'low' ? 165 : performanceMode === 'medium' ? 210 : 250;
    this.currentTier = performanceMode === 'low' ? 2 : performanceMode === 'medium' ? 1 : 0;
    this.lodDistanceScale = TIER_DISTANCE_SCALE[this.currentTier];
    this.targetCameraFar = Math.max(145, Math.round(this.baseCameraFar * (0.85 + 0.15 * this.lodDistanceScale)));

    this.sharedProxyGeo = new THREE.BoxGeometry(1, 1, 1);
    this.sharedProxyGeo.computeBoundingSphere();
    this.sharedProxyGeo.computeBoundingBox();
    this.proxyGroup = new THREE.Group();
    this.proxyGroup.name = 'lod_horizon_proxies';
    scene.add(this.proxyGroup);
  }

  private getSharedProxyMaterial(colorHex: number): THREE.MeshLambertMaterial {
    let mat = this.proxyMaterialCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color: colorHex });
      this.proxyMaterialCache.set(colorHex, mat);
    }
    return mat;
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

    // Compute accurate bounding spheres and boxes on all meshes and enable native Three.js frustum culling
    // (Only huge terrain/road planes and InstancedMeshes spanning the map keep frustumCulled = false)
    scene.traverse(obj => {
      if (obj instanceof THREE.InstancedMesh) {
        obj.computeBoundingSphere();
        obj.frustumCulled = false;
      } else if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.computeBoundingSphere();
        obj.geometry.computeBoundingBox();
        if (obj.userData?.isGiantPlane) {
          obj.frustumCulled = false;
        } else {
          obj.frustumCulled = true;
        }
      }
    });

    const candidates: THREE.Object3D[] = [];
    for (const child of scene.children) {
      if (
        child.name === 'nova_metropole_other_city' ||
        child.name === 'city_advanced_buildings' ||
        child.name === 'city_shelters'
      ) {
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
        child instanceof THREE.InstancedMesh ||
        'screamSprite' in child ||
        child.userData?.isDynamic ||
        child.userData?.isGiantPlane
      ) {
        continue;
      }

      tempBox.setFromObject(child);
      if (tempBox.isEmpty()) continue;

      tempBox.getSize(tempSize);
      tempBox.getCenter(tempCenter);

      const maxHorizontalSpan = Math.max(tempSize.x, tempSize.z);
      if (maxHorizontalSpan > 260) {
        // Giant terrain, ocean, merged avenue network -> keep frustumCulled = false
        child.frustumCulled = false;
        continue;
      }

      const radius = Math.hypot(tempSize.x, tempSize.y, tempSize.z) * 0.5;
      if (radius < 0.05) continue;

      let category: LODManagedNode['category'] = 'micro';
      if (
        radius >= 55 ||
        child.name === 'intercity_cable_stayed_bridge' ||
        child.name === 'intercity_airport'
      ) {
        category = 'landmark';
      } else if (radius >= 11) {
        category = 'large';
      } else if (radius >= 2.2) {
        category = 'medium';
      }

      const subDetailMeshes: THREE.Object3D[] = [];
      const hullMeshes: THREE.Object3D[] = [];
      const shadowCasters: THREE.Mesh[] = [];
      let primaryColorHex = 0x64748b;
      let largestMeshVolume = 0;

      if (child instanceof THREE.Mesh) {
        hullMeshes.push(child);
        if (child.castShadow) shadowCasters.push(child);
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (mat && 'color' in mat && mat.color instanceof THREE.Color) {
          primaryColorHex = mat.color.getHex();
        }
      } else if (child.children.length > 0) {
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
                category === 'landmark' ? 4.2 : category === 'large' ? 2.6 : 1.2;
              if (child.children.length > 2 && subRadius < subThreshold && subRadius < radius * 0.45) {
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

      // Create a single-draw-call Low-Poly Proxy Silhouette using shared geometry & cached material
      let proxyMesh: THREE.Mesh | null = null;
      if ((category === 'large' || category === 'medium') && tempSize.y >= 2.2 && hullMeshes.length > 0) {
        const proxyMat = this.getSharedProxyMaterial(primaryColorHex);
        proxyMesh = new THREE.Mesh(this.sharedProxyGeo, proxyMat);
        proxyMesh.scale.set(
          Math.max(1.5, tempSize.x * 0.94),
          Math.max(2.0, tempSize.y * 0.96),
          Math.max(1.5, tempSize.z * 0.94)
        );
        proxyMesh.position.set(tempCenter.x, tempCenter.y, tempCenter.z);
        proxyMesh.visible = false;
        proxyMesh.frustumCulled = true;
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
        baseScale: child.scale.clone(),
        fadeAlpha: 1.0,
      });
    }

    this.totalManagedNodes = this.nodes.length;
    this.visibleManagedNodes = this.nodes.length;
  }

  /**
   * Samples frame delta time, updates the adaptive FPS tier with hysteresis,
   * adjusts dynamic resolution if needed, and evaluates a time-sliced batch of LOD nodes
   * (distributing stage transitions across frames to avoid frame-time spikes).
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

    // 0. Smooth 0.35s visual transition on nodes that recently entered view
    if (this.fadingNodes.size > 0) {
      const fadeStep = Math.min(0.25, Math.max(0.005, rawDt)) / 0.35;
      for (const node of this.fadingNodes) {
        node.fadeAlpha = Math.min(1.0, node.fadeAlpha + fadeStep);
        const s = 0.9 + 0.1 * node.fadeAlpha;
        node.object.scale.set(
          node.baseScale.x * s,
          node.baseScale.y * (0.86 + 0.14 * node.fadeAlpha),
          node.baseScale.z * s
        );
        if (node.fadeAlpha >= 1.0) {
          node.object.scale.copy(node.baseScale);
          this.fadingNodes.delete(node);
        }
      }
    }

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

    // 2. Time-sliced spatial LOD evaluation (processes 1/6th of scene nodes per frame, max 10 transitions/frame)
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
    let stageChangesThisFrame = 0;
    const maxStageChangesPerFrame = 10;

    for (let i = startIdx; i < endIdx; i++) {
      if (stageChangesThisFrame >= maxStageChangesPerFrame) break;

      const node = this.nodes[i];
      const dx = node.cx - playerX;
      const dz = node.cz - playerZ;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);

      // Directional check: objects well behind the camera (> 35m and > 115 deg off-axis) unload earlier
      const dotForward = dx * forwardX + dz * forwardZ;
      const isBehindCamera = dist > 35 && dotForward < -0.42 * dist;
      const dirFactor = isBehindCamera ? 0.65 : 1.0;

      const baseCfg = BASE_CATEGORY_DISTANCES[node.category];
      const hyst = HYSTERESIS_MARGIN[node.category];
      const effScale = scale * dirFactor;

      // Hysteresis: unload threshold is strictly larger than load threshold
      const detailLoad = baseCfg.detailDist * effScale;
      const detailUnload = detailLoad + hyst.detail;

      const proxyLoad = baseCfg.proxyDist * effScale;
      const proxyUnload = proxyLoad + hyst.proxy;

      const cullLoad = baseCfg.cullDist * effScale;
      const cullUnload = cullLoad + hyst.cull;

      const cur = node.currentStage;
      let targetStage: 0 | 1 | 2 | 3 = cur;

      if (cur === 0) {
        if (dist > detailUnload) targetStage = dist > cullUnload ? 3 : dist > proxyUnload ? 2 : 1;
      } else if (cur === 1) {
        if (dist <= detailLoad) targetStage = 0;
        else if (dist > proxyUnload) targetStage = dist > cullUnload ? 3 : 2;
      } else if (cur === 2) {
        if (dist <= proxyLoad) targetStage = dist <= detailLoad ? 0 : 1;
        else if (dist > cullUnload) targetStage = 3;
      } else {
        // cur === 3 (Culled beyond horizon fog)
        if (dist <= cullLoad) {
          targetStage = dist <= detailLoad ? 0 : dist <= proxyLoad ? 1 : 2;
        }
      }

      if (targetStage !== node.currentStage) {
        this.applyNodeStage(node, targetStage);
        stageChangesThisFrame++;
      }
    }
  }

  private applyNodeStage(node: LODManagedNode, stage: 0 | 1 | 2 | 3) {
    const prevStage = node.currentStage;
    node.currentStage = stage;

    if (prevStage === 3 && stage < 3) {
      this.visibleManagedNodes++;
      node.fadeAlpha = 0.0;
      this.fadingNodes.add(node);
    } else if (prevStage < 3 && stage === 3) {
      this.visibleManagedNodes = Math.max(0, this.visibleManagedNodes - 1);
    }

    if (stage === 3) {
      // Stage 3: Culled inside the horizon fog (zero draw calls)
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

    // Only allow shadows on closest full-detail structures in High mode (or Ultra tier)
    const enableShadows = stage === 0 && !this.isLowMode && !this.isMediumMode && this.currentTier <= 1;
    for (let i = 0; i < node.shadowCasters.length; i++) {
      node.shadowCasters[i].castShadow = enableShadows;
    }
  }

  private evaluateQualityTier(windowFps: number, elapsedTime: number, renderer: THREE.WebGLRenderer) {
    const minTier: LODTier = this.isLowMode ? 2 : this.isMediumMode ? 1 : 0;
    let desiredTier: LODTier = this.currentTier;

    // Fast step-down when FPS drops below target thresholds
    if (windowFps < 32) {
      desiredTier = 3;
    } else if (windowFps < 44 && this.currentTier < 2) {
      desiredTier = 2;
    } else if (windowFps < 52 && this.currentTier < 1) {
      desiredTier = 1;
    } else if (windowFps >= 56 && this.currentTier > minTier) {
      // Conservative step-up with hysteresis margin
      if (this.currentTier === 3 && windowFps >= 42) desiredTier = 2;
      else if (this.currentTier === 2 && windowFps >= 52) desiredTier = Math.max(minTier, 1) as LODTier;
      else if (this.currentTier === 1 && windowFps >= 57) desiredTier = minTier;
    }

    const cooldown = desiredTier > this.currentTier ? 0.45 : 1.8;
    if (desiredTier !== this.currentTier && elapsedTime - this.lastTierChangeTime >= cooldown) {
      this.currentTier = desiredTier;
      this.lastTierChangeTime = elapsedTime;
      this.lodDistanceScale = TIER_DISTANCE_SCALE[this.currentTier];
      this.targetCameraFar = Math.max(145, Math.round(this.baseCameraFar * (0.82 + 0.18 * this.lodDistanceScale)));
      this.animDecimation = this.currentTier === 0 ? 1 : this.currentTier === 1 ? 2 : this.currentTier === 2 ? 3 : 4;

      // Dynamically adjust pixel ratio on hardware WebGL to reduce fragment shader load (capped at 1.5 max, 1.0 in low)
      if (!this.isSoftwareGl) {
        const maxAllowedPR = this.isLowMode ? 1.0 : this.isMediumMode ? 1.25 : 1.5;
        const targetPR = Math.min(
          maxAllowedPR,
          Math.max(
            0.75,
            Math.round(this.basePixelRatio * TIER_PIXEL_RATIO_SCALE[this.currentTier] * 100) / 100
          )
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
   * Disabled on mobile and Low/Medium quality modes to guarantee maximum FPS.
   */
  public shouldUsePostProcessing(nitroEffectIntensity: number): boolean {
    if (this.isLowMode || this.isMediumMode || this.isSoftwareGl) return false;
    if (nitroEffectIntensity > 0.08 && this.currentTier <= 1) return true;
    return this.currentTier === 0;
  }

  public dispose() {
    this.sharedProxyGeo.dispose();
    for (const mat of this.proxyMaterialCache.values()) {
      mat.dispose();
    }
    this.proxyMaterialCache.clear();
  }
}


