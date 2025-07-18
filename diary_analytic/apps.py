from django.apps import AppConfig


class DiaryAnalyticConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'diary_analytic'

    def ready(self):
        import diary_analytic.signals
