const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export const customTemplatesApi = {
  // Проверить наличие шаблона
  check: async (
    type: string
  ): Promise<{ exists: boolean; fileName: string | null }> => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/documents/custom/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { exists: false, fileName: null };
    return res.json();
  },

  // Скачать образец .docx
  downloadSample: async (type: string, title: string): Promise<void> => {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_URL}/documents/custom/${type}/sample`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Ошибка скачивания образца");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Шаблон_${title}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Загрузить .docx (как base64)
  upload: async (
    type: string,
    file: File
  ): Promise<void> => {
    const base64 = await fileToBase64(file);
    const res = await fetch(`${API_URL}/documents/custom/${type}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        contentBase64: base64,
        fileName: file.name,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Ошибка загрузки"
      );
    }
  },

  // Удалить шаблон
  remove: async (type: string): Promise<void> => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/documents/custom/${type}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Ошибка удаления");
  },

  // Сгенерировать по кастомному шаблону
  // Сгенерировать по кастомному шаблону
  render: async (
    type: string,
    params: Record<string, any>,
    employeeIds: string[] = [],
    title?: string
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/documents/custom/${type}/render`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ params, employeeIds }),
    });
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
    a.download = title ? `${title}.docx` : "Документ.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Превью (возвращает blob-url)
  preview: async (
    type: string,
    params: Record<string, any>,
    employeeIds: string[] = []
  ): Promise<Blob> => {
    const res = await fetch(`${API_URL}/documents/custom/${type}/preview`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ params, employeeIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : "Ошибка превью"
      );
    }
    return res.blob();
  },
};

// ─── Хелпер: файл → base64 ──────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:application/vnd...;base64,XXXX" → XXXX
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}