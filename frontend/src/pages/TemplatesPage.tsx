import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Trash2, Calendar, Clock, Palette } from "lucide-react";
import { useShiftTemplates } from "../store/shiftTemplates";
import NavBar from "../components/NavBar";
import { validateShiftTimes } from "../lib/time";
import { alertDialog } from "../store/dialogs";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z.object({
  name: z.string().min(2, "Минимум 2 символа").max(100),
  startTime: z.string().regex(timeRegex, "Формат HH:MM"),
  endTime: z.string().regex(timeRegex, "Формат HH:MM"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Формат #RRGGBB"),
});

type Form = z.infer<typeof schema>;

const PRESET_COLORS = [
  { value: "#F59E0B", label: "Утро" },
  { value: "#3B82F6", label: "День" },
  { value: "#10B981", label: "Вечер" },
  { value: "#8B5CF6", label: "Ночь" },
  { value: "#EF4444", label: "Красный" },
  { value: "#6B7280", label: "Нейтральный" },
];

export default function TemplatesPage() {
  const { items, loading, error, fetch, create, remove } = useShiftTemplates();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      startTime: "09:00",
      endTime: "18:00",
      color: "#3B82F6",
    },
  });

  const selectedColor = watch("color");

  useEffect(() => {
    fetch();
  }, [fetch]);

  const onSubmit = async (data: Form) => {
    const timeCheck = validateShiftTimes(data.startTime, data.endTime);
    if (!timeCheck.ok) {
      await alertDialog(timeCheck.message ?? "Неверное время смены", {
        title: "Ошибка в времени",
        variant: "error",
      });
      return;
    }

    try {
      await create(data);
      reset();
      setShowForm(false);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить шаблон «${name}»?`)) return;
    try {
      await remove(id);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка удаления");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Шаблоны смен
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Создайте шаблоны один раз — используйте в любой неделе
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Отмена
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Новый шаблон
              </>
            )}
          </button>
        </div>

        {/* Форма */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-4">
              Новый шаблон смены
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Название
                  </label>
                  <input
                    {...register("name")}
                    placeholder="Например: Утренняя"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Начало
                  </label>
                  <input
                    type="time"
                    {...register("startTime")}
                  />
                  {errors.startTime && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.startTime.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Конец
                  </label>
                  <input
                    type="time"
                    {...register("endTime")}
                  />
                  {errors.endTime && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.endTime.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Цвет
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setValue("color", c.value)}
                      title={c.label}
                      className={`w-9 h-9 rounded-xl transition-all ${
                        selectedColor === c.value
                          ? "ring-2 ring-offset-2 ring-slate-900 scale-105"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <div className="relative">
                    <input
                      type="color"
                      {...register("color")}
                      className="!w-9 !h-9 !p-0 !border-0 rounded-xl cursor-pointer"
                      title="Свой цвет"
                    />
                  </div>
                </div>
                {errors.color && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.color.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Пустое состояние */}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Пока нет шаблонов
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Создайте шаблоны смен — «Утренняя», «Вечерняя» — чтобы не
              вводить время вручную на каждой неделе
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700 text-sm font-medium shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              Создать первый шаблон
            </button>
          </div>
        )}

        {/* Сетка шаблонов */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((t) => (
              <div
                key={t.id}
                className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden animate-fade-in"
              >
                {/* Цветная полоса слева */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: t.color }}
                />

                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: t.color + "20",
                          color: t.color,
                        }}
                      >
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {t.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Шаблон смены
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all shrink-0"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                      {t.startTime}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                      {t.endTime}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}