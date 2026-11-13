export type WeatherType = 'sunny' | 'rain' | 'fog' | 'sunset' | 'storm' | 'severe_storm';

export type TimeShift = 'manha' | 'tarde' | 'entardecer' | 'noite';

export type SkyTheme = 'auto' | 'tropical' | 'golden_horizon' | 'cyber_neon' | 'starlight';

export type GameMode = 'career' | 'training';

export type CameraMode = 'dynamic' | 'close' | 'first_person' | 'helicopter';

export interface WeatherConfig {
  id: WeatherType;
  name: string;
  description: string;
  icon: string;
  gripMultiplier: number; // Low in rain/storm
  fogDensity: number;
  skyColor: number;
  groundWetness: number;
  rainIntensity: number; // 0 to 1
  windForce: number;
}

export type DistrictId =
  | 'centro'
  | 'jardins'
  | 'favela'
  | 'orla'
  | 'industrial'
  | 'autodromo'
  | 'nova_cidade';

export type RestaurantCategory =
  | 'hamburgueria'
  | 'pizzaria'
  | 'restaurante'
  | 'sushi'
  | 'lanchonete'
  | 'acai'
  | 'marisqueira';

export interface District {
  id: DistrictId;
  name: string;
  tagline: string;
  deliveriesNeeded: number;
  unlocked: boolean;
  baseFareMultiplier: number;
  description: string;
  themeColor: string;
  spawnPos: { x: number; z: number; heading: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface DeliveryOrder {
  id: string;
  itemTitle: string;
  icon: string;
  restaurantName: string;
  restaurantCategory: string;
  restaurantPos: { x: number; z: number };
  customerName: string;
  customerPos: { x: number; z: number };
  districtId: DistrictId;
  rewardCoins: number;
  tipPotential: number;
  timeLimitSeconds: number;
  timeRemainingSeconds: number;
  state: 'to_pickup' | 'to_deliver' | 'completed' | 'failed';
  isFragile?: boolean;
  isUrgent?: boolean;
}

export interface BikeUpgrades {
  engineLevel: number; // 1 to 5 (Speed)
  accelerationLevel: number; // 1 to 5 (Pickup)
  brakesLevel: number; // 1 to 5 (Braking dist)
  tiresLevel: number; // 1 to 5 (Wet grip)
  trunkLevel: number; // 1 to 3 (Bonus pay)
  nitroUnlocked: boolean;
}

export interface BikeCustomization {
  paintColor: string;
  trunkSkin: 'padrao' | 'ifood' | 'amarelo' | 'uber' | 'graffiti';
  helmetColor: string;
  neonColor: 'none' | 'cyan' | 'pink' | 'lime' | 'gold' | 'purple';
  exhaustType: 'stock' | 'sport' | 'coyote' | 'direto';
}

export interface PlayerStats {
  coins: number;
  completedDeliveries: number;
  rivalDeliveries?: number;
  trainingRingsPassed?: number;
  rating: number; // 1.0 to 5.0
  totalGrauPoints: number;
  distanceTraveledKm: number;
}
