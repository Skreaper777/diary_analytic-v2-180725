# diary_analytic/models.py

from django.db import models

# -------------------------------
# 📅 Модель Entry (день в дневнике)
# -------------------------------

class Entry(models.Model):
    # Уникальная дата записи (1 строка = 1 день)
    date = models.DateField(unique=True)

    # Комментарий пользователя за день (необязательный)
    comment = models.TextField(blank=True)

    def __str__(self):
        # Отображение в админке: Entry for 2025-05-12
        return f"Entry for {self.date}"

    # Пример: Entry.objects.get(date="2025-05-12") → возвращает объект записи на эту дату


# ------------------------------------------
# 📌 Модель Parameter (тип отслеживаемого параметра)
# ------------------------------------------

class Parameter(models.Model):
    # Внутренний ключ (например: "toshn", "ustalost")
    key = models.CharField(max_length=100, unique=True)

    # Название параметра для отображения в интерфейсе
    name = models.CharField(max_length=255)

    # Флаг активности — позволяет временно исключать параметр из UI и расчётов
    is_active = models.BooleanField(default=True)

    # Многострочное описание параметра (опционально)
    description = models.TextField(blank=True, default="")

    def __str__(self):
        # Отображение в админке: "Настроение"
        return self.name

    # Пример: Parameter(key="toshn", name="Тошнота", is_active=True)


# ------------------------------------------------
# 📈 Модель EntryValue (значение параметра за день)
# ------------------------------------------------

class EntryValue(models.Model):
    # Ссылка на запись дня (Entry)
    entry = models.ForeignKey(Entry, on_delete=models.CASCADE)

    # Ссылка на тип параметра (Parameter)
    parameter = models.ForeignKey(Parameter, on_delete=models.CASCADE)

    # Значение параметра (от 0.0 до 5.0)
    value = models.FloatField()

    class Meta:
        # Уникальность по паре: один параметр может быть задан один раз в один день
        unique_together = ('entry', 'parameter')

    def __str__(self):
        # Отображение в админке: "toshn = 3.0 (2025-05-12)"
        return f"{self.parameter.key} = {self.value} ({self.entry.date})"

    # Пример: EntryValue(entry=Entry(...), parameter=Parameter(...), value=3.0)

