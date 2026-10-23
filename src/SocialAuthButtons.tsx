import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
} from 'firebase/auth';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

export function SocialAuthButtons({ setUser }: { setUser: (user: User) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'google' | 'facebook' | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  if (!enabled || !['/login', '/register'].includes(location.pathname)) return null;

  const signIn = async (providerName: 'google' | 'facebook') => {
    if (!acceptTerms) {
      setError('Please accept the Terms of Use and Privacy Policy before continuing.');
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

  return <div className="social-auth"><div><span/>or continue with<span/></div><label className="social-consent"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)}/><span>I agree to the <Link to="/terms" target="_blank">Terms of Use</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link> if this creates my account.</span></label><button type="button" onClick={() => signIn('google')} disabled={!!busy}>{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</button><button type="button" onClick={() => signIn('facebook')} disabled={!!busy}>{busy === 'facebook' ? 'Connecting…' : 'Continue with Facebook'}</button>{error && <p className="error">{error}</p>}</div>;
}
