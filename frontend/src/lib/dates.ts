const DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

// Возвращает массив 7 дат недели (YYYY-MM-DD) начиная с понедельника
export function weekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00Z");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Название дня (Пн, Вт...)
export function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun
  const idx = dow === 0 ? 6 : dow - 1; // сдвиг: Mon=0
  return DAYS_RU[idx];
}

// Формат "13 окт"
export function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]}`;
}

// Формат "13 октября 2026" (полное)
export function fullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Ближайший понедельник (или сегодня, если сегодня понедельник)
export function nextMonday(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}