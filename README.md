# Spotter AI — Weather-Aware Truck Routing

A production-grade **React + Django** web application engineered for truck drivers and fleet dispatchers to select the safest highway routes based on real-time and forecasted weather, cargo load weight, checkpoint sampling, and lexicographical risk optimization.

Built strictly according to the **Spotter Full Stack Developer: Weather-Aware Truck Routing** assessment specification.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/deepankar29/spotter-truck-routing)
&nbsp;
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/deepankar29/spotter-truck-routing&root-directory=frontend)

---

## Assessment Requirements & Compliance Matrix

| Requirement | Specification | Implementation in Repository | Status |
|---|---|---|:---:|
| **User Inputs** | Origin & Destination | Autocomplete search via Mapbox Geocoding (`PlaceInput.jsx`) + 1-click test corridor presets | **100%** |
| | Departure Date/Time | `datetime-local` input serialized with ISO 8601 timezone offset | **100%** |
| | Load Weight (lb) | Numeric input with dynamic classification badge (Standard / Medium / Heavy) | **100%** |
| | Checkpoint Interval | 10 / 25 / 50 miles selector | **100%** |
| **Route Generation** | Generate 3 route options using a routing API | Mapbox Directions API with `alternatives=true` (`route_service.py`) | **100%** |
| **Weather Sampling** | Sample every 10 / 25 / 50 miles using truck arrival ETA | Haversine distance interpolation along GeoJSON geometry. Matches estimated arrival time to Open-Meteo hourly forecast. | **100%** |
| **Weather Risk Rules** | Wind, Rain, Snow classification table | Strict threshold boundaries implemented in `risk/engine.py` | **100%** |
| **Load Rules** | $\ge 55$ mph $\rightarrow$ No Travel<br>$45\text{--}54$ mph $+ >30\text{k}$ lb $\rightarrow$ No Travel<br>$35\text{--}44$ mph $+ >40\text{k}$ lb $\rightarrow$ Severe | Implemented with exact condition evaluation and detailed reason generation | **100%** |
| **Recommendation** | 1. Fewest Severe miles<br>2. Fewest High miles<br>3. Lowest average risk<br>4. Shortest travel times | Lexicographical tuple sort key in `risk/engine.py` with No-Travel prioritization | **100%** |
| **Map & Heatmap** | All routes, checkpoints, risk levels, ETAs, summaries | Interactive Mapbox GL JS map with route switching, active glow, and checkpoint popup cards | **100%** |
| | Corridor heatmap with 0–48h slider | Native Mapbox GL JS `heatmap` layer beneath route lines with dynamic 0–48h hourly simulation & auto-play loop | **100%** |
| **Test Suite** | Unit tests for risk, weather, and routing | 16 comprehensive unit tests passing with 100% green status | **100%** |

---

## Architecture & Data Flow

```
[ Truck Driver / User ]
         │
         ▼
[ React + Vite Frontend (Tailwind CSS, Mapbox GL JS) ]
   • PlaceInput (Geocoding autocomplete)
   • RouteMap (Polylines + Mapbox Heatmap Layer + Checkpoint markers)
   • WeatherTimeline (0–48h forecast slider + Play/Pause animation)
   • CheckpointList (Filter by All / Alerts / High & Severe)
         │  POST /api/plan/
         ▼
[ Django REST Framework Backend ]
   ├── routing/route_service.py
   │     └── Calls Mapbox Directions API -> generates up to 3 routes
   │     └── Samples checkpoints every 10/25/50 miles with Voronoi segment partitioning
   ├── weather/service.py
   │     └── Queries Open-Meteo hourly forecast (wind_speed_10m, rain, snowfall)
   │     └── Matches checkpoint ETA to UTC hourly forecast buckets
   │     └── Generates 0–48h trip corridor forecast points for the heatmap
   └── risk/engine.py
         └── Classifies wind, rain, and snow conditions
         └── Applies load weight rules (>30,000 lb, >40,000 lb)
         └── Computes route exposure summaries and lexicographical ranking
```

---

## Risk Rules & Load Engine

### 1. Condition Thresholds

