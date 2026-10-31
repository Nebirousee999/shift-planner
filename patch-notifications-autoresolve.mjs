// patch-notifications-autoresolve.mjs
// 1. resolveActionable → set acknowledgedAt + payload.resolved
// 2. store — optimisticResolve
// 3. NotificationBell — показывать Принято/Отклонено + optimistic UI
// Запуск: node patch-notifications-autoresolve.mjs [--dry-run]

import fs from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");
let ok = true;

function patchFile(filePath, patches) {
  console.log(`\n══════ ${filePath} ══════`);
  if (!fs.existsSync(filePath)) { console.error("❌ не найден"); ok = false; return; }
  const raw = fs.readFileSync(filePath, "utf8");
  const isCRLF = raw.includes("\r\n");
  let src = isCRLF ? raw.replace(/\r\n/g, "\n") : raw;
  const orig = src;

  for (const p of patches) {
    if (p.marker && src.includes(p.marker)) { console.log(`⏭  [${p.label}] уже есть`); continue; }
    const lines = src.split("\n");
    const findLines = p.find.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const matches = [];
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      let matched = true;
      for (let j = 0; j < findLines.length; j++)
        if (lines[i + j].trim() !== findLines[j]) { matched = false; break; }
      if (matched) matches.push(i);
    }
    if (matches.length === 0) { console.error(`❌ [${p.label}] не найдено`); ok = false; continue; }
    const start = matches[0];
    const replLines = p.repl.split("\n");
    const firstIndentLen = replLines[0].match(/^\s*/)[0].length;
    const baseIndent = lines[start].match(/^\s*/)[0];
    const prepared = replLines.map(l => {
      const c = l.trimStart();
      if (c === "") return "";
      return baseIndent + " ".repeat(Math.max(0, l.length - c.length - firstIndentLen)) + c;
    });
    src = [...lines.slice(0, start), ...prepared, ...lines.slice(start + findLines.length)].join("\n");
    console.log(`✅ [${p.label}]`);
  }

  if (src !== orig) {
    if (DRY_RUN) { console.log("🔍 dry-run"); return; }
    fs.writeFileSync(`${filePath}.bak.${Date.now()}`, raw);
    fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src);
    console.log("💾 сохранено");
  }
}

function overwriteFile(filePath, content) {
  console.log(`\n══════ ${filePath} (перезапись) ══════`);
  if (fs.existsSync(filePath)) {
    const ex = fs.readFileSync(filePath, "utf8");
    if (ex === content) { console.log("⏭  идентичен"); return; }
    if (!DRY_RUN) fs.writeFileSync(`${filePath}.bak.${Date.now()}`, ex);
  }
  if (!DRY_RUN) fs.writeFileSync(filePath, content);
  console.log("✅ перезаписан");
}

// ═══════════════════════════════════════════════════════
// 1. Backend: notifications.service.ts — resolveActionable с auto-ack + payload
// ═══════════════════════════════════════════════════════
patchFile("src/modules/notifications/notifications.service.ts", [
  {
    label: "1.1 resolveActionable — auto-ack + payload.resolved",
    marker: `resolved: status`,
    find: `async resolveActionable(
             relatedId: string,
             relatedType: string,
             status: "APPROVED" | "REJECTED",
             resolverName: string,
             detail: string
           ) {
             const title = status === "APPROVED" ? "Запрос одобрен" : "Запрос отклонён";
             const message = \`\${resolverName} \${status === "APPROVED" ? "одобрил(а)" : "отклонил(а)"}: \${detail}\`;
             await db
               .update(userNotifications)
               .set({
                 requiresAction: false,
                 title,
                 message,
                 acknowledgedAt: null,
               })
               .where(
                 and(
                   eq(userNotifications.relatedId, relatedId),
                   eq(userNotifications.relatedType, relatedType),
                   eq(userNotifications.requiresAction, true)
                 )
               );
             return { success: true };
           },`,
    repl: `async resolveActionable(
             relatedId: string,
             relatedType: string,
             status: "APPROVED" | "REJECTED",
             resolverName: string,
             detail: string
           ) {
             const title = status === "APPROVED" ? "Запрос одобрен" : "Запрос отклонён";
             const message = \`\${resolverName} \${status === "APPROVED" ? "одобрил(а)" : "отклонил(а)"}: \${detail}\`;

             const affected = await db
               .select()
               .from(userNotifications)
               .where(
                 and(
                   eq(userNotifications.relatedId, relatedId),
                   eq(userNotifications.relatedType, relatedType),
                   eq(userNotifications.requiresAction, true)
                 )
               );

             for (const row of affected) {
               await db
                 .update(userNotifications)
                 .set({
                   requiresAction: false,
                   title,
                   message,
                   acknowledgedAt: new Date(),
                   payload: {
                     ...((row.payload as any) || {}),
                     resolved: status,
                   },
                 })
                 .where(eq(userNotifications.id, row.id));
             }

             return { success: true };
           },`,
  },
]);

