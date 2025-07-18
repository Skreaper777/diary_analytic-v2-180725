import pandas as pd
from sklearn.linear_model import LinearRegression
import logging
import datetime
import os

logger = logging.getLogger(__name__)

# Логгер для отладки входных данных
logs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(logs_dir, exist_ok=True)
my_test_log_path = os.path.join(logs_dir, 'my_test.log')
base_model_log_path = os.path.join(logs_dir, 'base_model.log')

# Логгер для base_model.log
base_model_logger = logging.getLogger("base_model")
base_model_logger.handlers.clear()
base_model_logger.propagate = False  # Отключаем передачу логов root-логгеру
try:
    base_model_handler = logging.FileHandler(base_model_log_path, mode="a", encoding="utf-8")
    base_model_handler.setFormatter(logging.Formatter("[%(asctime)s] %(message)s"))
    base_model_logger.addHandler(base_model_handler)
    base_model_logger.setLevel(logging.DEBUG)
except Exception as e:
    # Если не удалось создать логгер, ничего не делаем
    pass

# Логгер для отладки входных данных
my_test_logger = logging.getLogger("my_test")
my_test_logger.handlers.clear()
try:
    my_test_handler = logging.FileHandler(my_test_log_path, mode="a", encoding="utf-8")
    my_test_handler.setFormatter(logging.Formatter("[%(asctime)s] %(message)s"))
    my_test_logger.addHandler(my_test_handler)
    my_test_logger.setLevel(logging.DEBUG)
except Exception as e:
    base_model_logger.error("Ошибка при создании my_test_handler: %s", e)

DROP_ALWAYS = ["date", "Дата", "дата", "index"]

def train_model(
    df: pd.DataFrame,
    target: str,
    *,
    exclude: list[str] | None = None,
):
    base_model_logger.info("=== train_model вызван для target=%s ===", target)
    my_test_logger.debug("=== train_model вызван для target=%s ===", target)
    if exclude is None:
        exclude = []
    df = df.reset_index()
    drop_cols = DROP_ALWAYS + exclude + [target]
    X = df.drop(columns=drop_cols, errors="ignore")

    # Логируем shape и типы исходных данных
    base_model_logger.debug(f"=== train_model: target={target} ===")
    base_model_logger.debug(f"df.shape: {df.shape}")
    base_model_logger.debug(f"df.dtypes: {df.dtypes}")
    base_model_logger.debug(f"df.head():\n{df.head()}\n")
    base_model_logger.debug(f"X.shape: {X.shape}")
    base_model_logger.debug(f"X.dtypes: {X.dtypes}")
    base_model_logger.debug(f"X.head():\n{X.head()}\n")
    base_model_logger.debug(f"X unique types: {[set(type(x) for x in X[col]) for col in X.columns]}")

    # Удаляем все столбцы, где есть хотя бы одно значение типа date/datetime
    def has_date_value(series):
        return any(isinstance(x, (datetime.date, datetime.datetime)) for x in series)
    date_cols = [col for col in X.columns if has_date_value(X[col])]
    if date_cols:
        logger.warning("Удаляю столбцы с датами: %s", date_cols)
        X = X.drop(columns=date_cols)
        my_test_logger.debug(f"Удалены столбцы с датами: {date_cols}")

    # Оставляем только числовые признаки
    # X = X.select_dtypes(include=["number"]).fillna(0.0)
    y = df[target]

    # Удаляем строки, где y == NaN
    mask_y = ~y.isna()
    X = X[mask_y]
    y = y[mask_y]

    # ⛔️ Удаляем строки, где хотя бы один признак X — NaN
    mask_X = ~X.isna().any(axis=1)
    X = X[mask_X]
    y = y[mask_X]
    base_model_logger.debug(f"Удалено строк с NaN в признаках: {len(mask_y) - mask_X.sum()}")
    my_test_logger.debug(f"Удалено строк с NaN в признаках: {len(mask_y) - mask_X.sum()}")

    my_test_logger.debug(f"y.name: {y.name}")
    my_test_logger.debug(f"y.dtype: {y.dtype}")
    my_test_logger.debug(f"y.head():\n{y.head()}\n")
    my_test_logger.debug(f"y unique types: {set(type(x) for x in y)}")
    my_test_logger.debug(f"--- END train_model: target={target} ---\n")

    # 🛡 Если целевая переменная не числовая — пропускаем
    if not pd.api.types.is_numeric_dtype(df[target]):
        logger.warning("train_model: Целевая переменная %s не числовая (тип %s), обучение пропущено", target, df[target].dtype)
        return {"model": None, "features": []}

    logger.debug("train_model: target=%s, X_shape=%s, exclude=%s", target, X.shape, exclude)
    logger.debug("train_model: X.columns = %s", list(X.columns))

    for h in logger.handlers:
        try:
            h.flush()
        except Exception:
            pass

    if X.shape[1] == 0:
        logger.warning("train_model: Пропущено обучение для '%s' — нет признаков (X пуст)", target)
        for h in logger.handlers:
            try:
                h.flush()
            except Exception:
                pass
        return {"model": None, "features": []}

    model = LinearRegression()
    model.fit(X, y)

    logger.debug("trained %s: intercept=%.3f", target, model.intercept_)
    for h in logger.handlers:
        try:
            h.flush()
        except Exception:
            pass

    return {"model": model, "features": X.columns.tolist()} 