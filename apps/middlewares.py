import traceback

from channels.auth import AuthMiddlewareStack
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from jwt import DecodeError, ExpiredSignatureError, InvalidSignatureError
from jwt import decode as jwt_decode

from apps.models import User


class JWTAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        close_old_connections()
        try:
            # headers = {}
            # for key, val in scope['headers']:
            #     key = key.decode('utf8')
            #     key = key.lower()
            #     val = val.decode('utf8')
            #     headers[key] = val
            # Change header jwt to query_params jwt

            if jwt_token_list := scope.get('query_string'):
                jwt_token_list = jwt_token_list.decode('utf8')
                jwt_token = str(jwt_token_list).split('auth=')[-1]
                jwt_payload = self.get_payload(jwt_token)
                scope['user'] = await self.get_user(jwt_payload['user_id'])
            else:
                scope['user'] = AnonymousUser()
        except (InvalidSignatureError, KeyError, ExpiredSignatureError, DecodeError):
            traceback.print_exc()
        except Exception:
            scope['user'] = AnonymousUser()
        return await self.app(scope, receive, send)

    def get_payload(self, jwt_token):
        return jwt_decode(jwt_token, settings.SECRET_KEY, settings.SIMPLE_JWT['ALGORITHM'])

    async def get_user(self, user_id):
        try:
            return await User.objects.aget(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()


def JWTAuthMiddlewareStack(app):
    return JWTAuthMiddleware(AuthMiddlewareStack(app))
