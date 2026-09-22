import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getCustomerSession } from '../../../../lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getCustomerSession(cookieStore);

    if (!session || !session.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please verify your email to view your orders.' },
        { status: 401 }
      );
    }

    const cleanEmail = session.email.trim().toLowerCase();

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .ilike('email', cleanEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Customer Orders fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch customer orders.' }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      email: cleanEmail,
    });
  } catch (error) {
    console.error('Customer Orders Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
