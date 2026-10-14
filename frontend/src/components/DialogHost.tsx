import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  AlertTriangle,
} from "lucide-react";
import { useDialogs } from "../store/dialogs";

export default function DialogHost() {
  const { current, close } = useDialogs();

  if (!current) return null;

  const isAlert = current.kind === "alert";
  const isConfirm = current.kind === "confirm";

  // Иконка и цвет
  let Icon = Info;
  let iconBg = "bg-brand-50";
  let iconColor = "text-brand-600";

  if (isAlert && current.variant === "error") {
    Icon = AlertCircle;
    iconBg = "bg-red-50";
    iconColor = "text-red-600";
  } else if (isAlert && current.variant === "success") {
    Icon = CheckCircle2;
    iconBg = "bg-emerald-50";
    iconColor = "text-emerald-600";
  } else if (isConfirm && current.variant === "danger") {
    Icon = AlertTriangle;
    iconBg = "bg-red-50";
    iconColor = "text-red-600";
  }

  const onConfirm = () => {
    if (current.kind === "confirm") {
      current.resolve(true);
    } else {
      current.resolve();
    }
  };

  const onCancel = () => {
    if (current.kind === "confirm") {
      current.resolve(false);
    } else {
      current.resolve();
    }
  };

  const confirmLabel =
    current.kind === "confirm"
      ? current.confirmLabel ?? "ОК"
      : "Понятно";
  const cancelLabel =
    current.kind === "confirm" ? current.cancelLabel ?? "Отмена" : null;
  const isDanger = current.kind === "confirm" && current.variant === "danger";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
            >
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              {current.title && (
                <h3 className="font-semibold text-slate-900 text-base mb-1">
                  {current.title}
                </h3>
              )}
              <p className="text-sm text-slate-600 whitespace-pre-line break-words">
                {current.message}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          {isConfirm && cancelLabel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors border border-slate-200"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all shadow-sm hover:shadow ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}