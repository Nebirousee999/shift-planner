// superpatch.mjs
import fs from "node:fs";

const file = "frontend/src/pages/WeeksPage.tsx";
if (!fs.existsSync(file)) {
  console.error("❌ Файл не найден:", file);
  process.exit(1);
}

let code = fs.readFileSync(file, "utf-8");
const hadCRLF = code.includes("\r\n");
let normalized = hadCRLF ? code.replace(/\r\n/g, "\n") : code;
let changed = false;

// 1. Переписываем ShiftLines (фон на всю ширину, без наложения)
const startIndex = normalized.indexOf("function ShiftLines({");
const endIndex = normalized.indexOf("export default function WeeksPage() {");

const newShiftLines = `function ShiftLines({
  shifts,
  templateColorById,
  userColorById,
}: {
  shifts: any[];
  templateColorById: (id: string | null) => string;
  userColorById: (id: string | null) => string;
}) {
  if (shifts.length === 0) return null;

  const parsedShifts = shifts.map((s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins <= startMins) endMins += 24 * 60;

    return {
      ...s,
      startMins,
      endMins,
      color: userColorById(s.userId) || templateColorById(s.templateId) || "#3B82F6",
    };
  });

  parsedShifts.sort((a, b) => a.startMins - b.startMins);

  const lanes: typeof parsedShifts[] = [];
  for (const shift of parsedShifts) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const lastShift = lane[lane.length - 1];
      if (shift.startMins >= lastShift.endMins) {
        lane.push(shift);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([shift]);
    }
  }

  // Функция смешивания цвета с белым
  const getLightColor = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mix = 1 - opacity;
    const nr = Math.round(r + (255 - r) * mix);
    const ng = Math.round(g + (255 - g) * mix);
    const nb = Math.round(b + (255 - b) * mix);
    return \`#\${nr.toString(16).padStart(2, '0')}\${ng.toString(16).padStart(2, '0')}\${nb.toString(16).padStart(2, '0')}\`;
  };

  return (
    <div className="absolute inset-0 flex flex-col w-full h-full pointer-events-none z-0">
      {lanes.map((lane, idx) => {
        const topPct = (idx / lanes.length) * 100;
        const heightPct = (1 / lanes.length) * 100;
        
        // Строим градиент для заливки всей ширины (0-100%)
        const stops: string[] = [];
        for (let i = 0; i < lane.length; i++) {
          const s = lane[i];
          const light = getLightColor(s.color, 0.85);
          const startPct = (s.startMins / 1440) * 100;
          const endPct = (s.endMins / 1440) * 100;
          
          if (i === 0) {
            stops.push(\`\${light} 0%\`);
            stops.push(\`\${light} \${startPct}%\`);
          } else {
            const prev = lane[i-1];
            const prevEndPct = (prev.endMins / 1440) * 100;
            const mid = (prevEndPct + startPct) / 2;
            stops.push(\`\${light} \${mid}%\`);
            stops.push(\`\${light} \${startPct}%\`);
          }
          
          if (i === lane.length - 1) {
            stops.push(\`\${light} \${endPct}%\`);
            stops.push(\`\${light} 100%\`);
          }
        }

        const backgroundStyle = lane.length > 0 
          ? \`linear-gradient(to right, \${stops.join(", ")})\` 
          : "transparent";

        return (
          <div 
            key={idx} 
            className="absolute w-full" 
            style={{ 
              top: \`\${topPct}%\`, 
              height: \`\${heightPct}%\`,
              background: backgroundStyle
            }}
          >
            {lane.map((s) => {
              const leftPct = (s.startMins / 1440) * 100;
              const widthPct = ((s.endMins - s.startMins) / 1440) * 100;

              return (
                <div
                  key={s.id}
                  className="absolute top-0 bottom-0 rounded-sm shadow-sm"
                  style={{
                    left: \`\${leftPct}%\`,
                    width: \`\${Math.max(widthPct, 1.5)}%\`,
                    backgroundColor: s.color,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

`;

if (startIndex !== -1 && endIndex !== -1) {
  normalized = normalized.slice(0, startIndex) + newShiftLines + normalized.slice(endIndex);
  changed = true;
  console.log("✅ Компонент ShiftLines обновлён (фон на всю ширину, смешивание цветов)");
} else {
  console.log("⚠️ Не удалось найти функцию ShiftLines");
}

// 2. Плашка с суммой: 20% черного, прижата к низу, тень
const badgeRegex = /\{dayShifts\.length > 0 && \([\s\S]*?\{new Intl\.NumberFormat\("ru-RU"\)\.format\(dayCost\)\} ₽[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

const newBadge = `{dayShifts.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 z-10 pb-1 flex justify-center w-full pointer-events-none">
                            <div className="text-[10px] text-white font-bold leading-tight bg-black/20 px-1.5 py-0.5 rounded shadow-sm">
                              {dayShifts.length} см. • {new Intl.NumberFormat("ru-RU").format(dayCost)} ₽
                            </div>
                          </div>
                        )}`;

if (badgeRegex.test(normalized)) {
  normalized = normalized.replace(badgeRegex, newBadge);
  changed = true;
  console.log("✅ Плашка с суммой обновлена (20% черного, тень, прижата к низу)");
} else {
  console.log("⚠️ Не удалось найти блок с плашкой суммы");
}

if (changed) {
  fs.writeFileSync(file, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("💾 Файл WeeksPage.tsx сохранён!");
} else {
  console.log("✨ Изменений не требуется.");
}