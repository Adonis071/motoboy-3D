import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  BikeCustomization,
  BikeUpgrades,
  CameraMode,
  DeliveryOrder,
  DistrictId,
  GameMode,
  SkyTheme,
  TimeShift,
  WeatherType,
} from '../types/game';
import {
  createMotorcycle,
  createOnFootMotoboy,
  createTauntBubbleTexture,
  createDeliveryBeacon,
  updateDeliveryBeaconColor,
  createTrunkLogoTexture,
  createBikeDecalTexture,
  populateHelmetStyleExtras,
  createCharacterHealthBar,
  getRiderOutfitColors,
  MotorcycleGroup,
  OnFootMotoboyGroup,
  OverheadHealthBar,
} from './proceduralModels';
import { buildCityEnvironment } from './cityEnvironment';
import { TrafficManager } from './traffic';
import { WeatherSystem } from './weatherManager';
import { BikePhysics, InputState } from './physics';
import { RivalMotoboyAI } from './rivalAI';
import { BanditManager } from './banditAI';
import { sound } from '../audio/soundEngine';
import { buildCityShelters3D, checkPlayerInShelter } from './shelters';
import { buildCityAdvancedBuildings, InteractiveAnimal } from './cityBuildings';
import { DynamicLODManager } from './lodManager';
import { AirportManager } from './airportManager';

/**
 * Custom Post-Processing Shader for Nitro Speed-Warp:
 * - Radial Motion Blur (10-tap directional velocity blur from vanishing point)
 * - Peripheral Background Defocus (transverse blur on background/edges, keeping center sharp)
 * - Barrel/Pincushion Lens Distortion + High-Frequency Aerodynamic Wave Ripple
 * - Peripheral Chromatic Aberration (RGB split) + Electric Cyan Tunnel Glow
 */
const NitroMotionDistortionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.0 },
    uSpeedFactor: { value: 0.0 },
    uTime: { value: 0.0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.46) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSpeedFactor;
    uniform float uTime;
    uniform vec2 uCenter;
    varying vec2 vUv;

    vec3 applyDynamicGrade(vec3 col, float dist, float dynAmt) {
      // Luma-preserving vibrancy boost (+18% saturation)
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 saturated = mix(vec3(luma), col, 1.18 + dynAmt * 0.12);

      // Subtle S-curve contrast & highlight bloom lift
      vec3 sCurve = smoothstep(0.0, 1.0, saturated);
      vec3 graded = mix(saturated, sCurve, 0.16);
      float highlightGlow = max(0.0, luma - 0.72) * 0.28;
      graded += saturated * highlightGlow;

      // Subtle optical lens vignette
      float vignette = 1.0 - smoothstep(0.45, 0.92, dist) * 0.18;
      return clamp(graded * vignette, 0.0, 1.0);
    }

    void main() {
      vec2 toCenter = uCenter - vUv;
      float dist = length(toCenter);
      float effectiveWarp = clamp(uIntensity + uSpeedFactor * 0.38, 0.0, 1.25);

      if (effectiveWarp <= 0.015) {
        vec3 baseCol = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(applyDynamicGrade(baseCol, dist, 0.0), 1.0);
        return;
      }

      vec2 radialDir = dist > 0.0001 ? toCenter / dist : vec2(0.0);
      vec2 perpDir = vec2(-radialDir.y, radialDir.x);

      // Keep the motorcycle/character and immediate road center sharp; ramp up blur & warp toward periphery
      float edgeMask = smoothstep(0.14, 0.65, dist);

      // High-speed aerodynamic wave shimmer & radial lens pincushion distortion
      float waveRipple = sin(dist * 42.0 - uTime * 34.0) * 0.0028 * uIntensity * edgeMask;
      float lensPull = dist * dist * 0.12 * effectiveWarp * edgeMask;
      vec2 baseUv = clamp(vUv + radialDir * (lensPull + waveRipple), 0.002, 0.998);

      // 10-Tap Radial Motion Blur + Background Transverse Defocus
      float blurStrength = edgeMask * 0.085 * effectiveWarp;
      float bgDefocus = edgeMask * 0.009 * effectiveWarp;

      vec3 accumColor = vec3(0.0);
      float totalWeight = 0.0;

      for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float t = fi / 9.0;
        float weight = 1.0 - t * 0.55;
        vec2 radialStep = radialDir * (t * blurStrength);
        float sideSign = mod(fi, 2.0) == 0.0 ? 1.0 : -1.0;
        vec2 defocusStep = perpDir * (sideSign * (0.3 + t * 0.7) * bgDefocus);
        vec2 sampleUv = clamp(baseUv + radialStep + defocusStep, 0.002, 0.998);

        accumColor += texture2D(tDiffuse, sampleUv).rgb * weight;
        totalWeight += weight;
      }

      vec3 blurred = accumColor / totalWeight;

      // Chromatic Aberration (RGB split along radial vector at periphery)
      vec2 chromaOffset = radialDir * (edgeMask * 0.014 * effectiveWarp);
      float rChan = texture2D(tDiffuse, clamp(baseUv + chromaOffset, 0.002, 0.998)).r;
      float bChan = texture2D(tDiffuse, clamp(baseUv - chromaOffset, 0.002, 0.998)).b;

      vec3 finalRgb = vec3(
        mix(blurred.r, rChan, 0.45 * edgeMask),
        blurred.g,
        mix(blurred.b, bChan, 0.52 * edgeMask)
      );

      // Subtle cyan-electric speed-tunnel energy rim at extreme edges during Nitro
      float rimGlow = smoothstep(0.42, 0.78, dist) * uIntensity * 0.22;
      finalRgb += vec3(0.04, 0.58, 0.96) * rimGlow;

      gl_FragColor = vec4(applyDynamicGrade(finalRgb, dist, effectiveWarp), 1.0);
    }
  `,
};

interface GameCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  gameMode: GameMode;
  cameraMode: CameraMode;
  upgrades: BikeUpgrades;
  customization: BikeCustomization;
  weatherType: WeatherType;
  timeShift: TimeShift;
  skyTheme: SkyTheme;
  teleportTarget?: { x: number; z: number; heading: number; seq: number } | null;
  mountTrigger?: number;
  jumpTrigger?: number;
  meleeTrigger?: { seq: number; type: 'punch' | 'push' } | null;
  specialTrigger?: { seq: number } | null;
  reviveTrigger?: number;
  onReviveLocationResult?: (locationName: string) => void;
  tauntTrigger?: { seq: number; phrase: string } | null;
  policeCallTrigger?: number;
  onPoliceCallResult?: (hadStolenBike: boolean, neutralizedCount: number) => void;
  onMountActionResult?: (
    result: 'dismounted' | 'mounted_own' | 'hijacked_rival' | 'too_far_from_bike'
  ) => void;
  onMeleeResult?: (
    target: 'bandit' | 'rival' | 'pedestrian' | 'guard' | 'police_officer',
    defeated: boolean,
    recoveredBike: boolean
  ) => void;
  onTauntResult?: (phrase: string, stunnedRival: boolean, stunnedBandit: boolean) => void;
  onBanditEvent?: (
    type: 'threat' | 'shot' | 'stole_bike' | 'neutralized',
    value?: number
  ) => void;
  onPolicePursuitEvent?: () => void;
  onPoliceOfficersDisembark?: () => void;
  onPlayerArrested?: () => void;
  onTrafficGuardFine?: () => void;
  onPlayerDefeated?: () => void;
  onGhostScare?: () => void;
  currentOrder: DeliveryOrder | null;
  onOrderPickup: () => void;
  onOrderDeliver: () => void;
  onRivalPickup: () => void;
  onPlayerInterceptRival: () => void;
  onRivalDeliver: () => void;
  onPassTrainingRing?: (bonusCoins: number, isWheelie: boolean) => void;
  onCarCrash: (
    damage: number,
    remainingHealth: number,
    source?: 'car' | 'police' | 'pedestrian' | 'bandit_shot' | 'car_on_foot'
  ) => void;
  repairTrigger?: number;
  refuelTrigger?: number;
  initialFuel?: number;
  onGrauScore: (points: number, combo: number) => void;
  onTelemetryUpdate: (data: {
    speedKmH: number;
    gear: number;
    rpmRatio: number;
    nitroPct: number;
    isNitroActive: boolean;
    bikeHealth: number;
    playerHealth: number;
    fuelPct: number;
    isSkidding: boolean;
    policeWantedSeconds: number;
    policeOfficersChasingOnFoot: boolean;
    isWheelie: boolean;
    isOnFoot: boolean;
    distToOwnBikeM: number;
    isOwnBikeStolen: boolean;
    canHijackRival: boolean;
    nearestBanditDistM: number;
    currentDistrict: DistrictId;
    distanceToTargetM: number;
    rivalDistanceToTargetM: number;
    rivalHasPackage: boolean;
    bikeHeading: number;
    targetHeading: number;
    posX: number;
    posZ: number;
    isSheltered: boolean;
    shelterName: string;
    isSevereStorm: boolean;
    isAquaplaning: boolean;
  }) => void;
  performanceMode: 'low' | 'medium' | 'high';
  headlightOn: boolean;
  isTrafficJam?: boolean;
  inputsRef: React.MutableRefObject<InputState>;
}

// Pre-allocated math objects to avoid GC in animation loop
const _camTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();
const _dirToTarget = new THREE.Vector3();
const _offMapPos = new THREE.Vector3(9999, 0, 9999);

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isPlaying,
  isPaused,
  gameMode,
  cameraMode,
  upgrades,
  customization,
  weatherType,
  timeShift,
  skyTheme,
  teleportTarget,
  mountTrigger,
  jumpTrigger,
  meleeTrigger,
  specialTrigger,
  reviveTrigger,
  onReviveLocationResult,
  tauntTrigger,
  policeCallTrigger,
  onPoliceCallResult,
  onMountActionResult,
  onMeleeResult,
  onTauntResult,
  onBanditEvent,
  onPolicePursuitEvent,
  onPoliceOfficersDisembark,
  onPlayerArrested,
  onTrafficGuardFine,
  onPlayerDefeated,
  onGhostScare,
  currentOrder,
  onOrderPickup,
  onOrderDeliver,
  onRivalPickup,
  onPlayerInterceptRival,
  onRivalDeliver,
  onPassTrainingRing,
  onCarCrash,
  repairTrigger,
  refuelTrigger,
  initialFuel,
  onGrauScore,
  onTelemetryUpdate,
  performanceMode,
  headlightOn,
  isTrafficJam = true,
  inputsRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const showDebugPanelRef = useRef(false);
  showDebugPanelRef.current = showDebugPanel;
  const debugMetricsDomRef = useRef<HTMLPreElement>(null);

  // References for live update without recreating scene
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isTrafficJamRef = useRef(isTrafficJam);
  isTrafficJamRef.current = isTrafficJam;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  const cameraModeRef = useRef<CameraMode>(cameraMode);
  cameraModeRef.current = cameraMode;

  const upgradesRef = useRef(upgrades);
  upgradesRef.current = upgrades;

  const currentOrderRef = useRef(currentOrder);
  currentOrderRef.current = currentOrder;

  const onOrderPickupRef = useRef(onOrderPickup);
  onOrderPickupRef.current = onOrderPickup;

  const onOrderDeliverRef = useRef(onOrderDeliver);
  onOrderDeliverRef.current = onOrderDeliver;

  const onRivalPickupRef = useRef(onRivalPickup);
  onRivalPickupRef.current = onRivalPickup;

  const onPlayerInterceptRivalRef = useRef(onPlayerInterceptRival);
  onPlayerInterceptRivalRef.current = onPlayerInterceptRival;

  const onRivalDeliverRef = useRef(onRivalDeliver);
  onRivalDeliverRef.current = onRivalDeliver;

  const onPassTrainingRingRef = useRef(onPassTrainingRing);
  onPassTrainingRingRef.current = onPassTrainingRing;

  const onCarCrashRef = useRef(onCarCrash);
  onCarCrashRef.current = onCarCrash;

  const onMountActionResultRef = useRef(onMountActionResult);
  onMountActionResultRef.current = onMountActionResult;

  const onMeleeResultRef = useRef(onMeleeResult);
  onMeleeResultRef.current = onMeleeResult;

  const onTauntResultRef = useRef(onTauntResult);
  onTauntResultRef.current = onTauntResult;

  const onPoliceCallResultRef = useRef(onPoliceCallResult);
  onPoliceCallResultRef.current = onPoliceCallResult;

  const onReviveLocationResultRef = useRef(onReviveLocationResult);
  onReviveLocationResultRef.current = onReviveLocationResult;

  const onBanditEventRef = useRef(onBanditEvent);
  onBanditEventRef.current = onBanditEvent;

  const onPolicePursuitEventRef = useRef(onPolicePursuitEvent);
  onPolicePursuitEventRef.current = onPolicePursuitEvent;

  const onPoliceOfficersDisembarkRef = useRef(onPoliceOfficersDisembark);
  onPoliceOfficersDisembarkRef.current = onPoliceOfficersDisembark;

  const onPlayerArrestedRef = useRef(onPlayerArrested);
  onPlayerArrestedRef.current = onPlayerArrested;

  const onTrafficGuardFineRef = useRef(onTrafficGuardFine);
  onTrafficGuardFineRef.current = onTrafficGuardFine;

  const onPlayerDefeatedRef = useRef(onPlayerDefeated);
  onPlayerDefeatedRef.current = onPlayerDefeated;

  const onGhostScareRef = useRef(onGhostScare);
  onGhostScareRef.current = onGhostScare;

  const headlightOnRef = useRef(headlightOn);
  headlightOnRef.current = headlightOn;

  const onGrauScoreRef = useRef(onGrauScore);
  onGrauScoreRef.current = onGrauScore;

  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  onTelemetryUpdateRef.current = onTelemetryUpdate;

  const performanceModeRef = useRef(performanceMode);
  performanceModeRef.current = performanceMode;

  const weatherTypeRef = useRef(weatherType);
  weatherTypeRef.current = weatherType;

  const physicsRef = useRef<BikePhysics>(new BikePhysics());
  const bikeMeshRef = useRef<MotorcycleGroup | null>(null);
  const onFootMeshRef = useRef<OnFootMotoboyGroup | null>(null);
  const playerHealthBarRef = useRef<OverheadHealthBar | null>(null);
  const cityRef = useRef<ReturnType<typeof buildCityEnvironment> | null>(null);
  const trafficRef = useRef<TrafficManager | null>(null);
  const rivalRef = useRef<RivalMotoboyAI | null>(null);
  const banditsRef = useRef<BanditManager | null>(null);
  const tauntSpriteRef = useRef<THREE.Sprite | null>(null);
  const tauntTimerRef = useRef<number>(0);
  const weatherSystemRef = useRef<WeatherSystem | null>(null);
  const beaconRef = useRef<THREE.Group | null>(null);
  const pointerArrowRef = useRef<THREE.Group | null>(null);
  const shakeIntensityRef = useRef<number>(0);
  const camBankRollRef = useRef<number>(0);
  const playerDefeatedTriggeredRef = useRef<boolean>(false);
  const cameraOrbitYawRef = useRef<number>(0);
  const cameraOrbitPitchRef = useRef<number>(0);
  const isDraggingCameraRef = useRef<boolean>(false);
  const cameraPointerIdRef = useRef<number | null>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const prevIsOnFootRef = useRef<boolean>(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Software WebGL Guard (r160+ directive)
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer setup (3-Tier Graphics Quality: Baixa / Média / Alta)
    const isLow = performanceMode === 'low';
    const isMedium = performanceMode === 'medium';
    const isMobileScreen = width < 900 || 'ontouchstart' in window;
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && !isLow && (!isMobileScreen || performanceMode === 'high'),
      powerPreference: 'high-performance',
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    const targetPixelRatio =
      performanceMode === 'low'
        ? 1.0
        : isMedium
        ? Math.min(window.devicePixelRatio, 1.25)
        : Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(isSoftwareGl ? 1.0 : targetPixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = !isSoftwareGl && !isLow;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    // 3. Scene & Studio Reflection Environment (Generated once at startup for both Low & High modes)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);

    if (!isSoftwareGl && !isLow) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    // 4. Cameras (Far plane 165m-250m hidden smoothly with Horizon Fog) + 3D Volumetric Nitro Warp Streaks
    const initialCameraFar = isLow ? 165 : isMedium ? 210 : 250;
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.4, initialCameraFar);
    camera.position.set(0, 4, -7);
    scene.add(camera);

    // 3D Nitro Speed-Lines Tunnel attached to camera periphery
    const nitroTunnelGroup = new THREE.Group();
    nitroTunnelGroup.visible = false;
    camera.add(nitroTunnelGroup);

    const streakGeo = new THREE.BoxGeometry(0.028, 0.028, 2.8);
    const nitroStreaks: Array<{
      mesh: THREE.Mesh;
      baseRadius: number;
      angle: number;
      speed: number;
      zOffset: number;
      mat: THREE.MeshBasicMaterial;
    }> = [];

    const streakCount = isLow ? 12 : 22;
    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const baseRadius = 1.9 + Math.random() * 2.4;
      const isCyan = i % 3 !== 0;
      const mat = new THREE.MeshBasicMaterial({
        color: isCyan ? 0x38bdf8 : 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(streakGeo, mat);
      const zOffset = -2 - Math.random() * 16;
      mesh.position.set(
        Math.cos(angle) * baseRadius,
        Math.sin(angle) * baseRadius * 0.72,
        zOffset
      );
      nitroTunnelGroup.add(mesh);
      nitroStreaks.push({
        mesh,
        baseRadius,
        angle,
        speed: 38 + Math.random() * 26,
        zOffset,
        mat,
      });
    }

    // Post-Processing Composer disabled on mobile and Low/Medium modes to save full-screen shader bandwidth
    let composer: EffectComposer | null = null;
    let nitroShaderPass: ShaderPass | null = null;
    if (!isSoftwareGl && !isLow && !isMobileScreen && performanceMode === 'high') {
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      nitroShaderPass = new ShaderPass(NitroMotionDistortionShader);
      composer.addPass(nitroShaderPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
      composerRef.current = composer;
    }

    renderer.shadowMap.enabled = !isSoftwareGl && !isLow;

    // Effect on performance mode change (strict 1.0 - 1.5 pixelRatio cap)
    const updateQuality = () => {
      const scale =
        performanceMode === 'low'
          ? 1.0
          : performanceMode === 'medium'
          ? Math.min(window.devicePixelRatio, 1.25)
          : Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(isSoftwareGl ? 1.0 : scale);
    };
    updateQuality();

    // 5. Lighting Rig (Low-resolution tight shadow frustum around motorcycle, disabled in Low quality)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.25);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.65);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = !isSoftwareGl && !isLow;
    if (!isSoftwareGl && !isLow) {
      const mapRes = isMobileScreen || isMedium ? 512 : 1024;
      sunLight.shadow.mapSize.width = mapRes;
      sunLight.shadow.mapSize.height = mapRes;
      sunLight.shadow.camera.near = 8;
      sunLight.shadow.camera.far = 125;
      const d = isMedium ? 30 : 42;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    // 6. Procedural City Environment & Colliders (6 Scenarios + Training Stunt Rings)
    const city = buildCityEnvironment(scene, performanceMode);
    cityRef.current = city;

    // 6.1 Physical 3D Shelters (Postos de Gasolina com Cobertura, Viadutos e Marquises)
    const shelters3D = buildCityShelters3D(scene);
    city.collisionBoxes.push(...shelters3D.collisionBoxes);

    // 6.2 Advanced 3D Farm Ranches, Interactive Animals, Skyscrapers, Moto Shops & Gun Shops
    const advancedCity = buildCityAdvancedBuildings(scene);

    // 6.3 International Airport & Dynamic Aviation System (Runways, Terminal, Tower, Airliners taking off and landing)
    const airport = new AirportManager(scene, isLow);

    // 6.4 Dynamic Level of Detail (LOD) & Adaptive FPS Governor (indexes static city structures & builds horizon proxies)
    const basePixelRatio =
      performanceMode === 'low'
        ? 1.0
        : performanceMode === 'medium'
        ? Math.min(window.devicePixelRatio, 1.25)
        : Math.min(window.devicePixelRatio, 1.5);
    const lodManager = new DynamicLODManager(scene, performanceMode, isSoftwareGl, basePixelRatio);
    const excludedFromLod = new Set<THREE.Object3D>([
      city.groundMesh,
      ...(city.oceanMesh ? [city.oceanMesh] : []),
      ...advancedCity.animals.map(a => a.mesh),
    ]);
    lodManager.classifyScene(scene, excludedFromLod);

    // 7. Dynamic AI Traffic (Includes Police Cruisers, Traffic Guards & Disembarking Police Officers)
    const traffic = new TrafficManager(scene, performanceMode);
    trafficRef.current = traffic;

    // 8. Custom 3D Sky Dome, Orbiting Sun/Moon, Clouds & Weather System (synced to camera.far fog)
    const weather = new WeatherSystem(scene, sunLight, hemiLight, weatherType, timeShift, skyTheme, isLow);
    weather.setViewDistance(initialCameraFar);
    weatherSystemRef.current = weather;

    // 9. Hero Motorcycle Model + On-Foot Motoboy Model + Overhead 3D Player Life Bar + Taunt Bubble
    const bikeGroup = createMotorcycle(customization, upgrades, isLow);
    scene.add(bikeGroup);
    bikeMeshRef.current = bikeGroup;

    const onFootGroup = createOnFootMotoboy(customization.helmetColor);
    onFootGroup.visible = false;
    scene.add(onFootGroup);
    onFootMeshRef.current = onFootGroup;

    const playerHealthBar = createCharacterHealthBar('🏍️ VOCÊ', 100, '#10b981');
    playerHealthBar.sprite.position.set(-67.2, 2.65, -28);
    scene.add(playerHealthBar.sprite);
    playerHealthBarRef.current = playerHealthBar;

    const tauntMat = new THREE.SpriteMaterial({
      map: createTauntBubbleTexture('SAI DA FRENTE!'),
      transparent: true,
      depthTest: false,
    });
    const tauntSprite = new THREE.Sprite(tauntMat);
    tauntSprite.scale.set(3.4, 0.92, 1);
    tauntSprite.visible = false;
    scene.add(tauntSprite);
    tauntSpriteRef.current = tauntSprite;

    // 9.5 Rival Competitor Motoboy AI ("Falcão ⚡") & Armed Motorcycle Thieves ("BanditManager")
    const rival = new RivalMotoboyAI(scene);
    rivalRef.current = rival;

    const bandits = new BanditManager(scene);
    banditsRef.current = bandits;

    // 10. Sleek Shaded 3D Pointer Arrow above player
    const arrowGroup = new THREE.Group();
    const arrowConeGeo = new THREE.ConeGeometry(0.28, 0.78, 12);
    arrowConeGeo.rotateX(Math.PI / 2);
    const arrowStemGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.35, 10);
    arrowStemGeo.rotateX(Math.PI / 2);
    arrowStemGeo.translate(0, 0, -0.35);

    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.4,
    });
    const arrowHead = new THREE.Mesh(arrowConeGeo, arrowMat);
    const arrowStem = new THREE.Mesh(arrowStemGeo, arrowMat);
    arrowGroup.add(arrowHead, arrowStem);
    arrowGroup.position.y = 2.35;
    scene.add(arrowGroup);
    pointerArrowRef.current = arrowGroup;

    // 11. Delivery Beacon in world
    const beacon = createDeliveryBeacon(true);
    scene.add(beacon);
    beaconRef.current = beacon;

    // 11.5 3D Particle Systems: Nitro Sparks, Braking Skid Smoke/Sparks & Delivery Celebration Confetti
    const worldParticles: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
      mat: THREE.MeshBasicMaterial;
    }> = [];
    const particleGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const particleGroup = new THREE.Group();
    scene.add(particleGroup);

    const emitParticle = (
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      colorHex: number,
      maxLife: number,
      scale: number = 1.0
    ) => {
      if (worldParticles.length > (isLow ? 28 : 55)) return;
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(particleGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(scale);
      mesh.frustumCulled = false;
      mesh.renderOrder = 12;
      particleGroup.add(mesh);
      worldParticles.push({ mesh, vx, vy, vz, life: maxLife, maxLife, mat });
    };

    // 11.6 Pre-allocated Tire Skid Marks Pool on Asphalt (fades out over 4.5s)
    const skidMarkGeo = new THREE.PlaneGeometry(0.18, 0.78);
    skidMarkGeo.rotateX(-Math.PI / 2);
    const skidMarksPool: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      life: number;
      maxLife: number;
    }> = [];
    const maxSkidMarks = isLow ? 16 : 28;
    for (let s = 0; s < maxSkidMarks; s++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x090d16,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(skidMarkGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      skidMarksPool.push({ mesh, mat, life: 0, maxLife: 4.5 });
    }
    let nextSkidIdx = 0;
    let lastSkidSpawnTime = 0;

    // Physics (Preserve position across quality toggle if already playing)
    const physics = physicsRef.current;
    if (initialFuel !== undefined && physics.fuel === 100) {
      physics.fuel = initialFuel;
    }
    if (physics.position.x === 0 && physics.position.z === 0) {
      physics.position.set(-67.2, 0, -28);
      physics.heading = Math.PI; // Facing North along Avenida Oeste
      physics.parkedBikePosition.copy(physics.position);
      physics.parkedBikeHeading = physics.heading;
    }

    // Resize handler (including mobile visualViewport dynamic address/navigation bar changes)
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.visualViewport?.height || window.innerHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    // Sound start on initial play
    sound.startEngine(customization.exhaustType);

    // Animation Loop
    let animId = 0;
    let lastTelemetryTime = 0;
    let lastBeaconPickupState: boolean | null = null;
    let lastRoadNightState: boolean | null = null;
    let lastRoadWetState: boolean | null = null;
    let nitroEffectIntensity = 0;
    const clock = new THREE.Clock();

    function checkPlayerDefeat(isTraining: boolean) {
      if (!isTraining && physics.playerHealth <= 0 && !playerDefeatedTriggeredRef.current) {
        playerDefeatedTriggeredRef.current = true;
        sound.playGameOver();
        onPlayerDefeatedRef.current?.();
      }
    }

    function tick() {
      animId = requestAnimationFrame(tick);

      if (isPausedRef.current) {
        sound.pauseAmbient();
        clock.getDelta();
        return;
      }

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.08);
      const elapsedTime = clock.getElapsedTime();

      const isLowPerf = performanceModeRef.current === 'low';
      const isPortrait = camera.aspect < 1.0;

      // Update airport dynamic airliners and control tower radar
      airport.update(dt, elapsedTime);

      // Evaluate Dynamic Level of Detail (LOD) & Adaptive FPS Governor (time-sliced 1/6th of city per frame)
      const activeCamYaw = physics.isOnFoot
        ? cameraOrbitYawRef.current
        : physics.heading + cameraOrbitYawRef.current;
      lodManager.update(
        rawDt,
        elapsedTime,
        physics.position.x,
        physics.position.z,
        activeCamYaw,
        renderer
      );

      // Dynamic View Distance & Fog Horizon Sync (automatically tightens when FPS dips)
      if (Math.abs(camera.far - lodManager.targetCameraFar) > 3) {
        camera.far = lodManager.targetCameraFar;
        weather.setViewDistance(lodManager.targetCameraFar);
      }

      // Update city dynamic elements
      city.animatables.forEach(a => a.update(dt, elapsedTime));
      if (weatherSystemRef.current) {
        const shift = weatherSystemRef.current.currentShift;
        const isNight = shift === 'noite' || shift === 'entardecer';
        const isDarkNight = shift === 'noite';
        if (lastRoadNightState !== isNight) {
          lastRoadNightState = isNight;
          city.updateRoadEmissive(isNight);
        }
        const curWeather = weatherTypeRef.current;
        const isWet =
          curWeather === 'rain' || curWeather === 'storm' || curWeather === 'severe_storm';
        if (lastRoadWetState !== isWet) {
          lastRoadWetState = isWet;
          city.updateRoadWetness(isWet ? 1.0 : 0.0);
        }

        // Update 3D Night Ghosts in Darkness Mode (shift === 'noite')
        city.updateNightGhosts(
          dt,
          elapsedTime,
          isDarkNight,
          physics.position,
          physics.heading,
          headlightOnRef.current && !physics.isOnFoot,
          () => {
            shakeIntensityRef.current = 0.85;
            if (gameModeRef.current !== 'training') {
              physics.applyPlayerDamage(8);
              checkPlayerDefeat(false);
            }
            onGhostScareRef.current?.();
          }
        );
      }

      if (!isPausedRef.current) {
        const isTraining = gameModeRef.current === 'training';

        let currentDistrict: DistrictId = 'centro';
        if (physics.position.x > 165) currentDistrict = 'nova_cidade';
        else if (physics.position.z < -120) currentDistrict = 'industrial';
        else if (physics.position.z > 120) currentDistrict = 'autodromo';
        else if (physics.position.x > 0 && physics.position.z < 0) currentDistrict = 'jardins';
        else if (physics.position.x < 0 && physics.position.z > 0) currentDistrict = 'favela';
        else if (physics.position.x > 0 && physics.position.z > 0) currentDistrict = 'orla';

        traffic.update(
          dt,
          elapsedTime,
          physics.position.x,
          physics.position.z,
          city.getPedestrianPositions(),
          () => sound.playPoliceSiren(),
          physics.isOnFoot,
          physics.getSpeedKmH(),
          physics.isWheelie,
          () => {
            if (!isTraining) {
              onTrafficGuardFineRef.current?.();
            }
          },
          () => {
            if (!isTraining) {
              onPoliceOfficersDisembarkRef.current?.();
            }
          },
          () => {
            if (!isTraining) {
              physics.forceDismount(false);
              onPlayerArrestedRef.current?.();
            }
          },
          currentDistrict,
          timeShift,
          Boolean(inputsRef.current.horn),
          isTrafficJamRef.current,
          lodManager.lodDistanceScale
        );

        if (inputsRef.current.horn) {
          city.reactPedestriansToHorn(physics.position);
        }

        // In Training Mode, unlock full Nitro and boost recharge so player can practice stunts freely
        const activeUpgrades = isTraining
          ? { ...upgradesRef.current, nitroUnlocked: true }
          : upgradesRef.current;

        // Check if player is currently under a covered shelter (gas station, viaduct, marquee)
        const shelterInfo = checkPlayerInShelter(physics.position.x, physics.position.z);
        const isSheltered = shelterInfo.isSheltered;

        physics.update(
          dt,
          inputsRef.current,
          activeUpgrades,
          weather.currentWeather,
          city.collisionBoxes,
          (pts, combo) => onGrauScoreRef.current(pts, combo),
          () => {
            shakeIntensityRef.current = 0.55;
            if (!isTraining) {
              physics.applyDamage(6);
              physics.applyPlayerDamage(4);
              checkPlayerDefeat(isTraining);
            }
          },
          isSheltered
        );

        if (isTraining) {
          physics.bikeHealth = 100;
          physics.playerHealth = 100;
          physics.nitroAvailable = Math.min(1, physics.nitroAvailable + dt * 0.22);
        }

        // Dynamic Ambient Audio: weather-reactive rain/storm on trunk & dynamic high-speed wind buffeting
        sound.updateAmbient(
          weatherTypeRef.current,
          physics.getSpeedKmH(),
          physics.isOnFoot,
          physics.isNitroActive,
          isSheltered
        );

        // Check Training Slalom & Stunt Rings in Training Mode (only trigger pass when riding motorcycle!)
        city.checkTrainingRings(
          physics.isOnFoot ? _offMapPos : physics.position,
          physics.isWheelie,
          isTraining,
          (bonus, isWheelie) => {
            onPassTrainingRingRef.current?.(bonus, isWheelie);
          }
        );

        // Update 3D Farm Animals (with world-space hysteresis distance loading matched to fog horizon)
        const animalLoadDistSq = (78 * lodManager.lodDistanceScale) * (78 * lodManager.lodDistanceScale);
        const animalUnloadDistSq = (95 * lodManager.lodDistanceScale) * (95 * lodManager.lodDistanceScale);
        const runSecondaryAnim = lodManager.shouldUpdateSecondaryAnim();
        for (let i = 0; i < advancedCity.animals.length; i++) {
          const anim = advancedCity.animals[i];
          const adx = anim.x - physics.position.x;
          const adz = anim.z - physics.position.z;
          const aThresholdSq = anim.mesh.visible ? animalUnloadDistSq : animalLoadDistSq;
          if (adx * adx + adz * adz > aThresholdSq) {
            anim.mesh.visible = false;
            continue;
          }
          if (!anim.mesh.visible) {
            anim.mesh.visible = true;
            anim.mesh.userData.visFade = 0.0;
          }
          if ((anim.mesh.userData.visFade ?? 1.0) < 1.0) {
            const nextFade = Math.min(1.0, (anim.mesh.userData.visFade ?? 0) + dt / 0.38);
            anim.mesh.userData.visFade = nextFade;
            const s = 0.85 + 0.15 * nextFade;
            anim.mesh.scale.set(s, 0.8 + 0.2 * nextFade, s);
          } else {
            anim.mesh.scale.set(1, 1, 1);
          }
          if (runSecondaryAnim) {
            const effDt = dt * lodManager.animDecimation;
            anim.angle += effDt * anim.speed * 0.4;
            const stepX = Math.cos(anim.angle) * effDt * anim.speed;
            const stepZ = Math.sin(anim.angle) * effDt * anim.speed;
            anim.mesh.position.x += stepX;
            anim.mesh.position.z += stepZ;
            anim.x += stepX;
            anim.z += stepZ;
            anim.mesh.rotation.y = anim.angle + Math.PI / 2;
          }
        }

        // Update Rival Motoboy AI only in Career Mode
        if (isTraining) {
          rival.mesh.visible = false;
          rival.strandedRiderMesh.visible = false;
        } else if (isPlayingRef.current) {
          rival.update(
            dt,
            currentOrderRef.current,
            physics.position,
            upgradesRef.current.engineLevel,
            city.collisionBoxes,
            () => onRivalPickupRef.current(),
            () => onPlayerInterceptRivalRef.current(),
            () => onRivalDeliverRef.current(),
            physics.isOnFoot
          );
        }

        // Update Armed Motorcycle Thieves (Bandits announce robbery, run to bike, and mount it to flee!)
        const activeBikePos = physics.isOnFoot ? physics.parkedBikePosition : physics.position;
        bandits.update(
          dt,
          physics.position,
          activeBikePos,
          (bx, bz, bHeading) => {
            physics.parkedBikePosition.set(bx, 0, bz);
            physics.parkedBikeHeading = bHeading;
            if (bikeGroup.riderMesh) {
              bikeGroup.riderMesh.visible = true;
            }
          },
          physics.getSpeedKmH(),
          physics.isOnFoot,
          isPlayingRef.current && !isTraining,
          () => {
            onBanditEventRef.current?.('threat');
          },
          shotDmg => {
            const rem = physics.applyDamage(shotDmg);
            physics.applyPlayerDamage(14);
            shakeIntensityRef.current = 0.75;
            onCarCrashRef.current(shotDmg, rem, 'bandit_shot');
            onBanditEventRef.current?.('shot', shotDmg);
            checkPlayerDefeat(isTraining);
            city.triggerPedestrianPanicNear(physics.position, 28, '🏃 TIROTEIO! CORRE PRA CALÇADA!');
          },
          () => {
            physics.forceDismount(true);
            shakeIntensityRef.current = 0.9;
            onBanditEventRef.current?.('stole_bike');
            city.triggerPedestrianPanicNear(physics.position, 30, '🚨 ASSALTO! CORRE PRO REFÚGIO!');
          },
          reward => {
            shakeIntensityRef.current = 0.65;
            onBanditEventRef.current?.('neutralized', reward);
          }
        );

        // Check physical collision with traffic vehicles & Police Cruisers -> Apply crash damage & Police Pursuit!
        const { collided, isPolice } = traffic.checkCollision(physics.position);
        if (collided) {
          if (physics.crashCooldown <= 0) {
            const impactDamage = isTraining
              ? 0
              : Math.max(16, Math.min(38, Math.round(Math.abs(physics.speed) * 1.25 + 12)));

            // If player is ON FOOT (without a motorcycle), never damage the parked motorcycle!
            const remainingHealth =
              isTraining || physics.isOnFoot
                ? Math.round(physics.bikeHealth)
                : physics.applyDamage(impactDamage);

            if (!isTraining) {
              physics.applyPlayerDamage(Math.max(10, Math.round(impactDamage * 0.55)));
              checkPlayerDefeat(isTraining);
            }
            physics.speed = -Math.sign(physics.speed || 1) * Math.max(4, Math.abs(physics.speed) * 0.42);
            physics.crashCooldown = 0.85;
            shakeIntensityRef.current = 0.95;
            sound.playCrash();
            // Emit orange/yellow metallic collision sparks burst!
            for (let sp = 0; sp < 10; sp++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 2.5 + Math.random() * 5.0;
              emitParticle(
                physics.position.x + (Math.random() - 0.5) * 0.5,
                0.55 + Math.random() * 0.4,
                physics.position.z + (Math.random() - 0.5) * 0.5,
                Math.cos(ang) * spd,
                1.6 + Math.random() * 2.5,
                Math.sin(ang) * spd,
                sp % 2 === 0 ? 0xf97316 : 0xfacc15,
                0.32,
                0.75
              );
            }
            if (isPolice) {
              sound.playPoliceSiren();
              onPolicePursuitEventRef.current?.();
              city.triggerPedestrianPanicNear(physics.position, 30, '🚨 POLÍCIA! CORRE PRO REFÚGIO!');
            } else {
              city.triggerPedestrianPanicNear(physics.position, 24, '💥 ACIDENTE! CUIDADO!');
            }
            if (!isTraining) {
              const crashSource = isPolice
                ? 'police'
                : physics.isOnFoot
                ? 'car_on_foot'
                : 'car';
              onCarCrashRef.current(impactDamage, remainingHealth, crashSource);
            }
          }
        }

        // Solid collision check with 3D Pedestrians (No passing through body + Scream + Life Damage!)
        city.checkPedestrianCollisions(
          physics,
          traffic.vehicles,
          (dmg, remHealth) => {
            shakeIntensityRef.current = 0.85;
            if (isTraining) {
              physics.bikeHealth = 100;
              physics.playerHealth = 100;
            } else {
              physics.applyPlayerDamage(Math.max(6, Math.round(dmg * 0.5)));
              onCarCrashRef.current(dmg, remHealth, 'pedestrian');
              checkPlayerDefeat(isTraining);
            }
          },
          lodManager.lodDistanceScale
        );
      }

      // Sync 3D Motorcycle Mesh & On-Foot Motoboy Mesh
      if (physics.isOnFoot) {
        bikeGroup.position.copy(physics.parkedBikePosition);
        bikeGroup.rotation.y = physics.parkedBikeHeading;
        bikeGroup.rotation.z = bandits.isRidingPlayerBike ? 0 : 0.14;
        bikeGroup.rotation.x = 0;
        if (bikeGroup.riderMesh) {
          bikeGroup.riderMesh.visible = bandits.isRidingPlayerBike;
        }

        // Show and animate On-Foot Motoboy (Walk vs Run, Jump, Punch/Push & Package Delivery Animation)
        onFootGroup.visible = true;
        onFootGroup.position.copy(physics.position);
        onFootGroup.rotation.y = physics.heading;
        const absFootSpeed = Math.abs(physics.speed);
        const isRunning = absFootSpeed > 4.2;
        const swingAmp = absFootSpeed > 0.3 ? (isRunning ? 0.82 : 0.55) : 0;
        const swing = Math.sin(physics.walkCycle) * swingAmp;
        onFootGroup.leftLeg.rotation.x = physics.isJumping ? 0.45 : swing;
        onFootGroup.rightLeg.rotation.x = physics.isJumping ? -0.35 : -swing;

        if (onFootGroup.torsoGroup) {
          const targetTorsoLean = isRunning ? 0.22 : absFootSpeed > 0.3 ? 0.08 : 0;
          onFootGroup.torsoGroup.rotation.x = THREE.MathUtils.damp(
            onFootGroup.torsoGroup.rotation.x,
            targetTorsoLean,
            10,
            dt
          );
        }
        if (onFootGroup.backpackMesh) {
          onFootGroup.backpackMesh.rotation.z =
            absFootSpeed > 0.3 ? Math.sin(physics.walkCycle * 2) * 0.05 : 0;
        }

        const activeOrd = currentOrderRef.current;
        const isDeliveringNearCustomer = Boolean(
          gameModeRef.current === 'career' &&
            activeOrd &&
            activeOrd.state === 'to_deliver' &&
            Math.hypot(
              physics.position.x - activeOrd.customerPos.x,
              physics.position.z - activeOrd.customerPos.z
            ) < 12
        );
        if (onFootGroup.deliveryPackageMesh) {
          onFootGroup.deliveryPackageMesh.visible = isDeliveringNearCustomer;
        }

        if (physics.meleeAction === 'punch') {
          onFootGroup.rightArm.rotation.x = -1.55; // Right hook / punch forward
          onFootGroup.leftArm.rotation.x = -0.45;
        } else if (physics.meleeAction === 'push') {
          onFootGroup.rightArm.rotation.x = -1.45; // Two-handed shove forward
          onFootGroup.leftArm.rotation.x = -1.45;
        } else if (isDeliveringNearCustomer) {
          // Hold out the delivery package with both hands toward the customer!
          onFootGroup.leftArm.rotation.x = -1.05 + swing * 0.15;
          onFootGroup.rightArm.rotation.x = -1.05 - swing * 0.15;
        } else {
          onFootGroup.leftArm.rotation.x = -swing * 0.75;
          onFootGroup.rightArm.rotation.x = swing * 0.75;
        }
      } else {
        onFootGroup.visible = false;
        if (bikeGroup.riderMesh) {
          bikeGroup.riderMesh.visible = cameraModeRef.current !== 'first_person';
        }
        bikeGroup.position.copy(physics.position);
        bikeGroup.rotation.y = physics.heading;
        bikeGroup.rotation.z = physics.leanAngle;
        bikeGroup.rotation.x = -physics.pitchAngle;

        // Rider animations on motorcycle:
        // 1) Torso leans dynamically into curves & slightly forward at high speed
        const speedNorm = Math.min(1, Math.abs(physics.speed) / 30);
        if (bikeGroup.riderTorso) {
          bikeGroup.riderTorso.rotation.z = THREE.MathUtils.damp(
            bikeGroup.riderTorso.rotation.z,
            -physics.leanAngle * 0.42,
            10,
            dt
          );
          bikeGroup.riderTorso.rotation.x = THREE.MathUtils.damp(
            bikeGroup.riderTorso.rotation.x,
            0.12 + speedNorm * 0.14,
            8,
            dt
          );
        }
        // 2) Left foot rests on the asphalt when stopped; returns to footpeg when moving
        const isStopped = Math.abs(physics.speed) < 0.85 && !physics.isWheelie;
        if (bikeGroup.riderLeftLeg) {
          bikeGroup.riderLeftLeg.rotation.z = THREE.MathUtils.damp(
            bikeGroup.riderLeftLeg.rotation.z,
            isStopped ? -0.28 : 0,
            9,
            dt
          );
          bikeGroup.riderLeftLeg.rotation.x = THREE.MathUtils.damp(
            bikeGroup.riderLeftLeg.rotation.x,
            isStopped ? 0.28 : 0,
            9,
            dt
          );
        }
        // 3) Articulated arms counter-steer subtly on the handlebars
        if (bikeGroup.riderLeftArm && bikeGroup.riderRightArm) {
          bikeGroup.riderLeftArm.rotation.z = physics.steerAngle * 0.18;
          bikeGroup.riderRightArm.rotation.z = physics.steerAngle * 0.18;
        }
        // 4) Thermal backpack sways gently with road vibration & curves
        if (bikeGroup.backpackMesh) {
          bikeGroup.backpackMesh.rotation.z =
            Math.sin(elapsedTime * 11) * 0.032 * speedNorm - physics.leanAngle * 0.12;
        }
      }

      // Keep 3D overhead player status billboard hidden so the center of the viewport stays unobstructed (HUD pill shows health & speed)
      if (playerHealthBarRef.current) {
        playerHealthBarRef.current.sprite.visible = false;
      }

      // Update floating 3D Taunt Bubble above player
      if (tauntTimerRef.current > 0 && tauntSpriteRef.current) {
        tauntTimerRef.current = Math.max(0, tauntTimerRef.current - dt);
        tauntSpriteRef.current.visible = tauntTimerRef.current > 0;
        tauntSpriteRef.current.position.set(
          physics.position.x,
          physics.position.y + 3.25 + Math.sin(elapsedTime * 12) * 0.08,
          physics.position.z
        );
      }

      // Front fork steer angle & Wheel spins
      bikeGroup.frontFork.rotation.y = physics.steerAngle;
      bikeGroup.frontWheel.rotation.x = physics.wheelRotation;
      bikeGroup.rearWheel.rotation.x = physics.wheelRotation;

      // Dynamic Brake Light & Nitro Flame visual feedback
      if (bikeGroup.taillightMat) {
        bikeGroup.taillightMat.emissiveIntensity = inputsRef.current.backward ? 2.4 : 0.75;
      }
      if (bikeGroup.nitroFlameMesh) {
        const flameMat = bikeGroup.nitroFlameMesh.material as THREE.MeshBasicMaterial;
        flameMat.opacity = physics.isNitroActive ? 0.75 + Math.sin(elapsedTime * 40) * 0.2 : 0;
        bikeGroup.nitroFlameMesh.scale.setScalar(
          physics.isNitroActive ? 0.9 + Math.sin(elapsedTime * 50) * 0.25 : 0.01
        );
      }

      // Emit 3D Nitro Sparks, Exhaust Smoke, Braking Skid Smoke/Sparks & Tire Skid Marks on Asphalt
      if (!physics.isOnFoot) {
        const rearX = physics.position.x - Math.sin(physics.heading) * 0.9;
        const rearZ = physics.position.z - Math.cos(physics.heading) * 0.9;

        // Subtle exhaust smoke puffs when accelerating
        if (inputsRef.current.forward && !physics.isNitroActive && Math.random() < 0.22) {
          emitParticle(
            rearX - Math.sin(physics.heading) * 0.15 + Math.cos(physics.heading) * 0.22,
            0.26,
            rearZ - Math.cos(physics.heading) * 0.15 - Math.sin(physics.heading) * 0.22,
            -Math.sin(physics.heading) * 1.8 + (Math.random() - 0.5) * 0.5,
            0.45 + Math.random() * 0.4,
            -Math.cos(physics.heading) * 1.8 + (Math.random() - 0.5) * 0.5,
            0x94a3b8,
            0.36,
            0.65
          );
        }

        if (physics.isNitroActive && Math.random() < 0.75) {
          emitParticle(
            rearX + (Math.random() - 0.5) * 0.25,
            0.28 + Math.random() * 0.15,
            rearZ + (Math.random() - 0.5) * 0.25,
            -Math.sin(physics.heading) * (8 + Math.random() * 5) + (Math.random() - 0.5) * 2,
            0.8 + Math.random() * 1.4,
            -Math.cos(physics.heading) * (8 + Math.random() * 5) + (Math.random() - 0.5) * 2,
            Math.random() > 0.35 ? 0x00f3ff : 0xf59e0b,
            0.32,
            0.85
          );
        }

        if (physics.isSkidding && Math.abs(physics.speed) > 4.2) {
          // Spawn Tire Skid Mark on the asphalt behind rear tire every 55ms
          if (elapsedTime - lastSkidSpawnTime > 0.055) {
            lastSkidSpawnTime = elapsedTime;
            const mark = skidMarksPool[nextSkidIdx];
            nextSkidIdx = (nextSkidIdx + 1) % skidMarksPool.length;
            mark.mesh.position.set(rearX, 0.044, rearZ);
            mark.mesh.rotation.y = physics.heading;
            mark.life = mark.maxLife;
            mark.mat.opacity = 0.65;
            mark.mesh.visible = true;
          }

          if (Math.random() < 0.85) {
            // Tire skid smoke puff + occasional orange friction spark
            const isSpark = Math.random() < 0.28;
            emitParticle(
              rearX + (Math.random() - 0.5) * 0.35,
              0.12 + Math.random() * 0.1,
              rearZ + (Math.random() - 0.5) * 0.35,
              (Math.random() - 0.5) * 2.4,
              0.9 + Math.random() * 1.5,
              (Math.random() - 0.5) * 2.4,
              isSpark ? 0xf97316 : 0xcbd5e1,
              isSpark ? 0.25 : 0.48,
              isSpark ? 0.65 : 1.45
            );
          }
        }
      }

      // Ground raindrop splash puffs when raining
      if (
        !isLowPerf &&
        (weatherTypeRef.current === 'rain' ||
          weatherTypeRef.current === 'storm' ||
          weatherTypeRef.current === 'severe_storm') &&
        Math.random() < 0.45
      ) {
        emitParticle(
          physics.position.x + (Math.random() - 0.5) * 14,
          0.08,
          physics.position.z + (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 0.6,
          0.9 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.6,
          0xbae6fd,
          0.18,
          0.45
        );
      }

      // Update & fade Tire Skid Marks on the asphalt (disappear after ~4.5 seconds)
      for (let sIdx = 0; sIdx < skidMarksPool.length; sIdx++) {
        const mark = skidMarksPool[sIdx];
        if (!mark.mesh.visible) continue;
        mark.life -= dt;
        if (mark.life <= 0) {
          mark.mesh.visible = false;
          mark.mat.opacity = 0;
        } else {
          mark.mat.opacity = (mark.life / mark.maxLife) * 0.65;
        }
      }

      // Update active 3D World Particles
      for (let pIdx = worldParticles.length - 1; pIdx >= 0; pIdx--) {
        const p = worldParticles[pIdx];
        p.life -= dt;
        if (p.life <= 0) {
          particleGroup.remove(p.mesh);
          p.mat.dispose();
          worldParticles.splice(pIdx, 1);
          continue;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mat.opacity = Math.max(0, (p.life / p.maxLife) * 0.85);
        p.mesh.scale.multiplyScalar(1 + dt * 1.2);
      }

      // 3D Engine Damage Smoke Puffs when bikeHealth < 70%
      if (bikeGroup.damageSmokeGroup) {
        const isDamaged = physics.bikeHealth < 70;
        bikeGroup.damageSmokeGroup.visible = isDamaged;
        if (isDamaged) {
          const severity = THREE.MathUtils.clamp((70 - physics.bikeHealth) / 70, 0.2, 1.0);
          bikeGroup.damageSmokeGroup.children.forEach((child, idx) => {
            if (child instanceof THREE.Mesh) {
              const phase = (elapsedTime * (1.8 + severity * 1.4) + idx * 0.25) % 1;
              child.position.y = phase * (0.85 + severity * 0.6);
              child.position.x = Math.sin(elapsedTime * 5 + idx) * 0.14 * phase;
              child.position.z = -phase * 0.45;
              child.scale.setScalar(0.55 + phase * (1.1 + severity * 0.8));
              const mat = child.material as THREE.MeshStandardMaterial;
              mat.opacity = (1 - phase) * (0.45 + severity * 0.45);
              const shade = physics.bikeHealth < 30 ? 0x1e293b : 0x475569;
              mat.color.setHex(shade);
            }
          });
        }
      }

      // Weather rain streaks & 3D sky dome / clouds update around player
      weather.update(dt, physics.position.x, physics.position.z);

      // Delivery Beacon position & animation (visible in Career Mode)
      const isCareer = gameModeRef.current === 'career';
      if (beaconRef.current) beaconRef.current.visible = isCareer;
      if (pointerArrowRef.current) pointerArrowRef.current.visible = isCareer;

      const order = currentOrderRef.current;
      let distToTarget = 0;
      let targetHeading = physics.heading;

      if (isCareer && order && beaconRef.current) {
        const isPickup = order.state === 'to_pickup';
        const targetPos = isPickup ? order.restaurantPos : order.customerPos;

        if (lastBeaconPickupState !== isPickup) {
          lastBeaconPickupState = isPickup;
          updateDeliveryBeaconColor(beaconRef.current, isPickup);
        }

        beaconRef.current.position.set(targetPos.x, 0, targetPos.z);
        beaconRef.current.rotation.y += dt * 1.6;

        // Check if player reached restaurant pickup bay or customer dropoff bay (5.2m radius)
        distToTarget = Math.hypot(
          physics.position.x - targetPos.x,
          physics.position.z - targetPos.z
        );

        if (distToTarget < 5.2 && isPlayingRef.current && !isPausedRef.current) {
          if (isPickup) {
            rival.hasStolenPackage = false;
            sound.playCash();
            onOrderPickupRef.current();
          } else if (order.state === 'to_deliver') {
            rival.hasStolenPackage = false;
            sound.playDoorbell();
            sound.playCash();
            // Emit celebratory 3D confetti burst around the player on completed delivery!
            const burstColors = [0x10b981, 0xf59e0b, 0x38bdf8, 0xfacc15];
            for (let b = 0; b < 22; b++) {
              const angle = (b / 22) * Math.PI * 2;
              const spd = 3.5 + Math.random() * 4.5;
              emitParticle(
                physics.position.x,
                1.4 + Math.random() * 0.5,
                physics.position.z,
                Math.cos(angle) * spd,
                3.5 + Math.random() * 3.5,
                Math.sin(angle) * spd,
                burstColors[b % burstColors.length],
                0.85,
                1.15
              );
            }
            onOrderDeliverRef.current();
          }
        }

        // Pointer Arrow Direction
        if (pointerArrowRef.current) {
          pointerArrowRef.current.position.set(
            physics.position.x,
            physics.position.y + 3.05 + Math.sin(elapsedTime * 5) * 0.08,
            physics.position.z
          );
          _dirToTarget
            .set(targetPos.x - physics.position.x, 0, targetPos.z - physics.position.z)
            .normalize();

          const angle = Math.atan2(_dirToTarget.x, _dirToTarget.z);
          pointerArrowRef.current.rotation.y = angle;

          const colorHex = isPickup ? 0xf59e0b : 0x10b981;
          pointerArrowRef.current.traverse(child => {
            if (child instanceof THREE.Mesh) {
              const m = child.material as THREE.MeshStandardMaterial;
              m.color.setHex(colorHex);
              m.emissive.setHex(colorHex);
            }
          });
        }

        targetHeading = Math.atan2(
          targetPos.x - physics.position.x,
          targetPos.z - physics.position.z
        );
      }

      // Throttled Telemetry update to React HUD (~7fps to prevent React re-render lag)
      if (elapsedTime - lastTelemetryTime > 0.14) {
        lastTelemetryTime = elapsedTime;

        let district: DistrictId = 'centro';
        if (physics.position.x > 165) district = 'nova_cidade';
        else if (physics.position.z < -120) district = 'industrial';
        else if (physics.position.z > 120) district = 'autodromo';
        else if (physics.position.x > 0 && physics.position.z < 0) district = 'jardins';
        else if (physics.position.x < 0 && physics.position.z > 0) district = 'favela';
        else if (physics.position.x > 0 && physics.position.z > 0) district = 'orla';

        const speedKmH = physics.getSpeedKmH();
        const gear = Math.min(5, Math.max(1, Math.floor(speedKmH / 25) + 1));
        const rpmRatio = (speedKmH % 30) / 30;
        const distToRival = Math.hypot(
          physics.position.x - rival.position.x,
          physics.position.z - rival.position.z
        );
        const canHijackRival =
          isCareer && rival.hijackedTimer <= 0 && distToRival < 9.5;
        const distToOwnBikeM = Math.round(
          Math.hypot(
            physics.position.x - physics.parkedBikePosition.x,
            physics.position.z - physics.parkedBikePosition.z
          ) * 8
        );

        const currentShelter = checkPlayerInShelter(physics.position.x, physics.position.z);
        if (currentShelter.isSheltered && currentShelter.shelter?.type === 'gas_station') {
          physics.fuel = Math.min(100, physics.fuel + 12);
        }

        onTelemetryUpdateRef.current({
          speedKmH,
          gear,
          rpmRatio,
          nitroPct: Math.round(physics.nitroAvailable * 100),
          isNitroActive: physics.isNitroActive,
          bikeHealth: Math.round(physics.bikeHealth),
          playerHealth: Math.round(physics.playerHealth),
          fuelPct: Math.round(physics.fuel),
          isSkidding: physics.isSkidding,
          policeWantedSeconds: Math.ceil(traffic.wantedTimer),
          policeOfficersChasingOnFoot: traffic.hasOfficersChasingOnFoot,
          isWheelie: physics.isWheelie,
          isOnFoot: physics.isOnFoot,
          distToOwnBikeM,
          isOwnBikeStolen: bandits.isRidingPlayerBike,
          canHijackRival,
          nearestBanditDistM: bandits.nearestBanditDistM,
          currentDistrict: district,
          distanceToTargetM: Math.round(distToTarget * 8),
          rivalDistanceToTargetM: rival.distanceToTargetM,
          rivalHasPackage: rival.hasStolenPackage,
          bikeHeading: physics.heading,
          targetHeading,
          posX: physics.position.x,
          posZ: physics.position.z,
          isSheltered: currentShelter.isSheltered,
          shelterName: currentShelter.shelter?.name || '',
          isSevereStorm: weatherTypeRef.current === 'severe_storm',
          isAquaplaning: physics.isAquaplaning,
        });
      }

      // Smoothly ramp Nitro Motion Distortion & Background Defocus intensity (0.0 -> 1.0)
      const targetNitroIntensity =
        !physics.isOnFoot && physics.isNitroActive
          ? 1.0
          : !physics.isOnFoot && physics.getSpeedKmH() > 125
          ? ((physics.getSpeedKmH() - 125) / 55) * 0.28
          : 0.0;
      nitroEffectIntensity = THREE.MathUtils.damp(
        nitroEffectIntensity,
        targetNitroIntensity,
        physics.isNitroActive ? 9.5 : 6.0,
        dt
      );

      // Update 3D Volumetric Nitro Warp Streaks around camera periphery
      if (nitroEffectIntensity > 0.015) {
        nitroTunnelGroup.visible = true;
        for (const s of nitroStreaks) {
          s.zOffset += s.speed * (0.6 + nitroEffectIntensity * 0.9) * dt;
          if (s.zOffset > 1.2) {
            s.zOffset = -16 - Math.random() * 6;
          }
          const radialPulse = s.baseRadius * (1.0 - nitroEffectIntensity * 0.12);
          s.mesh.position.set(
            Math.cos(s.angle) * radialPulse,
            Math.sin(s.angle) * radialPulse * 0.72,
            s.zOffset
          );
          s.mesh.scale.z = 0.7 + nitroEffectIntensity * 1.45;
          const depthFade = THREE.MathUtils.smoothstep(s.zOffset, -18, -4);
          s.mat.opacity = nitroEffectIntensity * depthFade * 0.58;
        }
      } else {
        nitroTunnelGroup.visible = false;
      }

      // PLAYER-LOCKED MULTI-MODE CAMERA SYSTEM (Dynamic Action / Close Chase / 1st Person Helmet — No Panoramic Override)
      {
        const isPortrait = camera.aspect < 1.0;
        const mode = cameraModeRef.current;
        const speedRatio = Math.min(1, Math.abs(physics.speed) / 32);
        
        // Handle camera reference mode transition between On-Foot (Absolute World Yaw) and Riding (Relative to Heading)
        if (physics.isOnFoot !== prevIsOnFootRef.current) {
          if (physics.isOnFoot) {
            // Dismount: Convert relative orbit to absolute world yaw
            cameraOrbitYawRef.current = physics.heading + cameraOrbitYawRef.current;
          } else {
            // Mount: Convert absolute world yaw back to relative orbit
            cameraOrbitYawRef.current = cameraOrbitYawRef.current - physics.heading;
          }
          prevIsOnFootRef.current = physics.isOnFoot;
        }

        // Effective camera orientation
        const effYaw = physics.isOnFoot ? cameraOrbitYawRef.current : (physics.heading + cameraOrbitYawRef.current);
        const effPitch = cameraOrbitPitchRef.current;

        // Feed current camera yaw to inputsRef so on-foot gesture walking moves relative to current camera perspective!
        inputsRef.current.cameraYaw = effYaw;

        // Auto-recenter camera gently when riding bike at higher speed if user isn't actively dragging
        if (!physics.isOnFoot && !isDraggingCameraRef.current && Math.abs(physics.speed) > 4) {
          cameraOrbitYawRef.current = THREE.MathUtils.damp(cameraOrbitYawRef.current, 0, 1.8, dt);
          cameraOrbitPitchRef.current = THREE.MathUtils.damp(cameraOrbitPitchRef.current, 0, 1.8, dt);
        }

        if (mode === 'first_person') {
          // Helmet POV Camera
          const eyeHeight = physics.isOnFoot ? 1.55 : 1.38 + physics.pitchAngle * 0.35;
          _camTarget.set(
            physics.position.x + Math.sin(physics.heading) * 0.28,
            physics.position.y + eyeHeight,
            physics.position.z + Math.cos(physics.heading) * 0.28
          );
          camera.position.lerp(_camTarget, 1 - Math.exp(-22 * dt));
          _lookAtPos.set(
            physics.position.x + Math.sin(effYaw) * 18 * Math.cos(effPitch),
            physics.position.y + eyeHeight + physics.pitchAngle * 3.5 - Math.sin(effPitch) * 14,
            physics.position.z + Math.cos(effYaw) * 18 * Math.cos(effPitch)
          );
          camera.lookAt(_lookAtPos);
          camBankRollRef.current = THREE.MathUtils.damp(
            camBankRollRef.current,
            physics.leanAngle * 0.55,
            10,
            dt
          );
          camera.rotation.z += camBankRollRef.current;
          const targetFov =
            (isPortrait ? 78 : 72) + speedRatio * 12 + nitroEffectIntensity * 16;
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
        } else {
          // 'dynamic' or 'close' mode
          const isDynamic = mode === 'dynamic';
          const baseDist = physics.isOnFoot
            ? isPortrait
              ? 4.2
              : 3.6
            : mode === 'close'
            ? isPortrait
              ? 4.4
              : 3.8
            : isPortrait
            ? 5.8
            : 5.0;

          const dynamicPullback = isDynamic
            ? speedRatio * 2.1 + nitroEffectIntensity * 1.35
            : speedRatio * 0.8 + nitroEffectIntensity * 0.75;
          const wheelieZoom = isDynamic && physics.isWheelie ? -0.65 : 0;
          const followDist = Math.max(3.0, baseDist + dynamicPullback + wheelieZoom);

          const baseHeight = physics.isOnFoot
            ? 2.05
            : isDynamic && physics.isWheelie
            ? 1.75 // Hero low-angle camera during Grau!
            : (isPortrait ? 2.65 : 2.3) - nitroEffectIntensity * 0.28;

          const pitchCos = Math.cos(effPitch);
          const pitchSin = Math.sin(effPitch);

          // Lateral swing on corners in dynamic mode for cinematic apex framing
          const cornerSwing = isDynamic ? -physics.steerAngle * (1.1 + speedRatio * 1.2) : 0;
          const rightX = Math.cos(effYaw);
          const rightZ = -Math.sin(effYaw);

          _camOffset.set(
            -Math.sin(effYaw) * (followDist * pitchCos) + rightX * cornerSwing,
            baseHeight + followDist * pitchSin,
            -Math.cos(effYaw) * (followDist * pitchCos) + rightZ * cornerSwing
          );

          _camTarget.copy(physics.position).add(_camOffset);

          // Add high-frequency aerodynamic vibration during Nitro
          const totalShake = shakeIntensityRef.current + nitroEffectIntensity * 0.045;
          if (totalShake > 0.008) {
            _camTarget.x += (Math.random() - 0.5) * totalShake;
            _camTarget.y += (Math.random() - 0.5) * totalShake;
            shakeIntensityRef.current = THREE.MathUtils.damp(shakeIntensityRef.current, 0, 8, dt);
          }

          camera.position.lerp(_camTarget, 1 - Math.exp(-(isDynamic ? 9.5 : 11) * dt));

          const lookAhead = physics.isOnFoot
            ? 1.5
            : 3.4 + speedRatio * 2.2 + nitroEffectIntensity * 2.6;
          _lookAtPos.copy(physics.position);
          _lookAtPos.y += physics.isOnFoot ? 1.2 : (isPortrait ? 0.65 : 1.05) + physics.pitchAngle * 0.7;
          _lookAtPos.x += Math.sin(effYaw) * lookAhead * pitchCos;
          _lookAtPos.z += Math.cos(effYaw) * lookAhead * pitchCos;
          _lookAtPos.y -= pitchSin * 1.3;
          camera.lookAt(_lookAtPos);

          // Subtle dynamic Dutch roll bank when leaning into curves
          if (isDynamic) {
            camBankRollRef.current = THREE.MathUtils.damp(
              camBankRollRef.current,
              physics.leanAngle * 0.28,
              8,
              dt
            );
            camera.rotation.z += camBankRollRef.current;
          }

          const baseFov = isPortrait ? 70 : 63;
          const targetFov =
            baseFov +
            (isDynamic ? speedRatio * 11 : speedRatio * 5) +
            nitroEffectIntensity * 17 +
            (traffic.wantedTimer > 0 && isDynamic ? 3 : 0);
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
        }
      }

      camera.updateProjectionMatrix();

      // Render with Dynamic HDR Cinema Grade, Radial Motion Blur & Background Defocus shader (auto-bypassed by LOD Governor on FPS drop)
      if (!isLowPerf && lodManager.shouldUsePostProcessing(nitroEffectIntensity) && composer && nitroShaderPass) {
        const dynSpeedFactor = !physics.isOnFoot
          ? THREE.MathUtils.clamp((physics.getSpeedKmH() - 45) / 115, 0, 1)
          : 0;
        nitroShaderPass.uniforms.uIntensity.value = nitroEffectIntensity;
        nitroShaderPass.uniforms.uSpeedFactor.value = dynSpeedFactor;
        nitroShaderPass.uniforms.uTime.value = elapsedTime;
        // Shift focal center slightly with steering lean
        nitroShaderPass.uniforms.uCenter.value.set(
          0.5 - physics.steerAngle * 0.08,
          isPortrait ? 0.44 : 0.48
        );
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      // Live WebGL Renderer Telemetry for Toggleable Debug Panel (zero React re-renders)
      if (showDebugPanelRef.current && debugMetricsDomRef.current && elapsedTime - lastTelemetryTime < 0.04) {
        const info = renderer.info;
        const fpsVal = Math.round(lodManager.smoothedFps);
        const drawCalls = info.render.calls;
        const tris = info.render.triangles;
        const visNodes = lodManager.visibleManagedNodes;
        const totNodes = lodManager.totalManagedNodes;
        const activeCars = traffic.activeVehicleCount;
        const totalCars = traffic.vehicles.length;
        const camFar = Math.round(camera.far);
        const pxRatio = renderer.getPixelRatio().toFixed(2);
        const dynScale = Math.round(lodManager.lodDistanceScale * 100);
        debugMetricsDomRef.current.textContent =
          `FPS:        ${fpsVal} FPS (Alvo: 60)\n` +
          `Draw Calls: ${drawCalls}\n` +
          `Triângulos: ${tris.toLocaleString('pt-BR')}\n` +
          `Objetos LOD:${visNodes} vis / ${totNodes} total\n` +
          `Cena Root:  ${scene.children.length} nós\n` +
          `Trânsito:   ${activeCars} ativos / ${totalCars} pool\n` +
          `Visão/Fog:  ${camFar}m (Escala Din: ${dynScale}%)\n` +
          `PixelRatio: ${pxRatio}x (${performanceModeRef.current.toUpperCase()})`;
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      sound.stopAmbient();
      sound.stopEngine();
      airport.dispose();
      lodManager.dispose();
      composer?.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [performanceMode]);

  // Sync bike repair trigger
  useEffect(() => {
    if (repairTrigger && repairTrigger > 0) {
      physicsRef.current.repairFull();
    }
  }, [repairTrigger]);

  // Sync bike refuel trigger
  useEffect(() => {
    if (refuelTrigger && refuelTrigger > 0) {
      physicsRef.current.refuelFull();
    }
  }, [refuelTrigger]);

  // Sync full player revive after Game Over / Lose / Bail -> Respawn in a DIFFERENT city location!
  useEffect(() => {
    if (reviveTrigger && reviveTrigger > 0) {
      playerDefeatedTriggeredRef.current = false;
      const newLoc = physicsRef.current.revivePlayerFull();
      cameraOrbitYawRef.current = 0;
      cameraOrbitPitchRef.current = 0;
      prevIsOnFootRef.current = false;
      banditsRef.current?.recoverBikeByPolice(physicsRef.current.position);
      trafficRef.current?.clearWanted();
      onReviveLocationResultRef.current?.(newLoc.name);
    }
  }, [reviveTrigger]);

  // Sync scenario teleportation
  useEffect(() => {
    if (teleportTarget) {
      physicsRef.current.teleportTo(teleportTarget.x, teleportTarget.z, teleportTarget.heading);
    }
  }, [teleportTarget]);

  // Sync On-Foot Jump trigger [Pular]
  useEffect(() => {
    if (!jumpTrigger || jumpTrigger <= 0) return;
    physicsRef.current.triggerJump();
  }, [jumpTrigger]);

  // Sync Special Attack / Fatality trigger
  useEffect(() => {
    if (!specialTrigger) return;
    const physics = physicsRef.current;
    if (!physics.isOnFoot) return;

    physics.triggerMelee('punch');
    shakeIntensityRef.current = 0.95;

    let executedAny = false;
    if (banditsRef.current) {
      const bRes = banditsRef.current.applySpecialExecution(physics.position);
      if (bRes.executed) {
        executedAny = true;
        onMeleeResultRef.current?.('bandit', true, bRes.knockedOffStolenBike);
      }
    }

    if (cityRef.current && typeof cityRef.current.applySpecialExecutionToZombies === 'function') {
      const zRes = cityRef.current.applySpecialExecutionToZombies(physics.position);
      if (zRes) {
        executedAny = true;
      }
    }

    if (executedAny) {
      sound.playCash();
    }
  }, [specialTrigger]);

  // Sync On-Foot Melee Combat trigger [Soco / Empurrar]
  useEffect(() => {
    if (!meleeTrigger) return;
    const physics = physicsRef.current;
    if (!physics.isOnFoot) return;

    const isPush = meleeTrigger.type === 'push';
    const damage = isPush ? 24 : 38;
    physics.triggerMelee(meleeTrigger.type);
    shakeIntensityRef.current = isPush ? 0.35 : 0.45;

    // 1. Check melee hit on Armed Bandits (also knocks them off the stolen bike!)
    if (banditsRef.current) {
      const bRes = banditsRef.current.applyMeleeHit(physics.position, damage, isPush);
      if (bRes.hit) {
        onMeleeResultRef.current?.('bandit', bRes.defeated, bRes.knockedOffStolenBike);
        return;
      }
    }

    // 2. Check melee hit on Traffic Guards or Disembarked Police Officers
    if (trafficRef.current) {
      const aRes = trafficRef.current.applyMeleeHitToAuthorities(
        physics.position,
        damage,
        isPush
      );
      if (aRes.hitOfficer) {
        onMeleeResultRef.current?.('police_officer', aRes.defeatedAny, false);
        return;
      }
      if (aRes.hitGuard) {
        onMeleeResultRef.current?.('guard', aRes.defeatedAny, false);
        onPolicePursuitEventRef.current?.();
        return;
      }
    }

    // 3. Check melee hit on Rival Falcão
    if (rivalRef.current && gameModeRef.current === 'career') {
      const rRes = rivalRef.current.applyMeleeHit(physics.position, damage, isPush);
      if (rRes.hit) {
        onMeleeResultRef.current?.('rival', rRes.defeated, false);
        return;
      }
    }

    // 4. Check melee hit on nearby Pedestrians
    if (cityRef.current) {
      const pRes = cityRef.current.applyMeleeToPedestrians(
        physics.position,
        damage,
        isPush ? 4.2 : 1.5
      );
      if (pRes.hit) {
        onMeleeResultRef.current?.('pedestrian', pRes.defeated, false);
      }
    }
  }, [meleeTrigger]);

  // Sync Dismount / Mount / Hijack Rival Bike trigger
  useEffect(() => {
    if (!mountTrigger || mountTrigger <= 0) return;
    const physics = physicsRef.current;
    const rival = rivalRef.current;
    const rivalPos = rival ? rival.position : new THREE.Vector3(99999, 0, 99999);

    const isRivalAvailable = Boolean(rival && gameModeRef.current === 'career' && rival.hijackedTimer <= 0);
    const isOwnBikeStolen = banditsRef.current?.isRidingPlayerBike ?? false;
    const result = physics.toggleMount(rivalPos, isRivalAvailable, isOwnBikeStolen);

    // Immediately sync 3D meshes so dismounting/mounting reflects on the very same frame
    const bike = bikeMeshRef.current;
    const onFoot = onFootMeshRef.current;
    if (bike) {
      bike.riderMesh.visible = !physics.isOnFoot;
      if (physics.isOnFoot && !isOwnBikeStolen) {
        bike.position.copy(physics.parkedBikePosition);
        bike.rotation.set(0, physics.parkedBikeHeading, -0.16); // Resting on side kickstand
      } else if (!physics.isOnFoot) {
        bike.position.copy(physics.position);
        bike.rotation.set(0, physics.heading, 0);
      }
    }
    if (onFoot) {
      onFoot.visible = physics.isOnFoot;
      if (physics.isOnFoot) {
        onFoot.position.copy(physics.position);
        onFoot.rotation.set(0, physics.heading, 0);
      }
    }

    if (result === 'hijacked_rival' && rival) {
      rival.hijackBike();
      if (bike) {
        if (bike.bodyMesh) {
          (bike.bodyMesh.material as THREE.MeshStandardMaterial).color.set('#eab308');
        }
        if (bike.trunkMesh) {
          const mat = bike.trunkMesh.material as THREE.MeshStandardMaterial;
          mat.map = createTrunkLogoTexture('amarelo');
          mat.needsUpdate = true;
        }
        if (bike.neonMesh) {
          (bike.neonMesh.material as THREE.MeshBasicMaterial).color.setHex(0xa855f7);
          (bike.neonMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        }
        if (bike.neonLight) {
          bike.neonLight.color.setHex(0xa855f7);
          bike.neonLight.intensity = 2.0;
        }
      }
    }

    onMountActionResultRef.current?.(result);
  }, [mountTrigger]);

  // Sync Xingamento / Taunt trigger
  useEffect(() => {
    if (!tauntTrigger) return;
    const physics = physicsRef.current;
    const rival = rivalRef.current;
    const bandits = banditsRef.current;

    if (tauntSpriteRef.current) {
      const mat = tauntSpriteRef.current.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.map = createTauntBubbleTexture(tauntTrigger.phrase);
      mat.needsUpdate = true;
      tauntSpriteRef.current.visible = true;
      tauntTimerRef.current = 3.2;
    }

    let stunnedRival = false;
    if (rival && gameModeRef.current === 'career' && rival.hijackedTimer <= 0) {
      const distToRival = Math.hypot(
        physics.position.x - rival.position.x,
        physics.position.z - rival.position.z
      );
      if (distToRival < 16) {
        rival.intimidate();
        stunnedRival = true;
      }
    }

    const stunnedBandit = bandits ? bandits.onPlayerTaunt(physics.position) : false;
    onTauntResultRef.current?.(tauntTrigger.phrase, stunnedRival, stunnedBandit);
  }, [tauntTrigger]);

  // Sync 190 Police Call Trigger (Dispatches 3D Police Cruiser + Officer to arrest thieves and recover player's bike!)
  useEffect(() => {
    if (!policeCallTrigger || policeCallTrigger <= 0) return;
    const physics = physicsRef.current;
    const bandits = banditsRef.current;
    const traffic = trafficRef.current;

    const res = bandits
      ? bandits.recoverBikeByPolice(physics.position)
      : { hadStolenBike: false, interceptPos: physics.position.clone(), neutralizedCount: 0 };

    if (traffic) {
      traffic.dispatchPoliceRecovery(physics.position, physics.heading);
    }

    // Deliver the recovered motorcycle right in front of the player, repaired to 100%!
    physics.bikeHealth = 100;
    if (physics.isOnFoot) {
      physics.parkedBikePosition.set(
        physics.position.x + Math.sin(physics.heading) * 2.2 - Math.cos(physics.heading) * 1.3,
        0,
        physics.position.z + Math.cos(physics.heading) * 2.2 + Math.sin(physics.heading) * 1.3
      );
      physics.parkedBikeHeading = physics.heading;
      if (bikeMeshRef.current) {
        bikeMeshRef.current.position.copy(physics.parkedBikePosition);
        bikeMeshRef.current.rotation.y = physics.parkedBikeHeading;
        if (bikeMeshRef.current.riderMesh) {
          bikeMeshRef.current.riderMesh.visible = false;
        }
      }
    }

    onPoliceCallResultRef.current?.(res.hadStolenBike, res.neutralizedCount);
  }, [policeCallTrigger]);

  // Sync weather, timeShift & skyTheme changes
  useEffect(() => {
    if (weatherSystemRef.current) {
      weatherSystemRef.current.applyAtmosphere(weatherType, timeShift, skyTheme);
    }
    if (bikeMeshRef.current?.headlightLight) {
      const isDarkNight = timeShift === 'noite';
      const isNightOrStorm =
        isDarkNight ||
        timeShift === 'entardecer' ||
        weatherType === 'storm' ||
        skyTheme === 'cyber_neon' ||
        skyTheme === 'starlight';
      bikeMeshRef.current.headlightLight.intensity = headlightOn
        ? isDarkNight
          ? 13.5
          : isNightOrStorm
          ? 7.5
          : 4.5
        : 0;
    }
  }, [weatherType, timeShift, skyTheme, headlightOn]);

  // Sync bike visual customization changes without recreating the whole scene
  useEffect(() => {
    const bike = bikeMeshRef.current;
    if (!bike) return;

    if (bike.bodyMesh) {
      (bike.bodyMesh.material as THREE.MeshStandardMaterial).color.set(customization.paintColor);
    }

    if (bike.helmetMesh) {
      (bike.helmetMesh.material as THREE.MeshStandardMaterial).color.set(customization.helmetColor);
    }

    if (bike.helmetExtrasGroup) {
      populateHelmetStyleExtras(
        bike.helmetExtrasGroup,
        customization.helmetStyle || 'street',
        customization.helmetColor
      );
    }

    if (bike.decalMat) {
      const dStyle = customization.decalStyle || 'none';
      bike.decalMat.map = createBikeDecalTexture(dStyle);
      bike.decalMat.opacity = dStyle === 'none' ? 0 : 1;
      bike.decalMat.needsUpdate = true;
    }

    const outfitColors = getRiderOutfitColors(customization.riderOutfit);
    if (bike.jacketMat) {
      bike.jacketMat.color.setHex(outfitColors.jacket);
    }
    if (bike.stripeMat) {
      bike.stripeMat.color.setHex(outfitColors.stripe);
    }
    if (bike.pantsMat) {
      bike.pantsMat.color.setHex(outfitColors.pants);
    }

    if (bike.trunkMesh) {
      const mat = bike.trunkMesh.material as THREE.MeshStandardMaterial;
      mat.map = createTrunkLogoTexture(customization.trunkSkin);
      mat.needsUpdate = true;
    }

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
    if (bike.neonMesh) {
      (bike.neonMesh.material as THREE.MeshBasicMaterial).color.setHex(activeNeon);
      (bike.neonMesh.material as THREE.MeshBasicMaterial).opacity = isNeonOn ? 0.85 : 0;
    }
    if (bike.neonLight) {
      bike.neonLight.color.setHex(activeNeon);
      bike.neonLight.intensity = isNeonOn ? 1.8 : 0;
    }
  }, [customization]);

  // Sync performance mode changes
  useEffect(() => {
    if (rendererRef.current) {
      const isLow = performanceMode === 'low';
      const scale =
        performanceMode === 'low'
          ? 1.0
          : performanceMode === 'medium'
          ? Math.min(window.devicePixelRatio, 1.25)
          : Math.min(window.devicePixelRatio, 1.5);
      rendererRef.current.setPixelRatio(scale);
      rendererRef.current.shadowMap.enabled = !isLow;
    }
  }, [performanceMode]);

  // Touch & Pointer Camera Drag Controls (Orbit yaw and pitch on touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If touch target is inside any interactive control, do not drag camera
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, [data-hud-control], [role="button"]')) {
      return;
    }

    const screenW = window.innerWidth || 600;
    const screenH = window.innerHeight || 800;

    // When on foot, left 50% is strictly for walking gestures
    if (physicsRef.current.isOnFoot && e.clientX < screenW * 0.5) {
      return;
    }

    // Bottom corners (where steering arrows and pedals reside) shouldn't trigger camera drags
    if (e.clientY > screenH * 0.65 && (e.clientX < screenW * 0.35 || e.clientX > screenW * 0.55)) {
      return;
    }

    // Double tap quickly resets camera view to forward
    const now = Date.now();
    if (now - lastTapTimeRef.current < 280) {
      cameraOrbitYawRef.current = 0;
      cameraOrbitPitchRef.current = 0;
      lastTapTimeRef.current = 0;
      return;
    }
    lastTapTimeRef.current = now;

    if (cameraPointerIdRef.current !== null) return;
    cameraPointerIdRef.current = e.pointerId;
    isDraggingCameraRef.current = true;
    lastTouchPosRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCameraRef.current || cameraPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - lastTouchPosRef.current.x;
    const dy = e.clientY - lastTouchPosRef.current.y;
    lastTouchPosRef.current = { x: e.clientX, y: e.clientY };

    // Smooth and responsive camera drag sensitivity
    const rotSpeedX = 0.0055;
    const rotSpeedY = 0.004;

    cameraOrbitYawRef.current -= dx * rotSpeedX;
    cameraOrbitPitchRef.current = THREE.MathUtils.clamp(
      cameraOrbitPitchRef.current - dy * rotSpeedY,
      -0.35,
      0.82
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cameraPointerIdRef.current === e.pointerId) {
      isDraggingCameraRef.current = false;
      cameraPointerIdRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900 select-none touch-none">
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      {/* Toggleable Real-Time Performance & renderer.info Debug Panel */}
      <div
        data-hud-control="true"
        className="fixed left-2 bottom-[200px] sm:bottom-6 z-40 flex flex-col items-start gap-1 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => setShowDebugPanel(prev => !prev)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border shadow-md transition active:scale-95 ${
            showDebugPanel
              ? 'bg-emerald-600/95 text-slate-950 border-emerald-300'
              : 'bg-slate-950/80 text-emerald-400 border-emerald-500/40 hover:bg-slate-900'
          }`}
        >
          📊 {showDebugPanel ? 'FECHAR DEBUG' : 'DEBUG FPS'}
        </button>
        {showDebugPanel && (
          <div className="bg-slate-950/92 backdrop-blur-md border border-emerald-500/50 rounded-xl p-2.5 text-[10px] font-mono text-emerald-300 shadow-2xl min-w-[215px]">
            <div className="text-[9px] font-black text-amber-400 uppercase tracking-wider mb-1 border-b border-slate-800 pb-0.5">
              ⚡ WebGL Renderer.info • Telemetria
            </div>
            <pre ref={debugMetricsDomRef} className="leading-tight whitespace-pre font-mono">
              Carregando métricas...
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
