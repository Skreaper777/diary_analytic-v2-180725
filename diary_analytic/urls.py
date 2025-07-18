# diary_analytic/urls.py

from django.urls import path
from . import views

# -----------------------------------------------------------
# 🧭 Маршруты для приложения дневника состояния
#
# Эти пути подключаются к корневому urls.py через include(...)
# Пример: config/urls.py → path("", include("diary_analytic.urls"))
# -----------------------------------------------------------

urlpatterns = [
    # -----------------------------------------------------------
    # 📄 /add/
    # Страница ввода дневника на определённую дату
    # Ожидает GET-параметр ?date=YYYY-MM-DD
    # Отображает форму, параметры и прогнозы
    # -----------------------------------------------------------
    path("add/", views.add_entry, name="add_entry"),

    # -----------------------------------------------------------
    # 🔘 /update_value/
    # Обновление одного значения параметра (0–5)
    # Ожидает POST-запрос с JSON:
    # {
    #   "parameter": "ustalost",
    #   "value": 3,
    #   "date": "2025-05-12"
    # }
    # Возвращает JSON: {"success": true}
    # -----------------------------------------------------------
    path("update_value/", views.update_value, name="update_value"),

    # API: история значений параметра
    path("api/parameter_history/", views.parameter_history, name="parameter_history"),

    # API: описание параметра (GET/POST)
    path("api/get_parameter_description/", views.get_parameter_description, name="get_parameter_description"),
    path("api/set_parameter_description/", views.set_parameter_description, name="set_parameter_description"),

    # API: переименование параметра
    path("api/rename_parameter/", views.rename_parameter, name="rename_parameter"),
]
