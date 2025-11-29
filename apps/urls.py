from django.urls import path

from apps.views import SendCodeAPIView, VerifyCodeAPIView

urlpatterns = [
    path('auth/send-code', SendCodeAPIView.as_view(), name='send_code'),
    path('auth/verify-code', VerifyCodeAPIView.as_view(), name='verify_code'),
]
