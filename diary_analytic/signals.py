from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import EntryValue
from .models import Parameter
from .utils import export_diary_to_csv

@receiver(post_save, sender=EntryValue)
def entryvalue_saved(sender, instance, **kwargs):
    export_diary_to_csv()

@receiver(post_delete, sender=EntryValue)
def entryvalue_deleted(sender, instance, **kwargs):
    export_diary_to_csv()

@receiver(post_save, sender=Parameter)
def parameter_saved(sender, instance, **kwargs):
    export_diary_to_csv() 