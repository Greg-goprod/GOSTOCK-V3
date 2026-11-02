import React, { useState } from 'react';
import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { confirmAction } from '../../lib/confirm';
import { planningError, ZONE_COLORS } from '../../lib/sitePlanning';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DateInput, { DateRangeInput } from '../common/DateInput';
import { EntityTable, type EntityColumn } from '../common/EntityTable';
import { MxEmpty } from '../mx/MxEmpty';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'select' | 'date' | 'daterange' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  // Pour « daterange » : clé de la date de fin (key = date de début)
  endKey?: string;
  // Non modifiable une fois l'élément créé (ex. famille d'un état)
  lockedOnEdit?: boolean;
}

interface Props<T extends { id: string }> {
  title: string;
  addLabel: string;
  table: string;
  fields: FieldDef[];
  rows: T[];
  columns: EntityColumn<T>[];
  baseValues?: Record<string, unknown>;
  rights: { create: boolean; update: boolean; delete: boolean };
  locked?: boolean;
  onChanged: () => Promise<void>;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
  deleteMessage: (row: T) => string;
  // Texte d'une erreur de la base (par défaut : celui du planning de chantier)
  errorText?: (error: unknown) => string;
  // Lignes que l'on peut supprimer / modifier (par défaut : toutes)
  canDelete?: (row: T) => boolean;
  canEdit?: (row: T) => boolean;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

type FormValues = Record<string, string | boolean>;

// Liste + création / modification / suppression d'un élément simple du planning (zones, équipes, phases, prestataires)
export function CrudSection<T extends { id: string }>({
  title, addLabel, table, fields, rows, columns, baseValues, rights, locked, onChanged, emptyIcon, emptyTitle, emptyText, deleteMessage, errorText = planningError, canDelete, canEdit,
}: Props<T>) {
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  const writable = !locked;

  const open = (row: T | 'new') => {
    const next: FormValues = {};
    for (const f of fields) {
      const current = row === 'new' ? undefined : (row as unknown as Record<string, unknown>)[f.key];
      if (f.type === 'checkbox') next[f.key] = row === 'new' ? true : Boolean(current);
      else if (f.type === 'color') next[f.key] = typeof current === 'string' ? current : ZONE_COLORS[0];
      else next[f.key] = typeof current === 'string' ? current : '';
      if (f.type === 'daterange' && f.endKey) { const e = row === 'new' ? undefined : (row as unknown as Record<string, unknown>)[f.endKey]; next[f.endKey] = typeof e === 'string' ? e : ''; }
    }
    setValues(next);
    setEditing(row);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || editing === null) return;
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      payload[f.key] = f.type === 'checkbox' ? Boolean(v) : (typeof v === 'string' && v.trim() === '' && !f.required ? null : typeof v === 'string' ? v.trim() : v);
      if (f.type === 'daterange' && f.endKey) { const e = values[f.endKey]; payload[f.endKey] = typeof e === 'string' && e.trim() !== '' ? e.trim() : null; }
    }
    setSaving(true);
    const { error } = editing === 'new'
      ? await supabase.from(table).insert({ ...baseValues, ...payload })
      : await supabase.from(table).update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) return void toast.error(errorText(error));
    toast.success(editing === 'new' ? 'Ajouté' : 'Modifié');
    setEditing(null);
    await onChanged();
  };

  const remove = async (row: T) => {
    if (!(await confirmAction(deleteMessage(row)))) return;
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) return void toast.error(errorText(error));
    toast.success('Supprimé');
    await onChanged();
  };

  const actionColumn: EntityColumn<T> = {
    id: 'actions', label: 'Actions',
    render: row => (
      <span className="inline-flex gap-2">
        {rights.update && writable && (canEdit?.(row) ?? true) && <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => open(row)}>Modifier</Button>}
        {rights.delete && writable && (canDelete?.(row) ?? true) && <Button size="sm" variant="outline" icon={<Trash2 size={14} />} onClick={() => void remove(row)}>Supprimer</Button>}
      </span>
    ),
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
        {rights.create && writable && <Button size="sm" icon={<Plus size={14} />} onClick={() => open('new')}>{addLabel}</Button>}
      </div>
      {rows.length === 0
        ? <MxEmpty icon={emptyIcon} title={emptyTitle} description={emptyText} />
        : <EntityTable items={rows} getKey={r => r.id} caption={title} columns={[...columns, actionColumn]} />}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? addLabel : 'Modifier'}>
        <form onSubmit={save} className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={Boolean(values[f.key])} onChange={e => setValues({ ...values, [f.key]: e.target.checked })} />
                  {f.label}
                </label>
              ) : (
                <>
                  <label htmlFor={`crud-${f.key}`} className={labelClass}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea id={`crud-${f.key}`} rows={2} className={inputClass} value={String(values[f.key] ?? '')} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
                  ) : f.type === 'select' ? (
                    <select id={`crud-${f.key}`} className={inputClass} value={String(values[f.key] ?? '')} required={f.required} disabled={f.lockedOnEdit && editing !== 'new'} onChange={e => setValues({ ...values, [f.key]: e.target.value })}>
                      {!f.required && <option value="">—</option>}
                      {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'daterange' && f.endKey ? (
                    <DateRangeInput id={`crud-${f.key}`} className={inputClass} start={String(values[f.key] ?? '')} end={String(values[f.endKey] ?? '')}
                      onChange={(a, b) => setValues({ ...values, [f.key]: a, [f.endKey as string]: b })} placeholder="Choisir le début et la fin" />
                  ) : f.type === 'date' ? (
                    <DateInput id={`crud-${f.key}`} className={inputClass} value={String(values[f.key] ?? '')} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
                  ) : f.type === 'color' ? (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>
                      {ZONE_COLORS.map(c => (
                        <button key={c} type="button" role="radio" aria-checked={values[f.key] === c} aria-label={c} onClick={() => setValues({ ...values, [f.key]: c })}
                          className={`h-7 w-7 rounded-full border-2 ${values[f.key] === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`} style={{ background: c }} />
                      ))}
                    </div>
                  ) : (
                    <input id={`crud-${f.key}`} className={inputClass} value={String(values[f.key] ?? '')} required={f.required} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
                  )}
                </>
              )}
              {f.hint && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{f.hint}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
