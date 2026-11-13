import * as THREE from 'three';
import { SkyTheme, TimeShift, WeatherConfig, WeatherType } from '../types/game';
import { sound } from '../audio/soundEngine';

export const WEATHER_PRESETS: Record<WeatherType, WeatherConfig> = {
  sunny: {
    id: 'sunny',
    name: 'Céu Limpo',
    description: 'Pista seca, nuvens leves e visibilidade perfeita.',
    icon: '☀️',
    gripMultiplier: 1.0,
    fogDensity: 0.0025,
    skyColor: 0x38bdf8,
    groundWetness: 0.0,
    rainIntensity: 0.0,
    windForce: 0.0,
  },
  rain: {
    id: 'rain',
    name: 'Chuva Tropical',
    description: 'Asfalto molhado! Reduza nas curvas ou instale pneus de chuva.',
    icon: '🌧️',
    gripMultiplier: 0.65,
    fogDensity: 0.007,
    skyColor: 0x334155,
    groundWetness: 0.85,
    rainIntensity: 0.7,
    windForce: 0.35,
  },
  storm: {
    id: 'storm',
    name: 'Tempestade Elétrica',
    description: 'Vento forte e chuva intensa com relâmpagos. Aderência reduzida!',
    icon: '⛈️',
    gripMultiplier: 0.5,
    fogDensity: 0.01,
    skyColor: 0x0f172a,
    groundWetness: 1.0,
    rainIntensity: 1.0,
    windForce: 0.75,
  },
  severe_storm: {
    id: 'severe_storm',
    name: 'Tempestade Severa',
    description: 'Alerta da Defesa Civil! Visibilidade quase nula (<20m), vendaval e aquaplanagem extrema. Reduza para <35 km/h ou busque abrigo!',
    icon: '🌪️',
    gripMultiplier: 0.15,
    fogDensity: 0.038,
    skyColor: 0x020617,
    groundWetness: 1.0,
    rainIntensity: 1.0,
    windForce: 1.0,
  },
  fog: {
    id: 'fog',
    name: 'Neblina Densa',
    description: 'Visibilidade reduzida. Siga o farol da moto e o GPS!',
    icon: '🌫️',
    gripMultiplier: 0.85,
    fogDensity: 0.015,
    skyColor: 0x475569,
    groundWetness: 0.3,
    rainIntensity: 0.0,
    windForce: 0.1,
  },
  sunset: {
    id: 'sunset',
    name: 'Brisa Dourada',
    description: 'Atmosfera quente de fim de tarde com reflexos vibrantes.',
    icon: '🌅',
    gripMultiplier: 0.95,
    fogDensity: 0.0038,
    skyColor: 0xf97316,
    groundWetness: 0.0,
    rainIntensity: 0.0,
    windForce: 0.2,
  },
};

export interface TimeShiftInfo {
  id: TimeShift;
  name: string;
  clockLabel: string;
  icon: string;
  fareBonusPct: number;
  zenithHex: string;
  midHex: string;
  horizonHex: string;
  sunLightHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  starOpacity: number;
  isNight: boolean;
}

export const TIME_SHIFT_PRESETS: Record<TimeShift, TimeShiftInfo> = {
  manha: {
    id: 'manha',
    name: 'Manhã',
    clockLabel: '08:00',
    icon: '🌅',
    fareBonusPct: 0,
    zenithHex: '#0284c7',
    midHex: '#38bdf8',
    horizonHex: '#fef08a',
    sunLightHex: 0xfffbeb,
    sunIntensity: 2.35,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x334155,
    hemiIntensity: 1.15,
    starOpacity: 0.0,
    isNight: false,
  },
  tarde: {
    id: 'tarde',
    name: 'Tarde',
    clockLabel: '14:00',
    icon: '☀️',
    fareBonusPct: 0,
    zenithHex: '#0369a1',
    midHex: '#0ea5e9',
    horizonHex: '#bae6fd',
    sunLightHex: 0xffffff,
    sunIntensity: 2.65,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 1.25,
    starOpacity: 0.0,
    isNight: false,
  },
  entardecer: {
    id: 'entardecer',
    name: 'Entardecer',
    clockLabel: '18:15',
    icon: '🌇',
    fareBonusPct: 10,
    zenithHex: '#1e1b4b',
    midHex: '#c2410c',
    horizonHex: '#facc15',
    sunLightHex: 0xfb923c,
    sunIntensity: 2.0,
    hemiSkyHex: 0xfdba74,
    hemiGroundHex: 0x1e1b4b,
    hemiIntensity: 0.95,
    starOpacity: 0.45,
    isNight: false,
  },
  noite: {
    id: 'noite',
    name: 'Escuridão Total',
    clockLabel: '00:00',
    icon: '🌑',
    fareBonusPct: 45, // +45% Adicional Noturno de Escuridão Total & Criaturas Sinistras!
    zenithHex: '#000000',
    midHex: '#010206',
    horizonHex: '#02040a',
    sunLightHex: 0x1e3a8a,
    sunIntensity: 0.09,
    hemiSkyHex: 0x0f172a,
    hemiGroundHex: 0x000000,
    hemiIntensity: 0.1,
    starOpacity: 1.0,
    isNight: true,
  },
};

