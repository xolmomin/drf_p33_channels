from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.models import Chat
from apps.serializers.chats import ChatListModelSerializer


@extend_schema(tags=['Chats'])
class ChatListCreateAPIView(ListCreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatListModelSerializer
    permission_classes = IsAuthenticated,

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(members=self.request.user)
