# diary_analytic/loggers.py

import logging
import os
from datetime import datetime

# -------------------------------------------------------------------
# 📁 Каталог для логов
# -------------------------------------------------------------------

# Получаем абсолютный путь до директории /logs, находящейся в корне проекта
# (на один уровень выше текущего файла, т.е. выше diary_analytic/)
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")

# Если каталог logs ещё не создан — создаём его (иначе FileNotFoundError)
os.makedirs(LOG_DIR, exist_ok=True)

# -------------------------------------------------------------------
# 🧰 Универсальная функция для создания логгера
# -------------------------------------------------------------------

def setup_logger(name: str, logfile: str) -> logging.Logger:
    """
    Унифицированный способ создания логгера для разных подсистем проекта.

    :param name: внутреннее имя логгера (например, 'web', 'predict')
    :param logfile: имя файла, в который будут писаться логи
    :return: объект Logger, настроенный на вывод в отдельный лог-файл

    📌 Преимущества:
    - Логгеры создаются централизованно
    - Каждый файл логирует свою подсистему
    - Формат логов читаемый и стабилен
    """

    # Абсолютный путь до файла логов (например: /logs/web.log)
    path = os.path.join(LOG_DIR, logfile)

    # Очищаем лог при каждом запуске, чтобы не копить старое (mode="w" на старте)
    open(path, 'w').close()

    # Создаём экземпляр логгера
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  # Отслеживаем всё, включая отладку

    # Создаём обработчик логов, записывающий в файл
    handler = logging.FileHandler(path, mode="a", encoding="utf-8")

    # Настраиваем читаемый формат строки лога
    formatter = logging.Formatter("[%(asctime)s] [%(name)s] [%(funcName)s] — %(message)s")
    handler.setFormatter(formatter)

    # Привязываем обработчик к логгеру
    logger.addHandler(handler)

    # Отключаем буферизацию на уровне логгера
    logger.propagate = False

    # Принудительно сбрасываем буфер после каждой записи
    handler.flush = lambda: handler.stream.flush()

    # Возвращаем готовый логгер
    return logger

# -------------------------------------------------------------------
# 🔧 Готовые логгеры под конкретные подсистемы
# -------------------------------------------------------------------

# Стандартные логгеры, управляются через LOGGING в settings.py
web_logger = logging.getLogger('web')
predict_logger = logging.getLogger('predict')
db_logger = logging.getLogger('db')
error_logger = logging.getLogger('error')

# Создаем логгер для ошибок
error_logger = logging.getLogger("error")
error_logger.setLevel(logging.ERROR)
error_handler = logging.FileHandler(os.path.join(LOG_DIR, "error.log"), encoding="utf-8")
error_handler.setFormatter(logging.Formatter("[%(asctime)s] [%(name)s] [%(funcName)s] — %(message)s"))
error_logger.addHandler(error_handler)

# Функция для перенаправления ошибок в error.log
def log_error(logger_name, error_msg, exc_info=None):
    error_logger.error(f"[{logger_name}] {error_msg}", exc_info=exc_info)

# Настраиваем перенаправление ошибок для всех логгеров
for logger in [web_logger, predict_logger, db_logger]:
    class ErrorHandler(logging.Handler):
        def emit(self, record):
            if record.levelno >= logging.ERROR:
                log_error(record.name, record.getMessage(), record.exc_info)
    
    logger.addHandler(ErrorHandler())

# Логируем инициализацию
web_logger.info("🚀 Инициализирован web-логгер")
predict_logger.info("🚀 Инициализирован predict-логгер")
db_logger.info("🚀 Инициализирован db-логгер")
error_logger.info("🚀 Инициализирован error-логгер")

# Очищаем все логи при запуске
LOG_FILES = [
    'web.log',
    'predict.log',
    'db.log',
    'error.log',
]

for fname in LOG_FILES:
    path = os.path.join(LOG_DIR, fname)
    try:
        open(path, 'w').close()
    except Exception:
        pass
