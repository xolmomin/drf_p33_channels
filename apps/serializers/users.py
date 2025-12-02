from typing import Any

from rest_framework.exceptions import ValidationError
from rest_framework.fields import CharField, IntegerField
from rest_framework.serializers import Serializer, ModelSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.models import User
from apps.utils import check_phone, normalize_phone


class UserModelSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = 'id', 'phone', 'first_name', 'last_name', 'bio'


class UserProfileUpdateModelSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = 'first_name', 'last_name', 'birth_date', 'bio', 'image', 'username'


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
