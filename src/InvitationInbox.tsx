import { useEffect, useState } from 'react';
import { Check, Loader2, Mail, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

export function InvitationInbox() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState<number | null>(null);
  const load = () => api.invitations().then(setInvites).catch(() => setError('Unable to load invitations.'));
  useEffect(() => { load(); }, []);
  const respond = async (id: number, accept: boolean) => { setError(''); setResponding(id); try { if (accept) { const result = await api.acceptInvitation(id); navigate(`/trips/${result.tripId}`); return; } await api.declineInvitation(id); load(); } catch (e: any) { setError(e.response?.data?.response_error || 'Unable to update this invitation.'); } finally { setResponding(null); } };
  if (!invites.length && !error) return null;
  return <section className="invite-inbox"><div><p className="eyebrow">TRIP INVITATIONS</p><h2><Mail size={20}/> Waiting for you</h2></div>{error && <p className="error">{error}</p>}{invites.map((invite) => <article key={invite.id}><div><strong>{invite.trip?.name || 'A shared trip'}</strong><p>{invite.invitedBy?.firstName || 'A traveller'} invited you as {invite.role}.</p></div><div><button className="accept" disabled={responding === invite.id} onClick={() => respond(invite.id, true)}>{responding === invite.id ? <Loader2 className="spin" size={15}/> : <Check size={15}/>} {responding === invite.id ? 'Joining…' : 'Accept'}</button><button className="decline" disabled={responding === invite.id} onClick={() => respond(invite.id, false)}><X size={15}/> Decline</button></div></article>)}</section>;
}
