import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'frontend', 'src');

console.log("⏳ Перестраиваем Демо-режим (изоляция в /demo, localStorage)...");

// ==========================================
// 1. ПАТЧ APP.TSX (Маршрут /demo/*)
// ==========================================
const appPath = path.join(srcDir, 'App.tsx');
if (fs.existsSync(appPath)) {
  let content = fs.readFileSync(appPath, 'utf8');
  content = content.replace(
    '<Route path="/demo" element={<GuestApp />} />',
    '<Route path="/demo/*" element={<GuestApp />} />'
  );
  fs.writeFileSync(appPath, content, 'utf8');
  console.log("   [+] App.tsx: маршрут демо теперь /demo/*");
}

// ==========================================
// 2. ПЕРЕПИСЫВАЕМ GUESTAPP.TSX (Роутер демо)
// ==========================================
const guestAppPath = path.join(srcDir, 'pages', 'GuestApp.tsx');
const guestAppContent = `import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "../components/NavBar";
import DashboardPage from "./DashboardPage";
import WeeksPage from "./WeeksPage";
import SwapsPage from "./SwapsPage";

export default function GuestApp() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Устанавливаем флаги гостя
    if (localStorage.getItem("isGuest") !== "true") {
      localStorage.setItem("isGuest", "true");
      localStorage.setItem("token", "guest-mock");
      localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
    }
    
    // SEO: запрещаем индексацию всего демо
    document.title = "Демо-режим | Планировщик смен";
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, follow");
  }, []);

  // Если пользователь зашел по старому пути /demo без слеша, редиректим на /demo/dashboard
  if (pathname === "/demo" || pathname === "/demo/") {
    return <Navigate to="/demo/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NavBar />
      <div className="flex-1">
        <Routes>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="weeks" element={<WeeksPage />} />
          <Route path="swaps" element={<SwapsPage />} />
          <Route path="*" element={<Navigate to="/demo/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}`;
fs.writeFileSync(guestAppPath, guestAppContent, 'utf8');
console.log("   [+] GuestApp.tsx: переписан на реальные страницы в /demo/*");

// ==========================================
// 3. ПАТЧ CLIENT.TS (Подключаем guestAdapter)
// ==========================================
const clientPath = path.join(srcDir, 'api', 'client.ts');
if (fs.existsSync(clientPath)) {
  let content = fs.readFileSync(clientPath, 'utf8');
  
  // Удаляем старый громоздкий перехватчик
  const oldInterceptorRegex = /\/\/ ГОСТЕВОЙ ПЕРЕХВАТЧИК API \(100% без ошибок 401\)[\s\S]*?return config;\n\}\);/;
  
  const newInterceptor = `// ГОСТЕВОЙ ПЕРЕХВАТЧИК API (Используем guestAdapter)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const isDemo = window.location.pathname.startsWith('/demo') || localStorage.getItem("isGuest") === "true";
  const isInvalidToken = !token || token === "undefined" || token === "null" || token === "guest-mock";
  
  if (isInvalidToken && isDemo) {
    const url = config.url || "";
    // Auth-запросы (логин, регистрация) ВСЕГДА идут в реальную сеть, чтобы можно было выйти из демо
    if (!url.includes("/auth/")) {
      // Подменяем адаптер Axios на наш guestAdapter, который читает/пишет в localStorage
      config.adapter = guestAdapter;
    }
  }
  return config;
});`;

  // Импортируем адаптер
  if (!content.includes('import { guestAdapter }')) {
    content = content.replace(
      'import { GUEST_SEED } from "../lib/guestSeed";',
      'import { GUEST_SEED } from "../lib/guestSeed";\nimport { guestAdapter } from "./guestAdapter";'
    );
  }

  if (oldInterceptorRegex.test(content)) {
    content = content.replace(oldInterceptorRegex, newInterceptor);
  } else {
    // Если регулярка не сработала, просто добавляем в конец файла
    content += '\n' + newInterceptor;
  }
  
  fs.writeFileSync(clientPath, content, 'utf8');
  console.log("   [+] client.ts: заменен жесткий мок на guestAdapter (localStorage)");
}

