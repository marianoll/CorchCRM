'use server';
/**
 * @fileOverview A Genkit flow that suggests a meeting time based on email content.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

const SuggestMeetingTimeInputSchema = z.object({
  emailBody: z.string().describe('The content of the email.'),
  emailDate: z.string().datetime().describe('The date the email was sent, in ISO format. Used as the reference date for relative terms like "tomorrow".'),
});
export type SuggestMeetingTimeInput = z.infer<typeof SuggestMeetingTimeInputSchema>;


const SuggestMeetingTimeOutputSchema = z.object({
  suggestedDate: z.string().datetime().describe('The suggested meeting date in ISO format. If no specific date is found, suggests a sensible default (e.g., 3 days from emailDate).'),
});
export type SuggestMeetingTimeOutput = z.infer<typeof SuggestMeetingTimeOutputSchema>;


// ---- Prompt ----

const suggestTimePrompt = ai.definePrompt({
    name: 'suggestMeetingTimePrompt',
    model: googleAI.model('gemini-1.5-flash-latest'),
    input: { schema: SuggestMeetingTimeInputSchema },
    output: { schema: SuggestMeetingTimeOutputSchema },
    prompt: `You are a scheduling assistant. Your task is to analyze an email and suggest a meeting date.

Reference Date (the day the email was sent): {{emailDate}}

Email Body:
---
{{emailBody}}
---

**Instructions:**
1. Read the email body to find any mention of a potential meeting time or date. Look for relative terms (e.g., "tomorrow", "next Friday", "end of the week") or specific dates (e.g., "August 15th").
2. Calculate the absolute date based on the reference date. For example, if the email was sent on a Tuesday and mentions "tomorrow", the suggested date is the next day (Wednesday). If it says "next Monday", it's the upcoming Monday.
3. If no specific date or relative term is mentioned, suggest a date that is 3 business days after the reference email date.
4. Your final output MUST be a JSON object containing the key "suggestedDate" with the full date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ). Default to 10:00 AM in the local time of the reference date if no time is mentioned.

Example for an email sent on '2024-07-29T10:00:00.000Z' with body "How about tomorrow afternoon?":
{"suggestedDate": "2024-07-30T14:00:00.000Z"}
`,
});


// ---- Flow ----
const suggestMeetingTimeFlow = ai.defineFlow(
  {
    name: 'suggestMeetingTimeFlow',
    inputSchema: SuggestMeetingTimeInputSchema,
    outputSchema: SuggestMeetingTimeOutputSchema,
  },
  async (input) => {
    const llmResponse = await suggestTimePrompt(input);
    const output = llmResponse.output;

    if (!output?.suggestedDate) {
        // Fallback if LLM fails to return a date
        const fallbackDate = new Date(input.emailDate);
        fallbackDate.setDate(fallbackDate.getDate() + 3);
        return { suggestedDate: fallbackDate.toISOString() };
    }
    
    return {
        suggestedDate: output.suggestedDate
    };
  }
);

// ---- API ----
export async function suggestMeetingTime(
  input: SuggestMeetingTimeInput
): Promise<SuggestMeetingTimeOutput> {
  return suggestMeetingTimeFlow(input);
}
