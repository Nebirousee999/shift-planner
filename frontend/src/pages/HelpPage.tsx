import { useState, useMemo } from "react";
import {
  Search,
  Rocket,
  Calendar,
  Users,
  Palmtree,
  Clock,
  BarChart3,
  FileText,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  ArrowRightLeft,
  Bell,
  Stethoscope,
} from "lucide-react";
import NavBar from "../components/NavBar";
import { useOrganization } from "../store/organization";
import { useAuth } from "../store/auth";

// ─── Типы данных ───────────────────────────────────
type HelpArticle = {
  id: string;
  category: string;
  title: string;
  content: React.ReactNode;
};

// ─── Контент справки ───────────────────────────────
const ARTICLES: HelpArticle[] = [
  // ─── СТАРТ И НАСТРОЙКИ ───
  {
    id: "start-1",
    category: "Старт и настройки",
    title: "Как зарегистрироваться и начать работу",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>1. На главной странице нажмите кнопку <b>«Попробовать бесплатно»</b>.</p>
        <p>2. Заполните форму: ваше имя, название заведения, email и пароль (минимум 8 символов).</p>
        <p>3. После регистрации система автоматически создаст вашу Организацию и первую Точку (по умолчанию «Основная»).</p>
        <p>4. Перейдите в раздел <b>«Сотрудники»</b>, чтобы добавить команду.</p>
      </div>
    ),
  },
  {
    id: "start-2",
    category: "Старт и настройки",
    title: "Роли в системе (Владелец, Менеджер, Сотрудник)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p><b>Владелец (OWNER)</b> — имеет полный доступ ко всем разделам, настройкам тарифов, реквизитам и сотрудникам.</p>
        <p><b>Менеджер (MANAGER)</b> — может управлять расписанием, точками, отпусками, документами и аналитикой. Не имеет доступа к платежным данным.</p>
        <p><b>Сотрудник (EMPLOYEE)</b> — видит только свой график («Мой график»), свои отпуска, больничные, может отмечать приход/уход и запрашивать обмены сменами.</p>
      </div>
    ),
  },

  // ─── СОТРУДНИКИ И ТОЧКИ ───
  {
    id: "team-1",
    category: "Сотрудники и точки",
    title: "Как добавить сотрудника вручную",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Перейдите в раздел <b>«Пользователи» → «Сотрудники»</b>.</p>
        <p>Нажмите «Добавить». Укажите ФИО, email, роль, должность и ставку (или оклад).</p>
        <p>После сохранения система сгенерирует временный пароль. Скопируйте его и передайте сотруднику.</p>
      </div>
    ),
  },
  {
    id: "team-2",
    category: "Сотрудники и точки",
    title: "Как импортировать команду из Excel",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>1. В разделе «Сотрудники» нажмите <b>«Скачать шаблон»</b>.</p>
        <p>2. Заполните таблицу (Имя, Email, Должность, Ставка, Телефон).</p>
        <p>3. Нажмите <b>«Загрузить Excel»</b> и выберите файл. Система создаст всех сотрудников и выдаст список временных паролей.</p>
      </div>
    ),
  },

  // ─── РАСПИСАНИЕ И СМЕНЫ ───
  {
    id: "schedule-1",
    category: "Расписание и смены",
    title: "Как создать график на неделю (для менеджера)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>1. Перейдите в <b>«Недели»</b> и нажмите на пустую неделю в календаре.</p>
        <p>2. Внутри недели нажмите кнопку <b>«Редактировать»</b> (карандаш вверху).</p>
        <p>3. В нужном дне нажмите <b>«+ смена»</b>. Выберите шаблон (например, «Утренняя»), сотрудника и время.</p>
        <p>4. Вы можете перетаскивать смены мышкой между днями и копировать целые дни.</p>
        <p>5. Нажмите <b>«Опубликовать»</b>, чтобы сотрудники увидели изменения.</p>
      </div>
    ),
  },
  {
    id: "schedule-2",
    category: "Расписание и смены",
    title: "Что происходит, если менеджер меняет опубликованную смену",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Если вы меняете смену в уже <b>опубликованной</b> неделе, система действует по настройкам согласования:</p>
        <p><b>Согласование включено:</b> сотруднику в колокольчик приходит запрос («Запрос на изменение смены»). Он должен нажать «Принять» или «Отклонить».</p>
        <p><b>Согласование выключено:</b> смена меняется сразу, а сотруднику в колокольчик просто приходит уведомление «Смена изменена» (было → стало).</p>
      </div>
    ),
  },

  // ─── ОБМЕНЫ СМЕНАМИ ───
  {
    id: "swaps-1",
    category: "Обмены сменами",
    title: "Как создать и отменить запрос на обмен",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>1. В разделе <b>«Мой график»</b> найдите свою смену и нажмите <b>«Обмен»</b>.</p>
        <p>2. Выберите тип обмена: «Открытая смена» (увидят все) или «Конкретный сотрудник».</p>
        <p>3. Отслеживать свои запросы можно в разделе <b>«Обмены»</b>. Если запрос еще висит в статусе «Ожидает», вы можете отменить его, нажав кнопку <b>«Отменить»</b> (иконка корзины).</p>
      </div>
    ),
  },
  {
    id: "swaps-2",
    category: "Обмены сменами",
    title: "Как принять или отклонить обмен",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Если коллега предлагает вам обмен, вы увидите это в трех местах:</p>
        <p>1. <b>В «Моём графике»:</b> прямо в сетке дня появится фиолетовая карточка с кнопками.</p>
        <p>2. <b>В колокольчике:</b> нажмите на уведомление и выберите действие.</p>
        <p>3. <b>В разделе «Обмены»:</b> на вкладке «Ожидают».</p>
        <p>При нажатии «Принять» смена перейдет к вам, а автор и менеджер получат уведомления. Если нажать «Отклонить», запрос уйдет в архив вкладки «Отклонены».</p>
      </div>
    ),
  },

  // ─── УВЕДОМЛЕНИЯ ───
  {
    id: "notif-1",
    category: "Уведомления",
    title: "Как работает колокольчик",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Колокольчик (в шапке сайта) собирает важные события. Кружочек с цифрой показывает количество непрочитанных.</p>
        <p>Здесь приходят:</p>
        <ul className="list-disc pl-5">
          <li>Изменения смен менеджером.</li>
          <li>Запросы на обмен сменами от коллега.</li>
          <li>Уведомления о том, что кто-то принял ваш обмен.</li>
          <li>Информация об одобрении отпусков и больничных.</li>
        </ul>
      </div>
    ),
  },

  // ─── ОТПУСКА И БОЛЬНИЧНЫЕ ───
  {
    id: "vac-1",
    category: "Отпуска и больничные",
    title: "Как работает больничный",
    content: (
      <div className="space-y-3 text-slate-600">
        <p><b>Для менеджера:</b> перейдите в раздел <b>«Больничные»</b>. Нажмите «Добавить», выберите сотрудника и укажите даты.</p>
        <p><b>Для сотрудника:</b> в разделе <b>«Мой график»</b> появилась вкладка <b>«Больничные»</b>. Там отображается Гант-календарь (как у менеджера), где сотрудник видит свои больничные (в режиме чтения).</p>
      </div>
    ),
  },

  // ─── УЧЕТ ВРЕМЕНИ И ТАБЕЛЬ ───
  {
    id: "time-1",
    category: "Учёт времени и табель",
    title: "Как читать Табель (для менеджера)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>В разделе <b>«Табель»</b> отображается сетка за месяц.</p>
        <p>Система использует буквенные обозначения: <b>ОТ</b> (отпуск), <b>Б</b> (больничный), <b>НН</b> (неявка), <b>ПР</b> (прогул), <b>В</b> (выходной).</p>
        <p>Вместо буквы <b>«Я» (явка)</b> система автоматически пишет <b>фактическое количество часов</b>, отработанных сотрудником в этот день (например, «8» или «7.5»).</p>
      </div>
    ),
  },

  // ─── АНАЛИТИКА (ПОДРОБНО) ───
  {
    id: "analytics-all",
    category: "Аналитика",
    title: "Разбор вкладок и показателей в Аналитике",
    content: (
      <div className="space-y-6 text-slate-600">
        <p>Раздел «Аналитика» помогает понять, куда уходят деньги и как распределена нагрузка. Сверху вы можете выбрать месяц и конкретную точку (или смотреть сводно по всем).</p>
        
        <div>
          <h4 className="font-bold text-slate-900 mb-2">Вкладка 1: «Сводка и ФОТ»</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>План часов</b> — сумма всех запланированных часов по графику за месяц. Рядом значок <i>MoM</i> (Month-over-Month) показывает разницу с прошлым месяцем (зеленый — рост, красный — падение).</li>
            <li><b>План ФОТ</b> — запланированный Фонд Оплаты Труда (часы × ставка сотрудников).</li>
            <li><b>Факт ФОТ</b> — сколько реально заработали сотрудники (основано на фактически отработанных часах или окладе).</li>
            <li><b>Переработки</b> — сумма доплат за переработки. Считается по коэффициентам из настроек вашей организации.</li>
            <li><b>Покрытие смен</b> — процент смен, на которые назначены сотрудники (закрыто смен / всего смен).</li>
            <li><b>План vs Факт</b> — показывает, насколько фактические часы отклонились от плана (в процентах).</li>
            <li><b>ФОТ по должностям</b> — наглядно показывает, какая часть бюджета уходит на поваров, а какая на продавцов.</li>
            <li><b>Нагрузка по дням недели</b> — столбчатая диаграмма, показывающая, в какие дни больше всего смен и часов.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 mb-2">Вкладка 2: «Нагрузка персонала»</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Круговая диаграмма покрытия</b> — визуально показывает, сколько смен закрыто (зеленый) и сколько висит без сотрудников (серый).</li>
            <li><b>Риск выгорания</b> — ТОП-2 сотрудника, которые отработали больше всего часов за месяц. Помогает вовремя заметить переработки.</li>
            <li><b>Детальная нагрузка</b> — таблица со всеми сотрудниками: сколько смен взяли, сколько часов по плану и факту, и какая сумма ФОТ на них начислена.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 mb-2">Вкладка 3: «Дисциплина»</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>Показывает общее количество <b>Опозданий</b>, <b>Ранних уходов</b> и <b>Прогулов</b> за месяц.</li>
            <li><b>Лента нарушений</b> — хронологический список всех инцидентов с датами и минутами опозданий.</li>
            <li><b>Сводка</b> — таблица с группировкой по сотрудникам (кто больше всех опаздывал и прогуливал).</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 mb-2">Вкладка 4: «Детализация»</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>Большая таблица с полной выгрузкой по каждому сотруднику.</li>
            <li>Показывает ставку (или оклад), количество смен, план/факт часов, план/факт ФОТ, а также переработки в денежном эквиваленте.</li>
            <li>Идеально подходит для передачи данных в бухгалтерию.</li>
          </ul>
        </div>
      </div>
    ),
  },

  // ─── ДОКУМЕНТЫ ───
  {
    id: "docs-1",
    category: "Документы",
    title: "Как сгенерировать приказ (Т-1, Т-6 и др.)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Перейдите в <b>«Документы»</b>.</p>
        <p>1. Выберите нужный шаблон (например, «Приказ о приёме»).</p>
        <p>2. Заполните форму: выберите сотрудника (должность подтянется сама).</p>
        <p>3. Нажмите «Сгенерировать документ», проверьте превью и скачайте DOCX.</p>
      </div>
    ),
  },
{
    id: "emp-1",
    category: "Расписание и смены",
    title: "Как посмотреть свой график",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Перейдите в раздел <b>«Мой график»</b> в верхнем меню.</p>
        <p>Вы увидите календарь со своими сменами на текущую и следующие недели.</p>
        <p>Если график еще не опубликован руководителем, вы увидите сообщение «У вас пока нет смен».</p>
      </div>
    ),
  },
  {
    id: "emp-2",
    category: "Учёт времени и табель",
    title: "Как отметиться на смене",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>В разделе <b>«Мой график»</b> нажмите кнопку <b>«Начать смену»</b>, когда придёте на работу.</p>
        <p>В конце смены нажмите <b>«Закончить смену»</b>.</p>
        <p>Ваши часы будут автоматически учтены в табеле.</p>
      </div>
    ),
  },
];

