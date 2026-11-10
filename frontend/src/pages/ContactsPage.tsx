import PublicPageLayout from "../components/landing/PublicPageLayout";
import { useAuth } from "../store/auth";
import SupportChat from "../components/SupportChat";

export default function ContactsPage() {
  const { user } = useAuth();

  return (
    <PublicPageLayout title="Контакты">
      {user?.role === "EMPLOYEE" ? (
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Доступ ограничен</h3>
          <p className="text-slate-500">Если у вас есть вопросы, обратитесь к вашему руководителю.</p>
        </div>
      ) : user?.role === "OWNER" || user?.role === "MANAGER" ? (
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Вы авторизованы</h3>
          <p className="text-slate-500">Пожалуйста, используйте виджет поддержки в правом нижнем углу экрана.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden not-prose shadow-sm max-w-lg mx-auto">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Напишите нам</h3>
            <p className="text-xs text-slate-500">Мы ответим вам прямо здесь</p>
          </div>
          <SupportChat />
        </div>
      )}
    </PublicPageLayout>
  );
}
