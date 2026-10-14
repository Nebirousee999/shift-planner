// —читаем часы между "08:00" и "15:00" (учитывает ночные смены)
export function hoursBetween(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) minutes += 24 * 60; // ночна€ смена через полночь
    return minutes / 60;
}

// ¬озвращает понедельник недели, в которую попадает дата
export function getMonday(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
}

// Ћежит ли дата внутри недели (weekStart Ч понедельник)
export function isWithinWeek(shiftDate: string, weekStart: string): boolean {
    const start = new Date(weekStart + "T00:00:00Z").getTime();
    const end = start + 7 * 24 * 3600 * 1000;
    const t = new Date(shiftDate + "T00:00:00Z").getTime();
    return t >= start && t < end;
}

// ѕриводим Date или строку к "YYYY-MM-DD"
export function toDateStr(value: Date | string): string {
    if (typeof value === "string") return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
}

// ≈сть ли пересечение по времени между двум€ сменами в один день
export function shiftsOverlap(
    a: { date: string; start: string; end: string },
    b: { date: string; start: string; end: string },
): boolean {
    if (a.date !== b.date) return false;
    return a.start < b.end && b.start < a.end;
}