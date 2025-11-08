'use server';

/**
 * @fileOverview The Crystallizer AI agent.
 * This flow takes unstructured text and metadata and transforms it into atomized, structured facts called "crystals".
 *
 * - crystallizeText - A function that handles the crystallization process.
 * - CrystallizeTextInput - The input type for the crystallizeText function.
 * - CrystallizeTextOutput - The return type for the crystallizeText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CrystalSchema = z.object({
  fact: z.string().describe('The single, atomized statement of fact. This should be a concise and clear statement. For example: "A 20% discount was offered on Product XYZ." or "Customer is not happy with the current price."'),
});

export const CrystallizeTextInputSchema = z.object({
  text: z.string().describe('The unstructured text to be crystallized (e.g., email body, voice note transcription).'),
  source: z.string().describe("The type of source, e.g., 'email', 'voice note'."),
  sourceIdentifier: z.string().describe('A reference to the source, e.g., email subject or meeting title.'),
});
export type CrystallizeTextInput = z.infer<typeof CrystallizeTextInputSchema>;

export const CrystallizeTextOutputSchema = z.object({
  crystals: z.array(CrystalSchema).describe('A list of atomized facts (crystals) extracted from the text.'),
});
export type CrystallizeTextOutput = z.infer<typeof CrystallizeTextOutputSchema>;


export async function crystallizeText(input: CrystallizeTextInput): Promise<CrystallizeTextOutput> {
  return crystallizeTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'crystallizeTextPrompt',
  input: { schema: CrystallizeTextInputSchema },
  output: { schema: CrystallizeTextOutputSchema },
  prompt: `You are an expert AI assistant called The Crystallizer. Your task is to extract key, atomized facts from an unstructured source of information and convert them into "crystals".

  A crystal is a single, undeniable statement of fact. It should be short, clear, and focused on one piece of information.
  Focus on facts related to deals, contacts, and companies. Extract commitments, objections, key numbers, decisions, and important sentiments.

  Examples of good crystals:
  - "We offered them a 20% discount over product [SKU]."
  - "Customer does not agree with the current price."
  - "Between date A and date B, we can offer the deal at X price."
  - "User does not like the service quality."
  - "A follow-up meeting is scheduled for next Tuesday."
  - "Javier Gomez's phone number is +1-345-678-901."

  Do not create crystals for conversational filler, greetings, or information that is not a core fact.

  Source: {{{source}}} - {{{sourceIdentifier}}}
  Text to be crystallized:
  '''
  {{{text}}}
  '''

  Generate a list of crystals based on the text.
  `,
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
