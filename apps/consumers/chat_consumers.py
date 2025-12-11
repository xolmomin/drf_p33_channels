from asgiref.sync import sync_to_async

from apps.consumers import CustomAsyncJsonWebsocketConsumer
from apps.models import User, Chat


class ChatConsumer(CustomAsyncJsonWebsocketConsumer):

    @sync_to_async
    def create_private(self, from_user, _user):
        chat, created = Chat.create_private(from_user, _user)
        return chat

    @sync_to_async
    def get_user_chats(self):
        # Foydalanuvchi a'zo bo'lgan barcha chat ID larini olish
        return list(self.from_user.chats.values_list('id', flat=True))

    @sync_to_async
    def is_member(self, chat_id):
        # Foydalanuvchi shu chatda bormi?
        return self.from_user.chats.filter(id=chat_id).exists()

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
        self.from_user = self.scope['user']

        if not self.from_user.is_authenticated:
            await self.accept()
            await self.send_json({'error': 'Unauthorized'})
            await self.close()
            return

        await self.accept()

        # Foydalanuvchi kirganida uni o'zining barcha chat guruhlariga qo'shish
        self.user_chats = await self.get_user_chats()
        for chat_id in self.user_chats:
            await self.channel_layer.group_add(str(chat_id), self.channel_name)

        await self.change_status(True)

    # async def connect(self):
    #
    #     # Join room group
    #     await self.channel_layer.group_add(self.chat_room, self.channel_name)
    #     await self.accept()
    #
    #     self.from_user: User = self.scope['user']
    #     if not self.from_user.is_authenticated:
    #         await self.send_json({'message': 'jwt token bilan kir'})
    #         await self.channel_layer.group_discard(self.chat_room, self.channel_name)
    #         await self.close()
    #         return
    #
    #     await self.join_chats()
    #     await self.change_status()

    # async def disconnect(self, close_code):
    #     await self.change_status(False)
    #     await self.channel_layer.group_discard(self.chat_room, self.channel_name)

    async def disconnect(self, close_code):
        # Disconnect bo'lganda guruhlardan chiqarish
        for chat_id in getattr(self, 'user_chats', []):
            await self.channel_layer.group_discard(str(chat_id), self.channel_name)

        if hasattr(self, 'from_user'):
            await self.change_status(False)

    async def receive_json(self, content, **kwargs):
        required_fields = {'message', 'chat_id'}
        result = required_fields.intersection(set(content))
        if not (len(result) == len(required_fields) and result == required_fields):
            await self.send_json({'message': f"required fields '{', '.join(required_fields)}'"})
            return

        self.chat_id = content['chat_id']
        self.chat = await Chat.objects.filter(id=self.chat_id).afirst()

        if self.chat_id is None or self.chat is None:
            _user = await User.objects.filter(id=self.chat_id).afirst()
            if _user is None:
                await self.send_json({'message': "Chat not found"})
                return
            self.chat = await self.create_private(self.from_user, _user)

            content['chat_id'] = self.chat.id

        await self.save_msg(from_user_id=self.from_user.id, **content)

        message = content["message"]

        await self.channel_layer.group_send(
            str(content['chat_id']),
            {
                "type": "chat.message",
                "message": message,
                "chat_id": self.chat_id,
                "from": self.from_user.id
            }
        )

    async def chat_message(self, event):
        if self.from_user.id != event['from']:
            await self.send_json(event)
