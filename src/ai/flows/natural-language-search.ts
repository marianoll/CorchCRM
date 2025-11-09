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

const CrmEntitySchema = z.object({
  id: z.string(),
  name: z.string().optional(), // Deal has title, contact has full_name
  [z.string()]: z.any(), // Allow other properties
});

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language query from the user.'),
  contacts: z.array(CrmEntitySchema).describe('List of existing contacts for context.'),
  companies: z.array(CrmEntitySchema).describe('List of existing companies for context.'),
  deals: z.array(CrmEntitySchema).describe('List of existing deals for context.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const NaturalLanguageSearchOutputSchema = z.object({
  results: z.string().describe('A summary of the results or a message to the user, formatted in Markdown. If returning a list, use a Markdown table.'),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

// ---- Prompt ----

const searchPrompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  model: googleAI.model('gemini-2.0-flash-lite-001'),
  input: { schema: NaturalLanguageSearchInputSchema },
  output: { schema: NaturalLanguageSearchOutputSchema },
  prompt: `You are a helpful CRM data analyst. Your task is to interpret the user's natural language query, find the relevant data from the provided CRM context, and return a concise, helpful answer formatted in Markdown.

**Instructions:**

1.  **Analyze the Query:** Understand what the user is asking for.
2.  **Filter the Data:** Based on the query, filter the provided 'contacts', 'companies', and 'deals' arrays. You must only use the data provided in the context.
3.  **Format the Output:**
    *   Your entire response MUST be a single Markdown string.
    *   If the query results in a list of items (e.g., "all deals over 50k"), you MUST format the output as a Markdown table. Include relevant columns only. For deals, use 'title', 'amount', and 'stage'. For contacts, use 'full_name' and 'email_primary'.
    *   If the query asks for an aggregation (e.g., "average deal size"), provide a clear text answer.
    *   If no results are found, state that clearly (e.g., "I couldn't find any deals matching that criteria.").
    *   Do not invent data. Only use the context provided below.

**CRM Context Data:**

*   **Contacts:**
    {{{json contacts}}}

*   **Companies:**
    {{{json companies}}}

*   **Deals:**
    {{{json deals}}}

**User Query:**
---
{{query}}
---
`,
});


// ---- Flow ----
const naturalLanguageSearchFlow = ai.defineFlow(
  {
    name: 'naturalLanguageSearchFlow',
    inputSchema: NaturalLanguageSearchInputSchema,
    outputSchema: NaturalLanguageSearchOutputSchema,
  },
  async (input) => {
    const llmResponse = await searchPrompt(input);
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
