
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, PlusCircle, MessageSquareText, History, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, Timestamp, limit, deleteDoc, doc } from "firebase/firestore";
import { CHAT_SESSIONS_COLLECTION, type ChatSessionSummary, type ChatSessionData, type FirestoreChatMessage } from "@/lib/chat-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChatHistoryPage() {
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [chatSummaries, setChatSummaries] = useState<ChatSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [confirmAlertProps, setConfirmAlertProps] = useState({
    title: "",
    description: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
  });
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setChatSummaries([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      fetchRecentChats(firebaseUser.uid);
    } else {
      setChatSummaries([]); 
      setIsLoading(false);
    }
  }, [firebaseUser]); // Removed toast from dependencies as it's stable

  const fetchRecentChats = async (userId: string) => {
    setIsLoading(true);
    try {
      const q = query(
        collection(studybeamDb, CHAT_SESSIONS_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc"),
        limit(50) 
      );
      const querySnapshot = await getDocs(q);
      const summaries: ChatSessionSummary[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as ChatSessionData; 
        const lastMessage = data.messages && data.messages.length > 0 
          ? (data.messages[data.messages.length - 1] as FirestoreChatMessage)
          : null;
        summaries.push({
          id: docSnap.id,
          title: data.title || "Untitled Chat",
          lastMessagePreview: lastMessage ? lastMessage.text.substring(0, 50) + (lastMessage.text.length > 50 ? "..." : "") : "No messages yet.",
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        });
      });
      setChatSummaries(summaries);
    } catch (error) {
      console.error("Error fetching recent chats:", error);
      toast({ title: "Error", description: "Could not load chat history.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestClearAllHistory = () => {
    if (!firebaseUser || chatSummaries.length === 0) return;
    setConfirmAlertProps({
      title: "Clear All Chat History?",
      description: "Are you sure you want to delete all your chat sessions? This action cannot be undone.",
      confirmText: "Delete All",
      cancelText: "Cancel",
      onConfirm: () => {
        setIsConfirmAlertOpen(false);
        executeClearAllHistory();
      },
      onCancel: () => setIsConfirmAlertOpen(false),
    });
    setIsConfirmAlertOpen(true);
  };

  const executeClearAllHistory = async () => {
    if (!firebaseUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to clear history.", variant: "destructive" });
      return;
    }
    setIsClearingHistory(true);
    try {
      const q = query(
        collection(studybeamDb, CHAT_SESSIONS_COLLECTION),
        where("userId", "==", firebaseUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast({ title: "No History Found", description: "There is no chat history to clear." });
        setIsClearingHistory(false);
        return;
      }

      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(doc(studybeamDb, CHAT_SESSIONS_COLLECTION, docSnapshot.id)));
      });
      await Promise.all(deletePromises);

      setChatSummaries([]); 
      toast({ title: "Chat History Cleared", description: "All your chat sessions have been deleted." });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      toast({ title: "Error", description: "Could not clear chat history. Please try again.", variant: "destructive" });
    } finally {
      setIsClearingHistory(false);
    }
  };

  const filteredChatSummaries = chatSummaries.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (session.lastMessagePreview && session.lastMessagePreview.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center">
          <History className="w-8 h-8 mr-3 text-primary" />
          <h1 className="text-3xl font-headline font-semibold text-gradient">Chat History</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button asChild>
                <Link href="/qa">
                <PlusCircle className="mr-2 h-5 w-5" /> New Chat
                </Link>
            </Button>
            <Button 
                variant="destructive" 
                onClick={handleRequestClearAllHistory} 
                disabled={isLoading || chatSummaries.length === 0 || isClearingHistory || !firebaseUser}
            >
                {isClearingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isClearingHistory ? "Clearing..." : "Clear All"}
            </Button>
        </div>
      </div>

      {!isLoading && chatSummaries.length > 0 && (
        <div className="max-w-xl mx-auto w-full relative">
          <Input
            type="search"
            placeholder="Search chats by title or last message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
      )}
      
      {isLoading ? (
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : filteredChatSummaries.length === 0 ? (
        <Card className="flex-grow flex flex-col items-center justify-center text-center p-10 shadow-lg">
            <MessageSquareText className="w-24 h-24 text-primary/30 mb-6" strokeWidth={1}/>
            <CardTitle className="font-headline text-2xl mb-2">
              {searchTerm ? "No Chats Found" : "No Chat History Found"}
            </CardTitle>
            <CardDescription className="text-base mb-6">
              {searchTerm 
                ? "No chat sessions match your search criteria. Try a different term or clear the search."
                : "Start a new conversation in the Chat section to see your history here."
              }
            </CardDescription>
            <Button asChild size="lg">
              <Link href="/qa">
                <PlusCircle className="mr-2 h-5 w-5" /> Start New Chat
              </Link>
            </Button>
        </Card>
      ) : (
        <ScrollArea className="flex-grow border rounded-lg shadow-md bg-card">
          <div className="p-2 sm:p-4 space-y-2">
            {filteredChatSummaries.map((session) => (
              <Link href={`/qa?sessionId=${session.id}`} key={session.id} className="block">
                <Card className="hover:shadow-lg transition-shadow duration-200 hover:border-primary/50">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-lg font-headline line-clamp-1">{session.title}</CardTitle>
                    <CardDescription className="text-xs">
                      Last updated: {session.updatedAt.toLocaleDateString()} {session.updatedAt.toLocaleTimeString()}
                    </CardDescription>
                  </CardHeader>
                  {session.lastMessagePreview && (
                    <CardContent className="p-3 sm:p-4 pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {session.lastMessagePreview}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setIsConfirmAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAlertProps.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAlertProps.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsConfirmAlertOpen(false); confirmAlertProps.onCancel?.(); }}>
              {confirmAlertProps.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmAlertProps.onConfirm} disabled={isClearingHistory}>
              {isClearingHistory && confirmAlertProps.title.includes("Clear All") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirmAlertProps.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
