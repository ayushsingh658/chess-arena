export interface ChatMessage {
  id: string;
  gameId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface SendChatPayload {
  gameId: string;
  content: string;
}
