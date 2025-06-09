
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Edit3, LogOut, Bell, ShieldCheck, Palette, Loader2, Save, X, UploadCloud } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, storage } from "@/lib/firebase"; // Import storage
import { onAuthStateChanged, signOut, sendPasswordResetEmail, updateProfile, type User as FirebaseUser } from "firebase/auth";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"; // Firebase storage functions
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  joinDate: string;
  studyStreaks: number; 
}

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "Loading...",
    email: "Loading...",
    avatarUrl: "", 
    joinDate: "N/A",
    studyStreaks: 0, // Placeholder, not dynamic yet
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  
  const [isSavingProfile, setIsSavingProfile] = useState(false); 
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);


  useEffect(() => {
    // Dark mode initialization
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      const isDark = storedTheme === 'dark';
      setDarkModeEnabled(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkModeEnabled(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      setDarkModeEnabled(false);
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    const unsubscribe = onAuthStateChanged(auth, (currentAuthUser) => {
      if (currentAuthUser) {
        setFirebaseUser(currentAuthUser);
        const profileData: UserProfile = {
          name: currentAuthUser.displayName || "User",
          email: currentAuthUser.email || "No email",
          avatarUrl: currentAuthUser.photoURL || "",
          joinDate: currentAuthUser.metadata.creationTime 
            ? new Date(currentAuthUser.metadata.creationTime).toLocaleDateString() 
            : "N/A",
          studyStreaks: 0, // Placeholder
        };
        setUserProfile(profileData);
        setEditableName(profileData.name);
        setAvatarPreview(profileData.avatarUrl); 
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && firebaseUser) {
      setSelectedAvatarFile(file); // Store file for potential save with name change
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Avatar is now staged. It will be uploaded if the user saves profile OR clicks "Change Avatar" directly and it's the only change.
      // For simplicity, let's make "Change Avatar" button also trigger upload IF in edit mode, or upload directly if not.
      // The current implementation uploads immediately.
      setIsUploadingAvatar(true);
      try {
        const fileRef = storageRef(storage, `avatars/${firebaseUser.uid}/${file.name}`);
        await uploadBytes(fileRef, file);
        const photoURL = await getDownloadURL(fileRef);
        
        await updateProfile(firebaseUser, { photoURL });
        
        setFirebaseUser(auth.currentUser); // Refresh firebaseUser to get updated photoURL
        setUserProfile(prev => ({ ...prev, avatarUrl: photoURL }));
        setAvatarPreview(photoURL); // Ensure preview uses the uploaded URL
        
        toast({ title: "Avatar Updated", description: "Your new avatar has been saved." });
      } catch (error: any) {
        console.error("Error uploading avatar:", error);
        toast({ title: "Avatar Upload Failed", description: error.message || "Could not upload avatar.", variant: "destructive" });
        setAvatarPreview(userProfile.avatarUrl); // Revert preview on error
      } finally {
        setIsUploadingAvatar(false);
        setSelectedAvatarFile(null); // Clear selected file after attempt
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  const handleEditToggle = () => {
    if (isEditing) { 
      // Revert changes if canceling edit mode
      setEditableName(userProfile.name); 
      setAvatarPreview(userProfile.avatarUrl);
      setSelectedAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      // Entering edit mode
      setEditableName(userProfile.name);
      setAvatarPreview(userProfile.avatarUrl);
    }
    setIsEditing(!isEditing);
  };
  
  const handleSaveProfile = async () => {
    if (!firebaseUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (editableName.trim() === "") {
        toast({ title: "Validation Error", description: "Name cannot be empty.", variant: "destructive" });
        return;
    }

    setIsSavingProfile(true);
    try {
      let photoURLToUpdate = firebaseUser.photoURL;

      // If a new avatar file was selected during edit mode, upload it now.
      if (selectedAvatarFile) {
        setIsUploadingAvatar(true); // Show specific loading for avatar part
        const fileRef = storageRef(storage, `avatars/${firebaseUser.uid}/${selectedAvatarFile.name}`);
        await uploadBytes(fileRef, selectedAvatarFile);
        photoURLToUpdate = await getDownloadURL(fileRef);
        setIsUploadingAvatar(false);
      }

      await updateProfile(firebaseUser, { 
        displayName: editableName,
        ...(photoURLToUpdate !== firebaseUser.photoURL && { photoURL: photoURLToUpdate }) // Only include photoURL if it changed
      });
      
      setFirebaseUser(auth.currentUser); // Refresh user
      setUserProfile(prev => ({ ...prev, name: editableName, avatarUrl: photoURLToUpdate || prev.avatarUrl }));
      if (photoURLToUpdate) setAvatarPreview(photoURLToUpdate);

      setIsEditing(false);
      setSelectedAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update profile.", variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
      setIsUploadingAvatar(false); // Ensure this is reset
    }
  };

  const handleChangePassword = async () => {
    if (!userProfile.email || userProfile.email === "Loading..." || userProfile.email === "No email") {
      toast({ title: "Error", description: "User email not available to send password reset.", variant: "destructive" });
      return;
    }
    setIsChangingPassword(true);
    try {
      await sendPasswordResetEmail(auth, userProfile.email);
      toast({ title: "Password Reset Email Sent", description: `A password reset link has been sent to ${userProfile.email}.` });
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast({ title: "Error", description: error.message || "Could not send reset email.", variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast({ title: "Logout Failed", description: error.message || "Could not log out.", variant: "destructive" });
      setIsLoggingOut(false); 
    }
  };

  const getAvatarFallback = (name: string) => {
    if (!name || name === "Loading...") return "SB";
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    return initials.length > 0 ? initials.substring(0, 2) : "SB";
  }

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkModeEnabled(checked);
    localStorage.setItem('theme', checked ? 'dark' : 'light');
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast({ title: `Dark mode ${checked ? 'enabled' : 'disabled'}` });
  };

  const anySubOperationInProgress = isSavingProfile || isUploadingAvatar;
  const anyOperationInProgress = anySubOperationInProgress || isChangingPassword || isLoggingOut;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <input type="file" ref={fileInputRef} onChange={handleAvatarFileChange} accept="image/*" style={{ display: 'none' }} disabled={!isEditing && anyOperationInProgress} />
      <header className="text-center sm:text-left">
        <h1 className="text-4xl font-headline font-semibold text-gradient mb-2 flex items-center">
          <User className="mr-3 h-10 w-10 text-primary" /> User Profile
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <Card className="md:col-span-1 shadow-xl">
          <CardHeader className="items-center text-center">
            <div className="relative">
              <Avatar className="w-32 h-32 mb-4 border-4 border-primary shadow-md">
                <AvatarImage src={avatarPreview || ""} alt={userProfile.name} data-ai-hint="user avatar" />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {getAvatarFallback(userProfile.name)}
                </AvatarFallback>
              </Avatar>
              {(isUploadingAvatar && !isSavingProfile) && ( // Show loader only for direct avatar change, not during full profile save
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full mb-4">
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                </div>
              )}
            </div>
            <CardTitle className="font-headline text-2xl">{isEditing ? editableName : userProfile.name}</CardTitle>
            <CardDescription>{userProfile.email}</CardDescription>
            {isEditing && (
              <Button variant="outline" size="sm" className="mt-2" onClick={handleAvatarButtonClick} disabled={anySubOperationInProgress || isChangingPassword || isLoggingOut}>
                {isUploadingAvatar && isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />} 
                {isUploadingAvatar && isSavingProfile ? "Uploading..." : selectedAvatarFile ? "Change Staged Avatar" : "Stage Avatar"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Joined:</strong> {userProfile.joinDate}</p>
            <p><strong>Current Study Streak:</strong> {userProfile.studyStreaks} days</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Account Information</CardTitle>
            <CardDescription>View and update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={editableName} 
                onChange={(e) => setEditableName(e.target.value)}
                disabled={!isEditing || anyOperationInProgress} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={userProfile.email} disabled />
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={anySubOperationInProgress || isChangingPassword || isLoggingOut}>
                  {(isSavingProfile || (isUploadingAvatar && selectedAvatarFile)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile
                </Button>
                <Button variant="outline" onClick={handleEditToggle} disabled={anySubOperationInProgress || isChangingPassword || isLoggingOut}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleEditToggle} disabled={anyOperationInProgress}>
                <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Settings</CardTitle>
          <CardDescription>Customize your StudyBeam experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="notifications" className="font-medium text-base flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive updates and reminders via email.</p>
            </div>
            <Switch 
              id="notifications" 
              checked={emailNotificationsEnabled} 
              onCheckedChange={setEmailNotificationsEnabled}
              disabled={anyOperationInProgress}
            />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="darkMode" className="font-medium text-base flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Toggle between light and dark themes.</p>
            </div>
            <Switch 
              id="darkMode"
              checked={darkModeEnabled}
              onCheckedChange={handleDarkModeToggle}
              disabled={anyOperationInProgress}
            />
          </div>
           <div className="p-4 border rounded-lg space-y-3">
              <Label className="font-medium text-base flex items-center mb-1"><ShieldCheck className="mr-2 h-5 w-5 text-primary" /> Account Security</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleChangePassword} 
                  disabled={isChangingPassword || (anyOperationInProgress && !isChangingPassword)}
                  className="w-full sm:w-auto"
                >
                  {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleLogout} 
                  disabled={isLoggingOut || (anyOperationInProgress && !isLoggingOut)}
                  className="w-full sm:w-auto"
                >
                  {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />} 
                  Logout
                </Button>
              </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
