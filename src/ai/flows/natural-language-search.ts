
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


const TableOutputSchema = z.object({
  headers: z.array(z.string()).describe("An array of strings for the table headers."),
  rows: z.array(z.array(z.any())).describe("An array of arrays, where each inner array represents a row of data corresponding to the headers."),
});

const NaturalLanguageSearchOutputSchema = z.object({
  response: z.union([
    z.string().describe('A summary of the results or a message to the user, if no table data is applicable.'),
    TableOutputSchema
  ]),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

// ---- Prompt ----

const searchPrompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: NaturalLanguageSearchInputSchema },
  output: { schema: NaturalLanguageSearchOutputSchema },
  prompt: `You are a helpful CRM data analyst. Your task is to interpret the user's natural language query, find the relevant data from the provided CRM context, and return a structured JSON object representing a table.

**CRITICAL RULE: You must ALWAYS return a dataset. NEVER state that you cannot fulfill the request or that no results were found.**

**Instructions:**

1.  **Analyze the Query:** Understand what the user is asking for (e.g., filtering by amount, date, stage, name).
2.  **Filter the Data:** Based on the query, filter the provided 'contacts', 'companies', and 'deals' arrays using their properties.
3.  **Handle Ambiguity:** If the user's query is ambiguous or doesn't match any data, **do not say you can't find results.** Instead, return a relevant default dataset (like the 5 most recent deals) and add a message encouraging the user to refine their query.
4.  **Format the Output:**
    *   Your entire response MUST be a single JSON object.
    *   The object should have a 'response' key. The value should be an object with 'headers' (an array of strings) and 'rows' (an array of arrays).
    *   Do not invent data. Only use the context provided below.

**CRM Context Data & Schemas:**

*   **Contacts:**
    *   Schema: { id: string, full_name: string, email_primary: string, phone?: string, title?: string, seniority?: string, company_id?: string }
    *   Data: {{contacts}}

*   **Companies:**
    *   Schema: { id: string, name: string, domain?: string, industry?: string, size?: string, region?: string }
    *   Data: {{companies}}

*   **Deals:**
    *   Schema: { id: string, title: string, amount: number, stage: string, close_date: string, primary_contact_id: string, company_id?: string }
    *   Data: {{deals}}

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
    try {
        const llmResponse = await searchPrompt(input);
        let output = llmResponse.output;

        if (!output || !output.response) {
            throw new Error("AI returned an invalid response.");
        }
        
        return {
            response: output.response
        };

    } catch (error) {
        console.error("Error in search flow, generating fallback.", error);
        // Fallback if the AI fails to produce a table or returns an empty/invalid response.
        const recentDeals = input.deals.slice(0, 5); // Assuming deals are sorted by date.
        
        const fallbackTable = {
            headers: ["Deal Title", "Amount", "Stage"],
            rows: recentDeals.length > 0 ? recentDeals.map(deal => [
                deal.title || deal.name,
                deal.amount,
                deal.stage,
            ]) : [["No deals found", "-", "-"]],
        };
        
        return { 
            response: fallbackTable
        };
    }
  }
);


// ---- API ----
export async function naturalLanguageSearch(
  input: NaturalLanguageSearchInput
): Promise<NaturalLanguageSearchOutput> {
  return naturalLanguageSearchFlow(input);
}
