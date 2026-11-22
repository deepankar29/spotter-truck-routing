from django.contrib import admin
from django.urls import path, re_path
from django.http import HttpResponse, FileResponse
from pathlib import Path
from routing.views import health, plan_routes

BASE_DIR = Path(__file__).resolve().parent.parent

def serve_spa(request, path=""):
    # Try serving static asset directly if requested (e.g. assets/...)
    if path:
        for possible_dir in [BASE_DIR / "staticfiles", BASE_DIR / "frontend_dist", BASE_DIR.parent / "frontend" / "dist"]:
            target = possible_dir / path
            if target.is_file():
                return FileResponse(open(target, "rb"))

    # Otherwise return index.html for SPA client-side routing
    for index_path in [
        BASE_DIR / "staticfiles" / "index.html",
        BASE_DIR / "frontend_dist" / "index.html",
        BASE_DIR.parent / "frontend" / "dist" / "index.html",
    ]:
        if index_path.is_file():
            with open(index_path, "r", encoding="utf-8") as f:
                return HttpResponse(f.read(), content_type="text/html")

    return HttpResponse("Spotter API running. Visit /api/health/ for API status.")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/plan/", plan_routes, name="plan-routes"),
    re_path(r"^(?P<path>.*)$", serve_spa, name="spa"),
]
