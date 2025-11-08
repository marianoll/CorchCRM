'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

// This is a client component that will listen for 'permission-error' events
// and throw them as uncaught exceptions to be picked up by Next.js's error overlay.
// This is for development purposes only.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throwing the error here will cause it to be displayed in the Next.js error overlay
      // This provides immediate, rich feedback in the development environment.
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component does not render anything
}