export const SKY_THEME_LABELS: Record<SkyTheme, { name: string; icon: string }> = {
  auto: { name: 'Céu Dinâmico (Realista)', icon: '🌤️' },
  tropical: { name: 'Azul Tropical', icon: '🏝️' },
  golden_horizon: { name: 'Horizonte Dourado', icon: '🌅' },
  cyber_neon: { name: 'Aurora Cyber Neon', icon: '🌌' },
  starlight: { name: 'Noite Estrelada', icon: '✨' },
};

export class WeatherSystem {
  public currentWeather: WeatherConfig;
  public currentShift: TimeShift = 'manha';
  public currentSkyTheme: SkyTheme = 'auto';

  private scene: THREE.Scene;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Custom 3D Sky Dome, Sun, Moon, Stars & Volumetric Clouds
  private skyDomeMesh!: THREE.Mesh;
  private skyCanvas!: HTMLCanvasElement;
  private skyTexture!: THREE.CanvasTexture;
  private celestialGroup!: THREE.Group;
  private sunOrb!: THREE.Mesh;
  private moonOrb!: THREE.Mesh;
  private starsPoints!: THREE.Points;
  private cloudsGroup!: THREE.Group;

  // Rain streaks
  private rainLines: THREE.LineSegments | null = null;
  private rainGeo: THREE.BufferGeometry | null = null;
  private rainPositions: Float32Array | null = null;
  private rainCount = 900;

  // Lightning
  private lightningLight: THREE.PointLight;
  private lightningTimer = 0;

  constructor(
    scene: THREE.Scene,
    dirLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    initialType: WeatherType = 'sunny',
    initialShift: TimeShift = 'manha',
    initialSkyTheme: SkyTheme = 'auto',
    isLow: boolean = false
  ) {
    this.scene = scene;
    this.dirLight = dirLight;
    this.hemiLight = hemiLight;
    this.currentWeather = WEATHER_PRESETS[initialType];
    this.currentShift = initialShift;
    this.currentSkyTheme = initialSkyTheme;

    if (isLow) {
      this.rainCount = 350;
    }

    // Lightning light
    this.lightningLight = new THREE.PointLight(0xe0f2fe, 0, 320);
    this.lightningLight.position.set(0, 80, 0);
    this.scene.add(this.lightningLight);

    this.initSkyDomeAndCelestials();
    this.initRainStreaks();
    this.applyAtmosphere(this.currentWeather.id, this.currentShift, this.currentSkyTheme);
  }

