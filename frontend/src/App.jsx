import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  CalendarClock,
  ChevronDown,
  Compass,
  FileText,
  Info,
  LoaderCircle,
  Map,
  Navigation,
  Package,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import PlaceInput from "./components/PlaceInput";
import RouteMap from "./components/RouteMap";
import RouteCard from "./components/RouteCard";
import WeatherTimeline from "./components/WeatherTimeline";
import CheckpointList from "./components/CheckpointList";
import { planTrip, getHealth } from "./services/api";
import { formatDuration, formatEta, riskColor } from "./utils/format";

const defaultDeparture = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

// Preset freight test corridors for instant testing
const PRESETS = [
  {
    label: "Denver → Colorado Springs (I-25 Corridor)",
    origin: { name: "Denver, Colorado", longitude: -104.9903, latitude: 39.7392 },
    destination: { name: "Colorado Springs, Colorado", longitude: -104.8214, latitude: 38.8339 },
    load: "35000",
  },
  {
    label: "Chicago → Minneapolis (Midwest Winter Lane)",
    origin: { name: "Chicago, Illinois", longitude: -87.6298, latitude: 41.8781 },
    destination: { name: "Minneapolis, Minnesota", longitude: -93.265, latitude: 44.9778 },
    load: "42000",
  },
  {
    label: "Seattle → Portland (Pacific Northwest)",
    origin: { name: "Seattle, Washington", longitude: -122.3321, latitude: 47.6062 },
    destination: { name: "Portland, Oregon", longitude: -122.6784, latitude: 45.5152 },
    load: "28000",
  },
];

