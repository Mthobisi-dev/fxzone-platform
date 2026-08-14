import asyncio
import sys
import uuid

from shared.database import init_all_databases, AsyncSessionLocal
from shared.models import User, Conversation, ConversationMember, Message
from services.chat.service import ChatService
from services.chat.schemas import ConversationCreate, MessageCreate
from sqlalchemy import select

async def main():
    await init_all_databases()
    async with AsyncSessionLocal() as db:
        chat_service = ChatService(db)
        
        # 1. Fetch any 2 users
        stmt = select(User).limit(5)
        res = await db.execute(stmt)
        users = res.scalars().all()
        print(f"Found {len(users)} users in database:")
        for u in users:
            print(f" - {u.id} | @{u.username} | {u.display_name} | {u.role}")

        if len(users) < 2:
            print("Not enough users to test chat!")
            return

        u1 = users[0]
        u2 = users[1]

        print(f"\n--- Testing 1-on-1 Chat creation between {u1.username} and {u2.username} ---")
        conv_create = ConversationCreate(
            participant_ids=[str(u2.id)],
            is_group=False
        )
        conv = await chat_service.create_conversation(creator_id=str(u1.id), data=conv_create)
        print(f"Conversation ID: {conv.id}, is_group={conv.is_group}, members={len(conv.members)}")
        for m in conv.members:
            user_obj = m.user
            print(f" Member: {user_obj.username if user_obj else 'None'}")

        print("\n--- Testing Sending a Message ---")
        msg = await chat_service.save_message(
            conversation_id=str(conv.id),
            sender_id=str(u1.id),
            content="Hello from test script! Testing chat functionality.",
            message_type="text"
        )
        print(f"Message Saved: ID={msg.id}, content='{msg.content}', sender={msg.sender.username}")

        print("\n--- Testing Fetching Messages ---")
        msgs = await chat_service.get_conversation_messages(conversation_id=str(conv.id))
        print(f"Fetched {len(msgs)} messages.")
        for m in msgs:
            print(f" [{m.created_at}] {m.sender.username}: {m.content}")

        print("\n--- Testing Fetching User Conversations ---")
        convs = await chat_service.get_user_conversations(user_id=str(u2.id))
        print(f"User {u2.username} has {len(convs)} active conversations.")
        for c in convs:
            print(f" Conv: {c.id} | is_group={c.is_group} | members={[m.user.username for m in c.members if m.user]}")

        print("\n✅ ALL CHAT SERVICE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
