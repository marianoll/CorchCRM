'use server';
/**
 * @fileOverview A Genkit flow to process unstructured text into structured "orchestrator" commands,
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

const OrchestratorSchema = z.object({
    command: z.string().describe("The action to be taken, e.g., 'createContact', 'createDeal', 'createTask', 'updateDeal', 'scheduleMeeting', 'sendFollowUpEmail'."),
    entityType: z.string().optional().describe("The type of entity, e.g., 'Contact', 'Deal', 'Task'."),
    entityName: z.string().optional().describe("The name of the entity to be created or updated."),
    details: z.string().optional().describe("A JSON string representing a structured object of data for the command, e.g., '{\"email\": \"jane@acme.com\", \"amount\": 50000}'. Must contain all relevant extracted data like emails, titles, company names, etc."),
    sourceText: z.string().optional().describe("The original text snippet that led to this command.")
});

const InfoshardTextOutputSchema = z.object({
  orchestrators: z
    .array(OrchestratorSchema)
    .describe(
      'A list of structured, actionable command objects for the AI orchestrator based on the text. These are tasks for the system to execute.'
    ),
});
export type InfoshardTextOutput = z.infer<typeof InfoshardTextOutputSchema>;


// ---- Prompt ----
const infoshardTextPrompt = ai.definePrompt({
  name: 'infoshardTextPrompt',
  model: googleAI.model('gemini-2.0-flash-lite-001'),
  input: { schema: InfoshardTextInputSchema },
  output: { schema: InfoshardTextOutputSchema },
  prompt: `You are an expert text analysis AI for a CRM. Your only task is to deconstruct unstructured text into a series of "orchestrators" (structured, actionable command objects for the system). You MUST be proactive and suggest any possible action.

**Instructions:**

1.  **Analyze the Text:** Read the user's unstructured text and identify ANY potential instruction, next step, task, or entity creation.
2.  **Extract Actionable Commands (Orchestrators):**
    *   Format every identified action as a structured command object.
    *   The 'command' should be a camelCase verb like 'createContact', 'createDeal', 'createTask', 'updateDeal', 'scheduleMeeting', 'sendFollowUpEmail'. BE CREATIVE and suggest actions even if the system might not support them yet.
    *   The 'details' field MUST be a JSON STRING containing all extracted data. Differentiate between a person's full name and their email. If a contact works for a company, include the company's name in the contact's details.
    *   Example: "Let's create a deal for Julian at InovaCorp for $25k" becomes { command: "createDeal", entityName: "Deal for Julian", details: "{\\"contactName\\": \\"Julian\\", \\"companyName\\": \\"InovaCorp\\", \\"amount\\": 25000}" }.
    *   Example: "Create a contact for julian.l@example.com, his name is Julian Lopez who works at InovaCorp" becomes { command: "createContact", entityName: "Julian Lopez", details: "{\\"fullName\\": \\"Julian Lopez\\", \\"email\\": \\"julian.l@example.com\\", \\"companyName\\": \\"InovaCorp\\"}" }.
    *   'sourceText' should contain the original snippet that justifies the command.
3.  **Handle Dependencies:**
    *   Use the provided CRM Context Data to check if entities already exist.
    *   **CRITICAL DEPENDENCY LOGIC**: If a contact (e.g. "Julian Lopez") is associated with a company (e.g. "InovaCorp") and "InovaCorp" is also NOT FOUND in the context, you MUST generate the 'createCompany' command BEFORE the 'createContact' command in the 'orchestrators' array. The system processes commands in order. Always create companies first, then contacts, then deals.

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
      return { orchestrators: [{ command: 'error', details: 'Input text is too short.' }] };
    }

    try {
      const res = await infoshardTextPrompt(input);
      let output = res.output;

      if (!output) {
        throw new Error('No output from AI model.');
      }
      
      const hasCreationCommands = output.orchestrators.some(cmd => cmd.command.toLowerCase().startsWith('create'));

      if (hasCreationCommands) {
        const creationPriority = {
            'createCompany': 1,
            'createContact': 2,
            'createDeal': 3
        };

        const creationCommands = output.orchestrators
            .filter(cmd => cmd.command.toLowerCase().startsWith('create'))
            .sort((a, b) => {
                const priorityA = creationPriority[a.command as keyof typeof creationPriority] || 99;
                const priorityB = creationPriority[b.command as keyof typeof creationPriority] || 99;
                return priorityA - priorityB;
            });

        const otherCommands = output.orchestrators.filter(cmd => !cmd.command.toLowerCase().startsWith('create'));
        
        // Check if a retry is needed because an entity might be created
        // which would change the context for subsequent analysis.
        const shouldRetry = creationCommands.length > 0;

        return {
            orchestrators: [
                ...creationCommands,
                ...otherCommands,
                ...(shouldRetry ? [{ command: 'retryInfoshard', details: `{ "originalText": "${input.text.replace(/"/g, '\\"')}" }`, sourceText: 'An entity will be created, scheduling a retry to process again with new context.' }] : [])
            ]
        };

      } else {
        return {
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
