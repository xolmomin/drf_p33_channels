from django.urls import path

from apps.views import UserListAPIView, CustomTokenVerifyView, CustomTokenRefreshView, ChatListCreateAPIView, \
    SendCodeAPIView, VerifyCodeAPIView, UserProfileRetrieveUpdateAPIView, \
    UserDeleteAccountDestroyAPIView
from apps.views.chats import ChatRetrieveAPIView, MessageListAPIView

urlpatterns = [
    # Auth & User
    path('auth/send-code', SendCodeAPIView.as_view(), name='send_code'),
    path('auth/verify-code', VerifyCodeAPIView.as_view(), name='verify_code'),
    path('auth/verify-token', CustomTokenVerifyView.as_view(), name='verify_token'),
    path('auth/refresh-token', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('profile', UserProfileRetrieveUpdateAPIView.as_view(), name='profile_update'),
    path('delete-account', UserDeleteAccountDestroyAPIView.as_view(), name='delete_account'),

    # Chats
    path('chats', ChatListCreateAPIView.as_view(), name='chat_list_create'),
    path('chats/<int:pk>', ChatRetrieveAPIView.as_view(), name='chat_detail'),
    path('users', UserListAPIView.as_view(), name='user_list'),
    path('chats/<int:chat_id>/messages', MessageListAPIView.as_view(), name='chat_message_list'),
]
