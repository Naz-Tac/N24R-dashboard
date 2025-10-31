import { NextResponse } from 'next/server';

export async function POST() {
  // Stateless tokens: client should discard token
  return NextResponse.json({ success: true });
}
