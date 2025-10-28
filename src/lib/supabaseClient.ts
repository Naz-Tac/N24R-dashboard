import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client for frontend (anon key)
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : ({} as unknown as ReturnType<typeof createClient>);

// Client for server-side API routes (service role key)
export const supabaseService = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : ({} as unknown as ReturnType<typeof createClient>);

// Example: Fetch all rows from agent_availability table
export async function fetchAgentAvailability() {
  try {
    const { data, error } = await supabase
      .from('agent_availability')
      .select('*');
    
    if (error) {
      console.error('Error fetching agent availability:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}