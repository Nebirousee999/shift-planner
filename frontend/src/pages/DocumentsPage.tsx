import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Download,
  Trash2,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  ClipboardList,
  Shield,
  Briefcase,
  FileCheck2,
  Heart,
  ScrollText,
  BookOpen,
  Upload,
  FileDown,
  Check,
  Eye,
  HelpCircle,
  FileSpreadsheet,
  Package,
  Lock,
} from "lucide-react";
import { useDocuments } from "../store/documents";
import { documentsApi, type DocumentType } from "../api/documents";
import { customTemplatesApi } from "../api/customTemplates";
import { batchApi } from "../api/batch";
import { organizationApi, type Organization } from "../api/organization";
import { useOrganization } from "../store/organization";
import { meApi, type Colleague } from "../api/me";
import NavBar from "../components/NavBar";
import DocxPreviewModal from "../components/DocxPreviewModal";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hh}:${mm}`;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCategoryIcon(category: string): React.ElementType {
  switch (category) {
    case "Приказы":
      return ClipboardList;
    case "Инструкции":
      return BookOpen;
    case "Журналы":
      return ScrollText;
    case "Договоры":
      return Briefcase;
    case "Согласия":
      return Heart;
    case "Правила":
      return ScrollText;
    case "Заявления":
      return FileText;
    default:
      return FileText;
  }
}

function getDocMeta(type: string): {
  icon: React.ElementType;
  bg: string;
  text: string;
} {
  if (type.includes("safety")) {
    return { icon: Shield, bg: "bg-emerald-50", text: "text-emerald-600" };
  }
  if (type.includes("fire")) {
    return { icon: AlertCircle, bg: "bg-red-50", text: "text-red-600" };
  }
  if (type.includes("vacation")) {
    return { icon: Briefcase, bg: "bg-amber-50", text: "text-amber-600" };
  }
  if (type.includes("hire")) {
    return { icon: FileCheck2, bg: "bg-blue-50", text: "text-blue-600" };
  }
  if (type.includes("instruction")) {
    return { icon: BookOpen, bg: "bg-teal-50", text: "text-teal-600" };
  }
  if (type.includes("journal")) {
    return { icon: ScrollText, bg: "bg-indigo-50", text: "text-indigo-600" };
  }
  if (type.includes("contract")) {
    return { icon: Briefcase, bg: "bg-violet-50", text: "text-violet-600" };
  }
  if (type.includes("consent") || type.includes("personal")) {
    return { icon: Heart, bg: "bg-pink-50", text: "text-pink-600" };
  }
  if (type.includes("rules")) {
    return { icon: ScrollText, bg: "bg-slate-100", text: "text-slate-600" };
  }
  return { icon: FileText, bg: "bg-slate-100", text: "text-slate-600" };
}

// Поля, которые заполняются автоматически (скрыты из формы)
const HIDDEN_FIELDS = [
  "orgName",
  "city",
  "directorName",
  "orgInn",
  "orgAddress",
  "responsiblePosition",
  "employeePosition",
  "position",
  "personPosition",
];

export default function DocumentsPage() {
  const {
    templates,
    generated,
    loading,
    error,
    fetchTemplates,
    fetchGenerated,
    generate,
    remove,
    download,
  } = useDocuments();

  const [selected, setSelected] = useState<DocumentType | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [multiSelectValues, setMultiSelectValues] = useState<
    Record<string, string[]>
  >({});
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewName, setPreviewName] = useState("");

  const orgStore = useOrganization((s) => s.org);
  const isTrial = orgStore?.trialEndsAt && new Date(orgStore.trialEndsAt) > new Date();
  const isPaid = orgStore?.tariffExpiresAt && new Date(orgStore.tariffExpiresAt) > new Date();
  const effectiveTariff = isTrial ? "pro" : (isPaid ? orgStore?.tariffId : "free");
  const isFree = effectiveTariff === "free";

  const navigate = useNavigate();
  const [lockedModalOpen, setLockedModalOpen] = useState(false);
  const [org, setOrg] = useState<Organization | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);

  // Свой шаблон
  const [useCustom, setUseCustom] = useState(false);
  const [customExists, setCustomExists] = useState(false);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Массовая генерация из Excel
  const [useBatch, setUseBatch] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchGenerated();
    organizationApi.get().then(setOrg).catch(() => {});
    meApi.colleagues().then(setColleagues).catch(() => {});
  }, [fetchTemplates, fetchGenerated]);

  const buildFinalParams = (): Record<string, any> => {
    const params: Record<string, any> = { ...formValues };
    for (const [key, ids] of Object.entries(multiSelectValues)) {
      params[key] = ids;
    }
    return params;
  };

  const openForm = (tpl: DocumentType) => {
    setSelected(tpl);
    const initial: Record<string, string> = {};
    const initialMulti: Record<string, string[]> = {};

    for (const f of tpl.fields) {
      if (f.name === "orgName" && org?.name) {
        initial[f.name] = org.name;
      } else if (f.name === "city" && org?.city) {
        initial[f.name] = org.city;
      } else if (f.name === "directorName" && org?.directorName) {
        initial[f.name] = org.directorName;
      } else if (f.name === "orgInn" && org?.inn) {
        initial[f.name] = org.inn;
      } else if (f.name === "orgAddress" && org?.legalAddress) {
        initial[f.name] = org.legalAddress;
      } else if (f.type === "date" && !f.defaultValue) {
        initial[f.name] = todayISO();
      } else if (f.type === "employee_select" && !f.defaultValue) {
        initial[f.name] = "";
      } else if (f.type === "employee_multi_select") {
        initialMulti[f.name] = colleagues.map((c) => c.id);
      } else {
        initial[f.name] = f.defaultValue ?? "";
      }
    }

    setFormValues(initial);
    setMultiSelectValues(initialMulti);
    setUseCustom(false);
    setUseBatch(false);
    setBatchFile(null);

    customTemplatesApi
      .check(tpl.id)
      .then((r) => {
        setCustomExists(r.exists);
        setCustomFileName(r.fileName);
        // Если шаблон уже загружен — включаем useCustom по умолчанию
        if (r.exists) setUseCustom(true);
      })
      .catch(() => {
        setCustomExists(false);
        setCustomFileName(null);
      });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setSelected(null);
    setFormValues({});
    setMultiSelectValues({});
    setUseCustom(false);
    setUseBatch(false);
    setBatchFile(null);
  };

  // ─── Обычная генерация ──────────────────────────────
  const onGenerate = async () => {
    if (!selected) return;

    const params = buildFinalParams();

    for (const f of selected.fields) {
      if (
        f.required &&
        !HIDDEN_FIELDS.includes(f.name) &&
        f.type !== "employee_multi_select" &&
        !String(params[f.name] ?? "").trim()
      ) {
        alert(`Заполните поле: ${f.label}`);
        return;
      }
      if (
        f.required &&
        f.type === "employee_multi_select" &&
        (!params[f.name] || params[f.name].length === 0)
      ) {
        alert(`Выберите хотя бы одного сотрудника в поле «${f.label}»`);
        return;
      }
    }

    setGenerating(true);
    try {
      if (selected.notStored) {
        await documentsApi.generateStream(selected.id, params);
        closeForm();
        return;
      }

      const doc = await generate(selected.id, params);
      closeForm();
      const ok = confirm(
        `Документ «${doc.title}» создан!\n\nСкачать сейчас?`
      );
      if (ok) {
        await download(doc.id, `${doc.title}.docx`);
      }
    } catch (e: any) {
      alert(e.response?.data?.error ?? e.message ?? "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  // ─── Генерация по своему шаблону ────────────────────
  const onGenerateCustom = async () => {
    if (!selected) return;

    const params = buildFinalParams();

    for (const f of selected.fields) {
      if (
        f.required &&
        !HIDDEN_FIELDS.includes(f.name) &&
        f.type !== "employee_multi_select" &&
        !String(params[f.name] ?? "").trim()
      ) {
        alert(`Заполните поле: ${f.label}`);
        return;
      }
      if (
        f.required &&
        f.type === "employee_multi_select" &&
        (!params[f.name] || params[f.name].length === 0)
      ) {
        alert(`Выберите хотя бы одного сотрудника в поле «${f.label}»`);
        return;
      }
    }

    setGenerating(true);
    try {
      await customTemplatesApi.render(
        selected.id,
        params,
        [],
        selected.title
      );
    } catch (e: any) {
      alert(e.message ?? "Ошибка");
    } finally {
      setGenerating(false);
    }
  };

  const onDownload = async (id: string, title: string) => {
    try {
      await download(id, `${title}.docx`);
    } catch (e: any) {
      alert(e.message ?? "Ошибка скачивания");
    }
  };

  const onRemove = async (id: string, title: string) => {
    if (!confirm(`Удалить «${title}» из истории?`)) return;
    try {
      await remove(id);
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка удаления");
    }
  };

  // ─── Свой шаблон ────────────────────────────────────
  const onDownloadSample = async () => {
    if (!selected) return;
    try {
      await customTemplatesApi.downloadSample(selected.id, selected.title);
    } catch (e: any) {
      alert(e.message ?? "Ошибка");
    }
  };

  const onUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      alert("Загрузите файл в формате .docx");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      await customTemplatesApi.upload(selected.id, file);
      setCustomExists(true);
      setCustomFileName(file.name);
      setUseCustom(true);
    } catch (err: any) {
      alert(err.message ?? "Ошибка загрузки");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onDeleteCustom = async () => {
    if (!selected) return;
    if (!confirm("Удалить свой шаблон?")) return;
    try {
      await customTemplatesApi.remove(selected.id);
      setCustomExists(false);
      setCustomFileName(null);
      setUseCustom(false);
    } catch (e: any) {
      alert(e.message ?? "Ошибка");
    }
  };

  // ─── Превью ─────────────────────────────────────────
  const onPreview = async () => {
    if (!selected) return;

    const params = buildFinalParams();

    for (const f of selected.fields) {
      if (
        f.required &&
        !HIDDEN_FIELDS.includes(f.name) &&
        f.type !== "employee_multi_select" &&
        !String(params[f.name] ?? "").trim()
      ) {
        alert(`Заполните поле: ${f.label}`);
        return;
      }
    }

    setPreviewing(true);
    try {
      let blob: Blob;
      if (useCustom) {
        blob = await customTemplatesApi.preview(selected.id, params, []);
      } else {
        blob = await documentsApi.preview(selected.id, params);
      }
      setPreviewBlob(blob);
      setPreviewName(selected.title);
    } catch (e: any) {
      alert(e.message ?? "Ошибка превью");
    } finally {
      setPreviewing(false);
    }
  };

  // ─── Массовая генерация ─────────────────────────────
  const onDownloadExcelTemplate = async () => {
    if (!selected) return;
    try {
      await batchApi.downloadTemplate(selected.id, selected.title);
    } catch (e: any) {
      alert(e.message ?? "Ошибка скачивания шаблона");
    }
  };

  const onUploadBatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("Загрузите файл в формате .xlsx");
      e.target.value = "";
      return;
    }
    setBatchFile(file);
  };

  const onGenerateBatch = async () => {
    if (!selected || !batchFile) return;
    setBatchGenerating(true);
    try {
      await batchApi.generateBatch(selected.id, batchFile, selected.title);
      closeForm();
    } catch (e: any) {
      alert(e.message ?? "Ошибка генерации");
    } finally {
      setBatchGenerating(false);
    }
  };

  const byCategory = templates.reduce<Record<string, DocumentType[]>>(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ⚠️ ЮРИДИЧЕСКИЙ ДИСКЛЕЙМЕР */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <b>Внимание:</b> Шаблоны документов предоставляются исключительно в справочных целях и не имеют юридической силы. 
            Перед использованием проверьте документ на соответствие актуальному законодательству РФ и при необходимости проконсультируйтесь со специалистом.
          </div>
        </div>

        {!selected ? (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Документы</h1>
            <p className="text-sm text-slate-500 mt-1">
              Готовые шаблоны документов по охране труда — заполните форму и
              скачайте в DOCX
            </p>
          </div>
        ) : (
          <button
            onClick={closeForm}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
          >
            <ChevronLeft className="w-4 h-4" />К каталогу документов
          </button>
        )}

        {loading && <p className="text-slate-500 text-sm">Загрузка...</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* ═══ КАТАЛОГ ═══ */}
        {!selected && (
          <>
            {Object.entries(byCategory).map(([category, docs]) => {
              const isCategoryLocked = isFree && category !== "Приказы";
              const CategoryIcon = getCategoryIcon(category);
              return (
                <div key={category} className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <CategoryIcon className="w-4 h-4 text-slate-400" />
                    <h2 className="font-semibold text-slate-900">
                      {category}
                    </h2>
                    <span className="text-xs text-slate-400">
                      {docs.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((t) => {
                      const meta = getDocMeta(t.id);
                      const Icon = meta.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (isCategoryLocked) {
                              setLockedModalOpen(true);
                            } else {
                              openForm(t);
                            }
                          }}
                          className={`group bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-left transition-all animate-fade-in ${isCategoryLocked ? "opacity-70 grayscale cursor-pointer hover:border-amber-300" : "hover:shadow-md hover:border-slate-300"}`}
                        >
                          <div className="flex items-start gap-4 mb-3">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 leading-snug mb-1">
                                {t.title}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {t.description}
                              </p>
                            </div>
                          </div>
                          {isCategoryLocked ? (
                            <div className="flex items-center gap-1 text-xs font-medium text-amber-600 pt-2 border-t border-slate-100">
                              <Lock className="w-3.5 h-3.5" />
                              Доступно только для Pro
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700 pt-2 border-t border-slate-100">
                              <Sparkles className="w-3.5 h-3.5" />
                              Заполнить и скачать
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {generated.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <h2 className="font-semibold text-slate-900">
                    История документов
                  </h2>
                  <span className="text-xs text-slate-400">
                    {generated.length}
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left">
                      <tr>
                        <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Название
                        </th>
                        <th className="px-5 py-3.5 font-medium text-slate-600 text-xs uppercase tracking-wide">
                          Создан
                        </th>
                        <th className="px-5 py-3.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {generated.map((d) => {
                        const meta = getDocMeta(d.type);
                        const Icon = meta.icon;
                        return (
                          <tr
                            key={d.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-slate-900">
                                  {d.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 text-xs">
                              {formatDateTime(d.createdAt)}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onDownload(d.id, d.title)}
                                  className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Скачать
                                </button>
                                <button
                                  onClick={() => onRemove(d.id, d.title)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                  title="Удалить из истории"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ФОРМА ═══ */}
        {selected && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
            {/* Заголовок */}
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100">
              {(() => {
                const meta = getDocMeta(selected.id);
                const Icon = meta.icon;
                return (
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                );
              })()}
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selected.title}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selected.description}
                </p>
              </div>
            </div>

            {/* Предупреждение для ПДн */}
            {selected.notStored && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <b>Документ содержит персональные данные.</b> В истории не
                  сохраняется. Можно сгенерировать один документ вручную или
                  загрузить Excel с данными нескольких сотрудников.
                </div>
              </div>
            )}

            {/* ─── Массовая генерация из Excel ─── */}
            {selected.notStored && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="use-batch"
                    checked={useBatch}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseBatch(checked);
                      if (!checked) setBatchFile(null);
                    }}
                    className="!w-4 !h-4 mt-1 !p-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="use-batch"
                      className="font-medium text-sm text-slate-900 cursor-pointer select-none"
                    >
                      Массовая генерация из Excel
                    </label>
                    <p className="text-xs text-slate-600 mt-1">
                      Скачайте шаблон Excel, заполните по одной строке на
                      каждого сотрудника, загрузите обратно — получите ZIP с
                      готовыми документами.
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3 items-center">
                      <button
                        type="button"
                        onClick={onDownloadExcelTemplate}
                        disabled={!useBatch}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                          useBatch
                            ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                            : "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Скачать шаблон Excel
                      </button>

                      <label
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                          useBatch
                            ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                            : "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {batchFile ? "Заменить файл" : "Загрузить Excel"}
                        <input
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={onUploadBatchFile}
                          className="hidden"
                          disabled={!useBatch}
                        />
                      </label>

                      {batchFile && useBatch && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                          <Check className="w-3.5 h-3.5" />
                          {batchFile.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Форма полей (скрывается при массовой генерации) ─── */}
            {!useBatch && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {selected.fields
                  .filter((f) => !HIDDEN_FIELDS.includes(f.name))
                  .map((f) => {
                    const isFullWidth =
                      f.type === "textarea" ||
                      f.type === "employee_multi_select" ||
                      (f.type === "text" && f.name === "description");
                    return (
                      <div
                        key={f.name}
                        className={isFullWidth ? "md:col-span-2" : ""}
                      >
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {f.label}
                          {f.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>

                        {f.type === "textarea" ? (
                          <textarea
                            value={formValues[f.name] ?? ""}
                            onChange={(e) =>
                              setFormValues((v) => ({
                                ...v,
                                [f.name]: e.target.value,
                              }))
                            }
                            placeholder={f.placeholder}
                            rows={5}
                            className="w-full font-mono text-xs"
                          />
                        ) : f.type === "employee_select" ? (
                          <select
                            value={formValues[f.name] ?? ""}
                            onChange={(e) => {
                              const employeeName = e.target.value;
                              const employee = colleagues.find(
                                (c) => c.name === employeeName
                              );

                              setFormValues((v) => {
                                const updated = {
                                  ...v,
                                  [f.name]: employeeName,
                                };

                                if (employee?.position) {
                                  const positionFields = [
                                    "responsiblePosition",
                                    "position",
                                    "employeePosition",
                                    "personPosition",
                                  ];
                                  for (const pf of positionFields) {
                                    if (
                                      selected?.fields.some(
                                        (field) => field.name === pf
                                      )
                                    ) {
                                      updated[pf] = employee.position;
                                    }
                                  }
                                }

                                return updated;
                              });
                            }}
                            className="w-full"
                          >
                            <option value="">— Выберите сотрудника —</option>
                            {colleagues.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                                {c.position ? ` — ${c.position}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "employee_multi_select" ? (
                          <div className="border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setMultiSelectValues((v) => ({
                                    ...v,
                                    [f.name]: colleagues.map((c) => c.id),
                                  }))
                                }
                                className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Выбрать всех
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMultiSelectValues((v) => ({
                                    ...v,
                                    [f.name]: [],
                                  }))
                                }
                                className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Сбросить
                              </button>
                              <span className="ml-auto text-xs text-slate-500">
                                Выбрано:{" "}
                                <b>{multiSelectValues[f.name]?.length ?? 0}</b>{" "}
                                из {colleagues.length}
                              </span>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                              {colleagues.length === 0 && (
                                <div className="text-xs text-slate-400 text-center py-3">
                                  Нет сотрудников
                                </div>
                              )}
                              {colleagues.map((c) => {
                                const checked =
                                  multiSelectValues[f.name]?.includes(c.id) ??
                                  false;
                                return (
                                  <label
                                    key={c.id}
                                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                      checked
                                        ? "bg-brand-50/40"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setMultiSelectValues((v) => {
                                          const current = v[f.name] ?? [];
                                          const updated = e.target.checked
                                            ? [...current, c.id]
                                            : current.filter(
                                                (id) => id !== c.id
                                              );
                                          return { ...v, [f.name]: updated };
                                        });
                                      }}
                                      className="!w-4 !h-4 !p-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-900 truncate">
                                        {c.name}
                                      </div>
                                      <div className="text-xs text-slate-500 truncate">
                                        {c.position
                                          ? `${c.position} · `
                                          : ""}
                                        {c.email}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <input
                            type={f.type === "date" ? "date" : "text"}
                            value={formValues[f.name] ?? ""}
                            onChange={(e) =>
                              setFormValues((v) => ({
                                ...v,
                                [f.name]: e.target.value,
                              }))
                            }
                            placeholder={f.placeholder}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ─── Свой шаблон — виден всегда, кнопки активны при useCustom ─── */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="use-custom"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="!w-4 !h-4 mt-1 !p-0 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label
                      htmlFor="use-custom"
                      className="font-medium text-sm text-slate-900 cursor-pointer select-none"
                    >
                      Свой шаблон документа
                    </label>
                    <a
                      href="/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Как это работает?
                    </a>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {useCustom
                      ? "Скачайте образец, отредактируйте в Word, загрузите обратно. Плейсхолдеры вида {Организация} подставятся автоматически."
                      : "Поставьте галочку, чтобы скачать образец и загрузить свой .docx."}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={onDownloadSample}
                      disabled={!useCustom}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                        useCustom
                          ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                          : "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Скачать образец
                    </button>

                    <label
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                        useCustom
                          ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                          : "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploading
                        ? "Загрузка..."
                        : customExists
                        ? "Заменить файл"
                        : "Загрузить .docx"}
                      <input
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={onUploadTemplate}
                        className="hidden"
                        disabled={!useCustom || uploading}
                      />
                    </label>

                    {customExists && (
                      <button
                        type="button"
                        onClick={onDeleteCustom}
                        disabled={!useCustom}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          useCustom
                            ? "text-red-600 hover:bg-red-50 cursor-pointer"
                            : "text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Удалить шаблон
                      </button>
                    )}
                  </div>

                  {customExists && (
                    <div className="mt-2 text-xs text-emerald-700 inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Загружен шаблон: {customFileName ?? "свой файл"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Кнопки ─── */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 flex-wrap">
              {useBatch ? (
                <button
                  onClick={onGenerateBatch}
                  disabled={!batchFile || batchGenerating}
                  className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
                >
                  <Package className="w-4 h-4" />
                  {batchGenerating
                    ? "Генерация..."
                    : useCustom
                    ? "Сгенерировать пакет по своему шаблону (ZIP)"
                    : "Сгенерировать пакет документов (ZIP)"}
                </button>
              ) : (
                <>
                  <button
                    onClick={useCustom ? onGenerateCustom : onGenerate}
                    disabled={generating || previewing}
                    className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium shadow-sm hover:shadow transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generating
                      ? "Генерация..."
                      : useCustom
                      ? "Сгенерировать по своему шаблону"
                      : selected.notStored
                      ? "Скачать без сохранения в истории"
                      : "Сгенерировать DOCX"}
                  </button>

                  <button
                    onClick={onPreview}
                    disabled={generating || previewing}
                    className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    {previewing ? "Загрузка..." : "Показать превью"}
                  </button>
                </>
              )}

              <button
                onClick={closeForm}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors ml-auto"
              >
                Отмена
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              {useBatch
                ? useCustom
                  ? "Документы будут сгенерированы по вашему шаблону. Данные подставятся из Excel."
                  : "Результат — ZIP-архив с документами для каждого сотрудника (по стандартному шаблону)."
                : selected.notStored
                ? "Этот документ не сохраняется в истории из-за содержания персональных данных."
                : "После генерации документ сохранится в истории — вы сможете скачать его повторно в любой момент."}
            </p>
          </div>
        )}
      </main>

      {lockedModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setLockedModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Документ заблокирован</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Создание документов в этой категории доступно только на тарифе <b>Pro</b>.
            </p>
            <button
              onClick={() => navigate("/wallet?trial=true")}
              className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 shadow-sm transition-all flex items-center justify-center gap-2 mb-2"
            >
              <Sparkles className="w-5 h-5" /> Разблокировать Pro на 14 дней
            </button>
            <button
              onClick={() => setLockedModalOpen(false)}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-900 font-medium"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {previewBlob && (
        <DocxPreviewModal
          blob={previewBlob}
          fileName={previewName}
          onClose={() => {
            setPreviewBlob(null);
            setPreviewName("");
          }}
        />
      )}
    </div>
  );
}