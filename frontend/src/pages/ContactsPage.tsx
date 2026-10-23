import PublicPageLayout from "../components/landing/PublicPageLayout";
import { Mail, Send } from "lucide-react";

export default function ContactsPage() {
  return (
    <PublicPageLayout title="Контакты">
      <p className="mb-6">Мы всегда рады помочь. Выберите удобный способ связи:</p>
      
      <div className="space-y-6 not-prose">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Email</div>
            <a href="mailto:help@shift-planner.ru" className="text-brand-600 hover:underline">
              help@shift-planner.ru
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Telegram</div>
            <a href="https://t.me/shift_planner_support" className="text-brand-600 hover:underline">
              @shift_planner_support
            </a>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}