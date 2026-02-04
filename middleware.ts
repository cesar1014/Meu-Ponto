import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/cadastro',
  '/signup',
  '/auth/esqueci-senha',
  '/auth/resetar-senha',
  '/auth/completar-perfil',
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/api/')) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);
  const isGuest = request.cookies.get('pontoapp_guest')?.value === '1';
  const guestAllowed = isGuest && (pathname.startsWith('/home') || pathname.startsWith('/pontos'));

  if (!user && !publicPath && !guestAllowed) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === '/login' || pathname === '/cadastro' || pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/home';
    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const needsProfile = !profile?.user_id;

    if (needsProfile && pathname !== '/auth/completar-perfil') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/auth/completar-perfil';
      return NextResponse.redirect(redirectUrl);
    }

    if (!needsProfile && pathname === '/auth/completar-perfil') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/home';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
};
