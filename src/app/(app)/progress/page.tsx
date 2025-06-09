
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress as ProgressBar } from "@/components/ui/progress"; // Renamed to avoid conflict
import { Loader2, TrendingUp, BookOpenText, Layers3, FileQuestion, MessageSquareText, ExternalLink, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

import { QUIZ_ATTEMPTS_COLLECTION, type ClientQuizAttempt, type FirestoreQuizAttempt, type RecentActivityItem } from "@/lib/progress-data";
import { NOTES_COLLECTION, type ClientNote, type FirestoreNoteData } from "@/lib/notes-data";
import { FLASHCARDS_COLLECTION, type ClientFlashcardCollection, type FirestoreFlashcardCollectionData } from "@/lib/flashcards-data";
import { CHAT_SESSIONS_COLLECTION, type ChatSessionSummary, type ChatSessionData, type FirestoreChatMessage } from "@/lib/chat-types";

const MAX_RECENT_ACTIVITIES = 10;
const MAX_RECENT_QUIZZES_CHART = 5;

// Define colors for the chart bars
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F'];


export default function ProgressPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<ClientQuizAttempt[]>([]);
  
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setRecentActivities([]);
        setQuizAttempts([]);
        setIsLoadingActivities(false);
        setIsLoadingStats(false);
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!firebaseUser) return;

    setIsLoadingActivities(true);
    setIsLoadingStats(true);

    const unsubscribes: (() => void)[] = [];

    // Listener for Quiz Attempts
    const attemptsQuery = query(
      collection(studybeamDb, QUIZ_ATTEMPTS_COLLECTION),
      where("userId", "==", firebaseUser.uid),
      orderBy("completedAt", "desc")
    );
    unsubscribes.push(onSnapshot(attemptsQuery, (snapshot) => {
      const attempts: ClientQuizAttempt[] = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreQuizAttempt;
        return {
          id: doc.id,
          quizDeckTitle: data.quizDeckTitle,
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          completedAt: (data.completedAt as Timestamp)?.toDate() || new Date(),
          quizDeckId: data.quizDeckId,
        };
      });
      setQuizAttempts(attempts);
      setIsLoadingStats(false);
    }, (error) => {
      console.error("Error fetching quiz attempts:", error);
      toast({ title: "Error", description: "Could not load quiz statistics.", variant: "destructive" });
      setIsLoadingStats(false);
    }));

    // Listener for Notes
    const notesQuery = query(
      collection(studybeamDb, NOTES_COLLECTION),
      where("userId", "==", firebaseUser.uid),
      orderBy("updatedAt", "desc"),
      limit(MAX_RECENT_ACTIVITIES)
    );
    unsubscribes.push(onSnapshot(notesQuery, (snapshot) => {
      const notes = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreNoteData;
        return {
          id: doc.id,
          type: "note" as const,
          title: data.title,
          description: `Last updated`,
          timestamp: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          link: `/notes/${doc.id}`,
        };
      });
      setRecentActivities(prev => updateAndSortActivities(prev, notes, "note"));
    }, (error) => console.error("Error fetching notes for activity:", error)));

    // Listener for Flashcard Decks
    const flashcardsQuery = query(
      collection(studybeamDb, FLASHCARDS_COLLECTION),
      where("userId", "==", firebaseUser.uid),
      orderBy("updatedAt", "desc"),
      limit(MAX_RECENT_ACTIVITIES)
    );
    unsubscribes.push(onSnapshot(flashcardsQuery, (snapshot) => {
      const flashcards = snapshot.docs.map(doc => {
        const data = doc.data() as FirestoreFlashcardCollectionData;
        return {
          id: doc.id,
          type: "flashcards" as const,
          title: data.title,
          description: `${data.cards.length} cards`,
          timestamp: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          link: `/flashcards`, // Could link to specific deck review if functionality exists
        };
      });
      setRecentActivities(prev => updateAndSortActivities(prev, flashcards, "flashcards"));
    }, (error) => console.error("Error fetching flashcards for activity:", error)));

    // Listener for Chat Sessions
    const chatQuery = query(
      collection(studybeamDb, CHAT_SESSIONS_COLLECTION),
      where("userId", "==", firebaseUser.uid),
      orderBy("updatedAt", "desc"),
      limit(MAX_RECENT_ACTIVITIES)
    );
    unsubscribes.push(onSnapshot(chatQuery, (snapshot) => {
        const chats = snapshot.docs.map(doc => {
            const data = doc.data() as ChatSessionData;
            const lastMessage = data.messages && data.messages.length > 0 
              ? (data.messages[data.messages.length - 1] as FirestoreChatMessage)
              : null;
            return {
                id: doc.id,
                type: "chat" as const,
                title: data.title || "Untitled Chat",
                description: lastMessage ? `Last: ${lastMessage.text.substring(0,30)}...` : "No messages",
                timestamp: (data.updatedAt as Timestamp)?.toDate() || new Date(),
                link: `/qa?sessionId=${doc.id}`,
            };
        });
        setRecentActivities(prev => updateAndSortActivities(prev, chats, "chat"));
    }, (error) => console.error("Error fetching chat sessions for activity:", error)));


    return () => unsubscribes.forEach(unsub => unsub());
  }, [firebaseUser, toast]);


  // This effect updates recentActivities when quizAttempts changes
  useEffect(() => {
    if (quizAttempts.length > 0) {
      const quizActivities = quizAttempts.map(attempt => ({
        id: attempt.id,
        type: "quiz" as const,
        title: `Took quiz: ${attempt.quizDeckTitle}`,
        description: `Scored ${attempt.score}/${attempt.totalQuestions} (${attempt.percentage.toFixed(0)}%)`,
        timestamp: attempt.completedAt,
        link: attempt.quizDeckId && !attempt.quizDeckId.startsWith('temp-') ? `/quiz?deckId=${attempt.quizDeckId}` : `/quiz`, // Link to saved deck if ID exists
      }));
      setRecentActivities(prev => updateAndSortActivities(prev, quizActivities, "quiz"));
    }
  }, [quizAttempts]);


  const updateAndSortActivities = (
    existingActivities: RecentActivityItem[],
    newItems: RecentActivityItem[],
    typeToRemove: RecentActivityItem['type']
  ): RecentActivityItem[] => {
    const filteredExisting = existingActivities.filter(activity => activity.type !== typeToRemove);
    const combined = [...filteredExisting, ...newItems];
    const sorted = combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const finalActivities = sorted.slice(0, MAX_RECENT_ACTIVITIES);
    // Only set loading to false if all expected data types have potentially arrived or errored
    // This is a simplification; a more robust solution might track loading state per source.
    if (newItems.length > 0 || isLoadingStats === false) { // Check isLoadingStats for quiz data
         setIsLoadingActivities(false);
    }
    return finalActivities;
  };


  const overallAverageScore = useMemo(() => {
    if (quizAttempts.length === 0) return 0;
    const totalPercentage = quizAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
    return totalPercentage / quizAttempts.length;
  }, [quizAttempts]);

  const recentQuizzesForChart = useMemo(() => {
    return quizAttempts
      .slice(0, MAX_RECENT_QUIZZES_CHART)
      .map(attempt => ({
        name: attempt.quizDeckTitle.substring(0, 15) + (attempt.quizDeckTitle.length > 15 ? '...' : ''), // Shorten name for chart
        percentage: attempt.percentage,
        scoreText: `${attempt.score}/${attempt.totalQuestions}`
      }))
      .reverse(); // Reverse to show oldest of recent first
  }, [quizAttempts]);

  const getActivityIcon = (type: RecentActivityItem['type']) => {
    switch (type) {
      case "quiz": return <FileQuestion className="w-5 h-5 text-primary" />;
      case "note": return <BookOpenText className="w-5 h-5 text-primary" />;
      case "flashcards": return <Layers3 className="w-5 h-5 text-primary" />;
      case "chat": return <MessageSquareText className="w-5 h-5 text-primary" />;
      default: return <Activity className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      <header className="flex items-center space-x-3">
        <TrendingUp className="w-10 h-10 text-primary" />
        <h1 className="text-4xl font-headline font-semibold text-gradient">Your Progress</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Overall Quiz Performance</CardTitle>
            <CardDescription>Your average score across all quizzes.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {isLoadingStats ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            ) : quizAttempts.length > 0 ? (
              <>
                <p className="text-5xl font-bold font-headline text-gradient mb-2">
                  {overallAverageScore.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Based on {quizAttempts.length} quiz attempt{quizAttempts.length === 1 ? '' : 's'}.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground py-4">No quiz attempts recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Recent Quiz Scores</CardTitle>
            <CardDescription>Performance on your last few quizzes.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : recentQuizzesForChart.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentQuizzesForChart} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                        formatter={(value: number, name: string, props: any) => [`${value.toFixed(0)}% (${props.payload.scoreText})`, "Score"]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="percentage" name="Quiz Score"  radius={[4, 4, 0, 0]}>
                       {recentQuizzesForChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No recent quizzes to display.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Recent Activity</CardTitle>
          <CardDescription>A log of your recent actions within StudyBeam.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <div className="flex justify-center items-center min-h-[200px]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : recentActivities.length > 0 ? (
            <ScrollArea className="h-[400px] pr-3">
              <ul className="space-y-3">
                {recentActivities.map((activity) => (
                  <li key={`${activity.type}-${activity.id}`} className="p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">{getActivityIcon(activity.type)}</div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center">
                           <h3 className="font-semibold text-sm sm:text-base line-clamp-1">{activity.title}</h3>
                           {activity.link && (
                            <Button variant="ghost" size="sm" asChild className="text-xs h-auto py-0.5 px-1.5">
                                <Link href={activity.link} target={activity.link.startsWith('http') ? "_blank" : "_self"}>
                                    <ExternalLink className="w-3 h-3 mr-1" /> View
                                </Link>
                            </Button>
                           )}
                        </div>
                        {activity.description && <p className="text-xs text-muted-foreground line-clamp-1">{activity.description}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.timestamp.toLocaleDateString()} {activity.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-10">No recent activity to display. Start studying!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
