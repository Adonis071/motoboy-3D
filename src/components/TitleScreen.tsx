import React, { useEffect } from 'react';
import { Trophy, Target, Sparkles, Navigation, CloudRain, Flame } from 'lucide-react';
import { GameMode } from '../types/game';

import heroPoster from '../assets/images/motoboy_hero_poster_1794024919317.jpg';

interface TitleScreenProps {
  onStartGame: (mode: GameMode) => void;
  onOpenShop: () => void;
  coins: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenShop,
  coins,
}) => {
  // Listen for Enter or Space to start Career Mode immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame('career');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-6 md:p-10 pointer-events-auto overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Hero Artwork with cinematic multi-stage gradient overlays */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src={heroPoster}
          alt="Motoboy Express 3D Hero Art"
          className="w-full h-full object-cover object-center scale-105 filter brightness-75 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/40 to-slate-950/90" />
      </div>

      {/* Top Header / Branding Tag */}
      <div className="flex items-center justify-between w-full gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-slate-200 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="truncate">6 CENÁRIOS 3D • CLIMA DINÂMICO & SÃO PAULO</span>
        </div>

        {coins > 0 && (
          <div className="bg-slate-950/85 backdrop-blur-md border border-amber-500/50 px-3 sm:px-4 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-xl shrink-0">
            <span className="text-xs sm:text-sm">🪙</span>
            <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
              R$ {coins.toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </div>

      {/* Hero Centerpiece: Bespoke SVG Title Lockup */}
      <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-auto py-3 sm:py-6">
        <div className="w-full max-w-[290px] sm:max-w-md md:max-w-lg mb-1.5 sm:mb-2">
          <svg
            viewBox="0 0 540 120"
            className="w-full h-auto drop-shadow-[0_10px_25px_rgba(245,158,11,0.35)]"
          >
            <defs>
              <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
              <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            {/* Background dynamic speed slash lines */}
            <path
              d="M30,70 L510,70"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="12 8"
            />
            {/* Main Word "MOTOBOY" */}
            <text
              x="50%"
              y="62"
              textAnchor="middle"
              fill="url(#titleGrad)"
              fontSize="56"
              fontWeight="900"
              fontFamily="Impact, sans-serif"
              letterSpacing="3"
              fontStyle="italic"
            >
              MOTOBOY
            </text>
            {/* Tag Word "EXPRESS 3D" */}
            <text
              x="50%"
              y="104"
              textAnchor="middle"
              fill="url(#subGrad)"
              fontSize="26"
              fontWeight="900"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              letterSpacing="8"
            >
              EXPRESS 3D
            </text>
          </svg>
        </div>

        <p className="text-xs sm:text-sm md:text-base text-slate-300 font-semibold mb-4 sm:mb-5 max-w-lg leading-relaxed px-2">
          Suba de patente no <strong className="text-amber-400">Modo Carreira</strong> disputando entregas contra o Rival Falcão, ou domine o grau nos arcos neon e explore os 6 cenários no <strong className="text-cyan-400">Modo Treinamento</strong>!
        </p>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-5 sm:mb-6">
          <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" /> 6 Cenários 3D
          </span>
          <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Céu, Clima & Turnos
          </span>
          <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Carreira & Treino
          </span>
          <span className="bg-slate-900/90 border border-slate-800 text-slate-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Oficina & Tuning
          </span>
        </div>

        {/* Mode Selection & Shop Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full max-w-xl px-2">
          <button
            onClick={() => onStartGame('career')}
            className="w-full sm:flex-1 py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_12px_30px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 shrink-0" />
            <span>MODO CARREIRA</span>
          </button>

          <button
            onClick={() => onStartGame('training')}
            className="w-full sm:flex-1 py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 shrink-0" />
            <span>MODO TREINAMENTO</span>
          </button>

          <button
            onClick={onOpenShop}
            className="w-full sm:w-auto py-3.5 sm:py-4 px-5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs sm:text-sm shadow transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            Oficina & Moto
          </button>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="text-center pt-3 border-t border-slate-800/80 shrink-0">
        <div className="text-[11px] md:text-sm font-semibold text-slate-400 tracking-wide">
          <span className="md:hidden">
            <span className="text-slate-200">Touch / Joystick</span> Direção ·{' '}
            <span className="text-emerald-400">Auto-Gás</span> Cruzeiro ·{' '}
            <span className="text-amber-400">Grau & Nitro</span> Manobras
          </span>
          <span className="hidden md:inline">
            <span className="text-slate-200">WASD / Setas</span> Pilotar ·{' '}
            <span className="text-slate-200">Espaço</span> Dar Grau ·{' '}
            <span className="text-slate-200">N</span> Nitro Boost ·{' '}
            <span className="text-slate-200">H</span> Buzina ·{' '}
            <span className="text-slate-200">Esc</span> Pausar
          </span>
        </div>
      </div>
    </div>
  );
};
