const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let msg = "Ошибка скачивания";
    try {
      const data = await res.json();
      msg = data.error ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  // Пробуем вытащить имя из Content-Disposition
  const disposition = res.headers.get("Content-Disposition") ?? "";
  let filename = fallbackName;
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      // ignore
    }
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export const exportApi = {
  downloadWeek: async (weekId: string, weekStart: string): Promise<void> => {
    await downloadFile(
      `${API_URL}/export/week/${weekId}`,
      `График_${weekStart}.xlsx`
    );
  },

  downloadTimesheet: async (year: number, month: number): Promise<void> => {
    await downloadFile(
      `${API_URL}/export/timesheet?year=${year}&month=${month}`,
      `Табель_${year}_${month + 1}.xlsx`
    );
  },
};