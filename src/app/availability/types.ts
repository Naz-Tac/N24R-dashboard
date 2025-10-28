// Common interfaces for availability components
export interface AgentAvailability {
  id?: string | number;  // Optional as it's assigned by Supabase
  agent_name: string;
  availability_date: string;  // ISO date string
  start_time: string;    // HH:mm format
  end_time: string;      // HH:mm format
}

export interface ApiResponse<T = any> {
  data: T | null;
  error?: string;
  message?: string;
}

export type AvailabilityResponse = ApiResponse<AgentAvailability[]>;