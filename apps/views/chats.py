from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListCreateAPIView, ListAPIView, RetrieveDestroyAPIView, \
    DestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.models import Chat, User, Message
from apps.serializers import MessageListModelSerializer, ChatListModelSerializer, ChatCreateModelSerializer, \
    UserListModelSerializer


@extend_schema(tags=['Chats'])
class ChatClearAPIView(DestroyAPIView):
    queryset = Chat.objects.all()
    permission_classes = IsAuthenticated,

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(members=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance: Chat = self.get_object()
        instance.messages.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=['Chats'])
class ChatListCreateAPIView(ListCreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatListModelSerializer
    permission_classes = IsAuthenticated,

    def get_serializer_class(self):
        if self.request.method == 'POST':
            self.serializer_class = ChatCreateModelSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(members=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = ChatCreateModelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _type = serializer.validated_data['type']
        if _type == 'private':
            obj, created = Chat.create_private(request.user, serializer.member_id)
        else:
            obj, created = Chat.create_group(request.user)
            obj.name = serializer.validated_data['name']
            obj.save(update_fields=['name'])

        return Response(serializer.data, status.HTTP_201_CREATED)


@extend_schema(tags=['Chats'])
class ChatRetrieveDestroyAPIView(RetrieveDestroyAPIView):
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
        user = self.request.user
        qs = super().filter_queryset(queryset)
        return qs.exclude(id=user.id)[:3]


@extend_schema(tags=['Chats'])
class MessageListAPIView(ListAPIView):
    queryset = Message.objects.order_by('created_at')
    serializer_class = MessageListModelSerializer
    permission_classes = IsAuthenticated,

    def get_queryset(self):
        qs = super().get_queryset()
        chat_id = self.kwargs.get('chat_id')
        qs = qs.filter(chat_id=chat_id)
        qs.exclude(from_user_id=self.request.user).update(is_read=True)
        return qs
