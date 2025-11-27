import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import path

from apps.consumers import ChatConsumer

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "root.settings")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        URLRouter([
            path("chat/<str:name>", ChatConsumer.as_asgi()),
        ])
    ),
})
