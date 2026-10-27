import { useEffect, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from './api';
import type { Expense, ExpenseCategory, ExpenseSummary, Trip } from './types';
import './expenses.css';

type Member = { id: number; userId?: number; role: string; user?: { id?: number; firstName: string; lastName: string } };
const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'hotel', label: 'Hotel' }, { value: 'transport', label: 'Transport' }, { value: 'food', label: 'Food & drinks' },
  { value: 'activity', label: 'Activities' }, { value: 'shopping', label: 'Shopping' }, { value: 'other', label: 'Other' },
];
const label = (c: ExpenseCategory) => CATEGORIES.find((x) => x.value === c)?.label || c;
const errorText = (e: any, fallback: string) => e?.response?.data?.response_error || fallback;

/** Trip spending: summary (total, per person, by category, by payer, budget left) + the expenses list. */
export function TripExpenses({ trip, members, editable, refreshKey = 0 }: { trip: Trip; members: Member[]; editable: boolean; refreshKey?: number }) {
  const tripId = String(trip.id);
  const [expenses, setExpenses] = useState<Expense[]>([]); const [summary, setSummary] = useState<ExpenseSummary | null>(null); const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<number | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  // Totals are in the trip's currency; expenses in other currencies are listed apart (never converted).
  const [tripCurrency, setTripCurrency] = useState(trip.currency ?? 'EUR');
  const currency = summary?.currency ?? tripCurrency;
  const changeCurrency = async (next: string) => { setTripCurrency(next); try { await api.updateTrip(tripId, { currency: next }); await refresh(); } catch (e) { setError(errorText(e, 'Could not change the currency.')); } };
  const money = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);
  const refresh = () => Promise.all([api.expenses(tripId).then(setExpenses), api.expenseSummary(tripId).then(setSummary)]).catch((e) => setError(errorText(e, 'Unable to load expenses.')));
  useEffect(() => { refresh(); }, [tripId, refreshKey]);

  const payload = (form: FormData) => ({ title: String(form.get('title')).trim(), amount: Number(form.get('amount')), category: form.get('category'), date: form.get('date') || null, paidById: form.get('paidById') ? Number(form.get('paidById')) : null, currency: String(form.get('currency') || '') || null });
  const add = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const target = event.currentTarget; setBusy(true); setError(''); try { await api.addExpense(tripId, payload(new FormData(target))); target.reset(); setAdding(false); await refresh(); } catch (e) { setError(errorText(e, 'Unable to add this expense.')); } finally { setBusy(false); } };
  const save = async (event: FormEvent<HTMLFormElement>, id: number) => { event.preventDefault(); setBusy(true); setError(''); try { await api.updateExpense(tripId, id, payload(new FormData(event.currentTarget))); setEditing(null); await refresh(); } catch (e) { setError(errorText(e, 'Unable to save this expense.')); } finally { setBusy(false); } };
  const remove = async (expense: Expense) => { if (!window.confirm(`Delete “${expense.title}”?`)) return; setError(''); try { await api.deleteExpense(tripId, expense.id); await refresh(); } catch (e) { setError(errorText(e, 'Unable to delete this expense.')); } };

  const fields = (e?: Expense) => <><input name="title" required maxLength={150} placeholder="What was it?" defaultValue={e?.title}/><input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" defaultValue={e?.amount}/><select name="category" defaultValue={e?.category || 'other'}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select><input name="date" type="date" min={trip.startDate} defaultValue={e?.date || ''}/><select name="paidById" defaultValue={e?.paidById ?? ''}><option value="">Paid by…</option>{members.map((m) => { const id = m.userId ?? m.user?.id; return id ? <option key={m.id} value={id}>{m.user ? `${m.user.firstName} ${m.user.lastName}` : 'Traveller'}</option> : null; })}</select><input name="currency" maxLength={3} placeholder="EUR" defaultValue={e?.currency || ''} pattern="[A-Z]{3}" title="3-letter code, e.g. EUR"/></>;
  const max = Math.max(1, ...(summary?.byCategory.map((c) => c.total) || [1]));

  return <div className="workspace-panel expenses">
    <p className="eyebrow">GROUP BUDGET</p><h2>Spend, at a glance.</h2>
    {summary && <><div className="budget-grid"><div><small>Total spent</small><strong>{money(summary.total)}</strong><small>{money(summary.activitiesTotal)} activities · {money(summary.expensesTotal)} other expenses</small></div><div><small>Per person ({summary.travelersCount})</small><strong>{money(summary.perPerson)}</strong></div><div><small>Budget left</small><strong className={summary.remainingBudget != null && summary.remainingBudget < 0 ? 'over' : ''}>{summary.remainingBudget == null ? 'No budget set' : money(summary.remainingBudget)}</strong>{summary.budgetTotal != null && <small>of {money(summary.budgetTotal)}</small>}</div></div>
      <div className="expense-breakdown"><div><h3>By category</h3>{summary.byCategory.filter((c) => c.total > 0).map((c) => <div className="bar-row" key={c.category}><span>{label(c.category)}</span><div className="bar"><i style={{ width: `${(c.total / max) * 100}%` }}/></div><b>{money(c.total)}</b></div>)}{!summary.byCategory.some((c) => c.total > 0) && <p className="muted">Nothing spent yet.</p>}</div><div><h3>Who paid</h3>{summary.byPayer.length ? summary.byPayer.map((p) => <div className="payer" key={p.userId ?? 'none'}><span>{p.name}</span><b>{money(p.total)}</b></div>) : <p className="muted">Add who paid to see the split.</p>}</div></div>
      {!!summary.otherCurrencies?.length && <p className="muted other-currencies">Not included in the totals above (other currencies, not converted): {summary.otherCurrencies.map((o) => new Intl.NumberFormat('en', { style: 'currency', currency: o.currency }).format(o.total)).join(' · ')}</p>}
      {editable && <label className="trip-currency">Trip currency<select value={currency} onChange={(e) => changeCurrency(e.target.value)}>{['EUR', 'USD', 'GBP', 'TND', 'MAD', 'TRY', 'CHF', 'CAD', 'AED'].map((c) => <option key={c}>{c}</option>)}</select><small>Budget, activity costs and totals use this currency.</small></label>}</>}
    {error && <p className="error">{error}</p>}
    <div className="section-head expense-head"><h3>Expenses</h3>{editable && !adding && <button className="primary compact" onClick={() => setAdding(true)}><Plus size={16}/> Add expense</button>}</div>
    {adding && <form className="expense-form" onSubmit={add}>{fields()}<button className="primary compact" disabled={busy}><Check size={15}/> Add</button><button type="button" className="icon-button" onClick={() => setAdding(false)} aria-label="Cancel"><X size={15}/></button></form>}
    <div className="expense-list">{expenses.length ? expenses.map((e) => editing === e.id ? <form className="expense-form" key={e.id} onSubmit={(ev) => save(ev, e.id)}>{fields(e)}<button className="primary compact" disabled={busy}><Check size={15}/> Save</button><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Cancel"><X size={15}/></button></form> : <article className="expense" key={e.id}><span className={`cat ${e.category}`}>{label(e.category)}</span><div><strong>{e.title}</strong><small>{[e.date, e.paidBy ? `paid by ${e.paidBy.firstName}` : null, e.isHotelStay ? 'from the hotel you chose' : null].filter(Boolean).join(' · ')}</small></div><b>{new Intl.NumberFormat('en', { style: 'currency', currency: e.currency || currency }).format(e.amount)}</b>{editable && <div className="row-actions"><button className="icon-button" onClick={() => setEditing(e.id)} aria-label="Edit"><Pencil size={14}/></button><button className="icon-button" onClick={() => remove(e)} aria-label="Delete"><Trash2 size={14}/></button></div>}</article>) : <p className="muted">No expenses yet. Activity costs from the itinerary are already counted above.</p>}</div>
  </div>;
}
