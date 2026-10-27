import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
} from 'firebase/auth';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, saveSession } from './api';
import type { User } from './types';
import './social-auth.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const enabled = Object.values(firebaseConfig).every(Boolean);

/** Uses the sign-in form's own terms checkbox (passed as acceptTerms), so the page shows a single box. */
export function SocialAuthButtons({ setUser, acceptTerms }: { setUser: (user: User) => void; acceptTerms: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  if (!enabled || !['/login', '/register'].includes(location.pathname)) return null;

  const signIn = async (providerName: 'google' | 'facebook') => {
    if (!acceptTerms) {
      setError('Tick “I agree to the Terms of Use and the Privacy Policy” above before continuing.');
      return;
    }
    setBusy(providerName); setError('');
    try {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const provider = providerName === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      const credential = await signInWithPopup(getAuth(app), provider);
      const session = await api.oauthLogin(providerName, await credential.user.getIdToken(), acceptTerms);
      saveSession(session); setUser(session.user); navigate('/trips');
    } catch (reason: any) {
      setError(reason?.message || `Could not sign in with ${providerName}.`);
    } finally { setBusy(null); }
  };

  return <div className="social-auth"><div><span/>or continue with<span/></div><button type="button" onClick={() => signIn('google')} disabled={!!busy}>{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</button><button type="button" onClick={() => signIn('facebook')} disabled={!!busy}>{busy === 'facebook' ? 'Connecting…' : 'Continue with Facebook'}</button>{error && <p className="error">{error}</p>}</div>;
}
