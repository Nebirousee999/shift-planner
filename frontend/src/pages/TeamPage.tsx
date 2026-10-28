import { useEffect, useState, useMemo, Fragment } from "react";
import {
  UserPlus, Search, Trash2, X, Check, Pencil, Save,
  MapPin, Briefcase, Layers, ChevronDown,
  FileSpreadsheet, Upload, Users as UsersIcon,
  LayoutList, LayoutGrid,
} from "lucide-react";
import { useUsers } from "../store/users";
import { useAuth } from "../store/auth";
import { useLocations } from "../store/locations";
import { useAreas } from "../store/areas";
import { usePositions } from "../store/positions";
import { useOrganization } from "../store/organization";
import NavBar from "../components/NavBar";
import type { TeamUser } from "../api/users";
import type { Area } from "../api/areas";
import { alertDialog, confirmDialog } from "../store/dialogs";
import { withAlpha } from "../lib/colors";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  MANAGER: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  EMPLOYEE: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

type BulkAction =
  | ""
  | "addToLocation"
  | "addToArea"
  | "setPosition"
  | "setRate"
  | "setRole"
  | "setPaymentType"
  | "setEmploymentType";

type ViewMode = "groups" | "matrix";

type PendingUserChange = {
  areaIds: Set<string>;
  locationIds: Set<string>;
};

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const {
    items, loading, error, fetch, create, remove, update, bulkUpdate,
    downloadExcelTemplate, importFromExcel,
  } = useUsers();
  const { items: locations, fetch: fetchLocations } = useLocations();
  const { items: areas, fetch: fetchAreas } = useAreas();
  const { items: positions, fetch: fetchPositions } = usePositions();
  const org = useOrganization((s) => s.org);
  const headerOpacity = org?.positionHeaderOpacity ?? 70;
  const rowOpacity = org?.positionRowOpacity ?? 20;

  const [viewMode, setViewMode] = useState<ViewMode>("groups");
  const [editMode, setEditMode] = useState(false);

  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterRole, setFilterRole] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const [importing, setImporting] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "EMPLOYEE" as "OWNER" | "MANAGER" | "EMPLOYEE",
    position: "",
    hourlyRate: "",
    paymentType: "HOURLY" as "HOURLY" | "MONTHLY",
    employmentType: "SHTAT" as "GPH" | "SHTAT",
    phone: "",
  });
  const [creating, setCreating] = useState(false);

  const [matrixEditMode, setMatrixEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingUserChange>>(new Map());
  const [matrixSaving, setMatrixSaving] = useState(false);

  useEffect(() => {
    fetch();
    fetchLocations();
    fetchAreas();
    fetchPositions();
  }, [fetch, fetchLocations, fetchAreas, fetchPositions]);

  const switchViewMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setSelected(new Set());
    setBulkAction("");
    setBulkValue("");
    if (mode === "matrix") setEditMode(false);
    if (mode === "groups") {
      setMatrixEditMode(false);
      setPendingChanges(new Map());
    }
  };

  const toggleEdit = () => {
    const next = !editMode;
    setEditMode(next);
    if (!next) {
      setSelected(new Set());
      setBulkAction("");
      setBulkValue("");
    }
  };

  const filterAreasAvailable = useMemo(() => {
    const src = filterLocation
      ? areas.filter((a) => a.locationId === filterLocation)
      : areas;
    const seen = new Set<string>();
    return src.filter((a) => {
      const key = a.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [areas, filterLocation]);

  // 👇 При выборе локации — автовыбор её точки (если не выбрана или другая)
  const handleFilterAreaChange = (areaId: string) => {
    setFilterArea(areaId);
    if (!areaId) return;
    const area = areas.find((a) => a.id === areaId);
    if (area && area.locationId !== filterLocation) {
      setFilterLocation(area.locationId);
    }
  };

  // 👇 При смене точки — если локация не из неё, сбросить
  const handleFilterLocationChange = (locId: string) => {
    setFilterLocation(locId);
    if (filterArea) {
      const area = areas.find((a) => a.id === filterArea);
      if (!area || area.locationId !== locId) {
        setFilterArea("");
      }
    }
  };


  const filtered = useMemo(() => {
    return items.filter((u) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.position ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterLocation && !(u.locationIds ?? []).includes(filterLocation)) return false;
      if (filterArea && !(u.areaIds ?? []).includes(filterArea)) return false;
      if (filterPosition && (u.position ?? "") !== filterPosition) return false;
      if (filterRole && u.role !== filterRole) return false;
      return true;
    });
  }, [items, search, filterLocation, filterArea, filterPosition, filterRole]);

  const commonLocationIds = useMemo(() => {
    if (selected.size === 0) return null;
    let common: Set<string> | null = null;
    for (const id of selected) {
      const u = items.find((x) => x.id === id);
      if (!u) continue;
      const pts = new Set(u.locationIds ?? []);
      if (common === null) common = new Set(pts);
      else {
        for (const p of Array.from(common)) {
          if (!pts.has(p)) common.delete(p);
        }
      }
    }
    return common ?? new Set<string>();
  }, [selected, items]);

  const bulkAreas = useMemo(() => {
    if (!commonLocationIds || commonLocationIds.size === 0) return [];
    const src = areas.filter((a) => commonLocationIds.has(a.locationId));
    const seen = new Set<string>();
    return src.filter((a) => {
      const key = a.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [areas, commonLocationIds]);

  const grouped = useMemo(() => {
    type PosGroup = Map<string, TeamUser[]>;
    type AreaGroup = { areaId: string | null; positions: PosGroup };
    type LocGroup = { locationId: string | null; areas: Map<string, AreaGroup> };
    const map = new Map<string, LocGroup>();

    const areaLocMap = new Map<string, string>();
    for (const a of areas) areaLocMap.set(a.id, a.locationId);

    for (const u of filtered) {
      const locIds: (string | null)[] =
        u.locationIds && u.locationIds.length > 0 ? u.locationIds : [null];

      for (const locId of locIds) {
        const lKey = locId ?? "__noLoc__";
        if (!map.has(lKey)) map.set(lKey, { locationId: locId, areas: new Map() });
        const lG = map.get(lKey)!;

        const userAreaIds = (u.areaIds ?? []).filter((id) => {
          const aLoc = areaLocMap.get(id);
          return locId === null || aLoc === locId;
        });

        const areaIds: (string | null)[] = userAreaIds.length > 0 ? userAreaIds : [null];
        for (const aId of areaIds) {
          const aKey = aId ?? "__noArea__";
          if (!lG.areas.has(aKey)) lG.areas.set(aKey, { areaId: aId, positions: new Map() });
          const aG = lG.areas.get(aKey)!;

          const posKey = u.position || "__noPos__";
          if (!aG.positions.has(posKey)) aG.positions.set(posKey, []);
          aG.positions.get(posKey)!.push(u);
        }
      }
    }
    return map;
  }, [filtered, areas]);

  const locationName = (id: string | null): string =>
    id ? locations.find((l) => l.id === id)?.name ?? "—" : "Без точки";
  const areaName = (id: string | null): string =>
    id ? areas.find((a) => a.id === id)?.name ?? "—" : "Без локации";

  const tryToggle = (id: string) => {
    const u = items.find((x) => x.id === id);
    if (!u) return;
    const isRemoving = selected.has(id);

    if (!isRemoving && selected.size > 0 && commonLocationIds && commonLocationIds.size > 0) {
      const userPts = u.locationIds ?? [];
      const hasCommon = userPts.some((p) => commonLocationIds.has(p));
      if (userPts.length > 0 && !hasCommon) {
        alertDialog("Нельзя выделять сотрудников из разных точек", { variant: "error" });
        return;
      }
    }

    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = (list: TeamUser[]) => {
    if (selected.size > 0 && commonLocationIds && commonLocationIds.size > 0) {
      const conflicting = list.some((u) => {
        const pts = u.locationIds ?? [];
        return pts.length > 0 && !pts.some((p) => commonLocationIds.has(p));
      });
      if (conflicting) {
        alertDialog("Нельзя выделять сотрудников из разных точек", { variant: "error" });
        return;
      }
    }
    setSelected((prev) => {
      const n = new Set(prev);
      const allIn = list.every((u) => n.has(u.id));
      list.forEach((u) => (allIn ? n.delete(u.id) : n.add(u.id)));
      return n;
    });
  };

  const isAllSelected = (list: TeamUser[]) =>
    list.length > 0 && list.every((u) => selected.has(u.id));

  const handleMatrixToggle = (user: TeamUser, area: Area) => {
    if (!matrixEditMode) return;

    setPendingChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(user.id);

      const baseAreaIds = existing
        ? new Set(existing.areaIds)
        : new Set(user.areaIds ?? []);
      const baseLocationIds = existing
        ? new Set(existing.locationIds)
        : new Set(user.locationIds ?? []);

      if (baseAreaIds.has(area.id)) {
        baseAreaIds.delete(area.id);
      } else {
        baseAreaIds.add(area.id);
        baseLocationIds.add(area.locationId);
      }

      next.set(user.id, { areaIds: baseAreaIds, locationIds: baseLocationIds });
      return next;
    });
  };

  const onMatrixApply = async () => {
    if (pendingChanges.size === 0) {
      setMatrixEditMode(false);
      return;
    }

    setMatrixSaving(true);
    const errors: string[] = [];
    let saved = 0;

    for (const [userId, changes] of Array.from(pendingChanges.entries())) {
      try {
        await update(userId, {
          areaIds: Array.from(changes.areaIds),
          locationIds: Array.from(changes.locationIds),
        });
        saved++;
      } catch (e: any) {
        const msg =
          e?.response?.data?.details ||
          e?.response?.data?.error ||
          e?.message ||
          "Ошибка";
        errors.push(msg);
      }
    }

    await fetch();
    await fetchAreas();
    setMatrixSaving(false);
    setPendingChanges(new Map());
    setMatrixEditMode(false);

    if (errors.length > 0) {
      await alertDialog(
        `Сохранено: ${saved}. Ошибок: ${errors.length}\n\n${errors.slice(0, 5).join("\n")}`,
        { title: "Готово (с ошибками)", variant: "error" }
      );
    }
  };

  const onMatrixCancel = () => {
    setPendingChanges(new Map());
    setMatrixEditMode(false);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim()) return;

    setCreating(true);
    try {
      const payload: any = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        paymentType: createForm.paymentType,
        employmentType: createForm.employmentType,
      };
      if (createForm.position.trim()) payload.position = createForm.position.trim();
      if (createForm.hourlyRate.trim()) payload.hourlyRate = createForm.hourlyRate.trim();
      if (createForm.phone.trim()) payload.phone = createForm.phone.trim();

      const result = await create(payload);

      if (result.tempPassword) {
        await alertDialog(
          `Сотрудник создан!\n\nВременный пароль: ${result.tempPassword}\n\nПередайте его сотруднику.`,
          { title: "Готово", variant: "success" }
        );
      }

      setCreateForm({
        name: "", email: "", role: "EMPLOYEE", position: "",
        hourlyRate: "", paymentType: "HOURLY", employmentType: "SHTAT", phone: "",
      });
      setShowForm(false);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка создания", { variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      await alertDialog("Нельзя удалить самого себя", { variant: "error" });
      return;
    }
    const ok = await confirmDialog(`Удалить «${name}»?`, {
      title: "Удаление", confirmLabel: "Удалить", variant: "danger",
    });
    if (!ok) return;
    try {
      await remove(id);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка удаления", { variant: "error" });
    }
  };

  const onDownloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка скачивания", { title: "Ошибка", variant: "error" });
    }
  };

  const onUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      await alertDialog("Загрузите файл в формате .xlsx", { title: "Неверный формат", variant: "error" });
      e.target.value = "";
      return;
    }
    setBatchFile(file);
  };

  const onImport = async () => {
    if (!batchFile) return;
    setImporting(true);
    try {
      const result = await importFromExcel(batchFile);
      let msg = `Импорт завершён.\n\nСоздано: ${result.created}\nПропущено: ${result.skipped}`;
      if (result.createdUsers.length > 0) {
        msg += "\n\nВременные пароли:\n";
        msg += result.createdUsers.slice(0, 10).map((u) => `${u.name} (${u.email}): ${u.tempPassword}`).join("\n");
        if (result.createdUsers.length > 10) msg += `\n... и ещё ${result.createdUsers.length - 10}`;
      }
      if (result.errors.length > 0) {
        msg += "\n\nПредупреждения:\n" + result.errors.slice(0, 5).join("\n");
        if (result.errors.length > 5) msg += `\n... и ещё ${result.errors.length - 5}`;
      }
      await alertDialog(msg, { title: "Импорт завершён", variant: "success" });
      setBatchFile(null);
      await fetchAreas();
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка импорта", { title: "Ошибка", variant: "error" });
    } finally {
      setImporting(false);
    }
  };

  const onBulkApply = async () => {
    if (!bulkAction || !bulkValue || selected.size === 0) return;
    if (bulkAction === "setRole" && !["OWNER", "MANAGER", "EMPLOYEE"].includes(bulkValue)) return;
    if (bulkAction === "setPaymentType" && !["HOURLY", "MONTHLY"].includes(bulkValue)) return;
    if (bulkAction === "setEmploymentType" && !["GPH", "SHTAT"].includes(bulkValue)) return;

    setBulkBusy(true);
    try {
      const res = await bulkUpdate(Array.from(selected), {
        action: bulkAction, value: bulkValue,
      } as any);
      const skipped = (res as any).skipped ?? 0;
      if (bulkAction === "addToArea" && skipped > 0) {
        await alertDialog(`Обновлено: ${res.updated}. Пропущено: ${skipped}.`, { title: "Готово", variant: "success" });
      }
      setSelected(new Set());
      setBulkAction("");
      setBulkValue("");
      await fetchAreas();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setBulkBusy(false);
    }
  };

  const anyFilter = !!(search || filterLocation || filterArea || filterPosition || filterRole);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Сотрудники</h1>
            <p className="text-sm text-slate-500 mt-1">Команда, точки, локации и должности</p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
              <button
                onClick={() => switchViewMode("groups")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "groups" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Группы
              </button>
              <button
                onClick={() => switchViewMode("matrix")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === "matrix" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Матрица
              </button>
            </div>

            {viewMode === "groups" && (
              <button
                onClick={toggleEdit}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all ${
                  editMode ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {editMode ? <><Check className="w-4 h-4" /> Готово</> : <><Pencil className="w-4 h-4" /> Редактировать</>}
              </button>
            )}

            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              {showForm ? <><X className="w-4 h-4" /> Отмена</> : <><UserPlus className="w-4 h-4" /> Добавить сотрудника</>}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-slate-900">Импорт из Excel</div>
              <div className="text-xs text-slate-500 mt-0.5">Колонки: Имя, Email, Должность, Точка, Локация, Ставка, Телефон</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={onDownloadTemplate} className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Скачать шаблон
              </button>
              <label className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {batchFile ? "Заменить файл" : "Загрузить Excel"}
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onUploadExcel} className="hidden" />
              </label>
              {batchFile && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 max-w-[200px] truncate">
                    <Check className="w-3.5 h-3.5 shrink-0" /> {batchFile.name}
                  </span>
                  <button type="button" onClick={onImport} disabled={importing} className="inline-flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {importing ? "Импорт..." : "Импортировать"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4">Новый сотрудник</h3>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Имя</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Мария Иванова" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="maria@cafe.ru" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Роль</label>
                  <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as any }))}>
                    <option value="EMPLOYEE">Сотрудник</option>
                    <option value="MANAGER">Менеджер</option>
                    <option value="OWNER">Владелец</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Должность</label>
                  <select value={createForm.position} onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))}>
                    <option value="">Без должности</option>
                    {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Форма оплаты</label>
                  <select value={createForm.paymentType} onChange={(e) => setCreateForm((f) => ({ ...f, paymentType: e.target.value as any }))}>
                    <option value="HOURLY">Почасовая</option>
                    <option value="MONTHLY">Месячный оклад</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Трудоустройство</label>
                  <select value={createForm.employmentType} onChange={(e) => setCreateForm((f) => ({ ...f, employmentType: e.target.value as any }))}>
                    <option value="SHTAT">В штате</option>
                    <option value="GPH">ГПХ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {createForm.paymentType === "HOURLY" ? "Ставка, ₽/час" : "Оклад, ₽/мес"}
                  </label>
                  <input value={createForm.hourlyRate} onChange={(e) => setCreateForm((f) => ({ ...f, hourlyRate: e.target.value }))} placeholder={createForm.paymentType === "HOURLY" ? "350" : "50000"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Телефон</label>
                  <input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+7 999 123-45-67" />
                </div>
              </div>
              <p className="text-xs text-slate-500">После создания точки и локации назначаются в карточке сотрудника.</p>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all">
                  {creating ? "Сохранение..." : "Сохранить"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени, email, должности..." className="!pl-9" />
          </div>
          <select
            value={filterLocation}
            onChange={(e) => handleFilterLocationChange(e.target.value)}
            className="!w-auto"
          >
            <option value="">Все точки</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
            value={filterArea}
            onChange={(e) => handleFilterAreaChange(e.target.value)}
            className="!w-auto"
          >
            <option value="">Все локации</option>
            {filterAreasAvailable.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="!w-auto">
            <option value="">Все должности</option>
            {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="!w-auto">
            <option value="">Все роли</option>
            <option value="OWNER">Владелец</option>
            <option value="MANAGER">Менеджер</option>
            <option value="EMPLOYEE">Сотрудник</option>
          </select>
          {anyFilter && (
            <button
              onClick={() => {
                setSearch("");
                setFilterLocation("");
                setFilterArea("");
                setFilterPosition("");
                setFilterRole("");
              }}
              className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          )}
          {viewMode === "groups" && editMode && (
            <button onClick={() => selectAll(filtered)} className="ml-auto text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50">
              Выделить всех ({filtered.length})
            </button>
          )}
        </div>

        {viewMode === "groups" && editMode && (
          <div className="sticky top-[100px] z-20 bg-white border-2 border-brand-300 rounded-2xl p-3 mb-4 flex items-center gap-3 flex-wrap shadow-lg">
            <span className="text-sm font-medium text-brand-900">Выбрано: <b>{selected.size}</b></span>
            <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value as BulkAction); setBulkValue(""); }} className="!w-auto">
              <option value="">— Действие —</option>
              <option value="addToLocation">Добавить в точку</option>
              <option value="addToArea">Добавить в локацию</option>
              <option value="setPosition">Установить должность</option>
              <option value="setRate">Изменить ставку/оклад</option>
              <option value="setPaymentType">Изменить форму оплаты</option>
              <option value="setEmploymentType">Изменить трудоустройство</option>
              <option value="setRole">Изменить роль</option>
            </select>

            {bulkAction === "addToLocation" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto">
                <option value="">— Точка —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}

            {bulkAction === "addToArea" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto" disabled={bulkAreas.length === 0}>
                <option value="">{bulkAreas.length === 0 ? "— Нет локаций в общих точках —" : "— Локация —"}</option>
                {bulkAreas.map((a) => {
                  const sameNameCount = bulkAreas.filter((x) => x.name.toLowerCase().trim() === a.name.toLowerCase().trim()).length;
                  const loc = locations.find((l) => l.id === a.locationId);
                  return <option key={a.id} value={a.id}>{sameNameCount > 1 && loc ? `${a.name} · ${loc.name}` : a.name}</option>;
                })}
              </select>
            )}

            {bulkAction === "setPosition" && (
              <>
                <input list="bulk-positions" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Название должности" className="!w-48" />
                <datalist id="bulk-positions">{positions.map((p) => <option key={p.id} value={p.name} />)}</datalist>
              </>
            )}

            {bulkAction === "setRate" && (
              <input type="number" step="0.01" min="0" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="₽" className="!w-32" />
            )}

            {bulkAction === "setPaymentType" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto">
                <option value="">— Форма —</option>
                <option value="HOURLY">Почасовая</option>
                <option value="MONTHLY">Месячный оклад</option>
              </select>
            )}

            {bulkAction === "setEmploymentType" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto">
                <option value="">— Тип —</option>
                <option value="SHTAT">В штате</option>
                <option value="GPH">ГПХ</option>
              </select>
            )}

            {bulkAction === "setRole" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto">
                <option value="">— Роль —</option>
                <option value="OWNER">Владелец</option>
                <option value="MANAGER">Менеджер</option>
                <option value="EMPLOYEE">Сотрудник</option>
              </select>
            )}

            <button onClick={onBulkApply} disabled={!bulkAction || !bulkValue || bulkBusy || selected.size === 0} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
              {bulkBusy ? "..." : "Применить"}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0} className="text-sm text-slate-600 hover:bg-white px-3 py-1.5 rounded-lg disabled:opacity-40">
              Сбросить
            </button>
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && filtered.length === 0 && items.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Нет сотрудников по фильтру</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <UsersIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Пока нет сотрудников</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Добавьте вручную или загрузите Excel со всеми сразу</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm">
              <UserPlus className="w-4 h-4" /> Добавить сотрудника
            </button>
          </div>
        )}

        {viewMode === "groups" && filtered.length > 0 && (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([lKey, lGroup]) => {
              const allInLoc = Array.from(lGroup.areas.values()).flatMap((aG) => Array.from(aG.positions.values()).flat());
              return (
                <details key={lKey} open className="bg-white rounded-2xl border-2 border-slate-400 shadow-sm overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 bg-slate-100 hover:bg-slate-200 border-b-2 border-slate-400 flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                    {editMode && (
                      <input type="checkbox" checked={isAllSelected(allInLoc)} onChange={() => selectAll(allInLoc)} onClick={(e) => e.stopPropagation()} className="!w-4 !h-4 !p-0" />
                    )}
                    <MapPin className="w-4 h-4 text-slate-700" />
                    <span className="font-bold text-slate-900 text-sm">{locationName(lGroup.locationId)}</span>
                    <span className="text-xs text-slate-600 bg-white px-2 py-0.5 rounded-full ring-1 ring-slate-300">{allInLoc.length} чел.</span>
                  </summary>

                  <div className="p-3 space-y-2">
                    {Array.from(lGroup.areas.entries()).map(([aKey, aGroup]) => {
                      const allInArea = Array.from(aGroup.positions.values()).flat();
                      const posArr = Array.from(aGroup.positions.entries());
                      const useTwoCols = posArr.length > 1;

                      return (
                        <details key={aKey} open className="bg-slate-50 rounded-xl border-2 border-slate-300 overflow-hidden">
                          <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 hover:bg-slate-100">
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            {editMode && (
                              <input type="checkbox" checked={isAllSelected(allInArea)} onChange={() => selectAll(allInArea)} onClick={(e) => e.stopPropagation()} className="!w-3.5 !h-3.5 !p-0" />
                            )}
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-semibold text-slate-800 text-sm">{areaName(aGroup.areaId)}</span>
                            <span className="text-xs text-slate-500">({allInArea.length})</span>
                          </summary>

                          <div className="bg-white p-2">
                            <div className={useTwoCols ? "columns-2 gap-2" : ""}>
                              {posArr.map(([posKey, list]) => {
                                const posColor = positions.find((p) => p.name === posKey)?.color ?? "#64748B";
                                return (
                                  <div key={posKey} className={`rounded-lg border border-slate-200 overflow-hidden ${useTwoCols ? "break-inside-avoid mb-2 inline-block w-full" : ""}`}>
                                    <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: withAlpha(posColor, headerOpacity) }}>
                                      {editMode && (
                                        <input type="checkbox" checked={isAllSelected(list)} onChange={() => selectAll(list)} className="!w-3.5 !h-3.5 !p-0" />
                                      )}
                                      <Briefcase className="w-3.5 h-3.5 text-slate-900" />
                                      <span className="text-sm font-bold text-slate-900">{posKey === "__noPos__" ? "Без должности" : posKey}</span>
                                      <span className="text-[11px] text-slate-700 font-medium">({list.length})</span>
                                    </div>

                                    <div>
                                      {list.map((u) => (
                                        <div key={u.id} className="flex items-center gap-3 px-3 py-2 hover:brightness-95 transition-all border-b border-white/40 last:border-0" style={{ backgroundColor: withAlpha(posColor, rowOpacity) }}>
                                          {editMode && (
                                            <input type="checkbox" checked={selected.has(u.id)} onChange={() => tryToggle(u.id)} className="!w-4 !h-4 !p-0" />
                                          )}
                                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${getAvatarColor(u.id)}`}>
                                            {getInitials(u.name)}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-slate-900 text-sm truncate">
                                              {u.name}
                                              {u.id === currentUser?.id && <span className="ml-1 text-xs text-slate-500">(вы)</span>}
                                            </div>
                                            <div className="text-xs text-slate-600 truncate">{u.email}</div>
                                          </div>
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                                          {u.hourlyRate && (
                                            <span className="text-xs text-slate-800 font-medium whitespace-nowrap hidden sm:inline">
                                              {u.hourlyRate} {u.paymentType === "MONTHLY" ? "₽/мес" : "₽/ч"}
                                            </span>
                                          )}
                                          {u.employmentType === "GPH" && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">ГПХ</span>
                                          )}
                                          {editMode && (
                                            <div className="flex items-center gap-1 shrink-0">
                                              <button onClick={() => setEditingUser(u)} className="text-slate-600 hover:text-brand-700 p-1.5 rounded-lg bg-white/60 hover:bg-white" title="Редактировать">
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              {u.id !== currentUser?.id && (
                                                <button onClick={() => onDelete(u.id, u.name)} className="text-slate-600 hover:text-red-700 p-1.5 rounded-lg bg-white/60 hover:bg-white" title="Удалить">
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {viewMode === "matrix" && filtered.length > 0 && (
          <MatrixView
            users={filtered}
            locations={locations}
            areas={areas}
            positions={positions}
            headerOpacity={headerOpacity}
            rowOpacity={rowOpacity}
            editMode={matrixEditMode}
            pendingChanges={pendingChanges}
            saving={matrixSaving}
            onToggleArea={handleMatrixToggle}
            onEdit={(u) => setEditingUser(u)}
            onStartEdit={() => setMatrixEditMode(true)}
            onCancelEdit={onMatrixCancel}
            onApply={onMatrixApply}
          />
        )}
      </main>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          locations={locations}
          areas={areas}
          positions={positions}
          onClose={() => setEditingUser(null)}
          onSave={async (data) => {
            try {
              await update(editingUser.id, data);
              await fetch();
              await fetchAreas();
              setEditingUser(null);
            } catch (e: any) {
              await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
            }
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МАТРИЦА
// ═══════════════════════════════════════════════════════
function MatrixView({
  users, locations, areas, positions, headerOpacity, rowOpacity,
  editMode, pendingChanges, saving, onToggleArea, onEdit,
  onStartEdit, onCancelEdit, onApply,
}: {
  users: TeamUser[];
  locations: { id: string; name: string }[];
  areas: Area[];
  positions: { id: string; name: string; color: string }[];
  headerOpacity: number;
  rowOpacity: number;
  editMode: boolean;
  pendingChanges: Map<string, PendingUserChange>;
  saving: boolean;
  onToggleArea: (u: TeamUser, a: Area) => void;
  onEdit: (u: TeamUser) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onApply: () => void;
}) {
  const locationsWithAreas = useMemo(
    () => locations.filter((l) => areas.some((a) => a.locationId === l.id)),
    [locations, areas]
  );

  const areasByLoc = useMemo(() => {
    const map = new Map<string, Area[]>();
    for (const l of locationsWithAreas) {
      map.set(l.id, areas.filter((a) => a.locationId === l.id).sort((x, y) => x.name.localeCompare(y.name)));
    }
    return map;
  }, [areas, locationsWithAreas]);

  const totalAreaCols = Array.from(areasByLoc.values()).reduce((s, arr) => s + arr.length, 0);

  const groupedByPosition = useMemo(() => {
    const map = new Map<string, TeamUser[]>();
    for (const u of users) {
      const key = u.position || "__noPos__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    const entries = Array.from(map.entries());
    entries.sort(([a], [b]) => {
      if (a === "__noPos__") return 1;
      if (b === "__noPos__") return -1;
      return a.localeCompare(b);
    });
    return entries;
  }, [users]);

  if (locationsWithAreas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-900 mb-1">Нет локаций</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Создайте точки и локации в разделе «Шаблоны → Локации» — тогда здесь появится матрица привязок.
        </p>
      </div>
    );
  }

  const changedCount = pendingChanges.size;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2 flex-wrap">
        <LayoutGrid className="w-4 h-4 text-brand-600" />
        <span className="font-semibold text-slate-900 text-sm">Матрица привязок</span>
        <span className="text-xs text-slate-500">{users.length} сотр. · {totalAreaCols} локаций</span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {!editMode ? (
            <button onClick={onStartEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
              <Pencil className="w-3.5 h-3.5" /> Редактировать
            </button>
          ) : (
            <>
              <span className="text-[11px] text-slate-500 italic">Изменено: <b>{changedCount}</b></span>
              <button onClick={onCancelEdit} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                <X className="w-3.5 h-3.5" /> Отмена
              </button>
              <button onClick={onApply} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? <>Сохранение…</> : <><Check className="w-3.5 h-3.5" /> Сохранить ({changedCount})</>}
              </button>
            </>
          )}
        </div>
      </div>

      {!editMode && (
        <div className="px-4 py-2 bg-slate-100/60 border-b border-slate-200 text-[11px] text-slate-500">
          Для изменения привязок нажмите «Редактировать». В режиме просмотра чекбоксы некликабельны.
        </div>
      )}

      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-30">
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-40 bg-slate-100 border-r border-b border-slate-300 px-2 py-2 text-left font-semibold text-slate-900 min-w-[200px]">
                Пользователь
              </th>
              {locationsWithAreas.map((loc) => {
                const locAreas = areasByLoc.get(loc.id) ?? [];
                return (
                  <th key={loc.id} colSpan={locAreas.length} className="bg-slate-100 border-r border-b border-slate-300 px-2 py-2 text-center font-semibold text-slate-900">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      <MapPin className="w-3 h-3" /> {loc.name}
                      <span className="text-[10px] text-slate-500 font-normal">({locAreas.length})</span>
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr>
              {locationsWithAreas.flatMap((loc) =>
                (areasByLoc.get(loc.id) ?? []).map((a) => (
                  <th key={a.id} className="bg-slate-50 border-r border-b border-slate-300 px-1.5 py-1.5 text-center font-medium text-slate-700 min-w-[80px] text-[11px]" title={`${loc.name} · ${a.name}`}>
                    <div className="flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[70px] inline-block align-bottom">{a.name}</span>
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {groupedByPosition.map(([posKey, list]) => {
              const posColor = positions.find((p) => p.name === posKey)?.color ?? "#64748B";
              return (
                <Fragment key={posKey}>
                  <tr>
                    <td colSpan={1 + totalAreaCols} className="sticky left-0 z-20 border-r border-b border-slate-200 px-3 py-1.5" style={{ backgroundColor: withAlpha(posColor, headerOpacity) }}>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-900" />
                        <span className="text-sm font-bold text-slate-900">{posKey === "__noPos__" ? "Без должности" : posKey}</span>
                        <span className="text-[11px] text-slate-700 font-medium">({list.length})</span>
                      </div>
                    </td>
                  </tr>

                  {list.map((u) => {
                    const pending = pendingChanges.get(u.id);
                    const effectiveAreaIds = pending ? pending.areaIds : new Set(u.areaIds ?? []);
                    const effectiveLocationIds = pending ? pending.locationIds : new Set(u.locationIds ?? []);
                    const isChanged = !!pending;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 bg-white border-r border-b border-slate-200 px-2 py-1.5 min-w-[200px]" style={{ backgroundColor: withAlpha(posColor, rowOpacity) }}>
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 ${getAvatarColor(u.id)}`}>
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <button onClick={() => onEdit(u)} className="text-xs font-medium text-slate-900 truncate hover:text-brand-700 text-left w-full" title="Редактировать">
                                {u.name}
                                {isChanged && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" title="Есть несохранённые изменения" />}
                              </button>
                              <div className="text-[10px] text-slate-600 truncate">
                                {u.hourlyRate ? `${u.hourlyRate} ${u.paymentType === "MONTHLY" ? "₽/мес" : "₽/ч"}` : u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {locationsWithAreas.flatMap((loc) =>
                          (areasByLoc.get(loc.id) ?? []).map((a) => {
                            const checked = effectiveAreaIds.has(a.id);
                            const inPoint = effectiveLocationIds.has(a.locationId);

                            return (
                              <td
                                key={a.id}
                                className="p-1 text-center transition-all"
                                style={{
                                  backgroundColor: checked ? "#dcfce7" : undefined,
                                  boxShadow: checked ? "inset 0 0 0 2px #10b981" : undefined,
                                  borderRight: "1px solid #e2e8f0",
                                  borderBottom: "1px solid #e2e8f0",
                                }}
                              >
                                {editMode ? (
                                  <label className="inline-flex items-center justify-center cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={saving}
                                      onChange={() => onToggleArea(u, a)}
                                      className="!w-5 !h-5 !p-0 cursor-pointer accent-emerald-600 disabled:opacity-50 disabled:cursor-wait"
                                      title={checked ? `Убрать из «${a.name}»` : `Добавить в «${a.name}»${!inPoint ? ` (и в точку «${loc.name}»)` : ""}`}
                                    />
                                  </label>
                                ) : (
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-all ${
                                      checked ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-300 border border-slate-200"
                                    }`}
                                    title={checked ? "В локации" : "Не в локации"}
                                  >
                                    {checked ? (
                                      <Check className="w-4 h-4" strokeWidth={3} />
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МОДАЛКА РЕДАКТИРОВАНИЯ
// ═══════════════════════════════════════════════════════
function EditUserModal({
  user, locations, areas, positions, onClose, onSave,
}: {
  user: TeamUser;
  locations: { id: string; name: string }[];
  areas: { id: string; name: string; locationId: string }[];
  positions: { id: string; name: string; color: string }[];
  onClose: () => void;
  onSave: (data: Partial<{
    name: string;
    phone: string | null;
    role: "OWNER" | "MANAGER" | "EMPLOYEE";
    position: string | null;
    hourlyRate: string | null;
    paymentType: "HOURLY" | "MONTHLY";
    employmentType: "GPH" | "SHTAT";
    locationIds: string[];
    areaIds: string[];
  }>) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "EMPLOYEE">(user.role);
  const [position, setPosition] = useState(user.position ?? "");
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate ?? "");
  const [paymentType, setPaymentType] = useState<"HOURLY" | "MONTHLY">(user.paymentType ?? "HOURLY");
  const [employmentType, setEmploymentType] = useState<"GPH" | "SHTAT">(user.employmentType ?? "SHTAT");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [locationIds, setLocationIds] = useState<Set<string>>(new Set(user.locationIds ?? []));
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set(user.areaIds ?? []));
  const [activeAreaTab, setActiveAreaTab] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedLocations = useMemo(
    () => locations.filter((l) => locationIds.has(l.id)),
    [locations, locationIds]
  );

  const effectiveTab = useMemo(() => {
    if (selectedLocations.length === 0) return null;
    if (activeAreaTab && locationIds.has(activeAreaTab)) return activeAreaTab;
    return selectedLocations[0].id;
  }, [activeAreaTab, locationIds, selectedLocations]);

  const areasForTab = useMemo(() => {
    if (!effectiveTab) return [];
    return areas.filter((a) => a.locationId === effectiveTab);
  }, [areas, effectiveTab]);

  const toggleLocation = (id: string) => {
    setLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setAreaIds((prevAreas) => {
          const n = new Set(prevAreas);
          areas.filter((a) => a.locationId === id).forEach((a) => n.delete(a.id));
          return n;
        });
      } else next.add(id);
      return next;
    });
  };

  const toggleArea = (id: string) => {
    setAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        name, role,
        position: position.trim() || null,
        hourlyRate: hourlyRate.trim() || null,
        paymentType,
        employmentType,
        phone: phone.trim() || null,
        locationIds: Array.from(locationIds),
        areaIds: Array.from(areaIds),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Редактировать сотрудника</h3>
              <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Роль</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="MANAGER">Менеджер</option>
                <option value="OWNER">Владелец</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {paymentType === "HOURLY" ? "Ставка, ₽/ч" : "Оклад, ₽/мес"}
              </label>
              <input value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder={paymentType === "HOURLY" ? "350" : "50000"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Форма оплаты</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}>
                <option value="HOURLY">Почасовая</option>
                <option value="MONTHLY">Месячный оклад</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Трудоустройство</label>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as any)}>
                <option value="SHTAT">В штате</option>
                <option value="GPH">ГПХ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Должность</label>
            <div className="relative">
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="!pl-8">
                <option value="">Без должности</option>
                {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                {position && !positions.some((p) => p.name === position) && (
                  <option value={position}>{position} (не в шаблонах)</option>
                )}
              </select>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none" style={{ backgroundColor: positions.find((p) => p.name === position)?.color ?? "#E2E8F0" }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Точки</label>
            <div className="border border-slate-200 rounded-xl p-2 max-h-32 overflow-y-auto">
              {locations.length === 0 && <div className="text-xs text-slate-400 p-2">Нет точек.</div>}
              {locations.map((loc) => (
                <label key={loc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={locationIds.has(loc.id)} onChange={() => toggleLocation(loc.id)} className="!w-4 !h-4 !p-0" />
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-800">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Локации {selectedLocations.length > 0 && <span className="text-xs text-slate-500 font-normal">({areaIds.size} выбрано)</span>}
            </label>

            {selectedLocations.length === 0 ? (
              <div className="border border-slate-200 rounded-xl p-3 text-xs text-slate-400">
                Выберите хотя бы одну точку — покажем её локации.
              </div>
            ) : (
              <>
                <div className="flex gap-1 overflow-x-auto pb-1 mb-2">
                  {selectedLocations.map((loc) => {
                    const active = effectiveTab === loc.id;
                    const countSelected = areas.filter((a) => a.locationId === loc.id && areaIds.has(a.id)).length;
                    return (
                      <button key={loc.id} type="button" onClick={() => setActiveAreaTab(loc.id)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}>
                        <MapPin className="w-3 h-3" /> {loc.name}
                        {countSelected > 0 && (
                          <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-white text-brand-600"}`}>
                            {countSelected}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto">
                  {areasForTab.length === 0 ? (
                    <div className="text-xs text-slate-400 p-2">В этой точке пока нет локаций.</div>
                  ) : (
                    areasForTab.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={areaIds.has(a.id)} onChange={() => toggleArea(a.id)} className="!w-4 !h-4 !p-0" />
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-800">{a.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Телефон</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium">
              <Save className="w-4 h-4" />
              {busy ? "Сохранение..." : "Сохранить"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}