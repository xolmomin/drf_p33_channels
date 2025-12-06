from drf_spectacular.utils import extend_schema
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListCreateAPIView, ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from apps.models import Chat, User, Message
from apps.serializers import MessageListModelSerializer, ChatListModelSerializer, ChatCreateModelSerializer, \
    UserListModelSerializer


@extend_schema(tags=['Chats'])
class ChatListCreateAPIView(ListCreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatListModelSerializer
    permission_classes = IsAuthenticated,

    def get_serializer_class(self):
        if self.request.method == 'post':
            self.serializer_class = ChatCreateModelSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(members=self.request.user)


@extend_schema(tags=['Chats'])
class ChatRetrieveAPIView(RetrieveAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatListModelSerializer
    permission_classes = IsAuthenticated,

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(members=self.request.user)


@extend_schema(tags=['Chats'])
class UserListAPIView(ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserListModelSerializer
    permission_classes = IsAuthenticated,
    filter_backends = SearchFilter,
    search_fields = '^username',

    def filter_queryset(self, queryset):
        return super().filter_queryset(queryset)[:3]


@extend_schema(tags=['Chats'])
class MessageListAPIView(ListAPIView):
    queryset = Message.objects.order_by('created_at')
    serializer_class = MessageListModelSerializer
    permission_classes = IsAuthenticated,

    def get_queryset(self):
        qs = super().get_queryset()
        chat_id = self.kwargs.get('chat_id')
        return qs.filter(chat_id=chat_id)
