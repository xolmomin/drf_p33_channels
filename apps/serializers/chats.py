from rest_framework.serializers import ModelSerializer

from apps.models import Chat


class ChatListModelSerializer(ModelSerializer):
    class Meta:
        model = Chat
        fields = '__all__'


class ChatCreateModelSerializer(ModelSerializer):
    class Meta:
        model = Chat
        fields = '__all__'
