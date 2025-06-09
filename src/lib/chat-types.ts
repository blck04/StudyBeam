
import type { Timestamp } from "firebase/firestore";

export interface ClientChatMessage {
  id: string; // Unique client-side ID for React keys
  type: "user" | "ai";
  text: string;
  fileName?: string;
  timestamp: Date; // JS Date object for client-side use
}

export interface FirestoreChatMessage { // Stored in Firestore
  id: string; // Client-generated unique ID
  type: "user" | "ai";
  text: string;
  fileName?: string; // Optional: only store if present
  timestamp: Timestamp; // Firestore Timestamp
}

export interface ChatSessionSummary {
  id: string; // Firestore document ID
  title: string;
  lastMessagePreview?: string;
  updatedAt: Date; // JS Date object for client-side use
}

export interface ChatSessionData { // Represents the structure in Firestore
    userId: string;
    title: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    messages: FirestoreChatMessage[];
}

export const CHAT_SESSIONS_COLLECTION = "chatSessions_studybeam";
