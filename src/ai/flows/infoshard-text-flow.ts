
'use server';
/**
 * @fileOverview Processes unstructured text to extract structured CRM data.
 *
 * This flow takes a piece of text and a list of existing CRM entities
 * (contacts, companies, deals) and uses an LLM to identify potential
 * new entities or updates to existing ones.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';
import { initializeFirebaseServer } from '@/firebase/server-init';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { Action } from './orchestrator-schemas';
import { ActionSchema } from './orchestrator-schemas';


// Re-define ActionSchema locally if it's complex, or import if simple
const OrchestrateTextOutputSchema = z.object({
  actions: z.array(ActionSchema).describe("List of actions to perform, like create_entity or update_entity"),
});

export type OrchestrateTextOutput = z.infer<typeof OrchestrateTextOutputSchema>;


const OrchestrateTextInputSchema = z.object({
    text: z.string().describe('The unstructured text to analyze (e.g., a voice note transcription, an email body).'),
    contacts: z.array(z.object({ id: z.string(), name: z.string() })).describe('An array of existing contact objects for context.'),
    companies: z.array(z.object({ id: z.string(), name: z.string() })).describe('An array of existing company objects for context.'),
    deals: z.array(z.object({ id: z.string(), name: z.string() })).describe('An array of existing deal objects for context.'),
});
export type OrchestrateTextInput = z.infer<typeof OrchestrateTextInputSchema>;



const orchestrateTextPrompt = ai.definePrompt({
  name: 'orchestrateTextPrompt',
  model: googleAI.model('gemini-2.0-flash-lite'),
  input: { schema: OrchestrateTextInputSchema },
  output: { schema: OrchestrateTextOutputSchema },
  prompt: `You are an expert CRM data analyst. Your task is to analyze the provided text and determine if it contains information that could create or update CRM records. Compare the information in the text against the existing CRM data (contacts, companies, deals) to avoid duplicates.

Based on your analysis, generate a list of actions.

**Rules:**
- **Analyze Text:** Carefully read the user's text.
- **Extract Entities:** Identify names, companies, deal amounts, deadlines, and other key information.
- **Check for Duplicates:** Before suggesting a 'create_entity' action, check if a similar entity already exists in the provided context arrays.
- **Generate Actions:**
  - For new contacts, companies, or deals, use the 'create_entity' action. The 'data' field should contain the new record.
  - For updates to existing entities, use the 'update_entity' action. The 'id' field must be the ID of the record to update, and the 'changes' field should contain only the modified fields.
  - For actionable items, use the 'create_task' action.
- **Confidence Score:** Provide a confidence score (0-1) for each extracted piece of information.
- **Reasoning:** Briefly explain why you are suggesting each action in the 'reason' field.

**Input Text:**
---
{{text}}
---

**Existing CRM Data Context:**
- Contacts: {{contacts}}
- Companies: {{companies}}
- Deals: {{deals}}

**Output Format:**
Return a JSON object with a single key "actions". Each action in the array should be an object with 'type', 'target', 'data' or 'changes', 'reason', and 'confidence'.
`,
});

const orchestrateTextFlow = ai.defineFlow(
  {
    name: 'orchestrateTextFlow',
    inputSchema: OrchestrateTextInputSchema,
    outputSchema: OrchestrateTextOutputSchema,
  },
  async (input) => {
    
    const llmResponse = await orchestrateTextPrompt(input);
    const output = llmResponse.output;

    if (!output || !Array.isArray(output.actions)) {
        console.warn('AI did not return a valid action array.');
        return { actions: [] };
    }

    // You could add post-processing logic here.
    // For example, filtering out low-confidence actions before returning.

    return { actions: output.actions as Action[] };
  }
);


export async function orchestrateText(
  input: OrchestrateTextInput
): Promise<OrchestrateTextOutput> {
  return orchestrateTextFlow(input);
}
