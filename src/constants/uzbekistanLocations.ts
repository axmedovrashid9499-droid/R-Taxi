import { RegionInfo, TariffInfo, TariffRate, TariffType } from '../types/taxi';

export const UZBEKISTAN_CENTER: [number, number] = [41.311081, 69.240562]; // Tashkent default
export const UZBEKISTAN_FULL_VIEW: [number, number] = [41.3775, 64.5853]; // Geographical center of Uzbekistan

export const DEFAULT_TARIFF_RATES: Record<TariffType, TariffRate> = {
  start: { minPrice: 5000, perKm: 1500 },
  comfort: { minPrice: 7000, perKm: 2000 },
  business: { minPrice: 10000, perKm: 3000 },
};

export const UZBEKISTAN_REGIONS: RegionInfo[] = [
  {
    id: 'tashkent_city',
    name: 'Toshkent shahri',
    center: [41.311081, 69.240562],
    zoom: 13,
    popularDistricts: ['Yunusobod', 'Chilonzor', 'Mirzo Ulugʻbek', 'Mirobod', 'Yakkasaroy', 'Shayxontohur', 'Olmazor', 'Uchtepa', 'Sergeli', 'Yangi Hayot'],
  },
  {
    id: 'tashkent_region',
    name: 'Toshkent viloyati',
    center: [41.2825, 69.4167],
    zoom: 10,
    popularDistricts: ['Chirchiq', 'Olmaliq', 'Angren', 'Bekobod', 'Boʻstonliq (Chorvoq)', 'Zangiota', 'Qibray', 'Parkent', 'Yangiyoʻl'],
  },
  {
    id: 'samarkand',
    name: 'Samarqand viloyati',
    center: [39.6542, 66.9597],
    zoom: 12,
    popularDistricts: ['Samarqand shahri', 'Pastdargʻom', 'Urgut', 'Kattaqoʻrgʻon', 'Toyloq', 'Bulungʻur', 'Payariq', 'Ishtixon'],
  },
  {
    id: 'bukhara',
    name: 'Buxoro viloyati',
    center: [39.7747, 64.4286],
    zoom: 12,
    popularDistricts: ['Buxoro shahri', 'Gʻijduvon', 'Kogon', 'Vobkent', 'Jondor', 'Shofirkon', 'Romitan', 'Olot'],
  },
  {
    id: 'fergana',
    name: 'Fargʻona viloyati',
    center: [40.3842, 71.7843],
    zoom: 12,
    popularDistricts: ['Fargʻona shahri', 'Qoʻqon', 'Margʻilon', 'Quva', 'Oltiariq', 'Rishton', 'Beshariq', 'Uchkoʻprik'],
  },
  {
    id: 'andijan',
    name: 'Andijon viloyati',
    center: [40.7821, 72.3442],
    zoom: 12,
    popularDistricts: ['Andijon shahri', 'Asaka', 'Shahrixon', 'Xonobod', 'Qoʻrgʻontepa', 'Baliqchi', 'Paxtaobod', 'Marhamat'],
  },
  {
    id: 'namangan',
    name: 'Namangan viloyati',
    center: [40.9983, 71.6726],
    zoom: 12,
    popularDistricts: ['Namangan shahri', 'Chust', 'Pop', 'Kosonsoy', 'Toʻraqoʻrgʻon', 'Uychi', 'Yangiqoʻrgʻon', 'Uchqoʻrgʻon'],
  },
  {
    id: 'qashqadaryo',
    name: 'Qashqadaryo viloyati',
    center: [38.8606, 65.7891],
    zoom: 12,
    popularDistricts: ['Qarshi shahri', 'Shahrisabz', 'Kitob', 'Koson', 'Gʻuzor', 'Yakkabogʻ', 'Chiroqchi', 'Qamashi'],
  },
  {
    id: 'surxondaryo',
    name: 'Surxondaryo viloyati',
    center: [37.2286, 67.2783],
    zoom: 12,
    popularDistricts: ['Termiz shahri', 'Denov', 'Shoʻrchi', 'Boysun', 'Sherobod', 'Jarqoʻrgʻon', 'Sariosiyo', 'Qumqoʻrgʻon'],
  },
  {
    id: 'khorezm',
    name: 'Xorazm viloyati',
    center: [41.5561, 60.6311],
    zoom: 12,
    popularDistricts: ['Urganch shahri', 'Xiva shahri', 'Shovot', 'Gurlan', 'Xonqa', 'Bogʻot', 'Qoʻshkoʻpir', 'Hazorasp'],
  },
  {
    id: 'navoiy',
    name: 'Navoiy viloyati',
    center: [40.0844, 65.3792],
    zoom: 12,
    popularDistricts: ['Navoiy shahri', 'Zarafshon', 'Qiziltepa', 'Karmana', 'Xatirchi', 'Uchquduq', 'Nurota'],
  },
  {
    id: 'jizzakh',
    name: 'Jizzax viloyati',
    center: [40.1158, 67.8422],
    zoom: 12,
    popularDistricts: ['Jizzax shahri', 'Zomin', 'Gʻallaorol', 'Sharof Rashidov', 'Paxtakor', 'Doʻstlik', 'Zafarobod'],
  },
  {
    id: 'sirdaryo',
    name: 'Sirdaryo viloyati',
    center: [40.4897, 68.7844],
    zoom: 12,
    popularDistricts: ['Guliston shahri', 'Shirin', 'Yangiyer', 'Boyovut', 'Sardoba', 'Mirzaobod', 'Oqoltin'],
  },
  {
    id: 'karakalpakstan',
    name: 'Qoraqalpogʻiston Respublikasi',
    center: [42.4602, 59.6166],
    zoom: 11,
    popularDistricts: ['Nukus shahri', 'Xoʻjayli', 'Qoʻngʻirot', 'Beruniy', 'Toʻrtkoʻl', 'Moʻynoq', 'Chimboy', 'Amudaryo'],
  },
];

