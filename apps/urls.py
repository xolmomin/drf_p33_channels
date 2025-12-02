from django.urls import path

from apps.views import CustomTokenRefreshView, ChatListCreateAPIView, SendCodeAPIView, VerifyCodeAPIView, UserProfileUpdateAPIView, \
    UserDeleteAccountDestroyAPIView

urlpatterns = [
    # Auth & User
    path('auth/send-code', SendCodeAPIView.as_view(), name='send_code'),
    path('auth/verify-code', VerifyCodeAPIView.as_view(), name='verify_code'),
    path('auth/refresh-token', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('profile', UserProfileUpdateAPIView.as_view(), name='profile_update'),
    path('delete-account', UserDeleteAccountDestroyAPIView.as_view(), name='delete_account'),

    # Chats
    path('chats', ChatListCreateAPIView.as_view(), name='chat_list_create'),
]
