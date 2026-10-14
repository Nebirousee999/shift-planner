import { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  FileText,
  Upload,
  Download,
  Sparkles,
  Code,
  CalendarDays,
} from "lucide-react";
import NavBar from "../components/NavBar";

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
};

const PLACEHOLDERS_ORG = [
  { code: "{Организация}", desc: "Название организации" },
  { code: "{Название организации}", desc: "То же самое" },
  { code: "{Город}", desc: "Город из настроек" },
  { code: "{Директор}", desc: "ФИО директора" },
  { code: "{ФИО директора}", desc: "То же самое" },
  { code: "{ИНН}", desc: "ИНН организации" },
  { code: "{Адрес}", desc: "Юридический адрес" },
  { code: "{Юридический адрес}", desc: "То же самое" },
  { code: "{Сегодня}", desc: "Текущая дата прописью" },
];

const PLACEHOLDERS_EMP = [
  { code: "{Сотрудник}", desc: "ФИО выбранного сотрудника" },
  { code: "{ФИО сотрудника}", desc: "То же самое" },
  { code: "{Email сотрудника}", desc: "Email сотрудника" },
  { code: "{Телефон сотрудника}", desc: "Телефон" },
  { code: "{Ставка сотрудника}", desc: "Ставка ₽/ч" },
  {
    code: "{СписокСотрудников}",
    desc: "Все выбранные — списком с нумерацией",
  },
];

