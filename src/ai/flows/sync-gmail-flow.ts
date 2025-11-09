
'use server';
/**
 * @fileOverview A Genkit flow to sync emails from a user's connected Gmail account.
 *
 * This flow uses stored OAuth2 tokens to fetch recent emails.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeFirebase } from '@/firebase';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { google } from 'googleapis';

// ---- Schemas ----

const SyncGmailInputSchema = z.object({
  userId: z.string().describe('The ID of the user for whom to sync emails.'),
});
type SyncGmailInput = z.infer<typeof SyncGmailInputSchema>;

const EmailSchema = z.object({
    thread_id: z.string(),
    from_email: z.string(),
    to_email: z.string(),
    direction: z.enum(['inbound', 'outbound']),
    subject: z.string(),
    body_excerpt: z.string(),
    labels: z.string(),
    ts: z.string().datetime(),
});

const SyncGmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  emails: z.array(EmailSchema),
});
export type SyncGmailOutput = z.infer<typeof SyncGmailOutputSchema>;


// ---- Flow ----

const syncGmailFlow = ai.defineFlow(
  {
    name: 'syncGmailFlow',
    inputSchema: SyncGmailInputSchema,
    outputSchema: SyncGmailOutputSchema,
  },
  async ({ userId }) => {
    const { firestore } = initializeFirebase();
    if (!firestore) throw new Error("Firestore not initialized.");

    // 1. Get the user's Gmail integration credentials from Firestore
    const integrationsRef = collection(firestore, 'users', userId, 'gmailIntegrations');
    const q = query(integrationsRef, limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, message: 'No Gmail integration found for this user.', emails: [] };
    }

    const integrationData = querySnapshot.docs[0].data();
    const { accessToken, refreshToken, emailAddress } = integrationData;

    // 2. Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.OAUTH_REDIRECT_URI
    );
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

    // 3. Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
        // 4. Fetch emails from the last hour
        const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: `after:${oneHourAgo}`,
        });

        const messages = listResponse.data.messages;
        if (!messages || messages.length === 0) {
            return { success: true, message: 'No new emails in the last hour.', emails: [] };
        }

        // 5. Process each email
        const processedEmails: z.infer<typeof EmailSchema>[] = [];
        for (const message of messages.slice(0, 10)) { // Limit to 10 for safety
            if (!message.id) continue;
            
            const msgResponse = await gmail.users.messages.get({ userId: 'me', id: message.id });
            const emailData = msgResponse.data;

            if (!emailData.payload?.headers) continue;
            
            const fromHeader = emailData.payload.headers.find(h => h.name === 'From')?.value || 'unknown';
            const toHeader = emailData.payload.headers.find(h => h.name === 'To')?.value || 'unknown';
            const subjectHeader = emailData.payload.headers.find(h => h.name === 'Subject')?.value || '(No subject)';
            const dateHeader = emailData.payload.headers.find(h => h.name === 'Date')?.value || new Date().toISOString();

            processedEmails.push({
                thread_id: emailData.threadId || emailData.id!,
                from_email: fromHeader,
                to_email: toHeader,
                direction: fromHeader.includes(emailAddress) ? 'outbound' : 'inbound',
                subject: subjectHeader,
                body_excerpt: emailData.snippet || '',
                labels: emailData.labelIds?.join(';') || '',
                ts: new Date(dateHeader).toISOString(),
            });
        }
        
        return {
            success: true,
            message: `Successfully fetched ${processedEmails.length} emails.`,
            emails: processedEmails,
        };

    } catch (error: any) {
      console.error('Error fetching emails:', error);
      // Handle token expiration if needed
      if (error.response?.status === 401) {
          // This is where you would use the refresh token to get a new access token
          return { success: false, message: 'Gmail token expired. Re-authentication needed.', emails: []};
      }
      return { success: false, message: 'Failed to fetch emails from Gmail.', emails: [] };
    }
  }
);


// ---- API Export ----

export async function syncGmail(input: SyncGmailInput): Promise<SyncGmailOutput> {
  return await syncGmailFlow(input);
}
