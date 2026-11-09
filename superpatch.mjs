import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. Переименовываем стейт (разделяем точки отгулов и изменения смен)
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());`,
  `  const [shiftChangeDates, setShiftChangeDates] = useState<Set<string>>(new Set());`,
  "WeeksPage.tsx (переименование стейта)"
);

// 2. Исправляем перезапись в Promise.all
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `      setPendingDates(set);`,
  `      setShiftChangeDates(set);`,
  "WeeksPage.tsx (защита от перезаписи)"
);

// 3. Заменяем useEffect на useMemo (объединяем источники)
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `  useEffect(() => {
    if (timeOffs.length > 0) {
      setPendingDates((prev) => {
        const next = new Set(prev);
        for (const t of timeOffs) {
          if (t.status === "PENDING") {
            next.add(String(t.date).slice(0, 10));
          }
        }
        return next;
      });
    }
  }, [timeOffs]);`,
  `  const pendingDates = useMemo(() => {
    const set = new Set(shiftChangeDates);
    for (const t of timeOffs) {
      if (t.status === "PENDING" && t.date) {
        set.add(String(t.date).slice(0, 10));
      }
    }
    return set;
  }, [shiftChangeDates, timeOffs]);`,
  "WeeksPage.tsx (useMemo для объединения точек)"
);

// 4. Добавляем useMemo в импорты (на всякий случай)
patchFile(
  "frontend/src/pages/WeeksPage.tsx",
  `import { useEffect, useState } from "react";`,
  `import { useEffect, useState, useMemo } from "react";`,
  "WeeksPage.tsx (импорт useMemo)"
);


console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}