import { useState, useEffect } from "react";
import {
  Send,
  Bell,
  CalendarClock,
  AlertTriangle,
  ArrowRightLeft,
  Check,
  X,
  MessageSquare,
  Smartphone,
} from "lucide-react";

// ─── Типы ──────────────────────────────────────────
type Channel = "telegram" | "max";

type NotificationType = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
};

const INITIAL_NOTIFICATIONS: NotificationType[] = [
  {
    id: "new_schedule",
    label: "Новый график",
    description: "Когда руководитель публикует расписание на неделю",
    icon: Bell,
    enabled: true,
  },
  {
    id: "shift_reminder",
    label: "Напоминание о смене",
    description: "За 2 часа до начала смены",
    icon: CalendarClock,
    enabled: true,
  },
  {
    id: "shift_change",
    label: "Изменение смены",
    description: "Когда смена меняется или отменяется",
    icon: AlertTriangle,
    enabled: true,
  },
  {
    id: "swap_request",
    label: "Запрос на обмен",
    description: "Когда коллега предлагает обменяться сменами",
    icon: ArrowRightLeft,
    enabled: false,
  },
];

// ─── Компонент предпросмотра ───────────────────────
function ChatPreview({
  channel,
  enabledTypes,
  onInteract,
}: {
  channel: Channel;
  enabledTypes: string[];
  onInteract?: () => void;
}) {
  const isTelegram = channel === "telegram";
  const [action, setAction] = useState<string | null>(null);

  // Определяем, какое сообщение показать (приоритет: график -> изменение -> напоминание -> обмен)
  const messageToShow = enabledTypes.includes("new_schedule")
    ? "new_schedule"
    : enabledTypes.includes("shift_change")
    ? "shift_change"
    : enabledTypes.includes("shift_reminder")
    ? "shift_reminder"
    : enabledTypes.includes("swap_request")
    ? "swap_request"
    : "empty";

  // Сбрасываем состояние кнопки при смене сообщения или мессенджера
  useEffect(() => {
    setAction(null);
  }, [messageToShow, channel]);

  const handleAction = (act: string) => {
    setAction(act);
    onInteract?.();
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
      {/* Шапка чата */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white shrink-0">
          <Send className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-sm truncate">
            Планировщик смен
          </div>
          <div className="text-[10px] text-slate-500">
            {isTelegram ? "Telegram" : "MAX"} · бот
          </div>
        </div>
        <div className="ml-auto text-slate-400">
          <Smartphone className="w-4 h-4" />
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messageToShow === "empty" && (
          <div className="text-center text-slate-400 text-sm mt-10">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Включите хотя бы одно уведомление,</p>
            <p>чтобы увидеть пример</p>
          </div>
        )}

        {messageToShow === "new_schedule" && (
          <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[90%] animate-fade-in">
            <div className="text-xs font-semibold text-brand-600 mb-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />
              Новый график на неделю
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              Привет! Опубликован график на <b>20–26 октября</b>. У тебя{" "}
              <b>4 смены</b> на этой неделе.
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-600 space-y-1">
              <div>Пн 20 окт · 09:00–15:00</div>
              <div>Ср 22 окт · 12:00–20:00</div>
              <div>Пт 24 окт · 10:00–18:00</div>
              <div>Сб 25 окт · 08:00–14:00</div>
            </div>
            <div className="mt-3">
              {action === "opened" ? (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Открыто в приложении
                </div>
              ) : (
                <button
                  onClick={() => handleAction("opened")}
                  className="w-full bg-brand-50 text-brand-700 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors"
                >
                  Открыть в приложении
                </button>
              )}
            </div>
          </div>
        )}

        {messageToShow === "shift_change" && (
          <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[90%] animate-fade-in">
            <div className="text-xs font-semibold text-rose-600 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Смена изменена
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              Твоя смена в <b>среду, 22 октября</b> изменена.
            </p>
            <div className="mt-2 text-xs space-y-1">
              <div className="text-slate-400 line-through">12:00–20:00</div>
              <div className="text-slate-900 font-medium">14:00–22:00</div>
            </div>
            <div className="mt-3">
              {action === "accepted" ? (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Изменение принято
                </div>
              ) : action === "declined" ? (
                <div className="flex items-center gap-1 text-rose-600 text-xs font-medium bg-rose-50 px-3 py-1.5 rounded-lg">
                  <X className="w-3.5 h-3.5" /> Вы оспорили изменение
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("accepted")}
                    className="flex-1 bg-emerald-50 text-emerald-700 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleAction("declined")}
                    className="flex-1 bg-slate-50 text-slate-600 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
                  >
                    Оспорить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {messageToShow === "shift_reminder" && (
          <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[90%] animate-fade-in">
            <div className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />
              Напоминание
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              Через 2 часа начинается твоя смена.
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-700">
              <div className="font-semibold">Сегодня, 22 октября</div>
              <div>12:00–20:00 · Дневная</div>
            </div>
            <div className="mt-3">
              {action === "confirm" ? (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Вы подтвердили смену
                </div>
              ) : action === "cannot" ? (
                <div className="flex items-center gap-1 text-rose-600 text-xs font-medium bg-rose-50 px-3 py-1.5 rounded-lg">
                  <X className="w-3.5 h-3.5" /> Вы сообщили, что не сможете
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("confirm")}
                    className="flex-1 bg-brand-50 text-brand-700 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors"
                  >
                    Я буду
                  </button>
                  <button
                    onClick={() => handleAction("cannot")}
                    className="flex-1 bg-slate-50 text-slate-600 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
                  >
                    Не смогу
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {messageToShow === "swap_request" && (
          <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[90%] animate-fade-in">
            <div className="text-xs font-semibold text-violet-600 mb-1 flex items-center gap-1">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Запрос на обмен
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              <b>Мария Иванова</b> предлагает обменяться сменами.
            </p>
            <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-700">
              <div>Пт 24 окт · 10:00–18:00</div>
              <div className="text-slate-400 mt-1">→ на вашу смену:</div>
              <div>Сб 25 окт · 08:00–14:00</div>
            </div>
            <div className="mt-3">
              {action === "swap_accepted" ? (
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Обмен принят
                </div>
              ) : action === "swap_declined" ? (
                <div className="flex items-center gap-1 text-rose-600 text-xs font-medium bg-rose-50 px-3 py-1.5 rounded-lg">
                  <X className="w-3.5 h-3.5" /> Обмен отклонён
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("swap_accepted")}
                    className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleAction("swap_declined")}
                    className="flex-1 bg-slate-100 text-slate-600 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Поле ввода */}
      <div className="bg-white border-t border-slate-200 p-3">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="flex-1 bg-slate-100 rounded-full px-4 py-2">
            Сообщение...
          </div>
          <Send className="w-5 h-5 text-slate-300" />
        </div>
      </div>
    </div>
  );
}

// ─── Основной компонент ────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function NotificationsDemo({ onInteract }: Props) {
  const [channel] = useState<Channel>("max");
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const interact = () => onInteract?.();

  const toggle = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
    interact();
  };

  const enabledIds = notifications.filter((n) => n.enabled).map((n) => n.id);

  return (
    <div className="bg-white rounded-xl">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-600" />
            Уведомления в мессенджер
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Сотрудники получают важное прямо в MAX
          </div>
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => {
              setChannel("telegram");
              interact();
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              channel === "telegram"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => {
              setChannel("max");
              interact();
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              channel === "max"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            MAX
          </button>
        </div>
      </div>

      {/* Две колонки */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Левая: настройки */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
            Какие уведомления отправлять
          </div>
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => toggle(n.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  n.enabled
                    ? "bg-brand-50/50 border-brand-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    n.enabled ? "bg-brand-600" : "bg-slate-200"
                  }`}
                >
                  {n.enabled && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold ${
                      n.enabled ? "text-slate-900" : "text-slate-600"
                    }`}
                  >
                    {n.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {n.description}
                  </div>
                </div>
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    n.enabled ? "text-brand-500" : "text-slate-400"
                  }`}
                />
              </button>
            );
          })}

          <div className="pt-3">
            <button
              onClick={interact}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors"
            >
              <Send className="w-4 h-4" />
              Отправить тестовое сообщение
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Тестовое сообщение придёт в выбранный мессенджер
            </p>
          </div>
        </div>

        {/* Правая: предпросмотр */}
        <div className="h-[380px] sm:h-[420px]">
          <ChatPreview
            channel={channel}
            enabledTypes={enabledIds}
            onInteract={interact}
          />
        </div>
      </div>

      {/* Подсказка */}
      <div className="mt-5 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Переключайте уведомления и мессенджер — предпросмотр меняется.
            Кнопки в чате кликабельны!
          </span>
          <span className="sm:hidden">💡 Нажмите на уведомление</span>
        </div>
      </div>
    </div>
  );
}