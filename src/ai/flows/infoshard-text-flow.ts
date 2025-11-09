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

const OrchestratorSchema = z.object({
    command: z.string().describe("The action to be taken, e.g., 'createContact', 'createDeal', 'createTask', 'updateDeal'."),
    entityType: z.string().optional().describe("The type of entity, e.g., 'Contact', 'Deal', 'Task'."),
    entityName: z.string().optional().describe("The name of the entity to be created or updated."),
    details: z.record(z.any()).optional().describe("A structured object of data for the command, e.g., { email: 'jane@acme.com', amount: 50000 }."),
    sourceText: z.string().optional().describe("The original text snippet that led to this command.")
});

const InfoshardTextOutputSchema = z.object({
  infotopes: z
    .array(InfotopeSchema)
    .describe('A list of atomic facts, each linked to a specific entity.'),
  orchestrators: z
    .array(OrchestratorSchema)
    .describe(
      'A list of structured command objects for the AI orchestrator based on the text.'
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
Your task is to deconstruct unstructured text into "infotopes" (atomic, self-contained facts) and "orchestrators" (structured, actionable command objects for the system) and link them to specific CRM entities.

**Instructions:**

1.  **Analyze the Text:** Read the user's unstructured text. Identify individual facts, opinions, questions, and actions.
2.  **Extract Atomic Facts (Infotopes):**
    *   Break down the text into the smallest possible, self-contained pieces of information. Each piece is an infotope.
    *   For each infotope, determine which entity it belongs to (e.g., a fact about a person belongs to a Contact, a fact about a budget belongs to a Deal).
    *   A single sentence might contain multiple infotopes.
    *   Example: "He is interested in the Pro plan and his budget is $50k" becomes two infotopes: 1) "is interested in the Pro plan" (linked to the contact) and 2) "budget is $50k" (linked to the deal).
3.  **Identify Actionable Commands (Orchestrators):**
    *   Extract any instruction, next step, or task from the text.
    *   Format it as a structured command object.
    *   The 'command' should be a camelCase verb like 'createContact', 'createDeal', 'createTask', 'updateDeal'.
    *   The 'details' should be an object containing all extracted data (e.g., email, phone, amount, stage).
    *   'sourceText' should contain the original snippet that justifies the command.
    *   Example: "Please review the document" becomes { command: "createTask", details: { description: "Review the document" } }.
    *   Example: "Let's create a deal for Julian for $25k" becomes { command: "createDeal", entityName: "Julian's Deal", details: { contactName: "Julian", amount: 25000 } }.
4.  **Link to CRM Entities:**
    *   For each infotope, match the entity mentioned (e.g., "Javier Gomez", "Tech Solutions") with an entity from the provided CRM Context Data.
    *   If a match is found, use the entity's name and its ID.
    *   **If you cannot find a match, use the name from the text and "Not Found" as the ID.**
    *   **If an entity is "Not Found"**: You MUST create an orchestrator command to create it. Example: { command: "createContact", entityName: "Julian Lopez", details: { email: "julian.l@example.com" } }.
5.  **Return JSON:** Format your entire output as a single JSON object that strictly matches the output schema. Do not add any commentary.

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
      return { infotopes: [], orchestrators: [{ command: 'error', details: { message: 'Input text is too short.' } }] };
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
        const creationCommands = output.orchestrators.filter(cmd => cmd.command.toLowerCase().startsWith('create'));
        const otherCommands = output.orchestrators.filter(cmd => !cmd.command.toLowerCase().startsWith('create'));
        
        return {
            infotopes: [], // Do not save any infotopes yet.
            orchestrators: [
                ...creationCommands, // Prioritize creation commands.
                ...otherCommands,
                { command: 'retryInfoshard', details: { originalText: input.text }, sourceText: 'An entity was not found, scheduling a retry.' }
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
