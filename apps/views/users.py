from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import DestroyAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.models import User
from apps.serializers import UserProfileUpdateModelSerializer, SendCodeSerializer, VerifyCodeSerializer, \
    CustomTokenVerifySerializer
from apps.utils import send_code


@extend_schema(tags=['Auth & Users'])
class UserDeleteAccountDestroyAPIView(DestroyAPIView):
    queryset = User.objects.all()
    permission_classes = IsAuthenticated,

    def get_object(self):
        return self.request.user


@extend_schema(tags=['Auth & Users'])
class UserProfileRetrieveUpdateAPIView(RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserProfileUpdateModelSerializer
    permission_classes = IsAuthenticated,

    def get_object(self):
        return self.request.user


@extend_schema(tags=['Auth & Users'])
class SendCodeAPIView(APIView):
    serializer_class = SendCodeSerializer
    authentication_classes = ()

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        valid, _ttl = send_code(data['phone'])
        if valid:
            return Response({'message': "sms code sent"})

        return Response({'message': f'You have {_ttl} seconds left'})


@extend_schema(tags=['Auth & Users'])
class CustomTokenRefreshView(TokenRefreshView):
    pass




@extend_schema(tags=['Auth & Users'])
class CustomTokenVerifyView(TokenVerifyView):
    serializer_class = CustomTokenVerifySerializer

    def post(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e

        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@extend_schema(tags=['Auth & Users'])
class VerifyCodeAPIView(APIView):
    serializer_class = VerifyCodeSerializer
    authentication_classes = ()

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.get_data(), status=status.HTTP_201_CREATED)
