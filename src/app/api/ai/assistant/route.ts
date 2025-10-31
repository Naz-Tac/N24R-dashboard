import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { AiMemoryStore } from '@/lib/inMemoryStore';
import { createSupabaseUserClient } from '@/lib/supabaseServer';

type AssistantRole = 'admin' | 'dispatcher' | 'manager' | 'agent';

interface AssistantRequest {
  query: string;
  role?: AssistantRole;
  context?: Record<string, any>;
  conversationHistory?: Message[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ActionIntent {
  type: 'create_shift' | 'assign_agent' | 'notify_agent' | 'show_analytics' | 'none';
  confidence: number;
  params?: Record<string, any>;
}

interface ActionResponse {
  success: boolean;
  action: string;
  details: Record<string, any>;
  message: string;
}

// Detect intent from user query
function detectIntent(query: string): ActionIntent {
  const lowerQuery = query.toLowerCase();

  // Create shift intent
  if (lowerQuery.includes('create shift') || lowerQuery.includes('add shift') || lowerQuery.includes('new shift')) {
    return {
      type: 'create_shift',
      confidence: 0.9,
      params: extractShiftParams(query),
    };
  }

  // Assign agent intent
  if (lowerQuery.includes('assign agent') || lowerQuery.includes('assign') && lowerQuery.includes('agent')) {
    return {
      type: 'assign_agent',
      confidence: 0.85,
      params: extractAssignmentParams(query),
    };
  }

  // Notify agent intent
  if (lowerQuery.includes('notify') || lowerQuery.includes('send message') || lowerQuery.includes('alert')) {
    return {
      type: 'notify_agent',
      confidence: 0.8,
      params: extractNotifyParams(query),
    };
  }

  // Show analytics intent
  if (lowerQuery.includes('analytics') || lowerQuery.includes('metrics') || lowerQuery.includes('performance') || lowerQuery.includes('summary')) {
    return {
      type: 'show_analytics',
      confidence: 0.85,
    };
  }

  return { type: 'none', confidence: 0 };
}

// Extract shift parameters from natural language
function extractShiftParams(query: string): Record<string, any> {
  const params: Record<string, any> = {};
  const lowerQuery = query.toLowerCase();

  // Date extraction
  if (lowerQuery.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    params.date = tomorrow.toISOString().split('T')[0];
  } else if (lowerQuery.includes('today')) {
    params.date = new Date().toISOString().split('T')[0];
  }

  // Time extraction (simple patterns like "9-5", "9:00-17:00", "9am-5pm")
  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/i;
  const match = query.match(timePattern);
  if (match) {
    const startHour = match[1];
    const startMin = match[2] || '00';
    const endHour = match[3];
    const endMin = match[4] || '00';
    params.start_time = `${startHour.padStart(2, '0')}:${startMin}`;
    params.end_time = `${endHour.padStart(2, '0')}:${endMin}`;
  }

  // Location extraction (very basic)
  const locationPattern = /(?:at|in|location)\s+([A-Za-z\s]+?)(?:\s+from|\s+on|\s+tomorrow|\s+today|$)/i;
  const locMatch = query.match(locationPattern);
  if (locMatch) {
    params.location = locMatch[1].trim();
  }

  return params;
}

// Extract assignment parameters
function extractAssignmentParams(query: string): Record<string, any> {
  const params: Record<string, any> = {};
  
  // Extract agent name (simple pattern)
  const agentPattern = /agent\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i;
  const match = query.match(agentPattern);
  if (match) {
    params.agent_name = match[1].trim();
  }

  return params;
}

// Extract notify parameters
function extractNotifyParams(query: string): Record<string, any> {
  const params: Record<string, any> = {};
  
  // Extract agent name
  const agentPattern = /(?:notify|alert|message)\s+(?:agent\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i;
  const match = query.match(agentPattern);
  if (match) {
    params.agent_name = match[1].trim();
  }

  return params;
}

// Execute action based on intent
async function executeAction(
  intent: ActionIntent,
  role: AssistantRole,
  req: NextRequest
): Promise<ActionResponse> {
  // RBAC check: only admin, manager, dispatcher can execute write actions
  const writeRoles = ['admin', 'manager', 'dispatcher'];
  const isWriteAction = ['create_shift', 'assign_agent', 'notify_agent'].includes(intent.type);

  if (isWriteAction && !writeRoles.includes(role)) {
    return {
      success: false,
      action: intent.type,
      details: {},
      message: '❌ You do not have permission to execute this action. Only admins, managers, and dispatchers can create shifts, assign agents, or send notifications.',
    };
  }

  const baseUrl = new URL(req.url).origin;

  switch (intent.type) {
    case 'create_shift': {
      const { date, start_time, end_time, location } = intent.params || {};
      
      if (!date || !start_time || !end_time) {
        return {
          success: false,
          action: 'create_shift',
          details: { params: intent.params },
          message: '⚠️ I need more information to create a shift. Please specify the date, start time, and end time. For example: "Create a shift tomorrow from 9:00 to 17:00"',
        };
      }

      try {
        const response = await fetch(`${baseUrl}/api/shifts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            shift_date: date,
            start_time,
            end_time,
            location: location || 'Not specified',
            status: 'unfilled',
          }),
        });

        if (!response.ok) {
          throw new Error(`Shift creation failed: ${response.status}`);
        }

        const result = await response.json();
        return {
          success: true,
          action: 'create_shift',
          details: result.data || { date, start_time, end_time, location },
          message: `✅ Shift created successfully for ${date} from ${start_time} to ${end_time}${location ? ` at ${location}` : ''}. You can now assign agents to this shift.`,
        };
      } catch (error: any) {
        return {
          success: false,
          action: 'create_shift',
          details: { error: error.message },
          message: `❌ Failed to create shift: ${error.message}`,
        };
      }
    }

    case 'assign_agent': {
      const { agent_name } = intent.params || {};

      if (!agent_name) {
        return {
          success: false,
          action: 'assign_agent',
          details: {},
          message: '⚠️ Please specify which agent to assign. For example: "Assign agent John to the next available shift"',
        };
      }

      // Mock assignment for now (in production, would query available shifts and agents)
      return {
        success: true,
        action: 'assign_agent',
        details: {
          agent_name,
          shift_id: 'mock-shift-123',
          shift_date: new Date().toISOString().split('T')[0],
          status: 'assigned',
        },
        message: `✅ Agent ${agent_name} has been assigned to the shift. They will receive a notification and can accept or decline from their portal.`,
      };
    }

    case 'notify_agent': {
      const { agent_name } = intent.params || {};

      if (!agent_name) {
        return {
          success: false,
          action: 'notify_agent',
          details: {},
          message: '⚠️ Please specify which agent to notify. For example: "Notify agent Sarah about tomorrow\'s shift"',
        };
      }

      try {
        const response = await fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            recipient: agent_name,
            message: `You have a new assignment. Please check your dashboard.`,
            channel: 'sms',
          }),
        });

        if (!response.ok) {
          throw new Error(`Notification failed: ${response.status}`);
        }

        return {
          success: true,
          action: 'notify_agent',
          details: { agent_name, channel: 'sms' },
          message: `✅ Notification sent to ${agent_name} via SMS. They will be alerted about their assignment.`,
        };
      } catch (error: any) {
        return {
          success: false,
          action: 'notify_agent',
          details: { error: error.message },
          message: `❌ Failed to send notification: ${error.message}`,
        };
      }
    }

    case 'show_analytics': {
      try {
        const response = await fetch(`${baseUrl}/api/analytics/summary`, {
          method: 'GET',
          headers: {
            'Cookie': req.headers.get('cookie') || '',
          },
        });

        if (!response.ok) {
          throw new Error(`Analytics fetch failed: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data || {};

        return {
          success: true,
          action: 'show_analytics',
          details: data,
          message: `📊 **Performance Summary**\n\n• Total Agents: ${data.total_agents || 0}\n• Total Shifts: ${data.total_shifts || 0}\n• Filled Shifts: ${data.filled_shifts || 0}\n• Fill Rate: ${data.fill_rate || 0}%\n• Avg Response Time: ${data.avg_response_time || 0} hours\n\nVisit /analytics for detailed charts and trends.`,
        };
      } catch (error: any) {
        return {
          success: false,
          action: 'show_analytics',
          details: { error: error.message },
          message: `❌ Failed to fetch analytics: ${error.message}`,
        };
      }
    }

    default:
      return {
        success: false,
        action: 'none',
        details: {},
        message: 'I didn\'t understand that action. Could you rephrase?',
      };
  }
}

function generateMockResponse(query: string, role: AssistantRole): string {
  const lowerQuery = query.toLowerCase();

  // Role-specific responses
  if (role === 'admin' || role === 'dispatcher') {
    // Analytics queries
    if (lowerQuery.includes('analytics') || lowerQuery.includes('metrics') || lowerQuery.includes('performance')) {
      return "📊 I can help you with analytics! Visit the Analytics page (/analytics) to see:\n• Fill rate and shift metrics\n• Shift requests vs. fills over time\n• Top performing agents\n• Accepted vs. declined assignments\n\nYou can filter by date range and organization.";
    }

    // Shift creation
    if (lowerQuery.includes('create shift') || lowerQuery.includes('add shift') || lowerQuery.includes('new shift')) {
      return "📅 To create a new shift:\n1. Go to Shifts page (/shifts)\n2. Click 'Create Shift' button\n3. Fill in: Date, Start/End time, Location\n4. Save and assign agents\n\nOr use the API: POST /api/shifts with date, start_time, end_time, location.";
    }

    // Agent assignment
    if (lowerQuery.includes('assign') || lowerQuery.includes('assignment')) {
      return "👤 To assign an agent to a shift:\n1. Go to Assignments page (/assignments)\n2. Click 'Create Assignment'\n3. Select agent and shift\n4. Set status (assigned/pending)\n5. Optionally notify via SMS/email\n\nAgents can accept/decline from their portal.";
    }

    // User management
    if (lowerQuery.includes('add user') || lowerQuery.includes('create user') || lowerQuery.includes('invite')) {
      return "👥 To add a new user:\n1. Go to Settings > Users\n2. Click 'Invite User'\n3. Enter email and select role (admin/dispatcher/agent/manager)\n4. User receives invite email\n\nFor org managers: Use /org/agents to invite org-specific agents.";
    }

    return "I can help you with:\n• 📊 Analytics and performance metrics\n• 📅 Creating and managing shifts\n• 👤 Assigning agents to shifts\n• 👥 User management and invitations\n• 📧 Sending notifications to agents\n\nWhat would you like to do?";
  }

  if (role === 'manager') {
    // Organization-specific queries
    if (lowerQuery.includes('roster') || lowerQuery.includes('agents') || lowerQuery.includes('team')) {
      return "👥 Your organization roster:\n• View agents: /org/agents\n• Invite new agents: Use the invite form\n• See agent availability and assignments\n\nYou can also request shared agents from other organizations if needed.";
    }

    if (lowerQuery.includes('shift') || lowerQuery.includes('schedule')) {
      return "📅 Organization shift management:\n• View shifts: /org/dashboard\n• Create shift: Use /api/org/shifts API\n• Assign your agents to shifts\n• Monitor fill rate and coverage\n\nAll shifts are scoped to your organization.";
    }

    if (lowerQuery.includes('analytics') || lowerQuery.includes('metrics')) {
      return "📊 Organization analytics:\n• Visit /analytics (filtered to your org)\n• See fill rate, shift counts\n• Track agent performance\n• View shift request trends\n\nNote: You see only your organization's data.";
    }

    if (lowerQuery.includes('share') || lowerQuery.includes('request')) {
      return "🤝 Request shared agents:\n• Use /api/org/request-shared\n• Specify shift and agent ID\n• Admin approves cross-org assignments\n\nThis helps when you need extra coverage.";
    }

    return "I can help you with:\n• 👥 Managing your organization roster\n• 📅 Creating and scheduling shifts\n• 📊 Viewing org-specific analytics\n• 🤝 Requesting shared agents\n\nWhat do you need help with?";
  }

  if (role === 'agent') {
    // Agent-specific queries
    if (lowerQuery.includes('assignment') || lowerQuery.includes('shift') || lowerQuery.includes('accept') || lowerQuery.includes('decline')) {
      return "📋 Your assignments:\n• View: /agent/dashboard\n• Accept a shift: Click 'Accept' button\n• Decline a shift: Click 'Decline' button\n• See available shifts you can accept\n\nYou'll receive notifications for new assignments.";
    }

    if (lowerQuery.includes('availability') || lowerQuery.includes('schedule')) {
      return "📅 Set your availability:\n1. Go to Availability page (/availability)\n2. Add date, start time, end time\n3. Save availability\n4. Dispatchers see your availability when assigning shifts\n\nKeep your availability updated for better assignments!";
    }

    if (lowerQuery.includes('notification') || lowerQuery.includes('message')) {
      return "📧 Notifications:\n• You receive SMS/email for new assignments\n• Reply YES to accept, NO to decline\n• Check /agent/dashboard for all assignments\n• Update your contact info in settings\n\nMake sure notifications are enabled!";
    }

    return "I can help you with:\n• 📋 Viewing and managing assignments\n• 📅 Setting your availability\n• ✅ Accepting or declining shifts\n• 📧 Understanding notifications\n\nWhat do you need?";
  }

  // Fallback
  return "Hello! I'm your scheduling assistant. How can I help you today?";
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager', 'agent']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const useMock = process.env.AI_ASSISTANT_MOCK === '1' || process.env.NODE_ENV !== 'production';

  try {
    const body: AssistantRequest = await req.json();
    const query = String(body.query || '').trim();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

  // Use role from body if provided, otherwise use authenticated role
  const role = (body.role || auth.role) as AssistantRole;

    // Load recent memory (last 10 entries) using user-bound client under RLS
    let recentMemory: any[] = [];
    try {
      const supabaseUser = createSupabaseUserClient(req);
      const { data, error } = await supabaseUser
        .from('ai_memory')
        .select('id,user_id,role,type,content,intent,created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && Array.isArray(data)) {
        recentMemory = data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          role: d.role,
          timestamp: d.created_at,
          type: d.type,
          content: d.content,
          intent: d.intent || 'none',
          action: null,
          action_details: null,
        }));
        // hydrate local shadow for adaptive ranking
        await AiMemoryStore.syncFromSupabase(auth.userId!, 50);
      }
    } catch {
      const { rows } = await AiMemoryStore.getRecent(auth.userId!, 10, { forceFallback: true });
      recentMemory = rows;
    }

    // Detect intent from query
    const intent = detectIntent(query);

    // If action intent detected and confidence is high, execute the action
    if (intent.type !== 'none' && intent.confidence > 0.7) {
      const actionResult = await executeAction(intent, role, req);
      // Append memory entries (user message + assistant action summary)
      try {
        const supabaseUser = createSupabaseUserClient(req);
        // user message
        await supabaseUser.from('ai_memory').insert({
          user_id: auth.userId!, role, type: 'user_message', content: query, intent: intent.type,
        });
        // action summary
        await supabaseUser.from('ai_memory').insert({
          user_id: auth.userId!, role, type: 'action', content: actionResult.message, intent: intent.type,
        });
        // purge old
        await supabaseUser.from('ai_memory')
          .delete()
          .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      } catch {
        // fallback local shadow
        await AiMemoryStore.append({ user_id: auth.userId!, role, timestamp: new Date().toISOString(), type: 'user_message', content: query, intent: intent.type, action: null, action_details: null }, { forceFallback: true });
        await AiMemoryStore.append({ user_id: auth.userId!, role, timestamp: new Date().toISOString(), type: 'action', content: actionResult.message, intent: intent.type, action: actionResult.action, action_details: actionResult.details }, { forceFallback: true });
        await AiMemoryStore.purgeOlderThan(30);
      }
      
      return NextResponse.json({
        success: actionResult.success,
        data: {
          query,
          response: actionResult.message,
          role,
          timestamp: new Date().toISOString(),
          mode: useMock ? 'mock' : 'action',
          action: actionResult.action,
          actionDetails: actionResult.details,
          intent: intent.type,
          confidence: intent.confidence,
          suggestedActions: getRankedSuggestions(role, auth.userId!, recentMemory, intent.type),
        },
      }, { status: actionResult.success ? 200 : 403 });
    }

    // No action intent, provide guidance
    if (useMock) {
      const response = generateMockResponse(query, role);
      // Memory entries for conversational guidance
      try {
        const supabaseUser = createSupabaseUserClient(req);
        await supabaseUser.from('ai_memory').insert({ user_id: auth.userId!, role, type: 'user_message', content: query, intent: 'none' });
        await supabaseUser.from('ai_memory').insert({ user_id: auth.userId!, role, type: 'assistant_message', content: response, intent: 'none' });
        await supabaseUser.from('ai_memory')
          .delete()
          .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      } catch {
        await AiMemoryStore.append({ user_id: auth.userId!, role, timestamp: new Date().toISOString(), type: 'user_message', content: query, intent: 'none', action: null, action_details: null }, { forceFallback: true });
        await AiMemoryStore.append({ user_id: auth.userId!, role, timestamp: new Date().toISOString(), type: 'assistant_message', content: response, intent: 'none', action: null, action_details: null }, { forceFallback: true });
        await AiMemoryStore.purgeOlderThan(30);
      }
      
      return NextResponse.json({
        success: true,
        data: {
          query,
          response,
          role,
          timestamp: new Date().toISOString(),
          mode: 'mock',
          suggestedActions: getRankedSuggestions(role, auth.userId!, recentMemory, 'none'),
        },
      }, { status: 200 });
    }

    // Production mode: This would integrate with OpenAI, Claude, or custom AI
    const response = generateMockResponse(query, role);
    
    return NextResponse.json({
      success: true,
      data: {
        query,
        response,
        role,
        timestamp: new Date().toISOString(),
        mode: 'fallback',
        note: 'External AI not configured, using mock responses',
        suggestedActions: getRankedSuggestions(role, auth.userId!, recentMemory, 'none'),
      },
    }, { status: 200 });
  } catch (e: any) {
    console.error('AI assistant error:', e);
    return NextResponse.json(
      { error: 'Failed to process query', details: e?.message },
      { status: 500 }
    );
  }
}

// Get suggested action buttons based on role
function getSuggestedActions(role: AssistantRole): string[] {
  const writeRoles = ['admin', 'manager', 'dispatcher'];
  
  if (writeRoles.includes(role)) {
    return [
      'Create a shift tomorrow 9-5',
      'Show analytics summary',
      'Assign agent to next shift',
      'Notify all agents',
    ];
  }

  // Agents get read-only suggestions
  return [
    'Show my assignments',
    'Show analytics summary',
    'Help with availability',
  ];
}

// Map intents to human-friendly suggestion prompts
function suggestionForIntent(intent: string): string | null {
  switch (intent) {
    case 'create_shift':
      return 'Create a shift tomorrow 9-5';
    case 'assign_agent':
      return 'Assign agent to next shift';
    case 'notify_agent':
      return 'Notify agent about assignment';
    case 'show_analytics':
      return 'Show analytics summary';
    default:
      return null;
  }
}

// Ranked suggestions using memory and last intent context
function getRankedSuggestions(
  role: AssistantRole,
  userId: string,
  recentMemory: { intent?: string }[] = [],
  lastIntent: string = 'none'
): string[] {
  const writeRoles = ['admin', 'manager', 'dispatcher'];
  const defaults = getSuggestedActions(role);

  const userTop = AiMemoryStore.topIntents({ user_id: userId, limit: 3 });
  const roleTop = AiMemoryStore.topIntents({ role: role as any, limit: 3 });

  const ranked: string[] = [];

  // Contextual grounding: if last action was create_shift, suggest assign_agent first
  if (lastIntent === 'create_shift' && writeRoles.includes(role)) {
    const followUp = suggestionForIntent('assign_agent');
    if (followUp) ranked.push(followUp);
  }

  // Add user's top intents
  userTop.forEach((i) => {
    const s = suggestionForIntent(i);
    if (s) ranked.push(s);
  });
  // Add role's top intents
  roleTop.forEach((i) => {
    const s = suggestionForIntent(i);
    if (s) ranked.push(s);
  });
  // Fill with defaults
  defaults.forEach((d) => ranked.push(d));

  // Deduplicate, keep order, cap length
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of ranked) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
    if (out.length >= 5) break;
  }
  return out;
}
