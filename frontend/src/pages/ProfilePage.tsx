import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Phone,
  Coins,
  Shield,
  KeyRound,
  Save,
  CalendarDays,
  Building2,
  Lock,
  Pencil,
  Settings as SettingsIcon,
  Clock,
  Percent,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { meApi, type MyProfile } from "../api/me";
import { organizationApi, type Organization } from "../api/organization";
import { useOrganization } from "../store/organization";
import NavBar from "../components/NavBar";
import { Palette } from "lucide-react";
const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(8, "Минимум 8 символов"),
    confirmPassword: z.string().min(8, "Минимум 8 символов"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const ROLE_BADGES: Record<string, string> = {
  OWNER: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  MANAGER: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  EMPLOYEE: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Tab = "profile" | "settings";

export default function ProfilePage() {
  const { changePassword } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");

  // ─── Организация ────────────────────────────────────
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    city: "",
    directorName: "",
    inn: "",
    legalAddress: "",
    overtimeMultiplier1: "1.5",
    overtimeMultiplier2: "2.0",
    positionHeaderOpacity: 70,
    positionRowOpacity: 20,
  });
  const [orgEditing, setOrgEditing] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);
  const [togglingTime, setTogglingTime] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const isOwner = profile?.role === "OWNER";

  useEffect(() => {
    Promise.all([
      meApi.profile().catch(() => null),
      organizationApi.get().catch(() => null),
    ])
      .then(([p, o]) => {
        setProfile(p);
        setOrg(o);
        if (o) {
          setOrgForm({
            name: o.name ?? "",
            city: o.city ?? "",
            directorName: o.directorName ?? "",
            inn: o.inn ?? "",
            legalAddress: o.legalAddress ?? "",
            overtimeMultiplier1: o.overtimeMultiplier1 ?? "1.5",
            overtimeMultiplier2: o.overtimeMultiplier2 ?? "2.0",
            positionHeaderOpacity: o.positionHeaderOpacity ?? 70,
            positionRowOpacity: o.positionRowOpacity ?? 20,
          });
          useOrganization.getState().set(o);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOwner && tab === "settings") {
      setTab("profile");
    }
  }, [isOwner, tab]);

  const onSubmit = async (data: PasswordForm) => {
    setSaving(true);
    try {
      await changePassword(data.oldPassword, data.newPassword);
      alert("Пароль успешно изменён");
      reset();
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка смены пароля");
    } finally {
      setSaving(false);
    }
  };

  const onSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSaving(true);
    try {
      const updated = await organizationApi.update({
        name: orgForm.name || undefined,
        city: orgForm.city || null,
        directorName: orgForm.directorName || null,
        inn: orgForm.inn || null,
        legalAddress: orgForm.legalAddress || null,
        overtimeMultiplier1: orgForm.overtimeMultiplier1,
        overtimeMultiplier2: orgForm.overtimeMultiplier2,
        positionHeaderOpacity: orgForm.positionHeaderOpacity,
        positionRowOpacity: orgForm.positionRowOpacity,
      });
      setOrg(updated);
      useOrganization.getState().set(updated);
      setOrgEditing(false);
      alert("Настройки сохранены");
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка сохранения");
    } finally {
      setOrgSaving(false);
    }
  };

  const onToggleTimeTracking = async (enabled: boolean) => {
    if (!org || !isOwner) return;

    const previous = org;
    const optimistic: Organization = {
      ...org,
      timeTrackingEnabled: enabled,
    };
    setOrg(optimistic);
    useOrganization.getState().set(optimistic);
    setTogglingTime(true);

    try {
      const updated = await organizationApi.update({
        timeTrackingEnabled: enabled,
      });
      setOrg(updated);
      useOrganization.getState().set(updated);
    } catch (err: any) {
      setOrg(previous);
      useOrganization.getState().set(previous);
      alert(err.response?.data?.error ?? "Ошибка сохранения");
    } finally {
      setTogglingTime(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Профиль</h1>
        <p className="text-sm text-slate-500 mb-6">
          Ваши данные и настройки безопасности
        </p>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}

        {profile && (
          <>
            {/* ═══ Вкладки ═══ */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              <button
                onClick={() => setTab("profile")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  tab === "profile"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Shield className="w-4 h-4" />
                Профиль
              </button>

              {isOwner && (
                <button
                  onClick={() => setTab("settings")}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    tab === "settings"
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <SettingsIcon className="w-4 h-4" />
                  Настройки
                </button>
              )}
            </div>

            {/* ═══ ВКЛАДКА: ПРОФИЛЬ ═══ */}
            {tab === "profile" && (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 animate-fade-in">
                  <div className="h-20 bg-gradient-to-br from-brand-500 to-brand-700" />
                  <div className="px-6 pb-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="-mt-10 w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center text-2xl font-bold text-brand-600 border-4 border-white shrink-0">
                        {initials(profile.name)}
                      </div>
                      <div className="pt-1 min-w-0">
                        <div className="text-xl font-semibold text-slate-900 truncate">
                          {profile.name}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium mt-1 ${
                            ROLE_BADGES[profile.role]
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[profile.role]}
                        </span>
                      </div>
                    </div>

                    {/* Блок подписки */}
                    <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl border border-brand-200 p-6 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">Ваш тариф: Free</h3>
                          <p className="text-sm text-slate-500 mt-1">Доступно 3 сотрудника и 1 точка</p>
                        </div>
                        <button
                          onClick={async () => {
                            const token = localStorage.getItem("token");
                            try {
                              const res = await fetch("http://localhost:3001/api/payments/create", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  tariffId: "pro",
                                  amount: 990,
                                  description: "Тариф Pro на 1 месяц",
                                }),
                              });
                              const data = await res.json();
                              if (data.confirmationUrl) window.location.href = data.confirmationUrl;
                              else alert(data.error || "Ошибка");
                            } catch (e) {
                              alert("Ошибка соединения с сервером");
                            }
                          }}
                          className="bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm transition-all"
                        >
                          Перейти на Pro за 990 ₽
                        </button>
                      </div>
                    </div>




                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <ProfileField
                        icon={Mail}
                        label="Email"
                        value={profile.email}
                      />
                      {profile.phone && (
                        <ProfileField
                          icon={Phone}
                          label="Телефон"
                          value={profile.phone}
                        />
                      )}
                      {profile.hourlyRate && (
                        <ProfileField
                          icon={Coins}
                          label="Ставка"
                          value={`${profile.hourlyRate} ₽/ч`}
                        />
                      )}
                      <ProfileField
                        icon={CalendarDays}
                        label="В системе с"
                        value={new Date(profile.createdAt).toLocaleDateString(
                          "ru-RU",
                          { day: "numeric", month: "long", year: "numeric" }
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Данные организации */}
                {org && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-slate-900">
                            Данные организации
                          </h2>
                          <p className="text-xs text-slate-500">
                            Используются по умолчанию при генерации документов
                          </p>
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setOrgEditing((v) => !v)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            orgEditing
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                          }`}
                        >
                          {orgEditing ? (
                            <>Отмена</>
                          ) : (
                            <>
                              <Pencil className="w-3 h-3" />
                              Редактировать
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <form onSubmit={onSaveOrg} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <OrgField
                          label="Название организации"
                          value={orgForm.name}
                          editing={orgEditing}
                          onChange={(v) =>
                            setOrgForm((f) => ({ ...f, name: v }))
                          }
                          placeholder="ООО Ромашка"
                        />
                        <OrgField
                          label="Город"
                          value={orgForm.city}
                          editing={orgEditing}
                          onChange={(v) =>
                            setOrgForm((f) => ({ ...f, city: v }))
                          }
                          placeholder="Москва"
                        />
                        <OrgField
                          label="ФИО директора"
                          value={orgForm.directorName}
                          editing={orgEditing}
                          onChange={(v) =>
                            setOrgForm((f) => ({ ...f, directorName: v }))
                          }
                          placeholder="Иванов Иван Иванович"
                        />
                        <OrgField
                          label="ИНН"
                          value={orgForm.inn}
                          editing={orgEditing}
                          onChange={(v) =>
                            setOrgForm((f) => ({ ...f, inn: v }))
                          }
                          placeholder="7701234567"
                        />
                        <div className="md:col-span-2">
                          <OrgField
                            label="Юридический адрес"
                            value={orgForm.legalAddress}
                            editing={orgEditing}
                            onChange={(v) =>
                              setOrgForm((f) => ({ ...f, legalAddress: v }))
                            }
                            placeholder="г. Москва, ул. Ленина, д. 1"
                          />
                        </div>
                      </div>

                      {orgEditing && (
                        <button
                          type="submit"
                          disabled={orgSaving}
                          className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
                        >
                          <Save className="w-4 h-4" />
                          {orgSaving ? "Сохранение..." : "Сохранить данные"}
                        </button>
                      )}
                    </form>
                  </div>
                )}

                {/* Смена пароля */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Сменить пароль
                      </h2>
                      <p className="text-xs text-slate-500">
                        Минимум 8 символов. Используйте буквы, цифры и символы.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4 max-w-md"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Текущий пароль
                      </label>
                      <input
                        type="password"
                        {...register("oldPassword")}
                        className="w-full"
                        placeholder="••••••••"
                      />
                      {errors.oldPassword && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.oldPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Новый пароль
                      </label>
                      <input
                        type="password"
                        {...register("newPassword")}
                        className="w-full"
                        placeholder="Минимум 8 символов"
                      />
                      {errors.newPassword && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.newPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Повторите новый пароль
                      </label>
                      <input
                        type="password"
                        {...register("confirmPassword")}
                        className="w-full"
                        placeholder="••••••••"
                      />
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Сохранение..." : "Сохранить пароль"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ═══ ВКЛАДКА: НАСТРОЙКИ (только OWNER) ═══ */}
            {tab === "settings" && isOwner && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Модули */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                      <SettingsIcon className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Настройки
                      </h2>
                      <p className="text-xs text-slate-500">
                        Модули и функции системы
                      </p>
                    </div>
                  </div>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      togglingTime
                        ? "border-slate-100 opacity-70"
                        : "border-slate-200 hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={org?.timeTrackingEnabled !== false}
                      onChange={(e) =>
                        onToggleTimeTracking(e.target.checked)
                      }
                      disabled={togglingTime || !org}
                      className="!w-4 !h-4 mt-1 !p-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="font-medium text-slate-900 text-sm">
                          Учёт рабочего времени
                        </span>
                        {togglingTime && (
                          <span className="text-xs text-slate-400">
                            сохранение...
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Сотрудники смогут отмечать начало и конец смены.
                        Если выключить — часы для зарплаты считаются
                        по графику, кнопка «Начать смену» скрывается у всех
                        сотрудников.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Переработки */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Percent className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Коэффициенты переработки
                      </h2>
                      <p className="text-xs text-slate-500">
                        Настройка оплаты сверхурочных часов
                      </p>
                    </div>
                  </div>

                  <form onSubmit={onSaveOrg} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Первые 2 часа
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={orgForm.overtimeMultiplier1}
                          onChange={(e) => setOrgForm((f) => ({ ...f, overtimeMultiplier1: e.target.value }))}
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          По умолчанию 1.5
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Последующие часы
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={orgForm.overtimeMultiplier2}
                          onChange={(e) => setOrgForm((f) => ({ ...f, overtimeMultiplier2: e.target.value }))}
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          По умолчанию 2.0
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={orgSaving}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all mt-2"
                    >
                      <Save className="w-4 h-4" />
                      {orgSaving ? "Сохранение..." : "Сохранить коэффициенты"}
                    </button>
                  </form>
                </div>

                {/* Внешний вид */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">Внешний вид</h2>
                      <p className="text-xs text-slate-500">
                        Прозрачность цветовой подсветки должностей в списках
                      </p>
                    </div>
                  </div>

                  <form onSubmit={onSaveOrg} className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">
                          Заголовки групп должностей
                        </label>
                        <span className="text-sm font-bold text-slate-900">
                          {orgForm.positionHeaderOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={orgForm.positionHeaderOpacity}
                        onChange={(e) =>
                          setOrgForm((f) => ({
                            ...f,
                            positionHeaderOpacity: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-brand-600"
                      />
                      <div
                        className="mt-2 h-6 rounded"
                        style={{
                          backgroundColor: `#3B82F6${Math.round(
                            (orgForm.positionHeaderOpacity / 100) * 255
                          )
                            .toString(16)
                            .padStart(2, "0")}`,
                        }}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Фон заголовка «Продавцы», «Повара» и т.п.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">
                          Строки сотрудников
                        </label>
                        <span className="text-sm font-bold text-slate-900">
                          {orgForm.positionRowOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={orgForm.positionRowOpacity}
                        onChange={(e) =>
                          setOrgForm((f) => ({
                            ...f,
                            positionRowOpacity: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-brand-600"
                      />
                      <div
                        className="mt-2 h-6 rounded"
                        style={{
                          backgroundColor: `#3B82F6${Math.round(
                            (orgForm.positionRowOpacity / 100) * 255
                          )
                            .toString(16)
                            .padStart(2, "0")}`,
                        }}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Фон строк с сотрудниками под заголовком должности.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={orgSaving}
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {orgSaving ? "Сохранение..." : "Сохранить"}
                    </button>
                  </form>
                </div>


              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═══ Вспомогательные компоненты ═══

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-900 truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

function OrgField({
  label,
  value,
  editing,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}
      </label>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
      ) : (
        <div className="flex items-center gap-2 text-sm py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span
            className={value ? "text-slate-900" : "text-slate-400 italic"}
          >
            {value || "Не заполнено"}
          </span>
        </div>
      )}
    </div>
  );
}