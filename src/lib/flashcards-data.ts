
import type { Timestamp } from "firebase/firestore";

// Interface for individual flashcard content (remains client-side for simplicity within the collection)
export interface Flashcard {
  id: number; // Can remain client-generated (e.g., Date.now() + index)
  question: string;
  answer: string;
}

// Interface for client-side flashcard collection data, using JS Date objects
export interface ClientFlashcardCollection {
  id: string; // Firestore document ID
  userId: string;
  title: string;
  description?: string;
  cards: Flashcard[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for flashcard collection data as stored in Firestore, using Firestore Timestamps
export interface FirestoreFlashcardCollectionData {
  userId: string;
  title: string;
  description?: string;
  cards: Flashcard[]; // Storing the array of cards directly
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const FLASHCARDS_COLLECTION = 'flashcards_studybeam';
