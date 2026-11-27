import { useState } from "react";
import { X, Mail, Loader2 } from "lucide-react";
import { api } from "../api/client"; // Укажи правильный путь к твоему axios instance
import { useAuth } from "../store/auth"; // Укажи правильный путь к твоему auth-стору

type Props = {
  guestData: any;
  onClose: () => void;
  mode?: string;
  year?: number;
  exportMode?: string;
  selectedEmpId?: string;
};

export default function GuestRegisterModal({ guestData, onClose, mode, year, exportMode, selectedEmpId }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuth(); // Функция сохранения сессии

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Введите корректный email");
    
    setLoading(true);
    setError(null);

    try {
      // Отправляем на бэкенд (метод quickRegister)
      const { data } = await api.post("/auth/quick-register", {
        email,
        name: "Владелец",
        guestData,
        mode,
        year,
        exportMode,
        selectedEmpId,
      });

      // Сохраняем токен и заходим в систему
      // Снимаем гостевые флаги и чистим гостевую БД,
      // чтобы после регистрации не остаться в гостевом режиме.
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      localStorage.removeItem("guest_db");
      localStorage.removeItem("guest_workspace");
      localStorage.setItem("guest_migrated", "true");
      localStorage.setItem("migrated_email", email);
      localStorage.removeItem("activeLocationId");
      setAuth(data.token, data.user);
      
      // Отправляем цель в Метрику (только после успешного сохранения!)
      if (typeof window !== "undefined" && (window as any).ym) {
        (window as any).ym(114078577, 'reachGoal', 'calc_register_success');
      }

      // Перекидываем в полноценный дашборд
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.response?.data?.error || "Ошибка регистрации. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Сохраните ваш график</h2>
        <p className="text-slate-500 mb-6 text-sm">
          Введите Email, чтобы мы сохранили расписание и сгенерировали доступы для ваших сотрудников.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <p className="text-rose-500 text-xs mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Сохранить и войти"}
          </button>
          <p className="text-center text-xs text-slate-400">
            Нажимая кнопку, вы соглашаетесь с условиями сервиса.
          </p>
        </form>
      </div>
    </div>
  );
}
