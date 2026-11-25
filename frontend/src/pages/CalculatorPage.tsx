import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Download, Lock, ShieldCheck, Mail, AlertCircle,
  Loader2, ChevronLeft, ChevronRight, Plus, X, Clock, User, Eye, EyeOff, Trash2
} from "lucide-react";
import { api } from "../api/client";
import { trackEvent } from "../lib/metrika";
import { useAuth } from "../store/auth";
//asd
type Employee = {
  id: string;
  name: string;
  color: string;
  cycle: "2/2" | "3/3" | "1/3" | "5/2" | "1/1" | "4/4" | "1/2" | "2/2/3" | "3/2" | "4/2" | "6/1" | "5/5" | "dn4" | "ddnn2" | "ddnn7" | "nn2";
  pattern?: string;
  startTime: string;
  endTime: string;
  nightStart: string;
  nightEnd: string;
  rate: number;
  startDate: string;
  isVisible: boolean;
  password?: string;
};

const CYCLES: Record<string, { work: number; off: number; label: string; pattern?: ("D" | "N" | "O")[] }> = {
  "2/2": { work: 2, off: 2, label: "2/2" },
  "3/3": { work: 3, off: 3, label: "3/3" },
  "1/3": { work: 1, off: 3, label: "1/3" },
  "5/2": { work: 5, off: 2, label: "5/2" },
  "1/1": { work: 1, off: 1, label: "1/1 (сутки через сутки)" },
  "4/4": { work: 4, off: 4, label: "4/4" },
  "1/2": { work: 1, off: 2, label: "1/2 (сутки через двое)" },
  "2/2/3": { work: 2, off: 3, label: "2/2/3 (2 смены подряд)" },
  "3/2": { work: 3, off: 2, label: "3/2" },
  "4/2": { work: 4, off: 2, label: "4/2" },
  "6/1": { work: 6, off: 1, label: "6/1" },
  "5/5": { work: 5, off: 5, label: "5/5" },
  "dn4": { work: 4, off: 0, label: "День-ночь-отсыпной-выходной 🌙", pattern: ["D", "N", "O", "O"] },
  "ddnn2": { work: 6, off: 0, label: "2 дня / 2 ночи / 2 выходных", pattern: ["D", "D", "N", "N", "O", "O"] },
  "ddnn7": { work: 7, off: 0, label: "День-день-ночь-ночь + 3 выходных", pattern: ["D", "D", "N", "N", "O", "O", "O"] },
  "nn2": { work: 4, off: 0, label: "2/2 (только ночные)", pattern: ["N", "N", "O", "O"] },
};

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#6366f1", "#ec4899"];
const COLOR_NAMES: Record<string, string> = {
  "#3b82f6": "Синий", "#8b5cf6": "Фиолетовый", "#10b981": "Зеленый", "#f59e0b": "Оранжевый",
  "#ef4444": "Красный", "#06b6d4": "Голубой", "#6366f1": "Индиго", "#ec4899": "Розовый",
};
const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const SHORT_MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ["00", "15", "30", "45"];

