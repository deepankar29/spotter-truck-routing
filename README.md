# Weather-Aware Truck Routing

A full-stack dispatch and navigation tool that helps commercial truck drivers and fleet operators evaluate driving routes based on weather forecasts, vehicle cargo weight, and road exposure risk.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/deepankar29/spotter-truck-routing)

---

## Overview

Adverse weather—especially high crosswinds, heavy snowfall, and torrential rain—is a leading cause of commercial vehicle accidents, rollovers, and transit delays. Standard consumer routing engines only optimize for distance and traffic, ignoring weather hazards and gross vehicle weight dynamics.

This application bridges that gap by:
1. Generating up to three alternative driving routes between any origin and destination using Mapbox Directions.
2. Sampling weather conditions along each route at discrete mileage intervals (10, 25, or 50 miles) synchronized to the truck's estimated time of arrival (ETA) at each checkpoint via Open-Meteo.
3. Calculating localized road risk using vehicle load weight and condition-specific thresholds.
4. Lexicographically ranking routes to prioritize safety first, then travel efficiency.
5. Visualizing trip corridor weather conditions with an interactive 48-hour forecast timeline and continuous heatmap layer.

---

## Core Features

- **Multi-Route Comparison**: Retrieves up to three alternative driving routes from Mapbox Directions API with distance, duration, and turn geometry.
- **ETA-Synchronized Weather**: Queries hourly forecasts matching the truck's scheduled arrival time at every checkpoint along the route.
- **Load-Aware Risk Engine**: Evaluates wind, rain, and snow intensity while adjusting safety thresholds for loaded vs. heavy commercial haulers.
- **Corridor Heatmap & 48h Timeline**: Interactive Mapbox GL JS heatmap layer visualizing weather risk across the corridor with a 0–48 hour forecast slider and simulation playback.
- **Segment-Level Attribution**: Employs 1D Voronoi midpoint partitioning so that origin departure conditions and intermediate waypoints are proportionally weighted in the total risk score.
- **Checkpoint Inspection Drawer**: Filterable breakdown (All, Alerts, Severe) providing mile markers, ETAs, condition metrics, and governing risk drivers.

---

## Risk Model & Logic

### Condition Thresholds

Weather conditions at each checkpoint are categorized into five severity levels based on meteorological metrics:

| Severity Level | Wind Speed | Rainfall Rate | Snowfall Rate |
|---|---|---|---|
| **Low** | < 25 mph | < 0.10 in/hr | < 0.5 in/hr |
| **Moderate** | 25 – 34 mph | 0.10 – 0.25 in/hr | 0.5 – 1.0 in/hr |
| **High** | 35 – 44 mph | 0.25 – 0.50 in/hr | 1.0 – 2.0 in/hr |
| **Severe** | 45 – 54 mph | 0.50 – 1.00 in/hr | 2.0 – 3.0 in/hr |
| **No Travel** | ≥ 55 mph | > 1.00 in/hr | > 3.0 in/hr |

### Vehicle Load Rules

Crosswinds present significantly higher rollover hazards depending on truck gross vehicle weight. The engine enforces the following vehicle dynamics overrides:

- **Wind ≥ 55 mph**: Classified as **No Travel** for all vehicle weights.
- **Wind 45 – 54 mph with cargo weight > 30,000 lb**: Escalated to **No Travel**.
- **Wind 35 – 44 mph with cargo weight > 40,000 lb**: Escalated to **Severe**.

### Route Ranking Methodology

Routes are evaluated and sorted using a four-tier lexicographical preference order:

1. **Fewest No-Travel & Severe Miles**: Minimizes highway segments exposed to critical conditions.
2. **Fewest High-Risk Miles**: Minimizes stretches with elevated wind or precipitation.
3. **Lowest Weighted Average Risk**: Computes average segment-weighted risk across the total trip distance.
4. **Shortest Travel Duration**: Selects the fastest path when safety profiles are equivalent.

---

## Architecture & Tech Stack

```
[ Frontend: React 18 + Vite ]
   ├── Mapbox GL JS (Vector mapping, route geometries, native heatmap layer)
   ├── Tailwind CSS v4 (Modern responsive interface)
   └── Lucide React (Visual telemetry icons)
          │  REST JSON
          ▼
[ Backend: Django 5 + Django REST Framework ]
   ├── routing/     Mapbox Directions client & Voronoi checkpoint sampler
   ├── weather/     Open-Meteo multi-point hourly forecast service
   └── risk/        Pure business logic: threshold classification & route ranking
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Mapbox access token ([mapbox.com](https://www.mapbox.com/))

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Set your configuration in `backend/.env`:
```env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
MAPBOX_ACCESS_TOKEN=your_mapbox_token
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Run database migrations and start the development server:
```bash
python manage.py migrate
python manage.py runserver
```
The API will be available at `http://127.0.0.1:8000/api/`.

### 2. Frontend Setup

In a separate terminal:
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Set your public token in `frontend/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
```

Start the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Testing

The backend includes a comprehensive test suite covering threshold logic, load weight overrides, distance calculations, and API validation:

```bash
cd backend
python manage.py test risk routing weather
```

---

## Docker Deployment

Build and run the entire stack with Docker Compose:

```bash
MAPBOX_ACCESS_TOKEN=your_token docker compose up --build
```

- Web App: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/`

---

## License

This project is licensed under the MIT License.
