import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "Нужна ли кредитная карта для регистрации?",
    a: "Нет. Free-тариф бессрочный, а первые 14 дней Pro-функции бесплатно — без привязки карты и подтверждений.",
  },
  {
    q: "Сотрудникам тоже нужно платить?",
    a: "Нет. Платите только за владельца-аккаунт. Сотрудники подключаются бесплатно, у каждого свой логин для просмотра графика и отметок времени.",
  },
  {
    q: "Как перенести данные из Excel?",
    a: "В разделе «Сотрудники» есть кнопка «Импорт из Excel». Скачайте шаблон, заполните, загрузите — все сотрудники появятся автоматически с паролями.",
  },
  {
    q: "Работает ли на телефоне?",
    a: "Да, полностью. Лендинг, планировщик для руководителя и мобильный вид для сотрудников («Мой график», отметки времени) — всё адаптировано под смартфоны.",
  },
  {
    q: "Что если сотрудник уволился?",
    a: "Его можно архивировать — смены в истории сохранятся, но не будут мешать при планировании. Или удалить полностью с очисткой связанных данных.",
  },
  {
    q: "Можно ли использовать на нескольких точках?",
    a: "Да, на тарифе Business. У каждой точки своё расписание, сотрудников можно привязать к одной или нескольким точкам, а аналитика покажет отдельно по каждой или в сумме.",
  },
  {
    q: "Есть ли интеграция с 1С?",
    a: "Готовим в Business-тарифе. Пока вы можете выгрузить табель в Excel-формате, который бухгалтер загрузит в 1С.",
  },
  {
    q: "Как вы защищаете данные?",
    a: "HTTPS-шифрование, ежедневные бэкапы, изоляция данных по организациям. Мы не продаём данные третьим лицам и не показываем рекламу.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 sm:py-24 bg-white scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Частые вопросы
          </h2>
          <p className="text-lg text-slate-600">
            Не нашли ответ? Напишите на{" "}
            <a
              href="mailto:help@shift-planner.ru"
              className="text-brand-600 hover:underline"
            >
              help@shift-planner.ru
            </a>
          </p>
        </div>

        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-colors hover:border-slate-300"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium text-slate-900 text-sm sm:text-base">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed animate-fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}