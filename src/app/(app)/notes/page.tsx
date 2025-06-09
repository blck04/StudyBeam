
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookOpenText, StickyNote, MessageSquare, Loader2, Trash2 } from "lucide-react";
import { ClientNote, NOTES_COLLECTION, FirestoreNoteData } from "@/lib/notes-data";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, Timestamp, doc, deleteDoc } from "firebase/firestore";
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

export default function NotesPage() {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);

  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setNotes([]); // Clear notes if user logs out
        setIsLoadingNotes(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      fetchNotes(firebaseUser.uid);
    } else {
      setNotes([]);
      setIsLoadingNotes(false);
    }
  }, [firebaseUser]);

  const fetchNotes = async (userId: string) => {
    setIsLoadingNotes(true);
    try {
      const q = query(
        collection(studybeamDb, NOTES_COLLECTION),
        where("userId", "==", userId),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedNotes: ClientNote[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreNoteData;
        fetchedNotes.push({
          id: doc.id,
          title: data.title,
          summary: data.summary,
          createdAt: (data.createdAt as Timestamp).toDate(),
          updatedAt: (data.updatedAt as Timestamp).toDate(),
          sourceFileName: data.sourceFileName,
          tags: data.tags || [],
          userId: data.userId,
        });
      });
      setNotes(fetchedNotes);
    } catch (error) {
      console.error("Failed to load notes from Firestore:", error);
      toast({
        title: "Error Loading Notes",
        description: "Could not retrieve your saved notes from the database.",
        variant: "destructive",
      });
      setNotes([]); 
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const handleDeleteRequest = (noteId: string, noteTitle: string) => {
    if (!firebaseUser) {
      toast({ title: "Authentication Required", description: "Please log in to delete notes.", variant: "destructive" });
      return;
    }
    setNoteToDelete({ id: noteId, title: noteTitle });
    setIsConfirmAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!noteToDelete || !firebaseUser) {
      toast({ title: "Error", description: "Note details not found or user not authenticated.", variant: "destructive" });
      setIsConfirmAlertOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(studybeamDb, NOTES_COLLECTION, noteToDelete.id));
      setNotes(prev => prev.filter(n => n.id !== noteToDelete!.id));
      toast({ title: "Note Deleted", description: `"${noteToDelete.title}" has been removed.` });
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the note.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setNoteToDelete(null);
      setIsConfirmAlertOpen(false);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (note.sourceFileName && note.sourceFileName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-headline font-semibold text-gradient mb-2 flex items-center justify-center">
          <BookOpenText className="mr-3 h-10 w-10 text-primary" /> My Notes
        </h1>
        <p className="text-lg text-muted-foreground">
          Access and review your generated notes and summaries.
        </p>
      </header>

      <div className="max-w-2xl mx-auto">
        <Input
          type="search"
          placeholder="Search notes by title, content, filename, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-base"
        />
      </div>

      {isLoadingNotes ? (
         <div className="flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your notes...</p>
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
              <Link href={`/notes/${note.id}`} className="block flex flex-col flex-grow">
                <CardHeader>
                  <CardTitle className="font-headline text-xl line-clamp-2">{note.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Last updated: {note.updatedAt.toLocaleDateString()}
                    {note.sourceFileName && ` (Source: ${note.sourceFileName})`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {note.summary.substring(0, 150)}{note.summary.length > 150 ? "..." : ""}
                  </p>
                </CardContent>
              </Link>
              <CardFooter className="mt-auto p-4 flex justify-end border-t">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteRequest(note.id, note.title);
                  }}
                  disabled={!firebaseUser || isDeleting}
                  aria-label={`Delete note ${note.title}`}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive"
                >
                  {isDeleting && noteToDelete?.id === note.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="max-w-3xl mx-auto text-center py-10 shadow-lg">
          <CardHeader>
             <StickyNote className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="font-headline text-2xl">No Notes Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardDescription className="text-base">
              {searchTerm
                ? "No notes match your search criteria."
                : "You haven't generated or saved any notes yet. Go to Chat to generate notes from AI responses!"}
            </CardDescription>
            {!searchTerm && firebaseUser && ( 
              <Button asChild>
                <Link href="/qa">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Go to Chat
                </Link>
              </Button>
            )}
            {!firebaseUser && ( 
                 <p className="text-sm text-muted-foreground">Please <Link href="/login" className="underline text-primary">login</Link> to view and create notes.</p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setIsConfirmAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the note "{noteToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsConfirmAlertOpen(false); setNoteToDelete(null); }} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
