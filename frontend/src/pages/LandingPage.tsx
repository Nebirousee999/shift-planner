import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bell, Calendar, Palmtree, BarChart3,
  ArrowRightLeft, FileText, FileSpreadsheet, Sparkles, Loader2,
} from "lucide-react";

import { trackEvent } from "../lib/metrika";
import Reveal from "../components/ui/Reveal";
import LazySection from "../components/ui/LazySection";

// Базовые компоненты (Загружаются сразу)
import TopBar from "../components/landing/TopBar";
import TrustBar from "../components/landing/TrustBar";
import LandingHeader from "../components/landing/LandingHeader";
import HeroSection from "../components/landing/HeroSection";
import SocialProof from "../components/landing/SocialProof";
import FeaturesOverview from "../components/landing/FeaturesOverview";
import ForWhom from "../components/landing/ForWhom";
import FeatureSection from "../components/landing/FeatureSection";
import ProblemSolution from "../components/landing/ProblemSolution";
import HowItWorks from "../components/landing/HowItWorks";
import PricingSection from "../components/landing/PricingSection";
import FAQSection from "../components/landing/FAQSection";
import FinalCTA from "../components/landing/FinalCTA";
import LandingFooter from "../components/landing/LandingFooter";
import SeoLandingBlock from "../components/landing/SeoLandingBlock";

// Демо-виджеты (Ленивая загрузка: скачиваются только при скролле)
const DashboardDemo = lazy(() => import("../components/landing/demos/DashboardDemo"));
const NotificationsDemo = lazy(() => import("../components/landing/demos/NotificationsDemo"));
const WeekDemo = lazy(() => import("../components/landing/demos/WeekDemo"));
const VacationsDemo = lazy(() => import("../components/landing/demos/VacationsDemo"));
const AnalyticsDemo = lazy(() => import("../components/landing/demos/AnalyticsDemo"));
const TimesheetDemo = lazy(() => import("../components/landing/demos/TimesheetDemo"));
const SwapsDemo = lazy(() => import("../components/landing/demos/SwapsDemo"));
const DocumentsDemo = lazy(() => import("../components/landing/demos/DocumentsDemo"));

