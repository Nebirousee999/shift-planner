import { Coffee, Scissors, ShoppingBag, Stethoscope } from "lucide-react";

const AUDIENCES = [
  { icon: Coffee, title: "Кофейни и кафе", desc: "Смены бариста, поваров и официантов без путаницы" },
  { icon: Scissors, title: "Салоны красоты", desc: "График мастеров и администраторов под запись" },
  { icon: ShoppingBag, title: "Магазины", desc: "Продавцы и кассиры на нескольких точках" },
  { icon: Stethoscope, title: "Клиники", desc: "Врачи и медсёстры, дежурства и отпуска" },
];

export default function ForWhom() {
  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
          Для кого этот сервис
        </h2>
        <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
          Мы знаем, что малому бизнесу нужны простые инструменты, а не сложные ERP-системы.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {AUDIENCES.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.title} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all text-left group">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-brand-300 transition-all shadow-sm">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{a.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}