// ═══════════════════════════════════════════════════════
// 2. Frontend: store/notifications.ts — optimisticResolve
// ═══════════════════════════════════════════════════════
overwriteFile("frontend/src/store/notifications.ts", `import { create } from "zustand";
import { notificationsApi, type InAppNotification } from "../api/notifications";

type State = {
  vacationsPending: number;
  swapsIncoming: number;
  shiftChangesIncoming: number;
  timeOffsPending: number;
  items: InAppNotification[];
  unreadTotal: number;
  refresh: () => Promise<void>;
  fetchMine: () => Promise<void>;
  ack: (id: string) => Promise<void>;
  ackAll: () => Promise<void>;
  optimisticResolve: (id: string, status: "APPROVED" | "REJECTED") => void;
};

export const useNotifications = create<State>((set, get) => ({
  vacationsPending: 0,
  swapsIncoming: 0,
  shiftChangesIncoming: 0,
  timeOffsPending: 0,
  items: [],
  unreadTotal: 0,

  refresh: async () => {
    const [v, s, sc, t, items, unread] = await Promise.all([
      notificationsApi.vacationsPendingCount(),
      notificationsApi.swapsIncomingCount(),
      notificationsApi.shiftChangesIncomingCount(),
      notificationsApi.timeOffsPendingCount(),
      notificationsApi.listMine(),
      notificationsApi.unreadInAppCount(),
    ]);
    set({
      vacationsPending: v,
      swapsIncoming: s,
      shiftChangesIncoming: sc,
      timeOffsPending: t,
      items,
      unreadTotal: unread,
    });
  },

  fetchMine: async () => {
    const items = await notificationsApi.listMine();
    set({ items });
  },

  ack: async (id) => {
    await notificationsApi.ackInApp(id);
    await get().refresh();
  },

  ackAll: async () => {
    await notificationsApi.ackAllInApp();
    await get().refresh();
  },

  optimisticResolve: (id, status) => {
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = target && !target.acknowledgedAt;
      return {
        items: state.items.map((n) =>
          n.id === id
            ? {
                ...n,
                requiresAction: false,
                acknowledgedAt: new Date().toISOString(),
                title: status === "APPROVED" ? "Запрос одобрен" : "Запрос отклонён",
                payload: { ...((n.payload as any) || {}), resolved: status },
              }
            : n
        ),
        unreadTotal: wasUnread ? Math.max(0, state.unreadTotal - 1) : state.unreadTotal,
      };
    });
  },
}));
`);

