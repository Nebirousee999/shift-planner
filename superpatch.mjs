// superpatch.mjs
// Правка: после ввода почты на /calc редирект на /weeks перебивался
// на "/" компонентом <Navigate to="/" /> из CalcRoute.
// Меняем цель редиректа CalcRoute с "/" на "/weeks".

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

function replaceBlockBetweenAnchors(relPath, startAnchor, endAnchor, newLines) {
  const filePath = resolve(process.cwd(), relPath);
  if (!existsSync(filePath)) {
    console.error(`✗ Файл не найден: ${relPath}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);

  const startTrimmed = startAnchor.trim();
  const endTrimmed = endAnchor.trim();

  const startIdx = lines.findIndex((l) => l.trim() === startTrimmed);
  if (startIdx === -1) {
    console.error(`✗ Стартовый якорь не найден в ${relPath}: "${startTrimmed}"`);
    process.exit(1);
  }

  let endIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === endTrimmed) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    console.error(`✗ Конечный якорь не найден после стартового в ${relPath}: "${endTrimmed}"`);
    process.exit(1);
  }

  const indent = lines[startIdx].match(/^\s*/)[0];
  const replacement = newLines.map((l) => (l ? indent + l : ""));

  lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);

  writeFileSync(filePath, lines.join(eol), "utf8");
  console.log(`✓ ${relPath} — блок заменён (строки ${startIdx + 1}-${endIdx + 1} → ${replacement.length})`);
}

replaceBlockBetweenAnchors(
  "frontend/src/App.tsx",
  `function CalcRoute() {`,
  `return <CalculatorPage />;`,
  [
    `function CalcRoute() {`,
    `  const { token, hydrated } = useAuth();`,
    `  if (!hydrated) return null;`,
    `  const isGuest = localStorage.getItem("isGuest") === "true";`,
    `  // После регистрации с /calc ведём на /weeks, а не на главную,`,
    `  // иначе <Navigate to="/" /> перебивает navigate("/weeks") из CalculatorPage.`,
    `  if (token && !isGuest) return <Navigate to="/weeks" replace />;`,
    `  return <CalculatorPage />;`,
  ]
);

console.log("\nПравка применена успешно.");