export default function App() {
  const [origin, setOrigin] = useState(PRESETS[0].origin);
  const [destination, setDestination] = useState(PRESETS[0].destination);
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState(PRESETS[0].load);
  const [interval, setInterval] = useState(25);
  const [routes, setRoutes] = useState([]);
  const [recommendedId, setRecommendedId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [forecastHour, setForecastHour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    getHealth()
      .then((health) => setApiStatus(health.mapbox_configured ? "ready" : "missing-token"))
      .catch(() => setApiStatus("offline"));
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedId) || routes[0],
    [routes, selectedId]
  );
  const recommendedRoute = useMemo(
    () => routes.find((route) => route.id === recommendedId),
    [routes, recommendedId]
  );

  const handlePlan = async (event) => {
    if (event) event.preventDefault();
    setError("");
    setNotice("");
    if (!origin || !destination) {
      setError("Choose both an origin and destination from search suggestions or presets.");
      return;
    }
    if (origin.longitude === destination.longitude && origin.latitude === destination.latitude) {
      setError("Origin and destination must be different.");
      return;
    }
    if (!departure) {
      setError("Choose a departure date and time.");
      return;
    }
    if (!Number.isFinite(Number(load)) || Number(load) < 0) {
      setError("Enter a valid non-negative load weight.");
      return;
    }

    try {
      setLoading(true);
      const departureWithOffset = new Date(departure).toISOString();
      const result = await planTrip({
        origin,
        destination,
        departure: departureWithOffset,
        load_weight_lb: Number(load),
        checkpoint_interval_miles: interval,
      });

      setRoutes(result.routes || []);
      setRecommendedId(result.recommended_route_id);
      setSelectedId(result.recommended_route_id);
      setHeatmap(result.heatmap || []);
      setForecastHour(0);
      setNotice(result.notice || "");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to plan route.");
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = useCallback((id) => setSelectedId(id), []);
  const swapPlaces = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setLoad(preset.load);
  };

  const apiLabel =
    apiStatus === "ready"
      ? "API connected"
      : apiStatus === "missing-token"
      ? "Mapbox backend token missing"
      : apiStatus === "offline"
      ? "Backend offline"
      : "Checking API...";

  return (
    <div className="min-h-screen bg-[#081321] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0b192a]/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3.5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20">
              <Truck size={22} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                spotter<span className="text-cyan-400">.</span>ai
              </p>
              <p className="text-[10px] uppercase font-bold tracking-[.2em] text-slate-400">
                Weather-Aware Truck Routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white transition"
            >
              <Info size={14} className="text-cyan-300" />
              <span>Risk Rules</span>
            </button>

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiStatus === "ready"
                    ? "bg-emerald-400 animate-pulse"
                    : apiStatus === "offline"
                    ? "bg-rose-400"
                    : "bg-amber-400"
                }`}
              />
              {apiLabel}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-7 flex-1 w-full">
        {/* Banner */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
              <Activity size={14} /> Fleet Weather Routing System
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Weather-Aware Dispatch & Routing
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
              Evaluates up to 3 driving routes with ETA-synchronized weather forecasts, weight-dependent wind risk, and an interactive 0–48h trip corridor heatmap.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles size={13} className="text-cyan-300" /> Test Corridors:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-white transition"
              >
                {p.label.split(" (")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left Sidebar: Controls & Route Options */}
          <aside className="space-y-4">
            <form
              onSubmit={handlePlan}
              className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-xl shadow-black/20"
            >
              <div className="mb-4 flex items-center gap-2.5">
                <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
                  <Compass size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">Trip Configuration</h2>
                  <p className="text-xs text-slate-400">Truck parameters & corridor sampling</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <PlaceInput
                  label="Origin"
                  value={origin}
                  onChange={setOrigin}
                  placeholder="City, state or address"
                  icon={Navigation}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={swapPlaces}
                    className="flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition"
                  >
                    <ArrowDownUp size={12} /> Swap locations
                  </button>
                </div>

                <PlaceInput
                  label="Destination"
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where is the load headed?"
                  icon={Map}
                />

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[.12em] text-slate-400">
                    Departure Date & Time
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5">
                    <CalendarClock size={16} className="text-cyan-300 shrink-0" />
                    <input
                      type="datetime-local"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-[.12em] text-slate-400">
                      Load Weight (lb)
                    </label>
                    <span className="text-[11px] text-cyan-300 font-medium">
                      {Number(load) > 40000 ? "Heavy Load (>40k)" : Number(load) > 30000 ? "Medium Load (>30k)" : "Standard Load"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5">
                    <Package size={16} className="text-cyan-300 shrink-0" />
                    <input
                      type="number"
                      min="0"
                      max="200000"
                      value={load}
                      onChange={(e) => setLoad(e.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none"
                      placeholder="25000"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    35–44 mph wind + &gt;40k lb $\rightarrow$ Severe; 45–54 mph + &gt;30k lb $\rightarrow$ No Travel.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[.12em] text-slate-400">
                    Weather Checkpoint Interval
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 25, 50].map((miles) => (
                      <button
                        type="button"
                        key={miles}
                        onClick={() => setInterval(miles)}
                        className={`rounded-xl border py-2 text-xs font-bold transition ${
                          interval === miles
                            ? "border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-sm shadow-cyan-400/20"
                            : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        {miles} miles
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                    <AlertTriangle size={14} className="mr-1 inline text-rose-400" />
                    {error}
                  </div>
                )}

                <button
                  disabled={loading}
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-cyan-400/25 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Analyzing weather along corridors…
                    </>
                  ) : (
                    <>
                      <Zap size={17} />
                      Calculate Safest Routes
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Route Options List */}
            {routes.length > 0 && (
              <section className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-xl shadow-black/20">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-white text-base">Route Alternatives</h2>
                    <p className="text-xs text-slate-400">
                      Ranked by Severe $\rightarrow$ High $\rightarrow$ Avg Risk $\rightarrow$ Duration
                    </p>
                  </div>
                  <Route size={18} className="text-cyan-300" />
                </div>

                <div className="space-y-2.5">
                  {routes.map((route, index) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      index={index}
                      selected={selectedRoute?.id === route.id}
                      onClick={() => selectRoute(route.id)}
                    />
                  ))}
                </div>

                {notice && (
                  <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                    {notice}
                  </p>
                )}
              </section>
            )}
          </aside>

          {/* Right Area: Interactive Map, Weather Heatmap & Checkpoint List */}
          <section className="min-w-0 space-y-4">
            {/* Map Container */}
            <div className="relative h-[480px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 md:h-[580px] shadow-2xl shadow-black/30">
              <RouteMap
                routes={routes}
                selectedRouteId={selectedRoute?.id}
                onSelectRoute={selectRoute}
                heatmap={heatmap}
                forecastHour={forecastHour}
              />

              {routes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xs">
                  <div className="rounded-2xl border border-slate-700 bg-[#0b192a]/95 px-6 py-5 text-center shadow-2xl max-w-md">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                      <Route size={24} />
                    </div>
                    <p className="text-base font-bold text-white">Route Map & Weather Corridor</p>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      Select an origin, destination, load weight, and click <b>Calculate Safest Routes</b> to visualize route options and weather corridor heatmap.
                    </p>
                  </div>
                </div>
              )}

              {selectedRoute && (
                <div className="absolute left-4 top-4 rounded-xl border border-slate-700 bg-[#0b192a]/95 p-3.5 backdrop-blur shadow-xl">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Active Route
                  </p>
                  <p className="mt-0.5 text-base font-black text-white">{selectedRoute.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedRoute.distance_miles} mi · {formatDuration(selectedRoute.duration)}
                  </p>
                </div>
              )}
            </div>

            {/* Recommendation Summary Cards */}
            {recommendedRoute && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-lg shadow-black/20">
                  <p className="text-xs text-slate-400">Recommended Route</p>
                  <p className="mt-1 text-xl font-black text-emerald-300">{recommendedRoute.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Safest route meeting all preference rules
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-lg shadow-black/20">
                  <p className="text-xs text-slate-400">Estimated Arrival (Origin ETA)</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {formatEta(
                      new Date(
                        new Date(recommendedRoute.checkpoints?.[0]?.arrival_time || Date.now()).getTime() +
                          recommendedRoute.duration * 1000
                      ).toISOString()
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDuration(recommendedRoute.duration)} driving duration
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-lg shadow-black/20">
                  <p className="text-xs text-slate-400">Corridor Risk Exposure</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {recommendedRoute.summary.severe_miles} mi Severe
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {recommendedRoute.summary.high_miles} mi High · Avg Risk: {recommendedRoute.summary.average_risk}/4
                  </p>
                </div>
              </div>
            )}

            {/* 0-48 Hour Forecast Slider & Heatmap Simulation */}
            {routes.length > 0 && (
              <WeatherTimeline
                hour={forecastHour}
                onChange={setForecastHour}
                heatmap={heatmap}
              />
            )}

            {/* Detailed Checkpoint Weather Analysis Drawer */}
            {selectedRoute && (
              <section className="rounded-2xl border border-slate-800 bg-[#0d1b2c] p-4 shadow-xl shadow-black/20">
                <button
                  type="button"
                  onClick={() => setShowCheckpoints(!showCheckpoints)}
                  className="flex w-full items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <h3 className="font-bold text-white text-base">Checkpoint Weather Analysis</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {selectedRoute.checkpoints.length} sampled checkpoints ({interval}-mile interval)
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-400 transition-transform ${
                      showCheckpoints ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showCheckpoints && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <CheckpointList route={selectedRoute} interval={interval} />
                  </div>
                )}
              </section>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-800 py-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <p>
            Spotter AI — Weather-Aware Truck Routing Assessment Prototype.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setShowRulesModal(true)}
              className="hover:text-cyan-300 transition"
            >
              Assessment Risk Rules Table
            </button>
            <span>•</span>
            <span>Mapbox & Open-Meteo APIs</span>
          </div>
        </footer>
      </main>

      {/* Assessment Risk Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0b192a] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-cyan-300" size={20} />
                <h3 className="text-lg font-bold text-white">Assessment Weather Risk Rules</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-300">
              <p>Classification thresholds at each checkpoint:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Condition</th>
                      <th className="p-2.5 text-emerald-400">Low</th>
                      <th className="p-2.5 text-yellow-400">Moderate</th>
                      <th className="p-2.5 text-orange-400">High</th>
                      <th className="p-2.5 text-rose-400">Severe</th>
                      <th className="p-2.5 text-purple-400">No Travel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr>
                      <td className="p-2.5 font-bold text-white">Wind</td>
                      <td className="p-2.5">&lt;25 mph</td>
                      <td className="p-2.5">25–34 mph</td>
                      <td className="p-2.5">35–44 mph</td>
                      <td className="p-2.5">45–54 mph</td>
                      <td className="p-2.5">&ge;55 mph</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-white">Rain</td>
                      <td className="p-2.5">&lt;0.10 in/hr</td>
                      <td className="p-2.5">0.10–0.25 in/hr</td>
                      <td className="p-2.5">0.25–0.50 in/hr</td>
                      <td className="p-2.5">0.50–1.00 in/hr</td>
                      <td className="p-2.5">&gt;1.00 in/hr</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-white">Snow</td>
                      <td className="p-2.5">&lt;0.5 in/hr</td>
                      <td className="p-2.5">0.5–1.0 in/hr</td>
                      <td className="p-2.5">1.0–2.0 in/hr</td>
                      <td className="p-2.5">2.0–3.0 in/hr</td>
                      <td className="p-2.5">&gt;3.0 in/hr</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="font-bold text-cyan-300 mb-1">Truck Load Weight Rules:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><b className="text-white">&ge;55 mph wind</b> $\rightarrow$ <b>No Travel</b> for any load</li>
                  <li><b className="text-white">45–54 mph wind + &gt;30,000 lb</b> $\rightarrow$ <b>No Travel</b></li>
                  <li><b className="text-white">35–44 mph wind + &gt;40,000 lb</b> $\rightarrow$ <b>Severe</b></li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="font-bold text-cyan-300 mb-1">Route Recommendation Preference Order:</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Fewest Severe miles (with No Travel prioritized)</li>
                  <li>Fewest High miles</li>
                  <li>Lowest average risk</li>
                  <li>Shortest travel times</li>
                </ol>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
