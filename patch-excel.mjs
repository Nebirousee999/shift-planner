import fs from "node:fs";

const FILES = {
  excel: "src/lib/export/excel.ts",
  service: "src/modules/auth/auth.service.ts",
  routes: "src/modules/auth/auth.routes.ts",
  page: "frontend/src/pages/CalculatorPage.tsx",
};

const PATCHES = [
 {
  "file": "excel",
  "title": "excel.ts: хелпер ночных часов (22:00–06:00)",
  "find": "function hoursBetween(start: string, end: string): number {\n  const [sh, sm] = start.split(\":\").map(Number);\n  const [eh, em] = end.split(\":\").map(Number);\n  let m = eh * 60 + em - (sh * 60 + sm);\n  if (m <= 0) m += 24 * 60;\n  return m / 60;\n}",
  "replace": "function hoursBetween(start: string, end: string): number {\n  const [sh, sm] = start.split(\":\").map(Number);\n  const [eh, em] = end.split(\":\").map(Number);\n  let m = eh * 60 + em - (sh * 60 + sm);\n  if (m <= 0) m += 24 * 60;\n  return m / 60;\n}\n\n// Часы смены, приходящиеся на ночной интервал 22:00–06:00\nfunction nightHoursBetween(start: string, end: string): number {\n  const [sh, sm] = start.split(\":\").map(Number);\n  const [eh, em] = end.split(\":\").map(Number);\n  let s = sh * 60 + sm;\n  let e = eh * 60 + em;\n  if (e <= s) e += 24 * 60;\n  let minutes = 0;\n  for (let t = s; t < e; t++) {\n    const hour = Math.floor((t % (24 * 60)) / 60);\n    if (hour >= 22 || hour < 6) minutes++;\n  }\n  return minutes / 60;\n}"
 },
 {
  "file": "excel",
  "title": "excel.ts: расчёт ночных часов в сводке месяца",
  "find": "    const totalCost = Math.round(totalHours * (emp.hourlyRate || 0));",
  "replace": "    const totalCost = Math.round(totalHours * (emp.hourlyRate || 0));\n    const totalNightHours = userShifts.reduce((acc, s) => acc + nightHoursBetween(s.startTime, s.endTime), 0);\n    const totalNightShifts = userShifts.filter((s) => nightHoursBetween(s.startTime, s.endTime) > 0).length;"
 },
 {
  "file": "excel",
  "title": "excel.ts: строка «Ночных смен/часов» в шапке листа",
  "find": "    ws.getRow(2).height = 24;",
  "replace": "    ws.getRow(2).height = 24;\n\n    if (totalNightShifts > 0) {\n      ws.mergeCells(\"A3:H3\");\n      const nightCell = ws.getCell(\"A3\");\n      nightCell.value = `Ночных смен: ${totalNightShifts} · ночных часов: ${Math.round(totalNightHours * 10) / 10} (с 22:00 до 06:00)`;\n      nightCell.font = { size: 10, bold: true, color: { argb: \"FF4338CA\" } };\n      nightCell.alignment = { horizontal: \"center\", vertical: \"middle\" };\n      ws.getRow(3).height = 20;\n    }"
 },
 {
  "file": "excel",
  "title": "excel.ts: счётчик ночных часов недели",
  "find": "      let weekShifts = 0;\n      let weekHours = 0;",
  "replace": "      let weekShifts = 0;\n      let weekHours = 0;\n      let weekNightHours = 0;"
 },
 {
  "file": "excel",
  "title": "excel.ts: ночные смены в сетке — тёмная заливка и значок",
  "find": "        if (dayShift) {\n          cell.value = `${dayShift.startTime}-\\n${dayShift.endTime}`;\n          cell.fill = { type: \"pattern\", pattern: \"solid\", fgColor: { argb: \"FF3B82F6\" } };\n          cell.font = { color: { argb: \"FFFFFFFF\" }, size: 9, bold: true };\n          weekShifts++;\n          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);\n        } else if (isOtherMonth) {",
  "replace": "        if (dayShift) {\n          const isNight = nightHoursBetween(dayShift.startTime, dayShift.endTime) > 0;\n          cell.value = (isNight ? \"\\u{1F319} \" : \"\") + `${dayShift.startTime}-\\n${dayShift.endTime}`;\n          cell.fill = { type: \"pattern\", pattern: \"solid\", fgColor: { argb: isNight ? \"FF312E81\" : \"FF3B82F6\" } };\n          cell.font = { color: { argb: \"FFFFFFFF\" }, size: 9, bold: true };\n          weekShifts++;\n          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);\n          if (isNight) weekNightHours += nightHoursBetween(dayShift.startTime, dayShift.endTime);\n        } else if (isOtherMonth) {"
 },
 {
  "file": "excel",
  "title": "excel.ts: ночные часы в итогах недели",
  "find": "      totalCell.value = `${weekShifts} см.\\n${Math.round(weekHours * 10) / 10} ч.`;",
  "replace": "      totalCell.value = `${weekShifts} см.\\n${Math.round(weekHours * 10) / 10} ч.` + (weekNightHours > 0 ? `\\n\\u{1F319} ${Math.round(weekNightHours * 10) / 10} н.ч.` : \"\");"
 },
 {
  "file": "service",
  "title": "auth.service: убран дубль импорта createHash (ломает сборку TS)",
  "find": "import { createHash } from \"node:crypto\";\nimport { createHash } from \"node:crypto\";",
  "replace": "import { createHash } from \"node:crypto\";"
 },
 {
  "file": "service",
  "title": "auth.service: хелпер цвета ночной смены для Excel",
  "find": "import { getMonday } from \"../../lib/time.js\";",
  "replace": "import { getMonday } from \"../../lib/time.js\";\n\n// Тёмно-синий цвет для Excel, если смена задевает ночные часы (22:00–06:00)\nfunction nightColorFor(start: string, end: string): string {\n  const [sh, sm] = start.split(\":\").map(Number);\n  const [eh, em] = end.split(\":\").map(Number);\n  let s = sh * 60 + sm;\n  let e = eh * 60 + em;\n  if (e <= s) e += 24 * 60;\n  for (let t = s; t < e; t++) {\n    const hour = Math.floor((t % (24 * 60)) / 60);\n    if (hour >= 22 || hour < 6) return \"#312E81\";\n  }\n  return \"#3B82F6\";\n}"
 },
 {
  "file": "service",
  "title": "auth.service: цикл в quickRegister понимает паттерн день/ночь",
  "find": "          const empStart = empData.startDate ? new Date(empData.startDate + \"T00:00:00Z\") : globalStartDate;\n          const cycleParts = (empData.cycle || \"2/2\").split(\"/\");\n          const workDays = Number(cycleParts[0]) || 2;\n          const offDays = Number(cycleParts[1]) || 2;\n          const cycleLen = workDays + offDays;",
  "replace": "          const empStart = empData.startDate ? new Date(empData.startDate + \"T00:00:00Z\") : globalStartDate;\n          const cycleParts = (empData.cycle || \"2/2\").split(\"/\");\n          const workDays = Number(cycleParts[0]) || 2;\n          const offDays = Number(cycleParts[1]) || 2;\n          // Паттерн дня: D — дневная смена, N — ночная, O — выходной (для циклов день/ночь)\n          const pat = typeof empData.pattern === \"string\" ? empData.pattern.trim().toUpperCase() : \"\";\n          const hasPattern = /^[DNO]+$/.test(pat);\n          const cycleLen = hasPattern ? pat.length : workDays + offDays;"
 },
 {
  "file": "service",
  "title": "auth.service: ночные смены при сохранении графика",
  "find": "            if (dayInCycle < workDays) {\n              shiftsToInsert.push({\n                weekId: weeksMap[weekIdx].id,\n                templateId: templateId,\n                userId: emp.id,\n                shiftDate: dateStr,\n                startTime: sTime,\n                endTime: eTime,\n                status: \"SCHEDULED\"\n              });\n            }",
  "replace": "            let dayType = \"D\";\n            if (hasPattern) {\n              if (pat[dayInCycle] === \"N\") dayType = \"N\";\n              if (pat[dayInCycle] === \"O\") continue;\n            } else if (dayInCycle >= workDays) continue;\n\n            const shiftStart = dayType === \"N\" ? (empData.nightStart || \"22:00\") : sTime;\n            const shiftEnd = dayType === \"N\" ? (empData.nightEnd || \"06:00\") : eTime;\n\n            let dayTemplateId = templateId;\n            if (shiftStart !== sTime || shiftEnd !== eTime) {\n              const nKey = `${shiftStart}-${shiftEnd}`;\n              if (!templatesMap.has(nKey)) {\n                const [nt] = await tx.insert(shiftTemplates).values({\n                  orgId: org.id,\n                  name: `Ночная смена ${templatesMap.size + 1}`,\n                  startTime: shiftStart,\n                  endTime: shiftEnd,\n                  color: \"#312E81\"\n                }).returning();\n                templatesMap.set(nKey, nt.id);\n              }\n              dayTemplateId = templatesMap.get(nKey)!;\n            }\n\n            shiftsToInsert.push({\n              weekId: weeksMap[weekIdx].id,\n              templateId: dayTemplateId,\n              userId: emp.id,\n              shiftDate: dateStr,\n              startTime: shiftStart,\n              endTime: shiftEnd,\n              status: \"SCHEDULED\"\n            });"
 },
 {
  "file": "service",
  "title": "auth.service: ночные смены тёмным цветом в Excel-выгрузке",
  "find": "          templateName: \"Смена\",\n          templateColor: \"#3B82F6\"\n        }));",
  "replace": "          templateName: \"Смена\",\n          templateColor: nightColorFor(s.startTime, s.endTime)\n        }));"
 },
 {
  "file": "service",
  "title": "auth.service: метод buildCalcExcel (Excel без регистрации)",
  "find": "  async guestSeed() {",
  "replace": "  // ─── Excel с калькулятора без регистрации: тот же расчёт, что в превью ───\n  async buildCalcExcel(guestData: any): Promise<Buffer> {\n    const startDate: string | undefined = guestData?.startDate;\n    if (!startDate) throw new Error(\"NO_DATE\");\n\n    const mondayRaw = getMonday(startDate);\n    const monday = typeof mondayRaw === \"string\" ? mondayRaw : new Date(mondayRaw).toISOString().slice(0, 10);\n\n    const emps: any[] = (guestData?.employees || [])\n      .filter((e: any) => e && String(e.name || \"\").trim())\n      .slice(0, 6);\n    if (emps.length === 0) throw new Error(\"NO_EMPLOYEES\");\n\n    const globalStartDate = new Date(startDate + \"T00:00:00Z\");\n    const shifts: any[] = [];\n\n    for (const emp of emps) {\n      const empName = String(emp.name).trim();\n      const empId = emp.id || empName;\n      const empStart = emp.startDate ? new Date(emp.startDate + \"T00:00:00Z\") : globalStartDate;\n\n      const sTime = emp.startTime || \"09:00\";\n      const eTime = emp.endTime || \"18:00\";\n      const nStart = emp.nightStart || \"22:00\";\n      const nEnd = emp.nightEnd || \"06:00\";\n\n      const pat = typeof emp.pattern === \"string\" ? emp.pattern.trim().toUpperCase() : \"\";\n      const hasPattern = /^[DNO]+$/.test(pat);\n      let workDays = 2;\n      let cycleLen = 4;\n      if (hasPattern) {\n        cycleLen = pat.length;\n      } else {\n        const parts = String(emp.cycle || \"2/2\").split(\"/\");\n        workDays = Number(parts[0]) || 2;\n        const offDays = Number(parts[1]) || 2;\n        cycleLen = workDays + offDays;\n      }\n\n      for (let d = 0; d < 28; d++) {\n        const currentDate = new Date(monday + \"T00:00:00Z\");\n        currentDate.setUTCDate(currentDate.getUTCDate() + d);\n        if (currentDate < empStart) continue;\n\n        let dayInCycle = Math.floor((currentDate.getTime() - empStart.getTime()) / (1000 * 3600 * 24)) % cycleLen;\n        if (dayInCycle < 0) dayInCycle += cycleLen;\n\n        let shiftStart: string | null = null;\n        let shiftEnd: string | null = null;\n        let isNight = false;\n        if (hasPattern) {\n          const t = pat[dayInCycle];\n          if (t === \"D\") { shiftStart = sTime; shiftEnd = eTime; }\n          else if (t === \"N\") { shiftStart = nStart; shiftEnd = nEnd; isNight = true; }\n        } else if (dayInCycle < workDays) {\n          shiftStart = sTime;\n          shiftEnd = eTime;\n        }\n        if (!shiftStart || !shiftEnd) continue;\n\n        shifts.push({\n          userId: empId,\n          userName: empName,\n          shiftDate: currentDate.toISOString().slice(0, 10),\n          startTime: shiftStart,\n          endTime: shiftEnd,\n          templateName: isNight ? \"Ночная смена\" : \"Смена\",\n          templateColor: isNight ? \"#312E81\" : \"#3B82F6\",\n        });\n      }\n    }\n\n    if (shifts.length === 0) throw new Error(\"NO_EMPLOYEES\");\n\n    return await exportMonthToExcel({\n      orgName: \"График смен\",\n      monthStartDate: monday,\n      employees: emps.map((e: any) => ({\n        id: e.id || String(e.name).trim(),\n        name: String(e.name).trim(),\n        hourlyRate: Number(e.rate ?? e.hourlyRate ?? 300),\n      })),\n      shifts,\n    });\n  },\n\n  async guestSeed() {"
 },
 {
  "file": "routes",
  "title": "auth.routes: ручка POST /calc-excel (Excel без регистрации, лимит 5/мин)",
  "find": "    app.post(\"/update-email\", async (req, reply) => {",
  "replace": "    // ─── Скачивание Excel с калькулятора БЕЗ регистрации ───\n    const calcExcelHits = new Map<string, number[]>();\n    app.post(\"/calc-excel\", async (req, reply) => {\n      try {\n        const ip = req.ip || \"unknown\";\n        const now = Date.now();\n        const hits = (calcExcelHits.get(ip) || []).filter((t: number) => now - t < 60_000);\n        if (hits.length >= 5) {\n          return reply.code(429).send({ error: \"Слишком много запросов, попробуйте через минуту\" });\n        }\n        hits.push(now);\n        calcExcelHits.set(ip, hits);\n\n        const { guestData } = req.body || {};\n        const buffer = await authService.buildCalcExcel(guestData);\n        reply.header(\"Content-Type\", \"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\");\n        reply.header(\"Content-Disposition\", 'attachment; filename=\"grafik-smen.xlsx\"');\n        return reply.send(buffer);\n      } catch (e: any) {\n        if (e.message === \"NO_DATE\" || e.message === \"NO_EMPLOYEES\") {\n          return reply.code(400).send({ error: \"Не хватает данных для графика\" });\n        }\n        app.log.error(e);\n        return reply.code(500).send({ error: \"Ошибка генерации Excel\" });\n      }\n    });\n\n    app.post(\"/update-email\", async (req, reply) => {"
 },
 {
  "file": "page",
  "title": "калькулятор: состояние «идёт скачивание»",
  "find": "  const [loading, setLoading] = useState(false);",
  "replace": "  const [loading, setLoading] = useState(false);\n  const [isDownloading, setIsDownloading] = useState(false);"
 },
 {
  "file": "page",
  "title": "калькулятор: обработчик скачивания Excel без регистрации",
  "find": "  const activeEmp = employees.find(e => e.id === activeEmpId)!;",
  "replace": "  const downloadExcel = async () => {\n    if (isDownloading) return;\n    setIsDownloading(true);\n    try {\n      const guestData = {\n        startDate: employees[0].startDate,\n        employees: employees.map(e => ({ ...e, rate: String(e.rate) })),\n      };\n      const res = await api.post(\"/auth/calc-excel\", { guestData }, { responseType: \"blob\" });\n      const url = URL.createObjectURL(\n        new Blob([res.data], { type: \"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\" })\n      );\n      const a = document.createElement(\"a\");\n      a.href = url;\n      a.download = \"График_смен.xlsx\";\n      document.body.appendChild(a);\n      a.click();\n      a.remove();\n      URL.revokeObjectURL(url);\n    } catch (err) {\n      alert(\"Не удалось скачать Excel. Попробуйте позже.\");\n    } finally {\n      setIsDownloading(false);\n    }\n  };\n\n  const activeEmp = employees.find(e => e.id === activeEmpId)!;"
 },
 {
  "file": "page",
  "title": "калькулятор: две кнопки — «Скачать Excel» и «Сохранить и на почту»",
  "find": "              <button \n                onClick={() => {\n              setIsSaving(true);\n              trackEvent(\"calc_save_click\");\n            }}\n                className=\"inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-sm transition-all w-full xl:w-auto justify-center\"\n              >\n                <Download className=\"w-5 h-5\" /> Сохранить и скачать\n              </button>\n            ) : (",
  "replace": "              <div className=\"flex flex-col sm:flex-row gap-2 w-full sm:w-auto\">\n                <button\n                  onClick={downloadExcel}\n                  disabled={isDownloading}\n                  className=\"inline-flex items-center gap-2 border-2 border-brand-600 text-brand-700 bg-white px-5 py-3 rounded-xl font-bold hover:bg-brand-50 shadow-sm transition-all sm:w-auto justify-center disabled:opacity-50\"\n                >\n                  {isDownloading ? <Loader2 className=\"w-5 h-5 animate-spin\" /> : <Download className=\"w-5 h-5\" />}\n                  {isDownloading ? \"Готовим файл...\" : \"Скачать Excel\"}\n                </button>\n                <button\n                  onClick={() => {\n                    setIsSaving(true);\n                    trackEvent(\"calc_save_click\");\n                  }}\n                  className=\"inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-sm transition-all sm:w-auto justify-center\"\n                >\n                  <Mail className=\"w-5 h-5\" /> Сохранить и на почту\n                </button>\n              </div>\n            ) : ("
 }
];