// ==========================================
// 4. ПАТЧ NAVBAR.TSX (Префикс /demo и скрытие платных вкладок)
// ==========================================
const navBarPath = path.join(srcDir, 'components', 'NavBar.tsx');
if (fs.existsSync(navBarPath)) {
  let content = fs.readFileSync(navBarPath, 'utf8');

  // Определяем, что мы в демо
  if (!content.includes('const isDemo =')) {
    content = content.replace(
      'const { pathname } = useLocation();',
      'const { pathname } = useLocation();\n  const isDemo = pathname.startsWith("/demo");\n  const prefix = isDemo ? "/demo" : "";'
    );
  }

  // Скрываем платные вкладки для демо
  content = content.replace(
    '{ path: "/locations", label: "Точки", icon: MapPin },',
    '...(isDemo ? [] : [{ path: "/locations", label: "Точки", icon: MapPin }]),'
  );
  content = content.replace(
    '{ path: "/sick-leaves", label: "Больничные", icon: AlertCircle },',
    '...(isDemo ? [] : [{ path: "/sick-leaves", label: "Больничные", icon: AlertCircle }]),'
  );
  content = content.replace(
    '{ path: "/history", label: "История действий", icon: History },',
    '...(isDemo ? [] : [{ path: "/history", label: "История действий", icon: History }]),'
  );

  // Переопределяем навигацию (добавляем префикс)
  // 1. Логотип
  content = content.replace(/navigate\("\/dashboard"\)/g, 'navigate(prefix + "/dashboard")');
  
  // 2. Верхнее меню (категории)
  content = content.replace(
    'onClick={() => navigate(firstLink.path)}',
    'onClick={() => navigate(prefix + firstLink.path)}'
  );
  
  // 3. Подменю
  content = content.replace(
    'onClick={() => navigate(link.path)}',
    'onClick={() => navigate(prefix + link.path)}'
  );

  // 4. Скрываем кошелек и поддержку в демо
  content = content.replace(
    '{user?.role === "OWNER" && (',
    '{!isDemo && user?.role === "OWNER" && ('
  );
  content = content.replace(
    '{isAdminEmail(user?.email) && (',
    '{!isDemo && isAdminEmail(user?.email) && ('
  );

  // 5. Заменяем кнопку выхода/входа для демо
  content = content.replace(
    '<button onClick={handleLogout} className="flex items-center justify-center p-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Выйти">\n              <LogOut className="w-4 h-4" />\n            </button>',
    `{isDemo ? (
              <button onClick={() => navigate("/login?mode=register")} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
                Зарегистрироваться
              </button>
            ) : (
              <button onClick={handleLogout} className="flex items-center justify-center p-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Выйти">
                <LogOut className="w-4 h-4" />
              </button>
            )}`
  );

  fs.writeFileSync(navBarPath, content, 'utf8');
  console.log("   [+] NavBar.tsx: добавлен префикс /demo, скрыты платные вкладки");
}

// ==========================================
// 5. ОГРАНИЧЕНИЕ СОТРУДНИКОВ В USEGUESTMODE.TS
// ==========================================
const useGuestModePath = path.join(srcDir, 'hooks', 'useGuestMode.ts');
if (fs.existsSync(useGuestModePath)) {
  let content = fs.readFileSync(useGuestModePath, 'utf8');
  
  // Внедряем проверку лимита
  const oldAddEmployee = `const addGuestEmployee = (emp: any) => {\n    setGuestData((prev: any) => ({ ...prev, employees: [...prev.employees, emp] }));\n  };`;
  const newAddEmployee = `const addGuestEmployee = (emp: any) => {\n    setGuestData((prev: any) => {\n      if (prev.employees.length >= 3) {\n        alert("В демо-режиме можно добавить не более 3 сотрудников. Зарегистрируйтесь, чтобы снять ограничение!");\n        return prev;\n      }\n      return { ...prev, employees: [...prev.employees, emp] };\n    });\n  };`;

  if (content.includes('addGuestEmployee')) {
    content = content.replace(oldAddEmployee, newAddEmployee);
    fs.writeFileSync(useGuestModePath, content, 'utf8');
    console.log("   [+] useGuestMode.ts: добавлен лимит в 3 сотрудника");
  }
}

// ==========================================
// 6. ОБНОВЛЕНИЕ ROBOTS.TXT
// ==========================================
const robotsPath = path.join(__dirname, 'frontend', 'public', 'robots.txt');
if (fs.existsSync(robotsPath)) {
  let content = fs.readFileSync(robotsPath, 'utf8');
  if (!content.includes('Disallow: /demo')) {
    content += '\nUser-agent: *\nDisallow: /demo\n';
    fs.writeFileSync(robotsPath, content, 'utf8');
  }
  console.log("   [+] robots.txt: закрыта индексация /demo");
}

console.log("✅ УСПЕХ! Демо-режим полностью изолирован в /demo. Перезапустите сервер.");