import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ChevronUp, ChevronDown, ListChecks, X, AlertCircle } from "lucide-react";
import { useAuth } from "../store/auth";
import { useUsers } from "../store/users";
import { useAreas } from "../store/areas";
import { useShiftTemplates } from "../store/shiftTemplates";
import { useWeeks } from "../store/weeks";

export default function OnboardingWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem("onboarding_dismissed") === "true");

  const { items: users, fetch: fetchUsers } = useUsers();
  const { items: areas, fetch: fetchAreas } = useAreas();
  const { items: templates, fetch: fetchTemplates } = useShiftTemplates();
  const { weeks, fetchWeeks } = useWeeks();

  const dismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("onboarding_dismissed", "true");
  };

  useEffect(() => {
    const handleOpen = () => {
      setIsDismissed(false);
      setIsOpen(true);
      localStorage.removeItem("onboarding_dismissed");
    };
    window.addEventListener("show-onboarding", handleOpen);
    return () => window.removeEventListener("show-onboarding", handleOpen);
  }, []);

  // Подгружаем данные, если их нет
  useEffect(() => {
    if (user && user.role !== "EMPLOYEE" && !isDismissed) {
      if (users.length === 0) fetchUsers();
      if (areas.length === 0) fetchAreas();
      if (templates.length === 0) fetchTemplates();
      if (weeks.length === 0) fetchWeeks();
    }
  }, [user, isDismissed, users.length, areas.length, templates.length, weeks.length, fetchUsers, fetchAreas, fetchTemplates, fetchWeeks]);

  // Показываем только авторизованным владельцам и менеджерам
  if (!user || user.role === "EMPLOYEE" || isDismissed) return null;

  const hasUsers = users.length > 0;
  const hasAreas = areas.length > 0;
  const hasAssignedUsers = users.some((u) => (u.areaIds && u.areaIds.length > 0) || (u.locationIds && u.locationIds.length > 0));
  const hasTemplates = templates.length > 0;
  const hasSchedule = weeks.some((w) => w.shifts && w.shifts.length > 0);

  const steps = [
    {
      title: "Создайте сотрудников",
      desc: "В разделе «Сотрудники» добавьте их вручную или загрузите Excel.",
      done: hasUsers,
      link: "/team",
    },
    {
      title: "Создайте локацию",
      desc: "В «Шаблоны» → «Локации» создайте помещение (Кухня, Зал и т.д.).",
      done: hasAreas,
      link: "/templates?tab=areas",
    },
    {
      title: "Привяжите сотрудников",
      desc: "В разделе «Сотрудники» (Матрица) отметьте, кто в какой локации работает.",
      done: hasAssignedUsers,
      link: "/team",
    },
    {
      title: "Создайте шаблон смен",
      desc: "В «Шаблоны» → «Смены» добавьте график (например, Утро 08:00–16:00).",
      done: hasTemplates,
      link: "/templates?tab=shifts",
    },
    {
      title: "Создайте расписание",
      desc: "В разделе «Недели» расставьте смены и обязательно нажмите кнопку «Опубликовать».",
      done: hasSchedule,
      link: "/weeks",
    },
  ];

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-[90] w-80 max-w-[calc(100vw-2rem)] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm">С чего начать</div>
              <div className="text-[10px] text-slate-500">Шаги для запуска</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={dismiss} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Скрыть подсказку">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Тело */}
        {isOpen && (
          <div className="p-3 max-h-[70vh] overflow-y-auto">
            {!hasUsers ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-900">Никто не загружен</span>
                </div>
                <p className="text-xs text-amber-800 mb-2">
                  У вас пока нет ни одного сотрудника. Без них невозможно составить график.
                </p>
                <Link to="/team" className="inline-block bg-white text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
                  Перейти к сотрудникам
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${step.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {step.title}
                      </div>
                      {!step.done && (
                        <>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {step.desc}
                          </div>
                          <Link to={step.link} className="text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline mt-1 inline-block">
                            Перейти →
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasUsers && steps.every((s) => s.done) && (
              <div className="mt-4 bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-center">
                <div className="text-lg mb-1">🎉</div>
                <div className="text-sm font-semibold text-emerald-900">Всё готово!</div>
                <div className="text-xs text-emerald-700">Вы настроили систему и можете работать.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
