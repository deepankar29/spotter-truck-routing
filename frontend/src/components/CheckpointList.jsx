import { useState } from "react";
import { AlertTriangle, Clock3, Filter, MapPin, Snowflake, Wind, CloudRain, CheckCircle2 } from "lucide-react";
import { formatEta, riskColor } from "../utils/format";

export default function CheckpointList({ route, interval = 25 }) {
  const [filter, setFilter] = useState("all"); // "all" | "alerts" | "severe"

  if (!route || !route.checkpoints?.length) return null;

  const filtered = route.checkpoints.filter((pt) => {
    if (filter === "alerts") return pt.risk !== "Low";
    if (filter === "severe") return pt.risk === "Severe" || pt.risk === "No Travel" || pt.risk === "High";
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Filter size={13} />
          <span>Showing {filtered.length} of {route.checkpoints.length} points ({interval} mi interval)</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "all" ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("alerts")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "alerts" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            Alerts (Mod+)
          </button>
          <button
            type="button"
            onClick={() => setFilter("severe")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "severe" ? "bg-rose-500 text-white font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            High / Severe
          </button>
        </div>
      </div>

      {/* Grid of Checkpoint Cards */}
      <div className="grid gap-2.5 max-h-[460px] overflow-y-auto pr-1 md:grid-cols-2">
        {filtered.map((point) => {
          const color = riskColor(point.risk);
          return (
            <div
              key={point.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 transition hover:border-slate-700 hover:bg-slate-900/90"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="font-semibold text-white text-sm">
                      Mile {point.distance_miles}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({point.segment_miles} mi span)
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={11} className="text-cyan-300" />
                    ETA: {formatEta(point.arrival_time)}
                  </p>
                </div>

                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                  style={{
                    background: `${color}18`,
                    color: color,
                    border: `1px solid ${color}40`,
                  }}
                >
                  {point.risk}
                </span>
              </div>

              {/* Weather Stats */}
              {point.weather_available ? (
                <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-950/50 p-2 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-300">
                    <Wind size={12} className="text-cyan-300" />
                    <span>{point.wind_mph} mph</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <CloudRain size={12} className="text-sky-300" />
                    <span>{point.rain_in_hr} in/h</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-300">
                    <Snowflake size={12} className="text-indigo-300" />
                    <span>{point.snow_in_hr} in/h</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
                  <AlertTriangle size={13} />
                  <span>Forecast outside horizon</span>
                </div>
              )}

              {/* Reason / governing rule */}
              {point.reasons?.[0] && (
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  {point.reasons[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
