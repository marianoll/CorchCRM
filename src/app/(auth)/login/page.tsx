'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { LoaderCircle } from 'lucide-react';

function GoogleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.94 11.001c0-1.28-.11-2.52-.32-3.7H12v6.8h5.02c-.21 1.45-1.04 3.3-3.18 4.79l3.59 2.72c2.14-1.98 3.58-4.93 3.58-8.61z"/>
            <path d="M12 21.001c3.1 0 5.69-1.02 7.59-2.72l-3.59-2.72c-1.04.7-2.37 1.11-3.99 1.11-3.08 0-5.69-2.07-6.62-4.88H1.89v2.8C3.78 18.331 7.5 21.001 12 21.001z"/>
            <path d="M5.38 12.001c0-.7.1-1.38.29-2.03V7.17H1.89C1.32 8.441 1 10.161 1 12.001s.32 3.56.89 4.83l3.2-2.8c-.19-.65-.29-1.33-.29-2.03z"/>
            <path d="M12 5.381c1.67 0 3.1.57 4.22 1.6l3.18-3.18C17.68 1.431 15.1 0 12 0 7.5 0 3.78 2.67 1.89 6.43l3.49 2.8c.93-2.81 3.54-4.85 6.62-4.85z"/>
        </svg>
    )
}

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);

  useEffect(() => {
    // If user is already authenticated (and not loading), redirect to home immediately.
    if (!isUserLoading && user) {
      router.replace('/home');
    }
  }, [user, isUserLoading, router]);


  const handleSignIn = async () => {
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Authentication service not available.' });
        return;
    }
    setIsProcessingLogin(true);
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const loggedInUser = result.user;

        // Create user document in Firestore
        const userRef = doc(firestore, 'users', loggedInUser.uid);
        const userData = {
            id: loggedInUser.uid,
            email: loggedInUser.email,
            firstName: loggedInUser.displayName?.split(' ')[0] || '',
            lastName: loggedInUser.displayName?.split(' ').slice(1).join(' ') || '',
        };
        
        await setDoc(userRef, userData, { merge: true });

        toast({ title: "Successfully signed in!" });
        // The useEffect hook will handle the redirection to '/home'
        
    } catch (error: any) {
         if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            toast({
                variant: 'default',
                title: 'Sign-in cancelled',
                description: 'The sign-in window was closed before completion.',
            });
        } else if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
             toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'Could not save user data after login.',
            });
        } else {
            console.error("Sign-in Error:", error);
            toast({
                variant: 'destructive',
                title: 'Authentication Failed',
                description: error.message || 'An unexpected error occurred during sign-in.',
            });
        }
    } finally {
        setIsProcessingLogin(false);
    }
  };

  // Show a loader while the user session is loading.
  if (isUserLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }

  // If we are done loading and there's no user, show the login page.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <Logo />
            </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your CRM dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignIn} className="w-full" disabled={isProcessingLogin || !auth}>
            {isProcessingLogin ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
