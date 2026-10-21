import { useState, useEffect } from "react";
import { ChevronDown, MapPin, Check } from "lucide-react";
import { useLocations } from "../store/locations";

export default function LocationSwitcher() {
  const { items, activeLocationId, setActive, fetch } = useLocations();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) fetch();
  }, [items.length, fetch]);

  if (items.length <= 1) return null;

  const active = items.find((l) => l.id === activeLocationId) ?? items[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5 text-brand-600" />
        <span className="font-medium text-slate-900 max-w-[180px] truncate">{active.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 animate-fade-in">
            {items.map((loc) => (
              <button
                key={loc.id}
                onClick={() => { setActive(loc.id); setOpen(false); }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{loc.name}</div>
                  {loc.city && <div className="text-xs text-slate-500 truncate">{loc.city}</div>}
                </div>
                {active.id === loc.id && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}