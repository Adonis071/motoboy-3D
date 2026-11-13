import React, { useState } from 'react';
import { PlayerStats } from '../types/game';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import { Shield, Zap, Target, Crosshair, X, Check } from 'lucide-react';

interface GunShopModalProps {
  stats: PlayerStats;
  onBuyItem: (itemName: string, cost: number, effect: string) => void;
  onClose: () => void;
}

export const GunShopModal: React.FC<GunShopModalProps> = ({
  stats,
  onBuyItem,
  onClose,
}) => {
  const [purchased, setPurchased] = useState<Record<string, boolean>>({});

  const weaponsList = [
    {
      id: 'kevlar_vest',
      name: 'Colete Balístico Nível III',
      category: 'Proteção',
      cost: 180,
      icon: '🛡️',
      desc: 'Proteção reforçada contra disparos e quedas de moto.',
      effect: 'Resistência +50%',
    },
    {
      id: 'taser_gun',
      name: 'Taser de Choque Tático',
      category: 'Atordoamento',
      cost: 250,
      icon: '⚡',
      desc: 'Paralisa e neutraliza ladrões de moto à distância.',
      effect: 'Atordoa Ladrões',
    },
    {
      id: 'glock_pistol',
      name: 'Pistola 9mm Defender',
      category: 'Defesa Pessoal',
      cost: 450,
      icon: '🔫',
      desc: 'Repete tiros de intimidação para afugentar assaltantes.',
      effect: 'Inibe Ladrões',
    },
  ];

  const handlePurchase = (item: typeof weaponsList[0]) => {
    if (stats.coins < item.cost) {
      sound.playTaunt('Sem grana!');
      return;
    }
    sound.playCash();
    setPurchased(prev => ({ ...prev, [item.id]: true }));
    onBuyItem(item.name, item.cost, item.effect);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <motion.div
        initial={{ scale: 0.92, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 16, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-xl">
              🔫
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Ammunation & Defesa Tática</h2>
              <span className="text-xs text-amber-400 font-bold">Saldo: R$ {stats.coins.toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Weapons List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {weaponsList.map(item => {
            const isBought = purchased[item.id];
            return (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl p-2 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white truncate">{item.name}</span>
                      <span className="text-[9px] bg-rose-950/80 border border-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded-full font-bold">
                        {item.effect}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate leading-tight mt-0.5">{item.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(item)}
                  disabled={isBought || stats.coins < item.cost}
                  className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-transform active:scale-95 cursor-pointer ${
                    isBought
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                      : stats.coins >= item.cost
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isBought ? 'EQUIPADO ✓' : `R$ ${item.cost}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-center text-[10px] text-slate-400 font-bold uppercase">
          🛡️ Equipamentos táticos ativam proteção contra roubos automaticamente
        </div>
      </motion.div>
    </motion.div>
  );
};
