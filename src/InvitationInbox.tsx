import { useEffect, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import { api } from './api';

export function InvitationInbox() {
  const [invites, setInvites] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = () => api.invitations().then(setInvites).catch(() => setError('Unable to load invitations.'));
  useEffect(() => { load(); }, []);
  const respond = async (id: number, accept: boolean) => { try { if (accept) await api.acceptInvitation(id); else await api.declineInvitation(id); load(); } catch (e: any) { setError(e.response?.data?.response_error || 'Unable to update this invitation.'); } };
  if (!invites.length && !error) return null;
  return <section className="invite-inbox"><div><p className="eyebrow">TRIP INVITATIONS</p><h2><Mail size={20}/> Waiting for you</h2></div>{error && <p className="error">{error}</p>}{invites.map((invite) => <article key={invite.id}><div><strong>{invite.trip?.name || 'A shared trip'}</strong><p>{invite.inviter?.firstName || 'A traveller'} invited you as {invite.role}.</p></div><div><button className="accept" onClick={() => respond(invite.id, true)}><Check size={15}/> Accept</button><button className="decline" onClick={() => respond(invite.id, false)}><X size={15}/> Decline</button></div></article>)}</section>;
}
