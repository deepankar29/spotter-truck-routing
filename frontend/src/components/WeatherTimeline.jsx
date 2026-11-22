import { useEffect, useState } from "react";
import { CloudRain, Pause, Play, RotateCcw, Snowflake, Wind, ShieldAlert } from "lucide-react";
import { riskColor } from "../utils/format";

export default function WeatherTimeline({ hour, onChange, heatmap = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play loop for 0-48h forecast
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      onChange((prev) => (prev >= 48 ? 0 : prev + 1));
    }, 400);
    return () => clearInterval(timer);
  }, [isPlaying, onChange]);

  const valuesAtHour = heatmap
    .map((point) => point.hourly?.[hour])
    .filter(Boolean);

  const avg = (key) =>
    valuesAtHour.length
      ? (valuesAtHour.reduce((sum, item) => sum + Number(item[key] || 0), 0) / valuesAtHour.length).toFixed(1)
      : "—";

  // Identify highest risk along corridor at this hour
  const worstRiskAtHour = valuesAtHour.reduce((highest, item) => {
    const order = ["Low", "Moderate", "High", "Severe", "No Travel"];
    return order.indexOf(item.risk) > order.indexOf(highest) ? item.risk : highest;
  }, "Low");

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-lg shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-base">Weather Corridor Forecast</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: `${riskColor(worstRiskAtHour)}20`,
                color: riskColor(worstRiskAtHour),
                border: `1px solid ${riskColor(worstRiskAtHour)}40`,
              }}
            >
              Peak: {worstRiskAtHour}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Hourly simulation along the trip corridor (0–48 hours)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Play / Pause Animation button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              isPlaying
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30"
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            {isPlaying ? "Pause" : "Play Loop"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              onChange(0);
            }}
            title="Reset to Departure / Hour 0"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white transition"
          >
            <RotateCcw size={14} />
          </button>

          <span className="rounded-lg bg-cyan-400/10 px-3 py-1.5 text-sm font-bold text-cyan-200 border border-cyan-400/20">
            T + {hour} hrs
          </span>
        </div>
      </div>

      {/* Slider */}
      <div className="mt-4">
        <input
          aria-label="0–48 Hour Forecast Slider"
          type="range"
          min="0"
          max="48"
          step="1"
          value={hour}
          onChange={(e) => {
            setIsPlaying(false);
            onChange(Number(e.target.value));
          }}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
        />
        <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
          <button type="button" onClick={() => onChange(0)} className="hover:text-cyan-300">Departure (0h)</button>
          <button type="button" onClick={() => onChange(12)} className="hover:text-cyan-300">12h</button>
          <button type="button" onClick={() => onChange(24)} className="hover:text-cyan-300">24h</button>
          <button type="button" onClick={() => onChange(36)} className="hover:text-cyan-300">36h</button>
          <button type="button" onClick={() => onChange(48)} className="hover:text-cyan-300">48h</button>
        </div>
      </div>

      {/* Corridor aggregate conditions at selected hour */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Wind size={15} className="text-cyan-300" />
            <span className="text-[11px]">Avg Wind</span>
          </div>
          <p className="mt-1.5 text-lg font-bold text-white">
            {avg("wind_mph")} <span className="text-xs font-normal text-slate-400">mph</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <CloudRain size={15} className="text-sky-300" />
            <span className="text-[11px]">Avg Rain</span>
          </div>
          <p className="mt-1.5 text-lg font-bold text-white">
            {avg("rain_in_hr")} <span className="text-xs font-normal text-slate-400">in/hr</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Snowflake size={15} className="text-indigo-300" />
            <span className="text-[11px]">Avg Snow</span>
          </div>
          <p className="mt-1.5 text-lg font-bold text-white">
            {avg("snow_in_hr")} <span className="text-xs font-normal text-slate-400">in/hr</span>
          </p>
        </div>
      </div>
    </section>
  );
}
