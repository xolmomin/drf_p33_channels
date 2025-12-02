from rest_framework.fields import IntegerField, ListField
from rest_framework.serializers import ModelSerializer

from apps.models import Chat


class ChatListModelSerializer(ModelSerializer):
    class Meta:
        model = Chat
        fields = 'id', 'name', 'type'


class ChatCreateModelSerializer(ModelSerializer):
    chat_id = IntegerField()

    class Meta:
        model = Chat
        fields = 'name', 'chat_id'

    def validate(self, attrs):
        chat = attrs.get('type')
        return attrs
