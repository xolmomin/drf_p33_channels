import ujson

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class CustomAsyncJsonWebsocketConsumer(AsyncJsonWebsocketConsumer):

    @classmethod
    async def decode_json(cls, text_data):
        return ujson.loads(text_data)

    @classmethod
    async def encode_json(cls, content):
        return ujson.dumps(content)
