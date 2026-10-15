const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export type ShiftChangeRequest = {
  id: string;
  shiftId: string | null;         // ← теперь nullable
  kind: "UPDATE" | "CREATE";      // ← новое
  weekId?: string | null;         // ← новое
  templateId?: string | null;     // ← новое
  requestedBy: string;
  targetUserId: string;
  oldShiftDate: string;
  oldStartTime: string;
  oldEndTime: string;
  oldUserId: string | null;
  newShiftDate: string;
  newStartTime: string;
  newEndTime: string;
  newUserId: string | null;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedByName?: string;
  targetUserName?: string;
  oldUserName?: string | null;
  newUserName?: string | null;
  createdAt: string;
};

export const shiftChangeRequestsApi = {
  list: async (): Promise<ShiftChangeRequest[]> => {
    const res = await fetch(`${API_URL}/shift-change-requests`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Ошибка");
    return res.json();
  },

  incoming: async (): Promise<ShiftChangeRequest[]> => {
    const res = await fetch(`${API_URL}/shift-change-requests/incoming`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Ошибка");
    return res.json();
  },

  incomingCount: async (): Promise<number> => {
    const res = await fetch(
      `${API_URL}/shift-change-requests/incoming/count`,
      { headers: authHeaders() }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  },

  outgoing: async (): Promise<ShiftChangeRequest[]> => {
    const res = await fetch(`${API_URL}/shift-change-requests/outgoing`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Ошибка");
    return res.json();
  },

  approve: async (id: string): Promise<void> => {
    const res = await fetch(
      `${API_URL}/shift-change-requests/${id}/approve`,
      {
        method: "POST",
        headers: authHeaders(),
        // ⚠️ ВАЖНО: Fastify требует тело при Content-Type: application/json
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error ?? "Ошибка согласования");
    }
  },

  reject: async (id: string): Promise<void> => {
    const res = await fetch(
      `${API_URL}/shift-change-requests/${id}/reject`,
      {
        method: "POST",
        headers: authHeaders(),
        // ⚠️ ВАЖНО: то же самое — тело обязательно
        body: JSON.stringify({}),
      }
    );
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error ?? "Ошибка отклонения");
    }
  },

  cancel: async (id: string): Promise<void> => {
    // DELETE — Fastify не парсит тело, Content-Type можно оставить,
    // но тело не нужно. Оставляем как есть — работает.
    const res = await fetch(`${API_URL}/shift-change-requests/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Ошибка отмены");
  },
};