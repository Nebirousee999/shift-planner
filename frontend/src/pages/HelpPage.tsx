import { useState, useMemo } from "react";
import {
  Search,
  Rocket,
  Calendar,
  Users,
  Palmtree,
  Clock,
  BarChart3,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageCircle,
  MapPin,
  ArrowRightLeft,
} from "lucide-react";
import NavBar from "../components/NavBar";

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
    title: "Как заполнить профиль организации",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Данные организации подставляются в приказы и табели.</p>
        <p>Перейдите в <b>Профиль → Данные организации</b> (доступно только владельцу).</p>
        <p>Заполните ИНН, юридический адрес и ФИО директора. Нажмите «Сохранить данные».</p>
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
        <p>Нажмите «Добавить сотрудника». Укажите ФИО, email, роль (Сотрудник, Менеджер, Владелец), должность и ставку (₽/час).</p>
        <p>После сохранения система сгенерирует временный пароль. Обязательно скопируйте его и передайте сотруднику — войти он сможет по email и этому паролю.</p>
      </div>
    ),
  },
  {
    id: "team-2",
    category: "Сотрудники и точки",
    title: "Как импортировать команду из Excel",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Если у вас много сотрудников, не добавляйте их вручную.</p>
        <p>1. В разделе «Сотрудники» нажмите <b>«Скачать шаблон»</b>.</p>
        <p>2. Заполните таблицу (Имя, Email, Должность, Ставка, Телефон).</p>
        <p>3. Нажмите <b>«Загрузить Excel»</b> и выберите файл. Система создаст всех сотрудников и выдаст список временных паролей.</p>
      </div>
    ),
  },
  {
    id: "team-3",
    category: "Сотрудники и точки",
    title: "Зачем нужны Точки и как их создавать",
    content: (
      <div className="space-y-3 text-slate-600">
        <p><b>Точка</b> — это филиал, кафе или магазин. У каждой точки свой график смен.</p>
        <p>Перейдите в <b>«Расписание» → «Точки»</b>. Нажмите «Добавить точку» (доступно на тарифе Business). Укажите название и адрес.</p>
        <p>Затем нажмите на карточку точки и выберите «Сотрудники», чтобы привязать к ней команду.</p>
      </div>
    ),
  },

  // ─── РАСПИСАНИЕ И СМЕНЫ ───
  {
    id: "schedule-1",
    category: "Расписание и смены",
    title: "Как создать график на неделю",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>1. Перейдите в <b>«Недели»</b> и нажмите «Новая неделя» (или кликните на пустую неделю в календаре).</p>
        <p>2. Внутри недели нажмите кнопку <b>«Редактировать»</b> (карандаш вверху).</p>
        <p>3. В нужном дне нажмите <b>«+ смена»</b>. Выберите шаблон (например, «Утренняя»), сотрудника и время.</p>
        <p>4. Вы можете перетаскивать смены мышкой между днями.</p>
      </div>
    ),
  },
  {
    id: "schedule-2",
    category: "Расписание и смены",
    title: "Проверки ТК РФ при публикации",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Система не даст опубликовать «нелегальный» график.</p>
        <p>При нажатии кнопки <b>«Опубликовать»</b> система проверит:</p>
        <ul className="list-disc pl-5">
          <li>Не превышает ли сотрудник 40 часов в неделю.</li>
          <li>Нет ли у сотрудника двух смен, пересекающихся по времени в один день.</li>
        </ul>
        <p>Если есть нарушения, вы увидите список. Исправьте смены и попробуйте снова.</p>
      </div>
    ),
  },
  {
    id: "schedule-3",
    category: "Расписание и смены",
    title: "Как скопировать весь день",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>В режиме редактирования недели нажмите на иконку <b>«Копировать»</b> (два листочка) в шапке нужного дня.</p>
        <p>Затем нажмите на иконку <b>«Вставить»</b> (с клипбордом) в шапке другого дня.</p>
        <p>Все смены дублируются. Это удобно, если график изо дня в день повторяется.</p>
      </div>
    ),
  },

  // ─── ОТПУСКА И БОЛЬНИЧНЫЕ ───
  {
    id: "vac-1",
    category: "Отпуска и больничные",
    title: "Как согласовать отпуск сотрудника",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Сотрудник запрашивает отпуск в личном кабинете, а руководитель его одобряет.</p>
        <p>1. Перейдите в <b>«Отпуска»</b>. Сверху появится блок «Требуют одобрения».</p>
        <p>2. Проверьте даты и нажмите <b>«Одобрить»</b>. Отпуск появится на общем Гант-календаре.</p>
        <p>Отпуска автоматически учитываются при составлении графика и расчете зарплаты.</p>
      </div>
    ),
  },
  {
    id: "vac-2",
    category: "Отпуска и больничные",
    title: "Как добавить больничный",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Больничный — это свершившийся факт, он не требует согласования.</p>
        <p>Перейдите в <b>«Больничные» → «Добавить больничный»</b>. Выберите сотрудника и даты.</p>
        <p>На графике эти дни будут подсвечены красным, а в табеле проставлена отметка «Б».</p>
      </div>
    ),
  },

  // ─── УЧЕТ ВРЕМЕНИ И ОБМЕНЫ ───
  {
    id: "time-1",
    category: "Учет времени и обмены",
    title: "Как работает учет рабочего времени (Clock-in)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Если в настройках включен «Учет времени», сотрудники могут отмечать приход и уход.</p>
        <p>Сотрудник заходит в «Мой график» и нажимает <b>«Начать смену»</b>. Система фиксирует время.</p>
        <p>В конце смены он нажимает «Закончить смену». Эти данные попадают в отчеты и влияют на факт ФОТ в аналитике.</p>
      </div>
    ),
  },
  {
    id: "time-2",
    category: "Учет времени и обмены",
    title: "Как сотрудникам обмениваться сменами",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>В опубликованном графике сотрудник может предложить обмен.</p>
        <p>1. В личном кабинете («Мой график») он нажимает <b>«Обмен»</b> на своей смене.</p>
        <p>2. Выбирает коллегу (или делает смену открытой).</p>
        <p>3. Второй сотрудник получает запрос и нажимает «Принять». Смена переходит к нему автоматически.</p>
      </div>
    ),
  },

  // ─── АНАЛИТИКА И ТАБЕЛИ ───
  {
    id: "analytics-1",
    category: "Аналитика и табели",
    title: "Что показывает раздел Аналитика",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Раздел <b>«Аналитика»</b> помогает понять, куда уходят деньги.</p>
        <ul className="list-disc pl-5">
          <li><b>План ФОТ:</b> сколько вы потратите на смены.</li>
          <li><b>Факт ФОТ:</b> сколько реально отработали люди.</li>
          <li><b>Переработки:</b> считаются автоматически по ТК (с коэффициентами 1.5 и 2.0).</li>
          <li><b>Пики нагрузки:</b> в какие дни недели сотрудников нужно больше.</li>
        </ul>
        <p>Данные можно выгрузить в Excel или PDF.</p>
      </div>
    ),
  },
  {
    id: "analytics-2",
    category: "Аналитика и табели",
    title: "Как выгрузить табель для бухгалтерии",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Перейдите в раздел <b>«Табель»</b> (в верхнем меню «Документация»).</p>
        <p>Выберите месяц и нажмите <b>«Скачать табель»</b>. Система соберет все смены, учтет отпуска (ОТ) и больничные (Б), и сформирует готовый файл Excel (форма Т-13).</p>
      </div>
    ),
  },

  // ─── ДОКУМЕНТЫ ───
  {
    id: "docs-1",
    category: "Документы",
    title: "Как сгенерировать приказ (Т-1, Т-6)",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Перейдите в <b>«Документы»</b>.</p>
        <p>1. Выберите нужный шаблон (например, «Приказ о приёме»).</p>
        <p>2. Заполните форму: выберите сотрудника из списка (должность подтянется сама), укажите оклад и дату.</p>
        <p>3. Нажмите «Сгенерировать документ», проверьте превью и скачайте готовый DOCX.</p>
      </div>
    ),
  },
  {
    id: "docs-2",
    category: "Документы",
    title: "Как загрузить свой шаблон документа",
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Вы можете использовать свои бланки.</p>
        <p>1. В форме документа включите галочку <b>«Свой шаблон документа»</b>.</p>
        <p>2. Скачайте образец и отредактируйте его в Word. Оставьте плейсхолдеры в фигурных скобках, например <code>{"{Сотрудник}"}</code> или <code>{"{Организация}"}</code>.</p>
        <p>3. Загрузите файл обратно в систему. Теперь генерация будет идти по вашему макету.</p>
      </div>
    ),
  },
];