export default function CalculatorPage() {
  const navigate = useNavigate();
  const today = new Date();
  
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [employees, setEmployees] = useState<Employee[]>([
    { 
      id: "1", name: "Сотрудник 1", color: COLORS[0], cycle: "2/2", 
      startTime: "09:00", endTime: "18:00", rate: 300, 
      startDate: today.toISOString().slice(0, 10), isVisible: true, nightStart: "22:00", nightEnd: "06:00" 
    }
  ]);
  
  const [activeEmpId, setActiveEmpId] = useState<string>("1");
  const [activeTab, setActiveTab] = useState<"name" | "color" | "cycle" | "time" | "rate">("cycle");
  const [cycleSubTab, setCycleSubTab] = useState<"day" | "night">("day");
  const [selectedDayInfo, setSelectedDayInfo] = useState<{date: Date, emps: Employee[]} | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [modalEmail, setModalEmail] = useState("");
  
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedYearEmpId, setSelectedYearEmpId] = useState<string>("all");

  const isLoggedIn = !!useAuth((s) => s.token);

  const addEmployee = () => {
      if (employees.length >= 6) {
        return;
      }
    const newId = String(employees.length + 1);
    const newEmp: Employee = {
      id: newId,
      name: `Сотрудник ${newId}`,
      color: COLORS[employees.length % COLORS.length],
      cycle: "2/2",
      startTime: "09:00",
      endTime: "18:00",
      rate: 300,
      startDate: today.toISOString().slice(0, 10),
      isVisible: true,
      nightStart: "22:00",
      nightEnd: "06:00"
    };
    setEmployees([...employees, newEmp]);
    setActiveEmpId(newId);
  };

  const removeEmployee = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (employees.length <= 1) {
      alert("Должен остаться хотя бы один сотрудник");
      return;
    }
    const newEmps = employees.filter((emp) => emp.id !== id);
    setEmployees(newEmps);
    if (activeEmpId === id) {
      setActiveEmpId(newEmps[0].id);
    }
  };

  const updateActiveEmp = (field: keyof Employee, value: any) => {
    setEmployees(prev => prev.map(e => e.id === activeEmpId ? { ...e, [field]: value } : e));
  };

  const toggleVisibility = (id: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, isVisible: !e.isVisible } : e));
  };

  const getShiftHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    return mins / 60;
  };

  // ── Ночные часы (22:00–06:00) ─────────────────────────────
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  // Сколько минут смены приходится на ночной интервал 22:00–06:00
  const nightMinutes = (start: string, end: string) => {
    let s = toMinutes(start);
    let e = toMinutes(end);
    if (e <= s) e += 24 * 60;
    let minutes = 0;
    for (let t = s; t < e; t++) {
      const hour = Math.floor((t % (24 * 60)) / 60);
      if (hour >= 22 || hour < 6) minutes++;
    }
    return minutes / 60;
  };

  const getWorkingEmployees = (date: Date) => {
    return employees.filter(emp => {
      if (!emp.isVisible) return false;
      
      const start = new Date(emp.startDate + "T00:00:00");
      const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const diffTime = current.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const config = CYCLES[emp.cycle];
      const cycleLen = config.work + config.off;
      
      let dayInCycle = diffDays % cycleLen;
      if (dayInCycle < 0) dayInCycle += cycleLen;

      // Циклы день/ночь: тип дня задается паттерном D/N/O
      if (config.pattern) {
        const type = config.pattern[dayInCycle];
        return type !== "O";
      }

      return dayInCycle < config.work;
    });
  };

  // Время смены сотрудника в конкретный день (в ночные дни — ночное время)
  const getShiftForDay = (emp: Employee, nightDay: boolean) => {
    return nightDay ? { start: emp.nightStart, end: emp.nightEnd } : { start: emp.startTime, end: emp.endTime };
  };

  // Ночная ли смена у сотрудника в этот день
  const isNightDayFor = (emp: Employee, date: Date) => {
    const config = CYCLES[emp.cycle];
    if (!config.pattern) return false;
    const start = new Date(emp.startDate + "T00:00:00");
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cycleLen = config.work + config.off;
    let dayInCycle = diffDays % cycleLen;
    if (dayInCycle < 0) dayInCycle += cycleLen;
    return config.pattern[dayInCycle] === "N";
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    
    for (let i = 0; i < startDow; i++) {
      days.push({ date: new Date(year, month, i - startDow + 1), isOtherMonth: true });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isOtherMonth: false });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isOtherMonth: true });
    }
    return days;
  }, [currentMonth]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      w.push(calendarDays.slice(i, i + 7));
    }
    return w;
  }, [calendarDays]);

  const monthStats = useMemo(() => {
    let shifts = 0;
    let hours = 0;
    let cost = 0;
    let nightShifts = 0;
    let nightHours = 0;
    
    calendarDays.forEach(dayObj => {
      if (dayObj.isOtherMonth) return;
      const workingEmps = getWorkingEmployees(dayObj.date);
      workingEmps.forEach(emp => {
        const s = getShiftForDay(emp, isNightDayFor(emp, dayObj.date));
        const h = getShiftHours(s.start, s.end);
        shifts += 1;
        hours += h;
        cost += h * emp.rate;
        const nh = nightMinutes(s.start, s.end);
        if (nh > 0) {
          nightShifts += 1;
          nightHours += nh;
        }
      });
    });
    
    return { shifts, hours: Math.round(hours * 10) / 10, cost: Math.round(cost), nightShifts, nightHours: Math.round(nightHours * 10) / 10 };
  }, [calendarDays, employees]);

  const yearData = useMemo(() => {
    const year = currentMonth.getFullYear();
    let totalShifts = 0;
    let totalHours = 0;
    let totalNightShifts = 0;
    let totalCost = 0;
    const monthlyData = [];

    const empsToCalculate = selectedYearEmpId === "all" ? employees : employees.filter(e => e.id === selectedYearEmpId);
    if (empsToCalculate.length === 0) return { totalShifts: 0, totalHours: 0, totalNightShifts: 0, totalCost: 0, monthlyData: [] };

    for (let m = 0; m < 12; m++) {
      let mShifts = 0, mHours = 0, mNightShifts = 0, mCost = 0;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        const workingToday = getWorkingEmployees(date);
        
        empsToCalculate.forEach(emp => {
          if (workingToday.some(w => w.id === emp.id)) {
            const isNight = isNightDayFor(emp, date);
            const s = getShiftForDay(emp, isNight);
            const h = getShiftHours(s.start, s.end);
            mShifts++;
            mHours += h;
            mCost += h * emp.rate;
            if (isNight) mNightShifts++;
          }
        });
      }
      totalShifts += mShifts;
      totalHours += mHours;
      totalNightShifts += mNightShifts;
      totalCost += mCost;
      monthlyData.push({
        month: MONTHS_RU[m],
        shifts: mShifts,
        hours: Math.round(mHours * 10) / 10,
        nightShifts: mNightShifts,
        cost: Math.round(mCost)
      });
    }
    return { totalShifts, totalHours: Math.round(totalHours * 10) / 10, totalNightShifts, totalCost: Math.round(totalCost), monthlyData };
  }, [currentMonth.getFullYear(), selectedYearEmpId, employees]);

  const performSave = async (targetEmail: string) => {
    if (!targetEmail) return false;
    setLoading(true);
    try {
      const guestData = { 
        startDate: employees[0].startDate, 
        employees: employees.filter(e => e.isVisible).map(e => ({ ...e, rate: String(e.rate) })) 
      };
      
      const isYear = viewMode === "year";
      const currentExportMode = isYear ? (selectedYearEmpId === "all" ? "all" : "single") : (guestData.employees.length > 1 ? "all" : "single");
      const currentSelectedEmpId = isYear ? (selectedYearEmpId === "all" ? employees[0].id : selectedYearEmpId) : guestData.employees[0].id;

      const { data } = await api.post("/auth/quick-register", { 
        email: targetEmail, 
        name, 
        guestData,
        mode: viewMode,
        year: currentMonth.getFullYear(),
        exportMode: currentExportMode,
        selectedEmpId: currentSelectedEmpId
      });
      
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // ВАЖНО: снимаем гостевые флаги — иначе пользователь после регистрации
      // с калькулятора снова попадает в гостевой режим (см. api/client.ts).
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      localStorage.removeItem("guest_db");
      localStorage.removeItem("guest_workspace");
      useAuth.setState({ token: data.token, user: data.user, hydrated: true });
      
      trackEvent("calc_register_success");
      navigate("/weeks");
      return true;
    } catch (e: any) {
      const errMsg = e.response?.data?.error ?? "Ошибка сохранения";
      const isEmailTaken = typeof errMsg === "string" && /уже зарегистрирован/i.test(errMsg);
      if (isEmailTaken && confirm("Этот email уже зарегистрирован. Войти в аккаунт?")) {
        navigate("/login");
        return false;
      }
      alert(errMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave(email);
  };

  const downloadExcel = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const visibleEmployees = employees.filter(e => e.isVisible);
      const guestData = {
        startDate: employees[0].startDate,
        employees: visibleEmployees.map(e => ({ ...e, rate: String(e.rate) })),
      };
      
      const payload: any = {
        guestData,
        mode: viewMode,
        year: currentMonth.getFullYear(),
        exportMode: viewMode === "year" 
          ? (selectedYearEmpId === "all" ? "all" : "single")
          : (visibleEmployees.length > 1 ? "all" : "single"),
        selectedEmpId: viewMode === "year"
          ? (selectedYearEmpId === "all" ? visibleEmployees[0].id : selectedYearEmpId)
          : visibleEmployees[0].id,
      };

      const res = await api.post("/auth/calc-excel", payload, { responseType: "blob" });
      
      let filename = "Расписание смен.xlsx";
      const disposition = res.headers['content-disposition'];
      if (disposition) {
        // Ищем filename*=UTF-8''... или filename="..."
        const match = disposition.match(/filename\*=UTF-8''([^;]+)/i) || disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      
      const isZip = filename.endsWith('.zip');
      const mimeType = isZip ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // 1. Показываем модалку ДО скачивания
      setShowSaveModal(true);

      // 2. Скачиваем через скрытую ссылку (это сохранит имя файла)
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      alert("Не удалось скачать файл. Попробуйте позже.");
    } finally {
      setIsDownloading(false);
    }
  };

  const activeEmp = employees.find(e => e.id === activeEmpId)!;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/favicon.svg" alt="Логотип" className="w-8 h-8" />
          <span className="font-bold text-slate-900 hidden sm:block">Планировщик смен</span>
        </div>
        <button onClick={() => navigate("/login?mode=register")} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Войти / Регистрация
        </button>
      </header>

      {isLoggedIn && (
        <div className="max-w-7xl w-full mx-auto px-4 pt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <b>Вы авторизованы.</b> Это демо-калькулятор.{" "}
              <button onClick={() => navigate("/weeks")} className="underline font-medium hover:text-emerald-700">
                Перейти к реальному графику
              </button>.
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl w-full mx-auto px-4 pt-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Калькулятор графика смен онлайн
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-3xl">
          Рассчитайте график смен для команды: выберите цикл (2/2, 3/3, 1/1, сутки через трое и другие),
          укажите время смен и ставку — калькулятор посчитает смены, часы, ночные смены и затраты на месяц.
          Результат можно скачать в Excel.
        </p>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* ВЕРХНЯЯ ПАНЕЛЬ: Сохранение */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition-all">
          <div className="flex-1">
            {!isSaving ? (
              <p className="text-sm font-semibold text-rose-600 max-w-3xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                Все настройки смен хранятся у вас в браузере временно, чтобы их не потерять сохраните их на сайт.
              </p>
            ) : (
              <p className="text-sm text-slate-700 max-w-3xl animate-fade-in font-medium">
                Напишите email, чтобы мы привязали все смены к вашей почте на сайте и прислали на почту файл эксель со сменами.
              </p>
            )}
          </div>
          
          <div className="shrink-0">
            {!isSaving ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-center">
<button
                disabled={isDownloading}
                onClick={() => { void downloadExcel(); }}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-sm transition-all w-full xl:w-auto justify-center"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Скачать Excel
              </button>
              <button
                onClick={() => { setIsSaving(true); trackEvent("calc_save_click"); }}
                className="inline-flex items-center gap-2 bg-slate-100 text-slate-800 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 shadow-sm transition-all w-full xl:w-auto justify-center"
              >
                <Mail className="w-5 h-5" /> Сохранить на сайт
              </button>
</div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto animate-fade-in">
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Ваш email" 
                  required 
                  className="!py-3 !px-4 !w-full sm:!w-64 !text-sm" 
                />
                <button 
                  type="submit" 
                  disabled={loading || !email} 
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {loading ? "Привязка..." : "Привязать"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ: Левая панель и Календарь */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* ЛЕВАЯ ПАНЕЛЬ */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex flex-col gap-1">
              {employees.map(emp => (
                <div
                  key={emp.id}
                  onClick={() => setActiveEmpId(emp.id)}
                  className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left cursor-pointer ${activeEmpId === emp.id ? "bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: emp.color }} />
                    <span className="truncate">{emp.name}</span>
                  </div>
                  <button
                    onClick={(e) => removeEmployee(emp.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 ml-2"
                    title="Удалить сотрудника"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              
              <h3 className="font-bold text-lg text-slate-900 mb-4">Параметры</h3>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-1 mb-5 flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab("name")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${activeTab === "name" ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="text-slate-500">Имя:</span>
                  <span className="truncate max-w-[150px]">{activeEmp.name}</span>
                </button>
                <button
                  onClick={() => setActiveTab("rate")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${activeTab === "rate" ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="text-slate-500">Ставка:</span>
                  <span>{activeEmp.rate} ₽</span>
                </button>
                <button
                  onClick={() => setActiveTab("cycle")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${activeTab === "cycle" ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="text-slate-500">Цикл смен:</span>
                  <span className="text-right leading-snug ml-2 text-xs">{CYCLES[activeEmp.cycle].label}</span>
                </button>
                <button
                  onClick={() => setActiveTab("color")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${activeTab === "color" ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="text-slate-500">Цвет:</span>
                  <div className="flex items-center gap-2">
                    <span>{COLOR_NAMES[activeEmp.color] || "Свой"}</span>
                    <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: activeEmp.color }} />
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("time")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${activeTab === "time" ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="text-slate-500 shrink-0">Время:</span>
                  <div className="flex flex-col items-end">
                    <span>{activeEmp.startTime} - {activeEmp.endTime}</span>
                    {CYCLES[activeEmp.cycle].pattern && (
                      <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                        🌙 {activeEmp.nightStart} - {activeEmp.nightEnd}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              <div className="animate-fade-in border-t border-slate-100 pt-4">
                {activeTab === "name" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Имя сотрудника</label>
                      <input 
                        type="text" 
                        value={activeEmp.name} 
                        onChange={(e) => updateActiveEmp("name", e.target.value)}
                        className="w-full !py-2 !text-sm" 
                      />
                    </div>
                  </div>
                )}

                {activeTab === "color" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Цвет сотрудника</label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateActiveEmp("color", c)}
                          className={`w-7 h-7 rounded-full transition-all ${activeEmp.color === c ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "hover:scale-110"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "cycle" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Дата старта цикла</label>
                    <p className="text-[11px] text-slate-400 -mt-1 mb-2">В циклах с 🌙 ночные смены идут по отдельному времени — настройте его во вкладке «Время».</p>
                    <input 
                      type="date" 
                      value={activeEmp.startDate} 
                      onChange={(e) => updateActiveEmp("startDate", e.target.value)}
                      className="w-full !py-2 !text-sm" 
                    />
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 shadow-sm">
                    <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
                      <button 
                        onClick={() => setCycleSubTab("day")} 
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${cycleSubTab === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        Дневные
                      </button>
                      <button 
                        onClick={() => setCycleSubTab("night")} 
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${cycleSubTab === "night" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        Дневные с ночными
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CYCLES)
                        .filter(([_, data]) => cycleSubTab === "day" ? !data.pattern : !!data.pattern)
                        .map(([key, data]) => (
                        <button
                          key={key}
                          onClick={() => { updateActiveEmp("cycle", key); updateActiveEmp("pattern", (data as any).pattern || ""); }}
                          className={`py-2 text-sm font-medium rounded-xl border-2 transition-all ${activeEmp.cycle === key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                        >
                          {data.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "time" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Время дневной смены</label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={activeEmp.startTime} onChange={(e) => updateActiveEmp("startTime", e.target.value)} className="w-full !py-2 !text-sm text-center" />
                      <span className="text-slate-400 font-bold">—</span>
                      <input type="time" value={activeEmp.endTime} onChange={(e) => updateActiveEmp("endTime", e.target.value)} className="w-full !py-2 !text-sm text-center" />
                    </div>
                  </div>
                  {CYCLES[activeEmp.cycle].pattern && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Время ночной смены 🌙</label>
                      <div className="flex items-center gap-2">
                        <input type="time" value={activeEmp.nightStart} onChange={(e) => updateActiveEmp("nightStart", e.target.value)} className="w-full !py-2 !text-sm text-center" />
                        <span className="text-slate-400 font-bold">—</span>
                        <input type="time" value={activeEmp.nightEnd} onChange={(e) => updateActiveEmp("nightEnd", e.target.value)} className="w-full !py-2 !text-sm text-center" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rate" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Ставка (₽/час)</label>
                    <input 
                      type="number" 
                      value={activeEmp.rate} 
                      onChange={(e) => updateActiveEmp("rate", Number(e.target.value))}
                      className="w-full !py-2 !text-sm" 
                      min="0"
                    />
                  </div>
                </div>
              )}
              </div>

            </div>

            <div>
              <button
                onClick={addEmployee}
                disabled={employees.length >= 6}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center justify-center gap-2 bg-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-600"
              >
                <Plus className="w-4 h-4" /> Добавить сотрудника
              </button>
              <p className="text-xs text-slate-400 text-center mt-2 font-medium">
                Максимум 6 человек
              </p>
            </div>
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ (КАЛЕНДАРЬ) */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden w-full">
            
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex bg-slate-200 p-1 rounded-lg mr-2">
                  <button onClick={() => setViewMode("month")} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Месяц</button>
                  <button onClick={() => setViewMode("year")} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === "year" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Год</button>
                </div>
                <button onClick={() => {
                  if (viewMode === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
                  else setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1));
                }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="font-bold text-slate-900 text-lg min-w-[160px] text-center capitalize">
                  {viewMode === "month" ? `${MONTHS_RU[currentMonth.getMonth()]} ${currentMonth.getFullYear()}` : `${currentMonth.getFullYear()} год`}
                </div>
                <button onClick={() => {
                  if (viewMode === "month") setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
                  else setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1));
                }} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">{viewMode === 'year' ? "Смен за год" : "Смен за месяц"}</div>
                   <div className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalShifts : monthStats.shifts}</div>
                 </div>
                 <div className="w-px h-6 bg-slate-200" />
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">{viewMode === 'year' ? "Часов за год" : "Часов за месяц"}</div>
                   <div className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalHours : monthStats.hours}</div>
                 </div>
                 <div className="w-px h-6 bg-slate-200" />
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">Ночных смен</div>
                   <div className="font-bold text-slate-900">{viewMode === 'year' ? yearData.totalNightShifts : monthStats.nightShifts}</div>
                 </div>
                 <div className="w-px h-6 bg-slate-200" />
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">{viewMode === 'year' ? "Затраты за год" : "Затраты за месяц"}</div>
                   <div className="font-bold text-emerald-600">{viewMode === 'year' ? yearData.totalCost : monthStats.cost} ₽</div>
                 </div>
              </div>
            </div>

            {viewMode === "month" && (
            <>
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Показать:</span>
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={emp.isVisible} 
                    onChange={() => toggleVisibility(emp.id)}
                    className="!w-4 !h-4 !p-0 rounded accent-brand-600"
                  />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color }} />
                  <span className="text-sm text-slate-700 font-medium group-hover:text-slate-900 select-none">{emp.name}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_120px] bg-slate-50 border-b border-slate-200">
              {WEEKDAYS_RU.map((d, i) => (
                <div key={d} className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${i >= 5 ? "text-slate-400" : "text-slate-600"}`}>
                  {d}
                </div>
              ))}
              <div className="py-3 text-center text-xs font-bold text-slate-600 border-l border-slate-200 uppercase tracking-wider">
                Итого за неделю
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-200 gap-px">
              {weeks.map((week, wIdx) => {
                let weekShifts = 0;
                let weekHours = 0;
                
                week.forEach(dayObj => {
                  const workingEmps = getWorkingEmployees(dayObj.date);
                  workingEmps.forEach(emp => {
                    weekShifts += 1;
                    const s = getShiftForDay(emp, isNightDayFor(emp, dayObj.date));
                    weekHours += getShiftHours(s.start, s.end);
                  });
                });
                weekHours = Math.round(weekHours * 10) / 10;

                return (
                  <div key={wIdx} className="grid grid-cols-[repeat(7,minmax(0,1fr))_120px] flex-1">
                    {week.map((dayObj, i) => {
                      const { date, isOtherMonth } = dayObj;
                      const workingEmps = getWorkingEmployees(date);
                      const isToday = date.toDateString() === today.toDateString();

                      return (
                        <div 
                          key={i} 
                          onClick={() => {
                            if (!isOtherMonth && workingEmps.length > 0) {
                              setSelectedDayInfo({ date, emps: workingEmps });
                            }
                          }}
                          className={`relative flex flex-col transition-all min-h-[110px] group border-r border-slate-200/80 last:border-r-0 ${isOtherMonth ? "opacity-40 bg-slate-50" : "cursor-pointer hover:ring-2 hover:ring-brand-500 hover:z-10 hover:shadow-lg"}`}
                        >
                          <div className="absolute top-1.5 left-1.5 z-20">
                            <span className={`text-sm ${workingEmps.length > 0 ? "text-white font-bold drop-shadow-md" : isToday && !isOtherMonth ? "bg-brand-600 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-0.5" : "text-slate-900 font-medium"}`}>
                              {date.getDate()}
                            </span>
                          </div>

                          <div className="flex-1 flex flex-col w-full h-full pointer-events-none">
                            {workingEmps.length === 0 ? (
                              <div className="flex-1 bg-white"></div>
                            ) : (
                              workingEmps.map(emp => (
                                <div 
                                  key={emp.id} 
                                  className="flex-1 w-full flex items-center justify-center pt-5 pb-1"
                                  style={{ backgroundColor: emp.color, filter: isNightDayFor(emp, date) ? "brightness(0.6) saturate(0.7)" : undefined }}
                                >
                                  <span className="text-[11px] font-semibold text-white drop-shadow-md">
                                    {(() => { const nd = isNightDayFor(emp, date); const s = getShiftForDay(emp, nd); return <>{nd ? "🌙 " : ""}{s.start}–{s.end}</>; })()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="bg-slate-50/50 border-l border-slate-200 p-2 flex flex-col justify-center items-center text-center">
                      <div className="text-sm font-bold text-slate-900">{weekShifts} см.</div>
                      <div className="text-xs text-slate-500 mt-1">{weekHours} ч.</div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
            )}

            {viewMode === "year" && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 bg-slate-50">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center mr-2">Сотрудник:</span>
                  <button
                    onClick={() => setSelectedYearEmpId("all")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${selectedYearEmpId === "all" ? "bg-white border-brand-500 text-slate-900 shadow-sm ring-1 ring-brand-500/20" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                  >
                    Все
                  </button>
                  {employees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedYearEmpId(emp.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${selectedYearEmpId === emp.id ? "bg-white border-brand-500 text-slate-900 shadow-sm ring-1 ring-brand-500/20" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: emp.color }} />
                      {emp.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {MONTHS_RU.map((monthName, mIdx) => {
                    const daysInMonth = new Date(currentMonth.getFullYear(), mIdx + 1, 0).getDate();
                    const firstDay = new Date(currentMonth.getFullYear(), mIdx, 1);
                    let startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

                    return (
                      <div key={monthName} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="font-bold text-slate-800 text-sm mb-2 capitalize text-center">{monthName}</div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                           {WEEKDAYS_RU.map(d => <div key={d} className="text-[9px] font-bold text-slate-400">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} className="w-full aspect-square" />)}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const date = new Date(currentMonth.getFullYear(), mIdx, day);
                            const allWorking = getWorkingEmployees(date);
                            const working = selectedYearEmpId === "all" ? allWorking : allWorking.filter(w => w.id === selectedYearEmpId);

                            return (
                              <div
                                key={day}
                                title={`${day} ${monthName}${working.length ? ` (${working.map(w=>w.name).join(", ")})` : ""}`}
                                className="relative w-full aspect-square rounded-sm flex flex-col overflow-hidden border border-white/20"
                              >
                                {working.length === 0 ? (
                                  <div className="flex-1 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">{day}</div>
                                ) : (
                                  <>
                                    <div className="absolute inset-0 flex flex-col">
                                      {working.map(w => {
                                        const isNight = isNightDayFor(w, date);
                                        return <div key={w.id} className="flex-1 w-full" style={{ backgroundColor: isNight ? '#1e293b' : w.color }} />
                                      })}
                                    </div>
                                    <div className="relative z-10 flex items-center justify-center w-full h-full">
                                      <span className={`text-[10px] font-bold text-white ${working.length > 1 ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" : ""}`}>
                                        {working.length === 1 && isNightDayFor(working[0], date) ? '🌙' : day}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">Месяц</th>
                        <th className="px-4 py-3 text-center">Смены</th>
                        <th className="px-4 py-3 text-center">Часы</th>
                        <th className="px-4 py-3 text-center">Ночные</th>
                        <th className="px-4 py-3 text-right">Затраты</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {yearData.monthlyData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 capitalize">{row.month}</td>
                          <td className="px-4 py-2 text-center">{row.shifts}</td>
                          <td className="px-4 py-2 text-center">{row.hours}</td>
                          <td className="px-4 py-2 text-center">{row.nightShifts}</td>
                          <td className="px-4 py-2 text-right text-emerald-600 font-medium">{row.cost} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-3">Итого за год</td>
                        <td className="px-4 py-3 text-center">{yearData.totalShifts}</td>
                        <td className="px-4 py-3 text-center">{yearData.totalHours}</td>
                        <td className="px-4 py-3 text-center">{yearData.totalNightShifts}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{yearData.totalCost} ₽</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Модалка после скачивания */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Файл скачан</h3>
            <p className="text-slate-600 mb-4 text-sm">
              Файл скачан. Если хотите сохранить расписание на сайте, то привяжите свою почту.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full mb-4 animate-fade-in">
              <input 
                type="email" 
                value={modalEmail} 
                onChange={(e) => setModalEmail(e.target.value)} 
                placeholder="Ваш email" 
                className="!py-3 !px-4 !w-full !text-sm" 
              />
              <button 
                onClick={async () => {
                  const ok = await performSave(modalEmail);
                  if (ok) setShowSaveModal(false);
                }}
                disabled={loading || !modalEmail} 
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? "Отправка..." : "Отправить"}
              </button>
            </div>
            <button onClick={() => setShowSaveModal(false)} className="mt-4 text-sm text-slate-500 hover:text-slate-700 font-medium">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка просмотра смен */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedDayInfo(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-2xl leading-none">
                  {WEEKDAYS_RU[selectedDayInfo.date.getDay() === 0 ? 6 : selectedDayInfo.date.getDay() - 1]}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedDayInfo.date.getDate()} {SHORT_MONTHS_RU[selectedDayInfo.date.getMonth()]}
                </p>
              </div>
            </div>

            <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center justify-center gap-3 mb-4 shadow-inner">
              <span className="text-sm font-semibold text-slate-800">{selectedDayInfo.emps.length} см.</span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-sm font-semibold text-slate-800">
                {Math.round(selectedDayInfo.emps.reduce((acc, emp) => { const s = getShiftForDay(emp, isNightDayFor(emp, selectedDayInfo.date)); return acc + getShiftHours(s.start, s.end); }, 0) * 10) / 10} ч.
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-sm font-semibold text-slate-800">
                {Math.round(selectedDayInfo.emps.reduce((acc, emp) => { const s = getShiftForDay(emp, isNightDayFor(emp, selectedDayInfo.date)); return acc + getShiftHours(s.start, s.end) * emp.rate; }, 0))} ₽
              </span>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {selectedDayInfo.emps.map(emp => {
                const nightDay = isNightDayFor(emp, selectedDayInfo.date);
                const s = getShiftForDay(emp, nightDay);
                const hrs = getShiftHours(s.start, s.end);
                return (
                  <div key={emp.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm border-l-[4px]" style={{ borderLeftColor: emp.color }}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{nightDay ? "🌙 " : ""}{s.start}–{s.end}</span>
                      <span className="text-slate-400 font-normal">({hrs} ч.)</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-sm font-medium text-slate-700 truncate pr-2">
                        {emp.name}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        {emp.rate} ₽/ч
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={() => setSelectedDayInfo(null)} 
              className="w-full mt-5 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-colors text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
