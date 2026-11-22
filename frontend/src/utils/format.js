export function formatDuration(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
export function formatEta(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}
export function riskColor(risk) {
  return ({
    Low: "#22c55e", Moderate: "#eab308", High: "#f97316",
    Severe: "#ef4444", "No Travel": "#a855f7", Unknown: "#64748b",
  })[risk] || "#64748b";
}
export function formatRisk(risk) {
  return risk === "No Travel" ? "No travel" : risk || "Unknown";
}