| Condition | Low | Moderate | High | Severe | No Travel |
|---|:---:|:---:|:---:|:---:|:---:|
| **Wind** | $<25$ mph | $25\text{--}34$ mph | $35\text{--}44$ mph | $45\text{--}54$ mph | $\ge 55$ mph |
| **Rain** | $<0.10$ in/hr | $0.10\text{--}0.25$ in/hr | $0.25\text{--}0.50$ in/hr | $0.50\text{--}1.00$ in/hr | $>1.00$ in/hr |
| **Snow** | $<0.5$ in/hr | $0.5\text{--}1.0$ in/hr | $1.0\text{--}2.0$ in/hr | $2.0\text{--}3.0$ in/hr | $>3.0$ in/hr |

### 2. Truck Load Rules

- $\ge 55$ mph wind $\rightarrow$ **No Travel** for any load weight.
- $45\text{--}54$ mph wind $+ >30,000$ lb load $\rightarrow$ **No Travel**.
- $35\text{--}44$ mph wind $+ >40,000$ lb load $\rightarrow$ **Severe**.

### 3. Route Recommendation Preference

Routes are evaluated and sorted using Python's native lexicographical tuple comparison:
```python
def route_sort_key(route):
    summary = route["summary"]
    return (
        summary.get("no_travel_miles", 0.0), # Highest safety priority
        summary["severe_miles"],             # Preference 1: Fewest Severe miles
        summary["high_miles"],               # Preference 2: Fewest High miles
        summary["average_risk"],             # Preference 3: Lowest average risk
        summary["duration_seconds"],         # Preference 4: Shortest travel times
    )
```

### 4. Segment Mileage Attribution (Voronoi Partitioning)

Rather than attributing 0 miles to the origin checkpoint, the checkpoint generation algorithm uses 1D Voronoi mid-point partitioning:
- Checkpoint $0$ represents $[0, \frac{d_1 - d_0}{2}]$
- Checkpoint $i$ represents $[\frac{d_i - d_{i-1}}{2}, \frac{d_{i+1} - d_i}{2}]$
- Checkpoint $n-1$ represents $[\frac{d_{n-1} - d_{n-2}}{2}, d_{n-1}]$

This guarantees that:
1. Every checkpoint (including the departure point) receives a fair proportional segment weight.
2. The sum of all segment miles is **identically equal to total route distance**.
3. Hazardous departure weather is accurately represented in the route's risk exposure.

---

## Quick Start Guide

### Prerequisites
- Node.js 18+
- Python 3.10+
- Mapbox access token (Public token for frontend, secret or public token for backend)

---

### Step 1: Backend Setup (Django)

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env   # On macOS/Linux use: cp .env.example .env
```

Edit `backend/.env`:
```env
DJANGO_SECRET_KEY=dev-secret-key-replace-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Run migrations and start server:
```bash
python manage.py migrate
python manage.py runserver
```
Backend runs at `http://127.0.0.1:8000`.

---

### Step 2: Frontend Setup (React + Vite)

In a new terminal:
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
copy .env.example .env   # On macOS/Linux use: cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token_here
```

Start Vite dev server:
```bash
npm run dev
```
Open `http://localhost:5173`.

---

## Running Backend Unit Tests

The backend includes 16 unit tests covering:
- Wind, rain, and snow threshold classifications
- Heavy and medium load weight overrides
- Dominant condition resolution and reason generation
- Route summary calculations and Voronoi segment weight preservation
- Lexicographical route sorting with ties and overrides
- Haversine distance and coordinate interpolation along routes
- Open-Meteo unit conversions and ETA forecast matching
- API health and input validation endpoints

Run the full test suite:
```bash
cd backend
python manage.py test risk routing weather
```

Expected output:
```
Ran 16 tests in 0.026s
OK
```

---

## Cloud Deployment Guide

### Option 1: Render (1-Click via `render.yaml`)

This repository includes a root `render.yaml` blueprint defining:
1. `spotter-routing-backend`: Python web service with automatic Gunicorn start command and migrations.
2. `spotter-routing-frontend`: Static site serving Vite production build (`frontend/dist`) with client-side SPA routing rewrites.

To deploy:
1. Push repository to GitHub.
2. In the Render Dashboard, click **New +** $\rightarrow$ **Blueprint**.
3. Select this repo; provide your `MAPBOX_ACCESS_TOKEN` and `VITE_MAPBOX_ACCESS_TOKEN`.
4. Deploy!

