from django import template

register = template.Library()

@register.filter
def split_param_title(value):
    """Разбивает строку по :: и возвращает список кортежей (уровень, текст)"""
    parts = [part.strip() for part in value.split('::')]
    return list(enumerate(parts)) 