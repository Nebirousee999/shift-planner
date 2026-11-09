import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. Обновляем импорты и типы
patchFile(
  "frontend/src/pages/ProfilePage.tsx",
  `  Bell, Send, MessageSquare, Check, Loader2, X, User as UserIcon, Info, HelpCircle,`,
  `  Bell, Send, MessageSquare, Check, Loader2, X, User as UserIcon, Info, HelpCircle, CheckCircle2,`,
  "ProfilePage.tsx (добавлен импорт CheckCircle2)"
);

patchFile(
  "frontend/src/api/organization.ts",
  `  maxBotLink?: string | null;\n  maxBotToken?: string | null;`,
  `  maxBotLink?: string | null;\n  maxBotToken?: string | null;\n  maxBotId?: string | null;`,
  "organization.ts (тип maxBotId)"
);

// 2. Полная замена компонента MessengerSection
const profilePath = path.join(ROOT, "frontend/src/pages/ProfilePage.tsx");
let profileContent = fs.readFileSync(profilePath, "utf-8");
const hadCRLF = profileContent.includes("\r\n");
let normalized = hadCRLF ? profileContent.replace(/\r\n/g, "\n") : profileContent;

const startMarker = `function MessengerSection({ userId }: { userId: string }) {`;
const endMarker = `// ═══════════════════════════════════════════════════\n// Реквизиты организации`;

