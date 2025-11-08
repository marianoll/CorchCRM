'use server';

/**
 * @fileOverview Natural Language Search flow for CRM data.
 *
 * - naturalLanguageSearch - A function that accepts a natural language query and returns relevant CRM data.
 * - NaturalLanguageSearchInput - The input type for the naturalLanguageSearch function.
 * - NaturalLanguageSearchOutput - The return type for the naturalLanguageSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language query to search CRM data.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const NaturalLanguageSearchOutputSchema = z.object({
  results: z.string().describe('The relevant CRM data based on the natural language query.'),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

export async function naturalLanguageSearch(input: NaturalLanguageSearchInput): Promise<NaturalLanguageSearchOutput> {
  return naturalLanguageSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  input: {schema: NaturalLanguageSearchInputSchema},
  output: {schema: NaturalLanguageSearchOutputSchema},
  prompt: `You are an AI assistant that translates natural language search queries into SQL queries to retrieve data from a CRM database.

  The CRM database contains tables for Contacts, Deals, and Tasks.
  - The Contacts table has columns: id, name, email, phone, company.
  - The Deals table has columns: id, name, contact_id, amount, close_date, stage.
  - The Tasks table has columns: id, description, deal_id, due_date, status.

  Translate the following natural language query into a SQL query that can be executed against the CRM database to retrieve the relevant information.

  Query: {{{query}}}

  Return the SQL query as a string.

  If the user is asking to show data, make sure to return a plain english explanation of what data is shown after the query.`,
});

const naturalLanguageSearchFlow = ai.defineFlow(
  {
    name: 'naturalLanguageSearchFlow',
    inputSchema: NaturalLanguageSearchInputSchema,
    outputSchema: NaturalLanguageSearchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {results: output!.results};
  }
);
