import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';

type AssistantRole = 'admin' | 'dispatcher' | 'manager' | 'agent';

interface AssistantRequest {
  query: string;
  role?: AssistantRole;
  context?: Record<string, any>;
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

    if (useMock) {
      // Mock mode: generate helpful responses based on query and role
      const response = generateMockResponse(query, role);
      
      return NextResponse.json({
        success: true,
        data: {
          query,
          response,
          role,
          timestamp: new Date().toISOString(),
          mode: 'mock',
        },
      }, { status: 200 });
    }

    // Production mode: This would integrate with OpenAI, Claude, or custom AI
    // For now, fall back to mock until external AI is configured
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
