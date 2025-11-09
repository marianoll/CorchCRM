
'use server';
/**
 * CorchCRM Orchestrator — Genkit Flow (FIXED)
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/* ----------------------------- Tipos de Acciones ----------------------------- */

const ActionType = z.enum([
  'update_entity',
  'create_entity',
  'create_task',
  'create_ai_draft',
  'create_meeting',
  'notify_user',
  'log_action',
  'suggest'
]);

const TargetType = z.enum([
  'companies', 'contacts', 'deals', 'emails',
  'tasks', 'ai_drafts', 'meetings', 'notifications', 'history'
]);

const ActionSchema = z.object({
  type: ActionType,
  target: TargetType,
  id: z.string().optional(),
  data: z.record(z.any()).optional(),
  changes: z.record(z.any()).optional(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type Action = z.infer<typeof ActionSchema>;

/* ------------------------------- Esquemas I/O ------------------------------- */

const InteractionSchema = z.object({
  source: z.enum(['email','voice','meeting','note']),
  subject: z.string().optional(),
  body: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  timestamp: z.string().optional() // ISO
});
export type Interaction = z.infer<typeof InteractionSchema>;

const RelatedEntitiesSchema = z.object({
  company: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    domain: z.string().optional(),
    stage: z.string().optional()
  }).optional(),
  contact: z.object({
    id: z.string().optional(),
    full_name: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional()
  }).optional(),
  deal: z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    stage: z.string().optional(),
    probability: z.number().optional(),
    owner_email: z.string().optional(),
    close_date: z.string().optional()
  }).optional()
});

const OrchestratorInputSchema = z.object({
  interaction: InteractionSchema,
  related_entities: RelatedEntitiesSchema.optional(),
  policy: z.object({
    auto_apply_threshold: z.number().min(0).max(1).optional(),
    always_review_fields: z.array(z.string()).optional(),
    // Nota: en Zod basta con valueType si la clave es string
    followup_days_by_stage: z.record(z.number()).optional(), // {"proposal":3, ...}
    business_hours: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      days: z.array(z.number()).optional()
    }).optional()
  }).optional()
});

export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

const OrchestratorOutputSchema = z.object({
  actions: z.array(ActionSchema).default([])
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

/* ---------------------------------- Prompt ---------------------------------- */

// FIX 1: modelo vigente
const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-2.0-flash-lite'),
  input: { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  // Pasa objetos; Genkit serializa. Evita {{{json ...}}}
  prompt: `
You are CorchCRM's Orchestrator AI.
Output ONLY a JSON object with an "actions" array. No text outside JSON.

Entities: companies, contacts, deals, emails, tasks, meetings, notifications, ai_drafts, history.
Action types: update_entity, create_entity, create_task, create_ai_draft, create_meeting, notify_user, log_action, suggest.

Rules:
- Prefer small, atomic actions.
- Include "confidence" (0..1) for decisions.
- If unsure, use type "suggest".
- Log all entity changes with a "log_action".
- Respect user policy (auto_apply_threshold, always_review_fields, followup_days_by_stage, business_hours).
- Times in ISO UTC. If updating deals.stage, consider probability.

Interaction:
{{interaction}}

Related entities:
{{related_entities}}

Policy:
{{policy}}

Return JSON matching the output schema strictly.
`
});

/* ----------------------------------- Flow ----------------------------------- */

const orchestrateInteractionFlow = ai.defineFlow(
  {
    name: 'orchestrateInteractionFlow',
    inputSchema: OrchestratorInputSchema,
    outputSchema: OrchestratorOutputSchema
  },
  async (input): Promise<OrchestratorOutput> => {
    if (!input?.interaction?.source) {
      return {
        actions: [{
          type: 'log_action',
          target: 'history',
          data: { action: 'error', explanation: 'Missing interaction.source' },
          reason: 'Invalid input',
          confidence: 0
        }]
      };
    }

    try {
      const res = await orchestratePrompt(input);
      const out = res.output;

      // FIX 3: Normalización defensiva
      const actions = Array.isArray(out?.actions) ? out.actions : [];
      return { actions };
    } catch (err: any) {
      console.error('[orchestrateInteractionFlow] Error:', err);
      return {
        actions: [{
          type: 'log_action',
          target: 'history',
          data: { 
            action: 'error', 
            explanation: 'Model call failed',
            details: err.message || JSON.stringify(err)
          },
          reason: 'Model error',
          confidence: 0
        }]
      };
    }
  }
);

/* ---------------------------------- Helper ---------------------------------- */

export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
