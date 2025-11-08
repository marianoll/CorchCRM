
'use server';

/**
 * @fileOverview The Crystallizer AI agent.
 * This flow takes unstructured text and transforms it into structured "Infotopes" (facts) and "Orchestrators" (commands).
 *
 * - crystallizeText - A function that handles the crystallization process.
 * - CrystallizeTextInput - The input type for the crystallizeText function.
 * - CrystallizeTextOutput - The return type for the crystallizeText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input schema for the flow
const CrystallizeTextInputSchema = z.object({
  content: z.string().describe('The unstructured text content to be crystallized.'),
});
export type CrystallizeTextInput = z.infer<typeof CrystallizeTextInputSchema>;

// Schema for a single extracted item
const CrystallizationResultSchema = z.object({
  type: z.enum(['Infotope', 'Orchestrator']).describe('The type of output. "Infotope" is an atomic piece of information. "Orchestrator" is a command to the system.'),
  text: z.string().describe('The fact text or the orchestrator command.'),
  entity: z.string().describe('The entity this fact or command relates to, e.g., "John Doe [john@example.com]" or "Acme Corp".'),
});

// Output schema for the flow, separating Infotopes and Orchestrators
const CrystallizeTextOutputSchema = z.object({
  infotopes: z.array(CrystallizationResultSchema.extend({type: z.literal('Infotope')})).describe("An array of atomic facts extracted from the text."),
  orchestrators: z.array(CrystallizationResultSchema.extend({type: z.literal('Orchestrator')})).describe("An array of system commands extracted from the text."),
});
export type CrystallizeTextOutput = z.infer<typeof CrystallizeTextOutputSchema>;


/**
 * The main exported function that clients call. It wraps the Genkit flow.
 */
export async function crystallizeText(input: CrystallizeTextInput): Promise<CrystallizeTextOutput> {
  return crystallizeTextFlow(input);
}


const prompt = ai.definePrompt({
  name: 'crystallizeTextPrompt',
  input: { schema: CrystallizeTextInputSchema },
  output: { schema: CrystallizeTextOutputSchema },
  system: `You are an expert AI assistant. Your task is to extract key information from unstructured text and convert it into a structured JSON object containing two arrays: "infotopes" and "orchestrators".

- An "Infotope" is a single, atomized statement of fact about a Company, Contact, or Deal. It represents a piece of knowledge.
- An "Orchestrator" is a command to the system to perform an action, like creating a deal, sending an email, or scheduling a task.

For each item, identify and name the related entity. Classify each item correctly as either 'Infotope' or 'Orchestrator' and place it in the corresponding array.

Example:
Input Text: "Just spoke with Jane from Acme. She needs a proposal for the Q3 project by Friday. I'll also create a new deal for this called 'Q3 Proposal'."
{
  "infotopes": [
    { "type": "Infotope", "text": "Needs a proposal for the Q3 project by Friday.", "entity": "Jane @ Acme" }
  ],
  "orchestrators": [
    { "type": "Orchestrator", "text": "create deal 'Q3 Proposal'", "entity": "Acme" },
    { "type": "Orchestrator", "text": "create task 'Send proposal for Q3 project'", "entity": "Jane @ Acme" }
  ]
}

Do not create items for conversational filler, greetings, or information that is not a core fact or command.
Generate the JSON object based on the user's text.`,
  user: `Text to be crystallized:\n'''\n{{{content}}}\n'''`,
});

const crystallizeTextFlow = ai.defineFlow(
  {
    name: 'crystallizeTextFlow',
    inputSchema: CrystallizeTextInputSchema,
    outputSchema: CrystallizeTextOutputSchema,
  },
  async (input) => {
    // Input validation to prevent crashes.
    if (!input || !input.content || typeof input.content !== 'string' || input.content.trim() === '') {
        console.log("Crystallize flow received empty or invalid input. Aborting.", { input });
        return { infotopes: [], orchestrators: [] };
    }

    const result = await prompt(input);
    
    // Ensure we always return an object with the correct shape.
    return result || { infotopes: [], orchestrators: [] };
  }
);
