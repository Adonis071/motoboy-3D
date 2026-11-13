import React, { useState } from 'react';
import * as THREE from 'three';
import { DistrictId, DeliveryOrder } from '../types/game';
import { DISTRICTS } from '../game/cityMap';
import { RESPAWN_LOCATIONS } from '../game/physics';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import { MapPin, Navigation, Compass, X, Zap, CheckCircle2 } from 'lucide-react';

interface CityMapModalProps {
  playerPos: THREE.Vector3;
  currentOrder: DeliveryOrder | null;
  unlockedDistricts: DistrictId[];
  onTeleport: (x: number, z: number, heading: number, name: string) => void;
  onClose: () => void;
}

export const CityMapModal: React.FC<CityMapModalProps> = ({
  playerPos,
  currentOrder,
  unlockedDistricts,
  onTeleport,
  onClose,
}) => {
  const [selectedWaypoint, setSelectedWaypoint] = useState<typeof RESPAWN_LOCATIONS[0] | null>(null);

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
      top: Math.max(5, Math.min(95, top)),
    };
  };

  const playerCoord = toUIPct(playerPos.x, playerPos.z);

  const handleSelectWaypoint = (wp: typeof RESPAWN_LOCATIONS[0]) => {
    setSelectedWaypoint(wp);
    sound.playHorn();
  };

  const handleFastTravel = () => {
    if (!selectedWaypoint) return;
    sound.playCash();
    onTeleport(selectedWaypoint.x, selectedWaypoint.z, selectedWaypoint.heading, selectedWaypoint.name);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/88 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-2xl bg-slate-900 border-4 border-cyan-500/60 rounded-[32px] p-5 shadow-2xl flex flex-col h-[640px] relative overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Mapa Geral da Metrópole <span className="text-xs bg-cyan-500 text-slate-950 px-2 py-0.5 rounded-full font-black">GPS SATELITAL</span>
              </h2>
              <span className="text-xs font-bold text-cyan-400">Clique em qualquer local para Fast Travel dinâmico</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Map Canvas & Sidebar */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 py-4 overflow-hidden">
          {/* Interactive Map View (2D Radar) */}
          <div className="md:col-span-2 bg-slate-950 border-2 border-slate-800 rounded-3xl relative overflow-hidden flex items-center justify-center p-4">
            {/* Grid Lines background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />

            {/* Map Districts Visual Blocks */}
            <div className="absolute inset-6 grid grid-cols-3 grid-rows-3 gap-2 opacity-30 pointer-events-none">
              <div className="bg-sky-500/20 rounded-2xl border border-sky-500/30 flex items-center justify-center text-[10px] font-black text-sky-300">INDUSTRIAL</div>
              <div className="bg-amber-500/20 rounded-2xl border border-amber-500/30 flex items-center justify-center text-[10px] font-black text-amber-300">CENTRO</div>
              <div className="bg-purple-500/20 rounded-2xl border border-purple-500/30 flex items-center justify-center text-[10px] font-black text-purple-300">JARDINS</div>
              <div className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-[10px] font-black text-emerald-300">FAVELA</div>
              <div className="bg-blue-500/20 rounded-2xl border border-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-300">PONTE ESTAIADA</div>
              <div className="bg-rose-500/20 rounded-2xl border border-rose-500/30 flex items-center justify-center text-[10px] font-black text-rose-300">ORLA DA PRAIA</div>
              <div className="bg-indigo-500/20 rounded-2xl border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-300">AUTÓDROMO</div>
              <div className="bg-teal-500/20 rounded-2xl border border-teal-500/30 flex items-center justify-center text-[10px] font-black text-teal-300">NOVA METRÓPOLE</div>
              <div className="bg-slate-700/20 rounded-2xl border border-slate-600/30" />
            </div>

            {/* Waypoints Pins */}
            {RESPAWN_LOCATIONS.map((wp, idx) => {
              const pos = toUIPct(wp.x, wp.z);
              const isSelected = selectedWaypoint?.name === wp.name;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectWaypoint(wp)}
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg z-20 ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 scale-125 ring-4 ring-cyan-400/40'
                      : 'bg-slate-900 border-2 border-cyan-500 text-cyan-400 hover:scale-110 hover:bg-cyan-500 hover:text-slate-950'
                  }`}
                  title={wp.name}
                >
                  <MapPin className="w-4 h-4" />
                </button>
              );
            })}

            {/* Live Player Marker */}
            <div
              style={{ left: `${playerCoord.left}%`, top: `${playerCoord.top}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg shadow-emerald-500/50 flex items-center justify-center z-30 animate-pulse"
              title="Sua Moto"
            >
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-slate-300 space-y-1 z-10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
                <span>Sua Moto (Tempo Real)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400 border border-slate-950" />
                <span>Ponto de Viagem Rápida</span>
              </div>
            </div>
          </div>

          {/* Sidebar Waypoint Details & Fast Travel Action */}
          <div className="bg-slate-950/80 border-2 border-slate-800 rounded-3xl p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <span>📍</span> Destino Selecionado
              </h3>

              {selectedWaypoint ? (
                <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-3.5 space-y-2">
                  <h4 className="text-xs font-black text-white">{selectedWaypoint.name}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Coordenadas X: {Math.round(selectedWaypoint.x)}, Z: {Math.round(selectedWaypoint.z)}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Zona de Aterrisagem Segura</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 text-center text-slate-400 text-xs font-medium">
                  Clique em qualquer marcador 📍 azul no mapa para selecionar o destino de Fast Travel.
                </div>
              )}
            </div>

            {/* Fast Travel Action Button */}
            <div className="pt-3">
              <button
                onClick={handleFastTravel}
                disabled={!selectedWaypoint}
                className={`w-full py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedWaypoint
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110 active:scale-95 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>VIAJAR PARA CÁ (FAST TRAVEL)</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
