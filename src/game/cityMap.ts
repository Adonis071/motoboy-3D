import { District, DistrictId, DeliveryOrder, RestaurantCategory } from '../types/game';

export const DISTRICTS: Record<DistrictId, District> = {
  centro: {
    id: 'centro',
    name: 'Centro Comercial',
    tagline: 'Avenidas movimentadas & Restaurantes',
    deliveriesNeeded: 0,
    unlocked: true,
    baseFareMultiplier: 1.0,
    description:
      'O coração gastronômico da cidade. Repleto de hamburguerias, pizzarias e restaurantes executivos.',
    themeColor: '#3b82f6',
    spawnPos: { x: -67.2, z: -28, heading: Math.PI },
    bounds: { minX: -120, maxX: 0, minZ: -120, maxZ: 0 },
  },
  jardins: {
    id: 'jardins',
    name: 'Bairro dos Jardins',
    tagline: 'Ruas Arborizadas & Gastronomia Gourmet',
    deliveriesNeeded: 3,
    unlocked: false,
    baseFareMultiplier: 1.35,
    description:
      'Área nobre residencial com bistrôs, sushi bars e pizzarias napolitanas. Clientes dão ótimas gorjetas!',
    themeColor: '#10b981',
    spawnPos: { x: 47.2, z: -55, heading: 0 },
    bounds: { minX: 0, maxX: 130, minZ: -120, maxZ: 0 },
  },
  favela: {
    id: 'favela',
    name: 'Morro do Sol',
    tagline: 'Subidas Inclinadas & Lanchonetes da Quebrada',
    deliveriesNeeded: 6,
    unlocked: false,
    baseFareMultiplier: 1.65,
    description:
      'Ladeiras com hamburguerias de brasa, dogão prensado e points de açaí. Lugar perfeito para mandar grau!',
    themeColor: '#f59e0b',
    spawnPos: { x: -67.2, z: 32, heading: 0 },
    bounds: { minX: -120, maxX: 0, minZ: 0, maxZ: 120 },
  },
  orla: {
    id: 'orla',
    name: 'Orla da Praia',
    tagline: 'Avenida Beira-Mar & Restaurantes Litorâneos',
    deliveriesNeeded: 10,
    unlocked: false,
    baseFareMultiplier: 2.0,
    description:
      'Avenida costeira com restaurantes de frutos do mar, hamburguerias surf e hotéis de luxo.',
    themeColor: '#06b6d4',
    spawnPos: { x: 52.8, z: 32, heading: 0 },
    bounds: { minX: 0, maxX: 135, minZ: 0, maxZ: 120 },
  },
  industrial: {
    id: 'industrial',
    name: 'Polo Industrial & Porto',
    tagline: 'Galpões Logísticos, Contêineres & Usinas',
    deliveriesNeeded: 14,
    unlocked: false,
    baseFareMultiplier: 2.35,
    description:
      'Zona portuária e industrial no extremo norte com galpões gigantes, pilhas de contêineres e churrascarias pesadas.',
    themeColor: '#f97316',
    spawnPos: { x: -67.2, z: -135, heading: Math.PI },
    bounds: { minX: -135, maxX: 135, minZ: -195, maxZ: -120 },
  },
  autodromo: {
    id: 'autodromo',
    name: 'Estádio de Futebol & Arena',
    tagline: 'Estádio Maracanã 3D, Gramado Interativo & Parque Neon',
    deliveriesNeeded: 0,
    unlocked: true,
    baseFareMultiplier: 2.85,
    description:
      'Complexo do grande Estádio de Futebol 3D com túnel aberto para o gramado, bola interativa para fazer gol, refletores, placar eletrônico e parque de diversões!',
    themeColor: '#22c55e',
    spawnPos: { x: -40, z: 145, heading: 0 },
    bounds: { minX: -135, maxX: 135, minZ: 120, maxZ: 195 },
  },
  nova_cidade: {
    id: 'nova_cidade',
    name: 'Nova Metrópole (Ponte Estaiada)',
    tagline: 'Outra Cidade além da Ponte • Cassino, Torre Panorâmica & Arranha-Céus',
    deliveriesNeeded: 0,
    unlocked: true,
    baseFareMultiplier: 3.15,
    description:
      'Atravesse a monumental Ponte Estaiada sobre o oceano (Av. Z = -15 Leste) para chegar à Nova Metrópole: arranha-céus futuristas, Grand Cassino e clientes VIP!',
    themeColor: '#00f3ff',
    spawnPos: { x: 82, z: -12.2, heading: Math.PI / 2 },
    bounds: { minX: 245, maxX: 460, minZ: -195, maxZ: 195 },
  },
};

