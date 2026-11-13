import * as THREE from 'three';

export type CinematicPreset = 'bridge' | 'plaza' | 'airport' | 'stadium' | 'rooftop' | 'action_chase';

interface CinematicLocation {
  id: CinematicPreset;
  name: string;
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
  duration: number;
}

const CINEMATIC_LOCATIONS: CinematicLocation[] = [
  {
    id: 'bridge',
    name: '🌉 Ponte Estaiada Intermunicipal',
    target: new THREE.Vector3(175, 2.5, -15),
    cameraPos: new THREE.Vector3(150, 14, 22),
    duration: 5.5,
  },
  {
    id: 'plaza',
    name: '🏛️ Praça Central Rosa dos Ventos',
    target: new THREE.Vector3(-67.2, 1.8, -28),
    cameraPos: new THREE.Vector3(-60, 9, -14),
    duration: 5.0,
  },
  {
    id: 'airport',
    name: '✈️ Aeroporto Internacional Metropolitano',
    target: new THREE.Vector3(-750, 12, -1200),
    cameraPos: new THREE.Vector3(-730, 26, -1140),
    duration: 6.0,
  },
  {
    id: 'stadium',
    name: '⚽ Estádio Maracanã 3D',
    target: new THREE.Vector3(-40, 4, 168),
    cameraPos: new THREE.Vector3(-25, 18, 192),
    duration: 5.5,
  },
  {
    id: 'rooftop',
    name: '🏙️ Mirante Nova Metrópole',
    target: new THREE.Vector3(350, 8, -42),
    cameraPos: new THREE.Vector3(335, 22, -22),
    duration: 5.0,
  },
];

/**
 * Automatic Cinematic Camera Manager ("Câmera Cinematográfica").
 * Automatically triggers epic cinematic fly-by camera angles when the player
 * enters landmark zones (Ponte Estaiada, Praça Central, Aeroporto, Estádio, Mirante),
 * blending camera position and target smoothly with exponential damping.
 */
export class CinematicCameraManager {
  public isActive: boolean = false;
  public currentPresetName: string = '';
  private timer: number = 0;
  private activeLocation: CinematicLocation | null = null;
  private cooldown: number = 0;

  constructor() {}

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    controlsTarget: THREE.Vector3
  ): boolean {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    if (this.isActive && this.activeLocation) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.exitCinematic();
        return false;
      }

      // Smoothly damp camera toward cinematic vantage point
      const targetPos = this.activeLocation.cameraPos.clone();
      // Orbit gently around landmark target
      const angle = (this.activeLocation.duration - this.timer) * 0.35;
      targetPos.x += Math.sin(angle) * 12;
      targetPos.z += Math.cos(angle) * 12;

      camera.position.lerp(targetPos, 1 - Math.exp(-4.5 * dt));
      controlsTarget.lerp(this.activeLocation.target, 1 - Math.exp(-6.0 * dt));
      camera.lookAt(controlsTarget);
      camera.fov = THREE.MathUtils.damp(camera.fov, 52, 6, dt);
      camera.updateProjectionMatrix();

      return true;
    }

    // Check if player enters any cinematic zone (and cooldown has expired)
    if (this.cooldown <= 0 && Math.random() < 0.003) {
      for (const loc of CINEMATIC_LOCATIONS) {
        const dist = Math.hypot(playerPos.x - loc.target.x, playerPos.z - loc.target.z);
        if (dist < 45) {
          this.enterCinematic(loc);
          break;
        }
      }
    }

    return false;
  }

  public enterCinematicById(id: CinematicPreset) {
    const loc = CINEMATIC_LOCATIONS.find(l => l.id === id);
    if (loc) {
      this.enterCinematic(loc);
    }
  }

  private enterCinematic(loc: CinematicLocation) {
    this.isActive = true;
    this.activeLocation = loc;
    this.currentPresetName = loc.name;
    this.timer = loc.duration;
  }

  public exitCinematic() {
    this.isActive = false;
    this.activeLocation = null;
    this.currentPresetName = '';
    this.cooldown = 35.0; // 35 seconds cooldown between automatic cinematic interludes
  }
}
