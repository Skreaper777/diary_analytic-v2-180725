from django.contrib import admin, messages
from django import forms
from django.shortcuts import redirect
from django.urls import path
from django.template.response import TemplateResponse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.conf import settings

import os
import pandas as pd
from slugify import slugify

from .models import Entry, EntryValue, Parameter
from .importers.excel_entry_importer import import_excel_dataframe


# 📥 Форма для загрузки Excel-файла
class ExcelImportForm(forms.Form):
    excel_file = forms.FileField(label="Excel-файл с данными")


@admin.register(Parameter)
class ParameterAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "is_active")
    search_fields = ("key", "name")
    list_filter = ("is_active",)
    fields = ("key", "name", "is_active", "description")
    # actions = None

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("import-excel/", self.admin_site.admin_view(self.import_excel), name="import_excel"),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["import_button"] = format_html(
            '<a class="button" href="import-excel/">📥 Импорт из Excel</a>'
        )
        return super().changelist_view(request, extra_context=extra_context)

    def import_excel(self, request):
        form = ExcelImportForm(request.POST or None, request.FILES or None)

        if request.method == "POST" and form.is_valid():
            try:
                df = pd.read_excel(form.cleaned_data["excel_file"])
                created, updated = import_excel_dataframe(df)
                self.message_user(request, f"✅ Импорт завершён. Создано: {created}, обновлено: {updated}", messages.SUCCESS)
                return redirect("..")
            except Exception as e:
                self.message_user(request, f"❌ Ошибка при импорте: {e}", messages.ERROR)
                return redirect("..")

        context = {
            "title": "Импорт Excel-файла с Entry и параметрами",
            "form": form,
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/import_excel.html", context)


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ("date", "get_values")
    list_filter = ("date",)
    search_fields = ("date",)
    date_hierarchy = "date"

    def get_values(self, obj):
        values = obj.entryvalue_set.select_related("parameter")
        return ", ".join(f"{v.parameter.name}: {v.value}" for v in values)
    get_values.short_description = "Значения параметров"


@admin.register(EntryValue)
class EntryValueAdmin(admin.ModelAdmin):
    list_display = ("entry", "parameter", "value")
    list_filter = ("parameter", "entry__date")
    search_fields = ("parameter__name", "entry__date")
    date_hierarchy = "entry__date"
