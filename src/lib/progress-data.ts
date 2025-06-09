
import type { Timestamp } from "firebase/firestore";

export interface FirestoreQuizAttempt {
  userId: string;
  quizDeckId: string; // ID of the quiz deck from QUIZ_COLLECTION
  quizDeckTitle: string; // Title of the quiz deck
  score: number; // Number of correct answers
  totalQuestions: number; // Total questions in the quiz
  percentage: number; // (score / totalQuestions) * 100
  completedAt: Timestamp; // When the quiz was completed
}

export interface ClientQuizAttempt extends Omit<FirestoreQuizAttempt, 'completedAt' | 'userId' | 'quizDeckId'> {
  id: string; // Firestore document ID of the attempt
  quizDeckId?: string; // Optional on client if not always needed for display actions
  completedAt: Date;
}

export const QUIZ_ATTEMPTS_COLLECTION = 'quizAttempts_studybeam';

// Represents a generic recent activity item for the progress page
export interface RecentActivityItem {
  id: string; // Firestore document ID
  type: "quiz" | "note" | "flashcards" | "chat";
  title: string;
  description?: string; // e.g., "Score: 8/10" or "Last message preview"
  timestamp: Date;
  link?: string; // e.g., /quiz?deckId=xyz or /notes/abc
}
