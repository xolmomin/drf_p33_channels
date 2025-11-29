import re
from random import randint

from django.conf import settings
from django.core.cache import cache
from redis import Redis
from rest_framework import status
from rest_framework.exceptions import ValidationError


def get_login_data(value):
    return f"login:{value}"


def send_code(phone: str, expired_time=360):
    redis = Redis.from_url(settings.CACHES['default']['LOCATION'])
    _phone = get_login_data(phone)
    _ttl = redis.ttl(f':1:{_phone}')
    code = randint(100_000, 999_999)

    # if _ttl > 0:
    #     return False, _ttl

    print(f'{phone} == Code: {code}')

    cache.set(_phone, code, expired_time)
    return True, 0


def check_phone(phone: str, code: int):
    _phone = get_login_data(phone)
    _code = cache.get(f"{_phone}")
    if _code is None:
        raise ValidationError('Invalid code or phone number', status.HTTP_404_NOT_FOUND)
    is_valid = _code == code
    if is_valid:
        cache.delete(_phone)
    return is_valid


def normalize_phone(value):
    digits = re.findall(r'\d', value)
    if len(digits) < 9:
        raise ValidationError('Phone number must be at least 9 digits')
    return ''.join(digits)
