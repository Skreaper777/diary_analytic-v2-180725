from diary_analytic.models import Entry, EntryValue, Parameter
from slugify import slugify
import pandas as pd


def import_excel_dataframe(df, message_callback=None):
    """
    Импортирует значения Entry и параметры из DataFrame (Excel).
    Совпадает по логике с импортом из admin.py (актуальная версия).

    :param df: pandas.DataFrame с данными (первая колонка — дата, остальные — параметры)
    :param message_callback: функция для сообщений (например, для вывода предупреждений)
    :return: (created, updated) — количество созданных и обновлённых EntryValue
    """
    columns = [col.strip() for col in df.columns]
    df.columns = columns

    if len(columns) < 2:
        raise ValueError("Файл должен содержать дату и хотя бы один параметр")

    param_cache = {p.name_ru.strip(): p for p in Parameter.objects.all()}
    param_counter = len(param_cache)
    entries = {}
    entry_values_to_create = []
    entry_values_to_update = []
    existing_entry_values = {
        (ev.entry_id, ev.parameter_id): ev
        for ev in EntryValue.objects.select_related("entry", "parameter")
    }

    for index, row in df.iterrows():
        date_str = str(row[columns[0]]).strip()
        try:
            entry_date = pd.to_datetime(date_str).date()
        except Exception as e:
            if message_callback:
                message_callback(f"⚠️ Пропущена строка с некорректной датой '{date_str}': {e}")
            continue

        if entry_date not in entries:
            entries[entry_date], _ = Entry.objects.get_or_create(date=entry_date)

        entry = entries[entry_date]

        for col in columns[1:]:
            value = row[col]
            if pd.isnull(value):
                continue

            name_ru = col.strip()
            param = param_cache.get(name_ru)

            if not param:
                key = slugify(name_ru)
                if not key:
                    param_counter += 1
                    key = f"param_{param_counter}"
                param = Parameter.objects.create(name=name_ru, key=key)
                param_cache[name_ru] = param

            key_tuple = (entry.id, param.id)
            if key_tuple in existing_entry_values:
                ev = existing_entry_values[key_tuple]
                ev.value = float(value)
                entry_values_to_update.append(ev)
            else:
                ev = EntryValue(entry=entry, parameter=param, value=float(value))
                entry_values_to_create.append(ev)

    if entry_values_to_create:
        EntryValue.objects.bulk_create(entry_values_to_create)
    if entry_values_to_update:
        EntryValue.objects.bulk_update(entry_values_to_update, ["value"])

    return len(entry_values_to_create), len(entry_values_to_update)
