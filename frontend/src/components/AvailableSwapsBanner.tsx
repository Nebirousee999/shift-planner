import { useEffect, useState } from "react";
import { ArrowRightLeft, Check, X, Clock, CalendarDays } from "lucide-react";
import { useSwaps } from "../store/swaps";
import { useNotifications } from "../store/notifications";
import { alertDialog } from "../store/dialogs";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export default function AvailableSwapsBanner() {
  const { available, fetchAvailable, accept, decline } = useSwaps();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailable();
  }, [fetchAvailable]);

  const visible = available.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  const onAccept = async (id: string) => {
    setBusy(id);
    try {
      await accept(id);
      useNotifications.getState().refresh();
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const onDecline = async (id: string, isTargeted: boolean) => {
    setBusy(id);
    try {
      await decline(id);
      setDismissed((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      useNotifications.getState().refresh();
      // Для адресного — сервер меняет статус, для открытого — прячем локально
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка", {
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <div className="bg-gradient-to-r from-violet-50 to-brand-50 rounded-2xl border-2 border-violet-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm">
              Предложения обмена
            </h3>
            <p className="text-xs text-slate-500">
              Коллеги предлагают смены — можно взять себе
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-violet-200 text-violet-900 text-xs font-bold">
            {visible.length}
          </span>
        </div>

        <div className="space-y-2">
          {visible.map((s) => {
            const isTargeted = !!s.swapWithUserId;
            const b = busy === s.id;
            return (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-violet-200 p-3 flex items-center gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 text-sm truncate">
                    {s.requestedByName ?? "Сотрудник"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {shortDate(s.shiftDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.startTime}–{s.endTime}
                    </span>
                    {isTargeted && (
                      <span className="text-[10px] uppercase tracking-wide text-violet-700 font-semibold bg-violet-100 px-1.5 py-0.5 rounded">
                        адресный
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => onAccept(s.id)}
                    disabled={b}
                    className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {b ? "..." : "Принять"}
                  </button>
                  <button
                    onClick={() => onDecline(s.id, isTargeted)}
                    disabled={b}
                    className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    {isTargeted ? "Отклонить" : "Скрыть"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
