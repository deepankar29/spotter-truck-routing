import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Flame, Eye, EyeOff, Layers, Maximize2 } from "lucide-react";
import { riskColor } from "../utils/format";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function RouteMap({
  routes = [],
  selectedRouteId,
  onSelectRoute,
  heatmap = [],
  forecastHour = 0,
}) {
  const container = useRef(null);
  const map = useRef(null);
  const popup = useRef(null);

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState("risk"); // "risk" | "wind" | "rain"
  const [inspectMode, setInspectMode] = useState("eta"); // "eta" | "slider"

  // 1. Initialize Map
  useEffect(() => {
    if (!container.current || map.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;

    const instance = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.5, 39.5],
      zoom: 3.5,
      attributionControl: true,
    });

    instance.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    instance.on("load", () => {
      instance.resize();
    });

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  // 2. Render Route Lines
  useEffect(() => {
    const instance = map.current;
    if (!instance || !routes.length) return;

    const drawRoutes = () => {
      // Remove previous route layers and sources
      for (let i = 0; i < 5; i++) {
        const lineLayer = `route-line-${i}`;
        const casingLayer = `route-casing-${i}`;
        const sourceId = `route-source-${i}`;
        if (instance.getLayer(lineLayer)) instance.removeLayer(lineLayer);
        if (instance.getLayer(casingLayer)) instance.removeLayer(casingLayer);
        if (instance.getSource(sourceId)) instance.removeSource(sourceId);
      }

      routes.forEach((route, index) => {
        const sourceId = `route-source-${index}`;
        const casingLayer = `route-casing-${index}`;
        const lineLayer = `route-line-${index}`;
        const isSelected = route.id === selectedRouteId;

        instance.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", properties: { id: route.id, name: route.name }, geometry: route.geometry },
        });

        // Subtle glow / casing for selected route
        instance.addLayer({
          id: casingLayer,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": isSelected ? "#06b6d4" : "rgba(0,0,0,0)",
            "line-width": isSelected ? 10 : 0,
            "line-opacity": isSelected ? 0.35 : 0,
            "line-blur": isSelected ? 3 : 0,
          },
        });

        const routeColors = ["#64748b", "#818cf8", "#38bdf8"];
        instance.addLayer({
          id: lineLayer,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": isSelected ? "#22d3ee" : routeColors[index % routeColors.length],
            "line-width": isSelected ? 5.5 : 3,
            "line-opacity": isSelected ? 1.0 : 0.6,
          },
        });

        instance.on("click", lineLayer, () => onSelectRoute(route.id));
        instance.on("mouseenter", lineLayer, () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", lineLayer, () => {
          instance.getCanvas().style.cursor = "";
        });
      });

      // Fit map to selected route
      const selected = routes.find((r) => r.id === selectedRouteId) || routes[0];
      if (selected?.geometry?.coordinates?.length) {
        const coords = selected.geometry.coordinates;
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        instance.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 600 });
      }
    };

    if (instance.isStyleLoaded()) {
      drawRoutes();
    } else {
      instance.once("load", drawRoutes);
    }
  }, [routes, selectedRouteId, onSelectRoute]);

  // 3. Render True Mapbox Heatmap Along Corridor
  useEffect(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;

    const sourceId = "corridor-heatmap-source";
    const layerId = "corridor-weather-heatmap";

    if (!showHeatmap || !heatmap?.length) {
      if (instance.getLayer(layerId)) instance.removeLayer(layerId);
      if (instance.getSource(sourceId)) instance.removeSource(sourceId);
      return;
    }

    // Build corridor GeoJSON using forecastHour
    const hour = Math.min(48, Math.max(0, forecastHour));
    const features = heatmap.map((pt) => {
      const dataAtHour = pt.hourly?.[hour] || pt.hourly?.[0] || {};
      const score = Number(dataAtHour.risk_score ?? 0);
      const wind = Number(dataAtHour.wind_mph ?? 0);
      const rain = Number(dataAtHour.rain_in_hr ?? 0);

      // Weight according to chosen metric mode
      let weight = score / 4.0;
      if (heatmapMode === "wind") {
        weight = Math.min(1.0, wind / 60.0);
      } else if (heatmapMode === "rain") {
        weight = Math.min(1.0, rain / 1.0);
      }

      return {
        type: "Feature",
        properties: {
          weight: Math.max(0.1, weight),
          risk_score: score,
          wind_mph: wind,
          rain_in_hr: rain,
        },
        geometry: {
          type: "Point",
          coordinates: [pt.longitude, pt.latitude],
        },
      };
    });

    const geojsonData = { type: "FeatureCollection", features };

    if (instance.getSource(sourceId)) {
      instance.getSource(sourceId).setData(geojsonData);
    } else {
      instance.addSource(sourceId, {
        type: "geojson",
        data: geojsonData,
      });

      // Find first route layer to place heatmap underneath routes
      const beforeLayer = instance.getLayer("route-casing-0") ? "route-casing-0" : undefined;

      instance.addLayer(
        {
          id: layerId,
          type: "heatmap",
          source: sourceId,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 0.5, 0.5, 1, 1],
            "heatmap-intensity": [
              "interpolate", ["linear"], ["zoom"],
              0, 0.7,
              4, 1.2,
              7, 2.0,
              11, 3.0,
            ],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0, 0, 0, 0)",
              0.15, "rgba(34, 197, 94, 0.35)",  // Low: Emerald
              0.35, "rgba(234, 179, 8, 0.55)",  // Moderate: Yellow
              0.55, "rgba(249, 115, 22, 0.75)", // High: Orange
              0.75, "rgba(239, 68, 68, 0.85)",  // Severe: Red
              1.0,  "rgba(168, 85, 247, 0.95)", // No Travel: Purple
            ],
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"],
              2, 22,
              5, 38,
              8, 55,
              11, 75,
            ],
            "heatmap-opacity": 0.75,
          },
        },
        beforeLayer
      );
    }
  }, [heatmap, forecastHour, showHeatmap, heatmapMode]);

  // 4. Render Interactive Checkpoint Markers
  useEffect(() => {
    const instance = map.current;
    if (!instance || !routes.length || !instance.isStyleLoaded()) return;

    const selected = routes.find((r) => r.id === selectedRouteId) || routes[0];
    const sourceId = "checkpoint-markers-source";
    const layerId = "checkpoint-circles-layer";
    const haloLayerId = "checkpoint-halos-layer";

    const hour = Math.min(48, Math.max(0, forecastHour));

    const features = (selected.checkpoints || []).map((point) => {
      // Find matching hourly corridor entry for this point
      const corridorEntry = heatmap.find(
        (h) => Math.abs(h.latitude - point.latitude) < 0.08 && Math.abs(h.longitude - point.longitude) < 0.08
      );
      const forecastAtHour = corridorEntry?.hourly?.[hour];

      // Determine active display risk based on inspectMode
      const activeRisk = inspectMode === "slider" && forecastAtHour
        ? forecastAtHour.risk
        : point.risk;

      const activeColor = riskColor(activeRisk);

      return {
        type: "Feature",
        properties: {
          id: point.id,
          distance_miles: point.distance_miles,
          arrival_time: point.arrival_time,
          eta_risk: point.risk,
          eta_wind: point.wind_mph,
          eta_rain: point.rain_in_hr,
          eta_snow: point.snow_in_hr,
          eta_reason: point.reasons?.[0] || "No alert",
          slider_risk: forecastAtHour?.risk || point.risk,
          slider_wind: forecastAtHour?.wind_mph ?? point.wind_mph,
          slider_rain: forecastAtHour?.rain_in_hr ?? point.rain_in_hr,
          slider_snow: forecastAtHour?.snow_in_hr ?? point.snow_in_hr,
          slider_reason: forecastAtHour?.reasons?.[0] || "No alert",
          active_risk: activeRisk,
          color: activeColor,
        },
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
      };
    });

    const geojsonData = { type: "FeatureCollection", features };

    if (instance.getSource(sourceId)) {
      instance.getSource(sourceId).setData(geojsonData);
    } else {
      instance.addSource(sourceId, { type: "geojson", data: geojsonData });

      // Outer halo for high/severe alerts
      instance.addLayer({
        id: haloLayerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": [
            "match",
            ["get", "active_risk"],
            "Severe", 12,
            "No Travel", 14,
            "High", 10,
            8
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.25,
        },
      });

      // Checkpoint core circle
      instance.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 6.5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#081321",
        },
      });

      // Tooltip Popup on Click
      instance.on("click", layerId, (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;

        popup.current?.remove();

        const arrivalFormatted = p.arrival_time
          ? new Date(p.arrival_time).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
          : "—";

        const html = `
          <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;min-width:210px;padding:2px 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:700;color:#0f172a;">Mile ${p.distance_miles}</span>
              <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;background:${p.color}20;color:${p.color};">${p.active_risk}</span>
            </div>
            <div style="font-size:11px;color:#475569;line-height:1.45;">
              <div><b>Arrival ETA:</b> ${arrivalFormatted}</div>
              <div><b>ETA Weather:</b> ${p.eta_wind ?? "—"} mph wind · ${p.eta_rain ?? "—"} in rain</div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px dashed #cbd5e1;font-size:10px;color:#64748b;">
                <b>Forecast (T+${hour}h):</b> ${p.slider_wind ?? "—"} mph · ${p.slider_rain ?? "—"} in/hr (${p.slider_risk})
              </div>
              <div style="margin-top:4px;font-size:10px;color:#0284c7;">
                ${p.eta_reason}
              </div>
            </div>
          </div>
        `;

        popup.current = new mapboxgl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(instance);
      });

      instance.on("mouseenter", layerId, () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", layerId, () => {
        instance.getCanvas().style.cursor = "";
      });
    }
  }, [routes, selectedRouteId, heatmap, forecastHour, inspectMode]);

  // Fallback if token missing
  if (!TOKEN) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <div>
          <p className="font-semibold text-white">Mapbox Public Token Required</p>
          <p className="mt-2 text-sm text-slate-400">
            Set <code className="text-cyan-300">VITE_MAPBOX_ACCESS_TOKEN</code> in frontend/.env.
          </p>
        </div>
      </div>
    );
  }

  const fitActiveRoute = () => {
    const instance = map.current;
    if (!instance || !routes.length) return;
    const selected = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (selected?.geometry?.coordinates?.length) {
      const coords = selected.geometry.coordinates;
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      instance.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 600 });
    }
  };

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl">
      <div ref={container} className="h-full w-full" />

      {/* Top Map Controls Floating Bar */}
      <div className="absolute right-3 top-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-[#0b192a]/90 p-1.5 backdrop-blur z-10 text-xs">
        {/* Toggle Heatmap */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          title="Toggle corridor weather heatmap"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition ${
            showHeatmap
              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Flame size={14} className={showHeatmap ? "text-cyan-300" : "text-slate-400"} />
          Heatmap {showHeatmap ? "ON" : "OFF"}
        </button>

        {showHeatmap && (
          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700">
            <button
              onClick={() => setHeatmapMode("risk")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                heatmapMode === "risk" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Risk
            </button>
            <button
              onClick={() => setHeatmapMode("wind")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                heatmapMode === "wind" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Wind
            </button>
            <button
              onClick={() => setHeatmapMode("rain")}
              className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                heatmapMode === "rain" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Rain
            </button>
          </div>
        )}

        {/* Checkpoint Inspection Mode */}
        <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-700">
          <button
            onClick={() => setInspectMode("eta")}
            title="Color checkpoints based on ETA arrival time"
            className={`rounded px-2 py-1 text-[11px] font-medium transition ${
              inspectMode === "eta" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            ETA Time
          </button>
          <button
            onClick={() => setInspectMode("slider")}
            title="Color checkpoints based on 0-48h slider"
            className={`rounded px-2 py-1 text-[11px] font-medium transition ${
              inspectMode === "slider" ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            Slider (T+{forecastHour}h)
          </button>
        </div>

        {/* Re-center Button */}
        <button
          onClick={fitActiveRoute}
          title="Center on active route"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Map Legend (Bottom Right) */}
      <div className="absolute bottom-3 right-3 rounded-xl border border-slate-700 bg-[#0b192a]/90 p-2.5 backdrop-blur z-10 text-[11px]">
        <p className="mb-1.5 font-semibold text-slate-300">Weather Risk</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-slate-400">Mod</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="text-slate-400">High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-slate-400">Severe</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-slate-400">No Travel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
