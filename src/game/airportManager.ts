import * as THREE from 'three';
import { sound } from '../audio/soundEngine';

export interface AirportRunway {
  x: number;
  z: number;
  length: number;
  width: number;
  heading: number;
}

interface CommercialAircraft {
  group: THREE.Group;
  fuselageMat: THREE.MeshStandardMaterial;
  engineMats: THREE.MeshStandardMaterial[];
  state: 'taxiing' | 'taking_off' | 'cruising' | 'landing' | 'parked';
  posX: number;
  posZ: number;
  heading: number;
  speed: number;
  altitude: number;
  targetAlt: number;
  actionTimer: number;
  runway: AirportRunway;
  smokeMesh: THREE.Points | null;
  smokeGeometry: THREE.BufferGeometry | null;
  smokePositions: Float32Array;
  isTakingOffTriggered: boolean;
}

/**
 * 3D International Airport & Dynamic Aviation System ("Aeroporto Internacional Metropolitano")
 * Located at X = -750, Z = -1200.
 * Features:
 * - Runways, Passenger Terminal, Control Tower with rotating radar dish.
 * - Dynamic takeoff/landing cycles with particle smoke trails and turbine sound triggers.
 */
export class AirportManager {
  public group: THREE.Group;
  private aircrafts: CommercialAircraft[] = [];
  public runways: AirportRunway[] = [];
  private controlTowerRadar: THREE.Group | null = null;

