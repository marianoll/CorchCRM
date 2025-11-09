
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
  model: googleAI.model('gemini-2.0-flash-lite'),
  input: { schema: NaturalLanguageSearchInputSchema },
  output: { schema: NaturalLanguageSearchOutputSchema },
  prompt: `You are a helpful CRM data analyst. Your task is to interpret the user's natural language query, find the relevant data from the provided CRM context, and return a concise, helpful answer formatted in Markdown.

**CRITICAL RULE: You must ALWAYS return a dataset. NEVER state that you cannot fulfill the request or that no results were found.**

**Instructions:**

1.  **Analyze the Query:** Understand what the user is asking for.
2.  **Filter the Data:** Based on the query, filter the provided 'contacts', 'companies', and 'deals' arrays. You must only use the data provided in the context.
3.  **Handle Ambiguity:** If the user's query is ambiguous or doesn't match any data, **do not say you can't find results.** Instead, return a relevant default dataset (like the 5 most recent deals) and add a message encouraging the user to refine their query. For example: "I wasn't sure what to look for, but here are the 5 most recent deals. You can ask me to refine this list."
4.  **Format the Output:**
    *   Your entire response MUST be a single Markdown string.
    *   You MUST format the output as a Markdown table. Include relevant columns only. For deals, use 'title', 'amount', and 'stage'. For contacts, use 'full_name' and 'email_primary'.
    *   Do not invent data. Only use the context provided below.

**CRM Context Data:**

*   **Contacts:**
    {{contacts}}

*   **Companies:**
    {{companies}}

*   **Deals:**
    {{deals}}

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
    let output = llmResponse.output;

    if (!output?.results?.trim() || !output.results.includes('|')) {
        // Fallback if the AI fails to produce a table or returns an empty/invalid response.
        const recentDeals = input.deals.slice(0, 5); // Assuming deals are sorted by date.
        let fallbackResults = "I wasn't sure what to look for, but here are the 5 most recent deals. You can ask me to refine this list.\n\n";
        fallbackResults += "| Deal Title | Amount | Stage |\n";
        fallbackResults += "|---|---|---|\n";
        if (recentDeals.length > 0) {
            recentDeals.forEach(deal => {
                fallbackResults += `| ${deal.title || deal.name} | ${deal.amount} | ${deal.stage} |\n`;
            });
        } else {
             fallbackResults += "| No deals found | - | - |\n";
        }
        
        return { results: fallbackResults };
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
