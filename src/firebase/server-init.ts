'use server';
import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// IMPORTANT: DO NOT MODIFY THIS FILE
// This file is used to initialize the Firebase Admin SDK on the server side.
// It is configured to work with Firebase App Hosting's automatic credentials.

interface FirebaseServerServices {
  firebaseApp: App;
  firestore: Firestore;
  auth: Auth;
}

// Memoize the initialized services to avoid re-initialization on every call
let services: FirebaseServerServices | null = null;

export function initializeFirebaseServer(): FirebaseServerServices {
  if (services) {
    return services;
  }

  if (!getApps().length) {
    let firebaseApp: App;
    try {
      // In a deployed App Hosting environment, GOOGLE_APPLICATION_CREDENTIALS
      // is automatically set. initializeApp() with no arguments will use it.
      firebaseApp = initializeApp();
    } catch (e) {
      console.warn(
        'Automatic server initialization failed. This is expected in local development. Falling back to service account key.'
      );
      try {
        // In a local environment, it will look for a serviceAccountKey.json file
        const serviceAccount = require('../../../serviceAccountKey.json');
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
      } catch (e2) {
         console.error(
          'Fallback to serviceAccountKey.json failed. Please ensure the file exists in the root directory for local development.', e2
        );
        // If even the fallback fails, we must throw to prevent the app from running in a broken state.
        throw new Error('Could not initialize Firebase Admin SDK. Please check your configuration.');
      }
    }

    services = {
      firebaseApp,
      firestore: getFirestore(firebaseApp),
      auth: getAuth(firebaseApp),
    };

    return services;

  } else {
    const firebaseApp = getApp();
    services = {
      firebaseApp,
      firestore: getFirestore(firebaseApp),
      auth: getAuth(firebaseApp),
    };
    return services;
  }
}
