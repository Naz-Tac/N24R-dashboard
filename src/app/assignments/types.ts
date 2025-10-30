// Common interfaces for assignment components
export interface Assignment {
  id?: string;  // UUID, optional as it's assigned by Supabase
  agent_id: string;  // UUID FK to agents
  shift_id: string;  // UUID FK to shift_requests
  status: string;
  assigned_at?: string;  // ISO timestamp, auto-set by DB
  notes?: string | null;  // Optional free-form note; nullable in DB
}

export interface AssignmentWithDetails extends Assignment {
  agent_name?: string;
  shift_name?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T | null;
  error?: string;
  code?: string;
  details?: any;
}

export type AssignmentResponse = ApiResponse<Assignment[]>;
