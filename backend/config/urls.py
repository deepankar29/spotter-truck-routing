from django.contrib import admin
from django.urls import path
from routing.views import health, plan_routes

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/plan/", plan_routes, name="plan-routes"),
]
