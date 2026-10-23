import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-slate-200">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Оплата прошла!</h1>
        <p className="text-slate-500 mb-8">
          Спасибо за оплату. Доступ к тарифу активирован. (В реальном проекте здесь нужно проверить статус платежа на бэкенде).
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center w-full px-5 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-medium transition-colors"
        >
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}