// ═══════════════════════════════════════════════════════
// 3. Frontend: components/NotificationBell.tsx — resolve + badge
// ═══════════════════════════════════════════════════════
overwriteFile("frontend/src/components/NotificationBell.tsx", `import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X, Inbox, Trash2 } from "lucide-react";
import { useNotifications } from "../store/notifications";
import { notificationsApi, type InAppNotification } from "../api/notifications";
import { timeOffApi } from "../api/timeOff";
import { vacationsApi } from "../api/vacations";
import { shiftChangeRequestsApi } from "../api/shiftChangeRequests";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return \`\${day}.\${month} \${hh}:\${mm}\`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { items, unreadTotal, refresh, ack, ackAll, optimisticResolve } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAck = async (n: InAppNotification) => {
    setBusyId(n.id);
    try {
      await ack(n.id);
    } catch {
      await notificationsApi.dismissInApp(n.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (n: InAppNotification) => {
    setBusyId(n.id);
    try {
      await notificationsApi.dismissInApp(n.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (n: InAppNotification) => {
    if (!n.relatedId) return;
    setBusyId(n.id);
    try {
      if (n.relatedType === "time_off_request") await timeOffApi.approve(n.relatedId);
      else if (n.relatedType === "vacation_request") await vacationsApi.approve(n.relatedId);
      else if (n.relatedType === "shift_change_request") await shiftChangeRequestsApi.approve(n.relatedId);

      optimisticResolve(n.id, "APPROVED");
      await refresh();
    } catch (e: any) {
      console.warn("Approve failed:", e?.response?.data || e?.message);
      await notificationsApi.dismissInApp(n.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (n: InAppNotification) => {
    if (!n.relatedId) return;
    setBusyId(n.id);
    try {
      if (n.relatedType === "time_off_request") await timeOffApi.reject(n.relatedId);
      else if (n.relatedType === "vacation_request") await vacationsApi.reject(n.relatedId);
      else if (n.relatedType === "shift_change_request") await shiftChangeRequestsApi.reject(n.relatedId);

      optimisticResolve(n.id, "REJECTED");
      await refresh();
    } catch (e: any) {
      console.warn("Reject failed:", e?.response?.data || e?.message);
      await notificationsApi.dismissInApp(n.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const goToRelated = (n: InAppNotification) => {
    setOpen(false);
    if (n.relatedType === "time_off_request") navigate("/weeks");
    else if (n.relatedType === "vacation_request") navigate("/vacations");
    else if (n.relatedType === "shift_change_request") navigate("/weeks");
    else if (n.relatedType === "sick_leave") navigate("/sick-leaves");
    else if (n.relatedType === "discipline") navigate("/weeks");
    else navigate("/");
  };

  const unreadItems = items.filter((n) => !n.acknowledgedAt);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        title="Уведомления"
      >
        <Bell className="w-4 h-4" />
        {unreadTotal > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg z-[60] overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-sm font-semibold text-slate-900">
              Уведомления
            </span>
            {unreadItems.length > 0 && (
              <button
                onClick={ackAll}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Пока нет уведомлений</p>
              </div>
            )}

            {items.map((n) => {
              const isUnread = !n.acknowledgedAt;
              const isBusy = busyId === n.id;
              const resolved = (n.payload as any)?.resolved as
                | "APPROVED"
                | "REJECTED"
                | undefined;
              const isResolved = !n.requiresAction && !!resolved;

              return (
                <div
                  key={n.id}
                  className={\`relative p-3 pr-8 border-b border-slate-100 last:border-0 \${
                    isUnread ? "bg-amber-50/40" : "bg-white"
                  }\`}
                >
                  <button
                    onClick={() => handleDismiss(n)}
                    disabled={isBusy}
                    className="absolute top-2 right-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-slate-900 text-sm pr-6">
                      {n.title}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-2">
                    {n.message}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.requiresAction && n.relatedId ? (
                      <>
                        <button
                          onClick={() => handleApprove(n)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
                        >
                          <Check className="w-3 h-3" />
                          {isBusy ? "..." : "Принять"}
                        </button>
                        <button
                          onClick={() => handleReject(n)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 text-xs px-2.5 py-1 rounded-lg disabled:opacity-50 font-medium"
                        >
                          <X className="w-3 h-3" />
                          Отклонить
                        </button>
                        <button
                          onClick={() => goToRelated(n)}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1"
                        >
                          Открыть
                        </button>
                      </>
                    ) : isResolved ? (
                      <span
                        className={\`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold \${
                          resolved === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }\`}
                      >
                        {resolved === "APPROVED" ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        {resolved === "APPROVED" ? "Принято" : "Отклонено"}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAck(n)}
                        disabled={isBusy || n.acknowledgedAt !== null}
                        className={\`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium \${
                          n.acknowledgedAt
                            ? "text-slate-400 cursor-default"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }\`}
                      >
                        <Check className="w-3 h-3" />
                        {n.acknowledgedAt ? "Прочитано" : "ОК"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
`);

console.log("\n══════════════════════════════════════");
if (ok) {
  console.log("✅ Готово");
  if (!DRY_RUN) {
    console.log("\n📋 Дальше:");
    console.log("   1. Перезапустить бэкенд: npm run dev");
    console.log("   2. Перезапустить фронтенд: cd frontend && npm run dev");
    console.log("   3. Проверить: нажать Принять/Отклонить в колокольчике →");
    console.log("      карточка сразу меняется на «✓ Принято» / «✗ Отклонено»,");
    console.log("      цифра на иконке уменьшается.");
  }
} else {
  console.error("❌ Часть патчей не применилась — см. вывод выше");
  process.exit(1);
}