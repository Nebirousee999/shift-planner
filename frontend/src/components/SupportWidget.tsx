import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useAuth } from "../store/auth";
import SupportChat from "./SupportChat";

export default function SupportWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Сотрудники не видят эту форму
  if (user?.role === "EMPLOYEE") return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 sm:w-96 mb-4 overflow-hidden animate-fade-in flex flex-col">
          <div className="bg-brand-600 text-white p-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-sm">Чат с поддержкой</h3>
              <p className="text-brand-100 text-[10px]">Ответим на почту или в MAX</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <SupportChat />
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-brand-600 text-white rounded-full shadow-xl hover:bg-brand-700 transition-all flex items-center justify-center hover:scale-105"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
