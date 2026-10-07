import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CircleHelp, Copy, DownloadCloud, Eye, EyeOff, LockKeyhole, LogIn, Pencil, Plus, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import { VAULT_SECTIONS, type VaultData, type VaultField, type VaultRecord, type VaultSection } from '@/lib/vault-store';
import { backupVaultToDrive, getVaultBackupMeta, restoreVaultFromDrive } from '@/lib/drive-backup';
import { normalizeVault } from '@/lib/vault-store';
import { Notice } from '@/components/notice';
import type { AuthState } from '@/lib/use-auth';

type ModalState = { section: VaultSection; record?: VaultRecord } | null;

function recordTitle(section: VaultSection, record: VaultRecord): string {
  const title = record[section.titleKey]?.trim();
  if (title) return title;
  for (const field of section.fields) {
    const value = record[field.key]?.trim();
    if (value) return value;
  }
  return 'Untitled entry';
}

export function VaultPage({ auth, vault, setVault, notify }: { auth: AuthState; vault: VaultData; setVault: (next: VaultData | ((v: VaultData) => VaultData)) => void; notify: (message: string) => void }) {
  const [active, setActive] = useState(VAULT_SECTIONS[0].id);
  const [modal, setModal] = useState<ModalState>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);
  const [lastBackup, setLastBackup] = useState('');

  useEffect(() => {
    if (!auth.user) return;
    let alive = true;
    auth.getToken().then(getVaultBackupMeta).then((meta) => { if (alive && meta) setLastBackup(meta.modifiedTime); }).catch(() => {});
    return () => { alive = false; };
  }, [auth.user]);

  if (!auth.user) {
    return (
      <>
        <div className="page-heading"><div><div className="eyebrow">Private vault</div><h1>Locked.</h1><p className="page-subtitle">Your personal records open only after you sign in with Google.</p></div></div>
        <div className="card" style={{ padding: 34, textAlign: 'center' }}>
          <div className="empty-mark" style={{ width: 54, height: 54 }}><LockKeyhole size={24} /></div>
          <h2 className="card-title" style={{ marginTop: 14 }}>Sign in to open your vault</h2>
          <p className="page-subtitle" style={{ maxWidth: 420, margin: '8px auto 18px' }}>Documents, policies, passwords, cards and more are kept here. Sign in with Google to unlock this section on this device.</p>
          <button className="btn btn-primary" onClick={() => auth.signIn().catch((e) => notify(e instanceof Error ? e.message : 'Google sign-in failed'))} disabled={auth.busy || !auth.configured} style={{ margin: '0 auto' }}><LogIn size={15} /> {auth.busy ? 'Opening…' : 'Sign in with Google'}</button>
          {!auth.configured && <p className="page-subtitle" style={{ marginTop: 14, color: '#93463c' }}>Google sign-in is not configured in this build.</p>}
        </div>
      </>
    );
  }

  const section = VAULT_SECTIONS.find((s) => s.id === active) ?? VAULT_SECTIONS[0];
  const rows = vault[section.id] ?? [];

  const toggleReveal = (key: string) => setRevealed((state) => ({ ...state, [key]: !state[key] }));
  const copyValue = async (value: string) => {
    try { await navigator.clipboard.writeText(value); notify('Copied to clipboard'); }
    catch { notify('Could not copy'); }
  };

  const save = (values: VaultRecord) => {
    setVault((current) => {
      const list = current[section.id] ?? [];
      const exists = values.id && list.some((row) => row.id === values.id);
      return { ...current, [section.id]: exists ? list.map((row) => (row.id === values.id ? values : row)) : [...list, values] };
    });
    setModal(null);
    notify(values.id && rows.some((row) => row.id === values.id) ? 'Changes saved' : 'Added to your vault');
  };

  const remove = (record: VaultRecord) => {
    if (!window.confirm(`Remove this ${section.label.toLowerCase()} entry? This cannot be undone.`)) return;
    setVault((current) => ({ ...current, [section.id]: (current[section.id] ?? []).filter((row) => row.id !== record.id) }));
    notify('Entry removed');
  };

  const backupNow = async () => {
    setWorking(true);
    try { const token = await auth.getToken(); const meta = await backupVaultToDrive(token, vault); setLastBackup(meta.modifiedTime); notify('Vault backed up to Google Drive'); }
    catch (e) { notify(e instanceof Error ? e.message : 'Vault backup failed'); }
    finally { setWorking(false); }
  };

  const restoreNow = async () => {
    setWorking(true);
    try {
      const token = await auth.getToken();
      const envelope = await restoreVaultFromDrive(token);
      if (!envelope) { notify('No vault backup was found in your Google Drive'); return; }
      const candidate = normalizeVault((envelope as { vault?: unknown }).vault ?? envelope);
      if (window.confirm('Replace all vault entries on this device with your Google Drive backup? This cannot be undone.')) {
        setVault(candidate);
        notify('Vault restored from Google Drive');
      }
    } catch (e) { notify(e instanceof Error ? e.message : 'Vault restore failed'); }
    finally { setWorking(false); }
  };

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">Private vault</div><h1>Everything in one safe place.</h1><p className="page-subtitle">Signed in as {auth.user.email}. Only you can open this on this device.</p></div>
        <div className="top-actions">
          <button className="btn" onClick={backupNow} disabled={working}><UploadCloud size={15} /> {working ? 'Working…' : 'Back up'}</button>
          <button className="btn" onClick={restoreNow} disabled={working}><DownloadCloud size={15} /> Restore</button>
        </div>
      </div>

      <Notice><ShieldCheck size={16} />Entries are saved in this browser and, when you back up, in a private folder in your Google Drive. They are not encrypted with a separate password yet — keep this device and your Google account protected.{lastBackup ? ` Last Drive backup ${new Date(lastBackup).toLocaleString()}.` : ''}</Notice>

      <div className="segmented">
        {VAULT_SECTIONS.map((item) => (
          <button key={item.id} className={`segment ${item.id === active ? 'active' : ''}`} onClick={() => setActive(item.id)}>
            {item.label}{(vault[item.id]?.length ?? 0) > 0 ? ` · ${vault[item.id].length}` : ''}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <div><h2 className="card-title">{section.label}</h2><div className="card-kicker">{section.caption}</div></div>
          <button className="btn btn-primary" onClick={() => setModal({ section })}><Plus size={15} /> Add entry</button>
        </div>
        {rows.length === 0 ? (
          <div className="empty"><div className="empty-mark"><LockKeyhole size={19} /></div><h3>Nothing here yet</h3><p>Add your first {section.label.toLowerCase()} entry to keep it handy and backed up.</p><button className="btn btn-primary" onClick={() => setModal({ section })} style={{ margin: '0 auto' }}><Plus size={15} /> Add entry</button></div>
        ) : (
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
            {rows.map((record) => (
              <div className="vault-record" key={record.id}>
                <div className="vault-record-head">
                  <div><h3 className="vault-record-title">{recordTitle(section, record)}</h3>{section.subtitleKey && record[section.subtitleKey]?.trim() && <div className="vault-record-sub">{record[section.subtitleKey]}</div>}</div>
                  <div className="vault-record-actions">
                    <button className="icon-btn" aria-label="Edit entry" onClick={() => setModal({ section, record })}><Pencil size={15} /></button>
                    <button className="icon-btn" aria-label="Delete entry" onClick={() => remove(record)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {section.fields.filter((field) => field.key !== section.titleKey && field.key !== section.subtitleKey && record[field.key]?.trim()).map((field) => {
                  const key = `${record.id}:${field.key}`;
                  const value = record[field.key];
                  const show = !field.sensitive || revealed[key];
                  return (
                    <div className="vault-field-row" key={field.key}>
                      <span className="k">{field.label}</span>
                      <span className="v">
                        <span>{show ? value : '••••••••'}</span>
                        {field.sensitive && <button aria-label={show ? 'Hide value' : 'Reveal value'} onClick={() => toggleReveal(key)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
                        {field.sensitive && <button aria-label="Copy value" onClick={() => copyValue(value)}><Copy size={13} /></button>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {modal && <VaultModal section={modal.section} record={modal.record} onClose={() => setModal(null)} onSave={save} />}
    </>
  );
}

function VaultModal({ section, record, onClose, onSave }: { section: VaultSection; record?: VaultRecord; onClose: () => void; onSave: (values: VaultRecord) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of section.fields) init[field.key] = record?.[field.key] ?? (field.type === 'select' && field.options ? field.options[0] : '');
    return init;
  });
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  const set = (key: string, value: string) => setValues((state) => ({ ...state, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = record?.id ?? `${section.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onSave({ id, ...values });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="vault-modal-title">
        <div className="modal-head">
          <div><div className="eyebrow">{record ? 'Edit entry' : 'Add entry'}</div><h2 className="modal-title" id="vault-modal-title">{record ? 'Update' : 'New'} {section.label.toLowerCase().replace(/s$/, '')}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {section.fields.filter((field) => !field.showIf || values[field.showIf.key] === field.showIf.equals).map((field, index) => (
              <VaultFieldInput key={field.key} field={field} value={values[field.key] ?? ''} onChange={(value) => set(field.key, value)} revealed={!!reveal[field.key]} onToggle={() => setReveal((state) => ({ ...state, [field.key]: !state[field.key] }))} inputRef={index === 0 ? first : undefined} />
            ))}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Check size={14} />{record ? 'Save changes' : 'Add entry'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function VaultFieldInput({ field, value, onChange, revealed, onToggle, inputRef }: { field: VaultField; value: string; onChange: (value: string) => void; revealed: boolean; onToggle: () => void; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const label = (
    <label htmlFor={`vault-${field.key}`}>{field.label}<span className="hint" title={field.hint} tabIndex={0} role="img" aria-label={field.hint}><CircleHelp size={13} /></span></label>
  );
  if (field.type === 'textarea') {
    return <div className={`field ${field.full ? 'full' : ''}`}>{label}<textarea id={`vault-${field.key}`} value={value} onChange={(e) => onChange(e.target.value)} rows={3} /></div>;
  }
  if (field.type === 'select' && field.options) {
    return <div className={`field ${field.full ? 'full' : ''}`}>{label}<select id={`vault-${field.key}`} value={value} onChange={(e) => onChange(e.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></div>;
  }
  if (field.type === 'password') {
    return (
      <div className={`field ${field.full ? 'full' : ''}`}>{label}
        <div className="input-reveal">
          <input id={`vault-${field.key}`} ref={inputRef} type={revealed ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
          <button type="button" aria-label={revealed ? 'Hide' : 'Show'} onClick={onToggle}>{revealed ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
      </div>
    );
  }
  return <div className={`field ${field.full ? 'full' : ''}`}>{label}<input id={`vault-${field.key}`} ref={inputRef} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
