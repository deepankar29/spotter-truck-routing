RISK_ORDER = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3, "No Travel": 4}
RISK_SCORE = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3, "No Travel": 4}

def classify_wind(mph: float) -> str:
    """Classify wind speed (mph) based on assessment risk table."""
    if mph >= 55.0:
        return "No Travel"
    if mph >= 45.0:
        return "Severe"
    if mph >= 35.0:
        return "High"
    if mph >= 25.0:
        return "Moderate"
    return "Low"

def classify_rain(inches_per_hour: float) -> str:
    """Classify rain intensity (in/hr) based on assessment risk table."""
    if inches_per_hour > 1.0:
        return "No Travel"
    if inches_per_hour >= 0.50:
        return "Severe"
    if inches_per_hour >= 0.25:
        return "High"
    if inches_per_hour >= 0.10:
        return "Moderate"
    return "Low"

def classify_snow(inches_per_hour: float) -> str:
    """Classify snowfall intensity (in/hr) based on assessment risk table."""
    if inches_per_hour > 3.0:
        return "No Travel"
    if inches_per_hour >= 2.0:
        return "Severe"
    if inches_per_hour >= 1.0:
        return "High"
    if inches_per_hour >= 0.5:
        return "Moderate"
    return "Low"

def calculate_checkpoint_risk(wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_weight_lb: float) -> dict:
    """
    Calculate the weather risk for a checkpoint given weather conditions and load weight.
    Applies condition thresholds first, then the load rules:
      - >=55 mph -> No Travel for any load
      - 45-54 mph + >30,000 lb -> No Travel
      - 35-44 mph + >40,000 lb -> Severe
    """
    wind_level = classify_wind(wind_mph)
    rain_level = classify_rain(rain_in_hr)
    snow_level = classify_snow(snow_in_hr)

    levels = [wind_level, rain_level, snow_level]
    base_risk = max(levels, key=lambda level: RISK_ORDER[level])
    risk = base_risk
    reasons = []

    # Check load-specific rules
    if wind_mph >= 55.0:
        risk = "No Travel"
        reasons.append(f"Wind is {wind_mph:.1f} mph (≥55 mph) → No Travel for any load")
    elif 45.0 <= wind_mph < 55.0 and load_weight_lb > 30000:
        risk = "No Travel"
        reasons.append(
            f"Wind is {wind_mph:.1f} mph (45–54 mph) with load {load_weight_lb:,.0f} lb (>30,000 lb) → No Travel"
        )
    elif 35.0 <= wind_mph < 45.0 and load_weight_lb > 40000:
        if RISK_ORDER[risk] < RISK_ORDER["Severe"]:
            risk = "Severe"
        reasons.append(
            f"Wind is {wind_mph:.1f} mph (35–44 mph) with load {load_weight_lb:,.0f} lb (>40,000 lb) → Severe"
        )

    # Document primary drivers if not already explained by load rules
    if not reasons:
        highest_conditions = []
        if wind_level == risk and wind_level != "Low":
            highest_conditions.append(f"Wind {wind_mph:.1f} mph ({wind_level})")
        if rain_level == risk and rain_level != "Low":
            highest_conditions.append(f"Rain {rain_in_hr:.2f} in/hr ({rain_level})")
        if snow_level == risk and snow_level != "Low":
            highest_conditions.append(f"Snow {snow_in_hr:.2f} in/hr ({snow_level})")

        if highest_conditions:
            reasons.append("Governed by " + ", ".join(highest_conditions))
        else:
            reasons.append("Favorable conditions across wind, rain, and snow")

    return {
        "risk": risk,
        "risk_score": RISK_SCORE[risk],
        "reasons": reasons,
        "condition_levels": {
            "wind": wind_level,
            "rain": rain_level,
            "snow": snow_level,
        },
    }

def summarize_route(checkpoints: list, duration_seconds: float) -> dict:
    """
    Summarize exposure along a route:
    Calculates no-travel miles, severe miles, high miles, weighted average risk, and duration.
    """
    no_travel_miles = 0.0
    severe_miles = 0.0
    high_miles = 0.0
    moderate_miles = 0.0
    low_miles = 0.0
    weighted_risk = 0.0
    total_miles = 0.0

    for point in checkpoints:
        segment = float(point.get("segment_miles", 0.0))
        risk = point.get("risk", "Low")

        if risk == "No Travel":
            no_travel_miles += segment
            severe_miles += segment  # PDF rule 1 evaluates Severe (and No Travel) exposure
        elif risk == "Severe":
            severe_miles += segment
        elif risk == "High":
            high_miles += segment
        elif risk == "Moderate":
            moderate_miles += segment
        else:
            low_miles += segment

        weighted_risk += RISK_SCORE.get(risk, 0) * segment
        total_miles += segment

    average_risk = (weighted_risk / total_miles) if total_miles > 0 else 0.0

    return {
        "no_travel_miles": round(no_travel_miles, 1),
        "severe_miles": round(severe_miles, 1),
        "high_miles": round(high_miles, 1),
        "moderate_miles": round(moderate_miles, 1),
        "low_miles": round(low_miles, 1),
        "average_risk": round(average_risk, 2),
        "duration_seconds": int(duration_seconds),
        "total_miles": round(total_miles, 1),
    }

def route_sort_key(route: dict) -> tuple:
    """
    Sort key implementing PDF Route Recommendation Preference:
      1. Fewest Severe miles (with No Travel prioritized)
      2. Fewest High miles
      3. Lowest average risk
      4. Shortest travel times
    """
    summary = route["summary"]
    return (
        summary.get("no_travel_miles", 0.0),
        summary["severe_miles"],
        summary["high_miles"],
        summary["average_risk"],
        summary["duration_seconds"],
    )
