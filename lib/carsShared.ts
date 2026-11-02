// Автомобили бизнес-аккаунта «Авто» (без обращений к базе, можно в браузере).
export const BODIES = ["Седан", "Хэтчбек", "Универсал", "Внедорожник", "Кроссовер", "Купе", "Кабриолет", "Минивэн", "Пикап", "Другое"];
export const FUELS = ["Бензин", "Дизель", "Гибрид", "Электро", "Газ/бензин"];
export const GEARBOXES = ["Автомат", "Механика", "Робот", "Вариатор"];
export const DRIVES = ["Передний", "Задний", "Полный"];
export const FEATURES = ["Кожаный салон", "Панорама", "Круиз-контроль", "Подогрев сидений", "Камера заднего вида", "Парктроники", "Навигация", "Bluetooth", "Адаптивный круиз", "Датчик дождя", "Бесключевой доступ", "Люк"];
export const MAKES = ["Audi", "BMW", "Chevrolet", "Citroen", "Fiat", "Ford", "Honda", "Hyundai", "Kia", "Mazda", "Mercedes-Benz", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Renault", "Skoda", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo"];
export const CURRENCIES: Record<string, string> = { USD: "$", EUR: "€", UAH: "₴" };
export const CAR_STATUS: Record<string, string> = { available: "В продаже", reserved: "Резерв", sold: "Продано" };
export const MAX_CAR_PHOTOS = 10;

export type Car = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  mileage_km: number | null;
  body: string;
  engine_vol: number | null;
  fuel: string;
  gearbox: string;
  drive: string;
  vin: string;
  features: string[];
  price: number;
  currency: string;
  negotiable: boolean;
  description: string;
  photos: string[];
  status: string;
  is_active?: boolean;
};

export const carTitle = (c: { make: string; model: string; year?: number | null }) => `${c.make} ${c.model}${c.year ? `, ${c.year}` : ""}`;

export function carPrice(price: number, currency: string): string {
  const n = Math.round(Number(price) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sym = CURRENCIES[currency] ?? currency;
  return currency === "UAH" ? `${n} ${sym}` : `${sym}${n}`;
}

export const km = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} км`);
