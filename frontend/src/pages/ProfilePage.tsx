import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail, Phone, Coins, Shield, KeyRound, Save, CalendarDays, Building2,
  Lock, Pencil, Settings as SettingsIcon, Clock, Percent, Palette, AlertCircle,
  Bell, Send, MessageSquare, Check, Loader2, X, User as UserIcon,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUsers } from "../store/users";
import { usersApi } from "../api/users";
import {
  meApi,
  type MyProfile,
  type MessengerProvider,
  type NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "../api/me";
import { organizationApi, type Organization } from "../api/organization";
import { useOrganization } from "../store/organization";
import { alertDialog } from "../store/dialogs";
import NavBar from "../components/NavBar";
import { Download } from "lucide-react";

// ─── Схема смены пароля ────────────────────────────
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

// ─── Разделы ───────────────────────────────────────
type SectionId =
  | "profile" | "messenger"
  | "requisites" | "modules" | "approval" | "overtime" | "tax" | "appearance";

type Section = {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  group: "personal" | "org";
};

const SECTIONS: Section[] = [
  { id: "profile", label: "Профиль", icon: Shield, group: "personal" },
  { id: "messenger", label: "Мессенджер", icon: MessageSquare, group: "personal" },
  { id: "requisites", label: "Реквизиты", icon: Building2, group: "org" },
  { id: "modules", label: "Модули", icon: SettingsIcon, group: "org" },
  { id: "approval", label: "Согласование", icon: Check, group: "org" },
  { id: "overtime", label: "Переработки", icon: Percent, group: "org" },
  { id: "tax", label: "Налоги", icon: Percent, group: "org" },
  { id: "appearance", label: "Внешний вид", icon: Palette, group: "org" },
  { id: "passwords", label: "Доступы и пароли", icon: KeyRound, group: "org" },
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ═══════════════════════════════════════════════════
// Главный компонент
// ═══════════════════════════════════════════════════
export default function ProfilePage() {
  const { changePassword } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SectionId>("profile");

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    city: "",
    directorName: "",
    inn: "",
    legalAddress: "",
    overtimeMultiplier1: "1.5",
    overtimeMultiplier2: "2.0",
    taxRate: "13",
    positionHeaderOpacity: 70,
    positionRowOpacity: 20,
    requireShiftApproval: true,
    disciplineEditWindowDays: 3,
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

  const downloadJsonBackup = async () => {
    try {
      const res = await fetch("/api/organization/export-json", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Ошибка выгрузки");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Не удалось скачать бэкап. Убедитесь, что у вас тариф Business.");
    }
  };

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
            taxRate: (o as any).taxRate ?? "13",
            positionHeaderOpacity: (o as any).positionHeaderOpacity ?? 70,
            positionRowOpacity: (o as any).positionRowOpacity ?? 20,
            requireShiftApproval: (o as any).requireShiftApproval ?? true,
            disciplineEditWindowDays: (o as any).disciplineEditWindowDays ?? 3,
          });
          useOrganization.getState().set(o);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Если не owner — сбрасываем вкладку, если она из группы "Организация"
  useEffect(() => {
    const current = SECTIONS.find((s) => s.id === section);
    if (current?.group === "org" && !isOwner) setSection("profile");
  }, [isOwner, section]);

  const onSubmitPassword = async (data: PasswordForm) => {
    setSaving(true);
    try {
      await changePassword(data.oldPassword, data.newPassword);
      await alertDialog("Пароль успешно изменён", { variant: "success" });
      reset();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка смены пароля", {
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePartialOrg = async (patch: Record<string, any>) => {
    setOrgSaving(true);
    try {
      const updated = await organizationApi.update(patch as any);
      setOrg(updated);
      useOrganization.getState().set(updated);
      await alertDialog("Сохранено", { variant: "success" });
    } catch (err: any) {
      await alertDialog(err.response?.data?.error ?? "Ошибка сохранения", {
        variant: "error",
      });
    } finally {
      setOrgSaving(false);
    }
  };

  const onToggleTimeTracking = async (enabled: boolean) => {
    if (!org || !isOwner) return;
    const previous = org;
    const optimistic: Organization = { ...org, timeTrackingEnabled: enabled };
    setOrg(optimistic);
    useOrganization.getState().set(optimistic);
    setTogglingTime(true);

    try {
      const updated = await organizationApi.update({ timeTrackingEnabled: enabled });
      setOrg(updated);
      useOrganization.getState().set(updated);
    } catch (err: any) {
      setOrg(previous);
      useOrganization.getState().set(previous);
      await alertDialog(err.response?.data?.error ?? "Ошибка сохранения", {
        variant: "error",
      });
    } finally {
      setTogglingTime(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Профиль</h1>
        <p className="text-sm text-slate-500 mb-6">
          Личные данные, мессенджеры и настройки организации
        </p>

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}

        {profile && (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
            {/* ─── Сайдбар ─── */}
            <aside className="lg:sticky lg:top-24 self-start">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 space-y-3">
                <SidebarGroup
                  title="Личное"
                  sections={SECTIONS.filter((s) => s.group === "personal")}
                  active={section}
                  onSelect={setSection}
                />
                {isOwner && (
                  <SidebarGroup
                    title="Организация"
                    sections={SECTIONS.filter((s) => s.group === "org")}
                    active={section}
                    onSelect={setSection}
                  />
                )}
              </div>
            </aside>

            {/* ─── Контент ─── */}
            <div className="min-w-0">
              {section === "profile" && (
                <ProfileSection
                  profile={profile}
                  saving={saving}
                  register={register}
                  errors={errors}
                  onSubmit={handleSubmit(onSubmitPassword)}
                />
              )}

              {section === "messenger" && (
                <MessengerSection userId={profile.id} />
              )}

              {section === "modules" && isOwner && org?.tariffId === "business" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in mb-6">
                  <h2 className="font-semibold text-slate-900 mb-2">Выгрузка данных (JSON)</h2>
                  <p className="text-sm text-slate-500 mb-4">Скачайте полную резервную копию всех данных вашей организации.</p>
                  <button onClick={downloadJsonBackup} className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 text-sm font-medium">
                    <Download className="w-4 h-4" /> Скачать JSON
                  </button>
                </div>
              )}

              {section === "requisites" && isOwner && org && (
                <RequisitesSection
                  org={org}
                  form={orgForm}
                  setForm={setOrgForm}
                  editing={orgEditing}
                  setEditing={setOrgEditing}
                  saving={orgSaving}
                  onSave={() =>
                    savePartialOrg({
                      name: orgForm.name || undefined,
                      city: orgForm.city || null,
                      directorName: orgForm.directorName || null,
                      inn: orgForm.inn || null,
                      legalAddress: orgForm.legalAddress || null,
                    }).then(() => setOrgEditing(false))
                  }
                />
              )}

              {section === "modules" && isOwner && org && (
                <ModulesSection
                  timeTrackingOn={org.timeTrackingEnabled !== false}
                  toggling={togglingTime}
                  onToggle={onToggleTimeTracking}
                />
              )}

              {section === "approval" && isOwner && org && (
                <ApprovalSection
                  form={orgForm}
                  setForm={setOrgForm}
                  saving={orgSaving}
                  onSave={() =>
                    savePartialOrg({
                      requireShiftApproval: orgForm.requireShiftApproval,
                      disciplineEditWindowDays: orgForm.disciplineEditWindowDays,
                    })
                  }
                />
              )}

              {section === "overtime" && isOwner && org && (
                <OvertimeSection
                  form={orgForm}
                  setForm={setOrgForm}
                  saving={orgSaving}
                  onSave={() =>
                    savePartialOrg({
                      overtimeMultiplier1: orgForm.overtimeMultiplier1,
                      overtimeMultiplier2: orgForm.overtimeMultiplier2,
                    })
                  }
                />
              )}

              {section === "tax" && isOwner && org && (
                <TaxSection
                  form={orgForm}
                  setForm={setOrgForm}
                  saving={orgSaving}
                  onSave={() => savePartialOrg({ taxRate: orgForm.taxRate })}
                />
              )}

              {section === "passwords" && isOwner && (
                <PasswordsSection />
              )}

              {section === "appearance" && isOwner && org && (
                <AppearanceSection
                  form={orgForm}
                  setForm={setOrgForm}
                  saving={orgSaving}
                  onSave={() =>
                    savePartialOrg({
                      positionHeaderOpacity: orgForm.positionHeaderOpacity,
                      positionRowOpacity: orgForm.positionRowOpacity,
                    })
                  }
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Сайдбар
// ═══════════════════════════════════════════════════
function SidebarGroup({
  title,
  sections,
  active,
  onSelect,
}: {
  title: string;
  sections: Section[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
        {title}
      </div>
      <div className="space-y-0.5">
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Профиль (карточка + смена пароля)
// ═══════════════════════════════════════════════════
function ProfileSection({
  profile, saving, register, errors, onSubmit,
}: {
  profile: MyProfile;
  saving: boolean;
  register: any;
  errors: any;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium mt-1 ${ROLE_BADGES[profile.role]}`}>
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <ProfileField icon={Mail} label="Email" value={profile.email} />
            {profile.phone && (
              <ProfileField icon={Phone} label="Телефон" value={profile.phone} />
            )}
            {profile.hourlyRate && (
              <ProfileField
                icon={Coins}
                label="Ставка"
                value={`${profile.hourlyRate} ₽`}
              />
            )}
            <ProfileField
              icon={CalendarDays}
              label="В системе с"
              value={new Date(profile.createdAt).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", year: "numeric",
              })}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Сменить пароль</h2>
            <p className="text-xs text-slate-500">
              Минимум 8 символов. Используйте буквы, цифры и символы.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Текущий пароль</label>
            <input type="password" {...register("oldPassword")} className="w-full" placeholder="••••••••" />
            {errors.oldPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.oldPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Новый пароль</label>
            <input type="password" {...register("newPassword")} className="w-full" placeholder="Минимум 8 символов" />
            {errors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Повторите новый пароль</label>
            <input type="password" {...register("confirmPassword")} className="w-full" placeholder="••••••••" />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Сохранение..." : "Сохранить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Мессенджер (привязка + уведомления)
// ═══════════════════════════════════════════════════
function MessengerSection({ userId }: { userId: string }) {
  const [bindings, setBindings] = useState<{ telegram: string; max: string }>(() => {
    const raw = localStorage.getItem(`messengers_${userId}`);
    if (raw) { try { return JSON.parse(raw); } catch {} }
    return { telegram: "", max: "" };
  });
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const raw = localStorage.getItem(`notif_settings_${userId}`);
    if (raw) { try { return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) }; } catch {} }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });
  const [draftTelegram, setDraftTelegram] = useState(bindings.telegram);
  const [draftMax, setDraftMax] = useState(bindings.max);
  const [busy, setBusy] = useState<MessengerProvider | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    localStorage.setItem(`notif_settings_${userId}`, JSON.stringify(settings));
  }, [settings, userId]);

  const toggle = (key: keyof NotificationSettings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const bind = async (provider: MessengerProvider) => {
    const externalId = (provider === "telegram" ? draftTelegram : draftMax).trim();
    if (!externalId) return;
    setBusy(provider);
    try {
      await meApi.bindMessenger({ provider, externalId });
      const next = { ...bindings, [provider]: externalId };
      setBindings(next);
      localStorage.setItem(`messengers_${userId}`, JSON.stringify(next));
      await alertDialog("Мессенджер привязан", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка привязки", { variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await meApi.testMessenger();
      await alertDialog(
        res.success
          ? "Тестовое сообщение отправлено — проверьте мессенджер"
          : "Не удалось отправить. Проверьте, что привязка активна.",
        { variant: res.success ? "success" : "error" }
      );
    } catch {
      await alertDialog("Ошибка отправки", { variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Мессенджер</h2>
          <p className="text-xs text-slate-500">Куда присылать уведомления о сменах</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <ProviderCard
          name="Telegram"
          description="Напишите боту /start, затем введите chat_id"
          value={draftTelegram}
          onChange={setDraftTelegram}
          boundValue={bindings.telegram}
          busy={busy === "telegram"}
          onBind={() => bind("telegram")}
          placeholder="Например: 123456789"
        />
        <ProviderCard
          name="MAX"
          description="user_id из MAX-бота"
          value={draftMax}
          onChange={setDraftMax}
          boundValue={bindings.max}
          busy={busy === "max"}
          onBind={() => bind("max")}
          placeholder="Например: 987654321"
        />
      </div>

      {(bindings.telegram || bindings.max) && (
        <div className="mb-6">
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить тестовое сообщение
          </button>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" /> Какие уведомления получать
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Отметьте события, о которых хотите получать сообщения
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          <NotifCheckbox label="Новый график на неделю" checked={settings.newSchedule} onChange={() => toggle("newSchedule")} />
          <NotifCheckbox label="Смена изменена" checked={settings.shiftChanged} onChange={() => toggle("shiftChanged")} />
          <NotifCheckbox label="Назначена новая смена" checked={settings.shiftCreated} onChange={() => toggle("shiftCreated")} />
          <NotifCheckbox label="Нужно согласовать изменение смены" checked={settings.shiftChangeApproval} onChange={() => toggle("shiftChangeApproval")} />
          <NotifCheckbox label="Запрос на обмен сменами" checked={settings.swapRequest} onChange={() => toggle("swapRequest")} />
          <NotifCheckbox label="Отпуск (одобрен/отклонён)" checked={settings.vacationReviewed} onChange={() => toggle("vacationReviewed")} />
          <NotifCheckbox label="Больничный" checked={settings.sickLeave} onChange={() => toggle("sickLeave")} />
          <NotifCheckbox label="Отгул (одобрен/отклонён)" checked={settings.timeOffReviewed} onChange={() => toggle("timeOffReviewed")} />
        </div>

        <div className="mt-6">
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Напоминания о начале смены
          </h4>
          <div className="grid sm:grid-cols-2 gap-2">
            <NotifCheckbox label="За час до начала" checked={settings.remindHour} onChange={() => toggle("remindHour")} />
            <NotifCheckbox label="За 5 минут до начала" checked={settings.remindFiveMin} onChange={() => toggle("remindFiveMin")} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 leading-relaxed">
        Настройки уведомлений сохраняются локально. Серверная синхронизация появится в ближайшем обновлении.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Реквизиты организации
// ═══════════════════════════════════════════════════
function RequisitesSection({
  form, setForm, editing, setEditing, saving, onSave,
}: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Реквизиты организации</h2>
            <p className="text-xs text-slate-500">
              Подставляются в приказы и табели
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v: boolean) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            editing
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : "bg-brand-50 text-brand-700 hover:bg-brand-100"
          }`}
        >
          {editing ? (
            <><X className="w-3 h-3" /> Отмена</>
          ) : (
            <><Pencil className="w-3 h-3" /> Редактировать</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OrgField label="Название" value={form.name} editing={editing}
          onChange={(v) => setForm((f: any) => ({ ...f, name: v }))}
          placeholder="ООО Ромашка" />
        <OrgField label="Город" value={form.city} editing={editing}
          onChange={(v) => setForm((f: any) => ({ ...f, city: v }))}
          placeholder="Москва" />
        <OrgField label="ФИО директора" value={form.directorName} editing={editing}
          onChange={(v) => setForm((f: any) => ({ ...f, directorName: v }))}
          placeholder="Иванов Иван Иванович" />
        <OrgField label="ИНН" value={form.inn} editing={editing}
          onChange={(v) => setForm((f: any) => ({ ...f, inn: v }))}
          placeholder="7701234567" />
        <div className="md:col-span-2">
          <OrgField label="Юридический адрес" value={form.legalAddress} editing={editing}
            onChange={(v) => setForm((f: any) => ({ ...f, legalAddress: v }))}
            placeholder="г. Москва, ул. Ленина, д. 1" />
        </div>
      </div>

      {editing && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? "Сохранение..." : "Сохранить реквизиты"}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Модули
// ═══════════════════════════════════════════════════
function ModulesSection({
  timeTrackingOn, toggling, onToggle,
}: {
  timeTrackingOn: boolean;
  toggling: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Модули</h2>
          <p className="text-xs text-slate-500">Функции системы</p>
        </div>
      </div>

      <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
        toggling ? "border-slate-100 opacity-70" : "border-slate-200 hover:border-brand-300"
      }`}>
        <input
          type="checkbox"
          checked={timeTrackingOn}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={toggling}
          className="!w-4 !h-4 mt-1 !p-0"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-900 text-sm">Учёт рабочего времени</span>
            {toggling && <span className="text-xs text-slate-400">сохранение...</span>}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Сотрудники смогут отмечать начало и конец смены. Если выключить — в табель
            явки ставятся по умолчанию, а кнопка «Начать смену» скрывается у всех сотрудников.
          </div>
        </div>
      </label>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Согласование
// ═══════════════════════════════════════════════════
function ApprovalSection({ form, setForm, saving, onSave }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Согласование</h2>
          <p className="text-xs text-slate-500">Правила подтверждения изменений</p>
        </div>
      </div>

      <div className="space-y-5">
        <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
          form.requireShiftApproval
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-slate-200 hover:border-slate-300"
        }`}>
          <input
            type="checkbox"
            checked={form.requireShiftApproval}
            onChange={(e) => setForm((f: any) => ({ ...f, requireShiftApproval: e.target.checked }))}
            className="!w-4 !h-4 mt-1 !p-0 accent-emerald-600"
          />
          <div className="flex-1">
            <div className="font-medium text-slate-900 text-sm">
              Согласовывать изменения смен с сотрудником
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Если включено: при изменении опубликованного графика сотрудник должен
              согласовать изменение. Если выключено: сотрудник получает только уведомление.
            </div>
          </div>
        </label>

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Сколько дней можно менять дисциплину
          </label>
          <input
            type="number"
            min="0"
            max="90"
            value={form.disciplineEditWindowDays}
            onChange={(e) => setForm((f: any) => ({ ...f, disciplineEditWindowDays: Number(e.target.value) }))}
            className="w-full"
          />
          <p className="text-xs text-slate-500 mt-1">
            Через N дней после смены менять опоздания/прогулы запрещено.
          </p>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Переработки
// ═══════════════════════════════════════════════════
function OvertimeSection({ form, setForm, saving, onSave }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Percent className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Коэффициенты переработки</h2>
          <p className="text-xs text-slate-500">Оплата сверхурочных часов</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Первые 2 часа</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={form.overtimeMultiplier1}
            onChange={(e) => setForm((f: any) => ({ ...f, overtimeMultiplier1: e.target.value }))}
            className="w-full"
          />
          <p className="text-xs text-slate-500 mt-1">По умолчанию 1.5</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Последующие часы</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={form.overtimeMultiplier2}
            onChange={(e) => setForm((f: any) => ({ ...f, overtimeMultiplier2: e.target.value }))}
            className="w-full"
          />
          <p className="text-xs text-slate-500 mt-1">По умолчанию 2.0</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
      >
        <Save className="w-4 h-4" />
        {saving ? "Сохранение..." : "Сохранить коэффициенты"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Налоги
// ═══════════════════════════════════════════════════
function TaxSection({ form, setForm, saving, onSave }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
          <Percent className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Налоги</h2>
          <p className="text-xs text-slate-500">НДФЛ для расчёта «К выплате» в табеле</p>
        </div>
      </div>

      <div className="max-w-xs mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Ставка НДФЛ, %</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={form.taxRate}
          onChange={(e) => setForm((f: any) => ({ ...f, taxRate: e.target.value }))}
          className="w-full"
        />
        <p className="text-xs text-slate-500 mt-1">
          Применяется в разделе «Табель»: <b>К выплате</b> = Начислено − НДФЛ.
        </p>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
      >
        <Save className="w-4 h-4" />
        {saving ? "Сохранение..." : "Сохранить НДФЛ"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Внешний вид
// ═══════════════════════════════════════════════════
function AppearanceSection({ form, setForm, saving, onSave }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
          <Palette className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Внешний вид</h2>
          <p className="text-xs text-slate-500">Прозрачность цветовой подсветки должностей</p>
        </div>
      </div>

      <div className="space-y-5 mb-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Заголовки групп должностей</label>
            <span className="text-sm font-bold text-slate-900">{form.positionHeaderOpacity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.positionHeaderOpacity}
            onChange={(e) => setForm((f: any) => ({ ...f, positionHeaderOpacity: Number(e.target.value) }))}
            className="w-full accent-brand-600"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Строки сотрудников</label>
            <span className="text-sm font-bold text-slate-900">{form.positionRowOpacity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.positionRowOpacity}
            onChange={(e) => setForm((f: any) => ({ ...f, positionRowOpacity: Number(e.target.value) }))}
            className="w-full accent-brand-600"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm transition-all"
      >
        <Save className="w-4 h-4" />
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Хелперы
// ═══════════════════════════════════════════════════
function ProfileField({
  icon: Icon, label, value,
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
        <div className="text-sm font-medium text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}

function OrgField({
  label, value, editing, onChange, placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {editing ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full" />
      ) : (
        <div className="flex items-center gap-2 text-sm py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={value ? "text-slate-900" : "text-slate-400 italic"}>
            {value || "Не заполнено"}
          </span>
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  name, description, value, onChange, boundValue, busy, onBind, placeholder,
}: {
  name: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  boundValue: string;
  busy: boolean;
  onBind: () => void;
  placeholder: string;
}) {
  const isBound = !!boundValue;
  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${
      isBound ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            {name}
            {isBound && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                <Check className="w-3 h-3" /> привязан
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="!text-sm flex-1"
        />
        <button
          type="button"
          onClick={onBind}
          disabled={!value.trim() || busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 text-xs font-medium transition-colors whitespace-nowrap"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {isBound ? "Заменить" : "Привязать"}
        </button>
      </div>
      {isBound && (
        <div className="text-xs text-emerald-700 mt-2">
          ID: <span className="font-mono font-medium">{boundValue}</span>
        </div>
      )}
    </div>
  );
}

function PasswordsSection() {
  const { items, fetch } = useUsers();
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSendAll = async () => {
    if (!items.length) return alert("Нет сотрудников");
    if (!confirm(`Разослать пароли на почту всем ${items.length} сотрудникам?`)) return;
    setSendingAll(true);
    try {
      const res = await usersApi.sendPasswords(items.map(u => u.id));
      await alertDialog(`Успешно отправлено: ${res.sent} писем`, { variant: "success" });
      fetch();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка рассылки", { variant: "error" });
    } finally {
      setSendingAll(false);
    }
  };

  const handleSendOne = async (id: string) => {
    setSendingId(id);
    try {
      await usersApi.sendPasswords([id]);
      await alertDialog("Пароль отправлен на почту!", { variant: "success" });
      fetch();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка отправки", { variant: "error" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Доступы и пароли</h2>
            <p className="text-xs text-slate-500">Сгенерировать новые пароли и отправить сотрудникам</p>
          </div>
        </div>
        <button onClick={handleSendAll} disabled={sendingAll || items.length === 0} className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors">
          <Send className="w-4 h-4" />
          {sendingAll ? "Отправка..." : "Разослать всем на почту"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">В организации пока нет сотрудников.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Временный пароль</th>
                <th className="px-4 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 select-all">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.tempPassword ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-bold text-brand-600 text-base select-all">
                          {u.tempPassword}
                        </span>
                        {u.isTempPasswordSent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                            <Check className="w-3 h-3" /> Отправлен
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-fit">
                            <AlertCircle className="w-3 h-3" /> Не отправлен
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-normal text-xs">пароль изменён</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSendOne(u.id)}
                      disabled={sendingId === u.id}
                      className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingId === u.id ? "Отправка..." : "Отправить"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-4">
        * Если сотрудник уже сменил пароль, при отправке ему будет сгенерирован новый временный пароль.
      </p>
    </div>
  );
}

function NotifCheckbox({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
      checked ? "border-brand-200 bg-brand-50/50" : "border-slate-200 hover:border-slate-300"
    }`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="!w-4 !h-4 !p-0" />
      <span className="text-sm text-slate-800">{label}</span>
    </label>
  );
}