
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Layers, 
  FileQuestion, 
  BookOpenText, 
  User,
  LogOut,
  Settings,
  History,
} from 'lucide-react';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarFooter,
  useSidebar
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation'; 

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/qa', label: 'Chat', icon: MessageSquare },
  { href: '/chat-history', label: 'Chat History', icon: History },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },
  { href: '/quiz', label: 'Quiz', icon: FileQuestion },
  { href: '/notes', label: 'Notes', icon: BookOpenText },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter(); 
  const { open, isMobile, setOpenMobile } = useSidebar();
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user); // This will update when auth state changes, including profile updates
    });
    return () => unsubscribe();
  }, []);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const getAvatarFallback = (name?: string | null) => {
    if (!name || name === "Loading...") return "SB";
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    return initials.length > 0 ? initials.substring(0, 2) : "U";
  }
  
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login'); 
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  return (
    <Sidebar collapsible={isMobile ? "offcanvas" : "icon"} variant="sidebar">
      <SidebarHeader className={cn("p-4 border-b border-sidebar-border", {"justify-center": !open && !isMobile})}>
        { (open || isMobile) && <Logo size="md" /> }
        { (!open && !isMobile) && <Logo size="sm" /> }
      </SidebarHeader>
      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                  tooltip={item.label}
                  onClick={handleLinkClick}
                  className={cn(
                    "justify-start",
                    (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && 
                    "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  )}
                >
                  <a>
                    <item.icon className="h-5 w-5" />
                    {(open || isMobile) && <span className="ml-2">{item.label}</span>}
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost"
                className={cn(
                  "w-full justify-start p-2 text-sidebar-foreground", 
                  "hover:bg-gradient-to-r hover:from-primary hover:to-accent hover:text-primary-foreground",
                  {"justify-center": !open && !isMobile }
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={authUser?.photoURL || ""} alt={authUser?.displayName || "User avatar"} data-ai-hint="user avatar" />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                    {getAvatarFallback(authUser?.displayName)}
                  </AvatarFallback>
                </Avatar>
                {(open || isMobile) && <span className="ml-2 font-medium truncate max-w-[100px]">{authUser?.displayName || "User"}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 bg-popover text-popover-foreground">
              <DropdownMenuLabel>{authUser?.displayName || "My Account"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" onClick={handleLinkClick}><User className="mr-2 h-4 w-4" />Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                 <Link href="/profile" onClick={handleLinkClick}><Settings className="mr-2 h-4 w-4" />Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { handleLinkClick(); handleLogout(); }}>
                <LogOut className="mr-2 h-4 w-4" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
