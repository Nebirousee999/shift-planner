// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "frontend/src/pages/ProfilePage.tsx");

if (!fs.existsSync(filePath)) {
  console.log("❌ Файл не найден:", filePath);
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf-8");
const hadCRLF = raw.includes("\r\n");
let normalized = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;
let touched = 0;

// Ищем конец компонента MessengerSection и добавляем недостающий </div>
const searchStr = `          Настройки уведомлений станут доступны после того, как вы привяжете свой ID.
        </div>
      )}
    </div>
  );
}`;

const replaceStr = `          Настройки уведомлений станут доступны после того, как вы привяжете свой ID.
        </div>
      )}
      </div>
    </div>
  );
}`;

if (normalized.includes(searchStr)) {
  normalized = normalized.replace(searchStr, replaceStr);
  touched++;
  console.log("✅ Добавлен недостающий закрывающий тег </div>.");
} else {
  console.log("⚠️ Не найдено место для вставки. Возможно, ошибка в другом месте.");
}

if (touched > 0) {
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  console.log("🎉 Готово! Обновите страницу в браузере.");
} else {
  console.log("✨ Изменений не внесено.");
}