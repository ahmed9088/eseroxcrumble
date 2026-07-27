import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD || 'EseroAdmin2026!'; // Fallback password for dev

    if (password === adminPassword) {
      // Set secure HTTP-only cookie
      const cookieStore = await cookies();
      cookieStore.set('admin_session', adminPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'strict',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Incorrect admin passcode.' }, { status: 401 });
  } catch (error) {
    console.error('Admin Auth API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    const adminPassword = process.env.ADMIN_PASSWORD || 'EseroAdmin2026!';

    if (session && session.value === adminPassword) {
      return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}
