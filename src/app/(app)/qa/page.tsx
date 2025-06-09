
"use client";

import React, { useState, type FormEvent, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { answerQuestions } from "@/ai/flows/answer-questions";
import { Loader2, SendHorizonal, MessageSquareText, Paperclip, XCircle, Save, PlusCircle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { FirestoreChatMessage, ClientChatMessage, CHAT_SESSIONS_COLLECTION as CHAT_SESSIONS_COLLECTION_TYPE, ChatSessionData } from "@/lib/chat-types";
import { NOTES_COLLECTION, type FirestoreNoteData } from "@/lib/notes-data";

const CHAT_SESSIONS_COLLECTION: typeof CHAT_SESSIONS_COLLECTION_TYPE = "chatSessions_studybeam";

interface ChatInterfaceProps {}

function ChatInterface({}: ChatInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [question, setQuestion] = useState("");
  const [activeChatMessages, setActiveChatMessages] = useState<ClientChatMessage[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null);
  const [currentChatTitle, setCurrentChatTitle] = useState<string | null>(null);
  const [isLoadingChatMessages, setIsLoadingChatMessages] = useState(false);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setActiveChatMessages([]);
        setCurrentChatSessionId(null);
        setCurrentChatTitle(null);
        router.push("/login"); 
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("sessionId");
    if (firebaseUser) { 
        if (sessionIdFromUrl) {
            if (sessionIdFromUrl !== currentChatSessionId) { 
                fetchChatMessages(sessionIdFromUrl);
            }
        } else {
            // Reset for a new chat session if no sessionId in URL
            setActiveChatMessages([]);
            setCurrentChatSessionId(null);
            setCurrentChatTitle("New Chat");
            setIsLoadingChatMessages(false); 
        }
    } else {
        // User logged out or not yet loaded
        setActiveChatMessages([]);
        setCurrentChatSessionId(null);
        setCurrentChatTitle(null); 
        setIsLoadingChatMessages(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, firebaseUser]); 


  useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [activeChatMessages]);


  const generateChatTitle = (firstUserMessageText: string, inputFileName?: string): string => {
    if (inputFileName) {
      return `Chat about ${inputFileName}`;
    }
    const words = firstUserMessageText.split(' ');
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + '...';
    }
    return firstUserMessageText || "New Chat";
  };

  const fetchChatMessages = async (sessionId: string) => {
    if (!sessionId || !firebaseUser) {
      setCurrentChatSessionId(null);
      setActiveChatMessages([]);
      setCurrentChatTitle("New Chat");
      setIsLoadingChatMessages(false);
      return;
    }
    setIsLoadingChatMessages(true);
    setActiveChatMessages([]); 
    try {
      const sessionDocRef = doc(studybeamDb, CHAT_SESSIONS_COLLECTION, sessionId);
      const docSnap = await getDoc(sessionDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ChatSessionData;
        if (data.userId !== firebaseUser.uid) {
          toast({ title: "Access Denied", description: "You do not have permission to view this chat.", variant: "destructive" });
          router.push("/qa"); 
          return;
        }
        const firestoreMessages = (data.messages || []) as FirestoreChatMessage[];
        const clientMessages = firestoreMessages.map(fm => ({
          ...fm,
          timestamp: (fm.timestamp as Timestamp).toDate() 
        }));
        setActiveChatMessages(clientMessages);
        setCurrentChatSessionId(sessionId);
        setCurrentChatTitle(data.title || "Chat");
      } else {
        toast({ title: "Error", description: "Chat session not found.", variant: "destructive" });
        router.push("/qa"); 
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      toast({ title: "Error", description: "Could not load chat messages.", variant: "destructive" });
      router.push("/qa"); 
    } finally {
      setIsLoadingChatMessages(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 5MB.",
          variant: "destructive",
        });
        setSelectedFile(null);
        setAttachedFileName(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      setAttachedFileName(file.name);
      toast({
        title: "File Attached",
        description: `${file.name} is ready to be sent with your message.`,
      });
    }
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setAttachedFileName(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
     toast({
        title: "Attachment Cleared",
        description: "The file has been removed from your message.",
      });
  };

  const handleSaveAsNote = async (aiResponseText: string) => {
    if (!firebaseUser) {
      toast({ title: "Authentication Required", description: "Please log in to save notes.", variant: "destructive" });
      return;
    }

    try {
      const newNoteTitleBase = currentChatTitle && currentChatTitle !== "New Chat" 
        ? currentChatTitle 
        : aiResponseText.substring(0, 40).replace(/\n+/g, ' ').trim();
      
      const newNoteTitle = `Note from: ${newNoteTitleBase || 'Chat'}`;

      const newNoteData: Omit<FirestoreNoteData, 'createdAt' | 'updatedAt'> = {
        userId: firebaseUser.uid,
        title: newNoteTitle,
        summary: aiResponseText,
        sourceFileName: currentChatTitle && currentChatTitle !== "New Chat" ? currentChatTitle : "Chat Conversation",
        tags: ["Chat", "AI Generated", new Date().toISOString().split('T')[0]],
      };

      const docRef = await addDoc(collection(studybeamDb, NOTES_COLLECTION), {
        ...newNoteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      toast({
        title: "Note Saved!",
        description: `"${newNoteTitle}" has been saved to your notes. (ID: ${docRef.id})`,
      });
    } catch (error) {
      console.error("Failed to save note to Firestore:", error);
      toast({
        title: "Error Saving Note",
        description: "Could not save the note to the database.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) {
      toast({ title: "Not Authenticated", description: "Please log in to chat.", variant: "destructive" });
      return;
    }

    const currentQuestionText = question.trim();
    if (!currentQuestionText && !selectedFile) {
      toast({
        title: "Input Required",
        description: "Please enter a question or attach a file.",
        variant: "destructive",
      });
      return;
    }
    
    const effectiveQuestion = currentQuestionText || (selectedFile ? `Analyze this file: ${selectedFile.name}` : "");
    if (!effectiveQuestion) return; 

    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const userMessage: ClientChatMessage = { 
      id: userMessageId, 
      type: "user", 
      text: effectiveQuestion, 
      fileName: attachedFileName || undefined,
      timestamp: new Date() 
    };
    
    setActiveChatMessages((prev) => [...prev, userMessage]);
    setIsSendingMessage(true);

    let fileDataUri: string | undefined = undefined;
    if (selectedFile) {
      try {
        fileDataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(selectedFile);
        });
      } catch (error) {
        console.error("Error converting file to Data URI:", error);
        toast({
          title: "File Processing Error",
          description: "Could not process the attached file. Please try again.",
          variant: "destructive",
        });
        setIsSendingMessage(false);
        setActiveChatMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
        return;
      }
    }
    
    const justSentFileName = attachedFileName; 
    setQuestion(""); 
    setSelectedFile(null);
    setAttachedFileName(null);
    if(fileInputRef.current) fileInputRef.current.value = "";

    let sessionToUpdate = currentChatSessionId;
    let newSessionGeneratedTitle = "";

    try {
      const firestoreUserMessageData: FirestoreChatMessage = {
        id: userMessage.id,
        type: userMessage.type,
        text: userMessage.text,
        timestamp: userMessage.timestamp, 
      };
      if (userMessage.fileName) {
        firestoreUserMessageData.fileName = userMessage.fileName;
      }


      if (!sessionToUpdate) { 
        newSessionGeneratedTitle = generateChatTitle(effectiveQuestion, justSentFileName);
        setCurrentChatTitle(newSessionGeneratedTitle);
        const newSessionRef = await addDoc(collection(studybeamDb, CHAT_SESSIONS_COLLECTION), {
          userId: firebaseUser.uid,
          title: newSessionGeneratedTitle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          messages: [firestoreUserMessageData], 
        });
        sessionToUpdate = newSessionRef.id;
        setCurrentChatSessionId(newSessionRef.id);
        router.replace(`/qa?sessionId=${newSessionRef.id}`, { scroll: false }); 
      } else { 
        const sessionDocRef = doc(studybeamDb, CHAT_SESSIONS_COLLECTION, sessionToUpdate);
        await updateDoc(sessionDocRef, {
          messages: arrayUnion(firestoreUserMessageData), 
          updatedAt: serverTimestamp(),
        });
      }

      const aiResult = await answerQuestions({
        question: effectiveQuestion,
        fileDataUri: fileDataUri,
        fileName: userMessage.fileName ?? justSentFileName ?? undefined,
      });

      const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const aiMessage: ClientChatMessage = { 
        id: aiMessageId, 
        type: "ai", 
        text: aiResult.answer,
        timestamp: new Date() 
      };
      setActiveChatMessages((prev) => [...prev, aiMessage]);
      
      const firestoreAiMessageData: FirestoreChatMessage = {
        id: aiMessage.id,
        type: aiMessage.type,
        text: aiMessage.text,
        timestamp: aiMessage.timestamp, 
      };
      if (sessionToUpdate) {
        const sessionDocRef = doc(studybeamDb, CHAT_SESSIONS_COLLECTION, sessionToUpdate);
        await updateDoc(sessionDocRef, {
          messages: arrayUnion(firestoreAiMessageData), 
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error in chat submission or AI call:", error);
      const errorMessageId = `ai-error-${Date.now()}`;
      const errorMessage: ClientChatMessage = { id: errorMessageId, type: "ai", text: "Sorry, I encountered an error. Please try again.", timestamp: new Date() };
      setActiveChatMessages((prev) => [...prev, errorMessage]);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleNewChatLocal = () => {
    if (currentChatSessionId || activeChatMessages.length > 0) { 
        toast({ title: "New Chat Started", description: "Your previous chat is saved. Ask anything!" });
    }
    router.push("/qa"); 
  };


  return (
    <div className="flex flex-col h-full w-full md:max-w-3xl md:mx-auto">
        <div className="flex flex-col h-full w-full">
          <header className="p-3 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-headline text-gradient truncate pr-2" title={currentChatTitle || "Chat"}>
                {currentChatTitle || "Chat"}
              </h1>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleNewChatLocal} aria-label="New Chat">
                    <PlusCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild aria-label="Chat History">
                  <Link href="/chat-history">
                    <History className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </header>
          
          <ScrollArea className="flex-grow w-full py-4 px-2 sm:px-4" viewportRef={scrollViewportRef}>
            {isLoadingChatMessages && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading messages...</p>
              </div>
            )}

            {!isLoadingChatMessages && activeChatMessages.length === 0 && !isSendingMessage && (
              <Card className="flex-grow flex flex-col items-center justify-center text-center p-6 sm:p-10 shadow-lg m-4 min-h-[300px]">
                <MessageSquareText className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mb-6" strokeWidth={1}/>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gradient mb-2 sm:mb-4">
                  {currentChatSessionId ? "Empty Chat" : "What can I help with?"}
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {currentChatSessionId ? "No messages in this chat yet." : "Ask a question or attach a file for analysis."}
                </p>
              </Card>
            )}

            <div className="space-y-4 pb-4">
              {activeChatMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg shadow-sm",
                    "max-w-full w-full sm:max-w-[95%] md:max-w-[90%]", 
                    "p-2 md:p-3 lg:p-4",
                    message.type === "user"
                      ? "ml-auto bg-gradient-to-r from-primary to-accent text-primary-foreground"
                      : "mr-auto bg-card text-card-foreground border chat-ai-bubble" 
                  )}
                >
                   <div className={cn(
                      "flex-1 min-w-0 flex flex-col leading-relaxed break-words", 
                      message.type === "ai" ? "prose prose-sm sm:prose-base dark:prose-invert max-w-none w-full overflow-x-auto" : "overflow-x-hidden" 
                    )}>
                      {message.type === "user" ? (
                        <p className="text-sm whitespace-pre-wrap"> 
                          {message.text}
                          {message.fileName && <span className="block text-xs italic opacity-80 mt-1">Attached: {message.fileName}</span>}
                        </p>
                      ) : (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              pre: ({node, ...props}) => (
                                <div className="w-full overflow-x-auto">
                                  <pre
                                    className="w-full max-w-full bg-gray-900 text-gray-200 p-2 sm:p-3 my-2 rounded-md shadow-md overflow-x-auto font-code text-xs sm:text-sm"
                                    {...props}
                                  />
                                </div>
                              ),
                              code: ({node, inline, className, children, ...props}) => {
                                if (!inline) {
                                  return (
                                    <code className={cn(className, "text-xs sm:text-sm block overflow-x-auto")} {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <code className={cn(className, "bg-muted/70 text-muted-foreground px-1 py-0.5 rounded-sm font-code text-xs sm:text-sm")} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              li: ({node, ...props}) => <li className="break-words" {...props} />,
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                          {message.text !== "Sorry, I encountered an error. Please try again." && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 self-start"
                              onClick={() => handleSaveAsNote(message.text)}
                              title="Save as Note"
                            >
                              <Save size={16} className="mr-2 h-4 w-4" />
                              Save as Note
                            </Button>
                          )}
                        </>
                      )}
                  </div>
                </div>
              ))}

              {isSendingMessage && activeChatMessages[activeChatMessages.length -1]?.type === 'user' && (
                <div className={cn(
                  "flex items-start gap-3 rounded-lg shadow-sm mr-auto bg-card text-card-foreground border",
                  "max-w-full sm:max-w-[95%] md:max-w-[90%]",
                  "p-2 md:p-3 lg:p-4" 
                  )}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-primary mt-1" />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="pb-4 pt-2 sticky bottom-0 bg-background border-t px-2 sm:px-4">
            <div className="w-full space-y-2">
              {attachedFileName && (
                <div className="flex items-center justify-between p-2 text-sm bg-secondary/50 rounded-md border">
                  <span className="text-muted-foreground italic truncate pr-2">
                    Attached: {attachedFileName}
                  </span>
                  <Button variant="ghost" size="icon" onClick={clearAttachment} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                    <XCircle size={16} />
                    <span className="sr-only">Clear attachment</span>
                  </Button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 items-center relative bg-card p-2 rounded-xl shadow-lg border">
                <input
                  id="chat-file-input"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="sr-only"
                  accept="image/png, image/jpeg, image/webp, application/pdf, text/plain, text/markdown" 
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingMessage || isLoadingChatMessages}
                  className="text-primary hover:text-primary/80 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Input
                  placeholder={attachedFileName ? "Add a message about the file (optional)" : "Ask anything or attach a file..."}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isSendingMessage || isLoadingChatMessages}
                  className="flex-grow text-sm sm:text-base py-2 sm:py-3 px-2 sm:px-3 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-muted-foreground"
                  aria-label="Chat input"
                />
                <Button
                  type="submit"
                  disabled={isSendingMessage || isLoadingChatMessages || (!question.trim() && !selectedFile)}
                  size="icon"
                  aria-label="Send question"
                  className="text-primary-foreground rounded-md w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0"
                >
                  {isSendingMessage ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <SendHorizonal className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
    </div>
  );
}


export default function QAPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Chat...</p>
      </div>
    }>
      <ChatInterface />
    </Suspense>
  );
}
