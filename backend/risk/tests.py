from django.test import SimpleTestCase
from .engine import (
    calculate_checkpoint_risk,
    classify_wind,
    classify_rain,
    classify_snow,
    summarize_route,
    route_sort_key,
)

class RiskEngineTests(SimpleTestCase):
    def test_wind_thresholds(self):
        self.assertEqual(classify_wind(0.0), "Low")
        self.assertEqual(classify_wind(24.9), "Low")
        self.assertEqual(classify_wind(25.0), "Moderate")
        self.assertEqual(classify_wind(34.9), "Moderate")
        self.assertEqual(classify_wind(35.0), "High")
        self.assertEqual(classify_wind(44.9), "High")
        self.assertEqual(classify_wind(45.0), "Severe")
        self.assertEqual(classify_wind(54.9), "Severe")
        self.assertEqual(classify_wind(55.0), "No Travel")
        self.assertEqual(classify_wind(70.0), "No Travel")

    def test_rain_thresholds(self):
        self.assertEqual(classify_rain(0.0), "Low")
        self.assertEqual(classify_rain(0.09), "Low")
        self.assertEqual(classify_rain(0.10), "Moderate")
        self.assertEqual(classify_rain(0.24), "Moderate")
        self.assertEqual(classify_rain(0.25), "High")
        self.assertEqual(classify_rain(0.49), "High")
        self.assertEqual(classify_rain(0.50), "Severe")
        self.assertEqual(classify_rain(1.00), "Severe")
        self.assertEqual(classify_rain(1.01), "No Travel")
        self.assertEqual(classify_rain(2.50), "No Travel")

    def test_snow_thresholds(self):
        self.assertEqual(classify_snow(0.0), "Low")
        self.assertEqual(classify_snow(0.49), "Low")
        self.assertEqual(classify_snow(0.50), "Moderate")
        self.assertEqual(classify_snow(0.99), "Moderate")
        self.assertEqual(classify_snow(1.00), "High")
        self.assertEqual(classify_snow(1.99), "High")
        self.assertEqual(classify_snow(2.00), "Severe")
        self.assertEqual(classify_snow(3.00), "Severe")
        self.assertEqual(classify_snow(3.01), "No Travel")
        self.assertEqual(classify_snow(5.00), "No Travel")

    def test_load_weight_rules(self):
        # 1. >= 55 mph -> No Travel for any load
        res1 = calculate_checkpoint_risk(55.0, 0.0, 0.0, 5000)
        self.assertEqual(res1["risk"], "No Travel")
        self.assertIn("No Travel for any load", res1["reasons"][0])

        res2 = calculate_checkpoint_risk(60.0, 0.0, 0.0, 45000)
        self.assertEqual(res2["risk"], "No Travel")

        # 2. 45-54 mph + >30,000 lb -> No Travel
        res3 = calculate_checkpoint_risk(50.0, 0.0, 0.0, 30000)
        self.assertEqual(res3["risk"], "Severe")  # <= 30k lb stays Severe

        res4 = calculate_checkpoint_risk(50.0, 0.0, 0.0, 30001)
        self.assertEqual(res4["risk"], "No Travel")
        self.assertIn("load 30,001 lb (>30,000 lb)", res4["reasons"][0])

        # 3. 35-44 mph + >40,000 lb -> Severe
        res5 = calculate_checkpoint_risk(40.0, 0.0, 0.0, 40000)
        self.assertEqual(res5["risk"], "High")  # <= 40k lb stays High

        res6 = calculate_checkpoint_risk(40.0, 0.0, 0.0, 40001)
        self.assertEqual(res6["risk"], "Severe")
        self.assertIn("load 40,001 lb (>40,000 lb)", res6["reasons"][0])

    def test_worst_condition_dominance(self):
        # If snow is No Travel, but wind is Low, overall risk should be No Travel
        res = calculate_checkpoint_risk(10.0, 0.0, 3.5, 20000)
        self.assertEqual(res["risk"], "No Travel")
        self.assertEqual(res["risk_score"], 4)
        self.assertIn("Snow 3.50 in/hr", res["reasons"][0])

    def test_summarize_route(self):
        checkpoints = [
            {"segment_miles": 12.5, "risk": "Low"},
            {"segment_miles": 25.0, "risk": "Moderate"},
            {"segment_miles": 25.0, "risk": "High"},
            {"segment_miles": 25.0, "risk": "Severe"},
            {"segment_miles": 12.5, "risk": "No Travel"},
        ]
        summary = summarize_route(checkpoints, 3600)
        self.assertEqual(summary["total_miles"], 100.0)
        self.assertEqual(summary["duration_seconds"], 3600)
        self.assertEqual(summary["high_miles"], 25.0)
        self.assertEqual(summary["severe_miles"], 37.5)  # Severe (25) + No Travel (12.5)
        self.assertEqual(summary["no_travel_miles"], 12.5)
        # Weighted: 12.5*0 + 25*1 + 25*2 + 25*3 + 12.5*4 = 0 + 25 + 50 + 75 + 50 = 200 / 100 = 2.0
        self.assertEqual(summary["average_risk"], 2.0)

    def test_route_recommendation_sorting(self):
        # Prefer: 1. Fewest Severe miles, 2. Fewest High miles, 3. Lowest avg risk, 4. Shortest duration
        route_a = {
            "name": "Route A",
            "summary": {"no_travel_miles": 0.0, "severe_miles": 5.0, "high_miles": 10.0, "average_risk": 1.5, "duration_seconds": 3600},
        }
        route_b = {
            "name": "Route B",
            "summary": {"no_travel_miles": 0.0, "severe_miles": 0.0, "high_miles": 20.0, "average_risk": 1.2, "duration_seconds": 4000},
        }
        # Route B has fewer severe miles (0 vs 5), so Route B should win despite longer duration
        ranked = sorted([route_a, route_b], key=route_sort_key)
        self.assertEqual(ranked[0]["name"], "Route B")

        # Tie on severe miles, fewer high miles wins
        route_c = {
            "name": "Route C",
            "summary": {"no_travel_miles": 0.0, "severe_miles": 0.0, "high_miles": 5.0, "average_risk": 1.1, "duration_seconds": 4500},
        }
        ranked = sorted([route_b, route_c], key=route_sort_key)
        self.assertEqual(ranked[0]["name"], "Route C")

        # Tie on severe and high miles, lower average risk wins
        route_d = {
            "name": "Route D",
            "summary": {"no_travel_miles": 0.0, "severe_miles": 0.0, "high_miles": 5.0, "average_risk": 0.8, "duration_seconds": 5000},
        }
        ranked = sorted([route_c, route_d], key=route_sort_key)
        self.assertEqual(ranked[0]["name"], "Route D")

        # Tie on severe, high, and avg risk: shortest duration wins
        route_e = {
            "name": "Route E",
            "summary": {"no_travel_miles": 0.0, "severe_miles": 0.0, "high_miles": 5.0, "average_risk": 0.8, "duration_seconds": 4200},
        }
        ranked = sorted([route_d, route_e], key=route_sort_key)
        self.assertEqual(ranked[0]["name"], "Route E")
