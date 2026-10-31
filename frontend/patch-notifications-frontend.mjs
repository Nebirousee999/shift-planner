// patch-notifications-frontend.mjs
import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
let applied = 0, skipped = 0, failed = 0;
const failures = [];

function normalize(text) { return text.includes("\r\n") ? text.replace(/\r\n/g, "\n") : text; }
function reindent(origLine, tplLine, firstIndentLen) {
  const c = tplLine.trimStart();
  if (c === "") return "";
  const base = origLine.match(/^\s*/)[0];
  return base + " ".repeat(Math.max(0, tplLine.length - c.length - firstIndentLen)) + c;
}
function diagnostics(lines, findLines) {
  const longest = findLines.reduce((a, b) => (a.length > b.length ? a : b), "");
  const near = lines.findIndex((l) => l.includes(longest.slice(0, 40)));
  if (near === -1) return `\n   "${longest.slice(0, 60)}" не найдена.`;
  let out = `\n   Похожее (строка ${near + 1}):\n`;
  for (let k = Math.max(0, near - 1); k <= Math.min(lines.length - 1, near + 5); k++)
    out += `   ${k === near ? "→" : " "} ${k + 1}: ${lines[k]}\n`;
  return out;
}

function patchFile(filePath, patches) {
  console.log(`\n══════ ${filePath} ══════`);
  if (!fs.existsSync(filePath)) { console.error(`❌ Не найден`); failed++; failures.push(filePath); return; }
  const raw = fs.readFileSync(filePath, "utf8");
  const isCRLF = raw.includes("\r\n");
  let src = normalize(raw);
  const orig = src;

  for (const p of patches) {
    if (p.marker && src.includes(p.marker)) { console.log(`⏭  [${p.label}]`); skipped++; continue; }
    if (p.replaceAll) {
      if (!src.includes(p.find)) { console.error(`❌ [${p.label}] не найдено`); failed++; failures.push(p.label); continue; }
      src = src.split(p.find).join(p.repl);
      console.log(`✅ [${p.label}] (все вхождения)`);
      applied++;
      continue;
    }
    const lines = src.split("\n");
    const findLines = p.find.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const matches = [];
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      let ok = true;
      for (let j = 0; j < findLines.length; j++) if (lines[i + j].trim() !== findLines[j]) { ok = false; break; }
      if (ok) matches.push(i);
    }
    if (matches.length === 0) { console.error(`❌ [${p.label}]${diagnostics(lines, findLines)}`); failed++; failures.push(p.label); continue; }
    const start = matches[0];
    const replLines = p.repl.split("\n");
    const firstIndentLen = replLines[0].match(/^\s*/)[0].length;
    const prepared = replLines.map(l => reindent(lines[start], l, firstIndentLen));
    src = [...lines.slice(0, start), ...prepared, ...lines.slice(start + findLines.length)].join("\n");
    console.log(`✅ [${p.label}]`);
    applied++;
  }

  if (src !== orig) {
    if (DRY_RUN) { console.log("🔍 dry-run"); return; }
    fs.writeFileSync(`${filePath}.bak.${Date.now()}`, raw);
    fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src);
    console.log(`💾 сохранено`);
  }
}

function createFile(filePath, content) {
  console.log(`\n══════ ${filePath} (новый) ══════`);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing === content) { console.log(`⏭  идентичен`); skipped++; return; }
    if (!DRY_RUN) fs.writeFileSync(`${filePath}.bak.${Date.now()}`, existing);
  }
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  console.log(`✅ создан`);
  applied++;
}

