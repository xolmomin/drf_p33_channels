from django.db.models import TextField, ForeignKey, SET_NULL, ManyToManyField, CASCADE
from django.db.models.enums import TextChoices
from django.db.models.fields import CharField, BooleanField

from apps.models.base import CreatedBaseModel


class Chat(CreatedBaseModel):
    class Type(TextChoices):
        PRIVATE = 'private', 'Private'
        GROUP = 'group', 'Group'

    name = CharField(max_length=70)
    type = CharField(max_length=10, choices=Type.choices, default=Type.PRIVATE)
    members = ManyToManyField('apps.User', related_name='chats')

    @property
    def is_group(self):
        return self.type == self.Type.GROUP

    @property
    def is_private(self):
        return self.type == self.Type.PRIVATE

    def is_member(self, user_id) -> bool:
        return user_id in self.members.values_list('id', flat=True)


class Message(CreatedBaseModel):
    message = TextField()
    chat = ForeignKey('apps.Chat', CASCADE, related_name='messages')

    from_user = ForeignKey('apps.User', SET_NULL, null=True, related_name='from_messages')

    is_read = BooleanField(default=False, db_default=False)
    is_edited = BooleanField(default=False, db_default=False)

    def edit(self):
        self.is_edited = True
        self.save(update_fields=['is_edited'])

    def read(self):
        self.is_read = True
        self.save(update_fields=['is_read'])
