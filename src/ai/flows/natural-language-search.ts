'use server';
/**
 * @fileOverview A Genkit flow that translates natural language into a structured database query.
 *
 * - naturalLanguageSearch - The main function to call the flow.
 * - NaturalLanguageSearchInput - The input type for the flow.
 * - NaturalLanguageSearchOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language query from the user.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const NaturalLanguageSearchOutputSchema = z.object({
  results: z.string().describe('A summary of the results or a message to the user.'),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

// ---- Prompt ----

const searchPrompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  model: googleAI.model('gemini-2.0-flash-lite-001'),
  input: { schema: NaturalLanguageSearchInputSchema },
  output: { schema: NaturalLanguageSearchOutputSchema },
  prompt: `You are a helpful CRM assistant. Your task is to interpret the user's natural language query and provide a concise, helpful answer based on it.

DO NOT just repeat the query. Acknowledge the query and state what you are looking for.

User Query:
---
{{query}}
---

Example Response:
If the user asks "Top deals above €20,000 closing this month", a good response would be:
"Sure, I'm looking for all deals with a value greater than €20,000 that are expected to close in the current month."

Now, provide a response for the user's query.`,
});


// ---- Flow ----
const naturalLanguageSearchFlow = ai.defineFlow(
  {
    name: 'naturalLanguageSearchFlow',
    inputSchema: NaturalLanguageSearchInputSchema,
    outputSchema: NaturalLanguageSearchOutputSchema,
  },
  async ({ query }) => {
    // In a real application, you would add a step here to:
    // 1. Translate the natural language query into a structured database query (e.g., SQL or Firestore query).
    // 2. Execute the query against the database.
    // 3. Format the results into a human-readable summary.
    // For now, we will just have the AI interpret the query and respond.

    const llmResponse = await searchPrompt({ query });
    const output = llmResponse.output;

    if (!output?.results) {
        return { results: "I'm sorry, I couldn't understand that query. Could you rephrase it?" };
    }
    
    return {
        results: output.results
    };
  }
);


// ---- API ----
export async function naturalLanguageSearch(
  input: NaturalLanguageSearchInput
): Promise<NaturalLanguageSearchOutput> {
  return naturalLanguageSearchFlow(input);
}