export default function HelpPage() {
  const [openId, setOpenId] = useState<string | null>("intro");

  const sections: Section[] = [
    {
      id: "intro",
      title: "Что такое свой шаблон документа",
      icon: HelpCircle,
      content: (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            В разделе <b>«Документы»</b> можно не только генерировать
            документы по готовым формам, но и загрузить{" "}
            <b>свой шаблон</b> — текст в формате DOCX, в котором есть
            плейсхолдеры вида{" "}
            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-brand-600 font-mono text-xs">
              {"{Организация}"}
            </code>
            .
          </p>
          <p>
            При генерации система подставит в эти места реальные данные из
            ваших настроек и формы.
          </p>
          <p>
            Это удобно, если вам нужен <b>нестандартный документ</b> — с
            другим текстом, разделами, порядком пунктов.
          </p>
        </div>
      ),
    },
    {
      id: "org-settings",
      title: "Настройка организации (один раз)",
      icon: Building2,
      content: (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Прежде чем создавать документы, заполните{" "}
            <b>данные организации</b> в разделе{" "}
            <b>«Профиль → Данные организации»</b>.
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>Название организации</li>
            <li>Город</li>
            <li>ФИО директора</li>
            <li>ИНН</li>
            <li>Юридический адрес</li>
          </ul>
          <p>
            Эти данные будут <b>автоматически подставляться</b> во все
            документы — их не нужно вводить каждый раз.
          </p>
          <p className="text-xs bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg">
            💡 Заполнить может только владелец аккаунта.
          </p>
        </div>
      ),
    },
    {
      id: "howto",
      title: "Как загрузить свой шаблон",
      icon: Upload,
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs shrink-0">
              1
            </div>
            <div>
              <b className="text-slate-900">Скачайте образец</b>
              <p className="mt-1">
                Откройте нужный документ в разделе «Документы» и нажмите{" "}
                <b>«Скачать образец»</b> — вы получите готовый DOCX с
                плейсхолдерами.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs shrink-0">
              2
            </div>
            <div>
              <b className="text-slate-900">Отредактируйте в Word</b>
              <p className="mt-1">
                Откройте файл в Word, LibreOffice или Google Docs. Измените
                текст как нужно: формулировки, порядок, добавьте свои разделы.
              </p>
              <p className="mt-1">
                <b>Оставьте</b> плейсхолдеры в фигурных скобках там, где
                должны подставляться данные. Можете удалить лишние или
                добавить новые.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs shrink-0">
              3
            </div>
            <div>
              <b className="text-slate-900">Сохраните как .txt</b>
              <p className="mt-1">
                Вернитесь в «Документы», в форме документа нажмите{" "}
                <b>«Загрузить .txt»</b> и выберите файл. Текст шаблона
                сохранится в системе.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs shrink-0">
              4
            </div>
            <div>
              <b className="text-slate-900">Включите галочку</b>
              <p className="mt-1">
                Поставьте чекбокс <b>«Свой шаблон документа»</b>. Появится
                селектор сотрудников и кнопка{" "}
                <b>«Сгенерировать по своему шаблону»</b>.
              </p>
            </div>
          </div>

          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg">
            ⚠️ Файл шаблона сохраняется в формате текста (.txt), но
            генерируется в .docx. Форматирование (жирный, курсив, отступы)
            задаётся автоматически по заголовкам: строки, начинающиеся с{" "}
            <code className="font-mono"># </code> — крупный заголовок,{" "}
            <code className="font-mono">## </code> — подзаголовок.
          </div>
        </div>
      ),
    },
    {
      id: "placeholders-org",
      title: "Плейсхолдеры организации",
      icon: Building2,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Заполняются из настроек организации в профиле.
          </p>
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {PLACEHOLDERS_ORG.map((ph, i) => (
                  <tr
                    key={ph.code}
                    className={
                      i !== PLACEHOLDERS_ORG.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600 whitespace-nowrap">
                      {ph.code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {ph.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "placeholders-emp",
      title: "Плейсхолдеры сотрудников",
      icon: Users,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Заполняются из выбранных сотрудников. Если выбрать несколько —
            первым будет тот, кого выбрали раньше, а{" "}
            <code className="px-1 bg-slate-100 rounded font-mono text-xs">
              {"{СписокСотрудников}"}
            </code>{" "}
            перечислит всех.
          </p>
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {PLACEHOLDERS_EMP.map((ph, i) => (
                  <tr
                    key={ph.code}
                    className={
                      i !== PLACEHOLDERS_EMP.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600 whitespace-nowrap">
                      {ph.code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {ph.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "placeholders-custom",
      title: "Плейсхолдеры формы",
      icon: Code,
      content: (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Помимо организации и сотрудников, в шаблон можно подставлять{" "}
            <b>значения из полей формы</b> — те, что вы заполняете вручную.
          </p>
          <p>
            Используйте их <b>технические имена</b> (латиницей), например:
          </p>
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["{orderNumber}", "Номер приказа"],
                  ["{orderDate}", "Дата приказа"],
                  ["{startDate}", "Дата начала работы"],
                  ["{salary}", "Оклад"],
                  ["{position}", "Должность"],
                  ["{year}", "Год"],
                  ["{contractNumber}", "Номер договора"],
                  ["{instructionNumber}", "Номер инструкции"],
                ].map(([code, desc], i, arr) => (
                  <tr
                    key={code}
                    className={
                      i !== arr.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600 whitespace-nowrap">
                      {code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Точный список смотрите в форме документа — там под каждым полем
            отображается его техническое имя.
          </p>
        </div>
      ),
    },
    {
      id: "example",
      title: "Пример готового шаблона",
      icon: FileText,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Простой пример приказа о приёме на работу:
          </p>
          <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
{`{Название организации}
ПРИКАЗ № {orderNumber}
{Город}
от {Дата приказа}

О приёме на работу

ПРИНЯТЬ на работу {Сотрудник}
на должность {position}
с окладом {salary} рублей в месяц.

Дата начала работы: {Дата начала}.

Директор: ___________ / {Директор} /

С приказом ознакомлен(а):
___________ / {Сотрудник} /`}
          </pre>
          <p className="text-sm text-slate-600">
            Когда вы нажмёте «Сгенерировать по своему шаблону»,{" "}
            <b>все плейсхолдеры заменятся на реальные данные</b>, и вы
            получите готовый DOCX.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Справка
              </h1>
              <p className="text-sm text-slate-500">
                Как работать со своими шаблонами документов
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {sections.map((s) => {
            const Icon = s.icon;
            const isOpen = openId === s.id;
            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? "bg-brand-100 text-brand-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 font-medium text-slate-900">
                    {s.title}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 animate-fade-in">
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Нижняя подсказка */}
        <div className="mt-8 bg-brand-50 border border-brand-200 rounded-2xl p-5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="text-sm text-brand-900">
            <div className="font-medium mb-1">
              Остались вопросы?
            </div>
            <div className="text-brand-700">
              Обратитесь в поддержку через{" "}
              <b>Профиль → Связаться с нами</b>, или напишите на почту{" "}
              <b>help@shift-planner.ru</b>.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}