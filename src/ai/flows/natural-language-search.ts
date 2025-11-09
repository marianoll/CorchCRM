'use server';
/**
 * @fileOverview A Genkit flow that translates natural language into a structured database query.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

const CrmEntitySchema = z
  .object({
    id: z.string(),
    name: z.string().optional(), // Deal.title / Contact.full_name pueden mapear acá si viene normalizado
  })
  .catchall(z.any()); // <- admite propiedades adicionales sin romper

const NaturalLanguageSearchInputSchema = z.object({
  query: z.string().describe('The natural language query from the user.'),
  contacts: z.array(CrmEntitySchema).describe('List of existing contacts for context.'),
  companies: z.array(CrmEntitySchema).describe('List of existing companies for context.'),
  deals: z.array(CrmEntitySchema).describe('List of existing deals for context.'),
});
export type NaturalLanguageSearchInput = z.infer<typeof NaturalLanguageSearchInputSchema>;

const TableOutputSchema = z.object({
  headers: z.array(z.string()).describe('Table headers.'),
  rows: z.array(z.array(z.any())).describe('Rows aligned to headers.'),
});

const NaturalLanguageSearchOutputSchema = z.object({
  response: z.union([
    z.string().describe('Summary/message when no tabular data is applicable.'),
    TableOutputSchema,
  ]),
});
export type NaturalLanguageSearchOutput = z.infer<typeof NaturalLanguageSearchOutputSchema>;

// ---- Prompt (re-diseñado anti-plantilla) ----

const searchPrompt = ai.definePrompt({
  name: 'naturalLanguageSearchPrompt',
  model: googleAI.model('gemini-1.5-pro', {
    // Salida más estable para estructuras
    generationConfig: { temperature: 0.2 },
  }),
  input: { schema: NaturalLanguageSearchInputSchema },
  output: { schema: NaturalLanguageSearchOutputSchema },
  prompt: `
You are a CRM data analyst. Read the user's query and SELECT EXACTLY ONE primary entity to answer with: "deals", "contacts", or "companies".
Then build a table from ONLY the provided context arrays.

Hard constraints:
- Do NOT reuse a fixed template of headers. Derive headers from the selected entity and from the query intent.
- Do NOT fabricate values. Only use fields that exist in the provided objects.
- Ensure headers order matches the order of each row's values (1:1 alignment).
- Prefer returning a TABLE if at least one relevant row exists; otherwise, return a short STRING message suggesting how to refine the query.
- If the query mentions metrics like amount, stage, date, company, or contact → prefer "deals".
- If the query mentions people (names, titles, emails) → prefer "contacts".
- If the query mentions firms, industry, domain, size, region → prefer "companies".
- If ambiguous, choose the best match and include a reasonable subset (top 5–10) sorted by a sensible key.

Derive columns like this (examples, not mandatory):
- deals: ["Title","Amount","Stage","Close Date","Company","Primary Contact"]
- contacts: ["Full Name","Email","Phone","Title","Company"]
- companies: ["Name","Domain","Industry","Size","Region"]

Filtering & sorting rules:
- Apply filters explicitly stated (e.g., stage='Negotiation', amount>5000, close_date this month).
- If no filters match, return a limited default view of the chosen entity (e.g., 5–10 most recent or largest).
- Sorting: if the query implies recency → sort by close_date desc (deals) or created/updated if present; if value-centric → sort by amount desc.

Output shape (VERY IMPORTANT):
Return EITHER:
1) A JSON object with key "response" containing:
   {
     "headers": string[],
     "rows": any[][]
   }
OR
2) A JSON object with key "response" containing a single short STRING message.

Context (use only these):

Contacts schema (possible fields):
{ id: string, full_name?: string, email_primary?: string, phone?: string, title?: string, seniority?: string, company_id?: string, company?: string }

Data: {{contacts}}

Companies schema (possible fields):
{ id: string, name: string, domain?: string, industry?: string, size?: string, region?: string }

Data: {{companies}}

Deals schema (possible fields):
{ id: string, title: string, amount?: number, stage?: string, close_date?: string, primary_contact_id?: string, primary_contact?: string, company_id?: string, company?: string }

Data: {{deals}}

User query:
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
      const output = llmResponse.output?.();

      if (!output || !('response' in output)) {
        throw new Error('AI returned an invalid response.');
      }

      // Validación mínima de tabla si vino tabla
      if (typeof output.response !== 'string') {
        const { headers, rows } = output.response as z.infer<typeof TableOutputSchema>;
        if (!Array.isArray(headers) || !Array.isArray(rows)) {
          throw new Error('Invalid table structure.');
        }
      }

      return { response: output.response };
    } catch (error) {
      console.error('Error in search flow, generating fallback.', error);

      // Fallback: deals recientes por close_date desc (si existe)
      const deals = Array.isArray(input.deals) ? [...input.deals] : [];
      deals.sort((a: any, b: any) => {
        const da = Date.parse(a?.close_date ?? '') || 0;
        const db = Date.parse(b?.close_date ?? '') || 0;
        return db - da;
      });
      const recentDeals = deals.slice(0, 5);

      const fallbackTable = {
        headers: ['Deal Title', 'Amount', 'Stage', 'Close Date'],
        rows:
          recentDeals.length > 0
            ? recentDeals.map((d: any) => [
                d.title ?? d.name ?? '(no title)',
                d.amount ?? null,
                d.stage ?? null,
                d.close_date ?? null,
              ])
            : [['No deals found', '-', '-', '-']],
      };

      return { response: fallbackTable };
    }
  }
);

// ---- API ----
export async function naturalLanguageSearch(
  input: NaturalLanguageSearchInput
): Promise<NaturalLanguageSearchOutput> {
  return naturalLanguageSearchFlow(input);
}
