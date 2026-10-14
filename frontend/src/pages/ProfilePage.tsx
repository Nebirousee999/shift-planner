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
} from "lucide-react";
import { useAuth } from "../store/auth";
import { meApi, type MyProfile } from "../api/me";
import { organizationApi, type Organization } from "../api/organization";
import NavBar from "../components/NavBar";

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

export default function ProfilePage() {
  const { changePassword } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Организация ────────────────────────────────────
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    city: "",
    directorName: "",
    inn: "",
    legalAddress: "",
  });
  const [orgEditing, setOrgEditing] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

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
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
      });
      setOrg(updated);
      setOrgEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Ошибка сохранения");
    } finally {
      setOrgSaving(false);
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
            {/* ═══ Карточка профиля ═══ */}
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

            {/* ═══ Данные организации ═══ */}
            {org && (profile.role === "OWNER" || profile.role === "MANAGER") && (
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
                  {profile.role === "OWNER" && (
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
                      onChange={(v) => setOrgForm((f) => ({ ...f, name: v }))}
                      placeholder="ООО Ромашка"
                    />
                    <OrgField
                      label="Город"
                      value={orgForm.city}
                      editing={orgEditing}
                      onChange={(v) => setOrgForm((f) => ({ ...f, city: v }))}
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
                      onChange={(v) => setOrgForm((f) => ({ ...f, inn: v }))}
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

            {/* ═══ Смена пароля ═══ */}
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