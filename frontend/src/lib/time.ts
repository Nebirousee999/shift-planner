// Проверяет пересечение двух смен в один день
export function shiftsOverlap(
  a: { date: string; start: string; end: string },
  b: { date: string; start: string; end: string },
): boolean {
  if (a.date !== b.date) return false;
  return a.start < b.end && b.start < a.end;
}

// Максимальная длительность смены — 16 часов.
// Всё, что длиннее, скорее опечатка (8:00 → 7:00 = 23 часа).
const MAX_SHIFT_HOURS = 16;

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Проверяет корректность времени смены.
 *
 * Разрешает:
 *   - дневные смены: 09:00 → 18:00 (9 ч)
 *   - ночные смены: 22:00 → 06:00 (8 ч, через полночь)
 *
 * Отклоняет:
 *   - одинаковое время: 09:00 → 09:00
 *   - «обратные» смены длиннее 16 ч: 08:00 → 07:00 (23 ч)
 */
export function validateShiftTimes(
  startTime: string,
  endTime: string
): { ok: boolean; message?: string } {
  if (!startTime || !endTime) {
    return { ok: false, message: "Укажите время начала и окончания смены" };
  }

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === end) {
    return {
      ok: false,
      message: "Время начала и окончания совпадают. Проверьте время.",
    };
  }

  // Дневная смена: конец больше начала
  if (end > start) {
    const hours = (end - start) / 60;
    if (hours > MAX_SHIFT_HOURS) {
      return {
        ok: false,
        message: `Смена не может длиться больше ${MAX_SHIFT_HOURS} часов.`,
      };
    }
    return { ok: true };
  }

  // Ночная смена: конец меньше начала, значит через полночь
  const hours = (end + 24 * 60 - start) / 60;
  if (hours > MAX_SHIFT_HOURS) {
    return {
      ok: false,
      message:
        `Похоже, время указано неверно: смена длится ${Math.round(hours)} ч.\n\n` +
        `Проверьте время начала и окончания.`,
    };
  }

  return { ok: true };
}