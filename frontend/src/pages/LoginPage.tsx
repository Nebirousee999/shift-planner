import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { trackEvent } from "../lib/metrika";

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Минимум 2 символа"),
  orgName: z.string().min(2, "Минимум 2 символа"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const navigate = useNavigate();
  const { login, register: registerUser, loading, error } = useAuth();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  // Куда перенаправить после входа: если было намерение купить — на кошелёк
  const getPostAuthRedirect = () => {
    const pending = sessionStorage.getItem("pendingCheckout");
    if (pending) {
      try {
        const { plan } = JSON.parse(pending);
        return `/wallet?checkout=${plan}`;
      } catch {
        // Если данные битые — сбрасываем намерение
        sessionStorage.removeItem("pendingCheckout");
      }
    }
    return "/";
  };

  const onLogin = async (data: LoginForm) => {
    const ok = await login(data.email, data.password);
    if (ok) {
      const redirect = getPostAuthRedirect();
      // Небольшая задержка, чтобы hydrate в useAuth отработал
      setTimeout(() => navigate(redirect), 100);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    const ok = await registerUser(data);
    if (ok) {
      trackEvent("ym-register");
      const redirect = getPostAuthRedirect();
      setTimeout(() => navigate(redirect), 100);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Левая колонка — форма */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Логотип */}
          <div className="flex items-center gap-3 mb-8">
            <img src="/favicon.svg" alt="Логотип" className="w-12 h-12 object-contain shadow-lg shadow-brand-500/20" />
            <div>
              <div className="font-bold text-lg text-slate-900 leading-none">
                Планировщик
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Смены и отпуска для микробизнеса
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {mode === "login" ? "Вход в систему" : "Создать аккаунт"}
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            {mode === "login"
              ? "Войдите, чтобы продолжить работу"
              : "Заполните данные — это займёт минуту"}
          </p>

          {mode === "login" ? (
            <form
              onSubmit={loginForm.handleSubmit(onLogin)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    {...loginForm.register("email")}
                    className="w-full !pl-10"
                    placeholder="ivan@cafe.ru"
                    autoComplete="email"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    {...loginForm.register("password")}
                    className="w-full !pl-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                {loading ? (
                  "Вход..."
                ) : (
                  <>
                    Войти
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={registerForm.handleSubmit(onRegister)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ваше имя
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    {...registerForm.register("name")}
                    className="w-full !pl-10"
                    placeholder="Иван"
                  />
                </div>
                {registerForm.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Название заведения
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    {...registerForm.register("orgName")}
                    className="w-full !pl-10"
                    placeholder="Кофейня на углу"
                  />
                </div>
                {registerForm.formState.errors.orgName && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.orgName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    {...registerForm.register("email")}
                    className="w-full !pl-10"
                    placeholder="ivan@cafe.ru"
                    autoComplete="email"
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    {...registerForm.register("password")}
                    className="w-full !pl-10"
                    placeholder="Минимум 8 символов"
                    autoComplete="new-password"
                  />
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
              >
                {loading ? (
                  "Создание..."
                ) : (
                  <>
                    Зарегистрироваться
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>
                Нет аккаунта?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                Уже есть аккаунт?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-brand-600 hover:text-brand-700 font-medium"
                >
                  Войти
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Правая колонка — презентация (только на десктопе) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 items-center justify-center p-12 relative overflow-hidden">
        {/* Декоративные круги */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />

        <div className="relative max-w-md text-white">
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Смены, отпуска и документы — в одном месте
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Планировщик для небольших команд: кафе, салонов, магазинов.
          </p>

          <div className="space-y-4">
            <FeatureRow
              icon={CalendarDays}
              title="График смен"
              text="Составляйте за минуты, публикуйте одной кнопкой"
            />
            <FeatureRow
              icon={UserIcon}
              title="Отпуска и обмены"
              text="Сотрудники видят пересечения и меняются сменами"
            />
            <FeatureRow
              icon={Building2}
              title="Документы по ТК"
              text="Приказы и инструкции по охране труда"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-white/70">{text}</div>
      </div>
    </div>
  );
}