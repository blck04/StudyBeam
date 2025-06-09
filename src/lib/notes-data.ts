
import type { Timestamp } from "firebase/firestore";

// Interface for client-side note data, using JS Date objects for easier handling
export interface ClientNote {
  id: string; // Firestore document ID
  title: string;
  createdAt: Date;
  updatedAt: Date;
  summary: string;
  sourceFileName?: string;
  tags: string[];
  userId: string;
}

// Interface for data structure as stored in Firestore, using Firestore Timestamps
export interface FirestoreNoteData {
  userId: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  summary: string;
  sourceFileName?: string;
  tags: string[];
}

export const NOTES_COLLECTION = 'notes_studybeam';

// Placeholder notes are no longer the primary source of data.
// Initialize as an empty array; notes will be loaded from Firestore.
export const placeholderNotes: ClientNote[] = [];