  private initSkyDomeAndCelestials() {
    // 1. Gradient Sky Dome Texture
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 64;
    this.skyCanvas.height = 256;
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;

    const skyGeo = new THREE.SphereGeometry(280, 28, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDomeMesh);

    // 2. Celestial Group (Sun & Moon orbiting the city)
    this.celestialGroup = new THREE.Group();
    this.scene.add(this.celestialGroup);

    const sunGeo = new THREE.SphereGeometry(14, 20, 20);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      fog: false,
    });
    this.sunOrb = new THREE.Mesh(sunGeo, sunMat);
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(22, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.35,
        fog: false,
      })
    );
    this.sunOrb.add(sunHalo);
    this.celestialGroup.add(this.sunOrb);

    const moonGeo = new THREE.SphereGeometry(10.5, 20, 20);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      fog: false,
    });
    this.moonOrb = new THREE.Mesh(moonGeo, moonMat);
    const moonHalo = new THREE.Mesh(
      new THREE.SphereGeometry(16.5, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        fog: false,
      })
    );
    this.moonOrb.add(moonHalo);
    this.celestialGroup.add(this.moonOrb);

    // 3. 3D Starfield (500 twinkling stars on upper sky hemisphere)
    const starCount = this.rainCount < 500 ? 150 : 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44; // Above horizon
      const r = 255;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi) + 15;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsPoints);

    // 4. Volumetric-style 3D Drifting Cloud Clusters
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    });

    const totalClusters = this.rainCount < 500 ? 6 : 16;
    for (let c = 0; c < totalClusters; c++) {
      const cluster = new THREE.Group();
      const puffCount = 4 + (c % 3);
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(4.5 + (p % 2) * 2.2, 10, 8),
          cloudMat
        );
        puff.position.set((p - 1.5) * 4.2, (p % 2) * 1.4, (Math.random() - 0.5) * 3.5);
        puff.scale.set(1.3, 0.58, 1.0);
        cluster.add(puff);
      }
      cluster.position.set(
        (Math.random() - 0.5) * 320,
        72 + (c % 4) * 6,
        (Math.random() - 0.5) * 320
      );
      this.cloudsGroup.add(cluster);
    }
    this.scene.add(this.cloudsGroup);
  }

  private initRainStreaks() {
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 6);

    for (let i = 0; i < this.rainCount; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = Math.random() * 36;
      const z = (Math.random() - 0.5) * 70;
      const idx = i * 6;
      this.rainPositions[idx] = x;
      this.rainPositions[idx + 1] = y;
      this.rainPositions[idx + 2] = z;
      this.rainPositions[idx + 3] = x + 0.08;
      this.rainPositions[idx + 4] = y - 0.85;
      this.rainPositions[idx + 5] = z;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.rainLines = new THREE.LineSegments(this.rainGeo, rainMat);
    this.scene.add(this.rainLines);
  }

  public applyWeather(type: WeatherType) {
    this.applyAtmosphere(type, this.currentShift, this.currentSkyTheme);
  }

  public applyAtmosphere(
    weatherType: WeatherType,
    shift: TimeShift = this.currentShift,
    skyTheme: SkyTheme = this.currentSkyTheme
  ) {
    this.currentWeather = WEATHER_PRESETS[weatherType];
    this.currentShift = shift;
    this.currentSkyTheme = skyTheme;

    const shiftInfo = TIME_SHIFT_PRESETS[shift];
    let zenith = shiftInfo.zenithHex;
    let mid = shiftInfo.midHex;
    let horizon = shiftInfo.horizonHex;
    let starOpacity = shiftInfo.starOpacity;

    // Apply custom SkyTheme overrides if selected by the player
    if (skyTheme === 'tropical') {
      zenith = '#0284c7';
      mid = '#38bdf8';
      horizon = '#a5f3fc';
      starOpacity = 0;
    } else if (skyTheme === 'golden_horizon') {
      zenith = '#311042';
      mid = '#ea580c';
      horizon = '#fde047';
      starOpacity = 0.35;
    } else if (skyTheme === 'cyber_neon') {
      zenith = '#090420';
      mid = '#6b21a8';
      horizon = '#06b6d4';
      starOpacity = 0.9;
    } else if (skyTheme === 'starlight') {
      zenith = '#020617';
      mid = '#0f172a';
      horizon = '#1e1b4b';
      starOpacity = 1.0;
    }

    // Weather overcast darkening on rain/storm/fog
    if (weatherType === 'rain') {
      zenith = '#1e293b';
      mid = '#334155';
      horizon = '#64748b';
      starOpacity = 0;
    } else if (weatherType === 'storm') {
      zenith = '#020617';
      mid = '#0f172a';
      horizon = '#1e293b';
      starOpacity = 0;
    } else if (weatherType === 'severe_storm') {
      zenith = '#020617';
      mid = '#050a14';
      horizon = '#0b1120';
      starOpacity = 0;
    } else if (weatherType === 'fog') {
      zenith = '#475569';
      mid = '#64748b';
      horizon = '#94a3b8';
      starOpacity = 0;
    }

    // Paint Sky Dome Gradient
    const ctx = this.skyCanvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, zenith);
    grad.addColorStop(0.45, mid);
    grad.addColorStop(0.78, horizon);
    grad.addColorStop(1.0, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
    this.skyTexture.needsUpdate = true;

    // Fog & Scene Background (Deep Darkness Fog when in Night Mode!)
    const fogColor = new THREE.Color(shift === 'noite' ? '#02040a' : horizon);
    const effectiveFogDensity =
      shift === 'noite'
        ? Math.max(this.currentWeather.fogDensity, 0.0155)
        : this.currentWeather.fogDensity;
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), effectiveFogDensity);
    this.scene.background = fogColor;

    // Position Sun & Moon according to shift
    const isNightLike = shift === 'noite' || skyTheme === 'starlight' || skyTheme === 'cyber_neon';
    this.sunOrb.visible = !isNightLike && weatherType !== 'storm' && weatherType !== 'rain';
    this.moonOrb.visible = isNightLike && weatherType !== 'storm';

    if (shift === 'manha') {
      this.sunOrb.position.set(160, 95, -140);
      this.dirLight.position.set(80, 90, -60);
    } else if (shift === 'tarde') {
      this.sunOrb.position.set(40, 195, -90);
      this.dirLight.position.set(40, 120, 30);
    } else if (shift === 'entardecer') {
      this.sunOrb.position.set(-175, 55, -130);
      this.dirLight.position.set(-90, 55, -50);
    } else {
      this.moonOrb.position.set(-110, 145, -130);
      this.dirLight.position.set(-60, 100, -40);
    }

    // Starfield opacity
    (this.starsPoints.material as THREE.PointsMaterial).opacity = starOpacity;

    // Directional & Hemisphere lighting
    const weatherDim =
      weatherType === 'severe_storm'
        ? 0.22
        : weatherType === 'storm'
        ? 0.45
        : weatherType === 'rain'
        ? 0.65
        : weatherType === 'fog'
        ? 0.7
        : 1.0;

    this.dirLight.color.setHex(shiftInfo.sunLightHex);
    this.dirLight.intensity = shiftInfo.sunIntensity * weatherDim;
    this.hemiLight.color.setHex(shiftInfo.hemiSkyHex);
    this.hemiLight.groundColor.setHex(shiftInfo.hemiGroundHex);
    this.hemiLight.intensity = shiftInfo.hemiIntensity * weatherDim;

    // Audio rain
    if (weatherType === 'rain') {
      sound.setRainActive(true, 0.6);
    } else if (weatherType === 'storm') {
      sound.setRainActive(true, 1.0);
    } else if (weatherType === 'severe_storm') {
      sound.setRainActive(true, 1.35);
    } else {
      sound.setRainActive(false);
    }

    if (this.rainLines) {
      const mat = this.rainLines.material as THREE.LineBasicMaterial;
      mat.opacity = weatherType === 'severe_storm' ? 0.85 : this.currentWeather.rainIntensity > 0 ? 0.55 : 0;
      this.rainLines.visible = this.currentWeather.rainIntensity > 0;
    }
  }

  public update(dt: number, bikeX: number, bikeZ: number) {
    // Keep Sky Dome & Stars centered on player camera horizon
    this.skyDomeMesh.position.set(bikeX, 0, bikeZ);
    this.celestialGroup.position.set(bikeX, 0, bikeZ);
    this.starsPoints.position.set(bikeX, 0, bikeZ);
    this.starsPoints.rotation.y += dt * 0.012;

    // Drift 3D Clouds across the sky
    const isSevere = this.currentWeather.id === 'severe_storm';
    this.cloudsGroup.children.forEach((cluster, idx) => {
      cluster.position.x += (isSevere ? 6.5 : 2.2 + (idx % 3) * 0.6) * dt;
      if (cluster.position.x > bikeX + 180) {
        cluster.position.x = bikeX - 180;
      }
    });

    if (this.rainLines && this.rainPositions && this.currentWeather.rainIntensity > 0) {
      this.rainLines.position.set(bikeX, 0, bikeZ);

      const positions = this.rainPositions;
      const fallSpeed = (isSevere ? 58 : 38) * dt;
      const slantX = isSevere ? 0.28 : 0.08;

      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 6;
        positions[idx + 1] -= fallSpeed;
        positions[idx + 4] -= fallSpeed;

        if (positions[idx + 4] < 0) {
          const newX = (Math.random() - 0.5) * 70;
          const newY = 34 + Math.random() * 6;
          const newZ = (Math.random() - 0.5) * 70;
          positions[idx] = newX;
          positions[idx + 1] = newY;
          positions[idx + 2] = newZ;
          positions[idx + 3] = newX + slantX;
          positions[idx + 4] = newY - (isSevere ? 1.35 : 0.85);
          positions[idx + 5] = newZ;
        }
      }
      this.rainGeo!.attributes.position.needsUpdate = true;
    }

    // Storm lightning effect
    if (this.currentWeather.id === 'storm' || this.currentWeather.id === 'severe_storm') {
      this.lightningTimer += dt;
      const interval = isSevere ? 2.2 + Math.random() * 3.2 : 4.5 + Math.random() * 6;
      if (this.lightningTimer > interval) {
        this.triggerLightning();
        this.lightningTimer = 0;
      }
    }
  }

  private triggerLightning() {
    this.lightningLight.intensity = 8.0;
    sound.playThunder();
    setTimeout(() => {
      this.lightningLight.intensity = 0;
      setTimeout(() => {
        this.lightningLight.intensity = 4.0;
        setTimeout(() => {
          this.lightningLight.intensity = 0;
        }, 60);
      }, 70);
    }, 80);
  }
}
