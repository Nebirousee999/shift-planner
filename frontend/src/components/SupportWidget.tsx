import { useState, useRef } from "react";
import { MessageCircle, X, Send, CheckCircle2, ImagePlus, Trash2 } from "lucide-react";
import { useAuth } from "../store/auth";
import { supportApi } from "../api/support";

export default function SupportWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (user?.role === "EMPLOYEE") return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImages(prev => [...prev, base64]);
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
            const base64 = event.target?.result as string;
            setImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!message && images.length === 0)) return;
    setLoading(true);
    try {
      await supportApi.create({ email, message, images });
      setSent(true);
      setMessage("");
      setImages([]);
      setTimeout(() => {
        setSent(false);
        setIsOpen(false);
      }, 4000);
    } catch (err) {
      alert("Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 mb-4 overflow-hidden animate-fade-in">
          <div className="bg-brand-600 text-white p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Поддержка</h3>
              <p className="text-brand-100 text-[10px]">Ответим на почту или в MAX</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h4 className="font-semibold text-slate-900 mb-1">Отправлено!</h4>
              <p className="text-xs text-slate-500">Мы свяжемся с вами в ближайшее время.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ваша почта</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full !text-sm"
                  placeholder="ivan@mail.ru"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Вопрос</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onPaste={handlePaste}
                  rows={3}
                  className="w-full !text-sm"
                  placeholder="Опишите вопрос... (можно вставить фото из буфера)"
                />
              </div>

              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pt-3 pb-2 px-1">
                  {images.map((img, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <img src={img} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  title="Прикрепить фото"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {loading ? "Отправка..." : <><Send className="w-4 h-4" /> Отправить</>}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-brand-600 text-white rounded-full shadow-xl hover:bg-brand-700 transition-all flex items-center justify-center hover:scale-105"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}