// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

// ════════════════════════════════════════════════════════════
// 1. АДМИНКА (AdminSupportPage.tsx)
// ════════════════════════════════════════════════════════════
const adminPath = path.join(ROOT, "frontend/src/pages/AdminSupportPage.tsx");
if (fs.existsSync(adminPath)) {
  let content = fs.readFileSync(adminPath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  if (hadCRLF) content = content.replace(/\r\n/g, "\n");

  // Добавляем стейт, если его нет
  if (!content.includes("const [activeImage, setActiveImage]")) {
    content = content.replace(
      "const [loading, setLoading] = useState(true);",
      "const [loading, setLoading] = useState(true);\n  const [activeImage, setActiveImage] = useState<string | null>(null);"
    );
  }

  // Заменяем блок сообщений через регулярное выражение (ищет от {messages.map до }))})
  const adminRegex = /\{messages\.map\(m => \([\s\S]*?\)\)\}/;
  const adminReplacement = `{messages.map(m => (
                <div key={m.id} className={\`flex \${m.sender === "ADMIN" ? "justify-end" : "justify-start"} mb-2\`}>
                  <div className={\`flex flex-col max-w-[70%] \${m.sender === "ADMIN" ? "items-end" : "items-start"}\`}>
                    
                    {/* Картинки в админке: 50% ширины, без фона */}
                    {m.images && m.images.length > 0 && (
                      <div className="flex flex-col gap-2 mb-1 w-[50%] min-w-[200px] max-w-[400px]">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} onClick={() => setActiveImage(img)} className="w-full h-auto object-contain rounded-xl cursor-pointer border border-slate-200 hover:opacity-90 transition-opacity" />
                        ))}
                      </div>
                    )}
                    
                    {/* Текст в пузыре */}
                    {m.text && (
                      <div className={\`rounded-2xl px-4 py-2 text-sm \${m.sender === "ADMIN" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}\`}>
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <div className={\`text-[9px] mt-1 text-right \${m.sender === "ADMIN" ? "text-brand-200" : "text-slate-400"}\`}>
                          {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    )}
                    
                    {/* Время под картинкой, если нет текста */}
                    {!m.text && m.images && m.images.length > 0 && (
                      <div className="text-[9px] mt-1 text-slate-400">
                        {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}`;
  
  content = content.replace(adminRegex, adminReplacement);

  // Добавляем лайтбокс в конец, если его нет
  if (!content.includes("activeImage && (")) {
    content = content.replace(
      `      </main>\n    </div>\n  );\n}`,
      `      </main>\n\n      {/* Лайтбокс */}\n      {activeImage && (\n        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setActiveImage(null)}>\n          <img src={activeImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />\n          <button className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-6 h-6" /></button>\n        </div>\n      )}\n    </div>\n  );\n}`
    );
  }

  fs.writeFileSync(adminPath, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  touched++;
  console.log("✅ [AdminSupportPage.tsx] Обновлён: картинки по 50%, без фона.");
}


// ════════════════════════════════════════════════════════════
// 2. ПЛАВАЮЩИЙ ЧАТ (SupportChat.tsx)
// ════════════════════════════════════════════════════════════
const chatPath = path.join(ROOT, "frontend/src/components/SupportChat.tsx");
if (fs.existsSync(chatPath)) {
  let content = fs.readFileSync(chatPath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  if (hadCRLF) content = content.replace(/\r\n/g, "\n");

  // Добавляем стейт, если его нет
  if (!content.includes("const [activeImage, setActiveImage]")) {
    content = content.replace(
      "const [loading, setLoading] = useState(false);",
      "const [loading, setLoading] = useState(false);\n  const [activeImage, setActiveImage] = useState<string | null>(null);"
    );
  }

  // Заменяем блок сообщений через регулярное выражение
  const chatRegex = /\{messages\.map\(\(m\) => \([\s\S]*?\)\)\}/;
  const chatReplacement = `{messages.map((m) => (
          <div key={m.id} className={\`flex \${m.sender === "USER" ? "justify-end" : "justify-start"} mb-2\`}>
            <div className={\`flex flex-col max-w-[80%] \${m.sender === "USER" ? "items-end" : "items-start"}\`}>
              
              {/* Картинки в чате: на всю ширину, без фона */}
              {m.images && m.images.length > 0 && (
                <div className="flex flex-col gap-2 mb-1 w-full max-w-[250px]">
                  {m.images.map((img, i) => (
                    <img key={i} src={img} onClick={() => setActiveImage(img)} className="w-full h-auto object-contain rounded-xl cursor-pointer border border-slate-200 hover:opacity-90 transition-opacity" />
                  ))}
                </div>
              )}
              
              {/* Текст */}
              {m.text && (
                <div className={\`rounded-2xl px-3 py-2 text-sm \${
                  m.sender === "USER" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                }\`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <div className={\`text-[9px] mt-1 text-right \${m.sender === "USER" ? "text-brand-200" : "text-slate-400"}\`}>
                    {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              )}
              
              {/* Время под картинкой */}
              {!m.text && m.images && m.images.length > 0 && (
                <div className="text-[9px] mt-1 text-slate-400">
                  {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}`;
        
  content = content.replace(chatRegex, chatReplacement);

  // Добавляем лайтбокс в конец, если его нет
  if (!content.includes("activeImage && (")) {
    content = content.replace(
      `      </div>\n    </div>\n  );\n}`,
      `      </div>\n\n      {/* Лайтбокс */}\n      {activeImage && (\n        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setActiveImage(null)}>\n          <img src={activeImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />\n          <button className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-6 h-6" /></button>\n        </div>\n      )}\n    </div>\n  );\n}`
    );
  }

  fs.writeFileSync(chatPath, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  touched++;
  console.log("✅ [SupportChat.tsx] Обновлён: картинки на всю ширину, без фона.");
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Дизайн картинок успешно обновлен.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, файлы не найдены).");
}