import { useEffect, useMemo, useState } from "react";
import { Briefcase, Layers, Search, X, ChevronDown } from "lucide-react";
import { withAlpha } from "../lib/colors";

type SummaryUser = {
  id: string;
  name: string;
  position: string | null;
  hourlyRate: string | null;
  locationIds: string[];
  areaIds: string[];
};

type Props = {
  users: SummaryUser[];
  areas: { id: string; name: string }[];
  positions: { id: string; name: string; color: string }[];
  getStat: (userId: string) => { hours: number; shifts: number; cost: number };
  statLabel: string;
  statMax: number;
  headerOpacity?: number;
  rowOpacity?: number;
};

const FALLBACK_POS_COLOR = "#64748B";

export default function TeamSummary({
  users, areas, positions, getStat, statLabel, statMax,
  headerOpacity = 70, rowOpacity = 20,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fArea, setFArea] = useState("");
  const [fPosition, setFPosition] = useState("");
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());

  const toggleAreaCollapse = (key: string) =>
    setCollapsedAreas((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const positionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of positions) map.set(p.name, p.color);
    return map;
  }, [positions]);

  // 👇 Должности, доступные в выбранной локации (или все, если локация не выбрана)
  const availablePositions = useMemo(() => {
    if (!fArea) return positions;
    const namesInArea = new Set<string>();
    for (const u of users) {
      if (u.position && (u.areaIds ?? []).includes(fArea)) {
        namesInArea.add(u.position);
      }
    }
    return positions.filter((p) => namesInArea.has(p.name));
  }, [positions, users, fArea]);

  // 👇 Если выбранная должность не входит в новую локацию — сбросить
  useEffect(() => {
    if (fPosition && !availablePositions.some((p) => p.name === fPosition)) {
      setFPosition("");
    }
  }, [availablePositions, fPosition]);

  // 👇 дедуплицируем локации по имени
  const uniqueAreas = useMemo(() => {
    const seen = new Set<string>();
    return areas.filter((a) => {
      const key = a.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [areas]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      if (q && !u.name.toLowerCase().includes(q)) return false;
      if (fArea && !(u.areaIds ?? []).includes(fArea)) return false;
      if (fPosition && (u.position ?? "") !== fPosition) return false;
      return true;
    });
  }, [users, search, fArea, fPosition]);

  const grouped = useMemo(() => {
    const byArea = new Map<string, Map<string, SummaryUser[]>>();
    const validAreaIds = new Set(areas.map((a) => a.id));
    
    for (const u of filtered) {
      // 👇 Если выбрана локация — показываем сотрудника ТОЛЬКО в её группе
      let activeAreas: (string | null)[] = [];
      if (fArea) {
        activeAreas = [fArea];
      } else {
        const userAreaIds = (u.areaIds ?? []).filter((id) => validAreaIds.has(id));
        activeAreas = userAreaIds.length > 0 ? userAreaIds : [null];
      }

      for (const areaId of activeAreas) {
        const areaKey = areaId ?? "__noArea__";
        if (!byArea.has(areaKey)) byArea.set(areaKey, new Map());
        const posMap = byArea.get(areaKey)!;
        const posKey = u.position || "__noPosition__";
        if (!posMap.has(posKey)) posMap.set(posKey, []);
        posMap.get(posKey)!.push(u);
      }
    }
    return byArea;
  }, [filtered, areas, fArea]);

  const areaName = (id: string | null) =>
    id ? uniqueAreas.find((a) => a.id === id)?.name ?? "—" : "Без локации";

  const anyFilter = !!(search || fArea || fPosition);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="font-semibold text-slate-900 text-sm">Фильтры и сводка</span>
          <span className="text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? "сотрудник" : "сотрудников"}
          </span>
          {anyFilter && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
              фильтр
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{statLabel}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени..."
                className="!pl-8 !text-sm !py-1.5"
              />
            </div>
            <select
              value={fArea}
              onChange={(e) => setFArea(e.target.value)}
              className="!w-auto !text-sm !py-1.5"
            >
              <option value="">Все локации</option>
              {uniqueAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={fPosition}
              onChange={(e) => setFPosition(e.target.value)}
              className="!w-auto !text-sm !py-1.5"
            >
              <option value="">Все должности</option>
              {availablePositions.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
              {/* 👇 если выбранная должность исчезла из списка — оставляем опцию, чтобы не сломать селект */}
              {fPosition && !availablePositions.some((p) => p.name === fPosition) && (
                <option value={fPosition}>{fPosition}</option>
              )}
            </select>
            {anyFilter && (
              <button
                onClick={() => { setSearch(""); setFArea(""); setFPosition(""); }}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                <X className="w-3 h-3 inline" /> Сброс
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-6">Нет сотрудников по фильтру</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {Array.from(grouped.entries()).map(([areaKey, posMap]) => {
                const areaAllUsers = Array.from(posMap.values()).flat();
                const posArr = Array.from(posMap.entries());
                const isCollapsed = collapsedAreas.has(areaKey);

                return (
                  <div
                    key={areaKey}
                    className="bg-slate-50/70 rounded-xl border-2 border-slate-300 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleAreaCollapse(areaKey)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-100 transition-colors text-left"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-800 text-sm">
                        {areaName(areaKey === "__noArea__" ? null : areaKey)}
                      </span>
                      <span className="text-xs text-slate-500">({areaAllUsers.length})</span>
                    </button>

                    {!isCollapsed && (
                      <div className="p-2 pt-0">
                        <div className={posArr.length > 1 ? "columns-2 gap-2" : ""}>
                          {posArr.map(([posKey, list]) => {
                            const posColor = positionColorMap.get(posKey) ?? FALLBACK_POS_COLOR;
                            return (
                              <div
                                key={posKey}
                                className={`rounded-lg border border-slate-200 overflow-hidden ${
                                  posArr.length > 1 ? "break-inside-avoid mb-2 inline-block w-full" : ""
                                }`}
                              >
                                <div
                                  className="flex items-center gap-1.5 px-2 py-2"
                                  style={{ backgroundColor: withAlpha(posColor, headerOpacity) }}
                                >
                                  <Briefcase className="w-3.5 h-3.5 text-slate-900" />
                                  <span className="text-sm font-bold text-slate-900 truncate">
                                    {posKey === "__noPosition__" ? "Без должности" : posKey}
                                  </span>
                                  <span className="text-[11px] text-slate-700 font-medium ml-auto shrink-0">
                                    ({list.length})
                                  </span>
                                </div>

                                <div>
                                  {list.map((u) => {
                                    const st = getStat(u.id);
                                    const over = st.hours > statMax;
                                    const pct = Math.min((st.hours / statMax) * 100, 100);
                                    return (
                                      <div
                                        key={u.id}
                                        className="flex items-center gap-2 px-2 py-1.5 border-b border-white/40 last:border-0"
                                        style={{ backgroundColor: withAlpha(posColor, rowOpacity) }}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-slate-900 truncate">
                                            {u.name}
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                              <div
                                                className={`h-full transition-all ${over ? "bg-rose-500" : "bg-blue-500"}`}
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className={`text-[10px] whitespace-nowrap ${over ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
                                              {st.hours} ч · {st.shifts} см.
                                            </span>
                                          </div>
                                        </div>
                                        <span className={`text-[11px] font-semibold whitespace-nowrap ${over ? "text-rose-600" : "text-slate-800"}`}>
                                          {new Intl.NumberFormat("ru-RU").format(st.cost)} ₽
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}