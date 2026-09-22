import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

from .models import Message


User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if user is None or user.is_anonymous:
            await self.close()
            return

        self.user = user
        self.group_name = f"chat_user_{user.id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self.channel_layer is not None:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "error": "Invalid JSON."
            }))
            return

        receiver_id = data.get("receiver")
        content = data.get("content")

        if receiver_id is None or content is None:
            await self.send(text_data=json.dumps({
                "error": "receiver and content are required."
            }))
            return

        if not str(content).strip():
            await self.send(text_data=json.dumps({
                "error": "content cannot be empty."
            }))
            return

        try:
            message = await self.create_message(receiver_id, content)
        except User.DoesNotExist:
            await self.send(text_data=json.dumps({
                "error": "Receiver not found."
            }))
            return
        except Exception:
            await self.send(text_data=json.dumps({
                "error": "Failed to save message."
            }))
            return

        message_data = {
            "type": "chat.message",
            "id": message.id,
            "sender": message.sender_id,
            "receiver": message.receiver_id,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }

        await self.channel_layer.group_send(
            f"chat_user_{message.receiver_id}",
            {
                "type": "send_message",
                "message": message_data,
            }
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "send_message",
                "message": message_data,
            }
        )

    async def send_message(self, event):
        await self.send(text_data=json.dumps(event["message"]))

    @database_sync_to_async
    def create_message(self, receiver_id, content):
        receiver = User.objects.get(id=receiver_id)
        return Message.objects.create(
            sender=self.user,
            receiver=receiver,
            content=content,
        )
