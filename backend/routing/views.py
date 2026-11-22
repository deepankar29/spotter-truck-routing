from datetime import datetime
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import requests

from .route_service import get_routes, make_checkpoints
from weather.service import fetch_weather_for_points, fetch_hourly_corridor_forecast
from risk.engine import calculate_checkpoint_risk, summarize_route, route_sort_key

def parse_datetime(value: str) -> datetime:
    """Parse departure datetime string ensuring timezone offset presence."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Departure must include a timezone offset, e.g. 2026-11-20T08:00:00-07:00.")
    return parsed

@api_view(["GET"])
def health(request):
    """Health check endpoint validating server status and Mapbox token presence."""
    return Response({
        "status": "ok",
        "mapbox_configured": bool(settings.MAPBOX_ACCESS_TOKEN),
    })

@api_view(["POST"])
def plan_routes(request):
    """
    Core route planning endpoint:
    - Generates up to 3 routes using Mapbox Directions API.
    - Samples checkpoints every 10 / 25 / 50 miles.
    - Matches weather to truck's estimated arrival time at each checkpoint.
    - Applies risk thresholds and truck load weight rules.
    - Ranks routes lexicographically (Fewest Severe, Fewest High, Lowest Avg Risk, Shortest Duration).
    - Generates a 0–48h trip corridor forecast for the heatmap slider.
    """
    data = request.data
    try:
        origin = data["origin"]
        destination = data["destination"]
        departure = parse_datetime(data["departure"])
        load = float(data["load_weight_lb"])
        interval = int(data.get("checkpoint_interval_miles", 25))

        if interval not in (10, 25, 50):
            raise ValueError("Checkpoint interval must be 10, 25, or 50 miles.")
        if load < 0 or load > 200000:
            raise ValueError("Load weight must be between 0 and 200,000 lb.")

        for place in (origin, destination):
            if not (-180 <= float(place["longitude"]) <= 180 and -90 <= float(place["latitude"]) <= 90):
                raise ValueError("Invalid origin or destination coordinates.")

        routes = get_routes(origin, destination)
        planned = []

        for route in routes:
            checkpoints, route_miles = make_checkpoints(route, departure, interval)
            weather = fetch_weather_for_points(checkpoints, departure)
            output_points = []

            for point, conditions in zip(checkpoints, weather):
                clean = {k: v for k, v in point.items() if k != "arrival_datetime"}
                if conditions is None:
                    clean.update({
                        "weather_available": False,
                        "risk": "Unknown",
                        "risk_score": None,
                        "reasons": ["Forecast unavailable for this checkpoint arrival window"],
                    })
                else:
                    risk = calculate_checkpoint_risk(
                        conditions["wind_mph"],
                        conditions["rain_in_hr"],
                        conditions["snow_in_hr"],
                        load,
                    )
                    clean.update(conditions)
                    clean.update(risk)
                    clean["weather_available"] = True

                output_points.append(clean)

            # For route ranking, an unknown segment is conservatively treated as Severe
            summary_points = [
                {**p, "risk": "Severe" if p.get("risk") == "Unknown" else p.get("risk")}
                for p in output_points
            ]
            summary = summarize_route(summary_points, route["duration"])
            route["checkpoints"] = output_points
            route["summary"] = summary
            route["is_recommended"] = False
            planned.append(route)

        # Lexicographical sort by: 0. No Travel, 1. Severe, 2. High, 3. Avg Risk, 4. Duration
        planned.sort(key=route_sort_key)
        planned[0]["is_recommended"] = True

        # Generate corridor forecast for the recommended route for the 0–48h slider & heatmap
        heatmap = fetch_hourly_corridor_forecast(planned[0]["checkpoints"], load_weight_lb=load)

        return Response({
            "routes": planned,
            "recommended_route_id": planned[0]["id"],
            "heatmap": heatmap,
            "departure": departure.isoformat(),
            "checkpoint_interval_miles": interval,
            "load_weight_lb": load,
            "route_count": len(planned),
            "notice": None if len(planned) == 3 else f"Mapbox returned {len(planned)} route option(s) for this journey.",
        })

    except KeyError as exc:
        return Response({"error": f"Missing required field: {exc.args[0]}"}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except requests.RequestException as exc:
        return Response({"error": f"External API request failed: {str(exc)}"}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as exc:
        return Response({"error": f"Unable to plan this trip: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
