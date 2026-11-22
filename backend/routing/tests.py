from datetime import datetime, timezone
from django.test import TestCase
from rest_framework.test import APIClient
from .route_service import (
    haversine_miles,
    cumulative_distances,
    interpolate_at_distance,
    make_checkpoints,
)

class RoutingServiceTests(TestCase):
    def test_haversine_miles(self):
        # Denver: [-104.9903, 39.7392], Colorado Springs: [-104.8214, 38.8339]
        denver = [-104.9903, 39.7392]
        c_springs = [-104.8214, 38.8339]
        dist = haversine_miles(denver, c_springs)
        # Great circle distance is roughly 63.2 miles
        self.assertGreater(dist, 60.0)
        self.assertLess(dist, 70.0)

    def test_cumulative_distances_and_interpolation(self):
        coords = [[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]]
        cumulative = cumulative_distances(coords)
        self.assertEqual(len(cumulative), 3)
        self.assertEqual(cumulative[0], 0.0)
        self.assertGreater(cumulative[1], 0.0)

        # Interpolate halfway
        midpoint = interpolate_at_distance(coords, cumulative, cumulative[1] / 2.0)
        self.assertAlmostEqual(midpoint[0], 0.5, places=2)
        self.assertAlmostEqual(midpoint[1], 0.0, places=2)

    def test_make_checkpoints_segment_partition(self):
        # 100-mile straight line approximation
        coords = [[-104.0, 40.0], [-104.0, 41.5]]
        cumulative = cumulative_distances(coords)
        total_miles = cumulative[-1]

        route = {
            "geometry": {"coordinates": coords},
            "duration": 7200,  # 2 hours
        }
        departure = datetime(2026, 11, 25, 8, 0, tzinfo=timezone.utc)
        checkpoints, calculated_total = make_checkpoints(route, departure, interval_miles=25)

        self.assertGreater(len(checkpoints), 2)
        # First checkpoint (origin) must have segment_miles > 0 to contribute to risk calculation
        self.assertGreater(checkpoints[0]["segment_miles"], 0)

        # Sum of segments should match total_miles within float rounding
        total_segments = sum(p["segment_miles"] for p in checkpoints)
        self.assertAlmostEqual(total_segments, total_miles, delta=0.5)

class RoutingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_endpoint(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.data)
        self.assertEqual(response.data["status"], "ok")

    def test_plan_routes_validation(self):
        # Missing origin
        res1 = self.client.post("/api/plan/", {}, format="json")
        self.assertEqual(res1.status_code, 400)

        # Invalid interval (must be 10, 25, 50)
        res2 = self.client.post("/api/plan/", {
            "origin": {"longitude": -104.9, "latitude": 39.7},
            "destination": {"longitude": -104.8, "latitude": 38.8},
            "departure": "2026-11-25T08:00:00+00:00",
            "load_weight_lb": 25000,
            "checkpoint_interval_miles": 15,
        }, format="json")
        self.assertEqual(res2.status_code, 400)
        self.assertIn("interval must be 10, 25, or 50", res2.data["error"])

        # Invalid negative load weight
        res3 = self.client.post("/api/plan/", {
            "origin": {"longitude": -104.9, "latitude": 39.7},
            "destination": {"longitude": -104.8, "latitude": 38.8},
            "departure": "2026-11-25T08:00:00+00:00",
            "load_weight_lb": -500,
            "checkpoint_interval_miles": 25,
        }, format="json")
        self.assertEqual(res3.status_code, 400)
        self.assertIn("Load weight must be between 0 and 200,000 lb", res3.data["error"])
