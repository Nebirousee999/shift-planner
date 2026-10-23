export default function SocialProof() {
  const stats = [
    { value: "5 мин", label: "на планирование недели" },
    { value: "40+", label: "шаблонов документов по ТК" },
    { value: "0 ₽", label: "за старт и настройку" },
    { value: "3", label: "точки в Business-тарифе" },
  ];

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 divide-x-0 md:divide-x divide-slate-100">
          {stats.map((s, i) => (
            <div key={i} className="text-center px-2">
              <div className="text-3xl sm:text-4xl font-black text-brand-600 mb-1">
                {s.value}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 font-medium">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}