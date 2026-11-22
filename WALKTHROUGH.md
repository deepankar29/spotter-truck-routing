# Loom Walkthrough Recording Guide (5–10 Minutes)

This script is specifically structured for the **5–10 min Loom Walkthrough** required by the **Spotter Full Stack Developer: Weather-Aware Truck Routing** assessment.

It is organized into clear time blocks corresponding to the **40% / 40% / 15% / 5%** assessment evaluation criteria.

---

## Pre-Recording Checklist
- [ ] Browser open to `http://localhost:5173/` (or your live hosted URL).
- [ ] Terminal open in `d:\spotter-truck-routing\backend` with virtual environment activated (`.venv`).
- [ ] Code editor open displaying `risk/engine.py`, `routing/route_service.py`, and `RouteMap.jsx`.
- [ ] Audio/video test on Loom (set recording area to Full Screen or Window 1080p).

---

## Detailed Minute-by-Minute Script

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [0:00 – 0:50] 1. INTRODUCTION & OVERVIEW (Evaluation: Documentation & Clarity) │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Front page of the application (`http://localhost:5173/`).

**What to Say:**
> *"Hello! My name is [Your Name], and this is my submission for the Spotter Weather-Aware Truck Routing assessment.*
>
> *The goal of this application is to help commercial truck drivers and dispatchers choose the safest highway route by combining three key variables: forecasted weather conditions along the trip corridor, the truck's cargo load weight, and total travel time.*
>
> *Our tech stack consists of a React and Vite frontend with Tailwind CSS and Mapbox GL JS, backed by a Django REST Framework API with decoupled routing, weather, and risk classification services. Weather data is queried from Open-Meteo, and driving routes are generated using Mapbox Directions.*
>
> *Let's jump into the core workflow."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [0:50 – 2:15] 2. INPUTS & ROUTE GENERATION (Evaluation: 40% Logic & Routes)  │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Left sidebar form (`PlaceInput`, Departure time, Load weight, Checkpoint interval).

**What to Do:**
1. Point to the preset buttons at the top (*Denver → Colorado Springs*, *Chicago → Minneapolis*, *Seattle → Portland*). Click **Denver → Colorado Springs**.
2. Show that the inputs auto-populate.
3. Show the departure picker and interval selector (10, 25, 50 miles).
4. Click **Calculate Safest Routes**.

**What to Say:**
> *"The user specifies four core inputs:*
> 1. *Origin and destination, backed by Mapbox Geocoding autocomplete.*
> 2. *Departure date and time with ISO timezone offsets.*
> 3. *Load weight in pounds, which directly affects wind risk thresholds.*
> 4. *The weather sampling interval: 10, 25, or 50 miles.*
>
> *When we click 'Calculate Safest Routes', our Django backend requests driving alternatives from Mapbox Directions. It interpolates checkpoints along each route geometry using a Voronoi midpoint partitioning algorithm.*
>
> *Notice that three alternative routes were generated. The active selected route is highlighted in electric cyan with a soft highway glow, while the alternatives are cleanly rendered in muted tones for quick visual comparison."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [2:15 – 4:00] 3. RISK ENGINE & RECOMMENDATION (Evaluation: 40% Logic)       │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Click the **Risk Rules** button in the top navigation bar to open the rules modal, then inspect the Route Cards.

**What to Say:**
> *"Let's look at how safety is calculated. At each checkpoint, we compute the truck's estimated arrival time (ETA) based on proportional distance and duration, and fetch the exact forecast for that hour.*
>
> *We classify conditions according to the assessment's thresholds:*
> - *Wind: Low under 25 mph, Moderate up to 34, High up to 44, Severe up to 54, and No Travel at 55 mph or above.*
> - *Rain: Severe between 0.50 and 1.00 in/hr, No Travel above 1.00 in/hr.*
> - *Snow: Severe between 2.0 and 3.0 in/hr, No Travel above 3.0 in/hr.*
>
> *Crucially, we enforce the truck load weight rules:*
> 1. *Wind $\ge 55$ mph is No Travel for any load.*
> 2. *Wind between 45 and 54 mph with load over 30,000 lb triggers No Travel.*
> 3. *Wind between 35 and 44 mph with load over 40,000 lb escalates from High to Severe.*
>
> *For route recommendation, the assessment specifies a strict preference order:*
> 1. *Fewest Severe miles (with No Travel prioritized)*
> 2. *Fewest High miles*
> 3. *Lowest average risk*
> 4. *Shortest travel time*
>
> *We implement this via native Python lexicographical tuple comparison in `risk/engine.py`. Notice how Route 1 is recommended with the 'Recommended' badge because it minimizes exposure to hazardous segments, even if another route might be slightly shorter in total miles."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [4:00 – 6:15] 4. MAPBOX HEATMAP & 0–48H SLIDER (Evaluation: 40% UI & Map)   │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** The Mapbox map and the `WeatherTimeline` slider.

