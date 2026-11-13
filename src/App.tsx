import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  BikeCustomization,
  BikeUpgrades,
  CameraMode,
  DeliveryOrder,
  DistrictId,
  GameMode,
  PlayerStats,
  SkyTheme,
  TimeShift,
  WeatherType,
} from './types/game';
import { DISTRICTS, generateDeliveryOrder } from './game/cityMap';
import { TIME_SHIFT_PRESETS, WEATHER_PRESETS } from './game/weatherManager';
import { InputState } from './game/physics';
import { sound } from './audio/soundEngine';
import { GameCanvas } from './game/GameCanvas';
import { HUD, DeliveryCelebrationData } from './components/HUD';
import { TitleScreen } from './components/TitleScreen';
import { ShopModal } from './components/ShopModal';
import { PauseModal } from './components/PauseModal';
import { DistrictUnlockModal } from './components/DistrictUnlockModal';
import { DailyMission, loadDailyMissions, saveDailyMissions } from './game/missions';
import { MissionsModal } from './components/MissionsModal';
import { SmartphoneModal } from './components/SmartphoneModal';
import { GunShopModal } from './components/GunShopModal';
import { MobileWorkshopModal } from './components/MobileWorkshopModal';
import { CityMapModal } from './components/CityMapModal';
import { motion } from 'motion/react';

// Storage keys
const STORAGE_STATS = 'motoboy_stats_v1';
const STORAGE_UPGRADES = 'motoboy_upgrades_v1';
const STORAGE_CUSTOM = 'motoboy_custom_v1';
const STORAGE_SENSITIVITY = 'motoboy_sensitivity_v1';

const DEFAULT_STATS: PlayerStats = {
  coins: 80, // Starting pocket money for initial tuning
  completedDeliveries: 0,
  rating: 5.0,
  totalGrauPoints: 0,
  distanceTraveledKm: 0,
};

const DEFAULT_UPGRADES: BikeUpgrades = {
  engineLevel: 1,
  accelerationLevel: 1,
  brakesLevel: 1,
  tiresLevel: 1,
  trunkLevel: 1,
  nitroUnlocked: false,
};

const DEFAULT_CUSTOM: BikeCustomization = {
  paintColor: '#dc2626', // Brazilian red CG style
  trunkSkin: 'ifood', // Classic red delivery trunk
  helmetColor: '#1e293b',
  neonColor: 'none',
  exhaustType: 'stock',
};

const SHIFT_SEQUENCE: TimeShift[] = ['manha', 'tarde', 'entardecer', 'noite'];
const CAMERA_SEQUENCE: CameraMode[] = ['dynamic', 'close', 'first_person', 'helicopter'];

