import React, { useState } from 'react';
import { PlayerStats } from '../types/game';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import { Phone, ShieldAlert, Wrench, ShoppingBag, Flame, X, Check, Compass } from 'lucide-react';

interface SmartphoneModalProps {
  stats: PlayerStats;
  onCallPolice: () => void;
  onCallRival: () => void;
  onInstantRepair: () => void;
  onOpenShop: () => void;
  onOpenGunShop: () => void;
  onOpenMobileWorkshop: () => void;
  onOpenCityMap: () => void;
  onClose: () => void;
}

export const SmartphoneModal: React.FC<SmartphoneModalProps> = ({
  stats,
  onCallPolice,
  onCallRival,
  onInstantRepair,
  onOpenShop,
  onOpenGunShop,
  onOpenMobileWorkshop,
  onOpenCityMap,
  onClose,
}) => {
  const [activeScreen, setActiveScreen] = useState<'home' | 'contacts' | 'apps'>('home');
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const handleMakeCall = (name: string, action: () => void, cost: number = 0) => {
    if (cost > 0 && stats.coins < cost) {
      setCallStatus(`Saldo insuficiente! R$ ${cost} necessários.`);
      sound.playTaunt('Sem grana!');
      return;
    }
    setCallStatus(`Ligando para ${name}...`);
    sound.playHorn();
    setTimeout(() => {
      action();
      setCallStatus(`Atendido: ${name} conectado!`);
      sound.playCash();
      setTimeout(() => setCallStatus(null), 2500);
    }, 1000);
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
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-sm bg-slate-950 border-4 border-slate-700 rounded-[40px] p-4 shadow-2xl flex flex-col h-[560px] relative overflow-hidden"
      >
        {/* Smartphone Speaker Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full flex items-center justify-center z-10">
          <div className="w-12 h-1.5 bg-slate-800 rounded-full" />
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between text-[11px] font-black text-slate-300 pt-3 px-3 pb-2 border-b border-slate-800 shrink-0">
          <span>20:48</span>
          <div className="flex items-center gap-1.5">
            <span>5G 📶</span>
            <span>🔋 98%</span>
          </div>
        </div>

        {/* Screen Header */}
        <div className="flex items-center justify-between py-2 px-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <div>
              <h2 className="text-xs font-black text-white">Celular do Motoboy</h2>
              <span className="text-[10px] font-bold text-amber-400">R$ {stats.coins.toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Screen Body */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {callStatus && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-2.5 text-center animate-pulse">
              <span className="text-xs font-black text-amber-300">{callStatus}</span>
            </div>
          )}

          {activeScreen === 'home' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => { onClose(); onOpenCityMap(); }}
                  className="bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform col-span-2"
                >
                  <Compass className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-cyan-300">Mapa da Cidade & Fast Travel 🗺️</span>
                </button>
                <button
                  onClick={() => { onClose(); onOpenMobileWorkshop(); }}
                  className="bg-slate-900 hover:bg-slate-800 border border-amber-500/40 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300">Oficina Móvel 🔧</span>
                </button>
                <button
                  onClick={() => setActiveScreen('contacts')}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-200">Contatos</span>
                </button>
                <button
                  onClick={() => setActiveScreen('apps')}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-200">Lojas SP</span>
                </button>
                <button
                  onClick={() => handleMakeCall('Mecânico 24h', onInstantRepair, 30)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <Wrench className="w-5 h-5 text-sky-400" />
                  <span className="text-[10px] font-bold text-slate-200">Guincho R$30</span>
                </button>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-3.5 flex flex-col gap-2.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Emergência & Rivalidade</span>
                
                <button
                  onClick={() => handleMakeCall('Polícia Militar (190)', onCallPolice, 50)}
                  className="w-full py-2 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-between shadow-lg cursor-pointer active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Chamar Polícia (190)</span>
                  </div>
                  <span className="text-[9px] bg-blue-950 px-2 py-0.5 rounded-lg">R$ 50</span>
                </button>

                <button
                  onClick={() => handleMakeCall('Rival Falcão', onCallRival, 0)}
                  className="w-full py-2 px-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-between shadow-lg cursor-pointer active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    <span>Provocar Rival Falcão</span>
                  </div>
                  <span className="text-[9px] bg-rose-950 px-2 py-0.5 rounded-lg">Grátis</span>
                </button>
              </div>
            </div>
          )}

          {activeScreen === 'contacts' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-white uppercase tracking-wider">Agenda Telefônica</span>
                <button onClick={() => setActiveScreen('home')} className="text-[10px] text-amber-400 font-bold">Voltar</button>
              </div>

              <div
                onClick={() => handleMakeCall('Polícia Militar (190)', onCallPolice, 50)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">190</div>
                  <div>
                    <div className="text-xs font-black text-white">Polícia Militar</div>
                    <div className="text-[9px] text-slate-400">Chamar viatura contra bandidos</div>
                  </div>
                </div>
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>

              <div
                onClick={() => handleMakeCall('Rival Falcão', onCallRival, 0)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm font-black">🦅</div>
                  <div>
                    <div className="text-xs font-black text-white">Falcão (Concorrente)</div>
                    <div className="text-[9px] text-slate-400">Provocar entregador concorrente</div>
                  </div>
                </div>
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>

              <div
                onClick={() => handleMakeCall('Mecânico Rápido', onInstantRepair, 30)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-black">🔧</div>
                  <div>
                    <div className="text-xs font-black text-white">Mecânico 24h</div>
                    <div className="text-[9px] text-slate-400">Conserto de emergência na pista</div>
                  </div>
                </div>
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          )}

          {activeScreen === 'apps' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-white uppercase tracking-wider">Aplicativos de Loja</span>
                <button onClick={() => setActiveScreen('home')} className="text-[10px] text-amber-400 font-bold">Voltar</button>
              </div>

              <button
                onClick={() => { onClose(); onOpenShop(); }}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-base">🏍️</div>
                  <div className="text-left">
                    <div className="text-xs font-black text-white">Concessionária Moto Shop</div>
                    <div className="text-[9px] text-slate-400">Pintura, nitro e upgrades mecânicos</div>
                  </div>
                </div>
                <Check className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => { onClose(); onOpenGunShop(); }}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-rose-500/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-base">🔫</div>
                  <div className="text-left">
                    <div className="text-xs font-black text-white">Ammunation (Loja de Armas)</div>
                    <div className="text-[9px] text-slate-400">Equipamentos e proteção de defesa</div>
                  </div>
                </div>
                <Check className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Home Bar */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center shrink-0">
          <button
            onClick={() => setActiveScreen('home')}
            className="w-28 h-1 bg-slate-700 hover:bg-white rounded-full cursor-pointer transition-colors"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};
