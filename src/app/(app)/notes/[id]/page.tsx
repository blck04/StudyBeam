
"use client"; 

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CalendarDays, Tag, FileText as FileTextIcon, Pencil, Save, XCircle, Trash2, Loader2, X } from "lucide-react";
import { ClientNote, NOTES_COLLECTION, FirestoreNoteData } from "@/lib/notes-data";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { auth, studybeamDb } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
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

export default function IndividualNotePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const noteId = params.id as string;

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [note, setNote] = useState<ClientNote | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for Confirmation AlertDialog
  const [isConfirmAlertOpen, setIsConfirmAlertOpen] = useState(false);
  const [confirmAlertProps, setConfirmAlertProps] = useState({
    title: "",
    description: "",
    onConfirm: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
  });


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        router.push("/login"); // Redirect if user logs out
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (firebaseUser && noteId) {
      fetchNote();
    } else if (!firebaseUser && noteId) {
      setIsLoading(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, noteId]);

  const fetchNote = async () => {
    if (!firebaseUser || !noteId) {
      setIsLoading(false);
      setNote(undefined);
      return;
    }
    setIsLoading(true);
    try {
      const noteDocRef = doc(studybeamDb, NOTES_COLLECTION, noteId);
      const docSnap = await getDoc(noteDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirestoreNoteData;
        if (data.userId !== firebaseUser.uid) {
          toast({ title: "Access Denied", description: "You do not have permission to view this note.", variant: "destructive" });
          router.push("/notes");
          return;
        }
        const clientNoteData: ClientNote = {
          id: docSnap.id,
          title: data.title,
          summary: data.summary,
          createdAt: (data.createdAt as Timestamp).toDate(),
          updatedAt: (data.updatedAt as Timestamp).toDate(),
          sourceFileName: data.sourceFileName,
          tags: data.tags || [],
          userId: data.userId,
        };
        setNote(clientNoteData);
        setEditedTitle(clientNoteData.title);
        setEditedSummary(clientNoteData.summary);
        setEditedTags([...clientNoteData.tags]); // Initialize editedTags
      } else {
        setNote(undefined);
        toast({ title: "Note Not Found", description: "The requested note does not exist.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching note:", error);
      toast({ title: "Error", description: "Could not load the note.", variant: "destructive" });
      setNote(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (note) {
      if (!isEditing) { // Entering edit mode
        setEditedTitle(note.title);
        setEditedSummary(note.summary);
        setEditedTags([...note.tags]); // Ensure editedTags is set when starting edit
      }
      setIsEditing(!isEditing);
    }
  };

  const handleSave = async () => {
    if (!note || !firebaseUser) return;
    if (!editedTitle.trim() || !editedSummary.trim()) {
      toast({ title: "Validation Error", description: "Title and summary cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const noteDocRef = doc(studybeamDb, NOTES_COLLECTION, noteId);
      const updateData: Partial<FirestoreNoteData & { updatedAt: any }> = {
        title: editedTitle,
        summary: editedSummary,
        tags: editedTags,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(noteDocRef, updateData);
      
      setNote(prev => prev ? ({
        ...prev, 
        title: editedTitle, 
        summary: editedSummary, 
        tags: [...editedTags], 
        updatedAt: new Date() 
      }) : undefined);
      setIsEditing(false);
      toast({ title: "Note Updated", description: "Your changes have been saved." });
    } catch (error) {
      console.error("Failed to save note:", error);
      toast({ title: "Error Saving Note", description: "Could not save changes to the database.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (note) {
      setEditedTitle(note.title);
      setEditedSummary(note.summary);
      setEditedTags([...note.tags]); // Revert editedTags
    }
    setIsEditing(false);
  };

  const handleRemoveEditedTag = (tagToRemove: string) => {
    setEditedTags(prevTags => prevTags.filter(tag => tag !== tagToRemove));
  };

  const handleDeleteNote = async () => {
    if (!note || !firebaseUser) return;

    setConfirmAlertProps({
      title: "Delete Note",
      description: "Are you sure you want to delete this note? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setIsConfirmAlertOpen(false);
        setIsDeleting(true);
        try {
          const noteDocRef = doc(studybeamDb, NOTES_COLLECTION, noteId);
          await deleteDoc(noteDocRef);
          toast({ title: "Note Deleted", description: "The note has been removed." });
          router.push("/notes");
        } catch (error) {
          console.error("Failed to delete note:", error);
          toast({ title: "Error Deleting Note", description: "Could not delete the note from the database.", variant: "destructive" });
        } finally {
          setIsDeleting(false);
        }
      },
      onCancel: () => setIsConfirmAlertOpen(false),
    });
    setIsConfirmAlertOpen(true);
  };

  if (isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4 sm:p-8">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
        <h1 className="text-2xl font-semibold text-primary mb-4">Loading Note...</h1>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4 sm:p-8">
        <FileTextIcon className="w-24 h-24 text-destructive mb-6" />
        <h1 className="text-3xl font-bold text-destructive mb-4">Note Not Found</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The note you are looking for does not exist, may have been moved, or you don't have permission to view it.
        </p>
        <Button onClick={() => router.push("/notes")} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Notes
        </Button>
         <div className="mt-12">
            <Image 
                src="https://placehold.co/400x300.png" 
                alt="Lost document illustration" 
                width={400} 
                height={300} 
                className="rounded-lg shadow-md max-w-full h-auto"
                data-ai-hint="not found"
            />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full md:max-w-3xl md:mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/notes">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Notes
          </Link>
        </Button>
        {!isEditing && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleEditToggle} className="w-full sm:w-auto" disabled={isSaving || isDeleting}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" onClick={handleDeleteNote} className="w-full sm:w-auto" disabled={isSaving || isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
      </div>

      <Card className="shadow-xl">
        <CardHeader className="p-4 sm:p-6">
          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="noteTitle" className="text-sm font-medium">Title</Label>
              <Input 
                id="noteTitle" 
                value={editedTitle} 
                onChange={(e) => setEditedTitle(e.target.value)} 
                className="text-2xl sm:text-3xl font-headline font-semibold p-2"
                disabled={isSaving}
              />
            </div>
          ) : (
            <CardTitle className="font-headline text-2xl sm:text-3xl">{note.title}</CardTitle>
          )}
          <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-x-4 gap-y-1 pt-2">
            <div className="flex items-center">
              <CalendarDays className="mr-1.5 h-4 w-4 text-primary" />
              <span>Created: {note.createdAt.toLocaleDateString()}</span>
            </div>
             <div className="flex items-center">
              <CalendarDays className="mr-1.5 h-4 w-4 text-primary" />
              <span>Updated: {note.updatedAt.toLocaleDateString()}</span>
            </div>
            {note.sourceFileName && (
              <div className="flex items-center">
                <FileTextIcon className="mr-1.5 h-4 w-4 text-primary" />
                <span>Source: {note.sourceFileName}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="noteSummary" className="text-sm font-medium">Summary</Label>
              <Textarea 
                id="noteSummary"
                value={editedSummary} 
                onChange={(e) => setEditedSummary(e.target.value)} 
                rows={15}
                className="text-base"
                disabled={isSaving}
              />
            </div>
          ) : (
            <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert overflow-x-hidden w-full">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({node, ...props}) => <pre className="overflow-x-auto" {...props} />,
                }}
              >
                {note.summary}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex-col items-start gap-2 border-t p-4 sm:p-6 pt-4">
          {(isEditing ? editedTags.length > 0 : note.tags.length > 0) && (
            <>
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center">
                <Tag className="mr-1.5 h-4 w-4 text-primary" /> TAGS:
              </h4>
              <div className="flex flex-wrap gap-2">
                {isEditing ? (
                  editedTags.map(tag => (
                    <span key={tag} className="flex items-center px-2.5 py-1 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs rounded-full font-medium">
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-1.5 -mr-1 p-0 h-4 w-4 text-primary-foreground/70 hover:text-primary-foreground focus:outline-none"
                        onClick={() => handleRemoveEditedTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </span>
                  ))
                ) : (
                  note.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs rounded-full font-medium">
                      {tag}
                    </span>
                  ))
                )}
              </div>
            </>
          )}
          {isEditing && (
            <div className="flex flex-col sm:flex-row justify-end gap-2 w-full mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto" disabled={isSaving}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving || !editedTitle.trim() || !editedSummary.trim()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

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
            <AlertDialogCancel onClick={() => { setIsConfirmAlertOpen(false); confirmAlertProps.onCancel?.(); }}>{confirmAlertProps.cancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAlertProps.onConfirm}>{confirmAlertProps.confirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    