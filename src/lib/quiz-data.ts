
import type { Timestamp } from "firebase/firestore";

// Interface for individual quiz question content (remains client-side for simplicity within the collection)
export interface QuizQuestion {
  id: number; // Can remain client-generated (e.g., Date.now() + index)
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

// Interface for client-side quiz collection data, using JS Date objects
export interface ClientQuizCollection {
  id: string; // Firestore document ID
  userId: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for quiz collection data as stored in Firestore, using Firestore Timestamps
export interface FirestoreQuizCollectionData {
  userId: string;
  title: string;
  description?: string;
  questions: QuizQuestion[]; // Storing the array of questions directly
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const QUIZ_COLLECTION = 'quiz_studybeam';
