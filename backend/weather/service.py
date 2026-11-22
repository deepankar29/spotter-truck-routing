import math
from datetime import datetime, timezone
import requests
from risk.engine import calculate_checkpoint_risk

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
KMH_TO_MPH = 0.621371
MM_TO_IN = 1.0 / 25.4
CM_TO_IN = 1.0 / 2.54
MAX_BATCH_POINTS = 45

def _calculate_forecast_days(target_datetimes: list) -> int:
    """Calculate the number of forecast days needed from today UTC."""
    if not target_datetimes:
        return 7
    now_utc = datetime.now(timezone.utc)
    max_target = max(
        (dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc))
        for dt in target_datetimes
    )
    delta_days = math.ceil((max_target - now_utc).total_seconds() / 86400.0) + 1
    return max(3, min(16, delta_days))

def _fetch_open_meteo_raw(points: list, forecast_days: int) -> list:
    """Query Open-Meteo in chunks to respect query limits and return location list."""
    all_locations = []
    for i in range(0, len(points), MAX_BATCH_POINTS):
        batch = points[i : i + MAX_BATCH_POINTS]
        latitudes = ",".join(f"{p['latitude']:.5f}" for p in batch)
        longitudes = ",".join(f"{p['longitude']:.5f}" for p in batch)
        params = {
            "latitude": latitudes,
            "longitude": longitudes,
            "hourly": "wind_speed_10m,precipitation,rain,snowfall",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "timezone": "UTC",
            "forecast_days": forecast_days,
        }
        response = requests.get(OPEN_METEO_URL, params=params, timeout=25)
        response.raise_for_status()
        payload = response.json()
        locations = payload if isinstance(payload, list) else [payload]
        all_locations.extend(locations)
    return all_locations

def fetch_weather_for_points(points: list, departure: datetime) -> list:
    """
    Fetch weather conditions for each checkpoint at its estimated arrival time.
    Returns a list of dicts with wind_mph, rain_in_hr, snow_in_hr, etc.
    """
    if not points:
        return []

    forecast_days = _calculate_forecast_days([p["arrival_datetime"] for p in points])
    locations = _fetch_open_meteo_raw(points, forecast_days)

    results = []
    for point, location in zip(points, locations):
        hourly = location.get("hourly", {})
        times = hourly.get("time", [])
        arrival_utc = point["arrival_datetime"].astimezone(timezone.utc)
        target = arrival_utc.replace(minute=0, second=0, microsecond=0)
        target_key = target.strftime("%Y-%m-%dT%H:%M")

        try:
            idx = times.index(target_key)
        except ValueError:
            # Find nearest available hourly sample
            parsed = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]
            if not parsed:
                results.append(None)
                continue
            idx = min(range(len(parsed)), key=lambda i: abs((parsed[i] - target).total_seconds()))
            # If closest available is more than 2 hours off, treat as out of forecast range
            if abs((parsed[idx] - target).total_seconds()) > 7200:
                results.append(None)
                continue

        def value(key):
            values = hourly.get(key, [])
            return values[idx] if idx < len(values) else None

        wind = value("wind_speed_10m")
        rain = value("rain")
        snow = value("snowfall")
        precipitation = value("precipitation")

        if wind is None:
            results.append(None)
            continue

        results.append({
            "wind_mph": round(float(wind) * KMH_TO_MPH, 1),
            "rain_in_hr": round(float(rain or 0.0) * MM_TO_IN, 4),
            "snow_in_hr": round(float(snow or 0.0) * CM_TO_IN, 4),
            "precipitation_in_hr": round(float(precipitation or 0.0) * MM_TO_IN, 4),
            "weather_time": times[idx],
        })

    return results

def fetch_hourly_corridor_forecast(points: list, load_weight_lb: float = 25000.0) -> list:
    """
    Fetch 0–48 hour hourly forecast along representative corridor checkpoints.
    Each corridor point includes hourly weather conditions and pre-evaluated risk scores
    for smooth client-side slider reactivity and mapbox heatmap rendering.
    """
    if not points:
        return []

    # Sample up to 25 evenly-distributed corridor points
    step = max(1, len(points) // 25)
    sample = points[::step][:25]
    # Ensure destination checkpoint is included in corridor
    if points[-1] not in sample:
        sample.append(points[-1])

    locations = _fetch_open_meteo_raw(sample, forecast_days=3)
    output = []

    for point, location in zip(sample, locations):
        hourly = location.get("hourly", {})
        times = hourly.get("time", [])
        values = []

        # We take up to 49 hourly values (hours 0 to 48)
        limit = min(49, len(times))
        for i in range(limit):
            time_value = times[i]
            wind_raw = (hourly.get("wind_speed_10m") or [])[i] if i < len(hourly.get("wind_speed_10m") or []) else None
            rain_raw = (hourly.get("rain") or [])[i] if i < len(hourly.get("rain") or []) else 0.0
            snow_raw = (hourly.get("snowfall") or [])[i] if i < len(hourly.get("snowfall") or []) else 0.0

            if wind_raw is None:
                continue

            wind_mph = round(float(wind_raw) * KMH_TO_MPH, 1)
            rain_in_hr = round(float(rain_raw or 0.0) * MM_TO_IN, 4)
            snow_in_hr = round(float(snow_raw or 0.0) * CM_TO_IN, 4)

            # Pre-evaluate risk for this specific hour along the corridor
            risk_eval = calculate_checkpoint_risk(wind_mph, rain_in_hr, snow_in_hr, load_weight_lb)

            values.append({
                "hour_offset": i,
                "time": time_value,
                "wind_mph": wind_mph,
                "rain_in_hr": rain_in_hr,
                "snow_in_hr": snow_in_hr,
                "risk": risk_eval["risk"],
                "risk_score": risk_eval["risk_score"],
                "reasons": risk_eval["reasons"],
            })

        output.append({
            "id": point.get("id"),
            "distance_miles": point.get("distance_miles", 0.0),
            "latitude": point["latitude"],
            "longitude": point["longitude"],
            "hourly": values,
        })

    return output