const CATEGORIES = [
  { id: "all", label: "Все разделы", icon: HelpCircle },
  { id: "Старт и настройки", label: "Старт", icon: Rocket },
  { id: "Расписание и смены", label: "Расписание", icon: Calendar },
  { id: "Сотрудники и точки", label: "Сотрудники", icon: Users },
  { id: "Обмены сменами", label: "Обмены", icon: ArrowRightLeft },
  { id: "Уведомления", label: "Уведомления", icon: Bell },
  { id: "Отпуска и больничные", label: "Отпуска", icon: Palmtree },
  { id: "Учёт времени и табель", label: "Время и табель", icon: Clock },
  { id: "Аналитика", label: "Аналитика", icon: BarChart3 },
  { id: "Документы", label: "Документы", icon: FileText },
];

export default function HelpPage() {
  const org = useOrganization((s) => s.org);
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  const isEmployee = user?.role === "EMPLOYEE";
  const EMPLOYEE_CATEGORIES = ["Обмены сменами", "Уведомления", "Отпуска и больничные", "Учёт времени и табель", "Расписание и смены"];
  const EMPLOYEE_HIDDEN_IDS = ["schedule-1", "schedule-2", "time-1", "analytics-all", "docs-1", "start-1", "start-2", "team-1", "team-2"];

  const visibleCategories = isEmployee
    ? CATEGORIES.filter((c) => c.id === "all" || EMPLOYEE_CATEGORIES.includes(c.id))
    : CATEGORIES;

  const filteredArticles = useMemo(() => {
    return ARTICLES.filter((article) => {
      if (isEmployee && (!EMPLOYEE_CATEGORIES.includes(article.category) || EMPLOYEE_HIDDEN_IDS.includes(article.id))) return false;
      
      const matchesCategory =
        activeCategory === "all" || article.category === activeCategory;
      
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, isEmployee]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* Шапка справки */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 text-brand-600 mb-4 shadow-sm">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            База знаний
          </h1>
          <p className="text-lg text-slate-500 mb-6">
            Подробные ответы на вопросы по работе с сервисом.
          </p>

          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск по статьям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="!pl-12 !py-3 !text-base shadow-sm"
            />
          </div>
        </div>

        {/* Основная сетка */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
          
          {/* Боковое меню */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm sticky top-24">
              <nav className="space-y-1">
                {visibleCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setOpenArticleId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                      {cat.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Список статей */}
          <div className="flex-1 min-w-0">
            {filteredArticles.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-900 mb-1">Ничего не найдено</h3>
                <p className="text-sm text-slate-500">Попробуйте изменить запрос.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map((article) => {
                  const isOpen = openArticleId === article.id;
                  return (
                    <div
                      key={article.id}
                      className={`bg-white rounded-2xl border transition-all duration-200 ${
                        isOpen ? "border-brand-300 shadow-md ring-1 ring-brand-100" : "border-slate-200 shadow-sm hover:border-slate-300"
                      }`}
                    >
                      <button
                        onClick={() => setOpenArticleId(isOpen ? null : article.id)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-1">
                            {article.category}
                          </div>
                          <div className="font-semibold text-slate-900 text-base">
                            {article.title}
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"}`}>
                          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                      
                      {isOpen && (
                        <div className="px-5 pb-5 pt-2 border-t border-slate-100 animate-fade-in">
                          {article.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

              </main>
    </div>
  );
}