const FallbackLoader = () => (
  <div className="h-[500px] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
  </div>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [interactions, setInteractions] = useState(0);

  useEffect(() => {
    if (location.state?.scrollTo) {
      const href = location.state.scrollTo;
      const timer = setTimeout(() => {
        const el = document.querySelector(href);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Планировщик смен — график для кафе и магазинов";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
      created = true;
    }
    const prevDesc = meta.content;
    meta.content = "Планируйте смены за 5 минут, согласовывайте отпуска и генерируйте приказы по ТК. Бесплатно для команд до 3 человек.";
    return () => {
      document.title = prevTitle;
      if (created && meta) document.head.removeChild(meta);
      else if (meta) meta.content = prevDesc;
    };
  }, []);

  const handleInteract = () => {
    if (interactions === 0) trackEvent("Demo_interact");
    setInteractions((n) => n + 1);
  };

  const handleRegisterClick = async (source: string, target: string = "/") => {
    trackEvent("CTA_click", { source });
    if (localStorage.getItem("isGuest") === "true" && localStorage.getItem("token")) {
      window.location.href = target;
      return;
    }
    try {
      const { api } = await import("../api/client");
      const { data } = await api.post("/auth/guest-seed");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("isGuest", "true");
      localStorage.removeItem("activeLocationId");
      localStorage.removeItem("guest_workspace");
      localStorage.removeItem("guest_db");
      localStorage.removeItem("guest_db_version");
      localStorage.removeItem("guest_shifts");
      localStorage.removeItem("guestEmailAttached");
      window.location.href = target;
    } catch (e) {
      console.error("Ошибка создания гостевой сессии:", e);
      navigate("/login?mode=register");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <LandingHeader onStartGuest={handleRegisterClick} />

      <main>
        {/* 1. Hero (Мгновенная загрузка) */}
        <HeroSection onCtaClick={() => handleRegisterClick("hero")} />
        <Reveal><TrustBar /></Reveal>
        <Reveal><SocialProof /></Reveal>
        <Reveal><FeaturesOverview /></Reveal>

        {/* 2. Демо-секции (Отложенная загрузка при скролле) */}
        <Reveal>
          <FeatureSection
            id="dashboard-demo"
            variant="light"
            eyebrow="Дашборд руководителя"
            icon={LayoutDashboard}
            title="Кто на смене прямо сейчас"
            description="Таймлайн дня с сменами всех сотрудников. Наведите на смену — увидите опоздания, ранний уход и переработки. Кликните — поставьте в один клик."
            bullets={["Всё в реальном времени", "Опоздания и переработки подсвечены", "Дисциплина — в 2 клика"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <DashboardDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="notifications-demo"
            variant="tinted"
            eyebrow="Уведомления"
            icon={Bell}
            title="Сотрудники всегда в курсе"
            description="Больше не нужно звонить и писать каждому. Бот в MAX напомнит о смене, сообщит об изменениях в графике и предложит обменяться — в один клик."
            bullets={["Уведомления прямо в MAX", "Напоминания за N часов до смены", "Кнопки «Принять» / «Отклонить» прямо в чате"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <NotificationsDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="weeks-demo"
            variant="light"
            eyebrow="Расписание смен"
            icon={Calendar}
            title="Планируйте неделю за 5 минут"
            description="Перетаскивайте смены между днями, копируйте целые дни одной кнопкой, проверяйте 40-часовую норму и пересечения."
            bullets={["Drag-and-drop и копирование смен/дней", "Проверка ТК РФ при публикации", "Удаление в один клик"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <WeekDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="vacations-demo"
            variant="tinted"
            eyebrow="Отпуска и больничные"
            icon={Palmtree}
            title="Гант-календарь отпусков"
            description="Сотрудник запрашивает отпуск — руководитель видит пересечения по календарю и согласовывает в один клик. Полосы отпусков можно перетаскивать и растягивать."
            bullets={["Перетаскивание и растягивание полос", "Согласование заявок в один клик", "Видно сразу все отпуска команды"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <VacationsDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="analytics-demo"
            variant="light"
            eyebrow="Аналитика"
            icon={BarChart3}
            title="ФОТ, переработки и пики нагрузки"
            description="Переключайте месяцы — цифры меняются плавно. Сравнение с прошлым месяцем, структура ФОТ по сотрудникам и должностям, нагрузка по дням недели."
            bullets={["MoM-динамика по всем метрикам", "Пики нагрузки — куда ставить больше людей", "Кто и сколько «съедает» из бюджета"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <AnalyticsDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="timesheet-demo"
            variant="tinted"
            eyebrow="Табели и зарплата"
            icon={FileSpreadsheet}
            title="Табель, готовый для бухгалтерии"
            description="Забудьте про ручной подсчёт часов в Excel. Система сама соберёт отработанное время, учтёт отпуска и больничные, посчитает зарплату и выгрузит табель в один клик."
            bullets={["Автоматический подсчёт часов", "Учёт отпусков (ОТ) и больничных (Б)", "Выгрузка в Excel для бухгалтера"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <TimesheetDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="swaps-demo"
            variant="light"
            eyebrow="Обмены сменами"
            icon={ArrowRightLeft}
            title="Сотрудники меняются сами"
            description="Сотрудник предлагает смену — коллеги откликаются. Вы видите всё в одном месте: кто кому, какая смена, что принято, что отклонено. Без звонков и мессенджеров."
            bullets={["Открытые и адресные предложения", "Принять / отклонить в один клик", "История всех обменов"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <SwapsDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        <Reveal>
          <FeatureSection
            id="documents-demo"
            variant="tinted"
            eyebrow="Документы по ТК"
            icon={FileText}
            title="Приказы и журналы за 30 секунд"
            description="Выберите шаблон, сотрудника — должность подтянется автоматически. Получите готовый DOCX с реквизитами. Или загрузите свой шаблон с плейсхолдерами."
            bullets={["Готовые формы: приёмы, отпуска, инструктажи", "Свой шаблон через .docx с {плейсхолдерами}", "Массовая генерация из Excel → ZIP"]}
            demo={
              <LazySection height="500px">
                <Suspense fallback={<FallbackLoader />}>
                  <DocumentsDemo onInteract={handleInteract} />
                </Suspense>
              </LazySection>
            }
          />
        </Reveal>

        {/* 4. Информационные секции */}
        <Reveal><ForWhom /></Reveal>
        <Reveal><ProblemSolution /></Reveal>
        <Reveal><HowItWorks /></Reveal>
        <Reveal><PricingSection onStartGuest={handleRegisterClick} /></Reveal>
        <Reveal><FAQSection /></Reveal>
        
        {/* 5. Финальный CTA */}
        <Reveal>
          <FinalCTA onCtaClick={() => handleRegisterClick("final_cta")} />
        </Reveal>
      </main>

      <SeoLandingBlock />
      <LandingFooter />

      {interactions > 0 && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <button
            onClick={() => handleRegisterClick("floating_cta")}
            className="inline-flex items-center gap-2 px-5 py-3 bg-brand-600 text-white rounded-full shadow-xl shadow-brand-500/30 hover:bg-brand-700 text-sm font-semibold transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Начать бесплатно
          </button>
        </div>
      )}
    </div>
  );
}
