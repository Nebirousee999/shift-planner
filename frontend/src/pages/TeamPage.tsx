import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus,
  Search,
  Trash2,
  X,
  Mail,
  Phone,
  Coins,
  Users as UsersIcon,
  FileSpreadsheet,
  Upload,
  Check,
  Pencil,
  Save,
} from "lucide-react";
import { useUsers } from "../store/users";
import { useAuth } from "../store/auth";
import NavBar from "../components/NavBar";
import type { TeamUser } from "../api/users";
import { alertDialog, confirmDialog } from "../store/dialogs";

const schema = z.object({
  name: z.string().min(2, "Минимум 2 символа").max(255),
  email: z.string().email("Некорректный email"),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]),
  position: z.string().max(255).optional().or(z.literal("")),
  hourlyRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Только цифры, например 350 или 350.50")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(20).optional(),
});

type Form = z.infer<typeof schema>;

const editSchema = z.object({
  name: z.string().min(2, "Минимум 2 символа").max(255),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]),
  position: z.string().max(255).optional().or(z.literal("")),
  hourlyRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Только цифры")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(20).optional(),
});

type EditForm = z.infer<typeof editSchema>;

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
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const { items, loading, error, fetch, create, remove, update, downloadExcelTemplate, importFromExcel } = useUsers();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  // Импорт Excel
  const [importing, setImporting] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  // Редактирование
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      role: "EMPLOYEE",
      position: "",
      hourlyRate: "",
      phone: "",
    },
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  const onSubmit = async (data: Form) => {
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        role: data.role,
      };
      if (data.position) payload.position = data.position;
      if (data.hourlyRate) payload.hourlyRate = data.hourlyRate;
      if (data.phone) payload.phone = data.phone;

      const result = await create(payload);

      if (result.tempPassword) {
        await alertDialog(
          `Сотрудник создан!\n\nВременный пароль: ${result.tempPassword}\n\nПередайте его сотруднику.`,
          { title: "Готово", variant: "success" }
        );
      }

      reset();
      setShowForm(false);
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка создания", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === currentUser?.id) {
      await alertDialog("Нельзя удалить самого себя", {
        title: "Нельзя выполнить",
        variant: "error",
      });
      return;
    }
    const ok = await confirmDialog(`Удалить сотрудника «${name}»?`, {
      title: "Удаление сотрудника",
      confirmLabel: "Удалить",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await remove(id);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка удаления");
    }
  };

  const onDownloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка скачивания", {
        title: "Ошибка",
        variant: "error",
      });
    }
  };

  const onUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      await alertDialog("Загрузите файл в формате .xlsx", {
        title: "Неверный формат",
        variant: "error",
      });
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
        msg += result.createdUsers
          .slice(0, 10)
          .map((u) => `${u.name} (${u.email}): ${u.tempPassword}`)
          .join("\n");
        if (result.createdUsers.length > 10) {
          msg += `\n... и ещё ${result.createdUsers.length - 10}`;
        }
      }
      if (result.errors.length > 0) {
        msg += "\n\nОшибки:\n" + result.errors.slice(0, 5).join("\n");
        if (result.errors.length > 5) {
          msg += `\n... и ещё ${result.errors.length - 5}`;
        }
      }

      await alertDialog(msg, {
        title: "Импорт завершён",
        variant: "success",
      });
      setBatchFile(null);
    } catch (e: any) {
      await alertDialog(e.message ?? "Ошибка импорта", {
        title: "Ошибка",
        variant: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.position ?? "").toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Сотрудники</h1>
            <p className="text-sm text-slate-500 mt-1">
              Добавьте команду, чтобы назначать им смены
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Отмена
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Добавить сотрудника
              </>
            )}
          </button>
        </div>

        {/* Импорт Excel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-slate-900">
                Импорт из Excel
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Загрузите всех сотрудников разом. Шаблон с колонками «Имя, Email, Роль, Должность, Ставка, Телефон».
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Скачать шаблон
              </button>

              <label className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {batchFile ? "Заменить файл" : "Загрузить Excel"}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={onUploadExcel}
                  className="hidden"
                />
              </label>

              {batchFile && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 max-w-[200px] truncate">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {batchFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={onImport}
                    disabled={importing}
                    className="inline-flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {importing ? "Импорт..." : "Импортировать"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Форма добавления */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4">
              Новый сотрудник
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Имя
                  </label>
                  <input {...register("name")} placeholder="Мария Иванова" />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="maria@cafe.ru"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Роль
                  </label>
                  <select {...register("role")}>
                    <option value="EMPLOYEE">Сотрудник</option>
                    <option value="MANAGER">Менеджер</option>
                    <option value="OWNER">Владелец</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Должность
                  </label>
                  <input {...register("position")} placeholder="продавец" />
                  {errors.position && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.position.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Ставка, ₽/час
                  </label>
                  <input
                    {...register("hourlyRate")}
                    placeholder="350"
                    inputMode="decimal"
                  />
                  {errors.hourlyRate && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.hourlyRate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Телефон
                  </label>
                  <input
                    {...register("phone")}
                    placeholder="+7 999 123-45-67"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Поиск */}
        {items.length > 0 && (
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, email, должности..."
              className="!pl-9"
            />
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Пусто */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Пока нет сотрудников
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Добавьте первого сотрудника вручную или загрузите Excel со всеми сразу
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Добавить сотрудника
            </button>
          </div>
        )}

        {/* Таблица */}
        {filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left">
                <tr>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Сотрудник
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Роль
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Ставка
                  </th>
                  <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                    Контакты
                  </th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${getAvatarColor(u.id)}`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {u.name}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-slate-400">
                                (вы)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {u.position && (
                              <span className="text-slate-600">
                                {u.position} ·{" "}
                              </span>
                            )}
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.hourlyRate ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                          {u.hourlyRate} ₽
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {u.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400 inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-slate-400 hover:text-brand-600 hover:bg-brand-50 p-1.5 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Нет результатов поиска */}
        {items.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              По запросу «{search}» ничего не найдено
            </p>
          </div>
        )}
      </main>

      {/* ─── Модалка редактирования ─── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={async (data) => {
            try {
              await update(editingUser.id, data);
              setEditingUser(null);
            } catch (e: any) {
              await alertDialog(e.response?.data?.error ?? "Ошибка сохранения", {
                title: "Ошибка",
                variant: "error",
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Модалка редактирования ─────────────────────────
function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: TeamUser;
  onClose: () => void;
  onSave: (
    data: Partial<{
      name: string;
      phone: string | null;
      role: "OWNER" | "MANAGER" | "EMPLOYEE";
      position: string | null;
      hourlyRate: string | null;
    }>
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      role: user.role,
      position: user.position ?? "",
      hourlyRate: user.hourlyRate ?? "",
      phone: user.phone ?? "",
    },
  });

  const onSubmit = async (data: EditForm) => {
    setBusy(true);
    try {
      await onSave({
        name: data.name,
        role: data.role,
        position: data.position || null,
        hourlyRate: data.hourlyRate || null,
        phone: data.phone || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                Редактировать сотрудника
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Имя
            </label>
            <input {...register("name")} />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Роль
              </label>
              <select {...register("role")}>
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="MANAGER">Менеджер</option>
                <option value="OWNER">Владелец</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Должность
              </label>
              <input {...register("position")} placeholder="продавец" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Ставка, ₽/час
              </label>
              <input {...register("hourlyRate")} placeholder="350" />
              {errors.hourlyRate && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.hourlyRate.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Телефон
              </label>
              <input {...register("phone")} placeholder="+7 999 123-45-67" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-all"
            >
              <Save className="w-4 h-4" />
              {busy ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}