# diary_analytic/predictor_manager.py

"""
🧠 PredictorManager — диспетчер стратегий прогнозирования

Назначение:
    - централизованно управляет обучением и прогнозами;
    - абстрагирует вызов разных моделей: base_model, flags_model и др.;
    - изолирует ML-логику от views и других частей Django-приложения;
    - логирует ключевые шаги: выбор стратегии, исключения признаков, ошибки.

Используется во вьюхах:
    - для предсказаний:    manager.predict_today(strategy=..., ...)
    - для обучения модели: manager.train(strategy=..., ...)
"""

from diary_analytic.ml_utils import get_model
from .loggers import predict_logger
import os
import pandas as pd
from pprint import pformat
import joblib
from diary_analytic.models import Parameter


# -------------------------------------------------------------
# 📦 Общая точка входа для всех моделей прогнозирования
# -------------------------------------------------------------

class PredictorManager:
    """
    Класс, управляющий вызовом нужной модели в зависимости от стратегии.
    """

    def __init__(self, strategy: str):
        self.strategy = strategy
        self.model_module = get_model(strategy)

    def save_model(self, model, features, target):
        """
        Сохраняет модель и признаки в .pkl-файл.
        """
        model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "diary_analytic", "trained_models", self.strategy)
        os.makedirs(model_dir, exist_ok=True)
        file_path = os.path.join(model_dir, f"{target}.pkl")
        joblib.dump({"model": model, "features": features}, file_path)
        predict_logger.info(f"[save_model] ✅ Модель сохранена: {file_path}")

    def save_model_coefs(self, model, features, target):
        """
        Сохраняет коэффициенты и признаки модели в CSV-файл для последующего анализа.
        Теперь в столбце 'feature' выводятся не key, а name.
        """
        predict_logger.info(f"[save_model_coefs] Попытка сохранить коэффициенты. Модель: {type(model)}, features: {features}")
        if model and hasattr(model, "coef_"):
            try:
                # Получаем отображение key -> name
                key_to_name = {p.key: p.name for p in Parameter.objects.all()}
                feature_names = [key_to_name.get(f, f) for f in features]
                coef_df = pd.DataFrame({
                    "feature": feature_names,
                    "coef": model.coef_
                })
                coef_df["intercept"] = model.intercept_
                export_dir = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    "diary_analytic", "trained_models", self.strategy, "csv"
                )
                os.makedirs(export_dir, exist_ok=True)
                export_path = os.path.join(export_dir, f"{target}_{self.strategy}_coefs.csv")
                predict_logger.info(f"[save_model_coefs] Сохраняю CSV по пути: {export_path}")
                coef_df.to_csv(export_path, index=False)
                predict_logger.info(f"[save_model_coefs] CSV успешно сохранён: {export_path}")
            except Exception as e:
                predict_logger.error(f"[save_model_coefs] Ошибка при сохранении CSV: {e}")
        else:
            predict_logger.warning(f"[save_model_coefs] Модель не имеет coef_ или model=None. model: {type(model)}, features: {features}")

    def train(self, df):
        """
        Обучает все параметры (кроме служебных) по выбранной стратегии.
        :param df: датафрейм всех записей пользователя
        :return: список результатов по каждому target
        """
        results = []
        for target in df.columns:
            if target in ("date", "Дата", "comment"):
                continue
            predict_logger.info(f"[train] ▶️ Стратегия: {self.strategy}, target={target}, df.columns={list(df.columns)}")
            try:
                result = self.model_module.train_model(df.copy(), target=target, exclude=[])
                model = result.get("model")
                features = result.get("features")
                if model:
                    self.save_model(model, features, target)
                    self.save_model_coefs(model, features, target)
                    msg = f"[{self.strategy}] ✅ Обучено и сохранено: {target}"
                    predict_logger.info("[train] " + msg)
                    results.append(msg)
                else:
                    msg = f"[{self.strategy}] ⚠️ Пропущено: {target}"
                    predict_logger.warning("[train] " + msg)
                    results.append(msg)
            except Exception as e:
                msg = f"[{self.strategy}] ❌ Ошибка при обучении {target}: {e}"
                predict_logger.exception("[train] " + msg)
                results.append(msg)
        return results

    # -----------------------------------------------------------------
    # 🔮 Прогнозирование текущего дня по выбранной стратегии
    # -----------------------------------------------------------------

    def predict_today(self, strategy: str, model, today_row: dict) -> float:
        """
        Выполняет прогноз значения параметра на сегодня.

        :param strategy: название стратегии (например, 'base')
        :param model: обученная модель, возвращённая из train()
        :param today_row: словарь значений параметров за сегодня (может быть неполным)

        :return: float-прогноз (или np.nan/null при невозможности)
        """
        predict_logger.debug(f"📥 [predict_today] Стратегия: {strategy}, Данные: {today_row}")
        try:
            if strategy == "base":
                return get_model("base").predict(model["model"], model["features"], today_row)
            elif strategy == "flags":
                return get_model("flags").predict(model["model"], model["features"], today_row) 
            else:
                raise ValueError(f"❌ Неизвестная стратегия предсказания: {strategy}")

        except Exception as e:
            predict_logger.error(f"🔥 Ошибка в predict_today (стратегия: {strategy}) — {str(e)}")
            return None

    def predict_for_date(self, date):
        """
        Возвращает прогнозы по всем параметрам для выбранной даты.
        :param date: дата (datetime.date)
        :return: dict {param_key: value, ...}
        """
        from diary_analytic.utils import get_today_row
        import os
        import joblib
        import pandas as pd
        row = get_today_row(date)
        predictions = {}
        # Путь к папке с моделями данной стратегии
        model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "diary_analytic", "trained_models", self.strategy)
        if not os.path.exists(model_dir):
            return predictions
        for fname in os.listdir(model_dir):
            if not fname.endswith(".pkl"):
                continue
            param_key = fname.replace(".pkl", "")
            model_path = os.path.join(model_dir, fname)
            try:
                model_dict = joblib.load(model_path)
                if isinstance(model_dict, dict) and "model" in model_dict:
                    model = model_dict["model"]
                    features = model_dict.get("features", None)
                else:
                    model = model_dict
                    features = None
                # Формируем вход для модели
                if features is not None:
                    X = pd.DataFrame([{f: row.get(f, 0.0) for f in features}])
                    value = float(model.predict(X)[0])
                elif hasattr(model, 'feature_names_in_'):
                    X = pd.DataFrame([{f: row.get(f, 0.0) for f in model.feature_names_in_}])
                    value = float(model.predict(X)[0])
                else:
                    X = pd.DataFrame([row])
                    value = float(model.predict(X)[0])
                predictions[param_key] = round(value, 2)
            except Exception as e:
                predictions[param_key] = None
        return predictions
