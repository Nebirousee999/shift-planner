import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COUNTER_ID = "114078577";

function patchFile(p, replaces) {
  const filePath = path.join(ROOT, p);
  if (!fs.existsSync(filePath)) return console.log(`⚠ ${p} not found`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let c = raw.replace(/\r\n/g, "\n");
  let touched = 0;
  for (const [from, to] of replaces) {
    if (c.includes(from)) { c = c.replace(from, to); touched++; }
  }
  if (touched > 0) {
    fs.writeFileSync(filePath, hadCRLF ? c.replace(/\n/g, "\r\n") : c, "utf-8");
    console.log(`✔ ${p} (${touched} замен)`);
  } else {
    console.log(`⚠ ${p} (ничего не найдено)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. Встраиваем код Метрики в index.html
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/index.html", [
  [
    `    <!-- Yandex.Metrika counter (закомментировано) -->`,
    `    <!-- Yandex.Metrika counter -->
    <script type="text/javascript" >
       (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
       m[i].l=1*new Date();
       for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
       k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
       (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

       ym(${COUNTER_ID}, "init", {
            clickmap:true,
            trackLinks:true,
            accurateTrackBounce:true,
            webvisor:true,
            ecommerce:"dataLayer"
       });
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/${COUNTER_ID}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    <!-- /Yandex.Metrika counter -->`
  ],
  // Заменяем старый закомментированный блок, если он был
  [
    `    <!-- 
    <script type="text/javascript">
      (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
      (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

      ym(XXXXXX, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
      });
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/XXXXXX" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    -->
    <!-- /Yandex.Metrika counter -->`,
    ``
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 2. Обновляем ID в lib/metrika.ts
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/lib/metrika.ts", [
  [
    `// Замени 99999999 на свой реальный ID счетчика Метрики\nconst COUNTER_ID = 99999999; `,
    `const COUNTER_ID = ${COUNTER_ID};`
  ]
]);

console.log("\n✅ Метрика успешно встроена!");
console.log(`   ID счетчика: ${COUNTER_ID}`);
console.log("Теперь на лендинге будут работать цели (trackEvent) и Вебвизор.");