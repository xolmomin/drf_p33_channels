from apps.consumers import CustomAsyncJsonWebsocketConsumer
from apps.models import Message, User


class ChatConsumer(CustomAsyncJsonWebsocketConsumer):

    @property
    def chat_room(self):
        return 'chat_1_2'

    async def connect(self):

        # Join room group
        await self.channel_layer.group_add(self.chat_room, self.channel_name)
        await self.accept()

        self.from_user = self.scope['user']
        if not self.from_user.is_authenticated:
            await self.send_json({'message': 'jwt token bilan kir'})
            await self.channel_layer.group_discard(self.chat_room, self.channel_name)
            await self.close()
            return

        await self.notify_status()

    async def disconnect(self, close_code):
        await self.notify_status(False)
        await self.channel_layer.group_discard(self.chat_room, self.channel_name)

    async def notify_status(self, is_online=True):
        if is_online:
            message = f'{self.from_user.first_name} is online'
            status = 'online'
        else:
            message = f'{self.from_user.first_name} is offline'
            status = 'offline'

        await self.channel_layer.group_send(
            self.chat_room,
            {
                "type": "chat.message",
                "message": message,
                "status": status,
                "from": self.from_user.first_name
            }
        )

    async def save_db(self, **data):
        await Message.objects.acreate(**data)

    async def get_user(self, user_id):
        try:
            return await User.objects.aget(id=user_id)
        except User.DoesNotExist:
            return None

    async def receive_json(self, content, **kwargs):

        required_fields = {'message', 'to_user_id'}
        result = required_fields.intersection(set(content))
        if not (len(result) == len(required_fields) and result == required_fields):
            await self.send_json({'message': f"required fields '{', '.join(required_fields)}'"})
            return

        self.to_user = await self.get_user(content['to_user_id'])
        if self.to_user is None or self.to_user == self.from_user:
            await self.send_json({'message': "Chat not found"})
            return

        await self.save_db(from_user_id=self.from_user.id, **content)

        message = content["message"]

        await self.channel_layer.group_send(
            self.chat_room,
            {
                "type": "chat.message",
                "message": message,
                "from": self.from_user.first_name
            }
        )

    async def chat_message(self, event):
        event.pop('type', None)
        await self.send_json(event)
