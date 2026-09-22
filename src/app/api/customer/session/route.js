import { cookies } from 'next/headers';
import { getCustomerSession, clearCustomerSessionCookie } from '../../../../lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getCustomerSession(cookieStore);

    if (session && session.email) {
      return NextResponse.json({
        authenticated: true,
        email: session.email,
      });
    }

    return NextResponse.json({
      authenticated: false,
    });
  } catch (error) {
    console.error('Customer Session GET error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    await clearCustomerSessionCookie(cookieStore);
    return NextResponse.json({ success: true, message: 'Customer session cleared.' });
  } catch (error) {
    console.error('Customer Session DELETE error:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
