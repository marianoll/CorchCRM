import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: applicationDefault() });

if (!adminApp) {
    throw new Error("Firebase Admin SDK failed to initialize");
}

export const adb = getFirestore(adminApp);
