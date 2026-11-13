import { useEffect, useState, useMemo, Fragment } from "react";
import {
  UserPlus, Search, Trash2, X, Check, Pencil, Save,
  MapPin, Briefcase, Layers, ChevronDown,
  FileSpreadsheet, Upload, Users as UsersIcon,
  LayoutList, LayoutGrid, HelpCircle, Send, Info, Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useUsers } from "../store/users";
import { usersApi } from "../api/users";
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
import { useDragScroll } from "../hooks/useDragScroll";

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
  | "setPosition"
  | "setRate"
  | "setRole"
  | "setPaymentType"
  | "setEmploymentType"
  | "delete";

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

  // По умолчанию матрица
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");

  // Фильтры
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // Выделение (работает только в матрице)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  // Импорт Excel
  const [importing, setImporting] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  // Создание
  const [showForm, setShowForm] = useState(false);
  const [createdUserData, setCreatedUserData] = useState<{ id: string; name: string; email: string; tempPassword: string } | null>(null);
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
  const [managePosOpen, setManagePosOpen] = useState(false);

  // Матрица
  const [matrixEditMode, setMatrixEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingUserChange>>(new Map());
  const [matrixSaving, setMatrixSaving] = useState(false);

  useEffect(() => {
    fetch();
    fetchLocations();
    fetchAreas();
    fetchPositions();
  }, [fetch, fetchLocations, fetchAreas, fetchPositions]);

  const toggleViewMode = () => {
    setViewMode((v) => (v === "matrix" ? "groups" : "matrix"));
    setSelected(new Set());
    setBulkAction("");
    setBulkValue("");
    setMatrixEditMode(false);
    setPendingChanges(new Map());
    setSearch("");
    setFilterLocation("");
    setFilterArea("");
    setFilterPosition("");
    setFilterRole("");
  };

  // ─── Логика фильтров (каскадная) ─────────────────

  // 1. Доступные локации (зависят от точки и выбранной должности)
  const availableAreaNames = useMemo(() => {
    let sourceAreas = areas;
    
    if (filterLocation) {
      sourceAreas = sourceAreas.filter((a) => a.locationId === filterLocation);
    }
    
    if (filterPosition) {
      // Если выбрана должность, показываем только те локации, где есть сотрудники с этой должностью
      const validAreaIds = new Set<string>();
      items.forEach((u) => {
        if (u.position === filterPosition) {
          (u.areaIds ?? []).forEach((id) => validAreaIds.add(id));
        }
      });
      sourceAreas = sourceAreas.filter((a) => validAreaIds.has(a.id));
    }

    const names = new Set(sourceAreas.map((a) => a.name.trim()));
    return Array.from(names).sort();
  }, [areas, filterLocation, filterPosition, items]);

  // 2. Доступные должности (зависят от точки и выбранной локации)
  const availablePositionsList = useMemo(() => {
    let sourceUsers = items;
    
    if (filterLocation) {
      sourceUsers = sourceUsers.filter((u) => (u.locationIds ?? []).includes(filterLocation));
    }
    
    if (filterArea) {
      sourceUsers = sourceUsers.filter((u) =>
        (u.areaIds ?? []).some((id) => areas.find((a) => a.id === id)?.name === filterArea)
      );
    }

    const names = new Set(sourceUsers.map((u) => u.position).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [items, areas, filterLocation, filterArea]);

  // 3. Сброс фильтров, если они стали недоступны
  useEffect(() => {
    if (filterArea && !availableAreaNames.includes(filterArea)) {
      setFilterArea("");
    }
    if (filterPosition && !availablePositionsList.includes(filterPosition)) {
      setFilterPosition("");
    }
  }, [availableAreaNames, availablePositionsList, filterArea, filterPosition]);

  const handleFilterLocationChange = (locId: string) => {
    setFilterLocation(locId);
    setFilterArea(""); // Сбрасываем локацию при смене точки
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
      
      if (filterArea) {
        const hasArea = (u.areaIds ?? []).some(
          (id) => areas.find((a) => a.id === id)?.name === filterArea
        );
        if (!hasArea) return false;
      }
      
      if (filterPosition && (u.position ?? "") !== filterPosition) return false;
      if (filterRole && u.role !== filterRole) return false;
      return true;
    });
  }, [items, search, filterLocation, filterArea, filterPosition, filterRole, areas]);

  const grouped = useMemo(() => {
    type PosGroup = Map<string, TeamUser[]>;
    type AreaGroup = { areaId: string | null; positions: PosGroup };
    type LocGroup = { locationId: string | null; areas: Map<string, AreaGroup> };
    const map = new Map<string, LocGroup>();

    const areaLocMap = new Map<string, string>();
    for (const a of areas) areaLocMap.set(a.id, a.locationId);

    for (const u of filtered) {
      let locIds: (string | null)[] = [];
      if (filterLocation) {
        locIds = [filterLocation];
      } else {
        locIds = u.locationIds && u.locationIds.length > 0 ? u.locationIds : [null];
      }

      for (const locId of locIds) {
        const lKey = locId ?? "__noLoc__";
        if (!map.has(lKey)) map.set(lKey, { locationId: locId, areas: new Map() });
        const lG = map.get(lKey)!;

        let areaIds: (string | null)[] = [];
        if (filterArea) {
          const matchingId = (u.areaIds ?? []).find(
            (id) => areas.find((a) => a.id === id)?.name === filterArea
          );
          if (matchingId) {
            areaIds = [matchingId];
          } else {
            const fallbackArea = areas.find((a) => a.name === filterArea);
            areaIds = fallbackArea ? [fallbackArea.id] : [];
          }
        } else {
          const userAreaIds = (u.areaIds ?? []).filter((id) => {
            const aLoc = areaLocMap.get(id);
            return locId === null || aLoc === locId;
          });
          areaIds = userAreaIds.length > 0 ? userAreaIds : [null];
        }

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
  }, [filtered, areas, filterLocation, filterArea]);

  const locationName = (id: string | null): string =>
    id ? locations.find((l) => l.id === id)?.name ?? "—" : "Без точки";
  const areaName = (id: string | null): string =>
    id ? areas.find((a) => a.id === id)?.name ?? "—" : "Без локации";

  // ─── Логика Матрицы ──────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => u.id)));
    }
  };

  const toggleSelectPosition = (users: TeamUser[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = users.every((u) => next.has(u.id));
      users.forEach((u) => {
        if (allSelected) next.delete(u.id);
        else next.add(u.id);
      });
      return next;
    });
  };

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
    if (pendingChanges.size === 0 && selected.size === 0) {
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
    setSelected(new Set());

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
    setSelected(new Set());
  };

  // ─── Создание и Удаление ─────────────────────────
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
        setCreatedUserData({
          id: result.user.id,
          name: createForm.name,
          email: createForm.email,
          tempPassword: result.tempPassword
        });
      }

      setCreateForm({
        name: "", email: "", role: "EMPLOYEE", position: "",
        hourlyRate: "", paymentType: "HOURLY", employmentType: "SHTAT", phone: "",
      });
      setShowForm(false);
    } catch (e: any) {
      let msg = "Не удалось создать сотрудника. Попробуйте позже.";
      
      // Обработка конкретных статусов
      if (e.response?.status === 409) {
        msg = "Сотрудник с таким Email уже существует. Пожалуйста, укажите другой Email.";
      } else if (e.response?.status === 403) {
            const ok = await confirmDialog(
              "Доступно только для Pro.\n\nВы достигли лимита сотрудников на бесплатном тарифе (макс. 3). Разблокировать функции на 14 дней?",
              { title: "Лимит тарифа", confirmLabel: "Разблокировать" }
            );
            if (ok) {
              window.location.href = "/wallet?trial=true";
              return;
            }
            msg = "Создание отменено.";
          } else if (e.response?.data?.error) {
        msg = typeof e.response.data.error === "string" 
                ? e.response.data.error 
                : JSON.stringify(e.response.data.error);
      }

      if (msg !== "Создание отменено.") {
        if (msg !== "Создание отменено.") {
            await alertDialog(msg, { title: "Ошибка создания", variant: "error" });
          }
      }
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

  // ─── Excel ───────────────────────────────────────
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

  // ─── Массовые действия ───────────────────────────
  const onBulkApply = async () => {
    if (!bulkAction || (bulkAction !== "delete" && !bulkValue) || selected.size === 0) return;
    if (bulkAction === "setRole" && !["OWNER", "MANAGER", "EMPLOYEE"].includes(bulkValue)) return;
    if (bulkAction === "setPaymentType" && !["HOURLY", "MONTHLY"].includes(bulkValue)) return;
    if (bulkAction === "setEmploymentType" && !["GPH", "SHTAT"].includes(bulkValue)) return;
    if (bulkAction === "delete") {
      const ok = await confirmDialog(`Удалить выбранных сотрудников (${selected.size})? Это действие нельзя отменить.`, { title: "Удаление", variant: "danger", confirmLabel: "Удалить" });
      if (!ok) return;
    }

    setBulkBusy(true);
    try {
      if (bulkAction === "delete") {
        for (const id of Array.from(selected)) {
          await remove(id);
        }
        setSelected(new Set());
        setBulkAction("");
        setBulkValue("");
      } else {
        await bulkUpdate(Array.from(selected), {
          action: bulkAction, value: bulkValue,
        } as any);
        setSelected(new Set());
        setBulkAction("");
        setBulkValue("");
      }
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", { variant: "error" });
    } finally {
      setBulkBusy(false);
    }
  };

  // ─── Видимые столбцы для матрицы ─────────────────
  const visibleLocations = useMemo(() => {
    if (filterLocation) return locations.filter((l) => l.id === filterLocation);
    if (filterArea) {
      const locIds = new Set(areas.filter(a => a.name === filterArea).map(a => a.locationId));
      return locations.filter(l => locIds.has(l.id));
    }
    if (filterPosition) {
      const locIds = new Set<string>();
      items.forEach(u => {
        if (u.position === filterPosition) {
          (u.locationIds ?? []).forEach(id => locIds.add(id));
        }
      });
      return locations.filter(l => locIds.has(l.id));
    }
    return locations;
  }, [locations, areas, filterArea, filterLocation, filterPosition, items]);

  const visibleAreas = useMemo(() => {
    if (filterArea) return areas.filter((a) => a.name === filterArea);
    if (filterLocation) return areas.filter((a) => a.locationId === filterLocation);
    if (filterPosition) {
      const areaIds = new Set<string>();
      items.forEach(u => {
        if (u.position === filterPosition) {
          (u.areaIds ?? []).forEach(id => areaIds.add(id));
        }
      });
      return areas.filter(a => areaIds.has(a.id));
    }
    return areas;
  }, [areas, filterArea, filterLocation, filterPosition, items]);

  const anyFilter = !!(search || filterLocation || filterArea || filterPosition || filterRole);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {org?.tariffId === "free" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="font-bold text-blue-900 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Тариф Free: {filtered.length} из 4 сотрудников
              </div>
              <p className="text-xs text-blue-700 mt-1">
                На бесплатном тарифе доступно не более 4 сотрудников и 1 точка. А также нет уведомлений в MAX.
              </p>
            </div>
            <Link
              to="/wallet?trial=true"
              className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
            >
              Разблокировать Pro
            </Link>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Шапка */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Сотрудники</h1>
            <p className="text-sm text-slate-500 mt-1">Команда, точки, локации и должности</p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={toggleViewMode}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all border ${
                viewMode === "groups"
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <LayoutList className="w-4 h-4" />
              Группы
            </button>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              {showForm ? <><X className="w-4 h-4" /> Отмена</> : <><UserPlus className="w-4 h-4" /> Добавить</>}
            </button>
          </div>
        </div>

        {/* Зеленый баннер-подсказка */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-start gap-3 shadow-sm animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-sm flex-1">
            <div className="font-semibold text-emerald-900 mb-1">
              Личный кабинет сотрудника
            </div>
            <div className="text-emerald-700 leading-relaxed">
              Каждый сотрудник может зайти в свой профиль под своей почтой и паролем, чтобы увидеть свое личное расписание, согласовывать изменение смен, больничных, добавлять свой отпуск, получать оповещения и много другое. Почта и пароль каждого сотрудника находятся в настройках (карточке) сотрудника.
            </div>
          </div>
        </div>

        {/* Импорт из Excel */}
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

        {/* Форма создания */}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">Должность</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setManagePosOpen(true)} className="text-brand-600 hover:bg-brand-50 p-1 rounded transition-colors" title="Управлять должностями">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <div className="group relative flex items-center">
                        <HelpCircle className="w-4 h-4 text-slate-400 hover:text-brand-600 cursor-help transition-colors" />
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none leading-relaxed">
                          Создавать и редактировать должности можно в разделе «Шаблоны» → «Должности».
                        </div>
                      </div>
                    </div>
                  </div>
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
              <p className="text-xs text-slate-500">После создания точки и локации назначаются в матрице или карточке сотрудника.</p>
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

        {/* ФИЛЬТРЫ (общие для обеих вкладок) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, email, должности..."
              className="!pl-9"
            />
          </div>
          
          {/* Выбор точки */}
          <select value={filterLocation} onChange={(e) => handleFilterLocationChange(e.target.value)} className="!w-auto">
            <option value="">Все точки</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          
          {/* Выбор локации (плоский список) */}
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="!w-auto">
            <option value="">Все локации</option>
            {availableAreaNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          {/* Выбор должности */}
          <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="!w-auto">
            <option value="">Все должности</option>
            {availablePositionsList.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
          
          {/* Выбор роли */}
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="!w-auto">
            <option value="">Все роли</option>
            <option value="OWNER">Владелец</option>
            <option value="MANAGER">Менеджер</option>
            <option value="EMPLOYEE">Сотрудник</option>
          </select>
          
          {anyFilter && (
            <button
              onClick={() => { setSearch(""); setFilterLocation(""); setFilterArea(""); setFilterPosition(""); setFilterRole(""); }}
              className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* РЕЖИМ: ГРУППЫ                                     */}
        {/* ═══════════════════════════════════════════════════ */}
        {viewMode === "groups" && (
          <>
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

            {filtered.length > 0 && (
              <div className="space-y-3">
                {Array.from(grouped.entries()).map(([lKey, lGroup]) => {
                  const allInLoc = Array.from(lGroup.areas.values()).flatMap((aG) => Array.from(aG.positions.values()).flat());
                  return (
                    <details key={lKey} open className="bg-white rounded-2xl border-2 border-slate-400 shadow-sm overflow-hidden">
                      <summary className="cursor-pointer px-4 py-3 bg-slate-100 hover:bg-slate-200 border-b-2 border-slate-400 flex items-center gap-2">
                        <ChevronDown className="w-4 h-4 text-slate-600" />
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
                                          <Briefcase className="w-3.5 h-3.5 text-slate-900" />
                                          <span className="text-sm font-bold text-slate-900">{posKey === "__noPos__" ? "Без должности" : posKey}</span>
                                          <span className="text-[11px] text-slate-700 font-medium">({list.length})</span>
                                        </div>

                                        <div>
                                          {list.map((u) => (
                                            <div key={u.id} className="flex items-center gap-3 px-3 py-2 transition-all border-b border-white/40 last:border-0" style={{ backgroundColor: withAlpha(posColor, rowOpacity) }}>
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
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* РЕЖИМ: МАТРИЦА                                    */}
        {/* ═══════════════════════════════════════════════════ */}
        {viewMode === "matrix" && (
          <div className="space-y-4">
            {matrixEditMode && (
              <div className="sticky top-[70px] z-20 bg-white border-2 border-brand-300 rounded-2xl p-3 flex items-center gap-3 flex-wrap shadow-lg animate-fade-in mb-4">
                <span className="text-sm font-medium text-brand-900">Выбрано: <b>{selected.size}</b></span>
                <select 
                  value={bulkAction} 
                  onChange={(e) => { setBulkAction(e.target.value as BulkAction); setBulkValue(""); }} 
                  className="!w-auto"
                  disabled={selected.size === 0}
                >
                  <option value="">— Действие —</option>
                  <option value="setPosition">Установить должность</option>
                  <option value="setRate">Изменить ставку/оклад</option>
                  <option value="setPaymentType">Изменить форму оплаты</option>
                  <option value="setEmploymentType">Изменить трудоустройство</option>
                  <option value="setRole">Изменить роль</option>
                  <option value="delete" className="text-red-600 font-medium">Удалить выбранных</option>
                </select>

                {bulkAction === "setPosition" && (
                  <>
                    <input list="bulk-positions" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Название должности" className="!w-48" disabled={selected.size === 0} />
                    <datalist id="bulk-positions">{positions.map((p) => <option key={p.id} value={p.name} />)}</datalist>
                  </>
                )}

                {bulkAction === "setRate" && (
                  <input type="number" step="0.01" min="0" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="₽" className="!w-32" disabled={selected.size === 0} />
                )}

                {bulkAction === "setPaymentType" && (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto" disabled={selected.size === 0}>
                    <option value="">— Форма —</option>
                    <option value="HOURLY">Почасовая</option>
                    <option value="MONTHLY">Месячный оклад</option>
                  </select>
                )}

                {bulkAction === "setEmploymentType" && (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto" disabled={selected.size === 0}>
                    <option value="">— Тип —</option>
                    <option value="SHTAT">В штате</option>
                    <option value="GPH">ГПХ</option>
                  </select>
                )}

                {bulkAction === "setRole" && (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="!w-auto" disabled={selected.size === 0}>
                    <option value="">— Роль —</option>
                    <option value="OWNER">Владелец</option>
                    <option value="MANAGER">Менеджер</option>
                    <option value="EMPLOYEE">Сотрудник</option>
                  </select>
                )}

                <button onClick={onBulkApply} disabled={selected.size === 0 || !bulkAction || (bulkAction !== "delete" && !bulkValue) || bulkBusy} className="bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium">
                  {bulkBusy ? "..." : "Применить"}
                </button>
                <button onClick={() => setSelected(new Set())} disabled={selected.size === 0} className="text-sm text-slate-600 hover:bg-white px-3 py-1.5 rounded-lg disabled:opacity-40">
                  Сбросить
                </button>
              </div>
            )}

            <MatrixView
              users={filtered}
              locations={visibleLocations}
              areas={visibleAreas}
              positions={positions}
              headerOpacity={headerOpacity}
              rowOpacity={rowOpacity}
              editMode={matrixEditMode}
              pendingChanges={pendingChanges}
              saving={matrixSaving}
              onToggleArea={handleMatrixToggle}
              onEdit={(u) => setEditingUser(u)}
              onDelete={onDelete}
              onStartEdit={() => setMatrixEditMode(true)}
              onCancelEdit={onMatrixCancel}
              onApply={onMatrixApply}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelectPosition={toggleSelectPosition}
            />
          </div>
        )}
      </main>

      {createdUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setCreatedUserData(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">Сотрудник создан!</h3>
                  <p className="text-sm text-slate-500">{createdUserData.name}</p>
                </div>
              </div>
              <button onClick={() => setCreatedUserData(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Временный пароль:</div>
              <div className="font-mono font-bold text-lg text-brand-600 select-all">{createdUserData.tempPassword}</div>
              <div className="text-xs text-slate-500 mt-3 mb-1">Email:</div>
              <div className="text-sm font-medium text-slate-900 select-all">{createdUserData.email}</div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await usersApi.sendPasswords([createdUserData.id]);
            if (res.sent === 0) throw new Error("Письмо не отправлено сервером.");
                    await alertDialog("Пароль успешно отправлен на почту!", { variant: "success" });
                    setCreatedUserData(null);
                  } catch (err: any) {
                    const errorMsg = err.response?.data?.error || err.message || "Проверьте настройки SMTP в .env";
                    await alertDialog(`Ошибка отправки: ${errorMsg}`, { title: "Ошибка", variant: "error" });
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
                Отправить на почту
              </button>
              <button
                onClick={() => setCreatedUserData(null)}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-200 text-sm font-medium transition-all"
              >
                ОК
              </button>
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 animate-fade-in">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-blue-900 font-medium leading-relaxed">
                Временные пароли всех сотрудников всегда можно посмотреть в настройках профиля в разделе <b>«Доступы и пароли»</b>.
              </p>
            </div>
          </div>
        </div>
      )}

      {managePosOpen && (
        <ManageTemplatesModal type="position" onClose={() => setManagePosOpen(false)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          locations={locations}
          areas={areas}
          positions={positions}
          onClose={() => setEditingUser(null)}
          onDelete={() => {
            onDelete(editingUser.id, editingUser.name);
            setEditingUser(null);
          }}
          onSave={async (data) => {
            try {
              const res = await update(editingUser.id, data);
              await fetch();
              await fetchAreas();
              setEditingUser(null);
              
              if (res && res.tempPassword) {
                if (confirm(`Сотруднику сгенерирован новый пароль: ${res.tempPassword}\n\nОтправить его сотруднику на почту?`)) {
                   try {
                     await usersApi.sendPasswords([editingUser.id]);
                     await alertDialog("Пароль успешно отправлен!", { variant: "success" });
                   } catch (e: any) {
                     await alertDialog("Ошибка отправки: " + (e.message || "неизвестно"), { variant: "error" });
                   }
                }
              }
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
  editMode, pendingChanges, saving, onToggleArea, onEdit, onDelete,
  onStartEdit, onCancelEdit, onApply,
  selected, onToggleSelect, onToggleSelectAll, onToggleSelectPosition,
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
  onDelete: (id: string, name: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onApply: () => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleSelectPosition: (users: TeamUser[]) => void;
}) {
  const dragScroll = useDragScroll<HTMLDivElement>();
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



  const changedCount = pendingChanges.size;
  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  return (
    <div className="space-y-4">
      {locationsWithAreas.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 leading-relaxed">
            <b>Локации еще не созданы.</b> Вы можете добавлять сотрудников и управлять ими, но чтобы распределить их по точкам и локациям, создайте их по пути:{" "}
            Расписание → <Link to="/templates" className="font-bold underline hover:text-amber-900 transition-colors">Шаблоны</Link> →{" "}
            <Link to="/templates?tab=areas" className="font-bold underline hover:text-amber-900 transition-colors">Локации</Link>.{" "}
            После этого здесь появится матрица привязок.
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2 flex-wrap">
          <LayoutGrid className="w-4 h-4 text-brand-600" />
        <span className="font-semibold text-slate-900 text-sm">Матрица привязок</span>
        <span className="text-xs text-slate-500">{users.length} сотр. · {totalAreaCols} локаций</span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {!editMode ? (
            <button onClick={onStartEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
              <Pencil className="w-3.5 h-3.5" /> Редактировать привязки
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

      <div
        ref={dragScroll.ref}
        onMouseDown={dragScroll.onMouseDown}
        onMouseLeave={dragScroll.onMouseLeave}
        onMouseUp={dragScroll.onMouseUp}
        onMouseMove={dragScroll.onMouseMove}
        className="overflow-auto max-h-[65vh]"
        style={dragScroll.style}
      >
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-30">
            <tr>
              {editMode && (
                <th rowSpan={2} className="sticky left-0 top-0 z-40 bg-slate-100 border-r border-b border-slate-300 p-2 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="!w-4 !h-4 !p-0 cursor-pointer accent-brand-600"
                    title="Выбрать всех"
                  />
                </th>
              )}
              
              <th 
                rowSpan={2} 
                className="sticky top-0 z-40 bg-slate-100 border-r border-b border-slate-300 px-2 py-2 text-left font-semibold text-slate-900 min-w-[200px]" 
                style={{ left: editMode ? 40 : 0 }}
              >
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
                  <th key={a.id} className="bg-slate-50 border-r border-b border-slate-300 px-1.5 py-1.5 text-center font-medium text-slate-700 min-w-[110px] text-[11px]" title={`${loc.name} · ${a.name}`}>
                    <div className="flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[130px] inline-block align-bottom">{a.name}</span>
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {groupedByPosition.map(([posKey, list]) => {
              const posColor = positions.find((p) => p.name === posKey)?.color ?? "#64748B";
              const allPosSelected = list.length > 0 && list.every((u) => selected.has(u.id));
              
              return (
                <Fragment key={posKey}>
                  <tr>
                    {editMode && (
                      <td className="sticky left-0 z-20 border-r border-b border-slate-200 p-2 text-center w-10" style={{ backgroundColor: withAlpha(posColor, headerOpacity) }}>
                        <input
                          type="checkbox"
                          checked={allPosSelected}
                          onChange={() => onToggleSelectPosition(list)}
                          className="!w-4 !h-4 !p-0 cursor-pointer accent-brand-600"
                          title="Выбрать всех в должности"
                        />
                      </td>
                    )}
                    <td colSpan={1 + totalAreaCols} className="sticky z-20 border-r border-b border-slate-200 px-3 py-1.5" style={{ left: editMode ? 40 : 0, backgroundColor: withAlpha(posColor, headerOpacity) }}>
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
                    const isChanged = !!pending;
                    const isSelected = selected.has(u.id);

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/50 ${isSelected ? "bg-brand-50/20" : ""}`}>
                        {editMode && (
                          <td className="sticky left-0 z-10 border-r border-b border-slate-200 p-2 text-center w-10" style={{ backgroundColor: isSelected ? "#f0f9ff" : withAlpha(posColor, rowOpacity) }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(u.id)}
                              className="!w-4 !h-4 !p-0 cursor-pointer accent-brand-600"
                            />
                          </td>
                        )}
                        
                        <td 
                          className="sticky z-10 border-r border-b border-slate-200 px-2 py-1.5 min-w-[200px]" 
                          style={{ left: editMode ? 40 : 0, backgroundColor: isSelected ? "#f0f9ff" : withAlpha(posColor, rowOpacity) }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold shrink-0 ${getAvatarColor(u.id)}`}>
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0 flex-1 flex items-center justify-between group/name">
                              <div className="min-w-0">
                                <button onClick={() => onEdit(u)} className="text-xs font-medium text-slate-900 truncate hover:text-brand-700 text-left w-full" title="Редактировать">
                                  {u.name}
                                  {isChanged && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" title="Есть несохранённые изменения" />}
                                </button>
                                <div className="text-[10px] text-slate-600 truncate">
                                  {u.hourlyRate ? `${u.hourlyRate} ${u.paymentType === "MONTHLY" ? "₽/мес" : "₽/ч"}` : u.email}
                                </div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(u.id, u.name); }} 
                                className="opacity-0 group-hover/name:opacity-100 text-slate-300 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-all shrink-0 ml-1" 
                                title="Удалить сотрудника"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {locationsWithAreas.flatMap((loc) =>
                          (areasByLoc.get(loc.id) ?? []).map((a) => {
                            const checked = effectiveAreaIds.has(a.id);
                            return (
                              <td
                                key={a.id}
                                className="p-1 text-center transition-all"
                                style={{
                                  backgroundColor: checked ? "#dcfce7" : (isSelected ? "#f0f9ff" : undefined),
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
                                    />
                                  </label>
                                ) : (
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-all ${
                                      checked ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-300 border border-slate-200"
                                    }`}
                                  >
                                    {checked ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МОДАЛКА РЕДАКТИРОВАНИЯ
// ═══════════════════════════════════════════════════════
function EditUserModal({
  user, locations, areas, positions, onClose, onSave, onDelete,
}: {
  user: TeamUser;
  locations: { id: string; name: string }[];
  areas: { id: string; name: string; locationId: string }[];
  positions: { id: string; name: string; color: string }[];
  onClose: () => void;
  onDelete?: () => void;
  onSave: (data: Partial<{
    name: string;
    email: string;
    phone: string | null;
    role: "OWNER" | "MANAGER" | "EMPLOYEE";
    position: string | null;
    hourlyRate: string | null;
    paymentType: "HOURLY" | "MONTHLY";
    employmentType: "GPH" | "SHTAT";
    locationIds: string[];
    areaIds: string[];
    tempPassword?: string | null;
  }>) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "EMPLOYEE">(user.role);
  const [position, setPosition] = useState(user.position ?? "");
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate ?? "");
  const [paymentType, setPaymentType] = useState<"HOURLY" | "MONTHLY">(user.paymentType ?? "HOURLY");
  const [employmentType, setEmploymentType] = useState<"GPH" | "SHTAT">(user.employmentType ?? "SHTAT");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [tempPassword, setTempPassword] = useState(user.tempPassword ?? "");
  const [managePosOpen, setManagePosOpen] = useState(false);
  const [manageAreaOpen, setManageAreaOpen] = useState(false);
  const [locationIds, setLocationIds] = useState<Set<string>>(new Set(user.locationIds ?? []));
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set(user.areaIds ?? []));
  const [activeAreaTab, setActiveAreaTab] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const org = useOrganization((s) => s.org);

  // Автоматически ставим галочку на первую точку, если тариф Free
  useEffect(() => {
    if (org?.tariffId === "free" && locations.length > 0) {
      setLocationIds(prev => {
        if (prev.has(locations[0].id)) return prev;
        const next = new Set(prev);
        next.add(locations[0].id);
        return next;
      });
    }
  }, [org, locations]);

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
        name, email, role,
        position: position.trim() || null,
        hourlyRate: hourlyRate.trim() || null,
        paymentType,
        employmentType,
        phone: phone.trim() || null,
        locationIds: Array.from(locationIds),
        areaIds: Array.from(areaIds),
        tempPassword: tempPassword.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
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

<form onSubmit={submit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-0 gap-y-8">
            
            {/* ЛЕВАЯ КОЛОНКА: ЛИЧНЫЕ ДАННЫЕ */}
            <div className="space-y-5 md:border-r md:border-slate-200 md:pr-8">
              <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4 text-sm uppercase tracking-wide">
                Личные данные
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Имя</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (для доступа к сайту)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Временный пароль
                </label>
                <input
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Оставьте пустым, чтобы не менять"
                  className="w-full font-mono text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Если изменить пароль, сотруднику нужно будет сообщить новый.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Телефон</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" />
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА: РАБОЧИЕ НАСТРОЙКИ */}
            <div className="space-y-6 md:pl-8">
              <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4 text-sm uppercase tracking-wide">
                Рабочие настройки
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Должность</label>
                  <button type="button" onClick={() => setManagePosOpen(true)} className="text-brand-600 hover:bg-brand-50 p-1 rounded transition-colors" title="Управлять должностями">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                  {locations.map((loc, idx) => {
                    const isFirstFree = org?.tariffId === "free" && idx === 0;
                    const isChecked = isFirstFree ? true : locationIds.has(loc.id);
                    return (
                      <label key={loc.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isFirstFree ? 'cursor-not-allowed opacity-75' : 'hover:bg-slate-50 cursor-pointer'}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => !isFirstFree && toggleLocation(loc.id)} disabled={isFirstFree} className="!w-4 !h-4 !p-0" />
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-800">{loc.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Локации {selectedLocations.length > 0 && <span className="text-xs text-slate-500 font-normal">({areaIds.size} выбрано)</span>}
                  </label>
                  <button type="button" onClick={() => setManageAreaOpen(true)} className="text-brand-600 hover:bg-brand-50 p-1 rounded transition-colors" title="Управлять локациями">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

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
            </div>
          </div>

          <div className="flex gap-2 pt-6 border-t border-slate-100">
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

      {managePosOpen && (
        <ManageTemplatesModal type="position" onClose={() => setManagePosOpen(false)} />
      )}
      {manageAreaOpen && (
        <ManageTemplatesModal type="area" onClose={() => setManageAreaOpen(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// МОДАЛКА УПРАВЛЕНИЯ ШАБЛОНАМИ (Должности / Локации)
// ═══════════════════════════════════════════════════════
function ManageTemplatesModal({ type, onClose }: { type: 'position' | 'area', onClose: () => void }) {
  const { items: positions, create: createPos, update: updatePos, remove: removePos } = usePositions();
  const { items: areas, create: createArea, update: updateArea, remove: removeArea } = useAreas();
  const { items: locations } = useLocations();
  const [newName, setNewName] = useState("");
  const [selectedLocId, setSelectedLocId] = useState(locations[0]?.id || "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (type === 'area' && locations.length > 0 && !selectedLocId) {
      setSelectedLocId(locations[0].id);
    }
  }, [type, locations, selectedLocId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      if (type === 'position') {
        await createPos({ name: newName.trim() });
      } else {
        if (!selectedLocId) return alert("Сначала создайте точку");
        await createArea({ name: newName.trim(), locationId: selectedLocId });
      }
      setNewName("");
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить "${name}"?`)) return;
    try {
      if (type === 'position') await removePos(id);
      else await removeArea(id);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка");
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      if (type === 'position') await updatePos(editingId, { name: editName.trim() });
      else await updateArea(editingId, { name: editName.trim() });
      setEditingId(null);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка");
    }
  };

  const currentList = type === 'position' 
    ? positions 
    : areas.filter(a => a.locationId === selectedLocId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg">
            Управление {type === 'position' ? 'должностями' : 'локациями'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {type === 'area' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Выберите точку</label>
            <select value={selectedLocId} onChange={e => setSelectedLocId(e.target.value)} className="!text-sm !py-2">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder={type === 'position' ? "Новая должность" : "Новая локация"} 
            className="!text-sm !py-2 flex-1" 
          />
          <button type="submit" disabled={busy || !newName.trim()} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {currentList.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Список пуст</p>}
          {currentList.map(item => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
              {editingId === item.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="!text-sm !py-1 !px-2 flex-1" autoFocus />
                  <button type="button" onClick={saveEdit} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    {type === 'position' && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: (item as any).color }} />}
                    <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => startEdit(item)} className="text-slate-400 hover:text-brand-600 p-1.5 rounded-md hover:bg-brand-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(item.id, item.name)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
