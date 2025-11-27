from django.contrib.auth.models import AbstractUser
from django.db.models.fields import CharField


class User(AbstractUser):
    phone = CharField(max_length=15, unique=True)
    username = CharField(max_length=33, null=True, blank=True, unique=True)
    first_name = CharField(max_length=65)
    last_name = CharField(max_length=150, null=True, blank=True)
    bio = CharField(max_length=70, null=True, blank=True)
