import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type RateInfo = { count: number; resetAt: number };
const RATE_LIMIT = 8;
const WINDOW_MS = 60_000;
const rateMap = new Map<string, RateInfo>();
const IS_DEV = process.env.NODE_ENV !== 'production';

function devNull(reason: string) {
  return IS_DEV ? { email: null, reason } : { email: null };
}

function getClientIp(req: NextRequest) {
  const forwarded =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("true-client-ip");

  if (!forwarded) return "unknown";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function rateLimit(key: string) {
  const now = Date.now();
  const existing = rateMap.get(key);
  if (!existing || existing.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT) return false;
  existing.count += 1;
  rateMap.set(key, existing);
  return true;
}

function isValidId(idLogin: string) {
  if (!/^\d+$/.test(idLogin)) return false;
  return idLogin.length >= 3 && idLogin.length <= 12;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(devNull('rate_limit'), { status: 200 });
  }

  let idLogin = '';
  try {
    const body = (await req.json()) as { id_login?: string | number };
    idLogin = String(body?.id_login ?? '').trim();
  } catch {
    return NextResponse.json(devNull('invalid_payload'), { status: 200 });
  }

  if (!isValidId(idLogin)) {
    return NextResponse.json(devNull('invalid_id'), { status: 200 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(devNull('admin_missing'), { status: 200 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id')
    .eq('id_login', idLogin)
    .maybeSingle();

  if (profileError) {
    console.error('id-to-email: profiles error', profileError);
    return NextResponse.json(devNull('profiles_error'), { status: 200 });
  }

  if (!profile?.user_id) {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (usersError) {
      console.error('id-to-email: auth admin listUsers error', usersError);
      return NextResponse.json(devNull('auth_admin_error'), { status: 200 });
    }

    const matched = usersData?.users?.find((user) => String(user.user_metadata?.id_login ?? '') === idLogin);
    const email = matched?.email ?? null;
    return NextResponse.json({ email }, { status: 200 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);

  if (userError) {
    console.error('id-to-email: auth admin getUserById error', userError);
    return NextResponse.json(devNull('auth_admin_error'), { status: 200 });
  }

  const email = userData?.user?.email ?? null;
  return NextResponse.json({ email }, { status: 200 });
}
