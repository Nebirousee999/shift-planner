import { useEffect, useRef, useState } from "react";

export default function LazySection({ children, height = "400px" }: { children: React.ReactNode, height?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" } // Начинаем загрузку за 400px до появления на экране
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return <div ref={ref} style={{ minHeight: height }} className="w-full flex items-center justify-center text-slate-300 bg-slate-50/50 rounded-2xl border border-slate-100/50">Загрузка...</div>;
  }

  return <div ref={ref}>{children}</div>;
}
