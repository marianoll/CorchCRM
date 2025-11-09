'use server';
/**
 * @fileOverview The AI Orchestrator flow.
 * This flow receives natural language instructions, interprets them, and uses
 * a set of tools to perform actions on the CRM database, such as creating
 * entities (Companies, Contacts, Deals).
 *
 * - orchestrate - The main function to call the orchestrator flow.
 * - OrchestratorInput - The input type for the flow.
 * - OrchestratorOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, doc, collection, writeBatch, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

export const OrchestratorInputSchema = z.object({
  instruction: z.string().describe('The natural language instruction for the orchestrator to execute.'),
  userId: z.string().describe('The ID of the user performing the action.'),
});
export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

export const OrchestratorOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().describe('A summary of the action taken or an error message.'),
  createdEntityId: z.string().optional().describe('The ID of the entity that was created.'),
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;


// ---- Tools ----

/**
 * Gets the Firestore database instance.
 * This is a helper function to be used inside tools.
 */
function getDb() {
    const { firestore } = initializeFirebase();
    if (!firestore) {
        throw new Error("Firestore is not initialized.");
    }
    return firestore;
}

const createCompanyTool = ai.defineTool(
  {
    name: 'createCompany',
    description: 'Creates a new company record in the CRM.',
    inputSchema: z.object({
      name: z.string().describe('The name of the company.'),
      userId: z.string().describe('The ID of the user who owns this company.'),
      domain: z.string().optional().describe('The company\'s website domain.'),
      industry: z.string().optional().describe('The industry the company belongs to.'),
    }),
    outputSchema: OrchestratorOutputSchema,
  },
  async (input) => {
    const db = getDb();
    const batch = writeBatch(db);

    const companyRef = doc(collection(db, 'users', input.userId, 'companies'));
    const companyData = {
      id: companyRef.id,
      name: input.name,
      domain: input.domain,
      industry: input.industry,
    };
    batch.set(companyRef, companyData);

    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, {
        ts: new Date().toISOString(),
        actor_type: 'system_ai',
        actor_id: 'orchestrator',
        action: 'create',
        entity_type: 'company',
        entity_id: companyRef.id,
        table: 'companies',
        source: 'orchestrator',
        after_snapshot: companyData,
    });
    
    await batch.commit();
    return { success: true, message: `Company '${input.name}' created successfully.`, createdEntityId: companyRef.id };
  }
);


const createContactTool = ai.defineTool(
    {
        name: 'createContact',
        description: 'Creates a new contact record in the CRM.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user who owns this contact.'),
            firstName: z.string().describe("The contact's first name."),
            lastName: z.string().describe("The contact's last name."),
            email: z.string().email().describe("The contact's primary email address."),
            companyId: z.string().optional().describe('The ID of the company this contact is associated with.'),
            title: z.string().optional().describe("The contact's job title."),
        }),
        outputSchema: OrchestratorOutputSchema,
    },
    async (input) => {
        const db = getDb();
        const batch = writeBatch(db);

        const contactRef = doc(collection(db, 'users', input.userId, 'contacts'));
        const contactData = {
            id: contactRef.id,
            first_name: input.firstName,
            last_name: input.lastName,
            full_name: `${input.firstName} ${input.lastName}`,
            email_primary: input.email,
            company_id: input.companyId,
            title: input.title,
        };
        batch.set(contactRef, contactData);
        
        const logRef = doc(collection(db, 'audit_logs'));
        batch.set(logRef, {
            ts: new Date().toISOString(),
            actor_type: 'system_ai',
            actor_id: 'orchestrator',
            action: 'create',
            entity_type: 'contact',
            entity_id: contactRef.id,
            table: 'contacts',
            source: 'orchestrator',
            after_snapshot: contactData,
        });

        await batch.commit();
        return { success: true, message: `Contact '${contactData.full_name}' created.`, createdEntityId: contactRef.id };
    }
)

const createDealTool = ai.defineTool(
    {
        name: 'createDeal',
        description: 'Creates a new deal or opportunity in the CRM.',
        inputSchema: z.object({
            userId: z.string().describe('The ID of the user who owns this deal.'),
            title: z.string().describe('The title or name of the deal.'),
            primaryContactId: z.string().describe('The ID of the primary contact for this deal.'),
            companyId: z.string().optional().describe('The ID of the company associated with this deal.'),
            amount: z.number().optional().describe('The potential value of the deal.'),
            stage: z.enum(['prospect', 'discovery', 'proposal', 'negotiation', 'won', 'lost']).default('prospect').describe('The current stage of the deal.'),
        }),
        outputSchema: OrchestratorOutputSchema,
    },
    async (input) => {
        const db = getDb();
        const batch = writeBatch(db);

        const dealRef = doc(collection(db, 'users', input.userId, 'deals'));
        const dealData = {
            id: dealRef.id,
            title: input.title,
            primary_contact_id: input.primaryContactId,
            company_id: input.companyId,
            amount: input.amount || 0,
            stage: input.stage,
            close_date: Timestamp.fromDate(new Date()), // Default to today
        };
        batch.set(dealRef, dealData);

        const logRef = doc(collection(db, 'audit_logs'));
        batch.set(logRef, {
            ts: new Date().toISOString(),
            actor_type: 'system_ai',
            actor_id: 'orchestrator',
            action: 'create',
            entity_type: 'deal',
            entity_id: dealRef.id,
            table: 'deals',
            source: 'orchestrator',
            after_snapshot: dealData,
        });

        await batch.commit();
        return { success: true, message: `Deal '${input.title}' created.`, createdEntityId: dealRef.id };
    }
)


// ---- Main Prompt & Flow ----

const orchestratorFlow = ai.defineFlow(
  {
    name: 'orchestratorFlow',
    inputSchema: OrchestratorInputSchema,
    outputSchema: OrchestratorOutputSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
      prompt: `You are a CRM orchestrator. Your job is to understand the user's instruction and use the available tools to perform the requested action.
        
        Instruction: "${input.instruction}"
        
        Current User ID: ${input.userId}
        
        Carefully analyze the instruction and call the appropriate tool with the correct parameters. The user ID must always be passed to the tool.`,
      model: googleAI.model('gemini-2.0-flash-lite-001'),
      tools: [createCompanyTool, createContactTool, createDealTool],
      output: {
          format: 'json',
          schema: OrchestratorOutputSchema
      }
    });

    const toolRequest = llmResponse.toolRequest();
    if (!toolRequest) {
        return { success: false, message: "I could not determine which action to take. Please be more specific." };
    }

    // Call the tool and return its output directly.
    const toolResponse = await toolRequest.invoke();
    
    // The tool's output schema matches the flow's output schema.
    return toolResponse.output as OrchestratorOutput;
  }
);


// ---- API ----

/**
 * Executes an instruction through the AI orchestrator.
 * @param input The natural language instruction and user context.
 * @returns A promise that resolves to the result of the operation.
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  try {
    return await orchestratorFlow(input);
  } catch (error: any) {
    console.error('[Orchestrator] Error executing flow:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred in the orchestrator flow.',
    };
  }
}
