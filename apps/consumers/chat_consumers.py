from apps.consumers import CustomAsyncJsonWebsocketConsumer


class ChatConsumer(CustomAsyncJsonWebsocketConsumer):
    room_name = 'chat'

    async def connect(self):
        kwargs = self.scope['url_route']['kwargs']
        self.name = kwargs.get('name')

        # Join room group
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

        await self.notify_status()

    async def disconnect(self, close_code):
        await self.notify_status(False)
        await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def notify_status(self, is_online=True):
        if is_online:
            message = f'{self.name} is online'
            status = 'online'
        else:
            message = f'{self.name} is offline'
            status = 'offline'

        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "chat.message",
                "message": message,
                "status": status,
                "from": self.name
            }
        )

    async def receive_json(self, content, **kwargs):
        message = content["message"]

        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "chat.message",
                "message": message,
                "from": self.name
            }
        )

    async def chat_message(self, event):
        event.pop('type')
        await self.send_json(event)
