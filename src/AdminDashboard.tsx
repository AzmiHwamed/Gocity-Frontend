import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, Compass, LayoutDashboard, LogOut, Search, ShieldCheck, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api, clearSession } from './api';
import type { Trip, User } from './types';
import './admin-dashboard.css';

type Overview = { users: number; travellers: number; agencies: number; admins: number; trips: number; publicTrips: number };
type View = 'analytics' | 'users' | 'trips';
const items = <T,>(value: T[] | { items: T[] }) => Array.isArray(value) ? value : value.items;

export function AdminDashboard() {
  const location = useLocation();
  const view: View = location.pathname.endsWith('/users') ? 'users' : location.pathname.endsWith('/trips') ? 'trips' : 'analytics';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setError(''); if (view === 'analytics') api.adminOverview().then(setOverview).catch(() => setError('Could not load administration data.')); if (view === 'users') api.adminUsers({ page: 1, limit: 100, search: query || undefined }).then((value) => setUsers(items(value))).catch(() => setError('Could not load users.')); if (view === 'trips') api.adminTrips({ page: 1, limit: 100 }).then((value) => setTrips(items(value))).catch(() => setError('Could not load trips.')); }, [view, query]);
  const cards = overview ? [
    { label: 'Users', value: overview.users, note: `${overview.travellers} travellers`, icon: Users },
    { label: 'Agencies', value: overview.agencies, note: 'organization accounts', icon: Building2 },
    { label: 'Trips', value: overview.trips, note: `${overview.publicTrips} public`, icon: Compass },
    { label: 'Admins', value: overview.admins, note: 'platform managers', icon: ShieldCheck },
  ] : [];
  const filteredTrips = useMemo(() => trips.filter((trip) => `${trip.name} ${trip.city ?? ''} ${trip.owner?.firstName ?? ''} ${trip.owner?.lastName ?? ''}`.toLowerCase().includes(query.toLowerCase())), [trips, query]);
  const toggleUser = async (user: User) => { try { const updated = await api.adminUpdateUser(user.id, { isActive: !user.isActive }); setUsers((current) => current.map((item) => item.id === user.id ? updated : item)); } catch { setError('Could not update this user.'); } };
  const title = view === 'analytics' ? 'Analytics' : view === 'users' ? 'User management' : 'Trip management';
  return <main className="admin-dashboard"><aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><b>Go</b>City <span>Admin</span></Link><p>WORKSPACE</p><Link className={view === 'analytics' ? 'active' : ''} to="/admin"><LayoutDashboard size={17}/> Analytics</Link><Link className={view === 'users' ? 'active' : ''} to="/admin/users"><Users size={17}/> Users</Link><Link className={view === 'trips' ? 'active' : ''} to="/admin/trips"><Compass size={17}/> Trips</Link><div className="admin-sidebar-bottom"><Link to="/admin"><ShieldCheck size={16}/> Admin home</Link><button onClick={() => { clearSession(); window.location.assign('/login'); }}><LogOut size={16}/> Sign out</button></div></aside><section className="admin-content"><header><div><p className="eyebrow">PLATFORM ADMINISTRATION</p><h1>{title}</h1></div><span className="admin-profile"><ShieldCheck size={16}/> Administrator</span></header>{error && <p className="error">{error}</p>}{view !== 'analytics' && <label className="admin-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'users' ? 'Search people or agencies' : 'Search trips, places or owners'} /></label>}{view === 'analytics' && <><p className="muted">A live view of GoCity’s community and publishing activity.</p>{!overview ? <p className="muted">Loading analytics…</p> : <><div className="admin-metrics">{cards.map(({ label, value, note, icon: Icon }) => <article key={label}><span><Icon size={19}/></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>)}</div><div className="admin-insight"><BarChart3 size={20}/><div><b>Publishing health</b><p>{overview.publicTrips} of {overview.trips} trips are discoverable to signed-in travellers.</p></div></div></>}</>}{view === 'users' && <div className="admin-table"><div className="admin-table-head"><span>Account</span><span>Role</span><span>Status</span><span/></div>{users.map((user) => <article key={user.id}><div><b>{user.organizationName || `${user.firstName} ${user.lastName}`}</b><small>{user.email}</small></div><span className="admin-role">{user.role || 'user'}</span><span className={user.isActive ? 'admin-status live' : 'admin-status'}>{user.isActive ? 'Active' : 'Disabled'}</span><button onClick={() => toggleUser(user)}>{user.isActive ? 'Disable' : 'Enable'}</button></article>)}{!users.length && <p className="muted">No users found.</p>}</div>}{view === 'trips' && <div className="admin-table"><div className="admin-table-head"><span>Trip</span><span>Owner</span><span>Visibility</span><span>Dates</span></div>{filteredTrips.map((trip) => <article key={trip.id}><div><b>{trip.name}</b><small>{trip.city || 'Destination not set'}</small></div><span>{trip.owner ? `${trip.owner.firstName} ${trip.owner.lastName}` : 'Unknown'}</span><span className="admin-role">{trip.visibility || 'private'}</span><span>{trip.startDate}</span></article>)}{!filteredTrips.length && <p className="muted">No trips found.</p>}</div>}</section></main>;
}