// ═══════════════════════════════════════════════════════
// 1. api/notifications.ts — расширяем
// ═══════════════════════════════════════════════════════
patchFile("src/api/notifications.ts", [
  {
    label: "1.1 Тип InAppNotification + новые методы",
    marker: `listMine:`,
    find: `export const notificationsApi = {
           vacationsPendingCount: async (): Promise<number> => {`,
    repl: `export type InAppNotification = {
           id: string;
           orgId: string;
           userId: string;
           kind: string;
           title: string;
           message: string;
           relatedId: string | null;
           relatedType: string | null;
           requiresAction: boolean;
           acknowledgedAt: string | null;
           createdAt: string;
           payload: any;
         };

         export const notificationsApi = {
           listMine: async (): Promise<InAppNotification[]> => {
             try {
               const { data } = await api.get<InAppNotification[]>("/notifications");
               return data;
             } catch { return []; }
           },

           unreadInAppCount: async (): Promise<number> => {
             try {
               const { data } = await api.get<{ count: number }>("/notifications/unread/count");
               return data.count;
             } catch { return 0; }
           },

           ackInApp: async (id: string): Promise<void> => {
             try { await api.post(\`/notifications/\${id}/ack\`, {}); } catch {}
           },

           ackAllInApp: async (): Promise<void> => {
             try { await api.post("/notifications/ack-all", {}); } catch {}
           },

           vacationsPendingCount: async (): Promise<number> => {`,
  },
]);

// ═══════════════════════════════════════════════════════
// 2. store/notifications.ts — расширяем
// ═══════════════════════════════════════════════════════
createFile("src/store/notifications.ts", `import { create } from "zustand";
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
}));
`);

// ═══════════════════════════════════════════════════════
// 3. components/NotificationBell.tsx — новый
// ═══════════════════════════════════════════════════════
createFile("src/components/NotificationBell.tsx", `import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X, Inbox } from "lucide-react";
import { useNotifications } from "../store/notifications";
import type { InAppNotification } from "../api/notifications";
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
  const { items, unreadTotal, refresh, ack, ackAll } = useNotifications();
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
    try { await ack(n.id); } finally { setBusyId(null); }
  };

  const handleApprove = async (n: InAppNotification) => {
    if (!n.relatedId) return;
    setBusyId(n.id);
    try {
      if (n.relatedType === "time_off_request") await timeOffApi.approve(n.relatedId);
      else if (n.relatedType === "vacation_request") await vacationsApi.approve(n.relatedId);
      else if (n.relatedType === "shift_change_request") await shiftChangeRequestsApi.approve(n.relatedId);
      await ack(n.id);
    } finally { setBusyId(null); }
  };

  const handleReject = async (n: InAppNotification) => {
    if (!n.relatedId) return;
    setBusyId(n.id);
    try {
      if (n.relatedType === "time_off_request") await timeOffApi.reject(n.relatedId);
      else if (n.relatedType === "vacation_request") await vacationsApi.reject(n.relatedId);
      else if (n.relatedType === "shift_change_request") await shiftChangeRequestsApi.reject(n.relatedId);
      await ack(n.id);
    } finally { setBusyId(null); }
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
              return (
                <div
                  key={n.id}
                  className={\`p-3 border-b border-slate-100 last:border-0 \${
                    isUnread ? "bg-amber-50/40" : "bg-white"
                  }\`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium text-slate-900 text-sm">
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
                          Принять
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

// ═══════════════════════════════════════════════════════
// 4. NavBar.tsx — встроить NotificationBell в обе ветки
// ═══════════════════════════════════════════════════════
patchFile("src/components/NavBar.tsx", [
  {
    label: "4.1 Импорт NotificationBell",
    marker: `NotificationBell`,
    find: `import LocationSwitcher from "./LocationSwitcher";`,
    repl: `import LocationSwitcher from "./LocationSwitcher";
           import NotificationBell from "./NotificationBell";`,
  },
  {
    label: "4.2 Вставить Bell перед каждой Help-кнопкой",
    replaceAll: true,
    find: `<button
               onClick={() => navigate("/help")}`,
    repl: `<NotificationBell />
             <button
               onClick={() => navigate("/help")}`,
  },
]);

console.log("\n══════════════════════════════════════");
console.log(`✅ применено:   ${applied}`);
console.log(`⏭  уже было:    ${skipped}`);
console.log(`❌ не найдено:  ${failed}`);
if (failures.length) console.log("   Не найдено:", failures.join(", "));
console.log("══════════════════════════════════════");

if (failed > 0) process.exit(2);