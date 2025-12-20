import re
from typing import Any

from rest_framework.exceptions import ValidationError
from rest_framework.fields import IntegerField, CharField
from rest_framework.serializers import Serializer, ModelSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import UntypedToken, RefreshToken

from apps.models import User
from apps.utils import check_phone, normalize_phone
from root import settings


class UserModelSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = 'id', 'phone', 'first_name', 'last_name', 'bio'


class UserProfileUpdateModelSerializer(ModelSerializer):
    username = CharField(max_length=120)

    class Meta:
        model = User
        fields = 'id', 'first_name', 'last_name', 'birth_date', 'bio', 'image', 'username'

    def validate_username(self, value: str):
        value = re.sub(r"[^a-z]", "", value.lower())
        if User.objects.filter(username=value).exists():
            raise ValidationError({'message': 'username already exists'})
        return value


class SendCodeSerializer(Serializer):
    phone = CharField(default='998901001010')

    def validate_phone(self, phone):
        return normalize_phone(phone)


class VerifyCodeSerializer(Serializer):
    phone = CharField(default='998901001010')
    code = IntegerField()

    def validate_phone(self, phone):
        return normalize_phone(phone)

    def validate(self, attrs: dict[str, Any]) -> dict[Any, Any]:
        is_valid = check_phone(**attrs)
        if not is_valid:
            raise ValidationError({'message': 'invalid or expired code'})

        self.user, self.is_new = User.objects.get_or_create(phone=attrs['phone'])

        return attrs

    def get_data(self):
        refresh = self.get_token(self.user)
        user_data = UserModelSerializer(self.user).data

        tokens = {
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh)
        }
        data = {
            'message': 'success',
            "data": {**tokens, **user_data, 'is_new': self.is_new}
        }
        return data

    @classmethod
    def get_token(cls, user):
        return RefreshToken.for_user(user)  # type: ignore

    # first_name = CharField(max_length=255, default='Alijon')
    # last_name = CharField(max_length=255, default='Valiyev', allow_blank=True)


class CustomTokenVerifySerializer(Serializer):
    token = CharField(write_only=True)

    def validate(self, attrs):
        token = UntypedToken(attrs["token"])
        user_id = token.get('user_id')
        if not User.objects.filter(id=user_id).exists():
            raise ValidationError({'message': 'invalid or expired token'})
        if (
                api_settings.BLACKLIST_AFTER_ROTATION
                and "rest_framework_simplejwt.token_blacklist" in settings.INSTALLED_APPS
        ):
            jti = token.get(api_settings.JTI_CLAIM)
            if BlacklistedToken.objects.filter(token__jti=jti).exists():
                raise ValidationError("Token is blacklisted")

        return {}
