from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from django.test import SimpleTestCase
from .service import (
    fetch_weather_for_points,
    fetch_hourly_corridor_forecast,
    _calculate_forecast_days,
    KMH_TO_MPH,
    MM_TO_IN,
    CM_TO_IN,
)

class WeatherServiceTests(SimpleTestCase):
    def test_unit_conversions(self):
        # 100 km/h should be ~62.14 mph
        self.assertAlmostEqual(100.0 * KMH_TO_MPH, 62.1371, places=3)
        # 25.4 mm should be 1.0 inch
        self.assertAlmostEqual(25.4 * MM_TO_IN, 1.0, places=3)
        # 2.54 cm should be 1.0 inch
        self.assertAlmostEqual(2.54 * CM_TO_IN, 1.0, places=3)

    def test_forecast_days_calculation(self):
        now = datetime.now(timezone.utc)
        target = now + timedelta(days=5)
        days = _calculate_forecast_days([target])
        self.assertGreaterEqual(days, 6)
        self.assertLessEqual(days, 16)

    @patch("weather.service.requests.get")
    def test_fetch_weather_for_points_matching(self, mock_get):
        arrival_time = datetime(2026, 11, 25, 14, 30, tzinfo=timezone.utc)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "hourly": {
                "time": ["2026-11-25T13:00", "2026-11-25T14:00", "2026-11-25T15:00"],
                "wind_speed_10m": [20.0, 40.0, 50.0],
                "precipitation": [0.0, 5.0, 10.0],
                "rain": [0.0, 5.0, 10.0],
                "snowfall": [0.0, 0.0, 0.0],
            }
        }
        mock_get.return_value = mock_response

        points = [{
            "id": 0,
            "latitude": 39.7392,
            "longitude": -104.9903,
            "arrival_datetime": arrival_time,
        }]

        departure = datetime(2026, 11, 25, 12, 0, tzinfo=timezone.utc)
        results = fetch_weather_for_points(points, departure)

        self.assertEqual(len(results), 1)
        # 14:30 rounds to 14:00 or closest sample (14:00 has wind 40.0 km/h)
        self.assertIsNotNone(results[0])
        self.assertAlmostEqual(results[0]["wind_mph"], 40.0 * KMH_TO_MPH, places=1)
        self.assertAlmostEqual(results[0]["rain_in_hr"], 5.0 * MM_TO_IN, places=3)

    @patch("weather.service.requests.get")
    def test_fetch_hourly_corridor_forecast(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        # 49 hours of dummy data
        times = [f"2026-11-25T{h:02d}:00" for h in range(24)] + [f"2026-11-26T{h:02d}:00" for h in range(25)]
        mock_response.json.return_value = [{
            "hourly": {
                "time": times,
                "wind_speed_10m": [30.0] * len(times),
                "precipitation": [0.0] * len(times),
                "rain": [0.0] * len(times),
                "snowfall": [0.0] * len(times),
            }
        }]
        mock_get.return_value = mock_response

        sample_points = [{
            "id": 0,
            "distance_miles": 0.0,
            "latitude": 39.7,
            "longitude": -104.9,
        }]

        corridor = fetch_hourly_corridor_forecast(sample_points, load_weight_lb=25000.0)
        self.assertEqual(len(corridor), 1)
        self.assertIn("hourly", corridor[0])
        self.assertEqual(len(corridor[0]["hourly"]), 49)
        self.assertEqual(corridor[0]["hourly"][0]["hour_offset"], 0)
        self.assertIn("risk", corridor[0]["hourly"][0])
        self.assertIn("risk_score", corridor[0]["hourly"][0])
