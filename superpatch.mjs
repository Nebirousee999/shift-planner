// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  [${label}] файл не найден`); return; }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) { console.log(`⏭  [${label}] уже применено`); return; }

  if (!normalized.includes(search)) {
    console.log(`❌ [${label}] шаблон для замены не найден`);
    return;
  }

  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  touched++;
  console.log(`✅ [${label}] применено`);
}

// ═══ 1. Ограничиваем высоту всей страницы админки ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<div className="min-h-screen bg-slate-50 flex flex-col">`,
  `<div className="h-screen bg-slate-50 flex flex-col overflow-hidden">`,
  "AdminSupportPage: высота страницы"
);

// ═══ 2. Убираем жесткий calc() и ставим min-h-0 для правильного flex-скролла ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex gap-4 h-[calc(100vh-80px)]">`,
  `<main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex gap-4 min-h-0">`,
  "AdminSupportPage: контейнер main"
);

// ═══ 3. Левая колонка (список чатов): фиксируем шапку и включаем скролл для списка ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-900">
            Все обращения ({tickets.length})
          </div>
          <div className="flex-1 overflow-y-auto">`,
  `<div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0 h-full">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-900 shrink-0">
            Все обращения ({tickets.length})
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">`,
  "AdminSupportPage: скролл левого списка"
);

// ═══ 4. Правая колонка (чат): добавляем h-full и min-h-0 ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">`,
  `<div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full min-w-0">`,
  "AdminSupportPage: контейнер правого чата"
);

// ═══ 5. Скролл сообщений: фиксируем форму ввода и даем скроллиться сообщениям ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">`,
  `<div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 bg-slate-50">`,
  "AdminSupportPage: скролл сообщений"
);

patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `<form onSubmit={handleReply} className="p-3 bg-white border-t border-slate-200">`,
  `<form onSubmit={handleReply} className="p-3 bg-white border-t border-slate-200 shrink-0">`,
  "AdminSupportPage: фикс формы ввода"
);

console.log("\n──────────────────────────────────────");
console.log(touched > 0 ? "🎉 Готово! Верстка чата исправлена." : "⚠️ Изменений не внесено.");