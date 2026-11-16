import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Plus, AlertCircle, ShieldCheck } from "lucide-react";

export default function DemoPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<{id: string, day: string, time: string}[]>([]);

  const addShift = () => {
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const randomDay = days[Math.floor(Math.random() * days.length)];
    setShifts([...shifts, { id: Math.random().toString(), day: randomDay, time: "09:00 - 18:00" }]);
  };

  const handlePublish = async () => {
    if (!email || !email.includes("@")) {
      setError("Введите корректный email");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${apiUrl}/auth/quick-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: "Владелец",
          guestData: { 
            employees: [{ name: "Сотрудник 1", startTime: "09:00", endTime: "18:00", cycle: "2/2" }],
            startDate: new Date().toISOString().slice(0, 10)
          }
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка регистрации");
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);

      if (typeof window !== "undefined" && (window as any).ym) {
        (window as any).ym(114078577, 'reachGoal', 'calc_register_success');
      }

      alert("Успех! Пароль отправлен на почту. Переходим в кабинет...");
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-600" />
          <span className="font-bold text-lg text-slate-900">Демо-режим</span>
        </div>
        <button onClick={() => navigate("/login")} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Войти
        </button>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Вы в гостевом режиме</h3>
            <p className="text-sm text-amber-700 mt-1">
              Порисуйте смены. Чтобы сохранить график и отправить пароль, введите почту ниже.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-slate-400" /> График на неделю
            </h2>
            <button onClick={addShift} className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Добавить смену
            </button>
          </div>

          <div className="space-y-2">
            {shifts.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Смен пока нет. Нажмите «Добавить смену».</p>}
            {shifts.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-medium text-slate-900">{s.day}</span>
                <span className="text-sm text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">{s.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sticky bottom-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">Введите почту, чтобы данные не затерялись</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
              {error && <p className="text-rose-500 text-xs mt-1">{error}</p>}
            </div>
            <button 
              onClick={handlePublish} 
              disabled={loading}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 h-[46px]"
            >
              {loading ? "Сохранение..." : "Опубликовать"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
