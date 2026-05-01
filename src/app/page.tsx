import { Sidebar } from "@/components/Sidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  return (
    <main className="flex h-screen overflow-hidden">
      <Sidebar />
      <ChatContainer />
    </main>
  );
}
