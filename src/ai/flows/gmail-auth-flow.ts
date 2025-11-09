
'use server';
/**
 * @fileOverview Genkit flows for handling Gmail API OAuth 2.0 authentication.
 *
 * - getGmailAuthUrl: Generates the URL for the user to grant consent.
 * - processGmailAuthCode: Exchanges an auth code for tokens and saves them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { initializeFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Explicitly load environment variables from .env.local
require('dotenv').config({ path: './.env.local' });


const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];


// ---- Flow: Get Auth URL ----

const getAuthUrlOutputSchema = z.object({
  url: z.string().url(),
});

export const getGmailAuthUrl = ai.defineFlow(
  {
    name: 'getGmailAuthUrl',
    inputSchema: z.void(),
    outputSchema: getAuthUrlOutputSchema,
  },
  async () => {
    // Initialize the OAuth2 client inside the flow to ensure env vars are loaded.
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important to get a refresh token
      scope: GMAIL_SCOPES,
      prompt: 'consent', // Force consent screen to ensure refresh token
    });
    return { url };
  }
);


// ---- Flow: Process Auth Code ----

const processAuthCodeInputSchema = z.object({
  code: z.string().describe('The authorization code from Google OAuth redirect.'),
  userId: z.string().describe('The ID of the user to save tokens for.'),
});

const processAuthCodeOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const processGmailAuthCode = ai.defineFlow(
  {
    name: 'processGmailAuthCode',
    inputSchema: processAuthCodeInputSchema,
    outputSchema: processAuthCodeOutputSchema,
  },
  async ({ code, userId }) => {
    if (!code) {
      return { success: false, message: 'Authorization code is missing.' };
    }
     if (!userId) {
      return { success: false, message: 'User ID is missing.' };
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);
      const { access_token, refresh_token, expiry_date } = tokens;

      if (!access_token || !refresh_token) {
        throw new Error('Failed to retrieve access or refresh token.');
      }
      
      const { firestore } = initializeFirebase();
      if (!firestore) throw new Error("Firestore not available");

      // We use the user's email as the ID for the integration document for simplicity
      const oauth2ClientWithTokens = new google.auth.OAuth2();
      oauth2ClientWithTokens.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2ClientWithTokens });
      const userInfo = await oauth2.userinfo.get();
      
      const emailAddress = userInfo.data.email;
      if (!emailAddress) {
          throw new Error("Could not retrieve user's email address from Google.");
      }

      const integrationRef = doc(firestore, 'users', userId, 'gmailIntegrations', emailAddress);
      
      const integrationData = {
          id: integrationRef.id,
          userId: userId,
          emailAddress: emailAddress,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiryDate: expiry_date,
      };

      setDoc(integrationRef, integrationData, { merge: true }).catch(err => {
         const permissionError = new FirestorePermissionError({
            path: integrationRef.path,
            operation: 'write',
            requestResourceData: integrationData,
         });
         errorEmitter.emit('permission-error', permissionError);
         throw err;
      });

      return {
        success: true,
        message: `Successfully connected Gmail account: ${emailAddress}`,
      };

    } catch (error: any) {
      console.error('Error exchanging auth code for tokens:', error.response?.data || error.message);
      return {
        success: false,
        message: 'Failed to process authorization code.',
      };
    }
  }
);
