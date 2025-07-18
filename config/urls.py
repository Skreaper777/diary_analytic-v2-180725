"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from diary_analytic.views import retrain_models_all, get_predictions

from django.shortcuts import redirect
from datetime import date


urlpatterns = [
    path("get_predictions/", get_predictions, name="get_predictions"),
    path("retrain_models_all/", retrain_models_all, name="retrain_models_all"),

    path('admin/', admin.site.urls),

    # ⬇️ 👇 редирект с корня "/" на /add/?date=YYYY-MM-DD
    path("", lambda request: redirect(f"/add/?date={date.today().isoformat()}")),

    path("", include("diary_analytic.urls")),
]
