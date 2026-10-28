export const POSITION_PALETTE = [
  { value: "#3B82F6", label: "Синий" },
  { value: "#8B5CF6", label: "Фиолетовый" },
  { value: "#10B981", label: "Изумрудный" },
  { value: "#F59E0B", label: "Янтарный" },
  { value: "#EF4444", label: "Красный" },
  { value: "#06B6D4", label: "Голубой" },
  { value: "#6366F1", label: "Индиго" },
  { value: "#EC4899", label: "Розовый" },
  { value: "#14B8A6", label: "Бирюзовый" },
  { value: "#84CC16", label: "Лаймовый" },
];

/** Hex-цвет + alpha для фона (0–100%). */
export function withAlpha(hex: string, percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  const a = Math.round((p / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}