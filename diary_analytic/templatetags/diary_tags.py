from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """
    Получает значение из словаря по ключу.
    Используется в шаблонах для доступа к значениям словаря.
    """
    return dictionary.get(key) 