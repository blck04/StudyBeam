
"use client";

import { useState, type FormEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { generateStudyMaterials, type GenerateStudyMaterialsOutput } from "@/ai/flows/generate-study-materials";
import { Loader2, Paperclip, Wand2, Zap, StickyNote, BookOpenCheck, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UploadPage() {
  const [lectureNotes, setLectureNotes] = useState("");
  const [generatedContent, setGeneratedContent] = useState<GenerateStudyMaterialsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      try {
        const text = await file.text();
        setLectureNotes(text);
        toast({
          title: "File Loaded",
          description: `${file.name} content loaded. You can now generate study materials.`,
        });
      } catch (error) {
        console.error("Failed to read file:", error);
        toast({
          title: "Error Reading File",
          description: "Could not read the content of the selected file.",
          variant: "destructive",
        });
        setFileName(null);
      }
    }
     if (event.target) {
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lectureNotes.trim()) {
      toast({
        title: "Input Required",
        description: "Please paste or upload lecture notes.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setGeneratedContent(null);
    try {
      const result = await generateStudyMaterials({ lectureNotes });
      setGeneratedContent(result);
      toast({
        title: "Study Materials Generated!",
        description: "Flashcards, summary, and practice questions are ready.",
      });
    } catch (error) {
      console.error("Error generating study materials:", error);
      toast({
        title: "Generation Failed",
        description: "An error occurred while generating study materials.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="text-center">
        <h1 className="text-4xl font-headline font-semibold text-gradient mb-2">Upload &amp; Generate</h1>
        <p className="text-lg text-muted-foreground">
          Transform your lecture notes into powerful study aids with AI.
        </p>
      </header>

      <Card className="shadow-xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Your Study Material</CardTitle>
            <CardDescription>
              Paste your notes directly, or click the paperclip icon to attach a file (e.g., .txt, .md).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notes-input-area" className="sr-only">
                Notes input area
              </Label>
              <div className="flex items-start gap-2 p-2 border bg-background rounded-lg relative">
                <input
                  id="file-upload"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-1.5 text-primary hover:text-primary/80 flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea
                  id="notes-input-area"
                  placeholder="Paste notes or attach files to generate flash cards"
                  value={lectureNotes}
                  onChange={(e) => {
                    setLectureNotes(e.target.value);
                    if (fileName && e.target.value === "") {
                      setFileName(null);
                    }
                  }}
                  rows={1}
                  className="flex-grow resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-1.5 bg-transparent placeholder-muted-foreground"
                />
              </div>
            </div>
            {fileName && <p className="text-sm text-muted-foreground italic">Attached file: {fileName}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || !lectureNotes.trim()} className="w-full sm:w-auto text-base py-3 px-6">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate Study Materials
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {generatedContent && (
        <Card className="shadow-xl mt-8">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center">
              <Zap className="mr-2 h-6 w-6 text-primary" /> Generated Content
            </CardTitle>
            <CardDescription>
              Here are your AI-generated study materials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="summary" className="w-full">
              <AccordionItem value="summary">
                <AccordionTrigger className="text-lg font-headline hover:no-underline text-gradient">
                   <StickyNote className="mr-2 h-5 w-5 text-primary"/> Summary
                </AccordionTrigger>
                <AccordionContent className="prose prose-sm max-w-none dark:prose-invert p-2 bg-background rounded-md border">
                  <p className="whitespace-pre-wrap">{generatedContent.summary}</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="flashcards">
                <AccordionTrigger className="text-lg font-headline hover:no-underline text-gradient">
                    <BookOpenCheck className="mr-2 h-5 w-5 text-primary"/>Flashcards ({generatedContent.flashcards.length})
                </AccordionTrigger>
                <AccordionContent className="space-y-2 p-2">
                  {generatedContent.flashcards.map((flashcard, index) => (
                    <Card key={index} className="bg-secondary/30 p-3">
                      <p className="text-sm">{flashcard}</p>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="practice-questions">
                <AccordionTrigger className="text-lg font-headline hover:no-underline text-gradient">
                    <HelpCircle className="mr-2 h-5 w-5 text-primary"/>Practice Questions ({generatedContent.practiceQuestions.length})
                </AccordionTrigger>
                <AccordionContent className="space-y-2 p-2">
                  {generatedContent.practiceQuestions.map((pq, index) => (
                    <Card key={index} className="bg-secondary/30 p-3 text-sm">
                      <p className="font-semibold">Q: {pq.question}</p>
                      <ul className="list-disc pl-5 mt-1">
                        {pq.options.map((opt, i) => (
                          <li key={i} className={opt === pq.correctAnswer ? 'text-accent font-medium' : ''}>
                            {opt}
                            {opt === pq.correctAnswer && <span className="ml-2 text-xs">(Correct)</span>}
                          </li>
                        ))}
                      </ul>
                      {pq.explanation && <p className="text-xs italic mt-1">Explanation: {pq.explanation}</p>}
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


