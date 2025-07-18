# Импортируем модуль template из Django для создания пользовательских фильтров
from django import template
from diary_analytic.loggers import web_logger

# Создаем экземпляр Library для регистрации пользовательских фильтров
register = template.Library()

@register.filter
def get(dictionary, key):
    """
    Пользовательский фильтр для безопасного получения значения из словаря по ключу.
    
    Args:
        dictionary (dict): Словарь, из которого нужно получить значение
        key: Ключ, по которому нужно получить значение
        
    Returns:
        Значение из словаря по указанному ключу или None, если ключ не найден
        
    Пример использования в шаблоне:
        {{ values_map|get:param.key }}
        
    Это безопасная альтернатива прямому доступу к словарю через квадратные скобки,
    так как метод .get() не вызовет исключение, если ключ отсутствует в словаре.
    """
    value = dictionary.get(key)
    web_logger.debug(f"[template filter get] key={key}, value={value}, type={type(value)}")
    return value

@register.filter
def float(value):
    """
    Пользовательский фильтр для преобразования строки в число с плавающей точкой.
    
    Args:
        value: Значение для преобразования (строка или число)
        
    Returns:
        float: Число с плавающей точкой или 0.0 в случае ошибки
        
    Пример использования в шаблоне:
        {{ "3.14"|float }}
    """
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0 