import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "root.settings")

django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import path

from apps.consumers import ChatConsumer
from apps.middlewares import JWTAuthMiddlewareStack

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(AllowedHostsOriginValidator(
        URLRouter([
            path("chat", ChatConsumer.as_asgi()),
        ])
    ))
})
