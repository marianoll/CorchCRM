'use server';
/**
 * @fileOverview A simple debugging flow for Genkit.
 *
 * - debugEcho - A flow that echoes back the input message.
 * - DebugEchoInput - The input type for the flow.
 * - DebugEchoOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DebugEchoInputSchema = z.object({
  message: z.string().describe('The message to be echoed.'),
});
export type DebugEchoInput = z.infer<typeof DebugEchoInputSchema>;

const DebugEchoOutputSchema = z.object({
  receivedInput: z.any().describe('The exact input object received by the flow.'),
  inputType: z.string().describe('The Javascript type of the received input.'),
  inputKeys: z.array(z.string()).describe('The keys of the received input object.'),
  echo: z.string().describe('The echoed message.'),
});
export type DebugEchoOutput = z.infer<typeof DebugEchoOutputSchema>;

export const debugEcho = ai.defineFlow(
  {
    name: 'debugEcho',
    inputSchema: DebugEchoInputSchema,
    outputSchema: DebugEchoOutputSchema,
  },
  async (input) => {
    console.log('[Genkit Debug] Received input in debugEcho flow:', JSON.stringify(input, null, 2));
    
    if (!input) {
        const errorMsg = 'Flow received undefined or null input.';
        console.error(`[Genkit Debug] ${errorMsg}`);
        return {
            receivedInput: null,
            inputType: typeof input,
            inputKeys: [],
            echo: `ERROR: ${errorMsg}`
        };
    }

    const inputType = typeof input;
    const inputKeys = Object.keys(input);
    const echoMessage = input.message ? `ECHO: ${input.message}` : 'ERROR: Input object did not contain a "message" key.';
    
    const output = {
      receivedInput: input,
      inputType: inputType,
      inputKeys: inputKeys,
      echo: echoMessage,
    };
    
    console.log('[Genkit Debug] Returning output:', JSON.stringify(output, null, 2));
    
    return output;
  }
);
