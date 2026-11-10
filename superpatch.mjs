// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function writeFile(relPath, content, label) {
  const filePath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  touched++;
  console.log("✅ [" + label + "] Перезаписан");
}

writeFile(
  "frontend/src/components/SupportChat.tsx",
  `import { useState, useRef, useEffect } from "react";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";
import { useAuth } from "../store/auth";
import { supportApi, type SupportMessage } from "../api/support";

export default function SupportChat({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [sessionToken, setSessionToken] = useState<string>("");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Инициализация сессии
  useEffect(() => {
    let token = localStorage.getItem("support_session_token");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("support_session_token", token);
    }
    setSessionToken(token);
  }, []);

  // Сброс при смене пользователя
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    } else {
      setEmail("");
    }
    setMessages([]);
    setFetching(true);
  }, [user?.id]);

  const loadMessages = async () => {
    if (!sessionToken) return;
    try {
      const msgs = await supportApi.getMessages(sessionToken);
      setMessages(msgs);
    } catch (e) {
      // ignore
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [sessionToken, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImages((prev) => [...prev, event.target?.result as string]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!message && images.length === 0)) return;
    setLoading(true);
    try {
      // Отправляем и получаем ответ
      const res = await supportApi.send({ email, message, images, sessionToken });
      
      // Если бэкенд выдал новый токен (смена почты у гостя) — сохраняем его
      if (res.sessionToken && res.sessionToken !== sessionToken) {
        setSessionToken(res.sessionToken);
        localStorage.setItem("support_session_token", res.sessionToken);
      } else {
        await loadMessages();
      }
      
      setMessage("");
      setImages([]);
    } catch (err) {
      alert("Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[400px] bg-slate-50">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm mt-10">
            <p>Напишите свой вопрос,</p>
            <p>и мы ответим вам прямо здесь.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={\`flex \${m.sender === "USER" ? "justify-end" : "justify-start"}\`}>
              <div
                className={\`max-w-[80%] rounded-2xl px-3 py-2 text-sm \${
                  m.sender === "USER"
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                }\`}
              >
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.images.map((img, i) => (
                      <img key={i} src={img} className="h-16 w-16 object-cover rounded-lg cursor-pointer" />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className={\`text-[9px] mt-1 text-right \${m.sender === "USER" ? "text-brand-200" : "text-slate-400"}\`}>
                  {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border-t border-slate-200 p-3">
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-2 pb-2 px-1">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0 group">
                <img src={img} className="h-12 w-12 object-cover rounded-lg border border-slate-200" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(!email || messages.length === 0) && (
          <div className="mb-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ваша почта (для связи)"
              className="w-full !text-sm !bg-slate-50 !border-slate-200"
              required
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            title="Прикрепить фото"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder="Сообщение... (можно вставить фото из буфера)"
            className="flex-1 !text-sm !py-2 !bg-slate-50 !border-slate-200 resize-none min-h-[72px] max-h-32"
            rows={3}
            required={images.length === 0}
          />

          <button
            type="submit"
            disabled={loading || (!message && images.length === 0)}
            className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
`,
  "frontend/src/components/SupportChat.tsx"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! SupportChat.tsx полностью перезаписан.");
} else {
  console.log("⚠️ Изменений не внесено.");
}