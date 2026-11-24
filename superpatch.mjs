// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const dashboardPath = path.join(process.cwd(), "frontend/src/pages/DashboardPage.tsx");
const weekDetailPath = path.join(process.cwd(), "frontend/src/pages/WeekDetailPage.tsx");

// ═══════════════════════════════════════════════════════
// 1. ПАТЧ ДЛЯ DashboardPage.tsx (Таймлайн)
// ═══════════════════════════════════════════════════════
if (fs.existsSync(dashboardPath)) {
  let content = fs.readFileSync(dashboardPath, "utf8");
  content = content.replace(/\r\n/g, '\n'); // Нормализация переносов строк для Windows
  
  if (!content.includes("userColor: u?.color ?? null,")) {
    console.log("📄 Патчим DashboardPage.tsx...");
    
    // 1.1. Добавляем userColor в маппинг
    content = content.replace(
      `templateColor: tpl?.color ?? null,`,
      `templateColor: tpl?.color ?? null,\n          userColor: u?.color ?? null,`
    );

    // 1.2. Меняем цвет полосы на userColor
    content = content.replace(
      `: shift.templateColor || "#3b82f6";`,
      `: shift.userColor || shift.templateColor || "#3b82f6";`
    );

    // 1.3. Оборачиваем время в бейдж
    content = content.replace(
      `<span className={isAbsent ? "opacity-80 font-normal" : "font-medium"}>\n                                {shift.startTime} – {shift.endTime}\n                              </span>`,
      `<span\n                                className={\`px-1.5 py-0.5 rounded shadow-sm \${isAbsent ? "opacity-80 font-normal" : "font-semibold"}\`}\n                                style={{\n                                  backgroundColor: shift.pendingTimeOff ? "#d97706" : (shift.templateColor || "#3b82f6"),\n                                }}\n                              >\n                                {shift.startTime} – {shift.endTime}\n                              </span>`
    );

    fs.writeFileSync(dashboardPath, content, "utf8");
    console.log("✅ DashboardPage.tsx обновлен.");
  } else {
    console.log("✅ DashboardPage.tsx уже пропатчен ранее.");
  }
}

// ═══════════════════════════════════════════════════════
// 2. ПАТЧ ДЛЯ WeekDetailPage.tsx (Сетка)
// ═══════════════════════════════════════════════════════
if (fs.existsSync(weekDetailPath)) {
  let content = fs.readFileSync(weekDetailPath, "utf8");
  content = content.replace(/\r\n/g, '\n'); // Нормализация переносов строк для Windows
  
  if (!content.includes("const tplColor = tpl?.color || \"#3B82F6\";")) {
    console.log("📄 Патчим WeekDetailPage.tsx...");

    // 2.1. Переменные цветов
    const oldColors = `                    const tpl = templateById(s.templateId);
                    const color = tpl?.color ?? "#3B82F6";`;
    const newColors = `                    const tpl = templateById(s.templateId);
                    const userColor = activeUsers.find((u) => u.id === s.userId)?.color;
                    const color = userColor || tpl?.color || "#3B82F6";
                    const tplColor = tpl?.color || "#3B82F6";`;
    if (!content.includes(oldColors)) throw new Error("❌ WeekDetail: не найден блок цветов");
    content = content.replace(oldColors, newColors);

    // 2.2. Усиливаем фон карточки
    const oldBg = `                          backgroundColor: activeTimeOff
                            ? "#fef3c7"
                            : color + "10",`;
    const newBg = `                          backgroundColor: activeTimeOff
                            ? "#fef3c7"
                            : color + "18",`;
    if (!content.includes(oldBg)) throw new Error("❌ WeekDetail: не найден backgroundColor");
    content = content.replace(oldBg, newBg);

    // 2.3. Начало блока времени (заменяем Clock на обертку div)
    const oldClockStart = `                          <Clock
                            className="w-3 h-3 shrink-0"
                            style={{
                              color: hasPending
                                ? "#B45309"
                                : activeTimeOff
                                ? "#B45309"
                                : color,
                            }}
                          />
                          {timeChanged ? (`;
    const newClockStart = `                          <div
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm"
                            style={{
                              backgroundColor: hasPending || activeTimeOff ? "#fef3c7" : tplColor + "25",
                              borderColor: hasPending || activeTimeOff ? "#f59e0b" : tplColor + "60",
                              color: hasPending || activeTimeOff ? "#B45309" : tplColor,
                            }}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            {timeChanged ? (`;
    if (!content.includes(oldClockStart)) throw new Error("❌ WeekDetail: не найден блок Clock");
    content = content.replace(oldClockStart, newClockStart);

    // 2.4. Конец блока времени (закрываем обертку div)
    const oldClockEnd = `                            ) : (
                              <span>
                                {s.startTime}–{s.endTime}
                              </span>
                            )}
                        </div>`;
    const newClockEnd = `                            ) : (
                              <span>
                                {s.startTime}–{s.endTime}
                              </span>
                            )}
                          </div>
                        </div>`;
    if (!content.includes(oldClockEnd)) throw new Error("❌ WeekDetail: не найден конец блока времени");
    content = content.replace(oldClockEnd, newClockEnd);

    fs.writeFileSync(weekDetailPath, content, "utf8");
    console.log("✅ WeekDetailPage.tsx обновлен.");
  } else {
    console.log("✅ WeekDetailPage.tsx уже пропатчен ранее.");
  }
}

console.log("🎉 Все готово!");