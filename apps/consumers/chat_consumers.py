from asgiref.sync import sync_to_async
from django.shortcuts import aget_object_or_404
from rest_framework.generics import get_object_or_404

from apps.consumers import CustomAsyncJsonWebsocketConsumer
from apps.models import Message, User, Chat


class ChatConsumer(CustomAsyncJsonWebsocketConsumer):

    @property
    def chat_room(self):
        return 'chat_1_2'

    @sync_to_async
    def get_chats(self):
        return list(Chat.objects.filter(members=self.from_user).values_list('id', flat=True))

    async def join_chats(self):
        """
        hozirgi userning barcha chatlariga ulanish
        """
        self.chats = await self.get_chats()
        for group in self.chats:
            await self.channel_layer.group_add(str(group), self.channel_name)

    async def change_status(self, is_online=True):
        self.from_user.is_online = is_online
        await self.from_user.asave(update_fields=['is_online'])
        # for chat in self.chats:
        #     await self.channel_layer.group_send(
        #         str(chat),
        #         {
        #             "type": "chat.message",
        #             "chat_id": self.from_user.id,
        #             "status": is_online,
        #         }
        #     )

    async def connect(self):

        # Join room group
        await self.channel_layer.group_add(self.chat_room, self.channel_name)
        await self.accept()

        self.from_user: User = self.scope['user']
        if not self.from_user.is_authenticated:
            await self.send_json({'message': 'jwt token bilan kir'})
            await self.channel_layer.group_discard(self.chat_room, self.channel_name)
            await self.close()
            return

        await self.join_chats()
        await self.change_status()

    async def disconnect(self, close_code):
        await self.change_status(False)
        await self.channel_layer.group_discard(self.chat_room, self.channel_name)

    async def receive_json(self, content, **kwargs):
        required_fields = {'message', 'chat_id'}
        result = required_fields.intersection(set(content))
        if not (len(result) == len(required_fields) and result == required_fields):
            await self.send_json({'message': f"required fields '{', '.join(required_fields)}'"})
            return

        self.chat_id = content['chat_id']
        self.chat = await Chat.objects.filter(id=self.chat_id).afirst()

        if self.chat_id is None or self.chat is None:
            await self.send_json({'message': "Chat not found"})
            return

        await self.save_msg(from_user_id=self.from_user.id, **content)

        message = content["message"]

        await self.channel_layer.group_send(
            self.chat_room,
            {
                "type": "chat.message",
                "message": message,
                "chat_id": self.chat_id,
                "from": self.from_user.id
            }
        )

    async def chat_message(self, event):
        await self.send_json(event)