**What to Do:**
1. Zoom in on the route corridor to show the **glowing Mapbox `heatmap` layer** beneath the route line.
2. Use the floating map controls: toggle between **Risk**, **Wind**, and **Rain** heatmap modes.
3. Drag the **0–48 Hour Forecast Slider** smoothly from 0 to 48 hours. Show how the average metrics and heatmap intensity adapt.
4. Click **Play Loop** to demonstrate the automatic 48-hour weather simulation.
5. Click a checkpoint circle on the map to show the rich popup card.

**What to Say:**
> *"Now let's examine the interactive map and weather heatmap, which represents 40% of the evaluation criteria.*
>
> *Along the entire corridor, we render a native Mapbox GL JS `heatmap` layer with dynamic density weighting based on the risk scores at that position. This creates a continuous risk corridor around the highway.*
>
> *Below the map is our 0–48 Hour Forecast Slider. As we drag this slider from departure to 48 hours out, the corridor points immediately re-evaluate future weather conditions. The average wind, rain, and snowfall metrics update dynamically, and the peak corridor risk is displayed in real-time.*
>
> *We've also added a 'Play Loop' feature that simulates the arrival and departure of storm fronts across the 48-hour forecast window.*
>
> *We can toggle the map inspection mode between 'ETA Time' (conditions when the truck is scheduled to arrive at each mile) and 'Slider Hour' (the weather snapshot at hour $T+h$). Clicking any checkpoint opens a detailed card with mile marker, ETA, forecasted wind and rain, and the governing safety explanation."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [6:15 – 7:30] 5. CHECKPOINT ANALYSIS DRAWER (Evaluation: 40% UI Polish)     │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Expand the **Checkpoint Weather Analysis** drawer below the timeline.

**What to Do:**
1. Expand the accordion.
2. Click the filter buttons: **All**, **Alerts (Mod+)**, and **High / Severe**.
3. Highlight a checkpoint with a governing reason text.

**What to Say:**
> *"Under the map, we provide a full Checkpoint Weather Analysis breakdown.*
>
> *Commercial drivers need quick, actionable information. We provide one-click filters for 'Alerts (Mod+)' and 'High / Severe' so the driver can isolate only the hazardous stretches.*
>
> *Each card shows the exact mile marker, the representative segment span, the arrival ETA, weather values, and an explicit governing reason explaining why this risk level was assigned—for example, if a heavy load escalated moderate wind into severe risk."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [7:30 – 8:45] 6. CODE QUALITY & TEST SUITE (Evaluation: 15% Code Quality)  │
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Terminal running the Django unit tests.

**What to Do:**
1. Run `python manage.py test risk routing weather`.
2. Show `Ran 16 tests in 0.025s — OK`.
3. Briefly show `risk/engine.py` and `routing/route_service.py` in the code editor.

**What to Say:**
> *"Next, let's look at code quality and automated testing.*
>
> *The Django backend is strictly decoupled into three modular apps:*
> - *`routing`: Handles Mapbox Directions API queries and Haversine distance interpolation.*
> - *`weather`: Batches Open-Meteo multi-coordinate requests and aligns UTC arrival hours.*
> - *`risk`: Pure mathematical business logic for classifying conditions and lexicographical sorting.*
>
> *To guarantee correctness, we have 16 comprehensive unit tests covering all threshold boundaries (such as 24.9 vs 25.0 mph wind, 1.0 vs 1.01 in/hr rain), load rule overrides (40,001 lb heavy load escalation), segment distance conservation via Voronoi partitioning, and API error handling.*
>
> *Let's run the full test suite live: as you can see, all 16 tests pass in 25 milliseconds with zero warnings."*

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [8:45 – 9:30] 7. CONCLUSION & DELIVERABLES (Evaluation: Deliverables & Wrap)│
└────────────────────────────────────────────────────────────────────────────┘
```
**On Screen:** Browser displaying the full app and `README.md`.

**What to Say:**
> *"To summarize our deliverables:*
> 1. *Our GitHub repository contains the full source code, comprehensive unit tests, Docker configurations, and a deployment blueprint.*
> 2. *The application is configured for one-click cloud deployment on Render and Vercel.*
> 3. *All functional requirements—multi-route generation, ETA weather matching, load rules, lexicographical recommendation, and corridor heatmap with 0–48h forecast simulation—are 100% complete with a focus on correctness and safety.*
>
> *Thank you for your time and for reviewing my submission!"*
```
