import { ShieldCheck, Smartphone, DatabaseBackup, FileSpreadsheet } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "152-ФЗ",
    desc: "Безопасность данных",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: FileSpreadsheet,
    title: "Импорт из Excel",
    desc: "Перенос за 2 минуты",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Smartphone,
    title: "PWA",
    desc: "Работает как приложение",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: DatabaseBackup,
    title: "Бэкапы",
    desc: "Ежедневно и надежно",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

export default function TrustBar() {
  return (
    <div className="border-y border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
