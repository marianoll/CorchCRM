
'use server';

/**
 * @fileOverview Natural Language Search flow for CRM data.
 *
 * - naturalLanguageSearchFlow - A function that accepts a natural language query and returns relevant CRM data.
 * - NaturalLanguageSearchInput - The input type for the naturalLanguageSearchFlow function.
 * - NaturalLanguageSearchOutput - The return type for the naturalLanguageSearchFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language query to search CRM data.'),
  context: z.object({
    contacts: z.array(z.any()).optional(),
    deals: z.array(z.any()).optional(),
    companies: z.array(z.any()).optional(),
  }).describe('The CRM data context for the query.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const NaturalLanguageSearchOutputSchema = z.object({
  results: z.string().describe('The answer to the query based on the provided CRM data context.'),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

const prompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  input: {schema: NaturalLanguageSearchInputSchema},
  output: {schema: NaturalLanguageSearchOutputSchema},
  system: `You are an expert CRM assistant. Your task is to answer the user's question based *only* on the data provided in the context.
Do not make up information. If the answer is not in the data, say that you cannot find the information.
Format your answer in a clear and concise way. You can use markdown for lists or tables if it helps.

Here is the data context you have access to:
- Contacts: {{{json context.contacts}}}
- Deals: {{{json context.deals}}}
- Companies: {{{json context.companies}}}
`,
  user: `Question: {{{query}}}`,
});

export const naturalLanguageSearchFlow = ai.defineFlow(
  {
    name: 'naturalLanguageSearchFlow',
    inputSchema: NaturalLanguageSearchInputSchema,
    outputSchema: NaturalLanguageSearchOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    const output = response.output;
    return output || {results: "I could not process the search request."};
  }
);
