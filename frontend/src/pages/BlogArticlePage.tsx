import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, Quote } from "lucide-react";
import LandingHeader from "../components/landing/LandingHeader";
import LandingFooter from "../components/landing/LandingFooter";
import { api } from "../api/client";
import { trackEvent } from "../lib/metrika";

// Общие классы для красивых статей
const pClass = "text-slate-600 leading-relaxed mb-5 text-base sm:text-lg";
const h2Class = "text-2xl font-bold text-slate-900 mt-12 mb-4";
const h3Class = "text-xl font-semibold text-slate-900 mt-8 mb-3";
const ulClass = "list-disc pl-6 mb-6 space-y-2 text-slate-600 text-base sm:text-lg marker:text-brand-500";
const olClass = "list-decimal pl-6 mb-6 space-y-2 text-slate-600 text-base sm:text-lg marker:text-brand-500 font-medium";
const linkClass = "text-brand-600 font-medium hover:text-brand-700 underline decoration-brand-200 underline-offset-4 transition-colors cursor-pointer";
const imgClass = "w-full h-64 sm:h-80 object-cover rounded-2xl shadow-sm mb-8 mt-4 border border-slate-100";

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleRegisterClick = async (source: string, target: string = "/weeks") => {
    trackEvent("CTA_click", { source });
    if (localStorage.getItem("isGuest") === "true" && localStorage.getItem("token")) {
      window.location.href = target;
      return;
    }
    try {
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

  const renderContent = () => {
    switch (slug) {
      case "kak-sostavit-grafik-2-2":
        return (
          <>
            <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-6 font-medium">
              График 2/2 (два рабочих дня, два выходных) — это классика сменной работы. Он привычен для продавцов, бариста, охранников и медицинского персонала. Но за внешней простотой скрывается ловушка: если составить его неправильно, к концу месяца у сотрудников набегут огромные переработки, а у вас — штрафы от трудовой инспекции.
            </p>

            {/* Картинка с заглушкой */}
            <div className="relative mb-8 mt-4">
              <img src="/blog/graphic-2-2.svg" alt="Планирование графика" className={imgClass} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden w-full h-64 sm:h-80 bg-gradient-to-r from-blue-100 to-brand-100 rounded-2xl flex items-center justify-center text-brand-700 font-bold text-xl">График 2/2</div>
            </div>

            <h2 className={h2Class}>Сколько смен в месяц при графике 2/2?</h2>
            <p className={pClass}>
              Самый частый вопрос от владельцев бизнеса. В среднем в месяце 30 дней. При цикле 2/2 (4 дня) получается 7,5 циклов. То есть <b>15 рабочих смен в месяц</b>. 
            </p>
            <p className={pClass}>
              Если смена длится 8 часов (15 × 8), выходит 120 часов — это в пределах нормы (норма 160-170 часов). Но в общепите и рознице смены часто бывают по 12 часов. Умножаем 15 на 12 и получаем <b>180 часов</b>. Это уже переработка! 
            </p>
            
            <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-xl mb-8">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-900 font-medium mb-1">Важно: Суммированный учет</p>
                  <p className="text-amber-800 text-sm">Если из-за графика 2/2 сотрудник перерабатывает норму часов в неделю (больше 40 часов), вы обязаны ввести суммированный учет рабочего времени (ст. 104 ТК РФ) с учетным периодом месяц, квартал или год.</p>
                </div>
              </div>
            </div>

            <h2 className={h2Class}>3 правила составления идеального графика</h2>
            <ul className={ulClass}>
              <li><b>Отдых 42 часа:</b> Между сменами сотрудник должен отдыхать не менее 42 часов в неделю (ст. 110 ТК РФ).</li>
              <li><b>Запрет на две смены подряд:</b> Даже если сотрудник сам просит, это прямое нарушение ТК.</li>
              <li><b>Ночные часы:</b> С 22:00 до 6:00 каждый час оплачивается минимум на 20% дороже (ст. 154 ТК РФ).</li>
            </ul>

            <h2 className={h2Class}>Как автоматизировать процесс?</h2>
            <p className={pClass}>
              Рисовать таблицы в Excel — прошлый век. В <span onClick={() => handleRegisterClick("article_text_link")} className={linkClass}>Планировщике смен</span> вы просто выбираете шаблон 2/2, система сама расставляет сотрудников. А если кто-то уходит в отпуск или заболевает, календарь перестраивается в один клик.
            </p>
          </>
        );

      case "smennyj-grafik-po-tk-rf":
        return (
          <>
            <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-6 font-medium">
              Сменный график — это не просто способ распределить людей по времени. Это юридический документ, который должен строго соответствовать Трудовому кодексу. За грубые нарушения инспекторы могут выписать штраф до 50 000 рублей.
            </p>

            <div className="relative mb-8 mt-4">
              <img src="/blog/tk-rf.svg" alt="ТК РФ" className={imgClass} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden w-full h-64 sm:h-80 bg-gradient-to-r from-slate-200 to-slate-100 rounded-2xl flex items-center justify-center text-slate-700 font-bold text-xl">Трудовой кодекс</div>
            </div>

            <h2 className={h2Class}>Ночные смены: как правильно оплачивать?</h2>
            <p className={pClass}>
              Ночное время (с 22:00 до 06:00) — это дополнительная нагрузка на организм. Поэтому государство защищает работников доплатой. По статье 154 ТК РФ, каждый час ночной работы оплачивается в повышенном размере.
            </p>
            <p className={pClass}>
              Минимальный размер доплаты — <b>20% от часовой ставки</b>. Если у вас менеджер с окладом, нужно сначала рассчитать стоимость часа, а затем умножить на количество ночных часов. 
            </p>

            <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-100 flex gap-4 items-start">
              <Quote className="w-8 h-8 text-blue-300 shrink-0" />
              <p className="text-blue-900 text-lg italic font-medium leading-relaxed">
                «Перерыв между сменами должен быть не менее двойной продолжительности рабочего времени. Работал 12 часов — отдыхай 24 часа. Это не прихоть, это ст. 108 ТК РФ».
              </p>
            </div>

            <h2 className={h2Class}>Какие бывают сменные графики?</h2>
            <h3 className={h3Class}>1. День-ночь-отсыпной-выходной (ДНОВ)</h3>
            <p className={pClass}>Классический график для охраны и заводов. Два дня (день и ночь), затем день на восстановление и два выходных. Требует очень внимательного подсчета часов.</p>
            
            <h3 className={h3Class}>2. График 2/2, 3/3, 4/4</h3>
            <p className={pClass}>Самый популярный в торговле и общепите. В идеале требует введения суммированного учета, чтобы переработки в одном месяце компенсировались недоработками в другом.</p>

            <h2 className={h2Class}>Как не получить штраф?</h2>
            <p className={pClass}>
              Составляя график, вы должны быть на 100% уверены в расчетах. В <span onClick={() => handleRegisterClick("article_text_link")} className={linkClass}>нашем сервисе</span> встроен автоматический валидатор. Он не даст опубликовать график, если в нем есть нарушения: например, если сотрудник работает две смены подряд или не получает 42 часа отдыха в неделю.
            </p>
          </>
        );

      case "grafik-smen-v-excel":
        return (
          <>
            <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-6 font-medium">
              Многие компании до сих пор используют Excel для ведения графиков смен. Это неудивительно: он кажется бесплатным и знакомым. Но давайте посчитаем реальную стоимость этого «бесплатного» метода.
            </p>

            <div className="relative mb-8 mt-4">
              <img src="/blog/excel.svg" alt="Excel" className={imgClass} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden w-full h-64 sm:h-80 bg-gradient-to-r from-emerald-100 to-green-50 rounded-2xl flex items-center justify-center text-emerald-800 font-bold text-xl">Таблицы Excel</div>
            </div>

            <h2 className={h2Class}>Как выглядит составление графика в Excel?</h2>
            <ol className={olClass}>
              <li>Вы создаете таблицу: по горизонтали дни месяца, по вертикали — ФИО сотрудников.</li>
              <li>Вручную вбиваете время (например, 09:00–18:00) или буквы (Я, В, Н).</li>
              <li>Пишете сложные формулы, чтобы посчитать часы и переработки.</li>
              <li>Отправляете файл в общий чат и молитесь, чтобы никто не менял расписание без предупреждения.</li>
            </ol>

            <h2 className={h2Class}>3 главные боли Excel-графиков</h2>
            <h3 className={h3Class}>1. Формулы ломаются</h3>
            <p className={pClass}>Однажды кто-то случайно удалит ячейку с формулой, и итоговая зарплата посчитается неправильно. Бухгалтер будет в ярости, а вы — разбираться в ошибках.</p>
            
            <h3 className={h3Class}>2. Обмены и замены</h3>
            <p className={pClass}>Сотрудник заболел. В Excel вам нужно вручную стереть его смену, найти замену, вписать нового человека и пересчитать ему часы. В онлайн-сервисе достаточно сделать один клик.</p>

            <h3 className={h3Class}>3. Сотрудники не видят график</h3>
            <p className={pClass}>Чтобы человек узнал, когда ему выходить, вы должны сделать скриншот таблицы и отправить в WhatsApp. С онлайн-планировщиком сотрудники получают автоматическое уведомление в мессенджер MAX.</p>

            <h2 className={h2Class}>Переходите на современные сервисы</h2>
            <p className={pClass}>
              Потратьте 10 минут на освоение <span onClick={() => handleRegisterClick("article_text_link")} className={linkClass}>Планировщика смен</span>, и вы сэкономите 4 часа работы управляющего каждую неделю. Экспорт табеля, расчет переработок, отправка уведомлений — всё это займет пару кликов.
            </p>
          </>
        );

      case "zayavlenie-na-smenu-grafika":
        return (
          <>
            <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-6 font-medium">
              Кадровый учет — штука строгая. Если вам нужно изменить график работы сотрудника (даже по его собственной просьбе), устной договоренности недостаточно. Нужен официальный документ.
            </p>

            <div className="relative mb-8 mt-4">
              <img src="/blog/zayavlenie.svg" alt="Документы" className={imgClass} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden w-full h-64 sm:h-80 bg-gradient-to-r from-amber-100 to-orange-50 rounded-2xl flex items-center justify-center text-amber-800 font-bold text-xl">Кадровые документы</div>
            </div>

            <h2 className={h2Class}>Смена графика по инициативе сотрудника</h2>
            <p className={pClass}>
              Сотрудник пишет заявление на имя директора в свободной форме. В нем нужно указать:
            </p>
            <ul className={ulClass}>
              <li>ФИО директора и название организации;</li>
              <li>Свои ФИО и должность;</li>
              <li>Причину смены графика (например, «по семейным обстоятельствам»);</li>
              <li>Новые желаемые даты и часы работы;</li>
              <li>Дату и подпись.</li>
            </ul>
            <p className={pClass}>Работодатель накладывает резолюцию «Согласен» или отказывает.</p>

            <h2 className={h2Class}>Смена графика по инициативе работодателя</h2>
            <p className={pClass}>
              Здесь правила строже. Согласно ст. 103 ТК РФ, если вы меняете график (например, из-за производственной необходимости), вы обязаны <b>уведомить сотрудников не позднее чем за один месяц</b> под роспись.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl mb-8">
              <h3 className="font-bold text-slate-900 mb-2">Образец уведомления</h3>
              <p className="text-slate-600 text-sm mb-1">Уважаемый(ая) [ФИО]!</p>
              <p className="text-slate-600 text-sm mb-1">Уведомляем вас о том, что с [дата] в организации изменяется график сменности.</p>
              <p className="text-slate-600 text-sm mb-1">Ваш новый график: [новый график].</p>
              <p className="text-slate-600 text-sm">С уведомлением ознакомлен(а): ___________ (Подпись)</p>
            </div>

            <h2 className={h2Class}>Как сэкономить время на оформлении?</h2>
            <p className={pClass}>
              Если нужно быстро сформировать приказ об изменении графика или уведомление, воспользуйтесь шаблонами в разделе «Документы» внутри <span onClick={() => handleRegisterClick("article_text_link")} className={linkClass}>Планировщика смен</span>. Данные сотрудников подставятся автоматически.
            </p>
          </>
        );

      default:
        return <p className={pClass}>Статья не найдена</p>;
    }
  };

  const articles = {
    "kak-sostavit-grafik-2-2": "Как составить график смен 2/2 и 3/3 на 2026 год",
    "smennyj-grafik-po-tk-rf": "Сменный график по ТК РФ: ночные смены и перерывы",
    "grafik-smen-v-excel": "Как сделать график смен в Excel (и почему это устарело)",
    "zayavlenie-na-smenu-grafika": "Заявление на смену графика работы: образец 2026",
  };

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Все статьи
        </Link>
        
        <article className="max-w-none">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            {articles[slug as keyof typeof articles] || "Статья"}
          </h1>
          <div className="text-sm font-medium text-slate-400 mb-8 pb-8 border-b border-slate-100 flex items-center gap-4">
            <span>05.11.2026</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>7 мин чтения</span>
          </div>
          
          <div className="animate-fade-in text-slate-800">
            {renderContent()}
          </div>
        </article>

        <div className="mt-16 p-8 sm:p-10 bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl text-center shadow-xl shadow-brand-500/20 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Устали считать смены вручную?</h3>
          <p className="text-brand-100 mb-8 text-base sm:text-lg relative z-10">Попробуйте наш сервис — 14 дней Pro-функций бесплатно, без привязки карты.</p>
          <button onClick={() => handleRegisterClick("article_bottom_cta")} className="inline-flex items-center gap-2 bg-white text-brand-700 px-8 py-3.5 rounded-xl font-bold hover:bg-slate-50 shadow-lg transition-all hover:-translate-y-0.5 relative z-10">
            <CheckCircle2 className="w-5 h-5" /> Создать график бесплатно
          </button>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
