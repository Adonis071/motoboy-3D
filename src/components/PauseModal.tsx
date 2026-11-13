import React, { useState } from 'react';
import { PlayerStats, DistrictId, WeatherType, TimeShift, SkyTheme, DeliveryOrder } from '../types/game';
import { DISTRICTS } from '../game/cityMap';
import { RESPAWN_LOCATIONS } from '../game/physics';
import { TIME_SHIFT_PRESETS, WEATHER_PRESETS } from '../game/weatherManager';
import { sound } from '../audio/soundEngine';
import {
  Trophy,
  Wrench,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  MapPin,
  Gauge,
  Shield,
  Zap,
  Compass,
  Sun,
  CloudRain,
  Clock,
  Sparkles,
  Navigation,
} from 'lucide-react';
import { motion } from 'motion/react';

interface PauseModalProps {
  stats: PlayerStats;
  telemetry: any;
  currentDistrict: DistrictId;
  weatherType: WeatherType;
  timeShift: TimeShift;
  skyTheme: SkyTheme;
  autoDynamicCycle: boolean;
  onToggleAutoCycle: () => void;
  onChangeWeather: (type: WeatherType) => void;
  onChangeTimeShift: (shift: TimeShift) => void;
  onChangeSkyTheme: (theme: SkyTheme) => void;
  onTeleportDistrict: (districtId: DistrictId) => void;
  onTeleportPoint?: (x: number, z: number, heading: number, name: string) => void;
  isTrafficJam?: boolean;
  onToggleTrafficJam?: () => void;
  onResume: () => void;
  onOpenShop: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onRestart: () => void;
  performanceMode: 'low' | 'high';
  onChangePerformanceMode: (mode: 'low' | 'high') => void;
  currentOrder: DeliveryOrder | null;
  onOpenMissions: () => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stats,
  telemetry,
  currentDistrict,
  weatherType,
  timeShift,
  autoDynamicCycle,
  onToggleAutoCycle,
  onChangeWeather,
  onChangeTimeShift,
  onTeleportDistrict,
  onTeleportPoint,
  isTrafficJam = true,
  onToggleTrafficJam,
  onResume,
  onOpenShop,
  onToggleMute,
  isMuted,
  onRestart,
  performanceMode,
  onChangePerformanceMode,
  currentOrder,
  onOpenMissions,
  sensitivity,
  onChangeSensitivity,
}) => {
  const [selectedWaypoint, setSelectedWaypoint] = useState<typeof RESPAWN_LOCATIONS[0] | null>(null);

  const allDistrictIds: DistrictId[] = [
    'centro',
    'nova_cidade',
    'jardins',
    'favela',
    'orla',
    'industrial',
    'autodromo',
  ];
  const weatherTypes: WeatherType[] = ['sunny', 'rain', 'storm', 'severe_storm', 'fog', 'sunset'];
  const shiftTypes: TimeShift[] = ['manha', 'tarde', 'entardecer', 'noite'];

  // Map coordinate bounds: X (-300 to 400), Z (-200 to 200) mapped to 0-100% UI
  const mapMinX = -300;
  const mapMaxX = 400;
  const mapMinZ = -200;
  const mapMaxZ = 200;

  const toUIPct = (x: number, z: number) => {
    const left = ((x - mapMinX) / (mapMaxX - mapMinX)) * 100;
    const top = ((z - mapMinZ) / (mapMaxZ - mapMinZ)) * 100;
    return {
      left: Math.max(5, Math.min(95, left)),
      top: Math.max(6, Math.min(94, top)),
    };
  };

  const playerCoord = toUIPct(telemetry.posX ?? 0, telemetry.posZ ?? 0);
  const orderTargetPos = currentOrder
    ? currentOrder.state === 'to_pickup'
      ? currentOrder.restaurantPos
      : currentOrder.customerPos
    : null;
  const orderCoord = orderTargetPos ? toUIPct(orderTargetPos.x, orderTargetPos.z) : null;

  const handleWaypointClick = (wp: typeof RESPAWN_LOCATIONS[0]) => {
    setSelectedWaypoint(wp);
    sound.playHorn();
    if (onTeleportPoint) {
      onTeleportPoint(wp.x, wp.z, wp.heading, wp.name);
      onResume();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 font-['Plus_Jakarta_Sans',sans-serif] backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.94, y: 12, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 12, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-[28px] p-4 sm:p-6 shadow-2xl flex flex-col gap-5 overflow-y-auto max-h-[94vh]"
      >
        {/* HEADER: STATUS OVERVIEW */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              Menu Start • GPS & Controle
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">Central do Piloto & Mapa da Cidade</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-1.5 flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Saldo</span>
              <span className="text-base sm:text-lg font-black text-amber-400 tabular-nums">
                R$ {stats.coins.toLocaleString('pt-BR')}
              </span>
            </div>
            <button
              onClick={onResume}
              className="px-4 h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>CONTINUAR</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE CITY MAP INSIDE START MENU */}
        <div className="bg-slate-950/90 border-2 border-cyan-500/40 rounded-3xl p-3.5 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Mapa Interativo da Cidade (Toque em um ponto para Viajar)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block border border-white" />
                Você ({DISTRICTS[currentDistrict]?.name || 'Centro'})
              </span>
              {currentOrder && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block border border-white" />
                  {currentOrder.state === 'to_pickup' ? 'Coleta' : 'Entrega'}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                Fast Travel
              </span>
            </div>
          </div>

          {/* 2D Interactive Radar Map Canvas */}
          <div className="relative w-full h-56 sm:h-64 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden select-none">
            {/* Radar Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:28px_28px] opacity-45" />

            {/* District Zones */}
            <div className="absolute inset-3 grid grid-cols-4 grid-rows-2 gap-1.5 pointer-events-none opacity-40">
              <div className="bg-sky-500/20 rounded-xl border border-sky-500/40 flex items-center justify-center text-[9px] font-black text-sky-300">
                POLO INDUSTRIAL
              </div>
              <div className="bg-amber-500/20 rounded-xl border border-amber-500/40 flex items-center justify-center text-[9px] font-black text-amber-300">
                CENTRO URBANO
              </div>
              <div className="bg-purple-500/20 rounded-xl border border-purple-500/40 flex items-center justify-center text-[9px] font-black text-purple-300">
                JARDINS
              </div>
              <div className="bg-teal-500/20 rounded-xl border border-teal-500/40 flex items-center justify-center text-[9px] font-black text-teal-300">
                NOVA METRÓPOLE
              </div>
              <div className="bg-emerald-500/20 rounded-xl border border-emerald-500/40 flex items-center justify-center text-[9px] font-black text-emerald-300">
                MORRO / FAVELA
              </div>
              <div className="bg-indigo-500/20 rounded-xl border border-indigo-500/40 flex items-center justify-center text-[9px] font-black text-indigo-300">
                AUTÓDROMO & ARENA
              </div>
              <div className="bg-rose-500/20 rounded-xl border border-rose-500/40 flex items-center justify-center text-[9px] font-black text-rose-300">
                ORLA DA PRAIA
              </div>
              <div className="bg-blue-500/20 rounded-xl border border-blue-500/40 flex items-center justify-center text-[9px] font-black text-blue-300">
                PONTE ESTAIADA
              </div>
            </div>

            {/* Clickable Fast Travel Waypoint Pins */}
            {RESPAWN_LOCATIONS.map((wp, idx) => {
              const pos = toUIPct(wp.x, wp.z);
              const isSelected = selectedWaypoint?.name === wp.name;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleWaypointClick(wp)}
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer shadow-lg z-20 ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 scale-110 ring-2 ring-white'
                      : 'bg-slate-900/95 border border-cyan-400/80 text-cyan-300 hover:scale-110 hover:bg-cyan-400 hover:text-slate-950'
                  }`}
                  title={`Viajar para ${wp.name}`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="text-[8px] font-black whitespace-nowrap hidden sm:inline">
                    {wp.name.split('(')[0].trim()}
                  </span>
                </button>
              );
            })}

            {/* Active Delivery Order Marker */}
            {orderCoord && currentOrder && (
              <div
                style={{ left: `${orderCoord.left}%`, top: `${orderCoord.top}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 border-2 border-white shadow-lg flex items-center gap-1 z-25 animate-bounce pointer-events-none"
              >
                <span className="text-[10px] leading-none">{currentOrder.icon}</span>
                <span className="text-[8px] font-black uppercase">
                  {currentOrder.state === 'to_pickup' ? 'COLETA' : 'ENTREGA'}
                </span>
              </div>
            )}

            {/* Live Player Position Marker */}
            <div
              style={{ left: `${playerCoord.left}%`, top: `${playerCoord.top}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 border-2 border-white shadow-[0_0_15px_rgba(16,185,129,0.9)] flex items-center gap-1 z-30 pointer-events-none"
            >
              <Navigation className="w-3 h-3 fill-slate-950" />
              <span className="text-[8px] font-black">VOCÊ</span>
            </div>
          </div>

          {/* Quick District Teleport Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
            {allDistrictIds.map(dId => (
              <button
                key={dId}
                type="button"
                onClick={() => {
                  onTeleportDistrict(dId);
                  onResume();
                }}
                className={`px-2.5 py-1.5 rounded-xl text-center border text-[10px] font-black truncate cursor-pointer transition-all active:scale-95 ${
                  currentDistrict === dId
                    ? 'bg-emerald-500 border-white text-slate-950 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                📍 {DISTRICTS[dId].name}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 2: STATS & WORLD SIMULATION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT COLUMN: PILOT TELEMETRY & MISSION */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center text-center gap-0.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-[8px] font-bold text-slate-400 uppercase">Entregas</span>
                <span className="text-xs font-black text-white">{stats.completedDeliveries}</span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center text-center gap-0.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-[8px] font-bold text-slate-400 uppercase">Grau</span>
                <span className="text-xs font-black text-white">{stats.totalGrauPoints}</span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center text-center gap-0.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span className="text-[8px] font-bold text-slate-400 uppercase">KM</span>
                <span className="text-xs font-black text-white">{stats.distanceTraveledKm?.toFixed(1) || 0}</span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center text-center gap-0.5">
                <Gauge className="w-4 h-4 text-sky-400" />
                <span className="text-[8px] font-bold text-slate-400 uppercase">Nota</span>
                <span className="text-xs font-black text-white">{stats.rating?.toFixed(1) || 5.0} ★</span>
              </div>
            </div>

            {/* INTEGRITY */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  Integridade & Saúde
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400">Moto</span>
                    <span className="text-emerald-400">{telemetry.bikeHealth}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${telemetry.bikeHealth}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400">Piloto</span>
                    <span className="text-emerald-400">{telemetry.playerHealth}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${telemetry.playerHealth}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ACTIVE ORDER */}
            {currentOrder && (
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{currentOrder.icon}</span>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-amber-400 uppercase block">
                      {currentOrder.state === 'to_pickup' ? 'Coleta em Andamento' : 'Entrega em Andamento'}
                    </span>
                    <span className="text-xs font-black text-white truncate block">
                      {currentOrder.state === 'to_pickup' ? currentOrder.restaurantName : currentOrder.customerName}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-400 block">{telemetry.distanceToTargetM}m</span>
                  <span className="text-[10px] font-bold text-amber-300">R$ {currentOrder.rewardCoins}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: SIMULATION, TRAFFIC, DARKNESS & CONTROLS */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-[11px] font-black text-white uppercase tracking-wider">
                Ambiente, Trânsito & Controles
              </span>
            </div>

            {/* Quick Toggle Buttons for Traffic Jam & Night/Zombies Mode */}
            <div className="grid grid-cols-2 gap-2">
              {onToggleTrafficJam && (
                <button
                  type="button"
                  onClick={onToggleTrafficJam}
                  className={`py-2 px-2.5 rounded-xl border text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isTrafficJam
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span>{isTrafficJam ? '🚗' : '🛣️'}</span>
                  <span>{isTrafficJam ? 'Engarrafamento: ON' : 'Trânsito Livre'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onChangeTimeShift(timeShift === 'noite' ? 'tarde' : 'noite')}
                className={`py-2 px-2.5 rounded-xl border text-[10px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  timeShift === 'noite'
                    ? 'bg-rose-950 border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-purple-300'
                }`}
              >
                <span>{timeShift === 'noite' ? '🧟' : '🌑'}</span>
                <span>{timeShift === 'noite' ? 'Noite & Zumbis: ON' : 'Ativar Noite/Zumbis'}</span>
              </button>
            </div>

            {/* Weather & Shift Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">Clima</span>
                <div className="flex flex-wrap gap-1">
                  {weatherTypes.map(wKey => (
                    <button
                      key={wKey}
                      onClick={() => onChangeWeather(wKey)}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                        weatherType === wKey
                          ? 'bg-sky-500 border-white text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                      title={WEATHER_PRESETS[wKey].name}
                    >
                      {wKey === 'sunny' ? (
                        <Sun className="w-3.5 h-3.5" />
                      ) : wKey === 'severe_storm' ? (
                        <span className="text-[10px] leading-none">🌪️</span>
                      ) : (
                        <CloudRain className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">Horário</span>
                <div className="flex flex-wrap gap-1">
                  {shiftTypes.map(sKey => (
                    <button
                      key={sKey}
                      onClick={() => onChangeTimeShift(sKey)}
                      className={`px-2 h-7 rounded-lg border text-[9px] font-black flex items-center justify-center cursor-pointer transition-colors ${
                        timeShift === sKey
                          ? 'bg-amber-500 border-white text-slate-950'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {TIME_SHIFT_PRESETS[sKey].name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality & Sensitivity */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onChangePerformanceMode(performanceMode === 'high' ? 'low' : 'high')}
                className="py-1.5 px-2.5 rounded-xl border border-slate-700 bg-slate-900 text-[10px] font-black text-slate-300 cursor-pointer"
              >
                Gráficos: {performanceMode === 'high' ? 'ALTA (6GB+)' : 'LEVE (4GB)'}
              </button>
              <button
                onClick={onToggleAutoCycle}
                className={`py-1.5 px-2.5 rounded-xl border text-[10px] font-black cursor-pointer ${
                  autoDynamicCycle
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Ciclo Clima: {autoDynamicCycle ? 'AUTO' : 'FIXO'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[9px] font-bold uppercase text-slate-400">
                Sensibilidade ({Math.round(sensitivity * 100)}%)
              </span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={sensitivity}
                onChange={e => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-32 accent-amber-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM QUICK ACTIONS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <button
            onClick={onOpenMissions}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <span className="text-base leading-none">🎯</span>
            <span className="text-[10px] font-black text-amber-400 uppercase">Missões</span>
          </button>
          <button
            onClick={onOpenShop}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-black text-white uppercase">Oficina</span>
          </button>
          <button
            onClick={onToggleMute}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-[10px] font-black text-white uppercase">
              Som: {isMuted ? 'OFF' : 'ON'}
            </span>
          </button>
          <button
            onClick={onRestart}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-2.5 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] font-black text-white uppercase">Nova Rota</span>
          </button>
          <button
            onClick={onResume}
            className="col-span-2 sm:col-span-1 bg-amber-500 hover:bg-amber-400 border border-white/20 p-2.5 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg cursor-pointer"
          >
            <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
            <span className="text-[10px] font-black text-slate-950 uppercase">Voltar</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
