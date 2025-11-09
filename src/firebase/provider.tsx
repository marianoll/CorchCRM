'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userState, setUserState] = useState<{ user: User | null; isUserLoading: boolean; userError: Error | null; }>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUserState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth]);

  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp,
    firestore,
    auth,
    ...userState,
  }), [firebaseApp, firestore, auth, userState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {contextValue.isUserLoading ? (
         <div className="flex h-screen w-full items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </FirebaseContext.Provider>
  );
};

function useFirebaseContext(): FirebaseContextState {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
}


export const useFirebase = useFirebaseContext;
export const useAuth = (): Auth => useFirebaseContext().auth;
export const useFirestore = (): Firestore => useFirebaseContext().firestore;
export const useFirebaseApp = (): FirebaseApp => useFirebaseContext().firebaseApp;
export const useUser = (): { user: User | null; isUserLoading: boolean; userError: Error | null } => {
    const { user, isUserLoading, userError } = useFirebaseContext();
    return { user, isUserLoading, userError };
};

export function useMemoFirebase<T>(
  factory: (firestore: Firestore, user: User) => T | null,
  deps: DependencyList
): T | null {
    const { firestore, user, isUserLoading } = useFirebase();

    return useMemo(() => {
        if (isUserLoading || !user) {
            return null;
        }
        return factory(firestore, user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, user, isUserLoading, ...deps]);
}
