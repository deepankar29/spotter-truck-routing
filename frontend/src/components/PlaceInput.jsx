import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { searchPlaces } from "../services/geocoding";

export default function PlaceInput({ label, value, onChange, placeholder, icon: Icon = MapPin }) {
  const [query, setQuery] = useState(value?.name || "");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => { setQuery(value?.name || ""); }, [value?.name]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChange = (next) => {
    setQuery(next);
    onChange(null);
    setError("");
    clearTimeout(timer.current);
    if (next.trim().length < 3) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchPlaces(next);
        setOptions(results);
      } catch (err) {
        setError(err.message);
        setOptions([]);
      } finally { setLoading(false); }
    }, 350);
  };

  return (
    <div className="relative">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[.13em] text-slate-400">{label}</label>
      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 focus-within:border-cyan-400">
        <Icon size={17} className="shrink-0 text-cyan-300" />
        <input value={query} onChange={(e) => handleChange(e.target.value)} placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        {loading && <span className="text-xs text-slate-500">Searching…</span>}
        {query && <button type="button" onClick={() => { setQuery(""); setOptions([]); onChange(null); }} className="text-slate-500 hover:text-white"><X size={15}/></button>}
      </div>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      {options.length > 0 && !value && (
        <div className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
          {options.map((place) => <button key={place.id} type="button" onClick={() => { onChange(place); setQuery(place.name); setOptions([]); }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800">{place.name}</button>)}
        </div>
      )}
    </div>
  );
}
