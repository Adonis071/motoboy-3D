import React from 'react';
import { DailyMission } from '../game/missions';
import { Trophy, CheckCircle2, Gift, X, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface MissionsModalProps {
  missions: DailyMission[];
  onClaimReward: (missionId: string, reward: number) => void;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  missions,
  onClaimReward,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 font-['Plus_Jakarta_Sans',sans-serif] backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.94, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, y: 14, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-2xl flex flex-col gap-4 sm:gap-6 overflow-y-auto max-h-[88vh]"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-4 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl sm:text-2xl shrink-0">
              🎯
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-amber-400">
                <Sparkles className="w-3 h-3" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest truncate">Desafios Diários</span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white truncate">Missões do Motoboy</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MISSIONS LIST */}
        <div className="flex flex-col gap-3">
          {missions.map(mission => {
            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
            return (
              <div
                key={mission.id}
                className={`border rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 transition-all ${
                  mission.claimed
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                    : mission.completed
                    ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl sm:text-2xl p-1.5 sm:p-2 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
                      {mission.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-black text-white truncate">{mission.title}</span>
                      <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-snug">{mission.description}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-amber-500/15 border border-amber-500/30 px-2 sm:px-2.5 py-1 rounded-xl">
                    <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span className="text-[11px] sm:text-xs font-black text-amber-400 whitespace-nowrap">+R$ {mission.rewardCoins}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-400 uppercase">Progresso</span>
                    <span className="text-white tabular-nums">
                      {mission.progress} / {mission.target} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        mission.completed ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Action button */}
                <div className="flex justify-end pt-1">
                  {mission.claimed ? (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-black">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>RESGATADO</span>
                    </div>
                  ) : mission.completed ? (
                    <button
                      onClick={() => onClaimReward(mission.id, mission.rewardCoins)}
                      className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer transition-transform animate-bounce"
                    >
                      <Gift className="w-4 h-4" />
                      <span>RESGATAR RECOMPENSA (+R$ {mission.rewardCoins})</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Em andamento...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            ⏰ As missões diárias reiniciam automaticamente todo dia à meia-noite!
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};
