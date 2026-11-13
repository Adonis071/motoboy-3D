import React, { useState } from 'react';
import {
  BikeCustomization,
  BikeUpgrades,
  PlayerStats,
} from '../types/game';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import {
  Wrench,
  Palette,
  Sparkles,
  Zap,
  Gauge,
  Disc,
  Layers,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import workshopBanner from '../assets/images/workshop_tuning_bay_1794024919826.jpg';

interface ShopModalProps {
  stats: PlayerStats;
  upgrades: BikeUpgrades;
  customization: BikeCustomization;
  onBuyUpgrade: (key: keyof BikeUpgrades, cost: number) => void;
  onUpdateCustomization: (newCustom: BikeCustomization) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  stats,
  upgrades,
  customization,
  onBuyUpgrade,
  onUpdateCustomization,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'upgrades' | 'visuals'>('upgrades');

  // Upgrade costs
  const getUpgradeCost = (currentLevel: number, basePrice: number) => {
    return Math.round(basePrice * Math.pow(1.8, currentLevel - 1));
  };

  const engineCost = getUpgradeCost(upgrades.engineLevel, 160);
  const accelCost = getUpgradeCost(upgrades.accelerationLevel, 140);
  const brakesCost = getUpgradeCost(upgrades.brakesLevel, 120);
  const tiresCost = getUpgradeCost(upgrades.tiresLevel, 130);
  const trunkCost = getUpgradeCost(upgrades.trunkLevel, 200);
  const nitroCost = 450;

  // Customization presets
  const paintOptions = [
    { name: 'Vermelho Titan', hex: '#dc2626' },
    { name: 'Preto Fosco', hex: '#18181b' },
    { name: 'Azul Metálico', hex: '#2563eb' },
    { name: 'Amarelo Correio', hex: '#eab308' },
    { name: 'Verde Esmeralda', hex: '#059669' },
    { name: 'Roxo Neon', hex: '#9333ea' },
    { name: 'Dourado Ouro', hex: '#d97706' },
  ];

  const trunkOptions: Array<{ id: BikeCustomization['trunkSkin']; name: string; color: string }> = [
    { id: 'padrao', name: 'Baú Preto Básico', color: '#18181b' },
    { id: 'ifood', name: 'Baú Moto-Food Vermelho', color: '#ea1d2c' },
    { id: 'amarelo', name: 'Baú Rapidão Amarelo', color: '#ffe600' },
    { id: 'uber', name: 'Baú Flash-Eats Verde', color: '#06c167' },
    { id: 'graffiti', name: 'Baú Graffiti Grau & Corte', color: '#7c3aed' },
  ];

  const helmetOptions = [
    { name: 'Preto Grafite', hex: '#1e293b' },
    { name: 'Branco Pérola', hex: '#f8fafc' },
    { name: 'Amarelo Pro-Tork', hex: '#facc15' },
    { name: 'Vermelho Sport', hex: '#ef4444' },
    { name: 'Dourado Campeão', hex: '#eab308' },
  ];

  const neonOptions: Array<{ id: BikeCustomization['neonColor']; name: string; color: string }> = [
    { id: 'none', name: 'Desligado', color: '#475569' },
    { id: 'cyan', name: 'Ciano Cyber', color: '#00f3ff' },
    { id: 'pink', name: 'Rosa Choque', color: '#ff007f' },
    { id: 'lime', name: 'Verde Lime', color: '#39ff14' },
    { id: 'gold', name: 'Dourado Neon', color: '#ffd700' },
    { id: 'purple', name: 'Roxo Cósmico', color: '#a855f7' },
  ];

  const exhaustOptions: Array<{ id: BikeCustomization['exhaustType']; name: string; desc: string }> = [
    { id: 'stock', name: 'Original Silencioso', desc: 'Ronco de fábrica tranquilo' },
    { id: 'sport', name: 'Fortuna Esportivo', desc: 'Ronco encorpado com ponteira de alumínio' },
    { id: 'coyote', name: 'Coyote Boca Aberta', desc: 'Estalado agudo que ecoa pelos prédios' },
    { id: 'direto', name: 'Escape Direto 2 Way', desc: 'Corta giro agressivo no talo!' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85"
    >
      <motion.div
        initial={{ scale: 0.92, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 16, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]"
      >
        {/* Modal Header with Workshop Art Banner */}
        <div className="relative border-b border-slate-800 overflow-hidden bg-slate-950">
          <img
            src={workshopBanner}
            alt="Oficina do Motoboy"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-40 filter contrast-125 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

          <div className="relative p-3 sm:p-5 flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500/30 border border-amber-500/50 backdrop-blur-md flex items-center justify-center text-lg sm:text-2xl shrink-0 shadow-lg">
                🔧
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight truncate drop-shadow">
                    Oficina & Customização
                  </h2>
                  <span className="hidden sm:inline bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    Garagem SP
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-300 hidden sm:block truncate drop-shadow">
                  Aumente a cilindrada, freios e personalize seu visual nas ruas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Coins Balance in Header */}
              <div className="bg-slate-950/80 backdrop-blur-md border border-amber-500/40 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl sm:rounded-2xl flex items-center gap-1.5 shadow-xl">
                <span className="text-xs sm:text-sm">🪙</span>
                <span className="text-xs sm:text-sm md:text-base font-black text-amber-400 tabular-nums">
                  R$ {stats.coins.toLocaleString('pt-BR')}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-2 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('upgrades')}
            className={`flex-1 sm:flex-none justify-center py-2.5 sm:py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer ${
              activeTab === 'upgrades'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-4 h-4 shrink-0" />
            <span>Melhorias Mecânicas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visuals')}
            className={`flex-1 sm:flex-none justify-center py-2.5 sm:py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer ${
              activeTab === 'visuals'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span>Pintura & Estilo</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto touch-scroll-y p-3 sm:p-5 space-y-4">
          {activeTab === 'upgrades' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 1. MOTOR / VELOCIDADE MÁXIMA */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-amber-400" />
                      Motor / Cilindrada
                    </span>
                    <span className="text-xs font-bold text-amber-400">
                      Nível {upgrades.engineLevel}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Aumenta a velocidade final (até 135 km/h) para cruzar avenidas.
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-2 flex-1 rounded-full ${
                          upgrades.engineLevel >= lvl ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {upgrades.engineLevel >= 5 ? (
                  <div className="text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl">
                    ✓ Nível Máximo
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('engineLevel', engineCost)}
                    disabled={stats.coins < engineCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Comprar Upgrade</span>
                    <span>R$ {engineCost}</span>
                  </button>
                )}
              </div>

              {/* 2. ACELERAÇÃO / ARRANQUE */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Aceleração & Relação
                    </span>
                    <span className="text-xs font-bold text-yellow-400">
                      Nível {upgrades.accelerationLevel}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Arranque instantâneo nas esquinas e facilidade para mandar grau.
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-2 flex-1 rounded-full ${
                          upgrades.accelerationLevel >= lvl ? 'bg-yellow-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {upgrades.accelerationLevel >= 5 ? (
                  <div className="text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl">
                    ✓ Nível Máximo
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('accelerationLevel', accelCost)}
                    disabled={stats.coins < accelCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Comprar Upgrade</span>
                    <span>R$ {accelCost}</span>
                  </button>
                )}
              </div>

              {/* 3. FREIOS ESPORTIVOS */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Disc className="w-4 h-4 text-rose-400" />
                      Freios ABS & Disco
                    </span>
                    <span className="text-xs font-bold text-rose-400">
                      Nível {upgrades.brakesLevel}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Frenagem potente para desviar de carros no trânsito sem capotar.
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-2 flex-1 rounded-full ${
                          upgrades.brakesLevel >= lvl ? 'bg-rose-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {upgrades.brakesLevel >= 5 ? (
                  <div className="text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl">
                    ✓ Nível Máximo
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('brakesLevel', brakesCost)}
                    disabled={stats.coins < brakesCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Comprar Upgrade</span>
                    <span>R$ {brakesCost}</span>
                  </button>
                )}
              </div>

              {/* 4. PNEUS DE CHUVA / ADERÊNCIA */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      Pneus de Chuva / Grip
                    </span>
                    <span className="text-xs font-bold text-blue-400">
                      Nível {upgrades.tiresLevel}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Aderência anti-aquaplanagem! Não derrapa em tempestades e curvas molhadas.
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-2 flex-1 rounded-full ${
                          upgrades.tiresLevel >= lvl ? 'bg-blue-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {upgrades.tiresLevel >= 5 ? (
                  <div className="text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl">
                    ✓ Nível Máximo
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('tiresLevel', tiresCost)}
                    disabled={stats.coins < tiresCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Comprar Upgrade</span>
                    <span>R$ {tiresCost}</span>
                  </button>
                )}
              </div>

              {/* 5. BAÚ TÉRMICO EXPANDIDO */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Baú Térmico Expandido
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      Nível {upgrades.trunkLevel}/3
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Aumenta os ganhos e gorjetas por entrega (+20% por nível).
                  </p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3].map(lvl => (
                      <div
                        key={lvl}
                        className={`h-2 flex-1 rounded-full ${
                          upgrades.trunkLevel >= lvl ? 'bg-emerald-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {upgrades.trunkLevel >= 3 ? (
                  <div className="text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl">
                    ✓ Nível Máximo
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('trunkLevel', trunkCost)}
                    disabled={stats.coins < trunkCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Comprar Upgrade</span>
                    <span>R$ {trunkCost}</span>
                  </button>
                )}
              </div>

              {/* 6. KIT NITRO BOOSTER */}
              <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-black text-white text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Kit Nitro Óxido Nitroso
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      {upgrades.nitroUnlocked ? 'INSTALADO' : 'BLOQUEADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Ative o Nitro (tecla N) para arranque supersônico com efeito de chamas!
                  </p>
                </div>
                {upgrades.nitroUnlocked ? (
                  <div className="text-center py-2 text-xs font-bold text-cyan-400 bg-cyan-950/30 rounded-xl">
                    ✓ Nitro Habilitado
                  </div>
                ) : (
                  <button
                    onClick={() => onBuyUpgrade('nitroUnlocked', nitroCost)}
                    disabled={stats.coins < nitroCost}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Instalar Kit Nitro</span>
                    <span>R$ {nitroCost}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. PINTURA DA MOTO */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2.5">
                  Cor da Moto (Tanque & Carenagem)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {paintOptions.map(p => {
                    const isSelected = customization.paintColor === p.hex;
                    return (
                      <button
                        key={p.hex}
                        onClick={() => onUpdateCustomization({ ...customization, paintColor: p.hex })}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: p.hex }}
                        />
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. ADESIVOS DO BAÚ */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2.5">
                  Skin do Baú de Entrega
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {trunkOptions.map(t => {
                    const isSelected = customization.trunkSkin === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onUpdateCustomization({ ...customization, trunkSkin: t.id })}
                        className={`p-3 rounded-xl border flex items-center gap-3 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-lg border border-white/20 shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="truncate">{t.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. CAPACETE DO MOTOBOY */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2.5">
                  Capacete do Piloto
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {helmetOptions.map(h => {
                    const isSelected = customization.helmetColor === h.hex;
                    return (
                      <button
                        key={h.hex}
                        onClick={() => onUpdateCustomization({ ...customization, helmetColor: h.hex })}
                        className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-yellow-400 bg-yellow-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: h.hex }}
                        />
                        <span className="truncate">{h.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. NEON UNDERGLOW */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2.5">
                  Luz Neon sob o Chassi (Underglow)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {neonOptions.map(n => {
                    const isSelected = customization.neonColor === n.id;
                    return (
                      <button
                        key={n.id}
                        onClick={() => onUpdateCustomization({ ...customization, neonColor: n.id })}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: n.color }}
                        />
                        <span className="truncate">{n.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. SOM DO ESCAPAMENTO */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2.5">
                  Escapamento & Ronco do Motor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {exhaustOptions.map(ex => {
                    const isSelected = customization.exhaustType === ex.id;
                    return (
                      <button
                        key={ex.id}
                        onClick={() => {
                          onUpdateCustomization({ ...customization, exhaustType: ex.id });
                          sound.stopEngine();
                          sound.startEngine(ex.id);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-purple-400 bg-purple-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{ex.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400">{ex.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Dica: Melhore os <strong className="text-white">Pneus</strong> para não derrapar na chuva!
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Voltar às Entregas
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
