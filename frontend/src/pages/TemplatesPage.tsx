import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, X, Trash2, Clock, Briefcase, MapPin, Layers,
  Copy, Pencil, Save, ClipboardPaste, ClipboardX,
} from "lucide-react";
import { useShiftTemplates } from "../store/shiftTemplates";
import { usePositions } from "../store/positions";
import { useAreas } from "../store/areas";
import { useLocations } from "../store/locations";
import NavBar from "../components/NavBar";
import { validateShiftTimes } from "../lib/time";
import { alertDialog, confirmDialog } from "../store/dialogs";
import { POSITION_PALETTE } from "../lib/colors";
import type { PositionTemplate } from "../api/positions";
import type { Area } from "../api/areas";

type Tab = "shifts" | "positions" | "areas";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const shiftSchema = z.object({
  name: z.string().min(2).max(100),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
type ShiftForm = z.infer<typeof shiftSchema>;

const SHIFT_COLORS = [
  { value: "#F59E0B", label: "Утро" },
  { value: "#3B82F6", label: "День" },
  { value: "#10B981", label: "Вечер" },
  { value: "#8B5CF6", label: "Ночь" },
  { value: "#EF4444", label: "Красный" },
  { value: "#6B7280", label: "Нейтральный" },
];

// Буфер локаций: какие areaIds и из какой точки
type AreasClipboard = {
  areaIds: string[];
  sourceLocationId: string;
  sourceLocationName: string;
} | null;

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>("shifts");

  // Смены
  const { items: shifts, fetch: fetchShifts, create: createShift, remove: removeShift } = useShiftTemplates();
  const [showShiftForm, setShowShiftForm] = useState(false);
  const shiftForm = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: "", startTime: "09:00", endTime: "18:00", color: "#3B82F6" },
  });
  const selectedColor = shiftForm.watch("color");

  // Должности
  const { items: positions, fetch: fetchPositions, create: createPosition, update: updatePosition, remove: removePosition } = usePositions();
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionColor, setNewPositionColor] = useState(POSITION_PALETTE[0].value);
  const [posBusy, setPosBusy] = useState(false);
  const [editingPos, setEditingPos] = useState<PositionTemplate | null>(null);

  // Локации
  const { items: areas, fetch: fetchAreas, create: createArea, remove: removeArea, copy: copyAreas } = useAreas();
  const { items: locations, fetch: fetchLocations } = useLocations();
  const [newArea, setNewArea] = useState({ name: "", locationId: "" });
  const [areaBusy, setAreaBusy] = useState(false);

  // 👇 Буфер для копирования локаций
  const [areasClipboard, setAreasClipboard] = useState<AreasClipboard>(null);
  const [pasteBusy, setPasteBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchShifts();
    fetchPositions();
    fetchAreas();
    fetchLocations();
  }, [fetchShifts, fetchPositions, fetchAreas, fetchLocations]);

  // ─── SHIFTS ──────────────────────────────────────────
  const onSubmitShift = async (data: ShiftForm) => {
    const check = validateShiftTimes(data.startTime, data.endTime);
    if (!check.ok) {
      await alertDialog(check.message ?? "Неверное время", { title: "Ошибка", variant: "error" });
      return;
    }
    try {
      await createShift(data);
      shiftForm.reset();
      setShowShiftForm(false);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    }
  };

  // ─── POSITIONS ───────────────────────────────────────
  const onAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPositionName.trim()) return;
    setPosBusy(true);
    try {
      await createPosition({ name: newPositionName.trim(), color: newPositionColor });
      setNewPositionName("");
      setNewPositionColor(POSITION_PALETTE[0].value);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setPosBusy(false);
    }
  };

  const onRemovePosition = async (id: string, name: string) => {
    const ok = await confirmDialog(
      `Удалить должность «${name}»?\n\nУ сотрудников она останется в карточке. При следующей загрузке шаблонов появится снова, пока используется хотя бы одним сотрудником.`,
      { title: "Удаление", confirmLabel: "Удалить", variant: "danger" }
    );
    if (!ok) return;
    try { await removePosition(id); }
    catch (e: any) { await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" }); }
  };

  const onSavePosition = async (id: string, data: { name: string; color: string }) => {
    try {
      await updatePosition(id, data);
      setEditingPos(null);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    }
  };

  // ─── AREAS ───────────────────────────────────────────
  const areasByLocation = useMemo(() => {
    const map = new Map<string, Area[]>();
    for (const loc of locations) map.set(loc.id, []);
    const seen = new Set<string>();
    for (const a of areas) {
      if (!map.has(a.locationId)) map.set(a.locationId, []);
      map.get(a.locationId)!.push(a);
    }
    return map;
  }, [areas, locations]);

  const onAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArea.name.trim() || !newArea.locationId) return;
    setAreaBusy(true);
    try {
      await createArea({ name: newArea.name.trim(), locationId: newArea.locationId });
      setNewArea({ name: "", locationId: newArea.locationId });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setAreaBusy(false);
    }
  };

  const onRemoveArea = async (id: string, name: string) => {
    const ok = await confirmDialog(
      `Удалить локацию «${name}»?\n\nУ сотрудников она останется в карточке.`,
      { title: "Удаление", confirmLabel: "Удалить", variant: "danger" }
    );
    if (!ok) return;
    try { await removeArea(id); }
    catch (e: any) { await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" }); }
  };

  // 👇 Копирование через буфер
  const copyOne = (area: Area, locName: string) => {
    setAreasClipboard({
      areaIds: [area.id],
      sourceLocationId: area.locationId,
      sourceLocationName: locName,
    });
  };

  const copyAll = (locId: string, locName: string, locAreas: Area[]) => {
    if (locAreas.length === 0) return;
    setAreasClipboard({
      areaIds: locAreas.map((a) => a.id),
      sourceLocationId: locId,
      sourceLocationName: locName,
    });
  };

  const clearClipboard = () => setAreasClipboard(null);

  const onPaste = async (targetLocationId: string, targetName: string) => {
    if (!areasClipboard) return;
    setPasteBusy(targetLocationId);
    try {
      const res = await copyAreas({
        areaIds: areasClipboard.areaIds,
        targetLocationId,
      });
      await alertDialog(
        `Скопировано в «${targetName}»: ${res.copied}${
          res.skipped > 0 ? `. Пропущено: ${res.skipped} (уже были)` : ""
        }`,
        { title: "Готово", variant: "success" }
      );
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setPasteBusy(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "shifts", label: "Смены", icon: Clock },
    { id: "positions", label: "Должности", icon: Briefcase },
    { id: "areas", label: "Локации", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Шаблоны</h1>
          <p className="text-sm text-slate-500 mt-1">
            Смены, должности и локации (помещения внутри точек)
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  active ? "bg-brand-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* СМЕНЫ */}
        {tab === "shifts" && (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowShiftForm((v) => !v)}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm"
              >
                {showShiftForm ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Новый шаблон</>}
              </button>
            </div>

            {showShiftForm && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
                <form onSubmit={shiftForm.handleSubmit(onSubmitShift)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input {...shiftForm.register("name")} placeholder="Название" />
                    <input type="time" {...shiftForm.register("startTime")} />
                    <input type="time" {...shiftForm.register("endTime")} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SHIFT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => shiftForm.setValue("color", c.value)}
                        className={`w-9 h-9 rounded-xl transition-all ${
                          selectedColor === c.value ? "ring-2 ring-offset-2 ring-slate-900" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <button type="submit" className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium">
                    Сохранить
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((t) => (
                <div key={t.id} className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: t.color }} />
                  <div className="pl-2">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{t.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{t.startTime}</span>
                          <span>→</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{t.endTime}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeShift(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1.5 rounded-lg"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {shifts.length === 0 && (
                <div className="col-span-full text-center text-slate-400 py-8">Нет шаблонов смен</div>
              )}
            </div>
          </>
        )}

        {/* ДОЛЖНОСТИ */}
        {tab === "positions" && (
          <>
            <form onSubmit={onAddPosition} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="Новая должность, например «продавец»"
                  className="flex-1 min-w-[200px]"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Цвет:</span>
                  {POSITION_PALETTE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewPositionColor(c.value)}
                      title={c.label}
                      className={`w-7 h-7 rounded-lg transition-all ${
                        newPositionColor === c.value ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!newPositionName.trim() || posBusy}
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> {posBusy ? "..." : "Добавить"}
                </button>
              </div>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {positions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Пока нет должностей</div>
              ) : (
                positions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    {editingPos?.id === p.id ? (
                      <EditPositionRow
                        position={p}
                        onCancel={() => setEditingPos(null)}
                        onSave={(data) => onSavePosition(p.id, data)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-md" style={{ backgroundColor: p.color }} />
                          <span className="font-medium text-slate-900">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingPos(p)}
                            className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg"
                            title="Редактировать"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRemovePosition(p.id, p.name)}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Должности из карточек сотрудников добавляются автоматически.
            </p>
          </>
        )}

        {/* ЛОКАЦИИ */}
        {tab === "areas" && (
          <>
            {locations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">Сначала создайте точку</h3>
                <p className="text-sm text-slate-500">
                  Локации — это помещения внутри точки (кухня, зал, администрация).
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={onAddArea} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Название локации</label>
                    <input
                      value={newArea.name}
                      onChange={(e) => setNewArea((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Кухня, Зал, Администрация..."
                    />
                  </div>
                  <div className="w-56">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Точка</label>
                    <select
                      value={newArea.locationId}
                      onChange={(e) => setNewArea((f) => ({ ...f, locationId: e.target.value }))}
                    >
                      <option value="">— Выберите точку —</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={!newArea.name.trim() || !newArea.locationId || areaBusy}
                    className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> {areaBusy ? "..." : "Добавить"}
                  </button>
                </form>

                {/* 👇 Индикатор буфера */}
                {areasClipboard && (
                  <div className="mb-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 font-medium">
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    В буфере: {areasClipboard.areaIds.length}{" "}
                    {areasClipboard.areaIds.length === 1 ? "локация" : "локаций"} из «{areasClipboard.sourceLocationName}»
                    <button
                      onClick={clearClipboard}
                      className="ml-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded p-0.5 transition-colors"
                      title="Очистить буфер"
                    >
                      <ClipboardX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {locations.map((loc) => {
                    const locAreas = areasByLocation.get(loc.id) ?? [];
                    const isSource = areasClipboard?.sourceLocationId === loc.id;
                    const canPaste = !!areasClipboard && !isSource;
                    const isPasting = pasteBusy === loc.id;

                    return (
                      <details
                        key={loc.id}
                        open
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                      >
                        <summary className="cursor-pointer px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 hover:bg-slate-100">
                          <MapPin className="w-4 h-4 text-brand-600" />
                          <span className="font-semibold text-slate-900 text-sm">{loc.name}</span>
                          <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full ring-1 ring-slate-200">
                            {locAreas.length}
                          </span>

                          <div className="ml-auto flex items-center gap-1">
                            {/* Копировать всё */}
                            {locAreas.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  copyAll(loc.id, loc.name, locAreas);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded transition-colors"
                                title="Скопировать все локации в буфер"
                              >
                                <Copy className="w-3 h-3" /> Копировать всё
                              </button>
                            )}

                            {/* 👇 Вставить (только если не источник и есть буфер) */}
                            {canPaste && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onPaste(loc.id, loc.name);
                                }}
                                disabled={isPasting}
                                className="inline-flex items-center gap-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1 rounded transition-colors font-medium"
                                title={`Вставить ${areasClipboard!.areaIds.length} локаций сюда`}
                              >
                                <ClipboardPaste className="w-3 h-3" />
                                {isPasting ? "..." : "Вставить"}
                              </button>
                            )}
                          </div>
                        </summary>

                        {locAreas.length === 0 ? (
                          <div className="px-4 py-4 text-xs text-slate-400 italic">
                            В этой точке пока нет локаций
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {locAreas.map((a) => (
                              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-sm text-slate-800">{a.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => copyOne(a, loc.name)}
                                    className="text-slate-400 hover:text-brand-600 p-1 rounded-lg"
                                    title="Скопировать в буфер"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onRemoveArea(a.id, a.name)}
                                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg"
                                    title="Удалить"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Редактирование должности inline ─────────────────
function EditPositionRow({
  position,
  onSave,
  onCancel,
}: {
  position: PositionTemplate;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(position.name);
  const [color, setColor] = useState(position.color);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await onSave({ name: name.trim(), color }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="flex-1 flex items-center gap-2 flex-wrap">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="!w-40 !text-sm !py-1"
        required
      />
      <div className="flex items-center gap-1">
        {POSITION_PALETTE.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            title={c.label}
            className={`w-5 h-5 rounded transition-all ${
              color === c.value ? "ring-2 ring-offset-1 ring-slate-900 scale-110" : "hover:scale-110"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <button
          type="submit"
          disabled={busy}
          className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg"
          title="Сохранить"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"
          title="Отмена"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}