const CATEGORIES = [
  { id: "all", label: "Все разделы", icon: HelpCircle },
  { id: "Старт и настройки", label: "Старт", icon: Rocket },
  { id: "Расписание и смены", label: "Расписание", icon: Calendar },
  { id: "Сотрудники и точки", label: "Сотрудники", icon: Users },
  { id: "Отпуска и больничные", label: "Отпуска", icon: Palmtree },
  { id: "Учет времени и обмены", label: "Время и обмены", icon: Clock },
  { id: "Аналитика и табели", label: "Аналитика", icon: BarChart3 },
  { id: "Документы", label: "Документы", icon: FileText },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  // Фильтрация статей
  const filteredArticles = useMemo(() => {
    return ARTICLES.filter((article) => {
      const matchesCategory =
        activeCategory === "all" || article.category === activeCategory;
      
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

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
            Ответы на частые вопросы по работе с сервисом.
          </p>

          {/* Поиск */}
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

        {/* Основная сетка: Меню + Статьи */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
          
          {/* Боковое меню категорий */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm sticky top-24">
              <nav className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setOpenArticleId(null); // Сбрасываем открытую статью при смене категории
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

        {/* Блок поддержки */}
        <div className="max-w-6xl mx-auto mt-12 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl shadow-brand-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <MessageCircle className="w-10 h-10 mx-auto mb-4 text-white/80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Не нашли ответ на свой вопрос?
            </h2>
            <p className="text-white/80 mb-8 max-w-xl mx-auto">
              Наша команда поддержки на связи с понедельника по пятницу, с 10:00 до 19:00 (МСК). Ответим в течение пары часов.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="mailto:help@shift-planner.ru"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-brand-700 rounded-xl hover:bg-slate-100 text-sm font-semibold shadow-sm transition-all w-full sm:w-auto"
              >
                Написать на почту
              </a>
              <a
                href="https://t.me/shift_planner_support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-800/50 border border-brand-400/30 text-white rounded-xl hover:bg-brand-800 text-sm font-semibold transition-all w-full sm:w-auto backdrop-blur-sm"
              >
                Написать в Telegram
              </a>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}