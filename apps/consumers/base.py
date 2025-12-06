import ujson
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.models import Message, User


class CustomAsyncJsonWebsocketConsumer(AsyncJsonWebsocketConsumer):

    @classmethod
    async def decode_json(cls, text_data):
        return ujson.loads(text_data)

    @classmethod
    async def encode_json(cls, content):
        return ujson.dumps(content)

    async def save_msg(self, **data):
        await Message.objects.acreate(**data)

    async def get_user(self, user_id):
        try:
            return await User.objects.aget(id=user_id)
        except User.DoesNotExist:
            return None
