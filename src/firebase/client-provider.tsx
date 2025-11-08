'use client';
import { FirebaseProvider } from './provider';
import type { FirebaseApp } from 'firebase/app';

export function FirebaseClientProvider({
  children,
  firebaseApp,
}: {
  children: React.ReactNode;
  firebaseApp: FirebaseApp;
}) {
  return <FirebaseProvider firebaseApp={firebaseApp}>{children}</FirebaseProvider>;
}
