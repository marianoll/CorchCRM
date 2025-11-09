'use server';
/**
 * @fileOverview A Genkit flow to sync emails from Gmail for a given day.
 *
 * This flow is a placeholder and simulates fetching emails. In a real scenario,
 * it would use the Gmail API with OAuth2 credentials stored for the user.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// ---- Schemas (local variables, not exported) ----

const SyncGmailInputSchema = z.object({
  userId: z.string().describe('The ID of the user for whom to sync emails.'),
});
export type SyncGmailInput = z.infer<typeof SyncGmailInputSchema>;

const EmailSchema = z.object({
    thread_id: z.string(),
    from_email: z.string(),
    to_email: z.string(),
    direction: z.enum(['inbound', 'outbound']),
    subject: z.string(),
    body_excerpt: z.string(),
    labels: z.string(),
    ts: z.string().datetime(), // ISO 8601 string
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
    console.log(`Starting Gmail sync for user: ${userId}`);

    // STEP 1: (REAL) Authenticate and get API client.
    // (SIMULATED) We assume we have an authenticated client.

    // STEP 2: (REAL) Fetch list of message IDs from today.
    // (SIMULATED) We generate a list of raw "API-like" responses.
    const rawEmailsFromApi = [
        {
            id: `gmail-id-${Math.random().toString(16).slice(2)}`,
            threadId: `thread-${Math.random().toString(36).substring(7)}`,
            payload: {
                headers: [
                    { name: 'From', value: 'customer@example.com' },
                    { name: 'To', value: `sales+${userId.substring(0,5)}@mycompany.com` },
                    { name: 'Subject', value: 'Following up on our call' },
                    { name: 'Date', value: new Date().toUTCString() },
                ],
                snippet: 'Hi, it was great chatting with you today. I have a few more questions about the proposal you sent over. Can we connect tomorrow?',
            },
            labelIds: ['INBOX', 'IMPORTANT'],
        },
        {
            id: `gmail-id-${Math.random().toString(16).slice(2)}`,
            threadId: `thread-${Math.random().toString(36).substring(7)}`,
            payload: {
                 headers: [
                    { name: 'From', value: `sales+${userId.substring(0,5)}@mycompany.com` },
                    { name: 'To', value: 'prospect@newlead.com' },
                    { name: 'Subject', value: 'Intro to CorchCRM' },
                    { name: 'Date', value: new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString() },
                ],
                snippet: 'Hi Prospect, thanks for your interest in CorchCRM. I\'d love to schedule a 15-minute demo to show you how we can help you seal your funnel. Are you free sometime this week?',
            },
            labelIds: ['SENT'],
        }
    ];

    // STEP 3: (REAL & SIMULATED) Process each raw email into our schema.
    const processedEmails = rawEmailsFromApi.map(rawEmail => {
        const fromHeader = rawEmail.payload.headers.find(h => h.name === 'From');
        const toHeader = rawEmail.payload.headers.find(h => h.name === 'To');
        const subjectHeader = rawEmail.payload.headers.find(h => h.name === 'Subject');
        const dateHeader = rawEmail.payload.headers.find(h => h.name === 'Date');

        const from_email = fromHeader ? fromHeader.value : 'unknown';
        const to_email = toHeader ? toHeader.value : 'unknown';
        
        // A real implementation would parse the user's email from the auth token
        const userEmailDomain = 'mycompany.com';
        const direction = from_email.includes(userEmailDomain) ? 'outbound' : 'inbound';
        
        return {
            thread_id: rawEmail.threadId,
            from_email,
            to_email,
            direction,

            subject: subjectHeader ? subjectHeader.value : '(No Subject)',
            body_excerpt: rawEmail.payload.snippet,
            labels: 'followup;question', // Real implementation would map labelIds
            ts: dateHeader ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
        } as z.infer<typeof EmailSchema>;
    });


    return {
      success: true,
      message: `Successfully simulated fetching ${processedEmails.length} emails.`,
      emails: processedEmails,
    };
  }
);


// ---- API (The only async function export) ----

export async function syncGmail(input: SyncGmailInput): Promise<SyncGmailOutput> {
  try {
    return await syncGmailFlow(input);
  } catch (error: any) {
    console.error('[syncGmail] Error executing flow:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred during Gmail sync.',
      emails: [],
    };
  }
}
