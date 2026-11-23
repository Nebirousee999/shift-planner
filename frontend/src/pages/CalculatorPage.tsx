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
  cycle: "2/2" | "3/3" | "1/3" | "5/2";
  startTime: string;
  endTime: string;
  rate: number;
  startDate: string;
  isVisible: boolean;
  password?: string;
};

const CYCLES = {
  "2/2": { work: 2, off: 2, label: "2/2" },
  "3/3": { work: 3, off: 3, label: "3/3" },
  "1/3": { work: 1, off: 3, label: "1/3" },
  "5/2": { work: 5, off: 2, label: "5/2" },
};

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#6366f1", "#ec4899"];
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
      startDate: today.toISOString().slice(0, 10), isVisible: true 
    }
  ]);
  
  const [activeEmpId, setActiveEmpId] = useState<string>("1");
  const [activeTab, setActiveTab] = useState<"cycle" | "time" | "rate">("cycle");
  const [selectedDayInfo, setSelectedDayInfo] = useState<{date: Date, emps: Employee[]} | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const isLoggedIn = !!useAuth((s) => s.token);

  const addEmployee = () => {
      if (employees.length >= 3) {
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
      isVisible: true
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

      return dayInCycle < config.work;
    });
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
    
    calendarDays.forEach(dayObj => {
      if (dayObj.isOtherMonth) return;
      const workingEmps = getWorkingEmployees(dayObj.date);
      workingEmps.forEach(emp => {
        const h = getShiftHours(emp.startTime, emp.endTime);
        shifts += 1;
        hours += h;
        cost += h * emp.rate;
      });
    });
    
    return { shifts, hours: Math.round(hours * 10) / 10, cost: Math.round(cost) };
  }, [calendarDays, employees]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const guestData = { 
        startDate: employees[0].startDate, 
        employees: employees.map(e => ({ ...e, rate: String(e.rate) })) 
      };
      const { data } = await api.post("/auth/quick-register", { email, name, guestData });
      
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
    } catch (e: any) {
      const errMsg = e.response?.data?.error ?? "Ошибка сохранения";
      const isEmailTaken = typeof errMsg === "string" && /уже зарегистрирован/i.test(errMsg);
      if (isEmailTaken && confirm("Этот email уже зарегистрирован. Войти в аккаунт?")) {
        navigate("/login");
        return;
      }
      alert(errMsg);
    } finally {
      setLoading(false);
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
              <button 
                onClick={() => {
              setIsSaving(true);
              trackEvent("calc_save_click");
            }}
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-sm transition-all w-full xl:w-auto justify-center"
              >
                <Download className="w-5 h-5" /> Сохранить и скачать
              </button>
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
                  {loading ? "Отправка..." : "Отправить"}
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
              
              <h3 className="font-bold text-lg text-slate-900 mb-4">Параметры: {activeEmp.name}</h3>

              <div className="mb-5">
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

              <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
                <button
                  onClick={() => setActiveTab("cycle")}
                  className={`flex-1 flex items-center justify-center py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === "cycle" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Цикл
                </button>
                <button
                  onClick={() => setActiveTab("time")}
                  className={`flex-1 flex items-center justify-center py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === "time" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Время
                </button>
                <button
                  onClick={() => setActiveTab("rate")}
                  className={`flex-1 flex items-center justify-center py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === "rate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Ставка
                </button>
              </div>

              {activeTab === "cycle" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Цикл смен</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CYCLES).map(([key, data]) => (
                        <button
                          key={key}
                          onClick={() => updateActiveEmp("cycle", key)}
                          className={`py-2 text-sm font-medium rounded-xl border-2 transition-all ${activeEmp.cycle === key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
                        >
                          {data.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Дата старта цикла</label>
                    <input 
                      type="date" 
                      value={activeEmp.startDate} 
                      onChange={(e) => updateActiveEmp("startDate", e.target.value)}
                      className="w-full !py-2 !text-sm" 
                    />
                  </div>
                </div>
              )}

              {activeTab === "time" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Начало смены</label>
                    <div className="flex gap-2">
                      <select value={activeEmp.startTime.split(':')[0]} onChange={(e) => updateActiveEmp("startTime", `${e.target.value}:${activeEmp.startTime.split(':')[1]}`)} className="w-full !py-2 !text-sm text-center">
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="flex items-center font-bold text-slate-400">:</span>
                      <select value={activeEmp.startTime.split(':')[1]} onChange={(e) => updateActiveEmp("startTime", `${activeEmp.startTime.split(':')[0]}:${e.target.value}`)} className="w-full !py-2 !text-sm text-center">
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Конец смены</label>
                    <div className="flex gap-2">
                      <select value={activeEmp.endTime.split(':')[0]} onChange={(e) => updateActiveEmp("endTime", `${e.target.value}:${activeEmp.endTime.split(':')[1]}`)} className="w-full !py-2 !text-sm text-center">
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="flex items-center font-bold text-slate-400">:</span>
                      <select value={activeEmp.endTime.split(':')[1]} onChange={(e) => updateActiveEmp("endTime", `${activeEmp.endTime.split(':')[0]}:${e.target.value}`)} className="w-full !py-2 !text-sm text-center">
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
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

            <div>
              <button
                onClick={addEmployee}
                disabled={employees.length >= 3}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center justify-center gap-2 bg-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-600"
              >
                <Plus className="w-4 h-4" /> Добавить сотрудника
              </button>
              <p className="text-xs text-slate-400 text-center mt-2 font-medium">
                Максимум 3 человека
              </p>
            </div>
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ (КАЛЕНДАРЬ) */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden w-full">
            
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="font-bold text-slate-900 text-lg min-w-[160px] text-center capitalize">
                  {MONTHS_RU[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">Смен за месяц</div>
                   <div className="font-bold text-slate-900">{monthStats.shifts}</div>
                 </div>
                 <div className="w-px h-6 bg-slate-200" />
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">Часов за месяц</div>
                   <div className="font-bold text-slate-900">{monthStats.hours}</div>
                 </div>
                 <div className="w-px h-6 bg-slate-200" />
                 <div className="text-center">
                   <div className="text-[10px] text-slate-500 uppercase font-semibold">Затраты за месяц</div>
                   <div className="font-bold text-emerald-600">{monthStats.cost} ₽</div>
                 </div>
              </div>
            </div>

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
                    weekHours += getShiftHours(emp.startTime, emp.endTime);
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
                                  style={{ backgroundColor: emp.color }}
                                >
                                  <span className="text-[11px] font-semibold text-white drop-shadow-md">
                                    {emp.startTime}–{emp.endTime}
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
          </div>
        </div>
      </main>

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
                {Math.round(selectedDayInfo.emps.reduce((acc, emp) => acc + getShiftHours(emp.startTime, emp.endTime), 0) * 10) / 10} ч.
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-sm font-semibold text-slate-800">
                {Math.round(selectedDayInfo.emps.reduce((acc, emp) => acc + getShiftHours(emp.startTime, emp.endTime) * emp.rate, 0))} ₽
              </span>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {selectedDayInfo.emps.map(emp => {
                const hrs = getShiftHours(emp.startTime, emp.endTime);
                return (
                  <div key={emp.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm border-l-[4px]" style={{ borderLeftColor: emp.color }}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{emp.startTime}–{emp.endTime}</span>
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
