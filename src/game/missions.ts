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
  },
  {
    id: 'neutralize_bandit',
    title: 'Segurança nas Ruas',
    description: 'Neutralize um ladrão de moto no combate corporal',
    icon: '🛡️',
    target: 1,
    progress: 0,
    rewardCoins: 45,
    completed: false,
    claimed: false,
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
  },
];

const STORAGE_KEY_MISSIONS = 'motoboy_daily_missions_v1';
const STORAGE_KEY_DATE = 'motoboy_missions_date_v1';

export function loadDailyMissions(): DailyMission[] {
  try {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
    const savedMissions = localStorage.getItem(STORAGE_KEY_MISSIONS);

    if (savedDate !== today || !savedMissions) {
      // Reset for new day
      localStorage.setItem(STORAGE_KEY_DATE, today);
      localStorage.setItem(STORAGE_KEY_MISSIONS, JSON.stringify(INITIAL_DAILY_MISSIONS));
      return INITIAL_DAILY_MISSIONS;
    }

    return JSON.parse(savedMissions);
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
