
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 * 
 * ARCHITECTURE NOTE: This project uses Google Gemini AI exclusively.
 * See README.md for complete API integration guidelines.
 * DO NOT add OpenAI integrations - use Gemini AI instead.
 * 
 * IMPORTANT: Using hardcoded values instead of VITE_* environment variables
 * because Lovable doesn't support VITE_* variables. The values below are
 * the actual project configuration for this Supabase instance.
 */

const supabaseUrl = 'https://ejqgdmbuabrcjxbhpxup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcWdkbWJ1YWJyY2p4YmhweHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMTUzMTYsImV4cCI6MjA2NTY5MTMxNn0.vMKdS0ToOOq_RELS-IhSUPYEx6-qkLWoqEBYfYIt8iY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
