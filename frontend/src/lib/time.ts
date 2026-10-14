// Проверяет пересечение двух смен в один день
export function shiftsOverlap(
  a: { date: string; start: string; end: string },
  b: { date: string; start: string; end: string },
): boolean {
  if (a.date !== b.date) return false;
  return a.start < b.end && b.start < a.end;
}