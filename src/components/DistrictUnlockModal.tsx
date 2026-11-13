import React from 'react';
import { District } from '../types/game';
import { MapPin, Navigation, Sparkles, Check } from 'lucide-react';
import districtsMapArt from '../assets/images/districts_map_preview_1794024919562.jpg';

interface DistrictUnlockModalProps {
  district: District;
  onClose: () => void;
}

export const DistrictUnlockModal: React.FC<DistrictUnlockModalProps> = ({
  district,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]">
      <div
        className="w-full max-w-md bg-slate-900 border-2 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
        style={{ borderColor: district.themeColor }}
      >
        {/* Background District Art preview */}
        <div className="absolute inset-0 -z-10 opacity-25 overflow-hidden">
          <img
            src={districtsMapArt}
            alt="Panorama"
            className="w-full h-full object-cover object-center filter blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
        </div>

        {/* Glow ambient background */}
        <div
          className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: district.themeColor }}
        />

        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl sm:text-3xl mb-3 sm:mb-4 shadow-lg">
          🎉
        </div>

        <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1">
          Novo Bairro Desbloqueado!
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
          {district.name}
        </h3>

        <p className="text-xs font-semibold text-slate-300 mb-4 px-2">
          {district.description}
        </p>

        <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 mb-6 flex items-center justify-around">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Tarifa Base</div>
            <div className="text-sm font-black text-emerald-400">
              +{Math.round((district.baseFareMultiplier - 1) * 100)}% Ganhos
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Tipo de Pista</div>
            <div className="text-sm font-bold text-slate-200">
              {district.tagline}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-lg transition-transform active:scale-95 cursor-pointer"
        >
          EXPLORAR {district.name.toUpperCase()}
        </button>
      </div>
    </div>
  );
};
