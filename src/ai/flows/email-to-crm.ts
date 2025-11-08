'use server';

/**
 * @fileOverview An AI agent that extracts information from emails and transforms interactions into structured CRM data.
 *
 * - emailToCRM - A function that handles the email processing and CRM updating.
 * - EmailToCRMInput - The input type for the emailToCRM function.
 * - EmailToCRMOutput - The return type for the emailToCRM function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EmailToCRMInputSchema = z.object({
  emailContent: z
    .string()
    .describe('The content of the email to be processed.'),
});
export type EmailToCRMInput = z.infer<typeof EmailToCRMInputSchema>;

const EmailToCRMOutputSchema = z.object({
  contacts: z
    .array(z.object({
      name: z.string().describe('The name of the contact.'),
      email: z.string().email().describe('The email address of the contact.'),
      phone: z.string().optional().describe('The phone number of the contact.'),
    }))
    .describe('A list of contacts extracted from the email.'),
  actionItems: z
    .array(z.string())
    .describe('A list of action items extracted from the email.'),
  summary: z.string().describe('A summary of the email content.'),
});
export type EmailToCRMOutput = z.infer<typeof EmailToCRMOutputSchema>;

export async function emailToCRM(input: EmailToCRMInput): Promise<EmailToCRMOutput> {
  return emailToCRMFlow(input);
}

const prompt = ai.definePrompt({
  name: 'emailToCRMPrompt',
  input: {schema: EmailToCRMInputSchema},
  output: {schema: EmailToCRMOutputSchema},
  prompt: `You are a CRM assistant that extracts information from emails.

  Given the content of an email, extract the following information:
  - Contacts: Extract the names, email addresses, and phone numbers of all contacts mentioned in the email. If the email contains a signature, prioritize the information in the signature.
  - Action Items: Extract a list of action items mentioned in the email. Action items are tasks that need to be done as a result of the email.
  - Summary: Write a brief summary of the email content.
  
  Email Content: {{{emailContent}}}
  
  Contacts:
  {{#each contacts}}
  - Name: {{{this.name}}}
    Email: {{{this.email}}}
    {{#if this.phone}}Phone: {{{this.phone}}}{{/if}}
  {{/each}}
  Action Items:
  {{#each actionItems}}
  - {{{this}}}
  {{/each}}
  Summary: {{{summary}}}`,
});

const emailToCRMFlow = ai.defineFlow(
  {
    name: 'emailToCRMFlow',
    inputSchema: EmailToCRMInputSchema,
    outputSchema: EmailToCRMOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
