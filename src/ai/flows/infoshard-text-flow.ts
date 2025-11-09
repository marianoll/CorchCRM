'use server';
/**
 * @fileOverview A Genkit flow to process unstructured text into structured "infotopes" and "orchestrator" commands,
 * with entity linking against existing CRM data. It includes a "create and retry" mechanism for unfound entities.
 *
 * - infoshardText - A function that calls the Genkit flow.
 * - InfoshardTextInput - The input type for the flow.
 * - InfoshardTextOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

const CrmEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const InfoshardTextInputSchema = z.object({
  text: z.string().describe('The unstructured text to be processed.'),
  contacts: z.array(CrmEntitySchema).describe('List of existing contacts for entity resolution.'),
  companies: z.array(CrmEntitySchema).describe('List of existing companies for entity resolution.'),
  deals: z.array(CrmEntitySchema).describe('List of existing deals for entity resolution.'),
});
export type InfoshardTextInput = z.infer<typeof InfoshardTextInputSchema>;

const InfotopeSchema = z.object({
    entityName: z.string().describe("The name of the entity this fact is linked to (e.g., 'Javier Gomez', 'Tech Solutions')."),
    entityId: z.string().optional().describe("The 6-character short ID of the matched entity from the CRM context, or 'Not Found' if no match was made."),
    fact: z.string().describe("The atomic fact extracted from the text (e.g., 'He works at Tech Solutions', 'Budget is around $50k').")
});

const InfoshardTextOutputSchema = z.object({
  infotopes: z
    .array(InfotopeSchema)
    .describe('A list of atomic facts, each linked to a specific entity.'),
  orchestrators: z
    .array(z.string())
    .describe(
      'A list of plain-text instructions for the AI orchestrator based on the text.'
    ),
});
export type InfoshardTextOutput = z.infer<typeof InfoshardTextOutputSchema>;


// ---- Prompt ----
const infoshardTextPrompt = ai.definePrompt({
  name: 'infoshardTextPrompt',
  model: googleAI.model('gemini-2.0-flash-lite-001'),
  input: { schema: InfoshardTextInputSchema },
  output: { schema: InfoshardTextOutputSchema },
  prompt: `You are an expert text analysis and entity resolution AI for a CRM.
Your task is to extract "infotopes" (atomic, self-contained facts) and "orchestrators" (plain-text commands) and link them to specific CRM entities.

**Instructions:**

1.  **Analyze the Text:** Read the user's unstructured text.
2.  **Extract Atomic Facts (Infotopes):** Identify individual pieces of information. For each fact, determine which entity it belongs to (e.g., a fact about a person belongs to a Contact, a fact about a budget belongs to a Deal).
3.  **Link to CRM Entities:** For each infotope, try to match the entity mentioned in the text (e.g., "Javier Gomez", "Tech Solutions") with an entity from the provided lists (contacts, companies, deals).
    *   If you find a match, use the entity's name and the first 6 characters of its ID.
    *   If you cannot find a match, use the name mentioned in the text and "Not Found" as the ID.
    *   Infotopes can be similar but belong to different entities. For example, a budget fact might apply to both a Contact and a Deal. Create separate infotopes for each.
4.  **Generate Orchestrators:**
    *   **If an entity is "Not Found"**: Create an orchestrator command to create it. Example: "Create contact: Julian Lopez".
    *   Generate other relevant commands based on the text. Example: "Update deal 'Cloud Migration' with amount $50,000".
5.  **Return JSON:** Format your entire output as a single JSON object that strictly matches the output schema.

**CRM Context Data:**

*   **Contacts:**
    {{#each contacts}}
    - {{name}} (ID: {{id}})
    {{/each}}
*   **Companies:**
    {{#each companies}}
    - {{name}} (ID: {{id}})
    {{/each}}
*   **Deals:**
    {{#each deals}}
    - {{name}} (ID: {{id}})
    {{/each}}

**Unstructured Text to Analyze:**
---
{{text}}
---
`,
});


// ---- Flow ----
const infoshardTextFlow = ai.defineFlow(
  {
    name: 'infoshardTextFlow',
    inputSchema: InfoshardTextInputSchema,
    outputSchema: InfoshardTextOutputSchema,
  },
  async (input) => {
    if (!input.text || input.text.trim().length < 10) {
      return { infotopes: [], orchestrators: ['Input text is too short.'] };
    }

    try {
      const res = await infoshardTextPrompt(input);
      let output = res.output;

      if (!output) {
        throw new Error('No output from AI model.');
      }
      
      const hasNotFound = output.infotopes.some(it => it.entityId === 'Not Found');

      if (hasNotFound) {
        // If any entity was not found, defer saving infotopes and set up for retry.
        const creationCommands = output.orchestrators.filter(cmd => cmd.toLowerCase().startsWith('create'));
        const otherCommands = output.orchestrators.filter(cmd => !cmd.toLowerCase().startsWith('create'));
        
        return {
            infotopes: [], // Do not save any infotopes yet.
            orchestrators: [
                ...creationCommands, // Prioritize creation commands.
                ...otherCommands,
                `Retry infoshard: ${input.text}` // Add retry command with original text.
            ]
        };

      } else {
         // All entities were found, proceed as normal.
        return {
            infotopes: output.infotopes || [],
            orchestrators: output.orchestrators || [],
        };
      }
      
    } catch (err: any) {
      console.error('[infoshardTextFlow] Error:', err);
      throw new Error(err.message || 'Could not process text.');
    }
  }
);

// ---- API ----
export async function infoshardText(
  input: InfoshardTextInput
): Promise<InfoshardTextOutput> {
  return infoshardTextFlow(input);
}
