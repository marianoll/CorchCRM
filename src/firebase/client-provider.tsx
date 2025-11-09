'use client';

import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { LoaderCircle } from 'lucide-react';
import { type FirebaseApp } from 'firebase/app';
import { type Auth } from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const services = initializeFirebase();
      setFirebaseServices(services);
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    } finally {
        setIsLoading(false);
    }
  }, []); 

  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
        </div>
    );
  }
  
  if (!firebaseServices) {
    return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <p className="text-destructive">Firebase could not be initialized. Please check your configuration.</p>
        </div>
    )
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
