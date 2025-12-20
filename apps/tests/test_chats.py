import pytest
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken

from apps.models import User, Chat
from root.asgi import application


@pytest.mark.asyncio
@pytest.mark.django_db
class TestChatWebSocket:
    @sync_to_async
    def create_private_chat(self, user1, user2):
        return Chat.create_private(user1, user2)

    @pytest.fixture
    async def setup_users(self):
        # 2 ta foydalanuvchi yaratish
        self.user1 = await User.objects.acreate(phone='901001011', password='1')
        self.user2 = await User.objects.acreate(phone='901001012', password='1')

        # Ular uchun shaxsiy chat yaratish (ID: 2 bo'lishi uchun)
        self.chat, created = await self.create_private_chat(self.user1, self.user2)

        self.token1 = await self.get_token(self.user1)
        self.token2 = await self.get_token(self.user2)

    async def get_token(self, user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)

    async def test_websocket_message_exchange(self, setup_users):
        user1_ws = WebsocketCommunicator(application, f"/chat?auth={self.token1}")
        connected1, _ = await user1_ws.connect()
        assert connected1

        user2_ws = WebsocketCommunicator(application, f"/chat?auth={self.token2}")
        connected2, _ = await user2_ws.connect()
        assert connected2

        # Test xabari
        payload = {
            "message": "Salom, bu test xabari",
            "chat_id": self.chat.id
        }

        # User 1 xabar yuboradi
        await user1_ws.send_json_to(payload)

        # User 2 xabarni qabul qilishi kerak
        response = await user2_ws.receive_json_from()
        response = await user2_ws.receive_json_from()

        # Kelgan xabar formatini tekshirish
        assert response["message"] == payload['message']
        assert response["chat_id"] == self.chat.id
        assert response["from"] == self.user1.id

        # Ulanishlarni yopish
        await user1_ws.disconnect()
        await user2_ws.disconnect()
