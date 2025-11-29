from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.serializers import SendCodeSerializer, VerifyCodeSerializer
from apps.utils import send_code


class SendCodeAPIView(APIView):
    serializer_class = SendCodeSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        valid, _ttl = send_code(data['phone'])
        if valid:
            return Response({'message': "sms code sent"})

        return Response({'message': f'You have {_ttl} seconds left'})


class VerifyCodeAPIView(APIView):
    serializer_class = VerifyCodeSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.get_data(), status=status.HTTP_201_CREATED)
