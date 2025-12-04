from django.contrib import admin
from django.utils.safestring import mark_safe

from apps.models import User, Chat, Message


@admin.register(User)
class UserModelAdmin(admin.ModelAdmin):
    list_display = 'phone', 'username', 'full_name'
    search_fields = 'phone', 'username', 'first_name', 'last_name'


@admin.register(Chat)
class ChatModelAdmin(admin.ModelAdmin):
    list_display = 'id', 'name', 'type', 'all_member', 'members_count'
    filter_horizontal = ['members']

    @admin.display(description='Member')
    def all_member(self, obj: Chat):
        text = ''
        for phone in obj.members.values_list('phone', flat=True):
            text += f'{phone}<br>'
        return mark_safe(text)

    @admin.display(description='Member count')
    def members_count(self, obj: Chat):
        return obj.members.count()


@admin.register(Message)
class MessageModelAdmin(admin.ModelAdmin):
    list_display = '__str__', 'from_user__phone', 'chat__type', 'chat__name'
