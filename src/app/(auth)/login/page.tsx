'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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

  useEffect(() => {
    // If user is loaded and exists, redirect to home.
    if (!isUserLoading && user) {
      router.replace('/home');
    }
  }, [user, isUserLoading, router]);

  const handleSignIn = async () => {
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Authentication service not available.' });
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Create or update user document in Firestore
      const userRef = doc(firestore, 'users', user.uid);
      const userData = {
          id: user.uid,
          email: user.email,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
      };
      
      setDoc(userRef, userData, { merge: true }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'write',
            requestResourceData: userData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

      toast({ title: "Successfully signed in!" });
    } catch (error: any) {
      console.error("Authentication Error:", error);
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: error.message || 'Could not sign in with Google. Please try again.',
      });
    }
  };

  // While loading, or if user is already logged in, show a loader
  if (isUserLoading || user) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
  }

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
          <Button onClick={handleSignIn} className="w-full" disabled={!auth}>
            <GoogleIcon />
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
