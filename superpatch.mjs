// superpatch.mjs
// Финальный патч цветов для DashboardPage.tsx и WeekDetailPage.tsx
import fs from "node:fs";
import path from "node:path";

const dashboardPath = path.join(process.cwd(), "frontend/src/pages/DashboardPage.tsx");
const weekDetailPath = path.join(process.cwd(), "frontend/src/pages/WeekDetailPage.tsx");

function replaceExact(content, search, replace, errorMessage) {
  if (!content.includes(search)) {
    throw new Error(`❌ ${errorMessage}`);
  }
  return content.replace(search, replace);
}

// ═══════════════════════════════════════════════════════
// 1. ПАТЧ ДЛЯ DashboardPage.tsx (Таймлайн)
// ═══════════════════════════════════════════════════════
if (fs.existsSync(dashboardPath)) {
  console.log("📄 Патчим DashboardPage.tsx...");
  let content = fs.readFileSync(dashboardPath, "utf8");

  // 1.1. Добавляем userColor в маппинг смен
  content = replaceExact(
    content,
    `          templateColor: tpl?.color ?? null,`,
    `          templateColor: tpl?.color ?? null,
          userColor: u?.color ?? null,`,
    "DashboardPage: не найден блок маппинга templateColor"
  );

  // 1.2. Меняем цвет всей полосы на userColor
  content = replaceExact(
    content,
    `                        : shift.templateColor || "#3b82f6";`,
    `                        : shift.userColor || shift.templateColor || "#3b82f6";`,
    "DashboardPage: не найден barColor"
  );

  // 1.3. Оборачиваем время в цветную плашку шаблона
  content = replaceExact(
    content,
    `                              <span className={isAbsent ? "opacity-80 font-normal" : "font-medium"}>
                                {shift.startTime} – {shift.endTime}
                              </span>`,
    `                              <span
                                className={\`px-1.5 py-0.5 rounded shadow-sm \${isAbsent ? "opacity-80 font-normal" : "font-semibold"}\`}
                                style={{
                                  backgroundColor: shift.pendingTimeOff ? "#d97706" : (shift.templateColor || "#3b82f6"),
                                }}
                              >
                                {shift.startTime} – {shift.endTime}
                              </span>`,
    "DashboardPage: не найден блок времени таймлайна"
  );

  fs.writeFileSync(dashboardPath, content, "utf8");
  console.log("✅ DashboardPage.tsx обновлен: полоса = user.color, время = template.color");
} else {
  console.warn("⚠️ DashboardPage.tsx не найден!");
}


// ═══════════════════════════════════════════════════════
// 2. ПАТЧ ДЛЯ WeekDetailPage.tsx (Сетка)
// ═══════════════════════════════════════════════════════
if (fs.existsSync(weekDetailPath)) {
  console.log("📄 Патчим WeekDetailPage.tsx...");
  let content = fs.readFileSync(weekDetailPath, "utf8");

  // 2.1. Меняем переменные цвета
  content = replaceExact(
    content,
    `                    const color = tpl?.color ?? "#3B82F6";`,
    `                    const userColor = activeUsers.find((u) => u.id === s.userId)?.color;
                    const color = userColor || tpl?.color || "#3B82F6";
                    const tplColor = tpl?.color || "#3B82F6";`,
    "WeekDetailPage: не найден блок const color"
  );

  // 2.2. Немного усиливаем фон карточки (color + "18")
  content = replaceExact(
    content,
    `                          backgroundColor: activeTimeOff
                            ? "#fef3c7"
                            : color + "10",`,
    `                          backgroundColor: activeTimeOff
                            ? "#fef3c7"
                            : color + "18",`,
    "WeekDetailPage: не найден backgroundColor карточки"
  );

  // 2.3. Оборачиваем время в плашку цвета шаблона
  content = replaceExact(
    content,
    `                        <div className="flex items-center gap-1 font-medium text-slate-900 flex-wrap pr-6">
                          {canEdit && !hasPending && !activeTimeOff && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{
                              color: hasPending
                                ? "#B45309"
                                : activeTimeOff
                                ? "#B45309"
                                : color,
                            }}
                          />
                          {timeChanged ? (
                              <>
                                <span className="line-through text-slate-400">
                                  {s.startTime}–{s.endTime}
                                </span>
                                <span className="text-slate-400 text-[10px]">→</span>
                                <span className="text-amber-800 font-semibold">
                                  {pending!.newStartTime}–{pending!.newEndTime}
                                </span>
                              </>
                            ) : (
                              <span>
                                {s.startTime}–{s.endTime}
                              </span>
                            )}
                        </div>`,
    `                        <div className="flex items-center gap-1 font-medium text-slate-900 flex-wrap pr-6">
                          {canEdit && !hasPending && !activeTimeOff && (
                            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <div
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm"
                            style={{
                              backgroundColor: hasPending || activeTimeOff ? "#fef3c7" : tplColor + "25",
                              borderColor: hasPending || activeTimeOff ? "#f59e0b" : tplColor + "60",
                              color: hasPending || activeTimeOff ? "#B45309" : tplColor,
                            }}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            {timeChanged ? (
                              <>
                                <span className="line-through opacity-60 text-[10px]">
                                  {s.startTime}–{s.endTime}
                                </span>
                                <span className="opacity-60 text-[10px]">→</span>
                                <span className="font-semibold">
                                  {pending!.newStartTime}–{pending!.newEndTime}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold">
                                {s.startTime}–{s.endTime}
                              </span>
                            )}
                          </div>
                        </div>`,
    "WeekDetailPage: не найден блок времени карточки"
  );

  fs.writeFileSync(weekDetailPath, content, "utf8");
  console.log("✅ WeekDetailPage.tsx обновлен: карточка = user.color, время = template.color");
} else {
  console.warn("⚠️ WeekDetailPage.tsx не найден!");
}

console.log("🎉 Все патчи успешно применены!");