import { Clock3, MapPin, ShieldCheck, ShieldAlert, Award } from "lucide-react";
import { formatDuration, riskColor } from "../utils/format";

export default function RouteCard({ route, selected, onClick, index }) {
  const s = route.summary || {};
  const worst = route.checkpoints?.reduce((best, p) => {
    const order = ["Low", "Moderate", "High", "Severe", "No Travel", "Unknown"];
    return order.indexOf(p.risk) > order.indexOf(best) ? p.risk : best;
  }, "Low") || "Unknown";

  const color = riskColor(worst);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400"
          : "border-slate-800 bg-[#0d1b2c] hover:border-slate-700 hover:bg-slate-900/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
              selected ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}
          >
            {index + 1}
          </span>
          <div>
            <span className="font-bold text-white text-base">{route.name}</span>
            {route.is_recommended && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                <Award size={11} />
                Recommended
              </span>
            )}
          </div>
        </div>

        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}40`,
          }}
        >
          {worst} max
        </span>
      </div>

      {/* Primary Metrics */}
      <div className="mt-3.5 grid grid-cols-2 gap-3 border-y border-slate-800/80 py-2.5">
        <div>
          <p className="text-[11px] text-slate-400">Total Distance</p>
          <p className="mt-0.5 text-base font-bold text-white">
            {route.distance_miles} <span className="text-xs font-normal text-slate-400">mi</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Driving Time</p>
          <p className="mt-0.5 text-base font-bold text-white">
            {formatDuration(route.duration)}
          </p>
        </div>
      </div>

      {/* Risk Exposure Details */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {s.no_travel_miles > 0 && (
          <span className="rounded-lg bg-purple-500/20 px-2 py-1 text-purple-300 font-semibold border border-purple-500/30">
            No Travel: {s.no_travel_miles} mi
          </span>
        )}
        <span className="rounded-lg bg-slate-800/90 px-2 py-1 text-slate-300 font-medium">
          Severe: <b className="text-white">{s.severe_miles} mi</b>
        </span>
        <span className="rounded-lg bg-slate-800/90 px-2 py-1 text-slate-300 font-medium">
          High: <b className="text-white">{s.high_miles} mi</b>
        </span>
        <span className="rounded-lg bg-slate-800/90 px-2 py-1 text-slate-400 font-medium">
          Avg Risk: <b className="text-cyan-300">{s.average_risk}</b>/4
        </span>
      </div>
    </button>
  );
}