export default function App() {
  // Game screens: 'title' | 'playing'
  const [gameState, setGameState] = useState<'title' | 'playing'>('title');
  const [gameMode, setGameMode] = useState<GameMode>('career');
  const [cameraMode, setCameraMode] = useState<CameraMode>('dynamic');
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isArrested, setIsArrested] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Persistent stats
  const [stats, setStats] = useState<PlayerStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STATS);
      return saved ? JSON.parse(saved) : DEFAULT_STATS;
    } catch {
      return DEFAULT_STATS;
    }
  });

  // Persistent upgrades
  const [upgrades, setUpgrades] = useState<BikeUpgrades>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_UPGRADES);
      return saved ? JSON.parse(saved) : DEFAULT_UPGRADES;
    } catch {
      return DEFAULT_UPGRADES;
    }
  });

  // Persistent customization
  const [customization, setCustomization] = useState<BikeCustomization>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM);
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM;
    } catch {
      return DEFAULT_CUSTOM;
    }
  });

  // Save changes
  useEffect(() => {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_UPGRADES, JSON.stringify(upgrades));
  }, [upgrades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(customization));
  }, [customization]);

  // Persistence for control sensitivity
  const [sensitivity, setSensitivity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SENSITIVITY);
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_SENSITIVITY, sensitivity.toString());
  }, [sensitivity]);

  // Weather, Time Shift & Custom Sky Theme state
  const [weatherType, setWeatherType] = useState<WeatherType>('sunny');
  const [timeShift, setTimeShift] = useState<TimeShift>('tarde');
  const [skyTheme, setSkyTheme] = useState<SkyTheme>('auto');
  const [headlightOn, setHeadlightOn] = useState<boolean>(true);
  const handleToggleHeadlight = useCallback(() => {
    setHeadlightOn(prev => {
      const next = !prev;
      sound.playCash();
      showBanner(
        next ? '💡 FAROL LIGADO' : '💡 FAROL DESLIGADO',
        next ? 'Faróis dianteiros acesos para iluminação.' : 'Faróis apagados.',
        '💡',
        next ? 'pickup' : 'deliver'
      );
      return next;
    });
  }, []);
  const [autoDynamicCycle, setAutoDynamicCycle] = useState<boolean>(true);
  const [trainingRingsPassed, setTrainingRingsPassed] = useState<number>(0);
  const [teleportTarget, setTeleportTarget] = useState<{
    x: number;
    z: number;
    heading: number;
    seq: number;
  } | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'low' | 'high'>('high');
  const [isTrafficJam, setIsTrafficJam] = useState<boolean>(true);

  const weatherConfig = WEATHER_PRESETS[weatherType];

  // Telemetry updated from GameCanvas
  const [telemetry, setTelemetry] = useState({
    speedKmH: 0,
    gear: 1,
    rpmRatio: 0,
    nitroPct: 100,
    isNitroActive: false,
    bikeHealth: 100,
    playerHealth: 100,
    policeWantedSeconds: 0,
    policeOfficersChasingOnFoot: false,
    isWheelie: false,
    isOnFoot: false,
    distToOwnBikeM: 0,
    isOwnBikeStolen: false,
    canHijackRival: false,
    nearestBanditDistM: 999,
    currentDistrict: 'centro' as DistrictId,
    distanceToTargetM: 0,
    rivalDistanceToTargetM: 0,
    rivalHasPackage: false,
    bikeHeading: 0,
    targetHeading: 0,
    posX: 0,
    posZ: 0,
    isSheltered: false,
    shelterName: '',
    isSevereStorm: false,
    isAquaplaning: false,
  });

  // District unlock announcement modal
  const [unlockedDistrictModal, setUnlockedDistrictModal] = useState<typeof DISTRICTS.centro | null>(null);

  // Daily Missions & Smartphone / Gun Shop Modals
  const [missions, setMissions] = useState<DailyMission[]>(() => loadDailyMissions());
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [isGunShopOpen, setIsGunShopOpen] = useState(false);
  const [isMobileWorkshopOpen, setIsMobileWorkshopOpen] = useState(false);
  const [isCityMapOpen, setIsCityMapOpen] = useState(false);

  const updateMissionProgress = useCallback((missionId: string, delta: number) => {
    setMissions(prev => {
      const next = prev.map(m => {
        if (m.id === missionId && !m.completed) {
          const newProg = Math.min(m.target, m.progress + delta);
          const isCompleted = newProg >= m.target;
          return {
            ...m,
            progress: newProg,
            completed: isCompleted,
          };
        }
        return m;
      });
      saveDailyMissions(next);
      return next;
    });
  }, []);

  const handleClaimMissionReward = (missionId: string, reward: number) => {
    sound.playCash();
    setMissions(prev => {
      const next = prev.map(m => {
        if (m.id === missionId && m.completed && !m.claimed) {
          return { ...m, claimed: true };
        }
        return m;
      });
      saveDailyMissions(next);
      return next;
    });
    setStats(prev => ({ ...prev, coins: prev.coins + reward }));
    showBanner(`🎯 MISSÃO CONCLUÍDA! +R$ ${reward}`, 'Recompensa diária resgatada com sucesso!', '🎁', 'deliver');
  };

  // Track Grau time for Daily Mission
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || isShopOpen || isGameOver || isArrested || !telemetry.isWheelie) return;
    const timer = setInterval(() => {
      updateMissionProgress('grau_10s', 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, isPaused, isShopOpen, isGameOver, isArrested, telemetry.isWheelie, updateMissionProgress]);

  // Determine unlocked districts list (all 6 scenarios in Career progression)
  const getUnlockedDistricts = useCallback((): DistrictId[] => {
    const list: DistrictId[] = ['centro', 'industrial', 'nova_cidade', 'autodromo'];
    if (stats.completedDeliveries >= DISTRICTS.jardins.deliveriesNeeded) list.push('jardins');
    if (stats.completedDeliveries >= DISTRICTS.favela.deliveriesNeeded) list.push('favela');
    if (stats.completedDeliveries >= DISTRICTS.orla.deliveriesNeeded) list.push('orla');
    if (stats.completedDeliveries >= DISTRICTS.autodromo.deliveriesNeeded) list.push('autodromo');
    return list;
  }, [stats.completedDeliveries]);

  // Current Delivery Order
  const [currentOrder, setCurrentOrder] = useState<DeliveryOrder | null>(null);

  // Spawns a new delivery order
  const spawnNewOrder = useCallback(() => {
    const unlocked = getUnlockedDistricts();
    const trunkMultiplier = 1 + (upgrades.trunkLevel - 1) * 0.2;
    const order = generateDeliveryOrder(unlocked, trunkMultiplier);
    setCurrentOrder(order);
  }, [getUnlockedDistricts, upgrades.trunkLevel]);

  const [crashFlash, setCrashFlash] = useState(false);
  const [repairTrigger, setRepairTrigger] = useState(0);
  const [reviveTrigger, setReviveTrigger] = useState(0);
  const [mountTrigger, setMountTrigger] = useState(0);
  const [jumpTrigger, setJumpTrigger] = useState(0);
  const [meleeTrigger, setMeleeTrigger] = useState<{ seq: number; type: 'punch' | 'push' } | null>(
    null
  );
  const [specialTrigger, setSpecialTrigger] = useState<{ seq: number } | null>(null);

  const handleTriggerSpecial = useCallback(() => {
    setSpecialTrigger({ seq: Date.now() });
    showBanner('⚡ FATALITY / GOLPE ESPECIAL!', 'Ataque supremo executado com sucesso!', '⚡', 'pickup');
    sound.playCash();
  }, []);

  const [tauntTrigger, setTauntTrigger] = useState<{ seq: number; phrase: string } | null>(null);
  const [policeCallTrigger, setPoliceCallTrigger] = useState(0);

  const TAUNT_PHRASES = [
    'DESCE DA MOTO, FALCÃO!',
    'PASSA A MOTO AGORA, CONCORRENTE!',
    'SAI DA FRENTE, BARBEIRO!',
    'OLHA A SETA, MOTORISTA!',
    'AQUI É REIS DO GRAU, RAPÁ!',
    'PERDEU A CORRIDA, VACILÃO!',
  ];

  // Event toast banner for restaurant pickup / customer delivery
  const [eventBanner, setEventBanner] = useState<{
    title: string;
    subtitle: string;
    icon: string;
    type: 'pickup' | 'deliver';
  } | null>(null);
  const [deliveryCelebration, setDeliveryCelebration] = useState<DeliveryCelebrationData | null>(null);

  const showBanner = useCallback(
    (title: string, subtitle: string, icon: string, type: 'pickup' | 'deliver') => {
      setEventBanner({ title, subtitle, icon, type });
      setTimeout(() => {
        setEventBanner(prev => (prev?.title === title ? null : prev));
      }, 2400);
    },
    []
  );

  const handleCallPolice = useCallback(() => {
    setIsPhoneOpen(false);
    setPoliceCallTrigger(prev => prev + 1);
    sound.playPoliceSiren();
  }, []);

  const handlePoliceCallResult = useCallback(
    (hadStolenBike: boolean, neutralizedCount: number) => {
      setTelemetry(prev => ({
        ...prev,
        isOwnBikeStolen: false,
        distToOwnBikeM: 18,
        bikeHealth: 100,
        policeWantedSeconds: 0,
        policeOfficersChasingOnFoot: false,
      }));

      if (hadStolenBike || neutralizedCount > 0) {
        sound.playCash();
        setStats(prev => ({ ...prev, coins: prev.coins + 30 }));
        showBanner(
          '🚔 PM 190 CHEGOU! MOTO RECUPERADA! (+R$ 30)',
          'A viatura interceptou o ladrão e trouxe sua moto 100% inteira na sua frente! Aperte MONTAR [F]!',
          '🚓',
          'deliver'
        );
      } else {
        showBanner(
          '🚔 VIATURA PM 190 NO LOCAL!',
          'A Polícia Militar chegou à sua frente e estacionou sua moto revisada ao seu lado!',
          '🚓',
          'deliver'
        );
      }
    },
    [showBanner]
  );

  const handleCallRival = useCallback(() => {
    setIsPhoneOpen(false);
    showBanner(
      '🦅 PROVOCAÇÃO PARA FALCÃO',
      'Você ligou provocando o concorrente Falcão! Ele ficou surpreso e perdeu o ritmo!',
      '🦅',
      'pickup'
    );
    sound.playTaunt('Cuidado no trânsito!');
  }, [showBanner]);

  const handleBuyGunItem = useCallback((itemName: string, cost: number, effect: string) => {
    setStats(prev => ({ ...prev, coins: prev.coins - cost }));
    showBanner(
      `🔫 ${itemName.toUpperCase()} EQUIPADO`,
      `Proteção ativada: ${effect}!`,
      '🛡️',
      'pickup'
    );
  }, [showBanner]);

  const handleCycleCamera = useCallback(() => {
    setCameraMode(prev => {
      const idx = CAMERA_SEQUENCE.indexOf(prev);
      const next = CAMERA_SEQUENCE[(idx + 1) % CAMERA_SEQUENCE.length];
      const names: Record<CameraMode, string> = {
        dynamic: 'CÂMERA DINÂMICA (INCLINAÇÃO + VELOCIDADE)',
        close: 'CÂMERA DE PERSEGUIÇÃO PRÓXIMA',
        first_person: 'CÂMERA 1ª PESSOA (CAPACETE POV)',
        helicopter: 'CÂMERA HELICÓPTERO (VISÃO AÉREA)',
      };
      showBanner(`🎥 ${names[next]}`, 'Atalho: Tecla [C] ou botão Câmera no topo', '🎥', 'deliver');
      return next;
    });
  }, [showBanner]);

  const handleTriggerTaunt = useCallback(() => {
    const phrase = TAUNT_PHRASES[Math.floor(Math.random() * TAUNT_PHRASES.length)];
    sound.playTaunt(phrase);
    setTauntTrigger({ seq: Date.now(), phrase });
  }, []);

  // Alert banner when severe storm strikes
  useEffect(() => {
    if (weatherType === 'severe_storm') {
      showBanner(
        '🌪️ ALERTA: TEMPESTADE SEVERA!',
        'Visibilidade crítica e pista com aquaplanagem! Reduza (<35 km/h) ou busque abrigo!',
        '🌪️',
        'pickup'
      );
    }
  }, [weatherType, showBanner]);

  const gameRootRef = useRef<HTMLDivElement>(null);

  // Keyboard & touch input ref
  const inputsRef = useRef<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    wheelie: false,
    nitro: false,
    horn: false,
    analogSteer: 0,
    sensitivity: 1.0,
  });

  // Sync sensitivity with inputsRef whenever it changes
  useEffect(() => {
    inputsRef.current.sensitivity = sensitivity;
  }, [sensitivity]);

  const [activeInputs, setActiveInputs] = useState<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    wheelie: false,
    nitro: false,
    horn: false,
    analogSteer: 0,
  });

  const syncInputs = useCallback(() => {
    setActiveInputs({ ...inputsRef.current });
  }, []);

  const lastMountTimeRef = useRef<number>(0);

  const handleToggleMount = useCallback(() => {
    const now = performance.now();
    if (now - lastMountTimeRef.current < 280) return;
    lastMountTimeRef.current = now;

    // Clear all inputs when switching mount state so forward pedal or steer never persists
    inputsRef.current.forward = false;
    inputsRef.current.backward = false;
    inputsRef.current.left = false;
    inputsRef.current.right = false;
    inputsRef.current.wheelie = false;
    inputsRef.current.nitro = false;
    inputsRef.current.horn = false;
    inputsRef.current.analogSteer = 0;
    inputsRef.current.gestureActive = false;
    inputsRef.current.gestureMagnitude = 0;
    syncInputs();
    setMountTrigger(prev => prev + 1);
  }, [syncInputs]);

  const handleTriggerJump = useCallback(() => {
    setJumpTrigger(prev => prev + 1);
  }, []);

  const handleTriggerMelee = useCallback((type: 'punch' | 'push') => {
    setMeleeTrigger({ seq: Date.now(), type });
  }, []);

  // Automatically focus the game root container when playing
  useEffect(() => {
    if (gameState === 'playing' && !isShopOpen && !isPaused && !isGameOver && !isArrested) {
      window.focus();
      gameRootRef.current?.focus();
    }
  }, [gameState, isShopOpen, isPaused, isGameOver, isArrested]);

  // Setup initial order when game starts
  useEffect(() => {
    if (gameState === 'playing' && !currentOrder) {
      spawnNewOrder();
    }
  }, [gameState, currentOrder, spawnNewOrder]);

  // Order countdown timer (only runs in Career Mode)
  const hasCurrentOrder = !!currentOrder;
  useEffect(() => {
    if (
      gameState !== 'playing' ||
      gameMode !== 'career' ||
      isPaused ||
      isGameOver ||
      isArrested ||
      !hasCurrentOrder
    )
      return;

    const timer = setInterval(() => {
      setCurrentOrder(prev => {
        if (!prev) return null;
        const remaining = prev.timeRemainingSeconds - 1;
        if (remaining <= 0) {
          sound.playCrash();
          const unlocked = getUnlockedDistricts();
          return generateDeliveryOrder(unlocked);
        }
        return { ...prev, timeRemainingSeconds: remaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, gameMode, isPaused, isGameOver, isArrested, hasCurrentOrder, getUnlockedDistricts]);

  // Automatic Dynamic Time Shift & Weather Progression
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || isGameOver || isArrested || !autoDynamicCycle)
      return;

    const cycleTimer = setInterval(() => {
      setTimeShift(prev => {
        const idx = SHIFT_SEQUENCE.indexOf(prev);
        const nextShift = SHIFT_SEQUENCE[(idx + 1) % SHIFT_SEQUENCE.length];
        return nextShift;
      });
      if (Math.random() < 0.45) {
        const weathers: WeatherType[] = ['sunny', 'rain', 'storm', 'fog', 'sunset', 'severe_storm'];
        const nextW = weathers[Math.floor(Math.random() * weathers.length)];
        setWeatherType(nextW);
      }
    }, 45000);

    return () => clearInterval(cycleTimer);
  }, [gameState, isPaused, isGameOver, isArrested, autoDynamicCycle]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.code || '';

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space' ||
        key === ' '
      ) {
        if (gameState === 'playing') {
          e.preventDefault();
        }
      }

      if (!e.repeat && gameState === 'playing' && !isShopOpen && !isPaused && !isGameOver) {
        if (code === 'KeyF' || key === 'f') {
          handleToggleMount();
          return;
        }
        if (code === 'KeyX' || key === 'x') {
          handleTriggerTaunt();
          return;
        }
        if (code === 'KeyC' || key === 'c') {
          handleCycleCamera();
          return;
        }
        if (code === 'KeyJ' || key === 'j') {
          handleTriggerMelee('punch');
          return;
        }
        if (code === 'KeyK' || key === 'k') {
          handleTriggerMelee('push');
          return;
        }
        if (code === 'KeyL' || key === 'l' || code === 'KeyE' || key === 'e') {
          handleTriggerSpecial();
          return;
        }
        if ((code === 'Space' || key === ' ') && telemetry.isOnFoot) {
          handleTriggerJump();
          return;
        }
      }

      let changed = false;
      if (code === 'KeyW' || key === 'w' || key === 'arrowup' || code === 'ArrowUp') {
        if (!inputsRef.current.forward) {
          inputsRef.current.forward = true;
          changed = true;
        }
      }
      if (code === 'KeyS' || key === 's' || key === 'arrowdown' || code === 'ArrowDown') {
        if (!inputsRef.current.backward) {
          inputsRef.current.backward = true;
          changed = true;
        }
      }
      if (code === 'KeyA' || key === 'a' || key === 'arrowleft' || code === 'ArrowLeft') {
        if (!inputsRef.current.left) {
          inputsRef.current.left = true;
          changed = true;
        }
      }
      if (code === 'KeyD' || key === 'd' || key === 'arrowright' || code === 'ArrowRight') {
        if (!inputsRef.current.right) {
          inputsRef.current.right = true;
          changed = true;
        }
      }
      if (
        code === 'Space' ||
        key === ' ' ||
        key === 'spacebar' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        key === 'shift'
      ) {
        if (!inputsRef.current.wheelie) {
          inputsRef.current.wheelie = true;
          changed = true;
        }
      }
      if (code === 'KeyN' || key === 'n' || code === 'KeyE' || key === 'e') {
        if (!inputsRef.current.nitro) {
          inputsRef.current.nitro = true;
          changed = true;
        }
      }
      if (code === 'KeyH' || key === 'h' || code === 'KeyB' || key === 'b') {
        if (!inputsRef.current.horn) {
          inputsRef.current.horn = true;
          changed = true;
        }
      }
      if (code === 'KeyL' || key === 'l') {
        handleToggleHeadlight();
        return;
      }

      if (changed) {
        syncInputs();
        if (gameState === 'title' && !isShopOpen) {
          setGameState('playing');
          sound.startEngine(customization.exhaustType);
        }
      }

      if (code === 'Escape' || key === 'escape') {
        if (isShopOpen) {
          setIsShopOpen(false);
        } else if (gameState === 'playing' && !isGameOver) {
          setIsPaused(prev => !prev);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.code || '';

      let changed = false;
      if (code === 'KeyW' || key === 'w' || key === 'arrowup' || code === 'ArrowUp') {
        inputsRef.current.forward = false;
        changed = true;
      }
      if (code === 'KeyS' || key === 's' || key === 'arrowdown' || code === 'ArrowDown') {
        inputsRef.current.backward = false;
        changed = true;
      }
      if (code === 'KeyA' || key === 'a' || key === 'arrowleft' || code === 'ArrowLeft') {
        inputsRef.current.left = false;
        changed = true;
      }
      if (code === 'KeyD' || key === 'd' || key === 'arrowright' || code === 'ArrowRight') {
        inputsRef.current.right = false;
        changed = true;
      }
      if (
        code === 'Space' ||
        key === ' ' ||
        key === 'spacebar' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        key === 'shift'
      ) {
        inputsRef.current.wheelie = false;
        changed = true;
      }
      if (code === 'KeyN' || key === 'n' || code === 'KeyE' || key === 'e') {
        inputsRef.current.nitro = false;
        changed = true;
      }
      if (code === 'KeyH' || key === 'h' || code === 'KeyB' || key === 'b') {
        inputsRef.current.horn = false;
        changed = true;
      }

      if (changed) syncInputs();
    };

    const handleBlur = () => {
      inputsRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        wheelie: false,
        nitro: false,
        horn: false,
        analogSteer: 0,
      };
      syncInputs();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    gameState,
    isShopOpen,
    isPaused,
    isGameOver,
    telemetry.isOnFoot,
    syncInputs,
    handleToggleMount,
    handleTriggerTaunt,
    handleCycleCamera,
    handleTriggerJump,
    handleTriggerMelee,
    customization.exhaustType,
  ]);

  // Touch / Pointer control simulation
  const handleTouchInput = useCallback((key: string, pressed: boolean) => {
    if (key === 'forward') inputsRef.current.forward = pressed;
    if (key === 'backward') inputsRef.current.backward = pressed;
    if (key === 'left') inputsRef.current.left = pressed;
    if (key === 'right') inputsRef.current.right = pressed;
    if (key === 'wheelie') inputsRef.current.wheelie = pressed;
    if (key === 'nitro') inputsRef.current.nitro = pressed;
    if (key === 'horn') inputsRef.current.horn = pressed;
    syncInputs();
  }, [syncInputs]);

  const handleAnalogSteer = useCallback((val: number) => {
    inputsRef.current.analogSteer = val;
  }, []);

  const handleGestureMove = useCallback((angle: number, magnitude: number, active: boolean) => {
    inputsRef.current.gestureActive = active && magnitude > 0.05;
    inputsRef.current.gestureAngle = angle;
    inputsRef.current.gestureMagnitude = active ? magnitude : 0;
  }, []);

  // Checkpoint: Pickup at Hamburgueria / Pizzaria / Restaurante
  const handleOrderPickup = () => {
    if (!currentOrder || currentOrder.state !== 'to_pickup') return;
    showBanner(
      `PEDIDO COLETADO • ${currentOrder.restaurantCategory.toUpperCase()}`,
      `${currentOrder.restaurantName}: ${currentOrder.itemTitle}`,
      currentOrder.icon,
      'pickup'
    );
    setCurrentOrder(prev => (prev ? { ...prev, state: 'to_deliver' } : null));
  };

  // Checkpoint: Deliver to Customer
  const handleOrderDeliver = () => {
    if (!currentOrder || currentOrder.state !== 'to_deliver') return;

    const elapsedSec = currentOrder.timeLimitSeconds - currentOrder.timeRemainingSeconds;
    if (elapsedSec < 60) {
      updateMissionProgress('fast_delivery', 1);
    }
    if (timeShift === 'noite' || timeShift === 'entardecer') {
      updateMissionProgress('night_deliveries', 1);
    }

    const shiftMult = 1 + TIME_SHIFT_PRESETS[timeShift].fareBonusPct / 100;
    const baseReward = Math.round(currentOrder.rewardCoins * shiftMult);
    const speedRatio = currentOrder.timeRemainingSeconds / currentOrder.timeLimitSeconds;
    const earnedTip = Math.round(currentOrder.tipPotential * Math.max(0.2, speedRatio));
    const totalEarnings = baseReward + earnedTip;

    const prevCompletedCount = stats.completedDeliveries;
    const newCompletedCount = prevCompletedCount + 1;
    const newRating = Math.min(5.0, Number((stats.rating + 0.05).toFixed(2)));

    let targetCount = 3;
    let milestoneLabel = 'Desbloquear Bairro dos Jardins';
    let prevProgressPct = (prevCompletedCount / 3) * 100;
    let nextProgressPct = (newCompletedCount / 3) * 100;

    if (prevCompletedCount >= 14) {
      const cyclePrev = prevCompletedCount % 5;
      targetCount = prevCompletedCount - cyclePrev + 5;
      milestoneLabel = 'Bônus Lenda das Entregas';
      prevProgressPct = (cyclePrev / 5) * 100;
      nextProgressPct = ((cyclePrev + 1) / 5) * 100;
    } else if (prevCompletedCount >= 10) {
      targetCount = 14;
      milestoneLabel = 'Desbloquear Polo Industrial & Porto';
      prevProgressPct = ((prevCompletedCount - 10) / 4) * 100;
      nextProgressPct = ((newCompletedCount - 10) / 4) * 100;
    } else if (prevCompletedCount >= 6) {
      targetCount = 10;
      milestoneLabel = 'Desbloquear Orla da Praia';
      prevProgressPct = ((prevCompletedCount - 6) / 4) * 100;
      nextProgressPct = ((newCompletedCount - 6) / 4) * 100;
    } else if (prevCompletedCount >= 3) {
      targetCount = 6;
      milestoneLabel = 'Desbloquear Morro do Sol';
      prevProgressPct = ((prevCompletedCount - 3) / 3) * 100;
      nextProgressPct = ((newCompletedCount - 3) / 3) * 100;
    }

    const celebrationId = Date.now();
    setDeliveryCelebration({
      id: celebrationId,
      customerName: currentOrder.customerName,
      itemTitle: currentOrder.itemTitle,
      icon: currentOrder.icon,
      baseReward,
      earnedTip,
      totalEarnings,
      completedCount: newCompletedCount,
      targetCount,
      milestoneLabel,
      prevProgressPct,
      nextProgressPct,
      rating: newRating,
      isNightBonus: timeShift === 'noite',
    });
    setTimeout(() => {
      setDeliveryCelebration(prev => (prev?.id === celebrationId ? null : prev));
    }, 4200);

    setStats(prev => ({
      ...prev,
      coins: prev.coins + totalEarnings,
      completedDeliveries: newCompletedCount,
      rating: newRating,
    }));

    if (newCompletedCount === DISTRICTS.jardins.deliveriesNeeded) {
      setUnlockedDistrictModal(DISTRICTS.jardins);
    } else if (newCompletedCount === DISTRICTS.favela.deliveriesNeeded) {
      setUnlockedDistrictModal(DISTRICTS.favela);
    } else if (newCompletedCount === DISTRICTS.orla.deliveriesNeeded) {
      setUnlockedDistrictModal(DISTRICTS.orla);
    } else if (newCompletedCount === DISTRICTS.autodromo.deliveriesNeeded) {
      setUnlockedDistrictModal(DISTRICTS.autodromo);
    }

    if (autoDynamicCycle && newCompletedCount % 2 === 0) {
      setTimeShift(prev => {
        const idx = SHIFT_SEQUENCE.indexOf(prev);
        return SHIFT_SEQUENCE[(idx + 1) % SHIFT_SEQUENCE.length];
      });
      const weathers: WeatherType[] = ['sunny', 'rain', 'storm', 'fog', 'sunset', 'severe_storm'];
      const nextW = weathers[Math.floor(Math.random() * weathers.length)];
      setWeatherType(nextW);
    }

    spawnNewOrder();
  };

  // Training Mode: Passed through a 3D Stunt/Slalom Ring
  const handlePassTrainingRing = (bonusCoins: number, isWheelie: boolean) => {
    sound.playCash();
    setTrainingRingsPassed(prev => prev + 1);
    setStats(prev => ({
      ...prev,
      coins: prev.coins + bonusCoins,
      totalGrauPoints: prev.totalGrauPoints + (isWheelie ? 120 : 40),
    }));
    showBanner(
      isWheelie
        ? `🔥 ARCO NO GRAU PERFEITO! +R$ ${bonusCoins}`
        : `🎯 ARCO DE TREINO CONCLUÍDO! +R$ ${bonusCoins}`,
      isWheelie
        ? 'Manobra de elite! Bônus máximo de treinamento creditado!'
        : 'Dica: Passe empinando no Grau pelo arco para ganhar +R$ 35!',
      isWheelie ? '🔥' : '🎯',
      'deliver'
    );
  };

  // Teleport bike directly to any of the 6 scenarios
  const handleTeleportDistrict = (districtId: DistrictId) => {
    const dInfo = DISTRICTS[districtId];
    if (!dInfo) return;
    setTeleportTarget({
      x: dInfo.spawnPos.x,
      z: dInfo.spawnPos.z,
      heading: dInfo.spawnPos.heading,
      seq: Date.now(),
    });
    showBanner(
      `📍 CENÁRIO: ${dInfo.name.toUpperCase()}`,
      dInfo.description,
      '🧭',
      'deliver'
    );
  };

  const handleRivalPickup = () => {
    if (!currentOrder || currentOrder.state !== 'to_pickup') return;
    sound.playHorn();
    showBanner(
      '⚡ FALCÃO PEGOU O PEDIDO PRIMEIRO!',
      `Encoste na moto dele para recuperar ou chegue antes em ${currentOrder.customerName}!`,
      '⚠️',
      'pickup'
    );
    setCurrentOrder(prev => (prev ? { ...prev, state: 'to_deliver' } : null));
  };

  const handlePlayerInterceptRival = () => {
    if (!currentOrder) return;
    setStats(prev => ({ ...prev, coins: prev.coins + 15 }));
    showBanner(
      '🔥 PEDIDO RECUPERADO! +R$ 15 BÔNUS',
      `Você interceptou o Rival Falcão! Agora entregue em ${currentOrder.customerName}!`,
      '🏆',
      'deliver'
    );
  };

  const handleRivalDeliver = () => {
    if (!currentOrder) return;
    sound.playCrash();
    setStats(prev => ({
      ...prev,
      rivalDeliveries: (prev.rivalDeliveries || 0) + 1,
    }));
    showBanner(
      '⚡ RIVAL FALCÃO ROUBOU A ENTREGA!',
      'Ele chegou primeiro no cliente! Acelere para vencer a próxima corrida!',
      '💨',
      'pickup'
    );
    spawnNewOrder();
  };

  // Player crashed into a traffic vehicle, police car, or pedestrian -> Suffer mechanical & life damage!
  const handleCarCrash = (
    damage: number,
    remainingHealth: number,
    source: 'car' | 'police' | 'pedestrian' | 'bandit_shot' | 'car_on_foot' = 'car'
  ) => {
    setCrashFlash(true);
    setTimeout(() => setCrashFlash(false), 450);

    if (currentOrder && currentOrder.state === 'to_deliver') {
      setCurrentOrder(prev =>
        prev
          ? {
              ...prev,
              tipPotential: Math.max(2, Math.round(prev.tipPotential * 0.65)),
            }
          : null
      );
    }

    if (source === 'police') {
      showBanner(
        '🚨 VOCÊ BATEU NA VIATURA DA POLÍCIA!',
        'Eles ligaram o giroflex! Se te alcançarem, saem da viatura e te prendem!',
        '🚓',
        'pickup'
      );
      return;
    }

    if (source === 'car_on_foot') {
      showBanner(
        `🚶 ATROPELADO A PÉ NO TRÂNSITO! (-LIFE)`,
        'Você estava a pé sem moto! Sua moto não sofreu danos, mas cuidado com sua Barra de Life!',
        '🚗',
        'pickup'
      );
      return;
    }

    if (remainingHealth <= 0) {
      const towCost = 25;
      setStats(prev => ({
        ...prev,
        coins: Math.max(0, prev.coins - towCost),
        rating: Math.max(3.5, Number((prev.rating - 0.1).toFixed(2))),
      }));
      setRepairTrigger(prev => prev + 1);
      showBanner(
        `🚨 MOTO QUEBROU NA BATIDA! (-R$ ${towCost})`,
        'Socorro Mecânico acionado! Sua moto foi consertada para continuar.',
        '🛠️',
        'pickup'
      );
    } else if (source === 'bandit_shot') {
      showBanner(
        `🔫 TIRO DE ASSALTANTE! (-${damage}% DANO)`,
        `Cuidado com seu LIFE! Acelere no Nitro ou derrube o ladrão no soco/empurrão!`,
        '🔫',
        'pickup'
      );
    } else if (source === 'pedestrian') {
      setStats(prev => ({
        ...prev,
        rating: Math.max(3.5, Number((prev.rating - 0.08).toFixed(2))),
      }));
      showBanner(
        `😱 COLISÃO COM PEDESTRE! (-${damage}% DANO)`,
        `Integridade da moto: ${remainingHealth}% • Ambos sofreram dano de Life!`,
        '🚶',
        'pickup'
      );
    } else {
      setStats(prev => ({
        ...prev,
        rating: Math.max(3.5, Number((prev.rating - 0.04).toFixed(2))),
      }));
      showBanner(
        `💥 BATIDA NO TRÂNSITO! (-${damage}% DANO)`,
        `Integridade da moto: ${remainingHealth}%${
          remainingHealth < 55 ? ' • Motor perdendo potência!' : ''
        }`,
        '💥',
        'pickup'
      );
    }
  };

  // Mount / Dismount / Hijack Rival Bike result toast
  const handleMountActionResult = (
    result: 'dismounted' | 'mounted_own' | 'hijacked_rival' | 'too_far_from_bike'
  ) => {
    const nextOnFoot = result === 'dismounted' || result === 'too_far_from_bike';
    setTelemetry(prev => ({
      ...prev,
      isOnFoot: nextOnFoot,
      speedKmH: nextOnFoot ? 0 : prev.speedKmH,
    }));

    if (result === 'dismounted') {
      showBanner(
        '🚶 VOCÊ DESCEU DA MOTO (CONTROLE A PÉ ATIVO)',
        'Use o Analógico Verde ou WASD/Setas para caminhar e correr! PULAR [Espaço], SOCO [J] ou EMPURRAR [K].',
        '🥊',
        'deliver'
      );
    } else if (result === 'too_far_from_bike') {
      showBanner(
        '🚶 VOCÊ ESTÁ SEM MOTO POR PERTO!',
        'Caminhe até sua moto estacionada para montar, derrube o ladrão que a roubou ou tome a moto do Falcão!',
        '⚠️',
        'pickup'
      );
    } else if (result === 'hijacked_rival') {
      sound.playCash();
      setStats(prev => ({ ...prev, coins: prev.coins + 25 }));
      showBanner(
        '🔥 VOCÊ TOMOU A MOTO DO FALCÃO! (+R$ 25)',
        'Moto Turbo Dourada c/ Nitro Liberado! O Falcão ficou a pé xingando na rua!',
        '🏍️',
        'deliver'
      );
    } else {
      showBanner(
        '🏍️ DE VOLTA NA MOTO!',
        'Acelere para concluir suas entregas!',
        '🏍️',
        'deliver'
      );
    }
  };

  // On-Foot Melee Combat result toast (Soco / Empurrar)
  const handleMeleeResult = (
    target: 'bandit' | 'rival' | 'pedestrian' | 'guard' | 'police_officer',
    defeated: boolean,
    recoveredBike: boolean
  ) => {
    if (target === 'bandit') {
      if (defeated) {
        sound.playCash();
        setStats(prev => ({ ...prev, coins: prev.coins + 40 }));
        showBanner(
          '💀 LADRÃO NOCAUTEADO (0% LIFE)! (+R$ 40)',
          recoveredBike
            ? 'Você derrubou o assaltante da sua moto! Aperte MONTAR [F]!'
            : 'Assaltante derrotado no combate corpo a corpo!',
          '🥊',
          'deliver'
        );
      } else if (recoveredBike) {
        showBanner(
          '👐 VOCÊ DERRUBOU O LADRÃO DA SUA MOTO!',
          'Aperte MONTAR [F] rápido para subir na sua moto ou dê mais socos [J]!',
          '🔥',
          'deliver'
        );
      } else {
        showBanner(
          '🥊 GOLPE NO LADRÃO DE MOTO!',
          'Continue batendo [J/K] até zerar a Barra de Life dele!',
          '🥊',
          'deliver'
        );
      }
    } else if (target === 'police_officer') {
      if (defeated) {
        sound.playCash();
        setStats(prev => ({ ...prev, coins: prev.coins + 35 }));
        showBanner(
          '💀 POLICIAL NOCAUTEADO (0% LIFE)! (+R$ 35)',
          'Você derrubou o policial que saiu da viatura! Fuja antes que chegue reforço!',
          '🚓',
          'deliver'
        );
      } else {
        showBanner(
          '🥊 GOLPE NO POLICIAL EM PERSEGUIÇÃO!',
          'Cuidado! Se ele encostar em você, você será preso!',
          '🚨',
          'pickup'
        );
      }
    } else if (target === 'guard') {
      showBanner(
        defeated
          ? '💀 GUARDA DE TRÂNSITO NOCAUTEADO (0% LIFE)!'
          : '👮 VOCÊ AGREDIU O GUARDA DE TRÂNSITO!',
        'Ele chamou reforço policial pelo rádio! As viaturas estão vindo atrás de você!',
        '🚨',
        'pickup'
      );
    } else if (target === 'rival') {
      if (defeated) {
        sound.playCash();
        setStats(prev => ({ ...prev, coins: prev.coins + 30 }));
        showBanner(
          '💀 FALCÃO DERROTADO (0% LIFE)! (+R$ 30)',
          'O concorrente perdeu todo o Life! Aperte TOMAR MOTO [F] para pegar a moto dele!',
          '🏆',
          'deliver'
        );
      } else {
        showBanner(
          '🥊 GOLPE NO CONCORRENTE FALCÃO!',
          'Ele perdeu Life e ficou atordoado! Aperte [F] para tomar a moto dele!',
          '⚡',
          'deliver'
        );
      }
    } else if (target === 'pedestrian') {
      showBanner(
        defeated ? '💀 PEDESTRE NOCAUTEADO (0% LIFE)!' : '👐 EMPURRÃO / SOCO EM PEDESTRE!',
        'Cuidado para não chamar atenção dos guardas de trânsito e da polícia!',
        '🚶',
        'pickup'
      );
    }
  };

  // Xingamento / Taunt result toast
  const handleTauntResult = (phrase: string, stunnedRival: boolean, stunnedBandit: boolean) => {
    if (stunnedRival) {
      showBanner(
        `🤬 "${phrase}"`,
        'O Falcão parou intimidado! Saia da moto [F] e aperte [F] perto dele para TOMAR A MOTO DELE!',
        '🔥',
        'deliver'
      );
    } else if (stunnedBandit) {
      showBanner(
        `🤬 "${phrase}"`,
        'Você intimidou o ladrão armado por alguns segundos! Acelere!',
        '⚡',
        'deliver'
      );
    } else {
      showBanner(
        `🤬 "${phrase}"`,
        'Dica: Xingue perto do concorrente Falcão para fazê-lo parar e tomar a moto dele!',
        '📢',
        'pickup'
      );
    }
  };

  // Armed Bandit (Ladrão de Moto) events
  const handleBanditEvent = (
    type: 'threat' | 'shot' | 'stole_bike' | 'neutralized',
    value?: number
  ) => {
    if (type === 'threat') {
      showBanner(
        '🔫 ASSALTO ANUNCIADO: "PASSA A MOTO!"',
        'O ladrão está correndo para subir na sua moto! Acelere, atropele ou desça no soco [J]!',
        '🚨',
        'pickup'
      );
    } else if (type === 'stole_bike') {
      const lostCoins = 15;
      setStats(prev => ({
        ...prev,
        coins: Math.max(0, prev.coins - lostCoins),
      }));
      showBanner(
        `🚨 O LADRÃO SUBIU NA SUA MOTO E ESTÁ FUGINDO! (-R$ ${lostCoins})`,
        'Você está a pé sem moto! Corra atrás dele e use SOCO [J] ou EMPURRAR [K] para derrubá-lo!',
        '🔫',
        'pickup'
      );
    } else if (type === 'neutralized') {
      updateMissionProgress('neutralize_bandit', 1);
      const reward = value || 35;
      setStats(prev => ({
        ...prev,
        coins: prev.coins + reward,
      }));
      showBanner(
        `💥 LADRÃO DERROTADO (0% LIFE)! (+R$ ${reward})`,
        'Recompensa de segurança creditada! A rua está limpa!',
        '🛡️',
        'deliver'
      );
    }
  };

  // Traffic Guard Fine (-R$ 15)
  const handleTrafficGuardFine = () => {
    const fineAmount = 15;
    setStats(prev => ({
      ...prev,
      coins: Math.max(0, prev.coins - fineAmount),
    }));
    showBanner(
      `👮 MULTA DO GUARDA DE TRÂNSITO! (-R$ ${fineAmount})`,
      'O Guarda apitou: Proibido empinar no Grau ou passar acima de 78 km/h no cruzamento!',
      '📝',
      'pickup'
    );
  };

  // Pay Bail after Police Arrest
  const handlePayBail = () => {
    const bailCost = 30;
    sound.playCash();
    setStats(prev => ({
      ...prev,
      coins: Math.max(0, prev.coins - bailCost),
    }));
    setTelemetry(prev => ({
      ...prev,
      playerHealth: 100,
      bikeHealth: 100,
      isOnFoot: false,
      isOwnBikeStolen: false,
      policeWantedSeconds: 0,
      policeOfficersChasingOnFoot: false,
    }));
    setIsArrested(false);
    setReviveTrigger(prev => prev + 1);
  };

  // Quick 1-tap bike repair from HUD
  const handleRepairBike = () => {
    const cost = 20;
    sound.playCash();
    setStats(prev => ({
      ...prev,
      coins: Math.max(0, prev.coins - cost),
    }));
    setRepairTrigger(prev => prev + 1);
    showBanner(
      '🔧 MOTO CONSERTADA (100%)',
      'Motor, carenagem e freios revisados com sucesso!',
      '✨',
      'deliver'
    );
  };

  // Revive Player after 0% Life Lose / Defeat -> Respawns in a different space of the city!
  const handleRevivePlayer = () => {
    const medicalFee = 20;
    sound.playCash();
    setStats(prev => ({
      ...prev,
      coins: Math.max(0, prev.coins - medicalFee),
    }));
    setTelemetry(prev => ({
      ...prev,
      playerHealth: 100,
      bikeHealth: 100,
      isOnFoot: false,
      isOwnBikeStolen: false,
      policeWantedSeconds: 0,
      policeOfficersChasingOnFoot: false,
    }));
    setIsGameOver(false);
    setReviveTrigger(prev => prev + 1);
  };

  const handleReviveLocationResult = useCallback(
    (locationName: string) => {
      showBanner(
        `📍 REINÍCIO EM NOVO LOCAL: ${locationName.toUpperCase()}`,
        'Você renasceu com 100% LIFE e Moto 100% Revisada em uma nova região da cidade!',
        '🏥',
        'deliver'
      );
    },
    [showBanner]
  );

  // Grau points score
  const handleGrauScore = (points: number, combo: number) => {
    setStats(prev => ({
      ...prev,
      totalGrauPoints: prev.totalGrauPoints + points,
      coins: prev.coins + Math.floor(combo * 0.2),
    }));
  };

  // Buy upgrade in shop
  const handleBuyUpgrade = (key: keyof BikeUpgrades, cost: number) => {
    if (stats.coins < cost) return;

    sound.playCash();
    setStats(prev => ({ ...prev, coins: prev.coins - cost }));

    setUpgrades(prev => {
      if (key === 'nitroUnlocked') {
        return { ...prev, nitroUnlocked: true };
      }
      return {
        ...prev,
        [key]: (prev[key] as number) + 1,
      };
    });
  };

  // Toggle audio
  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div
      ref={gameRootRef}
      tabIndex={0}
      onPointerDown={() => {
        window.focus();
        gameRootRef.current?.focus();
      }}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif] outline-none"
    >
      {/* 1. THREE.JS 3D VIEWPORT CONTAINER */}
      <GameCanvas
        isPlaying={gameState === 'playing'}
        isPaused={isPaused || isShopOpen || isGameOver || isArrested}
        gameMode={gameMode}
        cameraMode={cameraMode}
        performanceMode={performanceMode}
        upgrades={upgrades}
        customization={customization}
        weatherType={weatherType}
        timeShift={timeShift}
        skyTheme={skyTheme}
        teleportTarget={teleportTarget}
        mountTrigger={mountTrigger}
        jumpTrigger={jumpTrigger}
        meleeTrigger={meleeTrigger}
        specialTrigger={specialTrigger}
        reviveTrigger={reviveTrigger}
        onReviveLocationResult={handleReviveLocationResult}
        tauntTrigger={tauntTrigger}
        policeCallTrigger={policeCallTrigger}
        onPoliceCallResult={handlePoliceCallResult}
        onMountActionResult={handleMountActionResult}
        onMeleeResult={handleMeleeResult}
        onTauntResult={handleTauntResult}
        onBanditEvent={handleBanditEvent}
        onTrafficGuardFine={handleTrafficGuardFine}
        onPolicePursuitEvent={() => {
          showBanner(
            '🚨 VIATURA POLICIAL EM PERSEGUIÇÃO!',
            'Você bateu no carro da polícia! Se te alcançarem, eles saem da viatura e te prendem!',
            '🚓',
            'pickup'
          );
        }}
        onPoliceOfficersDisembark={() => {
          showBanner(
            '🚓 OS POLICIAIS SAÍRAM DA VIATURA!',
            'Eles desceram do carro e estão correndo atrás de você para te prender! Corra ou acelere!',
            '🚨',
            'pickup'
          );
        }}
        onPlayerArrested={() => {
          setIsArrested(true);
        }}
        onPlayerDefeated={() => {
          setIsGameOver(true);
        }}
        onGhostScare={() => {
          setCrashFlash(true);
          setTimeout(() => setCrashFlash(false), 320);
          showBanner(
            '👻 ASSOMBRADO PELO FANTASMA NA ESCURIDÃO! (-8% LIFE)',
            'Mantenha o Farol da moto aceso e aponte para os Fantasmas para repeli-los!',
            '👻',
            'pickup'
          );
        }}
        currentOrder={currentOrder}
        onOrderPickup={handleOrderPickup}
        onOrderDeliver={handleOrderDeliver}
        onRivalPickup={handleRivalPickup}
        onPlayerInterceptRival={handlePlayerInterceptRival}
        onRivalDeliver={handleRivalDeliver}
        onPassTrainingRing={handlePassTrainingRing}
        onCarCrash={handleCarCrash}
        repairTrigger={repairTrigger}
        onGrauScore={handleGrauScore}
        onTelemetryUpdate={setTelemetry}
        headlightOn={headlightOn}
        isTrafficJam={isTrafficJam}
        inputsRef={inputsRef}
      />

      {/* 2. TITLE SCREEN (Initial Game Shell) */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={selectedMode => {
            setGameMode(selectedMode);
            setGameState('playing');
            window.focus();
            gameRootRef.current?.focus();
            sound.startEngine(customization.exhaustType);
          }}
          onOpenShop={() => setIsShopOpen(true)}
          coins={stats.coins}
        />
      )}

      {/* 3. PLAYING HUD (World-matched, low-occlusion perimeter clusters) */}
      {gameState === 'playing' && (
        <HUD
          stats={stats}
          gameMode={gameMode}
          onChangeGameMode={mode => {
            setGameMode(mode);
            showBanner(
              mode === 'career' ? '🏆 MODO CARREIRA ATIVADO' : '🎯 MODO TREINAMENTO ATIVADO',
              mode === 'career'
                ? 'Entregue pedidos contra o relógio e vença o Rival Falcão!'
                : 'Moto indestrutível, Nitro livre e Arcos Neon 3D liberados!',
              mode === 'career' ? '🏆' : '🎯',
              'deliver'
            );
          }}
          cameraMode={cameraMode}
          onCycleCamera={handleCycleCamera}
          currentOrder={currentOrder}
          telemetry={telemetry}
          weather={weatherConfig}
          timeShift={timeShift}
          skyTheme={skyTheme}
          autoDynamicCycle={autoDynamicCycle}
          onToggleAutoCycle={() => setAutoDynamicCycle(prev => !prev)}
          onChangeWeather={setWeatherType}
          onChangeTimeShift={shift => {
            setTimeShift(shift);
            if (shift === 'noite') {
              setHeadlightOn(true);
              sound.playGhostWail();
              showBanner(
                '🌑 MODO ESCURIDÃO & FANTASMAS ATIVADO!',
                'A cidade mergulhou na escuridão e Fantasmas 3D assombram as ruas! Use o Farol para repeli-los!',
                '👻',
                'pickup'
              );
            }
          }}
          onChangeSkyTheme={setSkyTheme}
          onTeleportDistrict={handleTeleportDistrict}
          isTrafficJam={isTrafficJam}
          onToggleTrafficJam={() => {
            setIsTrafficJam(prev => {
              const next = !prev;
              sound.playHorn();
              showBanner(
                next ? '🚗 ENGARRAFAMENTO ATIVADO (HORÁRIO DE PICO)' : '🛣️ TRÂNSITO LIVRE ATIVADO',
                next
                  ? 'Fila dupla e trânsito pesado nas avenidas! Use o Corredor e buzine para abrir espaço!'
                  : 'Congestionamento liberado nas avenidas!',
                next ? '🚦' : '🛣️',
                next ? 'pickup' : 'deliver'
              );
              return next;
            });
          }}
          trainingRingsPassed={trainingRingsPassed}
          onOpenShop={() => setIsShopOpen(true)}
          onRepairBike={handleRepairBike}
          onToggleMount={handleToggleMount}
          onTriggerJump={handleTriggerJump}
          onTriggerMelee={handleTriggerMelee}
          onTriggerSpecial={handleTriggerSpecial}
          onTriggerTaunt={handleTriggerTaunt}
          crashFlash={crashFlash}
          onPause={() => setIsPaused(true)}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onTouchInput={handleTouchInput}
          onAnalogSteer={handleAnalogSteer}
          onGestureMove={handleGestureMove}
          activeInputs={activeInputs}
          headlightOn={headlightOn}
          onToggleHeadlight={handleToggleHeadlight}
          missions={missions}
          onOpenMissions={() => setIsMissionsOpen(true)}
          onOpenPhone={() => setIsPhoneOpen(true)}
          deliveryCelebration={deliveryCelebration}
          onDismissCelebration={() => setDeliveryCelebration(null)}
        />
      )}

      {/* 3.5 COMPACT TRANSIENT EVENT TOAST (Auto-hides after 2.4s or on tap) */}
      {gameState === 'playing' && eventBanner && (
        <div className="pointer-events-none absolute top-12 inset-x-0 z-20 flex justify-center px-3">
          <div
            onClick={() => setEventBanner(null)}
            className={`pointer-events-auto cursor-pointer border rounded-full px-3 py-1 shadow-lg flex items-center gap-1.5 max-w-xs w-auto backdrop-blur-md ${
              eventBanner.type === 'pickup'
                ? 'bg-slate-950/90 border-amber-400/70 text-amber-300'
                : 'bg-slate-950/90 border-emerald-400/70 text-emerald-300'
            }`}
          >
            <span className="text-sm shrink-0">{eventBanner.icon}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-wide uppercase truncate max-w-[220px]">
                {eventBanner.title}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. OFICINA / CUSTOMIZATION MODAL */}
      {isShopOpen && (
        <ShopModal
          stats={stats}
          upgrades={upgrades}
          customization={customization}
          onBuyUpgrade={handleBuyUpgrade}
          onUpdateCustomization={setCustomization}
          onClose={() => setIsShopOpen(false)}
        />
      )}

      {/* 5. PAUSE MODAL (START MENU WITH EMBEDDED INTERACTIVE CITY MAP) */}
      {isPaused && !isShopOpen && !isGameOver && !isArrested && (
        <PauseModal
          stats={stats}
          telemetry={telemetry}
          currentDistrict={telemetry.currentDistrict}
          weatherType={weatherType}
          timeShift={timeShift}
          skyTheme={skyTheme}
          autoDynamicCycle={autoDynamicCycle}
          onToggleAutoCycle={() => setAutoDynamicCycle(prev => !prev)}
          onChangeWeather={setWeatherType}
          onChangeTimeShift={setTimeShift}
          onChangeSkyTheme={setSkyTheme}
          onTeleportDistrict={handleTeleportDistrict}
          onTeleportPoint={(x, z, heading, name) => {
            setTeleportTarget({
              x,
              z,
              heading,
              seq: Date.now(),
            });
            showBanner(`📍 FAST TRAVEL: ${name.toUpperCase()}`, '', '🧭', 'deliver');
          }}
          isTrafficJam={isTrafficJam}
          onToggleTrafficJam={() => setIsTrafficJam(prev => !prev)}
          onResume={() => setIsPaused(false)}
          onOpenShop={() => {
            setIsShopOpen(true);
          }}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onRestart={() => {
            setIsPaused(false);
            spawnNewOrder();
          }}
          performanceMode={performanceMode}
          onChangePerformanceMode={setPerformanceMode}
          currentOrder={currentOrder}
          onOpenMissions={() => {
            setIsPaused(false);
            setIsMissionsOpen(true);
          }}
          sensitivity={sensitivity}
          onChangeSensitivity={setSensitivity}
        />
      )}

      {/* 6. MISSIONS MODAL */}
      {isMissionsOpen && (
        <MissionsModal
          missions={missions}
          onClaimReward={handleClaimMissionReward}
          onClose={() => setIsMissionsOpen(false)}
        />
      )}

      {/* 7. DISTRICT UNLOCKED CELEBRATION MODAL */}
      {unlockedDistrictModal && (
        <DistrictUnlockModal
          district={unlockedDistrictModal}
          onClose={() => setUnlockedDistrictModal(null)}
        />
      )}

      {/* 6.5 SMARTPHONE MODAL */}
      {isPhoneOpen && (
        <SmartphoneModal
          stats={stats}
          onCallPolice={handleCallPolice}
          onCallRival={handleCallRival}
          onInstantRepair={handleRepairBike}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenGunShop={() => setIsGunShopOpen(true)}
          onOpenMobileWorkshop={() => setIsMobileWorkshopOpen(true)}
          onOpenCityMap={() => setIsCityMapOpen(true)}
          onClose={() => setIsPhoneOpen(false)}
        />
      )}

      {/* 6.6 GUN SHOP / AMMUNATION MODAL */}
      {isGunShopOpen && (
        <GunShopModal
          stats={stats}
          onBuyItem={handleBuyGunItem}
          onClose={() => setIsGunShopOpen(false)}
        />
      )}

      {/* 6.7 MOBILE WORKSHOP MODAL */}
      {isMobileWorkshopOpen && (
        <MobileWorkshopModal
          upgrades={upgrades}
          customization={customization}
          coins={stats.coins}
          onUpdateUpgrades={setUpgrades}
          onUpdateCustomization={setCustomization}
          onDeductCoins={amount => setStats(prev => ({ ...prev, coins: prev.coins - amount }))}
          onClose={() => setIsMobileWorkshopOpen(false)}
        />
      )}

      {/* 6.8 CITY MAP MODAL */}
      {isCityMapOpen && (
        <CityMapModal
          playerPos={new THREE.Vector3(telemetry.posX, 0, telemetry.posZ)}
          currentOrder={currentOrder}
          unlockedDistricts={getUnlockedDistricts()}
          onTeleport={(x, z, heading, name) => {
            setTeleportTarget({
              x,
              z,
              heading,
              seq: Date.now(),
            });
            showBanner('🗺️ FAST TRAVEL CONCLUÍDO!', `Bem-vindo a ${name}`, '📍', 'pickup');
          }}
          onClose={() => setIsCityMapOpen(false)}
        />
      )}

      {/* 7. LOSE / DERROTA MODAL WHEN PLAYER LIFE REACHES 0% */}
      {isGameOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 16, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-3xl animate-bounce">
              💀
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-rose-400">
                0% LIFE • NOCAUTE TOTAL
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                VOCÊ PERDEU TODO O LIFE!
              </h2>
              <p className="text-xs text-slate-300 mt-1.5">
                Sua barra de vida chegou a 0% após colisões, tiros de ladrões ou perseguição policial.
                Ao reiniciar, você será levado para um novo ponto seguro em outra região da cidade!
              </p>
            </div>

            <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-around text-xs">
              <div>
                <div className="text-slate-400 font-bold">Saldo Atual</div>
                <div className="text-amber-400 font-black text-sm">R$ {stats.coins}</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <div className="text-slate-400 font-bold">Taxa Médica</div>
                <div className="text-rose-400 font-black text-sm">-R$ 20</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRevivePlayer}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl cursor-pointer active:scale-95 transition-all"
            >
              🔄 REINICIAR EM NOVO LOCAL COM 100% LIFE
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* 8. PRESO PELA POLÍCIA MODAL (When chasing Police Cruisers catch up, disembark, and arrest the player) */}
      {isArrested && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-blue-500 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-red-500 flex items-center justify-center text-3xl animate-pulse">
              🚓
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                DETIDO EM FLAGRANTE • VIATURA TÁTICA
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                VOCÊ FOI PRESO PELA POLÍCIA!
              </h2>
              <p className="text-xs text-slate-300 mt-1.5">
                A viatura policial te alcançou na perseguição, os policiais saíram do carro e efetuaram
                a prisão! Pague a fiança na delegacia para liberar sua moto e voltar às entregas.
              </p>
            </div>

            <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-around text-xs">
              <div>
                <div className="text-slate-400 font-bold">Saldo Atual</div>
                <div className="text-amber-400 font-black text-sm">R$ {stats.coins}</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <div className="text-slate-400 font-bold">Fiança + Liberação</div>
                <div className="text-rose-400 font-black text-sm">-R$ 30</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePayBail}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 hover:from-blue-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl cursor-pointer active:scale-95 transition-all"
            >
              🔓 PAGAR FIANÇA (R$ 30) E VOLTAR ÀS RUAS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
