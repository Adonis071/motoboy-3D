export interface DailyMission {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
  period?: 'daily' | 'weekly';
}

export const INITIAL_DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'grau_10s',
    title: 'Rei do Grau',
    description: 'Empine a moto acumulando 10 segundos no Grau',
    icon: '🔥',
    target: 10,
    progress: 0,
    rewardCoins: 50,
    completed: false,
    claimed: false,
    period: 'daily',
  },
  {
    id: 'fast_delivery',
    title: 'Entregador Relâmpago',
    description: 'Entregue um pedido em menos de 60 segundos',
    icon: '⚡',
    target: 1,
    progress: 0,
    rewardCoins: 65,
    completed: false,
    claimed: false,
    period: 'daily',
  },
  {
    id: 'safe_deliveries',
    title: 'Direção Segura 5 Estrelas',
    description: 'Conclua 2 entregas sem bater em carros ou pedestres',
    icon: '🛡️',
    target: 2,
    progress: 0,
    rewardCoins: 75,
    completed: false,
    claimed: false,
    period: 'daily',
  },
  {
    id: 'night_deliveries',
    title: 'Madrugada Ativa',
    description: 'Conclua 3 entregas durante a noite ou entardecer',
    icon: '🌙',
    target: 3,
    progress: 0,
    rewardCoins: 55,
    completed: false,
    claimed: false,
    period: 'daily',
  },
  {
    id: 'neutralize_bandit',
    title: 'Segurança nas Ruas',
    description: 'Neutralize um ladrão de moto no combate corporal',
    icon: '🥊',
    target: 1,
    progress: 0,
    rewardCoins: 45,
    completed: false,
    claimed: false,
    period: 'daily',
  },
  {
    id: 'weekly_legend',
    title: 'Bônus Lenda das Entregas',
    description: 'Meta Semanal: Conclua 10 entregas na semana pela cidade',
    icon: '👑',
    target: 10,
    progress: 0,
    rewardCoins: 250,
    completed: false,
    claimed: false,
    period: 'weekly',
  },
  {
    id: 'weekly_hot_fragile',
    title: 'Especialista VIP & Frágeis',
    description: 'Meta Semanal: Entregue 5 pedidos Quentes ou Frágeis no prazo',
    icon: '📦',
    target: 5,
    progress: 0,
    rewardCoins: 180,
    completed: false,
    claimed: false,
    period: 'weekly',
  },
];

const STORAGE_KEY_MISSIONS = 'motoboy_daily_missions_v2';
const STORAGE_KEY_DATE = 'motoboy_missions_date_v2';

export function loadDailyMissions(): DailyMission[] {
  try {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
    const savedMissions = localStorage.getItem(STORAGE_KEY_MISSIONS);

    if (!savedMissions) {
      localStorage.setItem(STORAGE_KEY_DATE, today);
      localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(INITIAL_DAILY_MISSIONS));
      return INITIAL_DAILY_MISSIONS;
    }

    const parsed: DailyMission[] = JSON.parse(savedMissions);
    if (savedDate !== today) {
      // Reset daily missions, preserve weekly missions progress
      const updated = INITIAL_DAILY_MISSIONS.map(initM => {
        const existing = parsed.find(p => p.id === initM.id);
        if (initM.period === 'weekly' && existing) {
          return existing;
        }
        return initM;
      });
      localStorage.setItem(STORAGE_KEY_DATE, today);
      localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(updated));
      return updated;
    }

    return parsed;
  } catch {
    return INITIAL_DAILY_MISSIONS;
  }
}

export function saveDailyMissions(missions: DailyMission[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(missions));
    localStorage.setItem(STORAGE_KEY_DATE, new Date().toDateString());
  } catch {
    // Ignore
  }
}

