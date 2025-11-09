'use server';
/**
 * CorchCRM Orchestrator — Genkit Flow
 * - Recibe una interacción (email/voz/reunión) + contexto básico (company/contact/deal)
 * - Devuelve "acciones" estructuradas para ejecutar en el backend (CRUD, tasks, drafts, meetings, logs, notifs)
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/* ----------------------------- Tipos de Acciones ----------------------------- */

const ActionType = z.enum([
  'update_entity',     // actualiza algún doc (deals/contacts/companies/emails)
  'create_entity',     // crea un doc
  'create_task',       // inserta en tasks
  'create_ai_draft',   // genera borrador (correo / texto)
  'create_meeting',    // crea o reagenda reunión
  'notify_user',       // notificación en app / email / Slack
  'log_action',        // registro auditable (history)
  'suggest'            // sugerencia (no ejecutar sin aprobación)
]);

const TargetType = z.enum([
  'companies', 'contacts', 'deals', 'emails',
  'tasks', 'ai_drafts', 'meetings', 'notifications', 'history'
]);

const ActionSchema = z.object({
  type: ActionType,
  target: TargetType,
  id: z.string().optional(),         // para updates
  data: z.record(z.any()).optional(), // para creates
  changes: z.record(z.any()).optional(), // para updates
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type Action = z.infer<typeof ActionSchema>;

/* ------------------------------- Esquemas I/O ------------------------------- */

// Interacción flexible pero tipada en lo esencial
export const InteractionSchema = z.object({
  source: z.enum(['email','voice','meeting','note']).describe('Origen de la interacción'),
  subject: z.string().optional(),
  body: z.string().optional(),         // transcript o cuerpo de email
  from: z.string().optional(),
  to: z.string().optional(),
  timestamp: z.string().optional()     // ISO
});
export type Interaction = z.infer<typeof InteractionSchema>;

// Entidades relacionadas mínimas para contexto
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

export const OrchestratorInputSchema = z.object({
  interaction: InteractionSchema,
  related_entities: RelatedEntitiesSchema.optional(),
  // Opcional: reglas del usuario para personalizar (umbral IA, business hours, etc.)
  policy: z.object({
    auto_apply_threshold: z.number().min(0).max(1).optional(), // p.ej., 0.85
    always_review_fields: z.array(z.string()).optional(),      // p.ej., ["amount","close_date"]
    followup_days_by_stage: z.record(z.string(), z.number()).optional(), // {"proposal":3, ...}
    business_hours: z.object({
      start: z.string().optional(), end: z.string().optional(), days: z.array(z.number()).optional()
    }).optional()
  }).optional()
});

export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

export const OrchestratorOutputSchema = z.object({
  actions: z.array(ActionSchema).default([])
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

/* ---------------------------------- Prompt ---------------------------------- */

const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-1.5-flash-latest'), // <- modelo vigente
  input: { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  prompt: `
You are CorchCRM's Orchestrator AI.
Your job: output ONLY a JSON object with an "actions" array that the backend will execute.
No prefaces, no commentary outside the JSON.

Entities you can act on: companies, contacts, deals, emails, tasks, meetings, notifications, ai_drafts, history.
Action types: update_entity, create_entity, create_task, create_ai_draft, create_meeting, notify_user, log_action, suggest.

Rules:
- Prefer small, atomic actions.
- Include "confidence" (0..1) for decisions.
- If unsure, use type "suggest".
- Log all entity changes with a "log_action".
- Respect user policy when provided (auto_apply_threshold, always_review_fields, followup_days_by_stage, business_hours).
- Keep times in ISO UTC if you propose due dates.
- If you update deals.stage, consider adjusting probability.

Input:
Interaction:
{{{json interaction}}}

Related entities:
{{{json related_entities}}}

Policy:
{{{json policy}}}

Return JSON that matches the output schema strictly.
`
});

/* ----------------------------------- Flow ----------------------------------- */

export const orchestrateInteractionFlow = ai.defineFlow(
  {
    name: 'orchestrateInteractionFlow',
    inputSchema: OrchestratorInputSchema,
    outputSchema: OrchestratorOutputSchema
  },
  async (input): Promise<OrchestratorOutput> => {
    // Sanitiza mínimos
    if (!input?.interaction?.source) {
      return { actions: [{
        type: 'log_action',
        target: 'history',
        data: {
          action: 'error',
          explanation: 'Missing interaction.source'
        },
        reason: 'Invalid input',
        confidence: 0.0
      }]};
    }

    try {
      const res = await orchestratePrompt(input);
      const out = res.output;

      // Normaliza
      const actions = Array.isArray(out?.actions) ? out.actions : [];
      return { actions };
    } catch (err) {
      console.error('[orchestrateInteractionFlow] Error:', err);
      return {
        actions: [{
          type: 'log_action',
          target: 'history',
          data: {
            action: 'error',
            explanation: 'Model call failed'
          },
          reason: 'Model error',
          confidence: 0.0
        }]
      };
    }
  }
);

/* ---------------------------------- Helper ---------------------------------- */

// Función sencilla para usar desde server actions o API routes
export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
