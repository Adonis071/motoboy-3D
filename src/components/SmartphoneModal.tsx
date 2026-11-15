import React, { useState } from 'react';
import { DeliveryOrder, PlayerStats } from '../types/game';
import { sound } from '../audio/soundEngine';
import { motion } from 'motion/react';
import {
  Phone,
  ShieldAlert,
  Wrench,
  ShoppingBag,
  Flame,
  X,
  Check,
  Compass,
  Package,
  Star,
  DollarSign,
} from 'lucide-react';

interface SmartphoneModalProps {
  stats: PlayerStats;
  currentOrder?: DeliveryOrder | null;
  availableOrders?: DeliveryOrder[];
  onAcceptOrder?: (order: DeliveryOrder) => void;
  onDeclineOrder?: (orderId: string) => void;
  onCallPolice: () => void;
  onCallRival: () => void;
  onInstantRepair: () => void;
  onRefuel?: () => void;
  onOpenShop: () => void;
  onOpenGunShop: () => void;
  onOpenMobileWorkshop: () => void;
  onOpenCityMap: () => void;
  onClose: () => void;
}

export const SmartphoneModal: React.FC<SmartphoneModalProps> = ({
  stats,
  currentOrder,
  availableOrders = [],
  onAcceptOrder,
  onDeclineOrder,
  onCallPolice,
  onCallRival,
  onInstantRepair,
  onRefuel,
  onOpenShop,
  onOpenGunShop,
  onOpenMobileWorkshop,
  onOpenCityMap,
  onClose,
}) => {
  const [activeScreen, setActiveScreen] = useState<
    'home' | 'orders' | 'reviews' | 'history' | 'contacts' | 'apps'
  >('orders');
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
    }, 800);
  };

  const reviews = stats.customerReviews && stats.customerReviews.length > 0
    ? stats.customerReviews
    : [
        {
          id: 'rev_default_1',
          customerName: 'Torre Mirante',
          itemTitle: 'Combo Duplo Smash Bacon',
          stars: 5,
          comment: 'Chegou super quente e antes do prazo! Motoboy nota 10!',
          timestamp: 'Hoje',
        },
        {
          id: 'rev_default_2',
          customerName: 'Condomínio Bougainville',
          itemTitle: 'Pizza Napolitana Burrata',
          stars: 5,
          comment: 'Direção impecável, a pizza chegou intacta sem amassar!',
          timestamp: 'Hoje',
        },
      ];

  const history = stats.earningsHistory || [];

  const getCustomerVisualProfile = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a1665e'];
    const shirts = ['#10b981', '#f97316', '#3b82f6', '#ec4899', '#eab308', '#8b5cf6'];
    const hairs = ['#111827', '#451a03', '#92400e', '#b45309', '#dc2626', '#cbd5e1'];
    const badges = ['🎧', '🕶️', '🧢', '🎒', '🛍️', '✨'];
    return {
      skin: skins[hash % skins.length],
      shirt: shirts[(hash >> 3) % shirts.length],
      hair: hairs[(hash >> 6) % hairs.length],
      badge: badges[(hash >> 9) % badges.length],
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-sm bg-slate-950 border-4 border-slate-700 rounded-[40px] p-4 shadow-2xl flex flex-col h-[590px] max-h-[92vh] relative overflow-hidden"
      >
        {/* Smartphone Speaker Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full flex items-center justify-center z-10">
          <div className="w-12 h-1.5 bg-slate-800 rounded-full" />
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between text-[11px] font-black text-slate-300 pt-3 px-3 pb-2 border-b border-slate-800 shrink-0">
          <span>20:48</span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">★ {stats.rating.toFixed(1)}</span>
            <span>5G 📶</span>
            <span>🔋 98%</span>
          </div>
        </div>

        {/* Screen Header */}
        <div className="flex items-center justify-between py-2 px-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <div>
              <h2 className="text-xs font-black text-white">App Moto-Food & Celular</h2>
              <span className="text-[10px] font-bold text-emerald-400">
                Saldo: R$ {stats.coins.toLocaleString('pt-BR')} • {stats.completedDeliveries} entregas
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 mb-2 shrink-0">
          <button
            onClick={() => setActiveScreen('orders')}
            className={`py-1.5 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeScreen === 'orders'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Pedidos</span>
          </button>
          <button
            onClick={() => setActiveScreen('reviews')}
            className={`py-1.5 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeScreen === 'reviews'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Avaliações</span>
          </button>
          <button
            onClick={() => setActiveScreen('history')}
            className={`py-1.5 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeScreen === 'history'
                ? 'bg-orange-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Ganhos</span>
          </button>
          <button
            onClick={() => setActiveScreen('home')}
            className={`py-1.5 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeScreen === 'home' || activeScreen === 'contacts' || activeScreen === 'apps'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
        </div>

        {/* Screen Body */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-2.5">
          {callStatus && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-2.5 text-center animate-pulse">
              <span className="text-xs font-black text-amber-300">{callStatus}</span>
            </div>
          )}

          {/* TAB 1: LISTA DE PEDIDOS PARA ACEITAR OU RECUSAR */}
          {activeScreen === 'orders' && (
            <div className="space-y-2.5">
              {currentOrder && (
                <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                      🟢 Pedido Atual em Andamento
                    </span>
                    <span className="text-[10px] font-black text-amber-400">
                      R$ {currentOrder.rewardCoins} + R$ {currentOrder.tipPotential} gorjeta
                    </span>
                  </div>
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>{currentOrder.icon}</span>
                    <span className="truncate">{currentOrder.itemTitle}</span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate mt-0.5">
                    📍 {currentOrder.state === 'to_pickup' ? `Coleta: ${currentOrder.restaurantName}` : `Entrega: ${currentOrder.customerName}`}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                  Chamadas Disponíveis ({availableOrders.length})
                </span>
                <span className="text-[9px] text-emerald-400 font-bold">
                  Aceitar ou Recusar
                </span>
              </div>

              {availableOrders.map(ord => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
                        {ord.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">{ord.itemTitle}</div>
                        <div className="text-[10px] text-slate-300 truncate flex items-center gap-1 mt-0.5">
                          {(() => {
                            const prof = getCustomerVisualProfile(ord.customerName);
                            return (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-emerald-400/50 shrink-0 overflow-hidden bg-slate-950"
                                title={`Cliente: ${ord.customerName}`}
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                                  <path d="M4 22 C4 16 20 16 20 22 Z" fill={prof.shirt} />
                                  <circle cx="12" cy="10" r="5" fill={prof.skin} />
                                  <path d="M7 9 C7 5 17 5 17 9 Z" fill={prof.hair} />
                                </svg>
                              </span>
                            );
                          })()}
                          <span className="truncate">
                            {ord.restaurantName} → {ord.customerName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-emerald-400">
                        R$ {ord.rewardCoins}
                      </div>
                      <div className="text-[9px] font-bold text-amber-400">
                        +R$ {ord.tipPotential} gorjeta
                      </div>
                    </div>
                  </div>

                  {/* Order Type Badges: Comida Quente, Frágil, Urgente */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ord.isHot && (
                      <span className="text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-md">
                        🔥 Comida Quente ({ord.timeLimitSeconds}s)
                      </span>
                    )}
                    {ord.isFragile && (
                      <span className="text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md">
                        🍷 Frágil (Sem Batidas)
                      </span>
                    )}
                    {ord.isUrgent && (
                      <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                        ⚡ Urgente (Bônus Alto)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        sound.playCrash();
                        onDeclineOrder?.(ord.id);
                      }}
                      className="py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-rose-300 font-black text-[11px] cursor-pointer active:scale-95 transition-all"
                    >
                      ✕ RECUSAR
                    </button>
                    <button
                      onClick={() => {
                        sound.playOrderNotification();
                        onAcceptOrder?.(ord);
                        onClose();
                      }}
                      className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] cursor-pointer active:scale-95 transition-all shadow"
                    >
                      ✓ ACEITAR PEDIDO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: AVALIAÇÃO DOS CLIENTES */}
          {activeScreen === 'reviews' && (
            <div className="space-y-2.5">
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400">
                    Reputação do Entregador
                  </span>
                  <div className="text-xl font-black text-white flex items-center gap-1.5 mt-0.5">
                    <span>⭐ {stats.rating.toFixed(2)}</span>
                    <span className="text-xs font-bold text-emerald-400">/ 5.0</span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <div>{stats.completedDeliveries} entregas</div>
                  <div className="text-emerald-400 font-bold">Nota Alta = +Gorjeta!</div>
                </div>
              </div>

              {reviews.map(r => {
                const prof = getCustomerVisualProfile(r.customerName);
                return (
                  <div
                    key={r.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-emerald-400/50 shrink-0 overflow-hidden bg-slate-950">
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path d="M4 22 C4 16 20 16 20 22 Z" fill={prof.shirt} />
                            <circle cx="12" cy="10" r="5" fill={prof.skin} />
                            <path d="M7 9 C7 5 17 5 17 9 Z" fill={prof.hair} />
                            <circle cx="10.3" cy="10" r="0.8" fill="#0f172a" />
                            <circle cx="13.7" cy="10" r="0.8" fill="#0f172a" />
                            <path d="M10 12.2 Q12 13.8 14 12.2" stroke="#0f172a" strokeWidth="1.1" fill="none" />
                          </svg>
                        </span>
                        <span className="text-xs font-black text-white truncate">
                          {r.customerName} {prof.badge}
                        </span>
                      </div>
                      <span className="text-xs font-black text-amber-400 shrink-0">
                        {'★'.repeat(Math.max(1, Math.min(5, Math.round(r.stars))))}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-400 truncate">
                      {r.itemTitle}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">"{r.comment}"</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: HISTÓRICO DE GANHOS */}
          {activeScreen === 'history' && (
            <div className="space-y-2.5">
              <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400">
                    Saldo em Conta
                  </span>
                  <div className="text-lg font-black text-white">
                    R$ {stats.coins.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total Entregas</span>
                  <span className="text-sm font-black text-amber-400">
                    {stats.completedDeliveries} concluídas
                  </span>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold">
                  Conclua sua primeira entrega para ver o extrato detalhado de corridas e gorjetas!
                </div>
              ) : (
                history.map(item => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{item.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">
                          {item.itemTitle}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.customerName} • {item.orderTag}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-emerald-400">+R$ {item.total}</div>
                      <div className="text-[9px] text-amber-400 font-bold">
                        (Gorjeta R$ {item.tip})
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeScreen === 'home' && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    onOpenCityMap();
                  }}
                  className="bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform col-span-2"
                >
                  <Compass className="w-5 h-5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-cyan-300">
                    Mapa da Cidade & Fast Travel 🗺️
                  </span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenMobileWorkshop();
                  }}
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
                  <span className="text-[10px] font-bold text-slate-200">Lojas & Roupas</span>
                </button>
                <button
                  onClick={() =>
                    handleMakeCall('Posto & Mecânico 24h', () => {
                      onInstantRepair();
                      onRefuel?.();
                    }, 30)
                  }
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <Wrench className="w-5 h-5 text-sky-400" />
                  <span className="text-[10px] font-bold text-slate-200">Socorro R$30</span>
                </button>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-3.5 flex flex-col gap-2.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Emergência & Rivalidade
                </span>

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
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Agenda Telefônica
                </span>
                <button
                  onClick={() => setActiveScreen('home')}
                  className="text-[10px] text-amber-400 font-bold"
                >
                  Voltar
                </button>
              </div>

              <div
                onClick={() => handleMakeCall('Polícia Militar (190)', onCallPolice, 50)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">
                    190
                  </div>
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
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm font-black">
                    🦅
                  </div>
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
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-black">
                    🔧
                  </div>
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
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Aplicativos de Loja
                </span>
                <button
                  onClick={() => setActiveScreen('home')}
                  className="text-[10px] text-amber-400 font-bold"
                >
                  Voltar
                </button>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenShop();
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-base">
                    🏍️
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-black text-white">Oficina, Roupas & Moto Shop</div>
                    <div className="text-[9px] text-slate-400">
                      Motor, pneus, bag térmica, roupas e combustível
                    </div>
                  </div>
                </div>
                <Check className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenGunShop();
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-rose-500/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-base">
                    🔫
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-black text-white">Ammunation (Defesa)</div>
                    <div className="text-[9px] text-slate-400">
                      Equipamentos e proteção de defesa
                    </div>
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
            onClick={() => setActiveScreen('orders')}
            className="w-28 h-1 bg-slate-700 hover:bg-white rounded-full cursor-pointer transition-colors"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

