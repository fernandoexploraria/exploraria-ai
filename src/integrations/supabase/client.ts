import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 * 
 * ARCHITECTURE NOTE: This project uses Google Gemini AI exclusively.
 * See README.md for complete API integration guidelines.
 * DO NOT add OpenAI integrations - use Gemini AI instead.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
