import { redirect } from "next/navigation";

// Старые «Сообщения от поклонников» убраны: вся переписка теперь в «Чатах».
export default function OldMessagesPage() {
  redirect("/chats");
}
