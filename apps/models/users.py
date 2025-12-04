from django.contrib.auth.models import AbstractUser
from django.db.models import CharField, ImageField, DateField, BooleanField

from apps.models.manager import UserManager


class User(AbstractUser):
    phone = CharField(max_length=15, unique=True)
    username = CharField(max_length=33, null=True, blank=True, unique=True)
    first_name = CharField(max_length=65, blank=True)
    last_name = CharField(max_length=150, null=True, blank=True)
    birth_date = DateField(null=True, blank=True)
    bio = CharField(max_length=70, null=True, blank=True)
    is_online = BooleanField(default=False, db_default=False)
    image = ImageField(upload_to='users/images/%Y/%m/%d', null=True, blank=True)

    objects = UserManager()

    # password = None
    email = None

    USERNAME_FIELD = 'phone'
    EMAIL_FIELD = None
    REQUIRED_FIELDS = []

    @property
    def full_name(self):
        return self.first_name + ' ' + self.last_name
