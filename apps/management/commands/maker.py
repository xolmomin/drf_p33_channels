from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.models import ChatRoom, Message


class Command(BaseCommand):
    help = 'Create test data for chat application'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating test data...')

        # Create users
        users_data = [
            {'username': 'alice', 'email': 'alice@example.com', 'password': 'password123'},
            {'username': 'bob', 'email': 'bob@example.com', 'password': 'password123'},
            {'username': 'charlie', 'email': 'charlie@example.com', 'password': 'password123'},
            {'username': 'diana', 'email': 'diana@example.com', 'password': 'password123'},
            {'username': 'emma', 'email': 'emma@example.com', 'password': 'password123'},
        ]

        users = []
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                email=user_data['email']
            )
            if created:
                user.set_password(user_data['password'])
                user.save()
                self.stdout.write(f'Created user: {user.username}')
            users.append(user)

        alice, bob, charlie, diana, emma = users

        # Create private chat
        private_room, created = ChatRoom.objects.get_or_create(
            name='Alice - Bob',
            room_type='private',
            created_by=alice
        )
        private_room.members.add(alice, bob)
        if created:
            self.stdout.write('Created private chat: Alice - Bob')

            # Add some messages
            Message.objects.create(
                room=private_room,
                sender=alice,
                content='Hey Bob, how are you?'
            )
            Message.objects.create(
                room=private_room,
                sender=bob,
                content='Hi Alice! I\'m good, thanks!'
            )

        # Create group chat
        group_room, created = ChatRoom.objects.get_or_create(
            name='Engineering Team',
            room_type='group',
            created_by=alice
        )
        group_room.members.add(alice, bob, charlie, diana, emma)
        if created:
            self.stdout.write('Created group chat: Engineering Team')

            # Add some messages
            Message.objects.create(
                room=group_room,
                sender=alice,
                content='Welcome to the Engineering Team chat!'
            )
            Message.objects.create(
                room=group_room,
                sender=bob,
                content='Thanks! Excited to be here.'
            )
            Message.objects.create(
                room=group_room,
                sender=charlie,
                content='Let\'s build something great!'
            )

        self.stdout.write(self.style.SUCCESS('Test data created successfully!'))
        self.stdout.write('')
        self.stdout.write('Test users created (all with password: password123):')
        for user in users:
            self.stdout.write(f'  - {user.username}')
