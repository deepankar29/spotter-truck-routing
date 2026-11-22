import datetime
import math
import requests
from django.conf import settings

MILES_PER_METER = 0.000621371
MAPBOX_DIRECTIONS = "https://api.mapbox.com/directions/v5/mapbox/driving"

def haversine_miles(a: list, b: list) -> float:
    """Calculate great circle distance between two [lon, lat] points in miles."""
    radius = 3958.7613  # Earth radius in miles
    lat1, lon1 = math.radians(a[1]), math.radians(a[0])
    lat2, lon2 = math.radians(b[1]), math.radians(b[0])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2.0) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    return 2.0 * radius * math.asin(math.sqrt(max(0.0, min(1.0, h))))

def cumulative_distances(coords: list) -> list:
    """Calculate cumulative distance array along a coordinate sequence."""
    cumulative = [0.0]
    for i in range(1, len(coords)):
        cumulative.append(cumulative[-1] + haversine_miles(coords[i - 1], coords[i]))
    return cumulative

def interpolate_at_distance(coords: list, cumulative: list, target: float) -> list:
    """Interpolate coordinates [lon, lat] at target cumulative distance."""
    if target <= 0 or not coords:
        return coords[0]
    if target >= cumulative[-1]:
        return coords[-1]
    for i in range(1, len(cumulative)):
        if cumulative[i] >= target:
            span = cumulative[i] - cumulative[i - 1]
            ratio = (target - cumulative[i - 1]) / span if span > 0 else 0.0
            return [
                coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * ratio,
                coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * ratio,
            ]
    return coords[-1]

def make_checkpoints(route: dict, departure: datetime.datetime, interval_miles: float) -> tuple:
    """
    Generate checkpoints every interval_miles along the route geometry.
    Computes representative segment miles using Voronoi midpoint partitioning so all
    checkpoints (including origin at distance 0) are weighted proportionally.
    """
    coords = route["geometry"]["coordinates"]
    cumulative = cumulative_distances(coords)
    total_miles = cumulative[-1]
    duration = float(route["duration"])

    distances = [0.0]
    current = float(interval_miles)
    while current < total_miles:
        distances.append(current)
        current += interval_miles
    if total_miles > 0 and (not distances or total_miles - distances[-1] > 0.1):
        distances.append(total_miles)

    n = len(distances)
    segments = []
    if n == 1:
        segments = [total_miles]
    else:
        # Voronoi mid-point boundaries ensure sum(segments) == total_miles
        segments.append((distances[1] - distances[0]) / 2.0)
        for i in range(1, n - 1):
            segments.append((distances[i + 1] - distances[i - 1]) / 2.0)
        segments.append((distances[-1] - distances[-2]) / 2.0)

    checkpoints = []
    for index, (distance, seg) in enumerate(zip(distances, segments)):
        coordinate = interpolate_at_distance(coords, cumulative, distance)
        ratio = distance / total_miles if total_miles > 0 else 0.0
        arrival = departure + datetime.timedelta(seconds=duration * ratio)
        checkpoints.append({
            "id": index,
            "distance_miles": round(distance, 1),
            "segment_miles": round(seg, 2),
            "longitude": coordinate[0],
            "latitude": coordinate[1],
            "arrival_datetime": arrival,
            "arrival_time": arrival.isoformat(),
        })

    return checkpoints, total_miles

def get_routes(origin: dict, destination: dict) -> list:
    """Fetch up to 3 driving routes between origin and destination from Mapbox Directions."""
    token = settings.MAPBOX_ACCESS_TOKEN
    if not token:
        raise ValueError("MAPBOX_ACCESS_TOKEN is missing in backend/.env")

    coordinates = f"{origin['longitude']},{origin['latitude']};{destination['longitude']},{destination['latitude']}"
    params = {
        "alternatives": "true",
        "geometries": "geojson",
        "overview": "full",
        "steps": "false",
        "access_token": token,
    }
    response = requests.get(f"{MAPBOX_DIRECTIONS}/{coordinates}", params=params, timeout=25)
    response.raise_for_status()
    data = response.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(data.get("message", "Mapbox could not find a route between these locations."))

    routes = []
    for index, route in enumerate(data["routes"][:3]):
        routes.append({
            "id": f"route-{index + 1}",
            "name": f"Route {index + 1}",
            "geometry": route["geometry"],
            "distance_meters": route["distance"],
            "distance_miles": round(route["distance"] * MILES_PER_METER, 1),
            "duration": route["duration"],
            "duration_minutes": round(route["duration"] / 60),
        })

    return routes
