const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const batchApi = {
  // Скачать Excel-шаблон
  downloadTemplate: async (type: string, title: string): Promise<void> => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_URL}/documents/batch/${type}/excel-template`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Ошибка скачивания шаблона");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Шаблон_${title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Загрузить Excel → скачать ZIP с документами
  generateBatch: async (type: string, file: File, title: string): Promise<void> => {
    const base64 = await fileToBase64(file);
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_URL}/documents/batch/${type}/generate-batch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileBase64: base64 }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Ошибка генерации"
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title} — пакет документов.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};