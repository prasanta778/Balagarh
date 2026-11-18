import React, { useEffect, useState } from 'react';
import type { Language, UserRecord } from './types/cms';
import { apiFetch, clearSessionTokens, getAuthToken, initBackendMode, onAuthExpired } from './lib/api';
import { getBundledBootstrap, getFallbackBootstrap } from './lib/staticFallback';
import { PublicHome, PublicLayout, type PublicBootstrapData } from './components/public/PublicPortal';
import {
  PublicContentDetailView,
  PublicEventsView,
  PublicSearchView,
  PublicSectionView,
} from './components/public/PublicDetailViews';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPortal } from './components/admin/AdminPortal';

export default function App() {
  const [route, setRoute] = useState<string>(() => window.location.pathname + window.location.search);
  const [lang, setLang] = useState<Language>('en');
  const [fontScale, setFontScale] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bootstrap, setBootstrap] = useState<PublicBootstrapData>(() => getBundledBootstrap());
  const [adminUser, setAdminUser] = useState<UserRecord | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setRoute(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    return onAuthExpired(() => {
      setAdminUser(null);
      setSessionNotice('Your session expired or requires sign-in. Please log in to continue.');
    });
  }, []);

  const loadBootstrap = () => {
    apiFetch<PublicBootstrapData>('/api/public/bootstrap')
      .then((res) => setBootstrap(res))
      .catch(async () => {
        const fallback = await getFallbackBootstrap();
        if (fallback) setBootstrap(fallback);
      });
  };

  useEffect(() => {
    let active = true;
    initBackendMode()
      .then(() => {
        if (!active) return;
        loadBootstrap();
        const token = getAuthToken();
        if (token) {
          return apiFetch<{ user: UserRecord }>('/api/auth/me')
            .then((res) => {
              if (active) setAdminUser(res.user);
            })
            .catch(() => {
              clearSessionTokens();
            });
        }
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Re-fetch public bootstrap whenever returning from Admin to Public Homepage
  useEffect(() => {
    if (!route.startsWith('/admin')) {
      initBackendMode().then(() => loadBootstrap());
    }
  }, [route]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Admin Route
  if (route.startsWith('/admin')) {
    if (checkingAuth) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A2540] text-white text-sm font-semibold">
          Loading Our Balagarh CMS...
        </div>
      );
    }
    if (!adminUser) {
      return (
        <AdminLogin
          lang={lang}
          sessionNotice={sessionNotice}
          onLoginSuccess={(u) => {
            setSessionNotice('');
            setAdminUser(u);
          }}
          onBackToSite={() => navigate('/')}
        />
      );
    }
    return (
      <AdminPortal
        user={adminUser}
        setUser={setAdminUser}
        lang={lang}
        setLang={setLang}
        onViewPublicSite={() => navigate('/')}
        onLogout={() => {
          clearSessionTokens();
          setSessionNotice('');
          setAdminUser(null);
          navigate('/admin');
        }}
      />
    );
  }

  // Public Website Routes
  const pathOnly = route.split('?')[0];
  let publicContent: React.ReactNode = null;

  if (pathOnly === '/' || pathOnly === '') {
    publicContent = bootstrap ? (
      <PublicHome data={bootstrap} lang={lang} onNavigate={navigate} />
    ) : (
      <div className="max-w-[1280px] mx-auto px-4 py-10 space-y-5">
        <div className="h-80 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  } else if (pathOnly.startsWith('/section/')) {
    const slug = pathOnly.replace('/section/', '');
    publicContent = <PublicSectionView slug={slug} lang={lang} onNavigate={navigate} />;
  } else if (pathOnly.startsWith('/content/')) {
    const id = Number(pathOnly.replace('/content/', ''));
    publicContent = <PublicContentDetailView contentId={id} lang={lang} onNavigate={navigate} />;
  } else if (pathOnly === '/events') {
    publicContent = <PublicEventsView lang={lang} onNavigate={navigate} />;
  } else if (pathOnly.startsWith('/events/')) {
    const eid = Number(pathOnly.replace('/events/', ''));
    publicContent = <PublicEventsView lang={lang} selectedEventId={eid} onNavigate={navigate} />;
  } else if (pathOnly === '/search') {
    const params = new URLSearchParams(route.split('?')[1] || '');
    const q = params.get('q') || searchQuery;
    publicContent = <PublicSearchView query={q} lang={lang} onNavigate={navigate} />;
  } else {
    publicContent = bootstrap ? <PublicHome data={bootstrap} lang={lang} onNavigate={navigate} /> : null;
  }

  return (
    <PublicLayout
      lang={lang}
      setLang={setLang}
      fontScale={fontScale}
      setFontScale={setFontScale}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onSearchSubmit={handleSearchSubmit}
      onNavigate={navigate}
      onOpenAdmin={() => navigate('/admin')}
      currentRoute={pathOnly}
    >
      {publicContent}
    </PublicLayout>
  );
}
