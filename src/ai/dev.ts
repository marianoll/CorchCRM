import { config } from 'dotenv';
config();

import '@/ai/flows/review-ai-suggestions.ts';
import '@/ai/flows/natural-language-search.ts';
import '@/ai/flows/infoshard-text.ts';
import '@/ai/flows/summarize-text.ts';
import '@/ai/flows/debug-echo.ts';
