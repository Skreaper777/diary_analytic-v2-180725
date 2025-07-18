# diary_analytic/utils.py

"""
📊 utils.py — утилиты для работы с данными

Основная функция:
    - get_diary_dataframe() — превращает данные из моделей Entry, Parameter, EntryValue
      в широкую таблицу для обучения и прогнозирования моделей.
    - get_today_row(date) — извлекает строку параметров за конкретный день
"""

import pandas as pd
from datetime import date
from .models import EntryValue, Entry, Parameter
import os
from .loggers import db_logger


# --------------------------------------------------------------------
# 📈 Получение данных в формате DataFrame для ML
# --------------------------------------------------------------------

def get_diary_dataframe() -> pd.DataFrame:
    """
    Собирает все записи пользователя в виде «широкой» таблицы:
        - строки: даты (Entry.date)
        - столбцы: параметры (Parameter.key)
        - значения: значения параметров (EntryValue.value)

    Используется:
        - для обучения моделей (`train`)
        - для формирования today_row (`predict_today`)
        - для анализа истории

    📦 Пример выходного DataFrame:

        |     date     | toshn | ustalost | trevozhnost |
        |--------------|-------|----------|-------------|
        | 2025-05-10   | 1.0   | 2.0      | 4.0         |
        | 2025-05-11   | 0.0   | NaN      | 3.0         |
        | 2025-05-12   | NaN   | 1.0      | NaN         |

    :return: pd.DataFrame, индексированный по дате
    """

    # Извлекаем все значения параметров, связанных с Entry и Parameter
    values = EntryValue.objects.select_related("entry", "parameter")

    # Создаём список словарей (удобно для передачи в DataFrame)
    rows = []
    for val in values:
        rows.append({
            "date": val.entry.date,             # Дата (строка = день)
            "parameter": val.parameter.key,     # Название параметра (ключ)
            "value": val.value                  # Значение от 0.0 до 5.0
        })

    # Преобразуем в "узкий" DataFrame
    df = pd.DataFrame(rows)

    if df.empty:
        return pd.DataFrame()  # если данных нет — вернуть пустую таблицу

    # Преобразуем из узкого формата в "широкий":
    # было: date | parameter | value
    # станет: date | toshn | ustalost | ...
    df = df.pivot(index="date", columns="parameter", values="value")

    # Убедимся, что даты отсортированы (на всякий случай)
    df.sort_index(inplace=True)

    # Можно заполнить пропуски, если нужно (по ТЗ: только при обучении)
    # df.fillna(0.0, inplace=True)

    return df


# --------------------------------------------------------------------
# 📅 Получение строки за один день (для модели)
# --------------------------------------------------------------------

def get_today_row(target_date: date) -> dict:
    """
    Возвращает словарь параметров за указанную дату.

    Используется для:
        - передачи в модель при прогнозировании на конкретную дату

    Пропуски (NaN) исключаются из результата.

    :param target_date: дата, за которую нужна строка
    :return: dict — { "ustalost": 2.0, "toshn": 0.0, ... }
    """

    df = get_diary_dataframe()
    if df.empty or target_date not in df.index:
        return {}

    return df.loc[target_date].dropna().to_dict()


def export_diary_to_csv(filepath=None):
    """
    Экспортирует все значения параметров в CSV-файл (широкий формат, как Короткая таблица3.csv).
    Также создает отдельный лист/файл с описаниями параметров.
    ВНИМАНИЕ: если вы переименовали ключ параметра, старые экспортированные файлы будут содержать старый ключ.
    При необходимости обновляйте их вручную.
    :param filepath: путь к файлу (по умолчанию other/export.csv)
    """
    if filepath is None:
        filepath = os.path.join("other", "export.csv")

    try:
        # Получаем все параметры (по name, как в примере)
        parameters = list(Parameter.objects.order_by("name"))
        param_keys = [p.key for p in parameters]
        param_names = [p.name for p in parameters]

        # Получаем все Entry (даты)
        entries = list(Entry.objects.order_by("-date"))

        # Формируем строки для DataFrame
        data = []
        for entry in entries:
            row = {"Дата": entry.date.strftime("%d.%m.%y")}
            values = {ev.parameter_id: ev.value for ev in entry.entryvalue_set.all()}
            for p in parameters:
                val = values.get(p.id, None)
                if val is None:
                    row[p.name] = ""
                else:
                    row[p.name] = int(val)
            data.append(row)

        import pandas as pd
        df = pd.DataFrame(data)
        # Ставим "Дата" первым столбцом, остальные — как в param_names
        columns = ["Дата"] + param_names
        df = df[columns]

        # Экспорт основной таблицы
        if filepath.endswith('.xlsx'):
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, encoding="utf-8-sig", sheet_name="Данные")
                # Описания параметров на отдельном листе
                desc_df = pd.DataFrame({
                    "Ключ": [p.key for p in parameters],
                    "Название": [p.name for p in parameters],
                    "Описание": [p.description or "" for p in parameters],
                })
                desc_df.to_excel(writer, index=False, encoding="utf-8-sig", sheet_name="Описания параметров")
        else:
            # CSV: сохраняем основной файл и отдельный файл с описаниями
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            desc_path = filepath.replace('.csv', '_descriptions.csv')
            desc_df = pd.DataFrame({
                "Ключ": [p.key for p in parameters],
                "Название": [p.name for p in parameters],
                "Описание": [p.description or "" for p in parameters],
            })
            desc_df.to_csv(desc_path, index=False, encoding="utf-8-sig")
        db_logger.info(f"✅ Экспорт данных в CSV завершён: {filepath}, строк: {len(df)}")
    except Exception as e:
        db_logger.exception(f"❌ Ошибка при экспорте данных в CSV: {e}")
