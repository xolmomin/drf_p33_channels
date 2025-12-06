from django.utils.timezone import now
from rest_framework.fields import IntegerField, ListField, CharField, DateTimeField
from rest_framework.serializers import ModelSerializer

from apps.models import Chat, User, Message


class ChatListModelSerializer(ModelSerializer):
    unread_count = IntegerField(default=2, read_only=True)
    is_online = IntegerField(default=False, read_only=True)
    last_message = CharField(default='oxirgi xabar', read_only=True)
    last_message_time = DateTimeField(default=now(), read_only=True, format='%H:%M:%S')

    class Meta:
        model = Chat
        fields = 'id', 'name', 'type', 'image', 'unread_count', 'is_online', 'last_message', 'last_message_time'

    def to_representation(self, instance: Chat):
        repr = super().to_representation(instance)
        request = self.context['request']
        current_user = request.user
        if instance.is_private:
            second_user = instance.members.exclude(id=current_user.id).first()
            if second_user.image and hasattr(second_user.image, 'url'):
                repr['image'] = request.build_absolute_uri(second_user.image.url)
            else:
                repr['image'] = None
            repr['name'] = second_user.full_name
            repr['is_online'] = second_user.is_online
        return repr


class ChatCreateModelSerializer(ModelSerializer):
    chat_id = IntegerField()

    class Meta:
        model = Chat
        fields = 'name', 'chat_id'

    def validate(self, attrs):
        chat = attrs.get('type')
        return attrs


class UserListModelSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = 'id', 'username', 'first_name', 'last_name', 'image'


class MessageListModelSerializer(ModelSerializer):
    class Meta:
        model = Message
        fields = '__all__'
