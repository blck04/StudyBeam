
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart3, BookOpenCheck, Layers, MessageSquare, PlusCircle, FileQuestion, FileText, User, UploadCloud, Loader2 } from "lucide-react";
import Link from "next/link";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { QUIZ_ATTEMPTS_COLLECTION, type ClientQuizAttempt, type FirestoreQuizAttempt } from "@/lib/progress-data";
import { NOTES_COLLECTION, type FirestoreNoteData } from "@/lib/notes-data";
import { FLASHCARDS_COLLECTION, type FirestoreFlashcardCollectionData } from "@/lib/flashcards-data";
import { useRouter } from "next/navigation";

interface DashboardRecentActivity {
  type: 'quiz' | 'note' | 'flashcard';
  title: string;
  timestamp: Date;
  details?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [recentActivity, setRecentActivity] = useState<DashboardRecentActivity | null>(null);
  const [overallAverageScore, setOverallAverageScore] = useState<number | null>(null);
  const [totalQuizzesTaken, setTotalQuizzesTaken] = useState<number>(0);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (firebaseUser) {
      fetchDashboardData(firebaseUser.uid);
    } else {
      setIsLoadingActivity(false);
      setIsLoadingProgress(false);
      setRecentActivity(null);
      setOverallAverageScore(null);
      setTotalQuizzesTaken(0);
    }
  }, [firebaseUser]);

  const fetchDashboardData = async (userId: string) => {
    setIsLoadingActivity(true);
    setIsLoadingProgress(true);

    try {
      // Fetch recent quiz attempts for both cards
      const attemptsQuery = query(
        collection(studybeamDb, QUIZ_ATTEMPTS_COLLECTION),
        where("userId", "==", userId),
        orderBy("completedAt", "desc")
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attempts: ClientQuizAttempt[] = attemptsSnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreQuizAttempt;
        return {
          id: doc.id,
          quizDeckTitle: data.quizDeckTitle,
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          completedAt: (data.completedAt as Timestamp)?.toDate() || new Date(),
        };
      });

      // Process for "Study Progress" card
      if (attempts.length > 0) {
        const totalPercentage = attempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
        setOverallAverageScore(totalPercentage / attempts.length);
        setTotalQuizzesTaken(attempts.length);
      } else {
        setOverallAverageScore(null);
        setTotalQuizzesTaken(0);
      }
      setIsLoadingProgress(false);

      // Process for "Recent Activity" card
      // Find the most recent item among quizzes, notes, and flashcards
      let latestActivity: DashboardRecentActivity | null = null;

      if (attempts.length > 0) {
        const latestQuiz = attempts[0];
        latestActivity = {
          type: 'quiz',
          title: `Quiz: ${latestQuiz.quizDeckTitle}`,
          details: `Scored ${latestQuiz.score}/${latestQuiz.totalQuestions} (${latestQuiz.percentage.toFixed(0)}%)`,
          timestamp: latestQuiz.completedAt,
        };
      }

      // Fetch latest note
      const notesQuery = query(
        collection(studybeamDb, NOTES_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc"),
        limit(1)
      );
      const notesSnapshot = await getDocs(notesQuery);
      if (!notesSnapshot.empty) {
        const noteData = notesSnapshot.docs[0].data() as FirestoreNoteData;
        const noteTimestamp = (noteData.updatedAt as Timestamp)?.toDate() || new Date();
        if (!latestActivity || noteTimestamp > latestActivity.timestamp) {
          latestActivity = {
            type: 'note',
            title: `Note: ${noteData.title}`,
            details: `Updated ${noteTimestamp.toLocaleDateString()}`,
            timestamp: noteTimestamp,
          };
        }
      }

      // Fetch latest flashcard deck
      const flashcardsQuery = query(
        collection(studybeamDb, FLASHCARDS_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc"),
        limit(1)
      );
      const flashcardsSnapshot = await getDocs(flashcardsQuery);
      if (!flashcardsSnapshot.empty) {
        const flashcardData = flashcardsSnapshot.docs[0].data() as FirestoreFlashcardCollectionData;
        const flashcardTimestamp = (flashcardData.updatedAt as Timestamp)?.toDate() || new Date();
         if (!latestActivity || flashcardTimestamp > latestActivity.timestamp) {
          latestActivity = {
            type: 'flashcard',
            title: `Flashcards: ${flashcardData.title}`,
            details: `${flashcardData.cards.length} cards, updated ${flashcardTimestamp.toLocaleDateString()}`,
            timestamp: flashcardTimestamp,
          };
        }
      }
      setRecentActivity(latestActivity);
      setIsLoadingActivity(false);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setIsLoadingActivity(false);
      setIsLoadingProgress(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold text-gradient">
            Welcome{firebaseUser?.displayName ? `, ${firebaseUser.displayName}` : ''}!
          </h1>
          <p className="text-muted-foreground">Your AI-powered study companion.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/qa">
            <MessageSquare className="mr-2 h-5 w-5" /> Start AI Chat
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentActivity ? (
              <>
                <div className="text-lg font-bold font-headline text-gradient truncate" title={recentActivity.title}>{recentActivity.title}</div>
                <p className="text-xs text-muted-foreground truncate" title={recentActivity.details}>
                  {recentActivity.details || `Last action on ${recentActivity.timestamp.toLocaleDateString()}`}
                </p>
              </>
            ) : (
              <>
                <div className="text-lg font-bold font-headline text-gradient">No recent activity</div>
                <p className="text-xs text-muted-foreground">
                  Upload notes, start a quiz, or create flashcards to see activity here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-body">Study Progress</CardTitle>
            <BarChart3 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            {isLoadingProgress ? (
               <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : overallAverageScore !== null ? (
              <>
                <div className="text-2xl font-bold font-headline text-gradient">{overallAverageScore.toFixed(1)}% Avg. Score</div>
                <p className="text-xs text-muted-foreground">
                  Across {totalQuizzesTaken} quiz attempt{totalQuizzesTaken === 1 ? '' : 's'}.
                </p>
              </>
            ) : (
              <>
                <div className="text-lg font-bold font-headline text-gradient">Track your progress</div>
                <p className="text-xs text-muted-foreground">
                  Complete quizzes to see your average score here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Your Study Hub</CardTitle>
          <CardDescription>Navigate to different modules to enhance your learning.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/notes" className="block p-6 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors">
              <div className="flex items-center mb-2">
                <FileText className="mr-3 h-6 w-6 text-primary" />
                <h3 className="font-headline text-lg font-semibold text-primary">View Notes</h3>
              </div>
              <p className="text-sm text-muted-foreground">Access and review all your generated notes and summaries.</p>
            </Link>
             <Link href="/flashcards" className="block p-6 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors">
              <div className="flex items-center mb-2">
                <Layers className="mr-3 h-6 w-6 text-primary" />
                <h3 className="font-headline text-lg font-semibold text-primary">Review Flashcards</h3>
              </div>
              <p className="text-sm text-muted-foreground">Strengthen your knowledge with flashcards.</p>
            </Link>
            <Link href="/quiz" className="block p-6 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors">
              <div className="flex items-center mb-2">
                <FileQuestion className="mr-3 h-6 w-6 text-primary" />
                <h3 className="font-headline text-lg font-semibold text-primary">Take a Quiz</h3>
              </div>
              <p className="text-sm text-muted-foreground">Test your knowledge with AI-generated quizzes.</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
