from django.db.models import TextField, ForeignKey, SET_NULL, ManyToManyField, CASCADE, ImageField, Count
from django.db.models.enums import TextChoices
from django.db.models.fields import CharField, BooleanField

from apps.models.base import CreatedBaseModel


class Chat(CreatedBaseModel):
    class Type(TextChoices):
        PRIVATE = 'private', 'Private'
        GROUP = 'group', 'Group'

    name = CharField(max_length=70, null=False, blank=True)
    image = ImageField(upload_to='group/images/%Y/%m/%d', null=True, blank=True)
    type = CharField(max_length=10, choices=Type.choices, default=Type.PRIVATE)
    members = ManyToManyField('apps.User', related_name='chats')

    def __str__(self):
        return self.name

    @property
    def last_message(self):
        return self.messages.first()

    @property
    def unread_count(self):
        return self.messages.filter(is_read=False).count()

    @property
    def last_message_time(self):
        if msg:=self.messages.first():
            return msg.created_at
        return None

    @staticmethod
    def create_group(initiator_user):
        """Yangi guruh chatini yaratadi (mavjudligini tekshirmaydi)."""
        chat = Chat.objects.create(type=Chat.Type.GROUP, name="Yangi Guruh")
        chat.members.add(initiator_user)
        return chat, True

    @staticmethod
    def create_private(user1, user2):
        """
        user1 va user2 orasida mavjud bo'lgan shaxsiy chatni qidiradi.
        Agar topilmasa, yangisini yaratadi.
        """
        # 1. Shaxsiy chat mavjudligini tekshirish:
        # Chat turi 'PRIVATE' bo'lishi,
        # va chat a'zolari orasida user1 va user2 lar bo'lishi shart.
        existing_chat = Chat.objects.filter(
            type=Chat.Type.PRIVATE,
            members=user1
        ).filter(
            members=user2
        ).annotate(
            # Ixtiyoriy: Faqat 2 ta a'zosi borligini tekshirish (aniqlik uchun)
            member_count=Count('members')
        ).filter(
            member_count=2
        ).first()

        if existing_chat:
            return existing_chat, False  # Chat topildi

        # 2. Yangi shaxsiy chatni yaratish:
        # name maydoni bo'sh qoldiriladi
        new_chat = Chat.objects.create(type=Chat.Type.PRIVATE)
        new_chat.members.add(user1, user2)  # Ikkala foydalanuvchini qo'shish

        return new_chat, True  # Yangi chat yaratildi

    def add_member(self, user):
        """Chatga yangi a'zo qo'shish (asosan Group uchun)."""
        self.members.add(user)

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

    def __str__(self):
        return self.message[:20]

    class Meta:
        ordering = '-created_at',