const startIndex = normalized.indexOf(startMarker);
const endIndex = normalized.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newComponent = `function MessengerSection({ userId }: { userId: string }) {
  const { org, set: setOrg } = useOrganization();
  const [bindings, setBindings] = useState<{ max: string }>(() => {
    const raw = localStorage.getItem(\`messengers_\${userId}\`);
    if (raw) { try { return JSON.parse(raw); } catch {} }
    return { max: "" };
  });
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const raw = localStorage.getItem(\`notif_settings_\${userId}\`);
    if (raw) { try { return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) }; } catch {} }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });
  const [draftMax, setDraftMax] = useState(bindings.max);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Состояния для шагов
  const [botToken, setBotToken] = useState(org?.maxBotToken || "");
  const [botLink, setBotLink] = useState(org?.maxBotLink || "");
  const [savingToken, setSavingToken] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const isStep1 = !!org?.maxBotToken;
  const isStep2 = !!org?.maxBotLink;
  const isStep3 = !!bindings.max;
  const isOwner = useAuth(s => s.user?.role) === "OWNER";

  // Исправление ссылки (добавляем https://max.ru/ если нет)
  const maxLink = org?.maxBotLink
    ? org.maxBotLink.startsWith("http")
      ? org.maxBotLink
      : \`https://max.ru/\${org.maxBotLink.replace("@", "")}\`
    : null;

  useEffect(() => {
    localStorage.setItem(\`notif_settings_\${userId}\`, JSON.stringify(settings));
  }, [settings, userId]);

  useEffect(() => {
    if (org) {
      setBotToken(org.maxBotToken || "");
      setBotLink(org.maxBotLink || "");
    }
  }, [org?.maxBotToken, org?.maxBotLink]);

  const toggle = (key: keyof NotificationSettings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const handleSaveToken = async () => {
    if (!botToken.trim()) return;
    setSavingToken(true);
    try {
      const updated = await organizationApi.update({ maxBotToken: botToken.trim() });
      setOrg(updated);
      await alertDialog("Токен сохранен, вебхук настроен", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка сохранения токена", { variant: "error" });
    } finally {
      setSavingToken(false);
    }
  };

  const handleSaveLink = async () => {
    if (!botLink.trim()) return;
    setSavingLink(true);
    try {
      const updated = await organizationApi.update({ maxBotLink: botLink.trim() });
      setOrg(updated);
      await alertDialog("Ссылка сохранена", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка сохранения ссылки", { variant: "error" });
    } finally {
      setSavingLink(false);
    }
  };

  const handleUnlockToken = () => setOrg({ ...org, maxBotToken: null } as any);
  const handleUnlockLink = () => setOrg({ ...org, maxBotLink: null } as any);

  const bind = async () => {
    const externalId = draftMax.trim();
    if (!externalId) return;
    setBusy(true);
    try {
      await meApi.bindMessenger({ provider: "max", externalId });
      const next = { max: externalId };
      setBindings(next);
      localStorage.setItem(\`messengers_\${userId}\`, JSON.stringify(next));
      await alertDialog("Мессенджер привязан", { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка привязки", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await meApi.testMessenger();
      await alertDialog(
        res.success ? "Тестовое сообщение отправлено!" : "Не удалось отправить. Проверьте привязку.",
        { variant: res.success ? "success" : "error" }
      );
    } catch {
      await alertDialog("Ошибка отправки", { variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  const broadcastLink = async () => {
    if (!botLink.trim()) return alert("Сначала укажите и сохраните ссылку на бота");
    if (!confirm("Разослать ссылку на бота всем сотрудникам на почту?")) return;
    setBroadcasting(true);
    try {
      const res = await api.post("/organization/broadcast-bot-link");
      await alertDialog(\`Ссылка отправлена: \${res.data.sent} писем\`, { variant: "success" });
    } catch (e: any) {
      await alertDialog(e.response?.data?.error ?? "Ошибка рассылки", { variant: "error" });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Мессенджер</h2>
          <p className="text-xs text-slate-500">Куда присылать уведомления о сменах</p>
        </div>
      </div>

      {isOwner && (
        <div className="mb-6">
          <details className="group cursor-pointer mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <summary className="font-semibold text-brand-600 text-sm flex items-center gap-2 select-none hover:text-brand-700 transition-colors">
              <HelpCircle className="w-4 h-4" />
              Инструкция: Как создать и настроить своего бота в MAX?
            </summary>
            <div className="mt-3 text-[13px] text-slate-600 space-y-3 bg-white p-4 rounded-lg border border-slate-200 leading-relaxed">
              <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-md mb-2">
                <b>⚠️ Важно:</b> Раньше ботов создавали через @MasterBot. Теперь это делается <b>только</b> на официальной платформе «MAX для партнеров» (требуется статус ИП, самозанятого или юрлица).
              </div>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>Перейдите на платформу <a href="https://business.max.ru" target="_blank" rel="noopener noreferrer" className="text-brand-600 font-medium hover:underline">business.max.ru</a> и авторизуйтесь по российскому номеру телефона.</li>
                <li>Пройдите верификацию бизнеса (подтвердите статус ИП/юрлица).</li>
                <li>В личном кабинете выберите раздел <b>«Чат-боты»</b> и нажмите кнопку <b>«Создать»</b>.</li>
                <li>Заполните карточку бота (название, описание, логотип) и отправьте на модерацию.</li>
                <li>После одобрения модерацией скопируйте <b>Токен</b> и <b>Ссылку</b> на бота в его настройках.</li>
              </ol>
              <p className="mt-3 font-semibold text-slate-900 pt-2 border-t border-slate-100">
                Вставьте полученные токен и ссылку в поля ниже. Вебхук настроится автоматически.
              </p>
            </div>
          </details>

          {/* STEP 1: TOKEN */}
          <div className={\`rounded-xl border-2 transition-all p-4 mb-3 \${isStep1 ? 'border-emerald-200 bg-emerald-50/20' : 'border-brand-200 bg-white'}\`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isStep1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">1</div>}
                <h3 className="font-semibold text-slate-900 text-sm">Токен бота MAX</h3>
              </div>
              {isStep1 && (
                <button onClick={handleUnlockToken} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Изменить
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Например: 123456789:AAH..."
                className="w-full !text-sm"
                disabled={isStep1}
              />
              {!isStep1 && (
                <button onClick={handleSaveToken} disabled={savingToken || !botToken.trim()} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap">
                  {savingToken ? "Сохранение..." : "Сохранить"}
                </button>
              )}
            </div>
          </div>

          {/* STEP 2: LINK */}
          <div className={\`rounded-xl border-2 transition-all p-4 mb-3 \${!isStep1 ? 'opacity-50 border-slate-200 bg-slate-50 pointer-events-none' : isStep2 ? 'border-emerald-200 bg-emerald-50/20' : 'border-brand-200 bg-white'}\`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isStep2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">2</div>}
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Ссылка на вашего бота MAX</h3>
                  <p className="text-xs text-slate-500">Сотрудники увидят эту ссылку у себя в профиле.</p>
                </div>
              </div>
              {isStep2 && (
                <button onClick={handleUnlockLink} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Изменить
                </button>
              )}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                value={botLink}
                onChange={(e) => setBotLink(e.target.value)}
                placeholder="@username или https://max.ru/..."
                className="flex-1 !text-sm"
                disabled={!isStep1 || isStep2}
              />
              {!isStep2 && (
                <button onClick={handleSaveLink} disabled={savingLink || !botLink.trim()} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap">
                  {savingLink ? "Сохранение..." : "Сохранить"}
                </button>
              )}
            </div>
            <button onClick={broadcastLink} disabled={broadcasting || !isStep2} className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <Send className="w-4 h-4" />
              {broadcasting ? "Отправка..." : "Разослать ссылку всем на почту"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: BIND ID (Доступно всем, но с учетом лимитов) */}
      <div className={\`rounded-xl border-2 transition-all p-4 mb-6 \${isOwner && !isStep2 ? 'opacity-50 border-slate-200 bg-slate-50 pointer-events-none' : isStep3 ? 'border-emerald-200 bg-emerald-50/20' : 'border-brand-200 bg-white'}\`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isStep3 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">3</div>}
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Ваш ID в MAX</h3>
              {!isOwner && <p className="text-xs text-slate-500">Чтобы получать уведомления о сменах</p>}
            </div>
          </div>
        </div>
        
        {maxLink ? (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-blue-900">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <div>
              Перейдите в бота по ссылке: <a href={maxLink} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-blue-700">{maxLink}</a><br/>
              Нажмите /start, скопируйте ID и вставьте ниже.
            </div>
          </div>
        ) : (
          <div className="mb-3 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            Руководитель еще не настроил ссылку на бота. Попросите его сделать это.
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            placeholder="Например: 987654321"
            className="!text-sm flex-1"
            disabled={!maxLink || isStep3}
          />
          <button onClick={bind} disabled={!maxLink || !draftMax.trim() || busy || isStep3} className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isStep3 ? "Привязан" : "Привязать"}
          </button>
        </div>
        {isStep3 && (
           <div className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
             <Check className="w-3.5 h-3.5" /> Успешно привязан ID: <span className="font-mono font-medium">{bindings.max}</span>
           </div>
        )}
      </div>

      {/* NOTIFICATIONS */}
      {isStep3 ? (
        <>
          <div className="mb-6">
            <button type="button" onClick={test} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Отправить тестовое сообщение
            </button>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" /> Какие уведомления получать
            </h3>
            <p className="text-xs text-slate-500 mb-4">Отметьте события, о которых хотите получать сообщения</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <NotifCheckbox label="Новый график на неделю" checked={settings.newSchedule} onChange={() => toggle("newSchedule")} />
              <NotifCheckbox label="Смена изменена" checked={settings.shiftChanged} onChange={() => toggle("shiftChanged")} />
              <NotifCheckbox label="Назначена новая смена" checked={settings.shiftCreated} onChange={() => toggle("shiftCreated")} />
              <NotifCheckbox label="Нужно согласовать изменение смены" checked={settings.shiftChangeApproval} onChange={() => toggle("shiftChangeApproval")} />
              <NotifCheckbox label="Запрос на обмен сменами" checked={settings.swapRequest} onChange={() => toggle("swapRequest")} />
              <NotifCheckbox label="Отпуск (одобрен/отклонён)" checked={settings.vacationReviewed} onChange={() => toggle("vacationReviewed")} />
              <NotifCheckbox label="Больничный" checked={settings.sickLeave} onChange={() => toggle("sickLeave")} />
              <NotifCheckbox label="Отгул (одобрен/отклонён)" checked={settings.timeOffReviewed} onChange={() => toggle("timeOffReviewed")} />
            </div>
            <div className="mt-6">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Напоминания о начале смены
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                <NotifCheckbox label="За час до начала" checked={settings.remindHour} onChange={() => toggle("remindHour")} />
                <NotifCheckbox label="За 5 минут до начала" checked={settings.remindFiveMin} onChange={() => toggle("remindFiveMin")} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
          Настройки уведомлений станут доступны после того, как вы привяжете свой ID.
        </div>
      )}
    </div>
  );
}

`;
  normalized = normalized.slice(0, startIndex) + newComponent + normalized.slice(endIndex);
  const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(profilePath, finalContent, "utf-8");
  touched++;
  console.log("✅ [ProfilePage.tsx] Блок MessengerSection полностью переработан (пошаговая настройка).");
} else {
  console.log("❌ Не удалось найти компонент MessengerSection в ProfilePage.tsx");
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь можно коммитить и пушить.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}