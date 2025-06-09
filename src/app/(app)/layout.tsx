
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { Logo } from "@/components/logo"; // Import the Logo component

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
  // params prop removed as it's not used in this component
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full"> {/* Added w-full here */}
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-background"> {/* Added overflow-x-hidden */}
          <header className="sticky top-0 z-10 flex h-[57px] items-center justify-between border-b bg-background px-4 md:hidden">
            <SidebarTrigger asChild>
              <Button variant="default" size="icon" className="shrink-0">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
            </SidebarTrigger>
            <div className="flex-grow flex justify-center">
              <Logo size="sm" />
            </div>
            <div className="w-10"></div> {/* Spacer to balance the trigger button */}
          </header>
          {/* This div now also defines the flex direction for its children */}
          <div className="flex-1 flex flex-col px-2 py-4 sm:px-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
          <footer className="p-4 border-t bg-background text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} StudyBeam. All rights reserved.
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