export const POPULAR_PLACES_UZ = [
  {
    title: 'Toshkent xalqaro aeroporti (Islom Karimov nomidagi)',
    subtitle: 'Sergeli tumani, Qumariq koʻchasi',
    coords: [41.2579, 69.2812] as [number, number],
  },
  {
    title: 'Shimoliy vokzal (Toshkent-Janubiy / Markaziy)',
    subtitle: 'Mirobod tumani, Turkiston koʻchasi',
    coords: [41.2926, 69.2882] as [number, number],
  },
  {
    title: 'Amir Temur xiyoboni',
    subtitle: 'Toshkent markazi, Yunusobod / Mirobod',
    coords: [41.3113, 69.2797] as [number, number],
  },
  {
    title: 'Chorsu bozori',
    subtitle: 'Shayxontohur tumani, Eski shahar',
    coords: [41.3275, 69.2356] as [number, number],
  },
  {
    title: 'Tashkent City Mall',
    subtitle: 'Shayxontohur tumani, Botir Zokirov koʻchasi',
    coords: [41.3155, 69.2519] as [number, number],
  },
  {
    title: 'Registon maydoni (Samarqand)',
    subtitle: 'Samarqand shahri, Registon koʻchasi',
    coords: [39.6548, 66.9757] as [number, number],
  },
  {
    title: 'Labi Hovuz ansambli (Buxoro)',
    subtitle: 'Buxoro shahri, B. Naqshband koʻchasi',
    coords: [39.7733, 64.4202] as [number, number],
  },
  {
    title: 'Ichan Qalʼa (Xiva)',
    subtitle: 'Xiva shahri, qadimiy qoʻrgʻon',
    coords: [41.3783, 60.3594] as [number, number],
  },
];

export const TARIFFS: TariffInfo[] = [
  {
    id: 'start',
    name: 'Start',
    tagline: 'Tejamkor va qulay',
    cars: 'Cobalt, Gentra, Nexia 3',
    etaMinutes: 2,
    iconName: 'car-compact',
  },
  {
    id: 'comfort',
    name: 'Komfort',
    tagline: 'Keng va konditsionerli',
    cars: 'Chevrolet Onix, Tracker 2',
    etaMinutes: 4,
    iconName: 'car-sedan',
  },
  {
    id: 'business',
    name: 'Biznes',
    tagline: 'Premium toifadagi avtomobillar',
    cars: 'Malibu 2, BYD Song Plus, Kia K5',
    etaMinutes: 6,
    iconName: 'car-luxury',
  },
];
