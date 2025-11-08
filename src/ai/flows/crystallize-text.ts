
'use server';

/**
 * @fileOverview The Crystallizer AI agent.
 * This flow takes unstructured text and transforms it into structured "Facts" (to be saved as Infotopes) and "Orchestrator" commands.
 *
 * - crystallizeText - A function that handles the crystallization process.
 * - CrystallizeTextInput - The input type for the crystallizeText function.
 * - CrystallizeTextOutput - The return type for the crystallizeText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CrystallizationResultSchema = z.object({
  type: z.enum(['Fact', 'Orchestrator']).describe('The type of output. "Fact" is an atomic piece of information. "Orchestrator" is a command to the system.'),
  text: z.string().describe('The fact text or the orchestrator command.'),
  entity: z.string().describe('The entity this fact or command relates to, e.g., "John Doe [john@example.com]" or "Acme Corp".'),
});


const CrystallizeTextInputSchema = z.object({
  text: z.string().describe('The unstructured text to be crystallized (e.g., email body, voice note transcription).'),
  source: z.string().describe("The type of source, e.g., 'email', 'voice note'."),
  sourceIdentifier: z.string().describe('A reference to the source, e.g., email subject or meeting title.'),
});
export type CrystallizeTextInput = z.infer<typeof CrystallizeTextInputSchema>;

const CrystallizeTextOutputSchema = z.array(CrystallizationResultSchema);
export type CrystallizeTextOutput = z.infer<typeof CrystallizeTextOutputSchema>;


export async function crystallizeText(input: CrystallizeTextInput): Promise<CrystallizeTextOutput> {
  return crystallizeTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'crystallizeTextPrompt',
  input: { schema: CrystallizeTextInputSchema },
  output: { schema: CrystallizeTextOutputSchema },
  system: `You are an expert AI assistant. Your task is to extract key information from unstructured text and convert it into a structured JSON array of "Facts" and "Orchestrator" commands.

- A "Fact" is a single, atomized statement of fact about a Company, Contact, or Deal.
- An "Orchestrator" is a command to the system to perform an action, like creating a deal or sending a notification.

For each item, identify the related entity.

Examples of good output:
[
  { "type": "Fact", "text": "He does not want to continue the service.", "entity": "John [John@mail.com]" },
  { "type": "Fact", "text": "A 20% discount was offered.", "entity": "Deal: WeGOTBrands" },
  { "type": "Orchestrator", "text": "create deal 'WeGOTBrands' for company 'Branders'", "entity": "Branders" }
]

Do not create items for conversational filler, greetings, or information that is not a core fact or command.
Generate a JSON array of "Fact" and "Orchestrator" objects based on the text.`,
  user: `Source: {{{source}}} - {{{sourceIdentifier}}}\nText to be crystallized:\n\'\'\'\n{{{text}}}\n\'\'\'`,
});

const crystallizeTextFlow = ai.defineFlow(
  {
    name: 'crystallizeTextFlow',
    inputSchema: CrystallizeTextInputSchema,
    outputSchema: CrystallizeTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
