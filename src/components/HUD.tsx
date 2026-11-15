import React, { useState, useRef, useEffect } from 'react';
import {
  CameraMode,
  DeliveryOrder,
  DistrictId,
  GameMode,
  PlayerStats,
  SkyTheme,
  TimeShift,
  WeatherConfig,
  WeatherType,
} from '../types/game';
import { MiniMap } from './MiniMap';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Zap,
  Wrench,
  Gamepad2,
  Lock,
  Unlock,
  CheckCircle2,
  Award,
  Star,
} from 'lucide-react';

export interface DeliveryCelebrationData {
  id: number;
  customerName: string;
  itemTitle: string;
  icon: string;
  baseReward: number;
  earnedTip: number;
  totalEarnings: number;
  completedCount: number;
  targetCount: number;
  milestoneLabel: string;
  prevProgressPct: number;
  nextProgressPct: number;
  rating: number;
  isNightBonus?: boolean;
}

interface HUDProps {
  stats: PlayerStats;
  gameMode: GameMode;
  onChangeGameMode: (mode: GameMode) => void;
  cameraMode: CameraMode;
  onCycleCamera: () => void;
  currentOrder: DeliveryOrder | null;
  telemetry: {
    speedKmH: number;
    gear: number;
    rpmRatio: number;
    nitroPct: number;
    isNitroActive?: boolean;
    bikeHealth?: number;
    playerHealth?: number;
    policeWantedSeconds?: number;
    policeOfficersChasingOnFoot?: boolean;
    isWheelie: boolean;
    isOnFoot?: boolean;
    distToOwnBikeM?: number;
    isOwnBikeStolen?: boolean;
    canHijackRival?: boolean;
    nearestBanditDistM?: number;
    currentDistrict: DistrictId;
    distanceToTargetM: number;
    rivalDistanceToTargetM?: number;
    rivalHasPackage?: boolean;
    bikeHeading: number;
    targetHeading: number;
    posX: number;
    posZ: number;
    isSheltered?: boolean;
    shelterName?: string;
    isSevereStorm?: boolean;
    isAquaplaning?: boolean;
    fuelPct?: number;
    isSkidding?: boolean;
  };
  weather: WeatherConfig;
  timeShift: TimeShift;
  skyTheme: SkyTheme;
  autoDynamicCycle: boolean;
  onToggleAutoCycle: () => void;
  onChangeWeather: (type: WeatherType) => void;
  onChangeTimeShift: (shift: TimeShift) => void;
  onChangeSkyTheme: (theme: SkyTheme) => void;
  onTeleportDistrict: (districtId: DistrictId) => void;
  trainingRingsPassed?: number;
  onOpenShop: () => void;
  onRepairBike?: () => void;
  onRefuelBike?: () => void;
  onToggleMount?: () => void;
  onTriggerJump?: () => void;
  onTriggerMelee?: (type: 'punch' | 'push') => void;
  onTriggerSpecial?: () => void;
  onTriggerTaunt?: () => void;
  crashFlash?: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onTouchInput: (key: string, pressed: boolean) => void;
  onAnalogSteer?: (steerValue: number) => void;
  onGestureMove?: (angle: number, magnitude: number, active: boolean) => void;
  activeInputs?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    wheelie: boolean;
    nitro: boolean;
    horn: boolean;
  };
  headlightOn?: boolean;
  onToggleHeadlight?: () => void;
  missions?: any[];
  onOpenMissions?: () => void;
  onOpenPhone?: () => void;
  isTrafficJam?: boolean;
  onToggleTrafficJam?: () => void;
  deliveryCelebration?: DeliveryCelebrationData | null;
  onDismissCelebration?: () => void;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(val, max));
}

