# diary_analytic/forms.py

from django import forms
from .models import Entry

# ----------------------------------------
# 📝 Форма EntryForm — редактирование дня
# ----------------------------------------

class EntryForm(forms.ModelForm):
    """
    Форма, привязанная к модели Entry.
    Используется только для поля комментария (comment).
    """

    class Meta:
        model = Entry

        # Мы разрешаем редактировать только поле 'comment'
        fields = ['comment']

        # Настраиваем виджет ввода
        widgets = {
            'comment': forms.Textarea(attrs={
                'rows': 3,
                'placeholder': 'Добавьте комментарий к дню...',
                'class': 'form-control',
            })
        }

        # Подсказка (label) рядом с полем
        labels = {
            'comment': 'Комментарий к дню',
        }
