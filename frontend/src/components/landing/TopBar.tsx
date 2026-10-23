import { Gift } from "lucide-react";

export default function TopBar() {
  return (
    <div className="bg-brand-600 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        <Gift className="w-4 h-4 shrink-0" />
        <span>Первые 14 дней Pro-функции бесплатно · без карты</span>
      </div>
    </div>
  );
}