  constructor(scene: THREE.Scene, isLow: boolean = false) {
    this.group = new THREE.Group();
    this.group.name = 'intercity_airport';

    const airportX = -900;
    const airportZ = -900;
    this.group.position.set(airportX, 0, airportZ);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.15,
    });
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.1,
    });
    const terminalGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transmission: 0.75,
      opacity: 0.85,
      transparent: true,
      roughness: 0.15,
      metalness: 0.1,
      ior: 1.5,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.3,
      metalness: 0.8,
    });

    // 1. Airport Terrain Apron
    const apronGeo = new THREE.PlaneGeometry(420, 360);
    apronGeo.rotateX(-Math.PI / 2);
    const apronMesh = new THREE.Mesh(apronGeo, concreteMat);
    apronMesh.position.set(0, 0.01, 0);
    apronMesh.receiveShadow = !isLow;
    this.group.add(apronMesh);

    // 2. Main Runway
    const mainRunwayGeo = new THREE.PlaneGeometry(54, 340);
    mainRunwayGeo.rotateX(-Math.PI / 2);
    const mainRunway = new THREE.Mesh(mainRunwayGeo, runwayMat);
    mainRunway.position.set(0, 0.016, 0);
    mainRunway.receiveShadow = !isLow;

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const stripeGroup = new THREE.Group();
    for (let sz = -150; sz <= 150; sz += 28) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 14), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.022, sz);
      stripeGroup.add(stripe);
    }
    this.group.add(mainRunway, stripeGroup);

    this.runways.push({
      x: airportX,
      z: airportZ,
      length: 340,
      width: 54,
      heading: 0,
    });

    // 3. Passenger Terminal
    const terminalGroup = new THREE.Group();
    terminalGroup.position.set(110, 0, 0);

    const baseBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(45, 12, 110),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    baseBuilding.position.y = 6;
    baseBuilding.castShadow = !isLow;
    baseBuilding.receiveShadow = !isLow;

    const glassFacade = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 10.5, 104),
      terminalGlassMat
    );
    glassFacade.position.set(23, 5.5, 0);

    const roofAwning = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.8, 120),
      steelMat
    );
    roofAwning.position.set(16, 11.2, 0);
    roofAwning.castShadow = !isLow;

    terminalGroup.add(baseBuilding, glassFacade, roofAwning);
    this.group.add(terminalGroup);

    // 4. Control Tower
    const towerGroup = new THREE.Group();
    towerGroup.position.set(90, 0, -85);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.8, 34, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 })
    );
    shaft.position.y = 17;
    shaft.castShadow = !isLow;

    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 4.2, 6, 12),
      terminalGlassMat
    );
    cab.position.y = 36;
    cab.castShadow = !isLow;

    const roofDome = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      steelMat
    );
    roofDome.position.y = 39;

    const radarDish = new THREE.Group();
    radarDish.position.set(0, 41.5, 0);
    const dishMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.35, 1.2),
      steelMat
    );
    radarDish.add(dishMesh);
    this.controlTowerRadar = radarDish;

    towerGroup.add(shaft, cab, roofDome, radarDish);
    this.group.add(towerGroup);

    // 5. Parked Airliners
    for (let p = 0; p < 3; p++) {
      const airliner = this.createAirlinerMesh(isLow);
      airliner.group.position.set(-85 - p * 55, 0, 60 - p * 45);
      airliner.group.rotation.y = Math.PI / 2;
      airliner.state = 'parked';
      airliner.posX = -85 - p * 55;
      airliner.posZ = 60 - p * 45;
      this.group.add(airliner.group);
      this.aircrafts.push(airliner);
    }

    // 6. Active Dynamic Airliners
    const activeAirliner1 = this.createAirlinerMesh(isLow);
    activeAirliner1.group.position.set(0, 0, -140);
    activeAirliner1.group.rotation.y = 0;
    activeAirliner1.state = 'taking_off';
    activeAirliner1.posX = 0;
    activeAirliner1.posZ = -140;
    activeAirliner1.speed = 45;
    this.group.add(activeAirliner1.group);
    this.aircrafts.push(activeAirliner1);

    const activeAirliner2 = this.createAirlinerMesh(isLow);
    activeAirliner2.group.position.set(0, 220, 280);
    activeAirliner2.group.rotation.y = Math.PI;
    activeAirliner2.state = 'landing';
    activeAirliner2.posX = 0;
    activeAirliner2.posZ = 280;
    activeAirliner2.altitude = 220;
    activeAirliner2.speed = 55;
    this.group.add(activeAirliner2.group);
    this.aircrafts.push(activeAirliner2);

    scene.add(this.group);
  }

  private createAirlinerMesh(isLow: boolean): CommercialAircraft {
    const group = new THREE.Group();

    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.5,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.35,
      metalness: 0.6,
    });
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.2,
      metalness: 0.85,
    });

    const fuselageGeo = new THREE.CylinderGeometry(2.1, 2.1, 38, isLow ? 10 : 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    fuselage.position.y = 3.2;
    fuselage.castShadow = !isLow;

    const noseGeo = new THREE.SphereGeometry(2.1, isLow ? 8 : 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    noseGeo.rotateX(Math.PI);
    const nose = new THREE.Mesh(noseGeo, fuselageMat);
    nose.position.set(0, 3.2, 19);
    nose.castShadow = !isLow;

    const tailFinGeo = new THREE.BoxGeometry(0.35, 5.5, 4.2);
    const tailFin = new THREE.Mesh(tailFinGeo, fuselageMat);
    tailFin.position.set(0, 7.2, -15.5);
    tailFin.rotation.x = -0.35;
    tailFin.castShadow = !isLow;

    const hStabGeo = new THREE.BoxGeometry(9.5, 0.25, 2.6);
    const hStab = new THREE.Mesh(hStabGeo, wingMat);
    hStab.position.set(0, 5.8, -16.5);
    hStab.castShadow = !isLow;

    const wingGeo = new THREE.BoxGeometry(34, 0.38, 5.2);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 3.4, 1.5);
    wing.castShadow = !isLow;

    const engineGeo = new THREE.CylinderGeometry(1.1, 1.1, 4.2, 12);
    engineGeo.rotateX(Math.PI / 2);
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-6.8, 2.3, 2.0);
    leftEngine.castShadow = !isLow;

    const rightEngine = new THREE.Mesh(engineGeo, engineMat);
    rightEngine.position.set(6.8, 2.3, 2.0);
    rightEngine.castShadow = !isLow;

    group.add(fuselage, nose, tailFin, hStab, wing, leftEngine, rightEngine);
    group.scale.setScalar(0.75);

    // Particle smoke trail for takeoff cinematic effect
    const smokeCount = 36;
    const smokePositions = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount * 3; i++) smokePositions[i] = 0;
    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64;
    smokeCanvas.height = 64;
    const sCtx = smokeCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(200, 210, 225, 0.45)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);

    const smokeTex = new THREE.CanvasTexture(smokeCanvas);
    const smokeMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 3.5,
      map: smokeTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const smokeMesh = new THREE.Points(smokeGeometry, smokeMaterial);
    smokeMesh.visible = false;
    group.add(smokeMesh);

    return {
      group,
      fuselageMat,
      engineMats: [engineMat],
      state: 'parked',
      posX: 0,
      posZ: 0,
      heading: 0,
      speed: 0,
      altitude: 0,
      targetAlt: 0,
      actionTimer: Math.random() * 10,
      runway: this.runways[0],
      smokeMesh,
      smokeGeometry,
      smokePositions,
      isTakingOffTriggered: false,
    };
  }

  public update(dt: number, time: number) {
    if (this.controlTowerRadar) {
      this.controlTowerRadar.rotation.y += dt * 1.2;
    }

    for (const ac of this.aircrafts) {
      ac.actionTimer -= dt;

      // Update particle smoke trail if taking off
      if (ac.smokeMesh && ac.smokeGeometry) {
        const mat = ac.smokeMesh.material as THREE.PointsMaterial;
        if (ac.state === 'taking_off') {
          ac.smokeMesh.visible = true;
          mat.opacity = 0.65;
          const posAttr = ac.smokeGeometry.attributes.position as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;

          // Shift smoke particles backward
          for (let i = arr.length - 3; i >= 3; i -= 3) {
            arr[i] = arr[i - 3];
            arr[i + 1] = arr[i - 2];
            arr[i + 2] = arr[i - 1];
          }
          arr[0] = (Math.random() - 0.5) * 1.5;
          arr[1] = 1.2;
          arr[2] = -14.0;
          posAttr.needsUpdate = true;
        } else {
          ac.smokeMesh.visible = false;
          mat.opacity = 0;
        }
      }

      if (ac.state === 'parked') {
        ac.isTakingOffTriggered = false;
        if (ac.actionTimer <= 0) {
          ac.state = 'taxiing';
          ac.posX = -120;
          ac.posZ = -140;
          ac.heading = 0;
          ac.speed = 12;
          ac.actionTimer = 25;
        }
      } else if (ac.state === 'taxiing') {
        ac.posZ += ac.speed * dt;
        ac.group.position.set(ac.posX, ac.altitude, ac.posZ);
        ac.group.rotation.y = ac.heading;

        if (ac.posZ >= -140) {
          ac.state = 'taking_off';
          ac.speed = 35;
          ac.actionTimer = 35;
        }
      } else if (ac.state === 'taking_off') {
        if (!ac.isTakingOffTriggered) {
          ac.isTakingOffTriggered = true;
          sound.playCrash(); // Cinematic turbine roar trigger
        }

        ac.speed = Math.min(95, ac.speed + dt * 18);
        ac.posZ -= ac.speed * dt;
        if (ac.speed > 55) {
          ac.altitude = Math.min(280, ac.altitude + dt * 38);
        }
        ac.group.position.set(ac.posX, ac.altitude, ac.posZ);

        if (ac.posZ < -1100 || ac.altitude >= 280) {
          ac.state = 'cruising';
          ac.actionTimer = 45;
        }
      } else if (ac.state === 'cruising') {
        ac.posZ -= 65 * dt;
        ac.group.position.set(ac.posX, ac.altitude, ac.posZ);

        if (ac.actionTimer <= 0) {
          ac.state = 'landing';
          ac.posX = 0;
          ac.posZ = 1200;
          ac.altitude = 320;
          ac.heading = Math.PI;
          ac.speed = 70;
        }
      } else if (ac.state === 'landing') {
        ac.speed = Math.max(30, ac.speed - dt * 8);
        ac.altitude = Math.max(0, ac.altitude - dt * 26);
        ac.posZ -= ac.speed * dt;
        ac.group.position.set(ac.posX, ac.altitude, ac.posZ);
        ac.group.rotation.y = ac.heading;

        if (ac.altitude <= 0.2 && ac.posZ <= 120) {
          ac.state = 'taxiing';
          ac.speed = 15;
          ac.actionTimer = 30;
        }
      }
    }
  }

  public dispose() {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
