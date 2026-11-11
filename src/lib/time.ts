// ������� ���� ����� "08:00" � "15:00" (��������� ������ �����)
export function hoursBetween(start: string, end: string): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) minutes += 24 * 60; // ������ ����� ����� �������
    return minutes / 60;
}

// ���������� ����������� ������, � ������� �������� ����
export function getMonday(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
}

// ����� �� ���� ������ ������ (weekStart � �����������)
export function isWithinWeek(shiftDate: string, weekStart: string): boolean {
    const start = new Date(weekStart + "T00:00:00Z").getTime();
    const end = start + 7 * 24 * 3600 * 1000;
    const t = new Date(shiftDate + "T00:00:00Z").getTime();
    return t >= start && t < end;
}

// �������� Date ��� ������ � "YYYY-MM-DD"
export function toDateStr(value: Date | string): string {
    if (typeof value === "string") return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
}

// ���� �� ����������� �� ������� ����� ����� ������� � ���� ����
export function shiftsOverlap(
    a: { date: string; start: string; end: string },
    b: { date: string; start: string; end: string },
): boolean {
    if (a.date !== b.date) return false;
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    let s1 = toMins(a.start), e1 = toMins(a.end);
    let s2 = toMins(b.start), e2 = toMins(b.end);
    if (e1 <= s1) e1 += 24 * 60; // Ночная смена
    if (e2 <= s2) e2 += 24 * 60;
    return s1 < e2 && s2 < e1;
}