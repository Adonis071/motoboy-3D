import React from 'react';
import { BikeUpgrades, BikeCustomization } from '../types/game';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import { Wrench, Zap, Flame, Shield, Disc, Check, X, Gauge } from 'lucide-react';

interface MobileWorkshopModalProps {
  upgrades: BikeUpgrades;
  customization: BikeCustomization;
  coins: number;
  onUpdateUpgrades: (upgrades: BikeUpgrades) => void;
  onUpdateCustomization: (customization: BikeCustomization) => void;
  onDeductCoins: (amount: number) => void;
  onClose: () => void;
}

export const MobileWorkshopModal: React.FC<MobileWorkshopModalProps> = ({
  upgrades,
  customization,
  coins,
  onUpdateUpgrades,
  onUpdateCustomization,
  onDeductCoins,
  onClose,
}) => {
  const handleBuyUpgrade = (type: keyof BikeUpgrades, cost: number, maxLevel: number = 5) => {
    const currentVal = typeof upgrades[type] === 'number' ? (upgrades[type] as number) : 0;
    if (currentVal >= maxLevel) {
      sound.playTaunt('Já está no máximo!');
      return;
    }
    if (coins < cost) {
      sound.playTaunt('Sem grana!');
      return;
    }

    onDeductCoins(cost);
    const updated = { ...upgrades, [type]: currentVal + 1 };
    onUpdateUpgrades(updated);
    sound.playCash();
  };

  const handleToggleNitro = (cost: number) => {
    if (upgrades.nitroUnlocked) return;
    if (coins < cost) {
      sound.playTaunt('Sem grana!');
      return;
    }
    onDeductCoins(cost);
    onUpdateUpgrades({ ...upgrades, nitroUnlocked: true });
    sound.playCash();
  };

  const handleSelectExhaust = (exhaustId: BikeCustomization['exhaustType'], cost: number) => {
    if (customization.exhaustType === exhaustId) return;
    if (coins < cost && cost > 0) {
      sound.playTaunt('Sem grana!');
      return;
    }
    if (cost > 0) onDeductCoins(cost);
    const newCust = { ...customization, exhaustType: exhaustId };
    onUpdateCustomization(newCust);
    sound.startEngine(exhaustId);
    sound.playCash();
  };

  const exhaustOptions: Array<{ id: BikeCustomization['exhaustType']; name: string; cost: number; desc: string }> = [
    { id: 'stock', name: 'Original (Stock)', cost: 0, desc: 'Escapamento padrão silencioso e discreto.' },
    { id: 'sport', name: 'Esportivo (Pipe)', cost: 180, desc: 'Ronco encorpado e médio giro esportivo.' },
    { id: 'coyote', name: 'Coyote Triplo', cost: 320, desc: 'Som grave de alta performance e estalos.' },
    { id: 'direto', name: 'Direto / Torbal', cost: 450, desc: 'Barulho ensurdecedor de corrida e corte de giro!' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-lg bg-slate-900 border-4 border-amber-500/60 rounded-[32px] p-5 shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Oficina Móvel Express <span className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black">24H</span>
              </h2>
              <span className="text-xs font-bold text-amber-400">Saldo: R$ {coins.toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Turbo / Engine */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Kit Turbo / Motor Nível {upgrades.engineLevel}/5</h3>
                <p className="text-[11px] text-slate-400">Aumenta velocidade máxima e torque em tempo real.</p>
              </div>
            </div>
            <button
              onClick={() => handleBuyUpgrade('engineLevel', upgrades.engineLevel * 180 + 160, 5)}
              disabled={upgrades.engineLevel >= 5}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                upgrades.engineLevel >= 5
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:brightness-110 active:scale-95'
              }`}
            >
              {upgrades.engineLevel >= 5 ? 'MÁX' : `R$ ${(upgrades.engineLevel * 180 + 160).toLocaleString()}`}
            </button>
          </div>

          {/* Acceleration */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Injeção & Aceleração Nível {upgrades.accelerationLevel}/5</h3>
                <p className="text-[11px] text-slate-400">Respostas de arrancada mais rápidas e potentes.</p>
              </div>
            </div>
            <button
              onClick={() => handleBuyUpgrade('accelerationLevel', upgrades.accelerationLevel * 150 + 140, 5)}
              disabled={upgrades.accelerationLevel >= 5}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                upgrades.accelerationLevel >= 5
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-400 text-slate-950 hover:brightness-110 active:scale-95'
              }`}
            >
              {upgrades.accelerationLevel >= 5 ? 'MÁX' : `R$ ${(upgrades.accelerationLevel * 150 + 140).toLocaleString()}`}
            </button>
          </div>

          {/* Tires */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <Disc className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Pneus Slick / Drift Nível {upgrades.tiresLevel}/5</h3>
                <p className="text-[11px] text-slate-400">Melhora aderência nas curvas e estabilidade nas ladeiras.</p>
              </div>
            </div>
            <button
              onClick={() => handleBuyUpgrade('tiresLevel', upgrades.tiresLevel * 140 + 130, 5)}
              disabled={upgrades.tiresLevel >= 5}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                upgrades.tiresLevel >= 5
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:brightness-110 active:scale-95'
              }`}
            >
              {upgrades.tiresLevel >= 5 ? 'MÁX' : `R$ ${(upgrades.tiresLevel * 140 + 130).toLocaleString()}`}
            </button>
          </div>

          {/* Brakes */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Freios de Cerâmica Nível {upgrades.brakesLevel}/5</h3>
                <p className="text-[11px] text-slate-400">Reduz distância de frenagem em emergências.</p>
              </div>
            </div>
            <button
              onClick={() => handleBuyUpgrade('brakesLevel', upgrades.brakesLevel * 130 + 120, 5)}
              disabled={upgrades.brakesLevel >= 5}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                upgrades.brakesLevel >= 5
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 active:scale-95'
              }`}
            >
              {upgrades.brakesLevel >= 5 ? 'MÁX' : `R$ ${(upgrades.brakesLevel * 130 + 120).toLocaleString()}`}
            </button>
          </div>

          {/* Nitro Pro */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">Kit Nitro Pro Instantâneo</h3>
                <p className="text-[11px] text-slate-400">Oxigênio extra para arrancadas supersônicas.</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleNitro(350)}
              disabled={upgrades.nitroUnlocked}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                upgrades.nitroUnlocked
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:brightness-110 active:scale-95'
              }`}
            >
              {upgrades.nitroUnlocked ? 'INSTALADO' : 'R$ 350'}
            </button>
          </div>

          {/* Exhaust Customization */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-black text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
              <span>🔊</span> Escapamento Esportivo (Alteração de Ronco em Tempo Real)
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {exhaustOptions.map(ex => {
                const isSelected = customization.exhaustType === ex.id;
                return (
                  <button
                    key={ex.id}
                    onClick={() => handleSelectExhaust(ex.id, ex.cost)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black">{ex.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{ex.desc}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-amber-400">{ex.cost === 0 ? 'Grátis' : `R$ ${ex.cost}`}</span>
                      <span className="text-slate-400">{isSelected ? 'Ativo' : 'Instalar'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Peças aplicadas instantaneamente na moto!</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors cursor-pointer"
          >
            Concluir & Pilotar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