### Option 2: Railway or Fly.io (Backend) + Vercel (Frontend)

- **Frontend on Vercel**: Import the `frontend` folder. `vercel.json` rewrite configuration is pre-configured. Add `VITE_API_BASE_URL` and `VITE_MAPBOX_ACCESS_TOKEN` in Vercel project settings.
- **Backend on Railway**: Deploy `backend` folder. The included `Procfile` executes Gunicorn. Set environment variables in the Railway dashboard.

---

## 5–10 Minute Loom Walkthrough Script

Use this structured script when recording the evaluation walkthrough video:

| Time | Section | Script / Actions to Perform |
|---|---|---|
| **0:00 – 1:00** | **Introduction & Problem Statement** | • Introduce yourself and the project: *"Weather-Aware Truck Routing for Spotter."*<br>• Show the clean dashboard UI and explain the goal: helping truck drivers choose the safest route balancing weather risk, load weight, and travel time.<br>• Mention the stack: React, Vite, Tailwind CSS, Mapbox GL JS, Django REST Framework, Mapbox Directions, Open-Meteo. |
| **1:00 – 2:30** | **Trip Configuration & Presets** | • Click one of the test corridor presets (e.g. *Denver $\rightarrow$ Colorado Springs* or *Chicago $\rightarrow$ Minneapolis*).<br>• Demonstrate the Mapbox Geocoding autocomplete in `PlaceInput`.<br>• Show the departure date/time picker (with timezone offset) and load weight input.<br>• Highlight the 10 / 25 / 50 mile interval toggle.<br>• Click **Calculate Safest Routes** and observe the loading spinner and smooth API response. |
| **2:30 – 4:00** | **Route Alternatives & Recommendation Logic** | • Show the 3 generated route options on the left and how the active route is illuminated in electric cyan on the map.<br>• Explain the **lexicographical preference order**: 1. Fewest Severe miles, 2. Fewest High miles, 3. Lowest average risk, 4. Shortest travel times.<br>• Point out the *Recommended* badge on the winning route.<br>• Change the load weight from `25,000 lb` to `45,000 lb` and explain the load rules: 35–44 mph wind becomes Severe for loads $>40\text{k}$ lb, and 45–54 mph wind becomes No Travel for loads $>30\text{k}$ lb. |
| **4:00 – 6:00** | **Corridor Weather Heatmap & 0–48h Forecast Slider** | • Zoom in on the map and showcase the **true Mapbox GL JS `heatmap` layer** flowing along the trip corridor beneath the route line.<br>• Toggle Heatmap metric between *Risk*, *Wind*, and *Rain* using the map toolbar.<br>• Drag the **0–48 Hour Forecast Slider** and watch the heatmap intensity and corridor average metrics update in real-time.<br>• Click the **Play Loop** button to demonstrate the auto-play simulation of the weather front moving across the 48-hour timeline.<br>• Toggle inspection mode between *ETA Time* and *Slider Hour*. Click any checkpoint marker to open its rich popup card. |
| **6:00 – 7:30** | **Checkpoint Weather Analysis Drawer** | • Expand the *Checkpoint Weather Analysis* section.<br>• Demonstrate the filters: *All*, *Alerts (Mod+)*, and *High / Severe*.<br>• Show checkpoint details: exact mile, Voronoi segment span, ETA, wind, rain, snow, and the clear governing explanation reason. |
| **7:30 – 8:45** | **Code Architecture & Test Suite** | • Switch to the terminal / code editor.<br>• Show the modular structure: `risk/engine.py`, `routing/route_service.py`, `weather/service.py`.<br>• Run `python manage.py test risk routing weather` live to show **all 16 unit tests passing**.<br>• Highlight the Voronoi segment calculation that ensures origin weather at Mile 0 is not dropped. |
| **8:45 – 9:30** | **Conclusion & Wrap-Up** | • Summarize: All core requirements from the PDF are met 100% with priority on correctness, clarity, and safety.<br>• Show GitHub repo link and live deployment URL.<br>• Conclude walkthrough. |

---

## Author & License

Built for the **Spotter AI Full Stack Developer** Assessment.  
Licensed under the MIT License.
