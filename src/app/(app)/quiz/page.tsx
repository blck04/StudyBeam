
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileQuestion, Check, X, Sparkles, Paperclip, Wand2, Loader2, Layers3, ChevronLeft, BookCopy, Save, XCircle, Search, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { generateStudyMaterials } from "@/ai/flows/generate-study-materials";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { QUIZ_COLLECTION, type ClientQuizCollection, type FirestoreQuizCollectionData, type QuizQuestion } from "@/lib/quiz-data";
import { QUIZ_ATTEMPTS_COLLECTION, type FirestoreQuizAttempt } from "@/lib/progress-data"; // Import quiz attempt types
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


type QuizTakerState = "ongoing" | "submitted" | "finished";

export default function QuizPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [notesForGeneration, setNotesForGeneration] = useState("");
  const [inputFileName, setInputFileName] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [showQuizNotesInput, setShowQuizNotesInput] = useState(false);
  const [desiredNumQuestions, setDesiredNumQuestions] = useState(10);

  const [availableQuizCollections, setAvailableQuizCollections] = useState<ClientQuizCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentQuizQuestions, setCurrentQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [currentQuizDeckId, setCurrentQuizDeckId] = useState<string | null>(null); // Store current deck ID
  const [currentQuizDeckTitle, setCurrentQuizDeckTitle] = useState<string | null>(null);
  const [isCurrentQuizUnsaved, setIsCurrentQuizUnsaved] = useState(false); 

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [quizTakerState, setQuizTakerState] = useState<QuizTakerState>("ongoing");
  const [showExplanation, setShowExplanation] = useState(false);

  const [isQuizNamePromptOpen, setIsQuizNamePromptOpen] = useState(false);
  const [quizNamePromptValue, setQuizNamePromptValue] = useState("");
  const [quizNamePromptSuggestedValue, setQuizNamePromptSuggestedValue] = useState("");
  const [quizNamePromptResolve, setQuizNamePromptResolve] = useState<((value: string | null) => void) | null>(null);

  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [confirmAlertProps, setConfirmAlertProps] = useState({
    title: "",
    description: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  const currentQuestion = currentQuizQuestions[currentIndex];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setAvailableQuizCollections([]);
        setIsLoadingCollections(false);
        setIsTakingQuiz(false); 
        setCurrentQuizQuestions([]);
        setShowQuizNotesInput(false);
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (firebaseUser) {
      fetchQuizCollections(firebaseUser.uid);
    } else {
      setAvailableQuizCollections([]);
      setIsLoadingCollections(false);
    }
  }, [firebaseUser]);

  const fetchQuizCollections = async (userId: string) => {
    setIsLoadingCollections(true);
    try {
      const q = query(
        collection(studybeamDb, QUIZ_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedCollections: ClientQuizCollection[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreQuizCollectionData;
        fetchedCollections.push({
          id: doc.id,
          userId: data.userId,
          title: data.title,
          description: data.description,
          questions: data.questions,
          createdAt: (data.createdAt as Timestamp).toDate(),
          updatedAt: (data.updatedAt as Timestamp).toDate(),
        });
      });
      setAvailableQuizCollections(fetchedCollections);
    } catch (error) {
      console.error("Failed to load quiz collections:", error);
      toast({ title: "Error", description: "Could not load your quiz decks.", variant: "destructive" });
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleFileAttachChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInputFileName(file.name);
      try {
        const text = await file.text();
        setNotesForGeneration(text);
        toast({ title: "File Loaded", description: `${file.name} content loaded. You can now generate a quiz.` });
      } catch (error) {
        console.error("Failed to read file:", error);
        toast({ title: "Error Reading File", description: "Could not read the content of the selected file.", variant: "destructive" });
        setInputFileName(null);
      }
    }
    if (event.target) event.target.value = "";
  };

  const handleGenerateQuiz = async () => {
    if (!notesForGeneration.trim()) {
      toast({ title: "Input Required", description: "Please paste or upload notes to generate a quiz.", variant: "destructive" });
      return;
    }
    setIsGeneratingQuiz(true);
    setCurrentQuizDeckId(null); // New AI quiz doesn't have a persisted ID yet
    try {
      const result = await generateStudyMaterials({ lectureNotes: notesForGeneration, numberOfQuestions: desiredNumQuestions });
      if (result.practiceQuestions && result.practiceQuestions.length > 0) {
        const newQuizQuestions = result.practiceQuestions.map((q, index) => ({
          ...q,
          id: Date.now() + index, 
        }));
        setCurrentQuizQuestions(newQuizQuestions);
        setCurrentQuizDeckTitle(inputFileName ? `New AI: ${inputFileName.split('.')[0]}` : "New AI-Generated Quiz");
        setIsCurrentQuizUnsaved(true);
        resetQuizTakerStateForNewQuiz();
        setIsTakingQuiz(true);
        setNotesForGeneration(""); 
        setInputFileName(null);
        setShowQuizNotesInput(false);
        toast({ title: "New Quiz Generated!", description: `${newQuizQuestions.length} questions ready.` });
      } else {
        toast({ title: "No Questions Generated", description: "The AI couldn't generate quiz questions from the provided text." });
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast({ title: "Generation Failed", description: "Could not generate quiz questions from the AI.", variant: "destructive" });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };
  
  const resetQuizTakerStateForNewQuiz = () => {
    setCurrentIndex(0);
    setSelectedAnswers({});
    setScore(0);
    setQuizTakerState("ongoing");
    setShowExplanation(false);
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setShowExplanation(false);
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || !selectedAnswers[currentQuestion.id]) {
      toast({ title: "Answer Required", description: "Please select an answer.", variant: "default"});
      return;
    }
    setQuizTakerState("submitted");
    if (selectedAnswers[currentQuestion.id] === currentQuestion.correctAnswer) {
      setScore((prev) => prev + 1);
    }
    setShowExplanation(true);
  };

  const saveQuizAttempt = async (finalScore: number, totalQuestions: number) => {
    if (!firebaseUser || !currentQuizDeckTitle) return;
    
    // For new AI-generated quizzes that aren't saved as a deck yet, 
    // currentQuizDeckId might be null. We can create a temporary ID or handle it.
    // For simplicity, we'll use the title if ID is not available.
    const deckIdToSave = currentQuizDeckId || `temp-${Date.now()}`;
    const percentageScore = totalQuestions > 0 ? (finalScore / totalQuestions) * 100 : 0;

    const attemptData: Omit<FirestoreQuizAttempt, 'completedAt'> = {
      userId: firebaseUser.uid,
      quizDeckId: deckIdToSave,
      quizDeckTitle: currentQuizDeckTitle,
      score: finalScore,
      totalQuestions: totalQuestions,
      percentage: parseFloat(percentageScore.toFixed(2)),
    };

    try {
      await addDoc(collection(studybeamDb, QUIZ_ATTEMPTS_COLLECTION), {
        ...attemptData,
        completedAt: serverTimestamp(),
      });
      toast({ title: "Quiz Attempt Saved", description: "Your results have been recorded." });
    } catch (error) {
      console.error("Error saving quiz attempt:", error);
      toast({ title: "Save Attempt Failed", description: "Could not save your quiz results.", variant: "destructive" });
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < currentQuizQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setQuizTakerState("ongoing");
      setShowExplanation(false);
    } else {
      setQuizTakerState("finished");
      // Save attempt when quiz is finished
      if (firebaseUser) {
          saveQuizAttempt(score, currentQuizQuestions.length);
      }
    }
  };

  const startQuizSession = (collectionToReview: ClientQuizCollection) => {
    setCurrentQuizQuestions(collectionToReview.questions);
    setCurrentQuizDeckId(collectionToReview.id); // Set current deck ID
    setCurrentQuizDeckTitle(collectionToReview.title);
    resetQuizTakerStateForNewQuiz();
    setIsTakingQuiz(true);
    setIsCurrentQuizUnsaved(false);
    setShowQuizNotesInput(false);
  };

  const performExitActions = () => {
    setIsTakingQuiz(false);
    setCurrentQuizQuestions([]);
    setCurrentQuizDeckId(null);
    setCurrentQuizDeckTitle(null);
    setIsCurrentQuizUnsaved(false);
    setShowQuizNotesInput(false); 
  };

  const promptForQuizName = (suggestedName: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setQuizNamePromptSuggestedValue(suggestedName);
      setQuizNamePromptValue(suggestedName);
      setQuizNamePromptResolve(() => resolve);
      setIsQuizNamePromptOpen(true);
    });
  };

  const _performActualSaveQuiz = async (titleToSave: string): Promise<string | null> => {
    if (!firebaseUser || currentQuizQuestions.length === 0) return null;

    const newCollectionData: Omit<FirestoreQuizCollectionData, 'createdAt' | 'updatedAt'> = {
      userId: firebaseUser.uid,
      title: titleToSave,
      questions: currentQuizQuestions,
      description: inputFileName ? `Generated from ${inputFileName}` : `Generated on ${new Date().toLocaleDateString()}`
    };
    
    try {
      const docRef = await addDoc(collection(studybeamDb, QUIZ_COLLECTION), {
        ...newCollectionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const newDeckId = docRef.id;
      setAvailableQuizCollections(prev => [...prev, { ...newCollectionData, id: newDeckId, createdAt: new Date(), updatedAt: new Date() }].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      setCurrentQuizDeckTitle(titleToSave);
      setCurrentQuizDeckId(newDeckId); // Update current deck ID with the saved one
      setIsCurrentQuizUnsaved(false);
      setInputFileName(null);
      toast({ title: "Quiz Deck Saved!", description: `"${titleToSave}" has been added to your collections.` });
      return newDeckId;
    } catch (error) {
      console.error("Error saving quiz to Firestore:", error);
      toast({ title: "Save Failed", description: "Could not save the quiz to the database.", variant: "destructive" });
      return null;
    }
  };

  const handleSaveQuiz = async (): Promise<boolean> => {
    if (!isCurrentQuizUnsaved || currentQuizQuestions.length === 0 || !firebaseUser) {
      if (!firebaseUser) toast({ title: "Login Required", description: "Please log in to save your quiz.", variant: "destructive" });
      return false;
    }

    const suggestedNameBase = currentQuizDeckTitle?.startsWith("New AI: ") ? currentQuizDeckTitle.substring(8)
      : currentQuizDeckTitle || "My New Quiz";
    
    const quizDeckTitleFromPrompt = await promptForQuizName(suggestedNameBase);

    if (quizDeckTitleFromPrompt) {
      const savedDeckId = await _performActualSaveQuiz(quizDeckTitleFromPrompt);
      return !!savedDeckId;
    } else {
      toast({ title: "Save Cancelled", description: "Quiz deck name was not provided. The deck was not saved.", variant: "default" });
      return false;
    }
  };

  const exitQuizSession = async () => {
    if (isCurrentQuizUnsaved && currentQuizQuestions.length > 0 && firebaseUser) {
      setConfirmAlertProps({
        title: "Unsaved Quiz",
        description: "You have an unsaved quiz deck. Would you like to save it before exiting?",
        confirmText: "Save & Exit",
        cancelText: "Don't Save",
        onConfirm: async () => {
          setIsConfirmAlertOpen(false);
          const savedSuccessfully = await handleSaveQuiz();
          if (savedSuccessfully) {
             if (quizTakerState !== "finished" && quizTakerState !== "submitted" && currentQuizQuestions.length > 0) {
              // If quiz was ongoing and not finished, save the current state as an attempt
              saveQuizAttempt(score, currentQuizQuestions.length);
            }
            performExitActions();
          }
        },
        onCancel: () => {
          setIsConfirmAlertOpen(false);
          setConfirmAlertProps({
            title: "Exit Without Saving?",
            description: "Are you sure you want to exit without saving your current quiz progress and unsaved deck? Changes will be lost.",
            confirmText: "Exit Anyway",
            cancelText: "Stay",
            onConfirm: () => {
              setIsConfirmAlertOpen(false);
              if (quizTakerState !== "finished" && quizTakerState !== "submitted" && currentQuizQuestions.length > 0) {
                saveQuizAttempt(score, currentQuizQuestions.length);
              }
              performExitActions();
            },
            onCancel: () => setIsConfirmAlertOpen(false),
          });
          setIsConfirmAlertOpen(true);
        },
      });
      setIsConfirmAlertOpen(true);
    } else {
      if (quizTakerState !== "finished" && quizTakerState !== "submitted" && currentQuizQuestions.length > 0 && firebaseUser) {
         // If quiz was ongoing (from a saved deck) and not finished, still save attempt
        saveQuizAttempt(score, currentQuizQuestions.length);
      }
      performExitActions();
    }
  };

  const handleDeleteQuizDeck = async (deckId: string, deckTitle: string) => {
    if (!firebaseUser) {
      toast({ title: "Authentication Required", description: "Please log in to delete quiz decks.", variant: "destructive" });
      return;
    }
    setConfirmAlertProps({
      title: "Delete Quiz Deck",
      description: `Are you sure you want to delete the quiz deck "${deckTitle}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setIsConfirmAlertOpen(false);
        try {
          await deleteDoc(doc(studybeamDb, QUIZ_COLLECTION, deckId));
          setAvailableQuizCollections(prev => prev.filter(deck => deck.id !== deckId));
          toast({ title: "Quiz Deck Deleted", description: `"${deckTitle}" has been removed.` });
        } catch (error) {
          console.error("Error deleting quiz deck:", error);
          toast({ title: "Deletion Failed", description: "Could not delete the quiz deck.", variant: "destructive" });
        }
      },
      onCancel: () => setIsConfirmAlertOpen(false),
    });
    setIsConfirmAlertOpen(true);
  };

  const progressPercentage = currentQuizQuestions.length > 0 ? ((currentIndex + (quizTakerState !== 'ongoing' && currentQuestion ? 1:0) ) / currentQuizQuestions.length) * 100 : 0;

  let primaryQuizButtonText: React.ReactNode;
  let primaryQuizButtonIcon: React.ReactNode;
  let primaryQuizButtonOnClick: () => void;

  if (isGeneratingQuiz) {
    primaryQuizButtonText = "Generating Quiz...";
    primaryQuizButtonIcon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    primaryQuizButtonOnClick = () => {}; 
  } else if (showQuizNotesInput) {
    if (notesForGeneration.trim()) {
      primaryQuizButtonText = "Generate & Start Quiz";
      primaryQuizButtonIcon = <Wand2 className="mr-2 h-4 w-4" />;
      primaryQuizButtonOnClick = handleGenerateQuiz;
    } else {
      primaryQuizButtonText = "Hide Notes Input";
      primaryQuizButtonIcon = <XCircle className="mr-2 h-4 w-4" />;
      primaryQuizButtonOnClick = () => setShowQuizNotesInput(false);
    }
  } else {
    primaryQuizButtonText = "Input Notes for AI Quiz";
    primaryQuizButtonIcon = <Wand2 className="mr-2 h-4 w-4" />;
    primaryQuizButtonOnClick = () => setShowQuizNotesInput(true);
  }
  
  const filteredQuizCollections = availableQuizCollections.filter(collection =>
    collection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (collection.description && collection.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 space-y-8">
      {!isTakingQuiz && (
        <Card className="shadow-xl w-full max-w-3xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="font-headline text-2xl">Generate New Quiz</CardTitle>
            <CardDescription>
              Paste your notes directly, or click the paperclip icon to attach a file (e.g., .txt, .md).
            </CardDescription>
          </CardHeader>
          {showQuizNotesInput && (
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notes-input-area-quiz" className="sr-only">
                  Paste notes or attach files to generate a quiz
                </Label>
                <div className="flex items-start gap-2 p-2 border bg-background rounded-lg relative">
                  <input
                    id="file-upload-quiz"
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="sr-only"
                    onChange={handleFileAttachChange}
                    ref={fileInputRef}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1.5 text-primary hover:text-primary/80 flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file for quiz"
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Textarea
                    id="notes-input-area-quiz"
                    value={notesForGeneration}
                    onChange={(e) => {
                        setNotesForGeneration(e.target.value);
                        if (inputFileName && e.target.value === "") {
                          setInputFileName(null);
                        }
                    }}
                    rows={1}
                    className="flex-grow resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-1.5 bg-transparent"
                    placeholder="Paste notes here..."
                  />
                </div>
                {inputFileName && <p className="text-sm text-muted-foreground italic">Source: {inputFileName}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="num-questions">Number of Questions (1-20, default 10)</Label>
                <Input
                  id="num-questions"
                  type="number"
                  value={desiredNumQuestions}
                  onChange={(e) => {
                    const numVal = e.target.value;
                    if (numVal === "") {
                        setDesiredNumQuestions(10); 
                    } else {
                        const parsedNum = parseInt(numVal, 10);
                        if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 20) {
                            setDesiredNumQuestions(parsedNum);
                        } else if (!isNaN(parsedNum) && parsedNum < 1) {
                            setDesiredNumQuestions(1);
                        } else if (!isNaN(parsedNum) && parsedNum > 20) {
                            setDesiredNumQuestions(20);
                        }
                    }
                  }}
                  min="1"
                  max="20"
                  placeholder="10"
                  className="w-full sm:w-40"
                />
              </div>
            </CardContent>
          )}
          <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center sm:justify-center">
            <Button 
              onClick={primaryQuizButtonOnClick} 
              disabled={isGeneratingQuiz || !firebaseUser} 
              className="w-full sm:w-auto text-base py-3 px-6"
            >
              {primaryQuizButtonIcon} {primaryQuizButtonText}
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {!isTakingQuiz ? (
        <div className="space-y-6">
          <h2 className="text-3xl font-headline font-semibold text-gradient text-center">Your Quiz Decks</h2>
          
          {!isLoadingCollections && availableQuizCollections.length > 0 && (
            <div className="max-w-xl mx-auto relative">
              <Input
                type="search"
                placeholder="Search quiz decks by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10" 
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {isLoadingCollections ? (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading your quiz decks...</p>
            </div>
          ) : filteredQuizCollections.length === 0 ? (
            <Card className="text-center py-10 shadow-lg max-w-md mx-auto">
              <CardHeader>
                <BookCopy className="h-16 w-16 text-primary/70 mx-auto mb-4" strokeWidth={1.5}/>
                <CardTitle className="font-headline text-2xl">
                   {searchTerm ? "No Quiz Decks Found" : "No Quiz Decks Yet"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                   {firebaseUser
                    ? searchTerm
                      ? "No quiz decks match your search criteria. Try a different term or clear search."
                      : "Generate a quiz with AI or select a deck to start learning!"
                    : "Please log in to see or create quiz decks."}
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuizCollections.map((collection) => (
                <Card key={collection.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <CardHeader>
                    <CardTitle className="font-headline text-xl line-clamp-2">{collection.title}</CardTitle>
                    {collection.description && <CardDescription className="text-sm line-clamp-2">{collection.description}</CardDescription>}
                    <CardDescription className="text-xs pt-1">
                        Updated: {collection.updatedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{collection.questions.length} questions.</p>
                  </CardContent>
                  <CardFooter className="flex items-center gap-2 mt-auto pt-4">
                    <Button onClick={() => startQuizSession(collection)} className="flex-grow">
                      <Layers3 className="mr-2 h-4 w-4" /> Start Quiz
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleDeleteQuizDeck(collection.id, collection.title)}
                      aria-label={`Delete quiz deck ${collection.title}`}
                      disabled={!firebaseUser}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : currentQuizQuestions.length > 0 && currentQuestion ? (
        <div className="space-y-8">
            <div className="w-full max-w-2xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <Button onClick={exitQuizSession} variant="outline">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back to Decks
                    </Button>
                    {isCurrentQuizUnsaved && firebaseUser && (
                    <Button onClick={handleSaveQuiz} disabled={!firebaseUser || currentQuizQuestions.length === 0}>
                        <Save className="mr-2 h-4 w-4" /> Save Quiz Deck
                    </Button>
                    )}
                </div>
                <header className="text-center mb-6">
                    <h1 className="text-3xl font-headline font-semibold text-gradient mb-1">
                        Taking Quiz: {currentQuizDeckTitle}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                    Test your understanding with these questions.
                    </p>
                </header>
            </div>

            <Card className="w-full max-w-2xl shadow-xl mx-auto">
                <CardHeader>
                <Progress value={progressPercentage} className="w-full mb-4 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent" />
                {quizTakerState !== "finished" && (
                    <CardTitle className="font-headline text-xl">Question {currentIndex + 1} of {currentQuizQuestions.length}</CardTitle>
                )}
                </CardHeader>
                
                {quizTakerState !== "finished" ? (
                <>
                    <CardContent className="space-y-6">
                    <p className="text-lg font-medium font-body">{currentQuestion.question}</p>
                    <RadioGroup
                        value={selectedAnswers[currentQuestion.id] || ""}
                        onValueChange={(value) => handleAnswerSelect(currentQuestion.id, value)}
                        disabled={quizTakerState === "submitted"}
                    >
                        {currentQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-secondary/50 transition-colors has-[:checked]:bg-gradient-to-r has-[:checked]:from-primary/20 has-[:checked]:to-accent/20 has-[:checked]:text-primary has-[:disabled]:opacity-70">
                            <RadioGroupItem value={option} id={`option-${currentQuestion.id}-${index}`} />
                            <Label htmlFor={`option-${currentQuestion.id}-${index}`} className="flex-1 cursor-pointer text-base font-body">
                            {option}
                            </Label>
                            {quizTakerState === "submitted" && option === currentQuestion.correctAnswer && (
                            <Check className="h-5 w-5 text-accent" />
                            )}
                            {quizTakerState === "submitted" &&
                            selectedAnswers[currentQuestion.id] === option &&
                            option !== currentQuestion.correctAnswer && (
                                <X className="h-5 w-5 text-destructive" />
                            )}
                        </div>
                        ))}
                    </RadioGroup>
                    {quizTakerState === "submitted" && showExplanation && currentQuestion.explanation && (
                        <div className="mt-4 p-4 border-l-4 border-primary bg-secondary/30 rounded-r-md">
                        <h4 className="font-semibold text-primary mb-1">Explanation:</h4>
                        <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                        </div>
                    )}
                    </CardContent>
                    <CardFooter>
                    {quizTakerState === "ongoing" && (
                        <Button onClick={handleSubmitAnswer} className="w-full sm:w-auto text-base py-3 px-6">Submit Answer</Button>
                    )}
                    {quizTakerState === "submitted" && (
                        <Button onClick={handleNextQuestion} className="w-full sm:w-auto text-base py-3 px-6">
                        {currentIndex < currentQuizQuestions.length - 1 ? "Next Question" : "Show Results"}
                        </Button>
                    )}
                    </CardFooter>
                </>
                ) : (
                <CardContent className="text-center space-y-6 py-10">
                    <Sparkles className="h-16 w-16 text-primary mx-auto" />
                    <CardTitle className="font-headline text-3xl">Quiz Completed!</CardTitle>
                    <CardDescription className="text-xl">
                    You scored {score} out of {currentQuizQuestions.length}.
                    </CardDescription>
                    <p className="text-2xl font-bold font-headline text-gradient">
                    {currentQuizQuestions.length > 0 ? ((score / currentQuizQuestions.length) * 100).toFixed(0) : 0}%
                    </p>
                    <Button onClick={exitQuizSession} size="lg" className="text-base py-3 px-6">
                    Back to Quiz Decks
                    </Button>
                </CardContent>
                )}
            </Card>
        </div>
      ) : isTakingQuiz && currentQuizQuestions.length === 0 ? (
         <div className="flex flex-col items-center justify-center text-center py-10">
            <CardTitle className="font-headline text-2xl">Empty Quiz Deck: {currentQuizDeckTitle}</CardTitle>
            <CardDescription className="text-base mt-2 mb-4">
                This quiz deck is currently empty.
            </CardDescription>
            <Button onClick={exitQuizSession} variant="outline">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to Decks List
            </Button>
        </div>
      ) : (
         <Card className="w-full max-w-2xl shadow-xl mx-auto text-center py-10">
            <CardHeader>
                <FileQuestion className="h-16 w-16 text-primary mx-auto mb-4" />
                <CardTitle className="font-headline text-2xl">No Quiz Loaded</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="text-base">
                {firebaseUser ? "Generate a new quiz above or select a deck." : "Please log in to take or create quizzes."}
                </CardDescription>
            </CardContent>
         </Card>
      )}

      <Dialog open={isQuizNamePromptOpen} onOpenChange={(open) => {
        if (!open && quizNamePromptResolve) {
          quizNamePromptResolve(null);
          setQuizNamePromptResolve(null);
        }
        setIsQuizNamePromptOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Quiz Deck</DialogTitle>
            <DialogDescription>
              Enter a name for your new quiz deck.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quiz-name-prompt" className="text-right">
                Name
              </Label>
              <Input
                id="quiz-name-prompt"
                value={quizNamePromptValue}
                onChange={(e) => setQuizNamePromptValue(e.target.value)}
                placeholder={quizNamePromptSuggestedValue}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (quizNamePromptResolve) quizNamePromptResolve(null);
              setQuizNamePromptResolve(null);
              setIsQuizNamePromptOpen(false);
            }}>Cancel</Button>
            <Button onClick={() => {
              const finalName = quizNamePromptValue.trim();
              if (!finalName) {
                toast({ title: "Name Required", description: "Quiz deck name cannot be empty.", variant: "destructive" });
                return;
              }
              if (quizNamePromptResolve) quizNamePromptResolve(finalName);
              setQuizNamePromptResolve(null);
              setIsQuizNamePromptOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setIsConfirmAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAlertProps.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAlertProps.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsConfirmAlertOpen(false);
              confirmAlertProps.onCancel?.();
            }}>{confirmAlertProps.cancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
               confirmAlertProps.onConfirm();
            }}>{confirmAlertProps.confirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
