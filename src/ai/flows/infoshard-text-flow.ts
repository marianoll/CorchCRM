'use server';
/**
 * @fileOverview A Genkit flow to process unstructured text into structured "orchestrator" commands.
 * This flow now acts as an adapter to the more powerful `orchestrateInteraction` flow.
 *
 * - orchestrateText - A function that calls the Genkit flow.
 * - OrchestrateTextInput - The input type for the flow.
 * - OrchestrateTextOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { orchestrateInteraction, OrchestratorOutputSchema } from './orchestrator-flow';

// ---- Schemas ----

const CrmEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const OrchestrateTextInputSchema = z.object({
  text: z.string().describe('The unstructured text to be processed.'),
  contacts: z.array(CrmEntitySchema).describe('List of existing contacts for entity resolution.'),
  companies: z.array(CrmEntitySchema).describe('List of existing companies for entity resolution.'),
  deals: z.array(CrmEntitySchema).describe('List of existing deals for entity resolution.'),
});
export type OrchestrateTextInput = z.infer<typeof OrchestrateTextInputSchema>;
export type OrchestrateTextOutput = z.infer<typeof OrchestratorOutputSchema>;


// ---- Flow ----
const orchestrateTextFlow = ai.defineFlow(
  {
    name: 'orchestrateTextFlow',
    inputSchema: OrchestrateTextInputSchema,
    outputSchema: OrchestratorOutputSchema,
  },
  async (input) => {
    if (!input.text || input.text.trim().length < 10) {
      return { actions: [] };
    }

    try {
        // Adapt the simple text input to the rich Interaction schema
        const interaction = {
            source: 'note' as const,
            body: input.text,
            timestamp: new Date().toISOString()
        };

        // Find best-guess related entities
        const related_entities = {
            // Basic logic: find entities mentioned in the text. A more robust solution would use embeddings.
            company: input.companies.find(c => input.text.includes(c.name)),
            contact: input.contacts.find(c => input.text.includes(c.name)),
            deal: input.deals.find(d => input.text.includes(d.name)),
        };

        // Call the main orchestrator flow
        const result = await orchestrateInteraction({
            interaction,
            related_entities
        });
        
        return result;

    } catch (err: any) {
      console.error('[orchestrateTextFlow] Error:', err);
      throw new Error(err.message || 'Could not process text.');
    }
  }
);

// ---- API ----
export async function orchestrateText(
  input: OrchestrateTextInput
): Promise<OrchestrateTextOutput> {
  return orchestrateTextFlow(input);
}
