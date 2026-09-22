from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Message
from .serializers import MessageSerializer


class SendMessageView(generics.CreateAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)
        self.broadcast_message(message)

    def broadcast_message(self, message):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        message_data = {
            "type": "chat.message",
            "id": message.id,
            "sender": message.sender_id,
            "receiver": message.receiver_id,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }

        for user_id in (message.sender_id, message.receiver_id):
            async_to_sync(channel_layer.group_send)(
                f"chat_user_{user_id}",
                {
                    "type": "send_message",
                    "message": message_data,
                },
            )


class MessageHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        peer_id = request.query_params.get("user")
        if not peer_id:
            return Response(
                {"error": "user query param is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            peer_id = int(peer_id)
        except (TypeError, ValueError):
            return Response(
                {"error": "user must be an integer id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        me = request.user
        messages = (
            Message.objects.filter(
                Q(sender=me, receiver_id=peer_id)
                | Q(sender_id=peer_id, receiver=me)
            )
            .order_by("created_at")
        )
        return Response(MessageSerializer(messages, many=True).data)
