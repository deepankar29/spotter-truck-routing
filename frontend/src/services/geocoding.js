const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export async function searchPlaces(query) {
  if (!TOKEN) throw new Error("Add your Mapbox public token to frontend/.env.");
  if (!query || query.trim().length < 3) return [];
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");
  url.searchParams.set("types", "place,locality,postcode,address");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Place search failed. Check your Mapbox token.");
  const data = await response.json();
  return (data.features || []).map((feature) => ({
    id: feature.id,
    name: feature.place_name,
    longitude: feature.center[0],
    latitude: feature.center[1],
  }));
}
