'use server';
/**
 * @fileOverview A suite of simple "canary" flows for debugging the Genkit pipeline.
 * These flows are designed to be simple, predictable, and have minimal dependencies
 * to test different stages of the client-server data pipeline.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Test #5: "ping" flow to verify basic infrastructure.
export const pingFlow = ai.defineFlow(
  {
    name: 'pingFlow',
    inputSchema: z.void(),
    outputSchema: z.object({ ok: z.boolean() }),
  },
  async () => {
    return { ok: true };
  }
);

// Test #6: "echo input" flow to verify the entire payload is received.
export const echoInputFlow = ai.defineFlow(
  {
    name: 'echoInputFlow',
    inputSchema: z.any(),
    outputSchema: z.any(),
  },
  async (input) => {
    console.log('[Canary Test #6] Received input in echoInputFlow:', JSON.stringify(input, null, 2));
    console.log('[Canary Test #10] Typeof input:', typeof input);
    if (input) {
      console.log('[Canary Test #10] Keys of input:', Object.keys(input));
    }
    return input;
  }
);

// Test #7: "echo message" flow to verify specific key access.
const echoMessageInputSchema = z.object({ message: z.string() });
export const echoMessageFlow = ai.defineFlow(
  {
    name: 'echoMessageFlow',
    inputSchema: echoMessageInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    return input.message;
  }
);


// Test #8: "static result" flow to confirm output schemas work correctly.
const staticResultOutputSchema = z.object({
    infotopes: z.array(z.string()),
    orchestrators: z.array(z.string()),
});
export const staticResultFlow = ai.defineFlow(
    {
        name: 'staticResultFlow',
        inputSchema: z.void(),
        outputSchema: staticResultOutputSchema,
    },
    async () => {
        return {
            infotopes: [],
            orchestrators: [],
        };
    }
);
