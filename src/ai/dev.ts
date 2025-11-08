import { config } from 'dotenv';
config();

import '@/ai/flows/review-ai-suggestions.ts';
import '@/ai/flows/email-to-crm.ts';
import '@/ai/flows/voice-to-crm.ts';
import '@/ai/flows/natural-language-search.ts';
import '@/ai/flows/crystallize-text.ts';