function nearestLines(content, find) {
  const words = (s) => new Set(String(s).toLowerCase().match(/[a-zа-яё0-9_.$-]{4,}/g) || []);
  const fw = words(find);
  return content
    .split("\n")
    .map((line, i) => {
      const lw = words(line);
      let score = 0;
      for (const w of fw) if (lw.has(w)) score++;
      return { line: line.trim().slice(0, 120), num: i + 1, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

let applied = 0, already = 0;
const errors = [];
for (const p of PATCHES) {
  let content;
  try {
    content = fs.readFileSync(FILES[p.file], "utf8");
  } catch {
    errors.push("✗ Файл не найден: " + FILES[p.file] + " (запусти скрипт из корня проекта)");
    continue;
  }
  if (content.includes(p.replace)) {
    already++;
    console.log("· " + p.title + ": уже стояло, пропущено");
    continue;
  }
  if (!content.includes(p.find)) {
    const near = nearestLines(content, p.find);
    errors.push(
      "✗ " + p.title + ": паттерн не найден в " + FILES[p.file] + "\n---\n" + p.find.slice(0, 300) + "\n---" +
      (near.length ? "\nПохожие строки:\n" + near.map((x) => "  #" + x.num + ": " + x.line).join("\n") : "")
    );
    continue;
  }
  fs.writeFileSync(FILES[p.file], content.replace(p.find, p.replace));
  applied++;
  console.log("✓ " + p.title);
}

// ─── Адаптивная связка «день/ночь → Excel» ───
try {
  const pagePath = FILES.page;
  const page0 = fs.readFileSync(pagePath, "utf8");
  const cyc = page0.match(/const CYCLES[\s\S]*?\n\};/);
  const cycBody = cyc ? cyc[0] : "";
  const hasDn = /ночь/i.test(cycBody);
  const cycHasPattern = /pattern\s*:/.test(cycBody);
  if (hasDn) {
    if (cycHasPattern) {
      if (!/pattern\?\s*:\s*string/.test(page0)) {
        const m = page0.match(/\n\s*cycle:[^;]*;/);
        if (m) {
          fs.writeFileSync(pagePath, page0.replace(m[0], m[0] + "\n  pattern?: string;"));
          console.log("✓ В тип Employee добавлено поле pattern");
        }
      }
      let page2 = fs.readFileSync(pagePath, "utf8");
      if (page2.includes('onClick={() => updateActiveEmp("cycle", key)}')) {
        page2 = page2.replace(
          'onClick={() => updateActiveEmp("cycle", key)}',
          'onClick={() => { updateActiveEmp("cycle", key); updateActiveEmp("pattern", (data as any).pattern || ""); }}'
        );
        fs.writeFileSync(pagePath, page2);
        console.log("✓ Выбор день/ночь-цикла теперь сохраняет pattern — он уйдёт на сервер в Excel и при регистрации");
      }
    } else {
      console.log("⚠ В CYCLES найдены день/ночь-циклы без поля pattern:");
      console.log("  пока они попадут в Excel как обычные циклы. Пришли Алисе фрагмент CalculatorPage.tsx");
      console.log("  (тип Employee + const CYCLES + getWorkingEmployees) — она свяжет их с ночной логикой.");
    }
  }
} catch (e) {
  console.log("(адаптивная проверка день/ночь пропущена: " + (e && e.message) + ")");
}

console.log("");
if (errors.length) {
  console.log("Готово: применено " + applied + ", уже стояло " + already + ", ошибок " + errors.length + "\n");
  errors.forEach((e) => console.log(e + "\n"));
  process.exitCode = 1;
} else {
  console.log("Готово: применено " + applied + ", уже стояло " + already + ". Ошибок нет.");
  console.log("Дальше: npm run build (фронт) и перезапуск бэкенда.");
}