export interface MenuItem {
  item: string;
  icon: string;
  fragile: boolean;
  urgent: boolean;
  basePrice: number;
}

export interface DeliveryPoint {
  id: string;
  name: string;
  shortSign: string;
  categoryLabel: string;
  category?: RestaurantCategory;
  type: 'restaurant' | 'customer';
  districtId: DistrictId;
  x: number;
  z: number;
  buildingOffset?: { dx: number; dz: number; rotationY: number };
  primaryColor: number;
  accentColor: number;
  icon: string;
  menu?: MenuItem[];
}

export const DELIVERY_POINTS: DeliveryPoint[] = [
  // ================= CENTRO =================
  {
    id: 'rest_burger_centro',
    name: 'Hamburgueria Brutus Smash',
    shortSign: 'BRUTUS BURGER',
    categoryLabel: 'Hamburgueria Artesanal',
    category: 'hamburgueria',
    type: 'restaurant',
    districtId: 'centro',
    x: -75.5,
    z: -42,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0xd97706,
    accentColor: 0xef4444,
    icon: '🍔',
    menu: [
      { item: 'Combo Duplo Smash Bacon + Fritas', icon: '🍔', fragile: false, urgent: true, basePrice: 42 },
      { item: 'Monster Cheddar Melt + Milkshake', icon: '🍔', fragile: true, urgent: false, basePrice: 48 },
      { item: 'Box 4 Burgers Artesanais na Brasa', icon: '🍔', fragile: false, urgent: true, basePrice: 55 },
    ],
  },
  {
    id: 'rest_pizzaria_centro',
    name: 'Pizzaria Forno D’Ouro',
    shortSign: 'PIZZARIA FORNO',
    categoryLabel: 'Pizzaria Tradicional',
    category: 'pizzaria',
    type: 'restaurant',
    districtId: 'centro',
    x: -75.5,
    z: -95,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0xb91c1c,
    accentColor: 0x16a34a,
    icon: '🍕',
    menu: [
      { item: 'Pizza Gigante Calabresa c/ Catupiry', icon: '🍕', fragile: true, urgent: true, basePrice: 50 },
      { item: '2x Pizzas Família Quatro Queijos', icon: '🍕', fragile: true, urgent: false, basePrice: 58 },
      { item: 'Pizza Margherita Forno a Lenha', icon: '🍕', fragile: true, urgent: false, basePrice: 46 },
    ],
  },
  {
    id: 'rest_churrasco_centro',
    name: 'Restaurante & Churrascaria Boi Nobre',
    shortSign: 'RESTAURANTE BOI',
    categoryLabel: 'Restaurante & Grill',
    category: 'restaurante',
    type: 'restaurant',
    districtId: 'centro',
    x: -40,
    z: -75.5,
    buildingOffset: { dx: 0, dz: -7.5, rotationY: 0 },
    primaryColor: 0x7c2d12,
    accentColor: 0xf59e0b,
    icon: '🥩',
    menu: [
      { item: 'Marmitex Executiva Picanha na Brasa', icon: '🥩', fragile: false, urgent: true, basePrice: 52 },
      { item: 'Feijoada Completa p/ 3 Pessoas', icon: '🍲', fragile: true, urgent: false, basePrice: 60 },
      { item: 'Filé à Parmegiana c/ Arroz e Fritas', icon: '🍝', fragile: true, urgent: true, basePrice: 49 },
    ],
  },
  {
    id: 'cust_advogados',
    name: 'Edifício Empresarial Mirante',
    shortSign: 'TORRE MIRANTE',
    categoryLabel: 'Cliente Comercial',
    type: 'customer',
    districtId: 'centro',
    x: -15.5,
    z: -42,
    primaryColor: 0x3b82f6,
    accentColor: 0x60a5fa,
    icon: '🏢',
  },
  {
    id: 'cust_loft_centro',
    name: 'Residencial Metropolitano Apt 804',
    shortSign: 'RES. METRÓPOLE',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'centro',
    x: -40,
    z: -20.5,
    primaryColor: 0x6366f1,
    accentColor: 0x818cf8,
    icon: '🏙️',
  },

  // ================= JARDINS =================
  {
    id: 'rest_sushi_jardins',
    name: 'Restaurante Haiku Sushi Bar',
    shortSign: 'HAIKU SUSHI',
    categoryLabel: 'Restaurante Japonês',
    category: 'sushi',
    type: 'restaurant',
    districtId: 'jardins',
    x: 20,
    z: -75.5,
    buildingOffset: { dx: 0, dz: -7.5, rotationY: 0 },
    primaryColor: 0x1e293b,
    accentColor: 0xf43f5e,
    icon: '🍣',
    menu: [
      { item: 'Barca Imperial 60 Peças de Salmão', icon: '🍣', fragile: true, urgent: false, basePrice: 68 },
      { item: 'Combo Duplo Temaki Hot Filadélfia', icon: '🍱', fragile: false, urgent: true, basePrice: 54 },
      { item: 'Yakisoba Especial + Guioza Dourado', icon: '🍜', fragile: true, urgent: true, basePrice: 58 },
    ],
  },
  {
    id: 'rest_pizzaria_jardins',
    name: 'Pizzaria & Trattoria Bella Napoli',
    shortSign: 'BELLA NAPOLI',
    categoryLabel: 'Pizzaria & Massas',
    category: 'pizzaria',
    type: 'restaurant',
    districtId: 'jardins',
    x: 44.5,
    z: -42,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x991b1b,
    accentColor: 0x22c55e,
    icon: '🍕',
    menu: [
      { item: 'Pizza Napolitana Burrata & Parma', icon: '🍕', fragile: true, urgent: true, basePrice: 64 },
      { item: 'Lasanha Artesanal Bolonhesa Gratinada', icon: '🍝', fragile: true, urgent: false, basePrice: 56 },
    ],
  },
  {
    id: 'cust_mansao_1',
    name: 'Condomínio Bougainville Mansão 12',
    shortSign: 'BOUGAINVILLE',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'jardins',
    x: 55.5,
    z: -95,
    primaryColor: 0x10b981,
    accentColor: 0x34d399,
    icon: '🏡',
  },
  {
    id: 'cust_casa_jardim',
    name: 'Solar das Orquídeas Nº 412',
    shortSign: 'SOLAR ORQUÍDEAS',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'jardins',
    x: 20,
    z: -20.5,
    primaryColor: 0x14b8a6,
    accentColor: 0x2dd4bf,
    icon: '🏠',
  },
  {
    id: 'cust_parque_diversoes',
    name: 'Parque de Diversões PlayCenter 3D (Entrada VIP)',
    shortSign: 'PLAYCENTER 3D',
    categoryLabel: 'Parque de Diversões',
    type: 'customer',
    districtId: 'centro',
    x: 16,
    z: 32,
    primaryColor: 0xe11d48,
    accentColor: 0xfacc15,
    icon: '🎡',
  },

  // ================= MORRO DO SOL (FAVELA) =================
  {
    id: 'rest_dogao_morro',
    name: 'Hamburgueria & Dogão do Baiano',
    shortSign: 'DOGÃO & BURGER',
    categoryLabel: 'Hamburgueria & Lanches',
    category: 'lanchonete',
    type: 'restaurant',
    districtId: 'favela',
    x: -75.5,
    z: 18,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0xea580c,
    accentColor: 0xfacc15,
    icon: '🌭',
    menu: [
      { item: '2x X-Tudo Monstro + Dogão Prensado', icon: '🍔', fragile: false, urgent: true, basePrice: 44 },
      { item: 'Combo Família 4 Hot-Dogs Especiais', icon: '🌭', fragile: false, urgent: false, basePrice: 40 },
      { item: 'Porção Batata Suprema c/ Calabresa', icon: '🍟', fragile: false, urgent: true, basePrice: 38 },
    ],
  },
  {
    id: 'rest_acai_morro',
    name: 'Point do Açaí & Burger da Laje',
    shortSign: 'POINT DO AÇAÍ',
    categoryLabel: 'Açaí & Lanchonete',
    category: 'acai',
    type: 'restaurant',
    districtId: 'favela',
    x: -75.5,
    z: 70,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x7e22ce,
    accentColor: 0xf472b6,
    icon: '🍧',
    menu: [
      { item: 'Roleta de Açaí 1 Litro c/ Nutella & Morango', icon: '🍧', fragile: true, urgent: true, basePrice: 46 },
      { item: '2x Copões Açaí 700ml + Smash Burger', icon: '🍧', fragile: false, urgent: true, basePrice: 42 },
    ],
  },
  {
    id: 'cust_laje_mirante',
    name: 'Mirante da Laje (Rua Principal)',
    shortSign: 'MIRANTE DA LAJE',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'favela',
    x: -40,
    z: 100.5,
    primaryColor: 0xf59e0b,
    accentColor: 0xfbbf24,
    icon: '🏘️',
  },
  {
    id: 'cust_beco_alto',
    name: 'Vila Esperança Casa Amarela',
    shortSign: 'VILA ESPERANÇA',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'favela',
    x: -15.5,
    z: 70,
    primaryColor: 0xd97706,
    accentColor: 0xfcd34d,
    icon: '🏠',
  },

  // ================= ORLA DA PRAIA =================
  {
    id: 'rest_burger_orla',
    name: 'Surf Burger & Pizzas Beira-Mar',
    shortSign: 'SURF BURGER',
    categoryLabel: 'Hamburgueria & Pizzaria',
    category: 'hamburgueria',
    type: 'restaurant',
    districtId: 'orla',
    x: 44.5,
    z: 18,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x0284c7,
    accentColor: 0xf97316,
    icon: '🍔',
    menu: [
      { item: 'Combo Surf Burger Australiano + Onion Rings', icon: '🍔', fragile: false, urgent: true, basePrice: 54 },
      { item: 'Pizza Camarão Especial Beira-Mar', icon: '🍕', fragile: true, urgent: true, basePrice: 65 },
    ],
  },
  {
    id: 'rest_mariscos_orla',
    name: 'Restaurante Frutos do Atlântico',
    shortSign: 'REST. ATLÂNTICO',
    categoryLabel: 'Restaurante Frutos do Mar',
    category: 'marisqueira',
    type: 'restaurant',
    districtId: 'orla',
    x: 44.5,
    z: 70,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x0f766e,
    accentColor: 0x38bdf8,
    icon: '🍤',
    menu: [
      { item: 'Moqueca Baiana de Camarão & Lagosta', icon: '🍤', fragile: true, urgent: false, basePrice: 72 },
      { item: 'Combinado Gurjão de Peixe + Água de Coco', icon: '🥥', fragile: false, urgent: true, basePrice: 58 },
    ],
  },
  {
    id: 'cust_hotel_resort',
    name: 'Grand Resort Atlântico Palace',
    shortSign: 'RESORT PALACE',
    categoryLabel: 'Cliente VIP Hotel',
    type: 'customer',
    districtId: 'orla',
    x: 20,
    z: 39.5,
    primaryColor: 0x06b6d4,
    accentColor: 0x67e8f9,
    icon: '🏨',
  },
  {
    id: 'cust_flat_praia',
    name: 'Flat Vista Panorâmica Cobertura',
    shortSign: 'FLAT PRAIA',
    categoryLabel: 'Cliente Residencial',
    type: 'customer',
    districtId: 'orla',
    x: 20,
    z: 100.5,
    primaryColor: 0x0ea5e9,
    accentColor: 0x7dd3fc,
    icon: '🏖️',
  },

  // ================= POLO INDUSTRIAL & PORTO (NOVO CENÁRIO 5) =================
  {
    id: 'rest_usina_burger',
    name: 'Hamburgueria Usina Smash & Grill',
    shortSign: 'USINA BURGER',
    categoryLabel: 'Hamburgueria Industrial',
    category: 'hamburgueria',
    type: 'restaurant',
    districtId: 'industrial',
    x: -75.5,
    z: -122,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0xea580c,
    accentColor: 0xfacc15,
    icon: '🍔',
    menu: [
      { item: 'Combo Operário Triplo Bacon + Batata Rústica', icon: '🍔', fragile: false, urgent: true, basePrice: 62 },
      { item: 'Costela Defumada no Bafo + Pão de Alho', icon: '🥩', fragile: false, urgent: true, basePrice: 68 },
    ],
  },
  {
    id: 'rest_porto_churrasco',
    name: 'Churrascaria & Marmitaria do Porto',
    shortSign: 'GRILL DO PORTO',
    categoryLabel: 'Restaurante & Churrascaria',
    category: 'restaurante',
    type: 'restaurant',
    districtId: 'industrial',
    x: -15.5,
    z: -122,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x9a3412,
    accentColor: 0x38bdf8,
    icon: '🥩',
    menu: [
      { item: 'Kit 4 Marmitex Picanha p/ Equipe do Turno', icon: '🥩', fragile: false, urgent: true, basePrice: 74 },
      { item: 'Parrilla Portuária Completa + Refrigerante 2L', icon: '🍖', fragile: true, urgent: false, basePrice: 70 },
    ],
  },
  {
    id: 'cust_galpao_logistica',
    name: 'Terminal Portuário de Contêineres Doca 4',
    shortSign: 'DOCA PORTUÁRIA 4',
    categoryLabel: 'Cliente Industrial',
    type: 'customer',
    districtId: 'industrial',
    x: 44.5,
    z: -122,
    primaryColor: 0xf97316,
    accentColor: 0xfdba74,
    icon: '🚢',
  },

  // ================= ARENA & AUTÓDROMO NEON (NOVO CENÁRIO 6) =================
  {
    id: 'rest_pitstop_burger',
    name: 'Pit-Stop Burger & Pizzas do Autódromo',
    shortSign: 'PIT-STOP BURGER',
    categoryLabel: 'Hamburgueria & Paddock',
    category: 'hamburgueria',
    type: 'restaurant',
    districtId: 'autodromo',
    x: -15.5,
    z: 122,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x7e22ce,
    accentColor: 0x22d3ee,
    icon: '🍔',
    menu: [
      { item: 'Combo V8 Turbo Smash + Onion Rings', icon: '🍔', fragile: false, urgent: true, basePrice: 68 },
      { item: 'Pizza Gigante Campeões da Pista', icon: '🍕', fragile: true, urgent: true, basePrice: 75 },
    ],
  },
  {
    id: 'cust_arena_vip',
    name: 'Estádio de Futebol Maracanã 3D (Portão Principal)',
    shortSign: 'ESTÁDIO FUTEBOL',
    categoryLabel: 'Cliente VIP Estádio',
    type: 'customer',
    districtId: 'autodromo',
    x: -40,
    z: 151.5,
    primaryColor: 0x16a34a,
    accentColor: 0xfacc15,
    icon: '⚽',
  },

  // ================= NOVA METRÓPOLE (OUTRA CIDADE APÓS A PONTE ESTAIADA) =================
  {
    id: 'rest_skyline_burger_nova',
    name: 'Skyline Burger & Steaks Nova Metrópole',
    shortSign: 'SKYLINE BURGER',
    categoryLabel: 'Hamburgueria Gourmet VIP',
    category: 'hamburgueria',
    type: 'restaurant',
    districtId: 'nova_cidade',
    x: 284.5,
    z: -42,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x0284c7,
    accentColor: 0x00f3ff,
    icon: '🍔',
    menu: [
      { item: 'Combo Wagyu Gold Burger + Truffle Fries', icon: '🍔', fragile: false, urgent: true, basePrice: 78 },
      { item: 'Double Ribeye Steak Box + Milkshake Belga', icon: '🥩', fragile: true, urgent: true, basePrice: 85 },
    ],
  },
  {
    id: 'rest_cassino_sushi_nova',
    name: 'Imperial Sushi & Lounge do Grand Cassino',
    shortSign: 'IMPERIAL SUSHI',
    categoryLabel: 'Restaurante Internacional',
    category: 'sushi',
    type: 'restaurant',
    districtId: 'nova_cidade',
    x: 344.5,
    z: 18,
    buildingOffset: { dx: -7.5, dz: 0, rotationY: Math.PI / 2 },
    primaryColor: 0x881337,
    accentColor: 0xfacc15,
    icon: '🍣',
    menu: [
      { item: 'Barca Diamante 80 Peças + Lagosta Grelhada', icon: '🍣', fragile: true, urgent: true, basePrice: 92 },
      { item: 'Combinado Imperial King Crab & Salmão', icon: '🍱', fragile: true, urgent: false, basePrice: 84 },
    ],
  },
  {
    id: 'cust_torre_cristal_nova',
    name: 'Cobertura Torre Panorâmica de Cristal',
    shortSign: 'TORRE DE CRISTAL',
    categoryLabel: 'Cliente Penthouse VIP',
    type: 'customer',
    districtId: 'nova_cidade',
    x: 284.5,
    z: 22,
    primaryColor: 0x06b6d4,
    accentColor: 0x22d3ee,
    icon: '🗼',
  },
  {
    id: 'cust_grand_cassino_nova',
    name: 'Grand Cassino & Resort Atlântico (Entrada VIP)',
    shortSign: 'GRAND CASSINO',
    categoryLabel: 'Cliente Cassino VIP',
    type: 'customer',
    districtId: 'nova_cidade',
    x: 344.5,
    z: -42,
    primaryColor: 0xf59e0b,
    accentColor: 0xfde047,
    icon: '🎰',
  },
  {
    id: 'cust_mansao_ilha_nova',
    name: 'Condomínio Ilha de Cristal Mansão 01',
    shortSign: 'ILHA DE CRISTAL',
    categoryLabel: 'Cliente Residencial Luxo',
    type: 'customer',
    districtId: 'nova_cidade',
    x: 404.5,
    z: -42,
    primaryColor: 0x10b981,
    accentColor: 0x34d399,
    icon: '🏝️',
  },
];

