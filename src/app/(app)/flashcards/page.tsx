
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, Layers3, ChevronLeft, BookCopy, Save, Paperclip, Wand2, Loader2, PlusCircle, SkipForward, SkipBack, RotateCcw, XCircle, Search, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateStudyMaterials } from "@/ai/flows/generate-study-materials";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, Timestamp, doc, deleteDoc } from "firebase/firestore";
import { FLASHCARDS_COLLECTION, type ClientFlashcardCollection, type FirestoreFlashcardCollectionData, type Flashcard } from "@/lib/flashcards-data";
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
  DialogClose,
} from "@/components/ui/dialog";


export default function FlashcardsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [notesForGeneration, setNotesForGeneration] = useState("");
  const [inputFileName, setInputFileName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [availableCollections, setAvailableCollections] = useState<ClientFlashcardCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentReviewCards, setCurrentReviewCards] = useState<Flashcard[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showManualAddSection, setShowManualAddSection] = useState(false);
  const [currentDeckTitle, setCurrentDeckTitle] = useState<string | null>(null);
  const [isCurrentDeckUnsaved, setIsCurrentDeckUnsaved] = useState(false); 

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const [newManualQuestion, setNewManualQuestion] = useState("");
  const [newManualAnswer, setNewManualAnswer] = useState("");

  const [showAiNotesInput, setShowAiNotesInput] = useState(false);

  // State for Deck Name Prompt Dialog
  const [isDeckNamePromptOpen, setIsDeckNamePromptOpen] = useState(false);
  const [deckNamePromptValue, setDeckNamePromptValue] = useState("");
  const [deckNamePromptSuggestedValue, setDeckNamePromptSuggestedValue] = useState("");
  const [deckNamePromptResolve, setDeckNamePromptResolve] = useState<((value: string | null) => void) | null>(null);

  // State for Confirmation AlertDialog
  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [confirmAlertProps, setConfirmAlertProps] = useState({
    title: "",
    description: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  const currentCard = currentReviewCards[currentIndex];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setAvailableCollections([]);
        setIsLoadingCollections(false);
        setIsReviewing(false); 
        setShowManualAddSection(false);
        setCurrentReviewCards([]);
        setCurrentDeckTitle(null);
        setIsCurrentDeckUnsaved(false);
        setNotesForGeneration("");
        setInputFileName(null);
        setShowAiNotesInput(false);
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (firebaseUser) {
      fetchFlashcardCollections(firebaseUser.uid);
    } else {
      setAvailableCollections([]);
      setIsLoadingCollections(false);
    }
  }, [firebaseUser]);

  const fetchFlashcardCollections = async (userId: string) => {
    setIsLoadingCollections(true);
    try {
      const q = query(
        collection(studybeamDb, FLASHCARDS_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedCollections: ClientFlashcardCollection[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreFlashcardCollectionData;
        fetchedCollections.push({
          id: doc.id,
          userId: data.userId,
          title: data.title,
          description: data.description,
          cards: data.cards,
          createdAt: (data.createdAt as Timestamp).toDate(),
          updatedAt: (data.updatedAt as Timestamp).toDate(),
        });
      });
      setAvailableCollections(fetchedCollections);
    } catch (error) {
      console.error("Failed to load flashcard collections:", error);
      toast({ title: "Error", description: "Could not load your flashcard decks.", variant: "destructive" });
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  const handleFileAttachChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInputFileName(file.name);
      try {
        const text = await file.text();
        setNotesForGeneration(text);
        toast({
          title: "File Loaded",
          description: `${file.name} content loaded. You can now generate flashcards.`,
        });
      } catch (error) {
        console.error("Failed to read file:", error);
        toast({ title: "Error Reading File", description: "Could not read the content of the selected file.", variant: "destructive" });
        setInputFileName(null);
      }
    }
    if (event.target) event.target.value = ""; 
  };

  const handleGenerateFlashcards = async () => {
    if (!notesForGeneration.trim()) {
      toast({ title: "Input Required", description: "Please paste or upload notes to generate flashcards.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setShowManualAddSection(false);
    try {
      const result = await generateStudyMaterials({ lectureNotes: notesForGeneration });
      const newFlashcards = result.flashcards.map((fcString, index) => {
        let parts = fcString.split(/ - | :: | \? /);
        let question = fcString;
        let answer = "See question for context / No answer provided by AI";

        if (parts.length > 1) {
          question = parts[0].trim();
          answer = parts.slice(1).join(" - ").trim();
        } else {
          const colonParts = fcString.split(/:(.*)/s);
          if (colonParts.length > 1 && colonParts[0].trim().length > 0 && colonParts[1].trim().length > 0) {
            question = colonParts[0].trim();
            answer = colonParts[1].trim();
          }
        }
        return { id: Date.now() + index, question, answer };
      });

      if (newFlashcards.length === 0) {
        toast({ title: "No Flashcards Generated", description: "The AI couldn't generate flashcards from the provided text.", variant: "default" });
      } else {
        setCurrentReviewCards(newFlashcards);
        setCurrentDeckTitle(inputFileName ? `New AI: ${inputFileName.split('.')[0]}` : "New AI-Generated Deck");
        setIsCurrentDeckUnsaved(true);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsReviewing(true);
        setNotesForGeneration(""); 
        setInputFileName(null);
        setShowAiNotesInput(false); 
        toast({ title: "Flashcards Generated!", description: `${newFlashcards.length} new flashcards ready for review.` });
      }
    } catch (error) {
      console.error("Error generating flashcards:", error);
      toast({ title: "Generation Failed", description: "Could not generate flashcards from the AI.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartManualDeckCreation = () => {
    setNotesForGeneration("");
    setInputFileName(null);
    setCurrentReviewCards([]);
    setCurrentDeckTitle("New Manual Deck");
    setIsCurrentDeckUnsaved(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsReviewing(true);
    setShowManualAddSection(true);
    setShowAiNotesInput(false);
    setNewManualQuestion("");
    setNewManualAnswer("");
    toast({ title: "New Deck Started", description: "Add your flashcards manually below." });
  };

  const promptForDeckName = (suggestedName: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setDeckNamePromptSuggestedValue(suggestedName);
      setDeckNamePromptValue(suggestedName);
      setDeckNamePromptResolve(() => resolve);
      setIsDeckNamePromptOpen(true);
    });
  };

  const _performActualSaveDeck = async (titleToSave: string): Promise<boolean> => {
    if (!firebaseUser || currentReviewCards.length === 0) return false;

    const newCollectionData: Omit<FirestoreFlashcardCollectionData, 'createdAt' | 'updatedAt'> = {
      userId: firebaseUser.uid,
      title: titleToSave,
      cards: currentReviewCards,
      description: inputFileName ? `Generated from ${inputFileName}` : currentDeckTitle?.includes("Manual") ? `Manually created on ${new Date().toLocaleDateString()}` : `Generated on ${new Date().toLocaleDateString()}`
    };
    
    try {
      const docRef = await addDoc(collection(studybeamDb, FLASHCARDS_COLLECTION), {
        ...newCollectionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAvailableCollections(prev => [...prev, { ...newCollectionData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() }].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      setCurrentDeckTitle(titleToSave);
      setIsCurrentDeckUnsaved(false);
      setInputFileName(null);
      toast({ title: "Deck Saved!", description: `"${titleToSave}" has been added to your collections.` });
      return true;
    } catch (error) {
      console.error("Error saving deck to Firestore:", error);
      toast({ title: "Save Failed", description: "Could not save the deck to the database.", variant: "destructive" });
      return false;
    }
  };

  const handleSaveDeck = async (): Promise<boolean> => {
    if (!isCurrentDeckUnsaved || !firebaseUser) {
      if (!firebaseUser) toast({ title: "Login Required", description: "Please log in to save your deck.", variant: "destructive" });
      return false;
    }
    if (currentReviewCards.length === 0) {
      toast({ title: "Empty Deck", description: "Add some cards before saving.", variant: "default" });
      return false;
    }

    const suggestedNameBase = currentDeckTitle?.startsWith("New AI: ") ? currentDeckTitle.substring(8)
      : currentDeckTitle?.startsWith("New Manual Deck") ? "My Manual Deck"
      : currentDeckTitle || "My New Deck";

    const deckTitleFromPrompt = await promptForDeckName(suggestedNameBase);

    if (deckTitleFromPrompt) {
      return await _performActualSaveDeck(deckTitleFromPrompt);
    } else {
      toast({ title: "Save Cancelled", description: "Deck name was not provided. The deck was not saved.", variant: "default" });
      return false;
    }
  };

  const startReviewSession = (collectionToReview: ClientFlashcardCollection) => {
    setCurrentReviewCards(collectionToReview.cards);
    setCurrentDeckTitle(collectionToReview.title);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsReviewing(true);
    setShowManualAddSection(false); 
    setShowAiNotesInput(false);
    setIsCurrentDeckUnsaved(false); 
  };

  const performExitActions = () => {
    setIsReviewing(false);
    setShowManualAddSection(false);
    setCurrentReviewCards([]);
    setCurrentDeckTitle(null);
    setIsCurrentDeckUnsaved(false); 
    setNewManualQuestion("");
    setNewManualAnswer("");
    setShowAiNotesInput(false);
  };
  
  const exitReviewSession = async () => {
    if (isCurrentDeckUnsaved && currentReviewCards.length > 0 && firebaseUser) {
      setConfirmAlertProps({
        title: "Unsaved Changes",
        description: "You have unsaved changes. Would you like to save this deck before exiting?",
        confirmText: "Save & Exit",
        cancelText: "Don't Save",
        onConfirm: async () => {
          setIsConfirmAlertOpen(false);
          const savedSuccessfully = await handleSaveDeck();
          if (savedSuccessfully) {
            performExitActions();
          }
        },
        onCancel: () => {
          setIsConfirmAlertOpen(false);
          setConfirmAlertProps({
            title: "Exit Without Saving?",
            description: "Are you sure you want to exit without saving? Your changes will be lost.",
            confirmText: "Exit Anyway",
            cancelText: "Stay",
            onConfirm: () => {
              setIsConfirmAlertOpen(false);
              performExitActions();
            },
            onCancel: () => setIsConfirmAlertOpen(false),
          });
          setIsConfirmAlertOpen(true);
        },
      });
      setIsConfirmAlertOpen(true);
    } else {
      performExitActions();
    }
  };
  
  const handleAddManualCard = () => {
    if (newManualQuestion.trim() === "" || newManualAnswer.trim() === "") {
      toast({ title: "Input Required", description: "Question and Answer cannot be empty.", variant: "destructive" });
      return;
    }

    const newId = currentReviewCards.length > 0 
                  ? Math.max(...currentReviewCards.map(card => card.id), 0) + 1 
                  : Date.now();

    const newCard: Flashcard = { id: newId, question: newManualQuestion, answer: newManualAnswer };
    
    const updatedCards = [...currentReviewCards, newCard];
    setCurrentReviewCards(updatedCards);
    
    if (!isReviewing) { 
        setIsReviewing(true);
        setShowManualAddSection(true);
        setCurrentDeckTitle(prev => prev || "New Manual Deck"); 
        setIsCurrentDeckUnsaved(true);
    } else { 
        setIsCurrentDeckUnsaved(true);
    }
    
    setNewManualQuestion("");
    setNewManualAnswer("");
    setCurrentIndex(updatedCards.length - 1); 
    setIsFlipped(false);
    toast({ title: "Card Added!", description: "The new flashcard has been added to the current deck." });
  };

  const handleDeleteFlashcardDeck = async (deckId: string, deckTitle: string) => {
    if (!firebaseUser) {
      toast({ title: "Authentication Required", description: "Please log in to delete decks.", variant: "destructive" });
      return;
    }

    setConfirmAlertProps({
      title: "Delete Flashcard Deck",
      description: `Are you sure you want to delete the deck "${deckTitle}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setIsConfirmAlertOpen(false);
        try {
          await deleteDoc(doc(studybeamDb, FLASHCARDS_COLLECTION, deckId));
          setAvailableCollections(prev => prev.filter(deck => deck.id !== deckId));
          toast({ title: "Flashcard Deck Deleted", description: `"${deckTitle}" has been removed.` });
        } catch (error) {
          console.error("Error deleting flashcard deck:", error);
          toast({ title: "Deletion Failed", description: "Could not delete the flashcard deck.", variant: "destructive" });
        }
      },
      onCancel: () => setIsConfirmAlertOpen(false),
    });
    setIsConfirmAlertOpen(true);
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1, zIndex: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0, zIndex: 0 }),
  };
  const [slideDirection, setSlideDirection] = useState(0);

  const handleNextCard = () => {
    paginate(1);
  };

  const handlePreviousCard = () => {
    paginate(-1);
  };

  const paginate = (newDirection: number) => {
    setSlideDirection(newDirection);
    setIsFlipped(false);
    if (newDirection > 0) { 
      setCurrentIndex((prevIndex) => (prevIndex + 1) % currentReviewCards.length);
    } else { 
      setCurrentIndex((prevIndex) => (prevIndex - 1 + currentReviewCards.length) % currentReviewCards.length);
    }
  };

  let primaryAiButtonText: React.ReactNode;
  let primaryAiButtonIcon: React.ReactNode;
  let primaryAiButtonOnClick: () => void;

  if (isGenerating) {
    primaryAiButtonText = "Generating...";
    primaryAiButtonIcon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    primaryAiButtonOnClick = () => {}; // No-op
  } else if (showAiNotesInput) {
    if (notesForGeneration.trim()) {
      primaryAiButtonText = "Generate & Review";
      primaryAiButtonIcon = <Wand2 className="mr-2 h-4 w-4" />;
      primaryAiButtonOnClick = handleGenerateFlashcards;
    } else {
      primaryAiButtonText = "Hide Notes Input";
      primaryAiButtonIcon = <XCircle className="mr-2 h-4 w-4" />;
      primaryAiButtonOnClick = () => setShowAiNotesInput(false);
    }
  } else {
    primaryAiButtonText = "Input Notes for AI";
    primaryAiButtonIcon = <Wand2 className="mr-2 h-4 w-4" />;
    primaryAiButtonOnClick = () => setShowAiNotesInput(true);
  }

  const filteredCollections = availableCollections.filter(collection =>
    collection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (collection.description && collection.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );


  return (
    <div className="p-4 space-y-8">
      {!isReviewing && (
        <>
          <Card className="shadow-xl w-full max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="font-headline text-2xl">Generate Flashcards with AI</CardTitle>
              <CardDescription>
                Paste your notes or attach a file (.txt, .md) to automatically generate flashcards.
              </CardDescription>
            </CardHeader>
            {showAiNotesInput && (
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes-input-area-flashcards" className="sr-only">
                    Paste notes or attach files to generate flash cards
                  </Label>
                  <div className="flex items-start gap-2 p-2 border bg-background rounded-lg relative">
                    <input
                      id="file-upload-flashcards"
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
                      aria-label="Attach file for flashcards"
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Textarea
                      id="notes-input-area-flashcards"
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
                </div>
                {inputFileName && <p className="text-sm text-muted-foreground italic">Source: {inputFileName}</p>}
              </CardContent>
            )}
            <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center sm:justify-center">
              <Button 
                onClick={primaryAiButtonOnClick}
                disabled={isGenerating || !firebaseUser}
                className="w-full sm:w-auto text-base py-3 px-6"
              >
                {primaryAiButtonIcon} {primaryAiButtonText}
              </Button>
              <Button onClick={handleStartManualDeckCreation} variant="outline" disabled={!firebaseUser || isGenerating} className="w-full sm:w-auto text-base py-3 px-6">
                 <PlusCircle className="mr-2 h-5 w-5" /> Add Deck Manually
              </Button>
            </CardFooter>
          </Card>
        </>
      )}

      {showManualAddSection && isReviewing && (
        <Card className="shadow-xl w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Add Flashcard Manually to: <span className="text-primary">{currentDeckTitle}</span></CardTitle>
            <CardDescription>
              Add your own questions and answers to the current deck.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="manual-question">Question</Label>
              <Input 
                id="manual-question"
                value={newManualQuestion}
                onChange={(e) => setNewManualQuestion(e.target.value)}
                placeholder="Enter question"
              />
            </div>
            <div>
              <Label htmlFor="manual-answer">Answer</Label>
              <Textarea 
                id="manual-answer"
                value={newManualAnswer}
                onChange={(e) => setNewManualAnswer(e.target.value)}
                placeholder="Enter answer"
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleAddManualCard} disabled={!firebaseUser || !newManualQuestion.trim() || !newManualAnswer.trim()} className="text-base py-3 px-6">
              <PlusCircle className="mr-2 h-5 w-5" /> Add to Current Deck
            </Button>
          </CardFooter>
        </Card>
      )}


      {!isReviewing ? (
        <div className="space-y-6">
          <h2 className="text-3xl font-headline font-semibold text-gradient text-center">Your Flashcard Decks</h2>
          
          {!isLoadingCollections && availableCollections.length > 0 && (
            <div className="max-w-xl mx-auto relative">
              <Input
                type="search"
                placeholder="Search decks by title or description..."
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
                <p className="text-muted-foreground">Loading your decks...</p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <Card className="text-center py-10 shadow-lg max-w-md mx-auto">
              <CardHeader>
                <BookCopy className="h-16 w-16 text-primary/70 mx-auto mb-4" strokeWidth={1.5}/>
                <CardTitle className="font-headline text-2xl">
                  {searchTerm ? "No Decks Found" : "No Decks Yet"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {firebaseUser
                    ? searchTerm
                      ? "No decks match your search criteria. Try a different term or clear search."
                      : "Generate flashcards with AI or create a new deck manually to start learning!"
                    : "Please log in to see or create flashcard decks."}
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCollections.map((collection) => (
                <Card key={collection.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <CardHeader>
                    <CardTitle className="font-headline text-xl">{collection.title}</CardTitle>
                    {collection.description && <CardDescription className="text-sm line-clamp-2">{collection.description}</CardDescription>}
                     <CardDescription className="text-xs pt-1">
                        Updated: {collection.updatedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{collection.cards.length} cards.</p>
                  </CardContent>
                  <CardFooter className="flex items-center gap-2 mt-auto pt-4">
                    <Button onClick={() => startReviewSession(collection)} className="flex-grow">
                      <Layers3 className="mr-2 h-4 w-4" /> Review Deck
                    </Button>
                     <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleDeleteFlashcardDeck(collection.id, collection.title)}
                      aria-label={`Delete flashcard deck ${collection.title}`}
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
      ) : currentReviewCards.length > 0 && currentCard ? (
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="w-full max-w-xl">
            <div className="mb-6 flex justify-between items-center">
                <Button onClick={exitReviewSession} variant="outline">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to Decks
                </Button>
                {isCurrentDeckUnsaved && firebaseUser && (
                <Button onClick={handleSaveDeck} disabled={!firebaseUser || currentReviewCards.length === 0}>
                    <Save className="mr-2 h-4 w-4" /> Save Deck
                </Button>
                )}
            </div>
            <header className="text-center">
              <h1 className="text-3xl font-headline font-semibold text-gradient mb-1">Reviewing: {currentDeckTitle}</h1>
              <p className="text-lg text-muted-foreground">
                Card {currentIndex + 1} of {currentReviewCards.length}
              </p>
            </header>
          </div>

          <div className="w-full max-w-xl h-80 relative overflow-hidden perspective"> 
            <AnimatePresence initial={false} custom={slideDirection} mode="wait">
              <motion.div
                key={currentCard.id + currentIndex} 
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                className="absolute w-full h-full" 
              >
                <motion.div
                  className="relative w-full h-full cursor-pointer" 
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6 }}
                  onClick={handleFlip}
                >
                  <div
                    className={cn(
                      "absolute w-full h-full rounded-xl shadow-2xl flex items-center justify-center p-6 text-center bg-card text-card-foreground"
                    )}
                    style={{ transform: 'rotateY(0deg)', backfaceVisibility: 'hidden' }}
                  >
                    <p className="text-2xl font-medium font-body">{currentCard.question}</p>
                  </div>

                  <div
                    className={cn(
                      "absolute w-full h-full rounded-xl shadow-2xl flex items-center justify-center p-6 text-center bg-gradient-to-br from-primary to-accent text-primary-foreground"
                    )}
                    style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
                  >
                    <p className="text-2xl font-medium font-body">{currentCard.answer}</p>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center space-y-4 w-full max-w-xl">
            <div className="flex justify-around w-full">
                <Button onClick={handlePreviousCard} size="sm" variant="outline" disabled={currentReviewCards.length <= 1}>
                    <SkipBack className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button onClick={handleFlip} size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" /> Flip Card
                </Button>
                <Button onClick={handleNextCard} size="sm" variant="outline" disabled={currentReviewCards.length <= 1}>
                    Next <SkipForward className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </div>
        </div>
      ) : isReviewing && currentReviewCards.length === 0 ? (
         <div className="flex flex-col items-center justify-center text-center py-10">
            <CardTitle className="font-headline text-2xl">Empty Deck: {currentDeckTitle}</CardTitle>
            <CardDescription className="text-base mt-2 mb-4">
                This deck is currently empty. {showManualAddSection ? "Add some cards manually using the form above!" : "Please add cards or generate a new deck."}
            </CardDescription>
            <Button onClick={exitReviewSession} variant="outline">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to Decks List
            </Button>
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center text-center py-10">
            <CardTitle className="font-headline text-2xl">Loading Cards...</CardTitle>
            <CardDescription className="text-base mt-2">
                {firebaseUser ? "Please select a deck or generate new flashcards." : "Please log in to review or create decks."}
            </CardDescription>
            <Button onClick={exitReviewSession} variant="outline" className="mt-4">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to Decks
            </Button>
        </div>
      )}

      {/* Deck Name Prompt Dialog */}
      <Dialog open={isDeckNamePromptOpen} onOpenChange={(open) => {
        if (!open && deckNamePromptResolve) {
          deckNamePromptResolve(null); // Resolve with null if closed without action
          setDeckNamePromptResolve(null);
        }
        setIsDeckNamePromptOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Deck</DialogTitle>
            <DialogDescription>
              Enter a name for your new flashcard deck.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deck-name-prompt" className="text-right">
                Name
              </Label>
              <Input
                id="deck-name-prompt"
                value={deckNamePromptValue}
                onChange={(e) => setDeckNamePromptValue(e.target.value)}
                placeholder={deckNamePromptSuggestedValue}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (deckNamePromptResolve) deckNamePromptResolve(null);
              setDeckNamePromptResolve(null);
              setIsDeckNamePromptOpen(false);
            }}>Cancel</Button>
            <Button onClick={() => {
              const finalName = deckNamePromptValue.trim();
              if (!finalName) {
                toast({ title: "Name Required", description: "Deck name cannot be empty.", variant: "destructive" });
                return;
              }
              if (deckNamePromptResolve) deckNamePromptResolve(finalName);
              setDeckNamePromptResolve(null);
              setIsDeckNamePromptOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog */}
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
              // onConfirm might close the dialog itself or lead to other actions
              confirmAlertProps.onConfirm();
            }}>{confirmAlertProps.confirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    