export const HUD: React.FC<HUDProps> = ({
  gameMode,
  currentOrder,
  telemetry,
  onRepairBike,
  onRefuelBike,
  onToggleMount,
  onTriggerJump,
  onTriggerMelee,
  onTriggerSpecial,
  onTriggerTaunt,
  crashFlash,
  onPause,
  onTouchInput,
  onAnalogSteer,
  onGestureMove,
  activeInputs,
  headlightOn,
  onToggleHeadlight,
  missions = [],
  onOpenMissions,
  onOpenPhone,
  timeShift,
  onChangeTimeShift,
  onTeleportDistrict,
  isTrafficJam = true,
  onToggleTrafficJam,
  deliveryCelebration,
  onDismissCelebration,
}) => {
  const [autoGas, setAutoGas] = useState(false);

  // ON-FOOT GESTURE WALKING CONTROLLER STATE
  const gesturePointerIdRef = useRef<number | null>(null);
  const [gestureState, setGestureState] = useState<{
    originX: number;
    originY: number;
    currX: number;
    currY: number;
    active: boolean;
    isSprint: boolean;
  }>({
    originX: 0,
    originY: 0,
    currX: 0,
    currY: 0,
    active: false,
    isSprint: false,
  });

  // MULTI-TOUCH POINTER TRACKING: each simultaneous touch is isolated by its unique pointerId
  const buttonPointersRef = useRef<Map<string, number>>(new Map());
  const steerPointerIdRef = useRef<number | null>(null);
  const [steerKnob, setSteerKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Global safety listener: ONLY cancels the specific pointer that was released, NEVER canceling other held inputs!
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      // 1. Walking gesture joystick
      if (gesturePointerIdRef.current !== null && e.pointerId === gesturePointerIdRef.current) {
        gesturePointerIdRef.current = null;
        setGestureState(prev => ({ ...prev, active: false, isSprint: false }));
        if (onGestureMove) onGestureMove(0, 0, false);
      }

      // 2. Motorcycle steering joystick
      if (steerPointerIdRef.current !== null && e.pointerId === steerPointerIdRef.current) {
        steerPointerIdRef.current = null;
        setSteerKnob({ x: 0, y: 0, active: false });
        if (onAnalogSteer) onAnalogSteer(0);
        onTouchInput('left', false);
        onTouchInput('right', false);
      }

      // 3. Independent hold buttons (Accelerate, Brake, Nitro, Wheelie, Horn)
      for (const [key, pId] of Array.from(buttonPointersRef.current.entries())) {
        if (pId === e.pointerId) {
          buttonPointersRef.current.delete(key);
          onTouchInput(key, false);
        }
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [onGestureMove, onAnalogSteer, onTouchInput]);

  // Automatically cancel autoGas if entering on-foot mode
  useEffect(() => {
    if (telemetry.isOnFoot && autoGas) {
      setAutoGas(false);
    }
  }, [telemetry.isOnFoot, autoGas]);

  // Prevent duplicate onPointerDown + onClick double-firing on toggle/action buttons
  const lastTapActionRef = useRef<Record<string, number>>({});
  const triggerOnce = (actionKey: string, fn?: () => void) => {
    const now = performance.now();
    if (now - (lastTapActionRef.current[actionKey] || 0) < 320) return;
    lastTapActionRef.current[actionKey] = now;
    fn?.();
  };

  // Toggle Auto-Gas (Cruise Control)
  const toggleAutoGas = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (telemetry.isOnFoot) return;
    triggerOnce('auto_gas', () => {
      const next = !autoGas;
      setAutoGas(next);
      onTouchInput('forward', next);
    });
  };

  // True Multi-Touch Concurrent Hold Button Handler
  const bindHoldButton = (key: string, disableAutoGas = false) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      buttonPointersRef.current.set(key, e.pointerId);
      if (disableAutoGas && autoGas) {
        setAutoGas(false);
      }
      onTouchInput(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      if (buttonPointersRef.current.get(key) === e.pointerId) {
        buttonPointersRef.current.delete(key);
        onTouchInput(key, false);
      }
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      if (buttonPointersRef.current.get(key) === e.pointerId) {
        buttonPointersRef.current.delete(key);
        onTouchInput(key, false);
      }
    },
  });

  // GESTURE WALKING EVENT HANDLERS (ON-FOOT ONLY) - Center-relative instant response & zero stale closure
  const updateGestureFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = Math.max(38, rect.width * 0.38);

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    // Give at least 0.45 walk magnitude even when tapping near the center so any tap/drag moves immediately
    const rawMag = clamp(clampedDist / maxRadius, 0, 1);
    const magnitude = dist > 4 ? Math.max(0.45, rawMag) : 0.45;
    const angle = dist > 4 ? Math.atan2(-dx, -dy) : 0;
    const isSprint = rawMag > 0.72;

    const knobX = dist > 0 ? (dx / dist) * clampedDist : 0;
    const knobY = dist > 0 ? (dy / dist) * clampedDist : 0;

    setGestureState({
      originX: 0,
      originY: 0,
      currX: knobX,
      currY: knobY,
      active: true,
      isSprint,
    });
    if (onGestureMove) onGestureMove(angle, magnitude, true);
  };

  const handleGesturePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    gesturePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    updateGestureFromEvent(e);
  };

  const handleGesturePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesturePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateGestureFromEvent(e);
  };

  const handleGesturePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (gesturePointerIdRef.current === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      gesturePointerIdRef.current = null;
      setGestureState({
        originX: 0,
        originY: 0,
        currX: 0,
        currY: 0,
        active: false,
        isSprint: false,
      });
      if (onGestureMove) onGestureMove(0, 0, false);
    }
  };

  // STEERING JOYSTICK EVENT HANDLERS (MOTORCYCLE MODE ONLY) - Dedicated pointer tracking
  const handleSteerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (steerPointerIdRef.current !== null) return;
    steerPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const normSteer = clamp(-dx / maxR, -1, 1);
    setSteerKnob({ x: dx, y: dy, active: true });
    if (onAnalogSteer) onAnalogSteer(Math.abs(normSteer) > 0.05 ? normSteer : 0);
  };

  const handleSteerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const normSteer = clamp(-dx / maxR, -1, 1);
    setSteerKnob({ x: dx, y: dy, active: true });
    if (onAnalogSteer) onAnalogSteer(Math.abs(normSteer) > 0.05 ? normSteer : 0);
  };

  const handleSteerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (steerPointerIdRef.current === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      steerPointerIdRef.current = null;
      setSteerKnob({ x: 0, y: 0, active: false });
      if (onAnalogSteer) onAnalogSteer(0);
      onTouchInput('left', false);
      onTouchInput('right', false);
    }
  };

  const isPickup = currentOrder?.state === 'to_pickup';

  return (
    <div
      translate="no"
      className="notranslate absolute inset-0 pointer-events-none z-10 flex flex-col justify-between px-2.5 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.1rem,calc(env(safe-area-inset-bottom)+0.75rem))] sm:pb-4 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] font-['Plus_Jakarta_Sans',sans-serif] select-none overflow-hidden"
    >
      {/* 1. TOP BAR: COMPACT SINGLE-ROW START, MISSIONS, PHONE & MINIMAP */}
      <div className="flex items-start justify-between w-full gap-1.5">
        {/* TOP-LEFT COMPACT PILLS (Forced single line on mobile so CELULAR never wraps) */}
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap shrink-0">
          <button
            type="button"
            onClick={onPause}
            className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-black text-[11px] sm:text-xs shadow-lg border-b-2 border-amber-700 active:scale-95 transition-transform cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <span>START</span>
            <span className="text-[9px] font-bold opacity-80 hidden sm:inline">• MAPA</span>
          </button>

          <button
            type="button"
            onClick={onOpenMissions}
            className="pointer-events-auto relative bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md text-amber-400 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-[11px] sm:text-xs shadow-lg border border-amber-500/40 active:scale-95 transition-transform cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <span>🎯</span>
            <span>MISSÕES</span>
            {missions.some(m => m.completed && !m.claimed) && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] text-slate-950 font-black flex items-center justify-center animate-bounce">
                !
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenPhone}
            className="pointer-events-auto bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md text-emerald-400 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-[11px] sm:text-xs shadow-lg border border-emerald-500/40 active:scale-95 transition-transform cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <span>📱</span>
            <span>CELULAR</span>
          </button>
        </div>

        {/* TOP RIGHT: COMPACT STREETS MINIMAP & LIVE DELIVERY PROGRESS BAR */}
        <div className="pointer-events-auto flex flex-col items-end gap-1 shrink-0">
          <MiniMap 
            playerX={telemetry.posX}
            playerZ={telemetry.posZ}
            playerHeading={telemetry.bikeHeading}
            targetX={currentOrder?.state === 'to_pickup' ? currentOrder.restaurantPos.x : currentOrder?.customerPos.x}
            targetZ={currentOrder?.state === 'to_pickup' ? currentOrder.restaurantPos.z : currentOrder?.customerPos.z}
            isPickup={isPickup}
            showShelters={telemetry.isSevereStorm}
          />
          {gameMode === 'career' && currentOrder && (
            <div className="w-36 sm:w-40 bg-slate-950/90 backdrop-blur-md border border-white/15 rounded-xl px-2.5 py-1.5 shadow-xl flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-200">
                <span className="truncate max-w-[76px] flex items-center gap-1">
                  <span>{currentOrder.icon}</span>
                  <span>{isPickup ? 'Coleta' : 'Entrega'}</span>
                </span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {Math.max(0, Math.round(telemetry.distanceToTargetM))}m • {currentOrder.timeRemainingSeconds}s
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-transform duration-150 origin-left ${
                    isPickup
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-300'
                  }`}
                  style={{
                    transform: `scaleX(${clamp(1 - telemetry.distanceToTargetM / 220, 0.08, 1)})`,
                  }}
                />
              </div>
              {/* Order type badges */}
              {(currentOrder.isHot || currentOrder.isFragile || currentOrder.isUrgent) && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {currentOrder.isHot && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/25 border border-orange-400/50 text-orange-300 text-[7px] font-black uppercase">
                      🔥 Quente
                    </span>
                  )}
                  {currentOrder.isFragile && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/25 border border-sky-400/50 text-sky-300 text-[7px] font-black uppercase">
                      🍷 Frágil
                    </span>
                  )}
                  {currentOrder.isUrgent && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-300 text-[7px] font-black uppercase">
                      ⚡ Urgente
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {telemetry.isSevereStorm && (
            <div className="bg-emerald-600/90 backdrop-blur-sm text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-md border border-white/40 shadow flex items-center gap-1">
              <span>🛡️</span>
              <span>ABRIGOS NO GPS</span>
            </div>
          )}
          {gameMode === 'career' && currentOrder && telemetry.rivalHasPackage && (
            <div className="bg-rose-600/90 backdrop-blur-sm text-white text-[8px] font-black px-2 py-0.5 rounded-md animate-pulse border border-white/20 shadow">
              ⚠️ PEDIDO ROUBADO!
            </div>
          )}
        </div>
      </div>

      {/* 1.5 ANIMATED DELIVERY COMPLETION STAMP & PROGRESS BAR OVERLAY */}
      <AnimatePresence>
        {deliveryCelebration && (
          <motion.div
            key={deliveryCelebration.id}
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 340, damping: 24 }}
            onClick={onDismissCelebration}
            className="pointer-events-auto self-center mt-1 sm:mt-2 z-30 cursor-pointer max-w-md w-full px-3"
          >
            <div className="relative overflow-hidden bg-slate-950/92 backdrop-blur-md border border-emerald-400/60 rounded-2xl p-3.5 sm:p-4 shadow-[0_12px_40px_rgba(16,185,129,0.28)]">
              {/* Top row: Animated Stamp Seal + Order & Earnings */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Animated Stamp Emblem ("Selo de Entrega Concluída") */}
                  <motion.div
                    initial={{ scale: 2.2, rotate: -18, opacity: 0 }}
                    animate={{ scale: 1, rotate: -4, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 16,
                      delay: 0.06,
                    }}
                    className="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 p-0.5 shadow-[0_0_24px_rgba(16,185,129,0.55)] flex items-center justify-center"
                  >
                    <div className="w-full h-full bg-slate-950/90 rounded-[14px] border border-emerald-300/60 flex flex-col items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                      <span className="text-[7px] font-black tracking-tighter text-amber-300 uppercase leading-none mt-0.5">
                        ENTREGUE
                      </span>
                    </div>
                  </motion.div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black tracking-tight text-emerald-300 truncate">
                        Entrega Concluída!
                      </span>
                      <span className="text-[11px] text-amber-300 font-bold flex items-center gap-0.5 shrink-0 tabular-nums">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {deliveryCelebration.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(() => {
                        const cname = deliveryCelebration.customerName || 'Cliente';
                        let h = 0;
                        for (let i = 0; i < cname.length; i++) h = (h * 31 + cname.charCodeAt(i)) >>> 0;
                        const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
                        const shirts = ['#10b981', '#f97316', '#3b82f6', '#ec4899', '#eab308'];
                        const hairs = ['#111827', '#451a03', '#92400e', '#dc2626'];
                        const skin = skins[h % skins.length];
                        const shirt = shirts[(h >> 3) % shirts.length];
                        const hair = hairs[(h >> 6) % hairs.length];
                        return (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-emerald-400/60 shrink-0 overflow-hidden bg-slate-900"
                            title={`Cliente: ${cname}`}
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4">
                              <path d="M4 22 C4 16 20 16 20 22 Z" fill={shirt} />
                              <circle cx="12" cy="10" r="5" fill={skin} />
                              <path d="M7 9 C7 5 17 5 17 9 Z" fill={hair} />
                              <circle cx="10.3" cy="10" r="0.8" fill="#0f172a" />
                              <circle cx="13.7" cy="10" r="0.8" fill="#0f172a" />
                              <path d="M10 12.2 Q12 13.8 14 12.2" stroke="#0f172a" strokeWidth="1.1" fill="none" />
                            </svg>
                          </span>
                        );
                      })()}
                      <p className="text-[11px] text-slate-200 font-semibold truncate">
                        {deliveryCelebration.icon} {deliveryCelebration.itemTitle} · {deliveryCelebration.customerName}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                      Frete R$ {deliveryCelebration.baseReward}
                      {deliveryCelebration.isNightBonus ? ' (+25% Noturno)' : ''} · Gorjeta R$ {deliveryCelebration.earnedTip}
                    </p>
                  </div>
                </div>

                {/* Total Earnings Counter */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.14 }}
                  className="shrink-0 text-right"
                >
                  <div className="text-base sm:text-lg font-black font-mono tabular-nums text-emerald-400 leading-none">
                    +R$ {deliveryCelebration.totalEarnings}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">
                    Recebido
                  </span>
                </motion.div>
              </div>

              {/* Animated Progress Bars Section */}
              <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2">
                {/* Bar 1: Order Completion Fill (0% -> 100%) */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-400" />
                      <span>Pedido Finalizado com Sucesso</span>
                    </span>
                    <span className="font-mono tabular-nums text-emerald-300 font-bold">100%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                      className="w-full h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-300 origin-left"
                    />
                  </div>
                </div>

                {/* Bar 2: Career Milestone / Next District Progress */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mb-1">
                    <span>Meta: {deliveryCelebration.milestoneLabel}</span>
                    <span className="font-mono tabular-nums text-amber-300 font-bold">
                      {deliveryCelebration.completedCount}/{deliveryCelebration.targetCount} entregas
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ scaleX: clamp(deliveryCelebration.prevProgressPct / 100, 0, 1) }}
                      animate={{ scaleX: clamp(deliveryCelebration.nextProgressPct / 100, 0, 1) }}
                      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
                      className="w-full h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 origin-left"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CENTER AREA: COMPLETELY CLEAN */}
      {crashFlash && (
        <div className="fixed inset-0 pointer-events-none z-30 border-8 border-rose-600/70 bg-rose-600/15 animate-pulse" />
      )}

      {/* SEVERE STORM: TORRENTIAL RAIN & MIST VISOR EFFECT */}
      {telemetry.isSevereStorm && !telemetry.isSheltered && (
        <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
          <div className="absolute inset-0 bg-radial from-transparent via-slate-950/20 to-slate-950/60" />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-sky-950/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sky-950/50 to-transparent" />
        </div>
      )}

      {/* 3. BOTTOM AREA: SLIM TELEMETRY PILL & ELEVATED ERGONOMIC TOUCH CONTROLS */}
      <div className="flex flex-col gap-1.5 w-full max-w-full pb-1 sm:pb-0">
        {/* SEVERE STORM CONTEXTUAL REAL-TIME ADVISORY CHIP */}
        {telemetry.isSevereStorm && (
          <div className="self-center flex items-center justify-center gap-2 pointer-events-auto max-w-full px-2">
            {telemetry.isSheltered ? (
              <div className="bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-3 py-1 rounded-2xl text-[9px] sm:text-xs font-black flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                <span>🛡️</span>
                <span className="truncate">SOB ABRIGO: {telemetry.shelterName || 'POSTO / TÚNEL'}</span>
              </div>
            ) : telemetry.isAquaplaning ? (
              <div className="bg-rose-950/95 border-2 border-rose-500 text-white px-3 py-1 rounded-2xl text-[9px] sm:text-xs font-black flex items-center gap-1.5 shadow-xl backdrop-blur-md animate-bounce">
                <span>⚠️</span>
                <span className="truncate">AQUAPLANAGEM! DESACELERE (&lt;35 KM/H)!</span>
              </div>
            ) : (
              <div className="bg-amber-950/90 border border-amber-500/80 text-amber-200 px-2.5 py-0.5 rounded-2xl text-[9px] font-black flex items-center gap-1 shadow-xl backdrop-blur-md">
                <span>🌧️</span>
                <span className="truncate">TEMPESTADE: CUIDADO NAS CURVAS</span>
              </div>
            )}
          </div>
        )}

        {/* ULTRA-SLIM ALL-IN-ONE TELEMETRY PILL (Velocidade, Vida, Moto e Combustível) */}
        <div className="self-center flex items-center gap-1.5 pointer-events-auto max-w-full flex-wrap justify-center">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/70 rounded-full px-3 sm:px-4 py-1 shadow-xl flex items-center gap-2">
            {/* Speed (KM/H) */}
            <div className="flex items-baseline gap-1">
              <span className="text-xs sm:text-base font-black text-emerald-400 tabular-nums font-mono leading-none">
                {telemetry.speedKmH}
              </span>
              <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase">KM/H</span>
            </div>

            <div className="h-2.5 w-px bg-slate-700/60" />

            {/* Motoboy Life Bar */}
            <div className="flex items-center gap-1" title="Vida do Motoboy">
              <span className="text-[10px] leading-none">💚</span>
              <div className="w-10 sm:w-16 h-1.5 sm:h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/40">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    (telemetry.playerHealth ?? 100) > 40 ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${telemetry.playerHealth ?? 100}%` }}
                />
              </div>
            </div>

            {/* Motorcycle Shield & Fuel Bar (Riding mode only) */}
            {!telemetry.isOnFoot && (
              <>
                <div className="h-2.5 w-px bg-slate-700/60" />
                <div className="flex items-center gap-1" title="Integridade da Moto">
                  <span className="text-[10px] leading-none">🏍️</span>
                  <div className="w-10 sm:w-14 h-1.5 sm:h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/40">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        (telemetry.bikeHealth ?? 100) > 40 ? 'bg-sky-400' : 'bg-amber-500'
                      }`}
                      style={{ width: `${telemetry.bikeHealth ?? 100}%` }}
                    />
                  </div>
                </div>

                <div className="h-2.5 w-px bg-slate-700/60" />
                <div className="flex items-center gap-1" title="Combustível da Moto">
                  <span className="text-[10px] leading-none">⛽</span>
                  <div className="w-10 sm:w-14 h-1.5 sm:h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/40">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        (telemetry.fuelPct ?? 100) > 25 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
                      }`}
                      style={{ width: `${telemetry.fuelPct ?? 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Contextual mini badges (Police, Grau, Nitro, Drift, Bandit, Rival) */}
            {(telemetry.policeWantedSeconds ?? 0) > 0 && (
              <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5 shadow">
                <span>🚨</span>
                <span>{telemetry.policeWantedSeconds}s</span>
              </span>
            )}

            {telemetry.isWheelie && (
              <span className="bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5 fill-slate-950" />
                <span>GRAU</span>
              </span>
            )}

            {telemetry.isSkidding && !telemetry.isOnFoot && (
              <span className="bg-orange-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <span>💨</span>
                <span>DRIFT</span>
              </span>
            )}

            {telemetry.isNitroActive && !telemetry.isOnFoot && (
              <span className="bg-cyan-400 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5 fill-slate-950" />
                <span>TURBO</span>
              </span>
            )}

            {(telemetry.nearestBanditDistM ?? 999) < 140 && (
              <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5 whitespace-nowrap">
                <span>🔫</span>
                <span>{telemetry.nearestBanditDistM}m</span>
              </span>
            )}

            {telemetry.canHijackRival && (
              <span className="bg-yellow-400 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-bounce flex items-center gap-0.5">
                <span>🔥</span>
                <span>RIVAL</span>
              </span>
            )}

            {telemetry.isSheltered && (
              <span className="bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                <span>🛡️</span>
                <span>ABRIGO</span>
              </span>
            )}
          </div>

          {/* Quick Refuel Button when fuel is below 50% */}
          {(telemetry.fuelPct ?? 100) < 50 && !telemetry.isOnFoot && gameMode === 'career' && onRefuelBike && (
            <button
              type="button"
              onClick={onRefuelBike}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 border border-white rounded-full px-2.5 py-1 shadow-xl text-[8px] font-black flex items-center gap-1 cursor-pointer animate-pulse"
            >
              <span>⛽</span>
              <span>Abastecer R$15</span>
            </button>
          )}

          {/* Quick Repair Button when bike is damaged */}
          {(telemetry.bikeHealth ?? 100) < 50 && !telemetry.isOnFoot && gameMode === 'career' && onRepairBike && (
            <button
              type="button"
              onClick={onRepairBike}
              className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white border border-rose-300 rounded-full px-2.5 py-1 shadow-xl text-[8px] font-black flex items-center gap-1 cursor-pointer animate-bounce"
            >
              <Wrench className="w-2.5 h-2.5" />
              <span>Conserto R$20</span>
            </button>
          )}
        </div>

        {/* 4. CONTROLS ROW — ELEVATED & COMPACT SO 100% VISIBLE ABOVE MOBILE NAV BAR */}
        {telemetry.isOnFoot ? (
          /* ========================================================================= */
          /* ON-FOOT MODE: GESTURE WALKING SURFACE (LEFT) + CLEAN ACTION BUTTONS (RIGHT) */
          /* ========================================================================= */
          <div className="flex items-end justify-between w-full gap-2">
            {/* UNIFIED ON-FOOT JOYSTICK (Bolinha) */}
            <div
              data-hud-control="true"
              className="pointer-events-auto flex items-center"
            >
              <div
                data-hud-control="true"
                className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-950/85 backdrop-blur-md border-2 border-emerald-400 shadow-2xl flex items-center justify-center select-none touch-none cursor-pointer"
                onPointerDown={handleGesturePointerDown}
                onPointerMove={handleGesturePointerMove}
                onPointerUp={handleGesturePointerUp}
                onPointerCancel={handleGesturePointerUp}
              >
                <div className="absolute inset-3 rounded-full border border-white/5 bg-slate-900/40 shadow-inner pointer-events-none" />
                <div className="absolute inset-x-6 h-px bg-emerald-500/20 pointer-events-none" />
                <div className="absolute inset-y-6 w-px bg-emerald-500/20 pointer-events-none" />
                
                <span className="absolute top-1.5 text-[6px] font-black text-emerald-400/70 uppercase tracking-widest">DIREÇÃO</span>
                <span className="absolute bottom-1.5 text-[6px] font-black text-slate-400">
                  {gestureState.isSprint ? '⚡ CORRER' : '🚶 ANDAR'}
                </span>

                {/* The Bolinha (Joystick Knob) */}
                <div
                  className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border-2 shadow-2xl flex items-center justify-center transition-transform pointer-events-none ${
                    gestureState.active
                      ? 'bg-emerald-500 border-white shadow-emerald-400/50 scale-105'
                      : 'bg-slate-800 border-emerald-500/40'
                  }`}
                  style={{
                    transform: gestureState.active
                      ? `translate(${gestureState.currX - gestureState.originX}px, ${gestureState.currY - gestureState.originY}px)`
                      : 'translate(0px, 0px)',
                  }}
                >
                  <div className={`w-3.5 h-3.5 rounded-full transition-all ${gestureState.active ? 'bg-white scale-110' : 'bg-emerald-400/50'}`} />
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: ON-FOOT ACTION CHIPS (Pular, Soco, Empurrar, Especial, Xingar, Montar) */}
            <div className="pointer-events-auto flex flex-col items-end gap-1.5 z-20">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* PULAR (Space) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('jump', onTriggerJump);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('jump', onTriggerJump);
                  }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-600/90 hover:bg-sky-500 active:scale-95 border-2 border-sky-300/80 text-white flex flex-col items-center justify-center shadow-xl cursor-pointer select-none touch-none"
                  title="Pular"
                >
                  <span className="text-sm leading-none">🦘</span>
                  <span className="text-[7px] font-black mt-0.5">PULAR</span>
                </button>

                {/* SOCO (J) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('punch', () => onTriggerMelee?.('punch'));
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('punch', () => onTriggerMelee?.('punch'));
                  }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-600/90 hover:bg-rose-500 active:scale-95 border-2 border-rose-300/80 text-white flex flex-col items-center justify-center shadow-xl cursor-pointer select-none touch-none"
                  title="Soco"
                >
                  <span className="text-sm leading-none">🥊</span>
                  <span className="text-[7px] font-black mt-0.5">SOCO</span>
                </button>

                {/* EMPURRÃO (K) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('push', () => onTriggerMelee?.('push'));
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('push', () => onTriggerMelee?.('push'));
                  }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/90 hover:bg-amber-400 active:scale-95 border-2 border-white/90 text-slate-950 flex flex-col items-center justify-center shadow-xl cursor-pointer select-none touch-none"
                  title="Empurrar"
                >
                  <span className="text-sm leading-none">👐</span>
                  <span className="text-[6px] font-black mt-0.5">EMPURRAR</span>
                </button>

                {/* GOLPE ESPECIAL / FATALITY (L) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('special', () => onTriggerSpecial?.());
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('special', () => onTriggerSpecial?.());
                  }}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-red-600 hover:brightness-110 active:scale-95 border-2 border-white text-slate-950 flex flex-col items-center justify-center shadow-2xl cursor-pointer select-none touch-none animate-pulse"
                  title="Golpe Especial (Fatality)"
                >
                  <span className="text-sm leading-none">⚡</span>
                  <span className="text-[6px] font-black mt-0.5">ESPECIAL</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {/* XINGAR (X) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('taunt', onTriggerTaunt);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('taunt', onTriggerTaunt);
                  }}
                  className="h-9 px-2.5 rounded-xl bg-orange-600/90 hover:bg-orange-500 active:scale-95 border border-orange-300 text-white flex items-center gap-1 shadow-lg cursor-pointer select-none touch-none"
                  title="Xingar"
                >
                  <span className="text-xs leading-none">🤬</span>
                  <span className="text-[8px] font-black">XINGAR</span>
                </button>

                {/* MONTAR / TOMAR MOTO (F) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('mount', onToggleMount);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('mount', onToggleMount);
                  }}
                  className={`h-9 px-3 rounded-xl border-2 flex items-center gap-1.5 shadow-2xl cursor-pointer active:scale-95 transition-all select-none touch-none ${
                    telemetry.canHijackRival
                      ? 'bg-amber-400 border-white text-slate-950 animate-bounce'
                      : telemetry.isOwnBikeStolen
                      ? 'bg-slate-900 border-rose-500 text-rose-300'
                      : (telemetry.distToOwnBikeM ?? 0) > 75
                      ? 'bg-slate-900 border-amber-500 text-amber-300'
                      : 'bg-emerald-500 border-white text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  <span className="text-sm leading-none">
                    {telemetry.canHijackRival ? '🔥' : '🏍️'}
                  </span>
                  <span className="text-[8px] font-black whitespace-nowrap">
                    {telemetry.canHijackRival
                      ? 'TOMAR MOTO'
                      : telemetry.isOwnBikeStolen
                      ? 'MOTO ROUBADA'
                      : (telemetry.distToOwnBikeM ?? 0) > 75
                      ? `MOTO A ${telemetry.distToOwnBikeM}m`
                      : 'SUBIR NA MOTO'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MOTORCYCLE MODE: COMPACT TRANSLUCENT STEERING (LEFT) + PEDALS (RIGHT)     */
          /* ========================================================================= */
          <div className="pointer-events-auto flex items-end justify-between w-full gap-2">
            {/* LEFT THUMB ZONE: PRECISION VIRTUAL JOYSTICK FOR STEERING */}
            <div
              data-hud-control="true"
              className="relative w-24 h-24 sm:w-30 sm:h-30 rounded-full bg-slate-950/75 backdrop-blur-md border-2 border-slate-700/80 shadow-2xl flex items-center justify-center select-none touch-none cursor-pointer shrink-0"
              onPointerDown={handleSteerPointerDown}
              onPointerMove={handleSteerPointerMove}
              onPointerUp={handleSteerPointerUp}
              onPointerCancel={handleSteerPointerUp}
            >
              {/* Crosshair guidelines */}
              <div className="absolute inset-x-3 h-px bg-slate-700/60 pointer-events-none" />
              <div className="absolute inset-y-3 w-px bg-slate-700/60 pointer-events-none" />
              <span className="absolute left-1.5 text-[8px] font-black text-slate-400">◀</span>
              <span className="absolute right-1.5 text-[8px] font-black text-slate-400">▶</span>
              <span className="absolute top-1.5 text-[6px] font-black tracking-widest text-slate-400 uppercase">DIREÇÃO</span>

              {/* Floating Thumb Stick Knob */}
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 shadow-2xl flex items-center justify-center transition-transform pointer-events-none ${
                  steerKnob.active
                    ? 'bg-blue-600 border-white shadow-blue-500/80 scale-105'
                    : 'bg-slate-800 border-slate-500'
                }`}
                style={{
                  transform: steerKnob.active
                    ? `translate(${steerKnob.x}px, ${steerKnob.y}px)`
                    : 'translate(0px, 0px)',
                }}
              >
                <div className={`w-3.5 h-3.5 rounded-full ${steerKnob.active ? 'bg-white' : 'bg-white/70'}`} />
              </div>
            </div>

            {/* RIGHT THUMB ZONE: ERGONOMIC >=48PX TOUCH TARGETS WITH ZERO OVERLAP */}
            <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[70vw]">
              {/* Row 1: XINGAR, A PÉ, AUTO, BUZINA */}
              <div className="flex items-center justify-end gap-1.5">
                {/* XINGAR */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('taunt', onTriggerTaunt);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('taunt', onTriggerTaunt);
                  }}
                  title="Xingar (X)"
                  className="min-h-[48px] min-w-[48px] px-2 rounded-xl border-2 bg-orange-600/95 hover:bg-orange-500 active:scale-95 border-orange-300 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer select-none touch-none"
                >
                  <span className="text-xs leading-none">🤬</span>
                  <span className="text-[7px] font-black mt-0.5">XINGAR</span>
                </button>

                {/* SAIR DA MOTO (F) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (autoGas) setAutoGas(false);
                    triggerOnce('mount', onToggleMount);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (autoGas) setAutoGas(false);
                    triggerOnce('mount', onToggleMount);
                  }}
                  title="Sair da Moto (F)"
                  className="min-h-[48px] min-w-[48px] px-2 rounded-xl border-2 bg-amber-500 hover:bg-amber-400 border-white text-slate-950 flex flex-col items-center justify-center shadow-lg cursor-pointer active:scale-95 select-none touch-none"
                >
                  <span className="text-xs leading-none">🚶</span>
                  <span className="text-[7px] font-black mt-0.5">A PÉ</span>
                </button>

                {/* AUTO-GAS */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleAutoGas(e);
                  }}
                  onClick={toggleAutoGas}
                  title="Piloto Automático"
                  className={`min-h-[48px] min-w-[48px] px-2 rounded-xl border-2 text-[7px] font-black flex flex-col items-center justify-center shadow-lg cursor-pointer transition-all select-none touch-none ${
                    autoGas
                      ? 'bg-emerald-400 border-white text-slate-950 scale-95'
                      : 'bg-slate-950/90 border-emerald-500/60 text-emerald-400'
                  }`}
                >
                  {autoGas ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span className="mt-0.5">AUTO</span>
                </button>

                {/* BUZINA */}
                <button
                  type="button"
                  {...bindHoldButton('horn')}
                  className={`min-h-[48px] min-w-[48px] rounded-xl border-2 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer touch-none ${
                    activeInputs?.horn
                      ? 'bg-amber-500 border-amber-200 scale-95'
                      : 'bg-slate-900/90 border-slate-700'
                  }`}
                  title="Buzina (H)"
                >
                  <span className="text-xs leading-none">📢</span>
                  <span className="text-[7px] font-black mt-0.5">BUZINA</span>
                </button>
              </div>

              {/* Row 2: GRAU, NITRO, FAROL */}
              <div className="flex items-center justify-end gap-1.5">
                {/* GRAU */}
                <button
                  type="button"
                  {...bindHoldButton('wheelie')}
                  className={`min-h-[48px] min-w-[54px] px-2.5 rounded-xl border-2 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer touch-none ${
                    activeInputs?.wheelie
                      ? 'bg-purple-500 border-purple-200 scale-95'
                      : 'bg-purple-800/90 border-purple-400'
                  }`}
                >
                  <span className="text-xs leading-none">🔥</span>
                  <span className="text-[8px] font-black mt-0.5">GRAU</span>
                </button>

                {/* NITRO */}
                <button
                  type="button"
                  {...bindHoldButton('nitro')}
                  className={`min-h-[48px] min-w-[54px] px-2.5 rounded-xl border-2 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer touch-none ${
                    activeInputs?.nitro
                      ? 'bg-cyan-400 border-white text-slate-950 scale-95'
                      : 'bg-cyan-700/90 border-cyan-400'
                  }`}
                >
                  <span className="text-xs leading-none">⚡</span>
                  <span className="text-[8px] font-black mt-0.5">NITRO</span>
                </button>

                {/* FAROL */}
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerOnce('headlight', onToggleHeadlight);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    triggerOnce('headlight', onToggleHeadlight);
                  }}
                  className={`min-h-[48px] min-w-[54px] px-2.5 rounded-xl border-2 text-white flex flex-col items-center justify-center shadow-lg cursor-pointer select-none touch-none ${
                    headlightOn
                      ? 'bg-amber-400 border-white text-slate-950 scale-95'
                      : 'bg-slate-800/90 border-slate-600 text-slate-300'
                  }`}
                  title="Ligar/Desligar Farol (L)"
                >
                  <span className="text-xs leading-none">💡</span>
                  <span className="text-[8px] font-black mt-0.5">FAROL</span>
                </button>
              </div>

              {/* Row 3: Lower Pedals FREIO + ACELERAR (>=48px, Elevated & Full-Visibility on Mobile) */}
              <div data-hud-control="true" className="flex items-end gap-2">
                <button
                  type="button"
                  data-hud-control="true"
                  {...bindHoldButton('backward', true)}
                  className={`min-h-[54px] min-w-[68px] sm:w-20 sm:h-16 rounded-2xl border-2 text-white font-black flex flex-col items-center justify-center shadow-xl cursor-pointer transition-transform select-none touch-none ${
                    activeInputs?.backward
                      ? 'bg-rose-600 border-white scale-95 shadow-rose-500/60'
                      : 'bg-rose-950/90 border-rose-500/80'
                  }`}
                >
                  <span className="text-xs leading-none">▼</span>
                  <span className="text-[10px] font-black tracking-tight mt-0.5">FREIO</span>
                </button>

                <button
                  type="button"
                  data-hud-control="true"
                  {...bindHoldButton('forward')}
                  className={`min-h-[56px] min-w-[104px] sm:w-28 sm:h-16 rounded-2xl border-2 font-black flex flex-col items-center justify-center shadow-2xl cursor-pointer transition-transform select-none touch-none ${
                    activeInputs?.forward || autoGas
                      ? 'bg-emerald-400 border-white text-slate-950 scale-95 shadow-emerald-500/60'
                      : 'bg-gradient-to-t from-emerald-700 to-emerald-500 border-emerald-300 text-white'
                  }`}
                >
                  <span className="text-sm sm:text-base leading-none">▲</span>
                  <span className="text-xs sm:text-sm tracking-wide font-black">ACELERAR</span>
                  <span className="text-[7px] opacity-90 font-bold leading-none">
                    {autoGas ? '🔒 AUTO' : 'SEGURE'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

