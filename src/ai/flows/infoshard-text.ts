'use server';
/**
 * @fileOverview An AI agent that processes raw text into a structured "Infoshard".
 *
 * - infoshardText - The primary function to process text.
 * - InfoshardTextInput - The input type for the function.
 * - InfoshardTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const InfoshardTextInputSchema = z.object({
  text: z.string().describe('The raw text to be processed into an infoshard.'),
});
export type InfoshardTextInput = z.infer<typeof InfoshardTextInputSchema>;

const InfoshardTextOutputSchema = z.object({
  shard: z.string().describe('A concise, structured, and atomic piece of information derived from the original text.'),
});
export type InfoshardTextOutput = z.infer<typeof InfoshardTextOutputSchema>;


/**
 * The main exported function that clients call. It wraps the Genkit flow.
 * @param input - The text to be processed.
 * @returns A promise that resolves to the structured infoshard.
 */
export async function infoshardText(input: InfoshardTextInput): Promise<InfoshardTextOutput> {
  return infoshardTextFlow(input);
}


const infoshardTextPrompt = ai.definePrompt({
  name: 'infoshardTextPrompt',
  input: { schema: InfoshardTextInputSchema },
  output: { schema: InfoshardTextOutputSchema },
  system: `You are an expert AI assistant. Your task is to extract a single, dense, and verifiable piece of information from the provided text and format it as a concise "infoshard".

An "infoshard" is an atomic fact. It should be self-contained and clearly state one piece of information.

Example:
Input Text: "Just spoke with Jane from Acme. She needs a proposal for the Q3 project by Friday. Budget is roughly $25k."
Output Shard: "Acme needs a proposal for the Q3 project by Friday, with an approximate budget of $25k."

Now, process the user's text.`,
  user: `Text to be processed:\n'''\n{{{text}}}\n'''`,
});

const infoshardTextFlow = ai.defineFlow(
  {
    name: 'infoshardTextFlow',
    inputSchema: InfoshardTextInputSchema,
    outputSchema: InfoshardTextOutputSchema,
  },
  async (input) => {
    if (!input || !input.text || input.text.trim() === '') {
        console.log("Infoshard flow received empty or invalid input. Aborting.", { input });
        return { shard: '' };
    }

    const result = await infoshardTextPrompt(input);
    
    return result || { shard: '' };
  }
);
