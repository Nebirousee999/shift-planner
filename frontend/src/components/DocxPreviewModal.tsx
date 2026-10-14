import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2, FileText } from "lucide-react";
import { renderAsync } from "docx-preview";

type Props = {
  blob: Blob;
  fileName: string;
  onClose: () => void;
};

export default function DocxPreviewModal({
  blob,
  fileName,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);

    renderAsync(blob, containerRef.current, undefined, {
      className: "docx-preview",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      experimental: true,
    })
      .then(() => setLoading(false))
      .catch((e) => {
        console.error(e);
        setError("Не удалось отобразить превью");
        setLoading(false);
      });
  }, [blob]);

  const onDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-brand-600" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-sm truncate">
                Превью документа
              </div>
              <div className="text-xs text-slate-500 truncate">
                {fileName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Тело — скролл */}
        <div className="flex-1 overflow-y-auto bg-slate-100 px-4 py-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Загрузка превью...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 max-w-md mx-auto">
              {error}
            </div>
          )}

          <div
            ref={containerRef}
            className="docx-preview-container max-w-3xl mx-auto"
          />
        </div>
      </div>

      {/* Стили для рендера docx-preview */}
      <style>{`
        .docx-preview-container .docx-wrapper {
          background: transparent;
          padding: 0;
        }
        .docx-preview-container .docx-wrapper > section.docx {
          background: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          border-radius: 8px;
          margin-bottom: 20px;
          padding: 40px 50px;
          min-height: 1100px;
        }
        .docx-preview-container .docx-wrapper > section.docx p {
          margin: 0 0 8pt 0;
        }
      `}</style>
    </div>
  );
}