import { ReactNode } from "react";
import LandingHeader from "./LandingHeader";
import LandingFooter from "./LandingFooter";

export default function PublicPageLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <LandingHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8">{title}</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
          <div className="space-y-4 text-slate-600 leading-relaxed text-sm sm:text-base">
            {children}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}