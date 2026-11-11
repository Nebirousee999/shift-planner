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

// ════════════════════════════════════════════════════════════
// 1. АДМИНКА (AdminSupportPage.tsx)
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `  const [loading, setLoading] = useState(true);`,
  `  const [loading, setLoading] = useState(true);\n  const [activeImage, setActiveImage] = useState<string | null>(null);`,
  "AdminSupportPage: добавление стейта для картинки"
);

patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `                      {m.images && m.images.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {m.images.map((img, i) => (
                            <img key={i} src={img} className="h-24 w-24 object-cover rounded-lg cursor-pointer" />
                          ))}
                        </div>
                      )}`,
  `                      {m.images && m.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {m.images.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              onClick={() => setActiveImage(img)}
                              className="w-1/2 max-w-[300px] min-w-[150px] h-auto object-cover rounded-lg cursor-pointer border border-slate-200 hover:opacity-90 transition-opacity"
                            />
                          ))}
                        </div>
                      )}`,
  "AdminSupportPage: стили картинок и клик"
);

patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `      </main>
    </div>
  );
}`,
  `      </main>

      {/* Лайтбокс для админки */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setActiveImage(null)}
        >
          <img src={activeImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}`,
  "AdminSupportPage: лайтбокс в конце"
);


// ════════════════════════════════════════════════════════════
// 2. ПЛАВАЮЩИЙ ЧАТ (SupportChat.tsx)
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `  const [loading, setLoading] = useState(false);`,
  `  const [loading, setLoading] = useState(false);\n  const [activeImage, setActiveImage] = useState<string | null>(null);`,
  "SupportChat: добавление стейта для картинки"
);

patchFile(
  "frontend/src/components/SupportChat.tsx",
  `                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.images.map((img, i) => (
                      <img key={i} src={img} className="h-16 w-16 object-cover rounded-lg cursor-pointer" />
                    ))}
                  </div>
                )}`,
  `                {m.images && m.images.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2">
                    {m.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        onClick={() => setActiveImage(img)}
                        className="w-full max-w-[250px] h-auto object-cover rounded-lg cursor-pointer border border-slate-200 hover:opacity-90 transition-opacity"
                      />
                    ))}
                  </div>
                )}`,
  "SupportChat: стили картинок и клик"
);

patchFile(
  "frontend/src/components/SupportChat.tsx",
  `      </div>
    </div>
  );
}`,
  `      </div>

      {/* Лайтбокс для плавающего чата */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setActiveImage(null)}
        >
          <img src={activeImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}`,
  "SupportChat: лайтбокс в конце"
);

console.log("\n──────────────────────────────────────");
console.log(touched > 0 ? "🎉 Готово! Картинки теперь можно открывать и они стали больше." : "⚠️ Изменений не внесено.");