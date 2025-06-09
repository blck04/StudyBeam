
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BookOpen, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/logo";

export default function LandingPage() {
  return (
    <div className="relative flex flex-col min-h-screen"> {/* Removed pattern classes, added relative */}
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="relative h-full w-full [&>div]:absolute [&>div]:inset-0 [&>div]:bg-[radial-gradient(circle_at_center,hsl(var(--primary)),transparent)] [&>div]:opacity-30 [&>div]:mix-blend-multiply">
          <div></div>
        </div>
      </div>

      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
        <Logo size="md" />
        <nav className="space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="font-headline text-5xl md:text-6xl font-bold text-gradient mb-6">
          Supercharge Your Studies with StudyBeam
        </h1>
        <p className="text-xl text-foreground/80 mb-10 max-w-2xl mx-auto">
          Upload your notes, get AI-generated flashcards, summaries, and quizzes. Ask questions and get instant answers. Ace your exams with StudyBeam!
        </p>
        <div className="inline-block rounded-md p-[2px] bg-gradient-to-r from-primary to-accent shadow-lg transition-transform hover:scale-105">
          <Button
            size="lg"
            asChild
            className="bg-background hover:bg-muted text-foreground !shadow-none"
          >
            <Link href="/login">
              Get Started Now
            </Link>
          </Button>
        </div>
      </main>

      <section className="pt-1 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-headline text-4xl font-semibold text-gradient text-center mb-12">Features to Help You Succeed</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-full mb-4">
                  <Zap size={24} />
                </div>
                <CardTitle className="font-headline text-2xl">AI Content Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Turn lecture notes into summaries, flashcards, and practice quizzes effortlessly with our advanced AI.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-full mb-4">
                  <BookOpen size={24} />
                </div>
                <CardTitle className="font-headline text-2xl">Interactive Learning Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Engage with your study material through flashcard reviews and auto-generated quizzes designed for effective learning.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-full mb-4">
                  <MessageSquare size={24} />
                </div>
                <CardTitle className="font-headline text-2xl">AI Q&amp;A Assistant</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Got questions? Our AI assistant provides real-time answers based on your study materials, helping you understand complex topics.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="text-center py-8 text-foreground/60 border-t border-border">
        <p>&copy; {new Date().getFullYear()} StudyBeam. All rights reserved.</p>
      </footer>
    </div>
  );
}