export function generateDeliveryOrder(
  unlockedDistricts: DistrictId[],
  trunkBonusMultiplier: number = 1.0
): DeliveryOrder {
  const districtId = unlockedDistricts[Math.floor(Math.random() * unlockedDistricts.length)];
  const districtInfo = DISTRICTS[districtId];

  const districtRestaurants = DELIVERY_POINTS.filter(
    p => p.type === 'restaurant' && p.districtId === districtId
  );
  const districtCustomers = DELIVERY_POINTS.filter(
    p => p.type === 'customer' && unlockedDistricts.includes(p.districtId)
  );

  const rest =
    districtRestaurants.length > 0
      ? districtRestaurants[Math.floor(Math.random() * districtRestaurants.length)]
      : DELIVERY_POINTS[0];

  const custPool =
    districtCustomers.length > 0
      ? districtCustomers
      : DELIVERY_POINTS.filter(p => p.type === 'customer');
  const cust = custPool[Math.floor(Math.random() * custPool.length)];

  const menu =
    rest.menu && rest.menu.length > 0
      ? rest.menu
      : [
          {
            item: 'Combo Burger Artesanal + Fritas',
            icon: '🍔',
            fragile: false,
            urgent: true,
            basePrice: 42,
          },
        ];

  const catalogItem = menu[Math.floor(Math.random() * menu.length)];

  // Determine order special tags: Comida Quente (tempo limitado), Frágil (sem batidas), Urgente (bônus alto)
  const isFragile = catalogItem.fragile;
  const isUrgent = catalogItem.urgent;
  const isHot =
    rest.category === 'hamburgueria' ||
    rest.category === 'pizzaria' ||
    rest.category === 'restaurante' ||
    (!isFragile && !isUrgent);

  const distMeters = Math.hypot(rest.x - cust.x, rest.z - cust.z);
  const rawTimeLimit = Math.max(60, Math.round(distMeters * 0.9 + 45));
  const timeLimit = isHot ? Math.max(52, Math.round(rawTimeLimit * 0.85)) : rawTimeLimit;

  const urgentBonusMult = isUrgent ? 1.25 : 1.0;
  const baseReward = Math.round(
    catalogItem.basePrice *
      districtInfo.baseFareMultiplier *
      trunkBonusMultiplier *
      urgentBonusMult
  );
  const tipPotential = Math.round(baseReward * (isUrgent ? 0.55 : isFragile ? 0.5 : 0.45));

  return {
    id: 'ord_' + Math.random().toString(36).substring(2, 8),
    itemTitle: catalogItem.item,
    icon: catalogItem.icon,
    restaurantName: rest.name,
    restaurantCategory: rest.categoryLabel,
    restaurantPos: { x: rest.x, z: rest.z },
    customerName: cust.name,
    customerPos: { x: cust.x, z: cust.z },
    districtId,
    rewardCoins: baseReward,
    tipPotential,
    timeLimitSeconds: timeLimit,
    timeRemainingSeconds: timeLimit,
    state: 'to_pickup',
    isFragile,
    isUrgent,
    isHot,
    collisionCount: 0,
  };
}

export function generateOrderQueue(
  unlockedDistricts: DistrictId[],
  trunkBonusMultiplier: number = 1.0,
  count: number = 3
): DeliveryOrder[] {
  const list: DeliveryOrder[] = [];
  for (let i = 0; i < count; i++) {
    list.push(generateDeliveryOrder(unlockedDistricts, trunkBonusMultiplier));
  }
  return list;
}

