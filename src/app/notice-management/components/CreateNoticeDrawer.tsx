'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { airlines } from './noticeData';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CreateNoticeDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface NoticeFormData {
  type: string;
  category: string;
  priority: string;
  title: string;
  refNumber: string;
  effectiveDate: string;
  effectiveTime: string;
  expiryDate: string;
  expiryTime: string;
  targetAirlines: string[];
  body: string;
  requireAck: boolean;
  ackDeadlineHours: number;
  requireSignature: boolean;
  channelEmail: boolean;
  channelSms: boolean;
  channelWhatsapp: boolean;
  channelPush: boolean;
}

const steps = [
  { id: 'step-1', label: 'Notice Details', icon: 'DocumentTextIcon' },
  { id: 'step-2', label: 'Content', icon: 'PencilSquareIcon' },
  { id: 'step-3', label: 'Acknowledgement', icon: 'CheckCircleIcon' },
  { id: 'step-4', label: 'Review & Submit', icon: 'PaperAirplaneIcon' },
];

export default function CreateNoticeDrawer({ open, onClose }: CreateNoticeDrawerProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
  const { user, profile } = useAuth();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<NoticeFormData>({
    defaultValues: {
      type: '',
      category: '',
      priority: 'High',
      title: '',
      refNumber: `MEAG-${new Date().getFullYear()}-${String(Math.floor(1000 + 999)).padStart(4, '0')}`,
      requireAck: true,
      ackDeadlineHours: 12,
      requireSignature: false,
      channelEmail: true,
      channelSms: true,
      channelWhatsapp: false,
      channelPush: true,
    },
  });

  const watchPriority = watch('priority');

  // Replace mock submit with Supabase insert
  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const values = getValues();
      const refNum = values.refNumber || `MEAG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { error } = await supabase.from('notices').insert({
        ref_number: refNum,
        title: values.title,
        notice_type: values.type,
        category: values.category,
        priority: values.priority,
        status: 'Active',
        body: values.body || '',
        published_by: user?.id || null,
        published_by_name: profile?.full_name || user?.email || '',
        published_date: new Date().toISOString(),
        effective_date: values.effectiveDate
          ? new Date(`${values.effectiveDate}T${values.effectiveTime || '00:00'}`).toISOString()
          : new Date().toISOString(),
        expiry_date: values.expiryDate
          ? new Date(`${values.expiryDate}T${values.expiryTime || '23:59'}`).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        target_airlines: selectedAirlines,
        ack_percentage: 0,
        total_recipients: selectedAirlines.length * 3,
        acknowledged: 0,
        escalated: false,
        escalation_level: 0,
        requires_signature: values.requireSignature,
        require_ack: values.requireAck,
        ack_deadline_hours: values.ackDeadlineHours,
      });
      if (error) {
        toast.error('Failed to create notice: ' + error.message);
      } else {
        toast.success('Notice published and distribution initiated across all channels');
        onClose();
        setStep(0);
      }
    } catch (err: any) {
      toast.error('Failed to create notice');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAirline = (airline: string) => {
    setSelectedAirlines((prev) =>
      prev.includes(airline) ? prev.filter((a) => a !== airline) : [...prev, airline]
    );
  };

  const toggleAllAirlines = () => {
    setSelectedAirlines(selectedAirlines.length === airlines.length ? [] : [...airlines]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <div
        className="w-full max-w-2xl h-full flex flex-col shadow-2xl"
        style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Create Operational Notice</h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Step {step + 1} of {steps.length} — {steps[step].label}</p>
          </div>
          <button className="btn-ghost p-2" onClick={onClose} aria-label="Close drawer">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 pt-4 pb-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-0">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => i < step && setStep(i)}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: i < step ? 'var(--primary)' : i === step ? 'rgba(245,158,11,0.2)' : 'var(--muted)',
                      color: i < step ? 'var(--primary-foreground)' : i === step ? 'var(--primary)' : 'var(--muted-foreground)',
                      border: i === step ? '2px solid var(--primary)' : '2px solid transparent',
                    }}
                  >
                    {i < step ? <Icon name="CheckIcon" size={12} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block" style={{ color: i === step ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px mx-2" style={{ background: i < step ? 'var(--primary)' : 'var(--border)' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Notice Type *</label>
                  <select className="input-field text-sm" {...register('type', { required: 'Notice type is required' })}>
                    <option value="">Select type...</option>
                    {['Operational Instructions', 'Safety Flash', 'Airside Notice', 'Ground Handling Procedures', 'Security Directive', 'Flight Operations Update', 'Emergency Notification', 'Service Bulletin', 'Airline Memo', 'Regulatory Update'].map((t) => (
                      <option key={`type-${t}`} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.type && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.type.message}</p>}
                </div>
                <div>
                  <label className="label-field">Category *</label>
                  <select className="input-field text-sm" {...register('category', { required: 'Category is required' })}>
                    <option value="">Select category...</option>
                    {['Safety Flash', 'Operational Memo', 'Urgent Notice', 'General Information'].map((c) => (
                      <option key={`cat-${c}`} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.category.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Priority Level *</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['Critical', 'High', 'Medium', 'Informational'] as const).map((p) => {
                      const colors = { Critical: '#EF4444', High: '#F97316', Medium: '#EAB308', Informational: '#3B82F6' };
                      return (
                        <label key={`prio-${p}`} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" value={p} {...register('priority')} className="sr-only" />
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
                            style={{
                              background: watchPriority === p ? `${colors[p]}20` : 'transparent',
                              borderColor: watchPriority === p ? colors[p] : 'var(--border)',
                              color: watchPriority === p ? colors[p] : 'var(--muted-foreground)',
                            }}
                          >
                            {p}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="label-field">Reference Number</label>
                  <input type="text" className="input-field text-sm font-mono" {...register('refNumber')} readOnly style={{ opacity: 0.7 }} />
                  <p className="text-2xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Auto-generated — editable if needed</p>
                </div>
              </div>

              <div>
                <label className="label-field">Notice Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Airside Vehicle Incident — Taxiway Echo Closure Immediate Safety Flash"
                  className="input-field text-sm"
                  {...register('title', { required: 'Notice title is required', minLength: { value: 10, message: 'Title must be at least 10 characters' } })}
                />
                {errors.title && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Effective Date *</label>
                  <input type="date" className="input-field text-sm" {...register('effectiveDate', { required: 'Effective date is required' })} />
                </div>
                <div>
                  <label className="label-field">Effective Time</label>
                  <input type="time" className="input-field text-sm" {...register('effectiveTime')} />
                </div>
                <div>
                  <label className="label-field">Expiry Date *</label>
                  <input type="date" className="input-field text-sm" {...register('expiryDate', { required: 'Expiry date is required' })} />
                </div>
                <div>
                  <label className="label-field">Expiry Time</label>
                  <input type="time" className="input-field text-sm" {...register('expiryTime')} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-field mb-0">Target Airlines *</label>
                  <button type="button" className="text-xs font-medium" style={{ color: 'var(--primary)' }} onClick={toggleAllAirlines}>
                    {selectedAirlines.length === airlines.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {airlines.map((airline) => (
                    <label key={`airline-chk-${airline}`} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-colors hover:bg-muted" style={{ borderColor: selectedAirlines.includes(airline) ? 'var(--primary)' : 'var(--border)', background: selectedAirlines.includes(airline) ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        style={{ accentColor: 'var(--primary)' }}
                        checked={selectedAirlines.includes(airline)}
                        onChange={() => toggleAirline(airline)}
                      />
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{airline}</span>
                    </label>
                  ))}
                </div>
                {selectedAirlines.length === 0 && (
                  <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>Select at least one target airline</p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label-field">Notice Body *</label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Write the full operational notice content. Be specific about procedures, locations, timings, and responsible parties.</p>
                <textarea
                  rows={14}
                  placeholder="TO: All Airline Station Managers and Ground Operations Personnel&#10;&#10;SUBJECT: [Notice Title]&#10;&#10;1. BACKGROUND&#10;...&#10;&#10;2. ACTION REQUIRED&#10;...&#10;&#10;3. EFFECTIVE DATE&#10;...&#10;&#10;Issued by: MEAG Operations Control"
                  className="input-field text-sm resize-none font-mono"
                  {...register('body', { required: 'Notice body is required' })}
                />
                {errors.body && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{errors.body.message}</p>}
              </div>

              <div>
                <label className="label-field">Attachments</label>
                <div
                  className="border-2 border-dashed rounded-xl p-8 text-center transition-colors hover:border-primary cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Icon name="CloudArrowUpIcon" size={32} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' } as React.CSSProperties} />
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Drop files here or click to upload</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>PDF, DOC, DOCX, PNG, JPG — Max 25MB per file</p>
                  <button type="button" className="btn-secondary text-xs mt-3">
                    <Icon name="PaperClipIcon" size={14} />
                    Browse Files
                  </button>
                </div>
              </div>

              <div>
                <label className="label-field">Related Documents</label>
                <input type="text" placeholder="e.g. Ground Operations Manual Section 4.3, ECAA Circular 2026-14" className="input-field text-sm" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Require Acknowledgement</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Recipients must click &ldquo;I have read and understood this notice&rdquo;</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked {...register('requireAck')} />
                    <div className="w-10 h-5 rounded-full peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ background: 'var(--primary)' }} />
                  </label>
                </div>
              </div>

              <div>
                <label className="label-field">Acknowledgement Deadline (hours)</label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Escalation triggers after this deadline. Critical notices: recommended 4–8h.</p>
                <div className="flex gap-2 flex-wrap">
                  {[4, 8, 12, 24, 48].map((h) => (
                    <label key={`deadline-${h}`} className="cursor-pointer">
                      <input type="radio" value={h} className="sr-only peer" {...register('ackDeadlineHours')} />
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        {h}h
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Require Digital Signature</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>For Critical and High priority notices — recipient must type full name as signature</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" {...register('requireSignature')} />
                    <div className="w-10 h-5 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" style={{ background: 'var(--border)' }} />
                  </label>
                </div>
              </div>

              <div>
                <label className="label-field">Escalation Chain</label>
                <div className="space-y-2">
                  {[
                    { label: '12h — Automated reminder email', icon: 'EnvelopeIcon', active: true },
                    { label: '24h — Second reminder + SMS alert', icon: 'DevicePhoneMobileIcon', active: true },
                    { label: '48h — Escalation to Station Manager & Regional Manager', icon: 'ExclamationTriangleIcon', active: true },
                  ].map((rule, i) => (
                    <div key={`esc-${i}`} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--primary)' }}>
                        <Icon name={rule.icon as Parameters<typeof Icon>[0]['name']} size={14} />
                      </div>
                      <span className="text-xs flex-1" style={{ color: 'var(--foreground)' }}>{rule.label}</span>
                      <span className="text-2xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Active</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-field">Distribution Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'channelEmail', label: 'Email', icon: 'EnvelopeIcon', color: '#3B82F6' },
                    { key: 'channelSms', label: 'SMS', icon: 'DevicePhoneMobileIcon', color: '#22C55E' },
                    { key: 'channelWhatsapp', label: 'WhatsApp Business', icon: 'ChatBubbleLeftEllipsisIcon', color: '#22C55E' },
                    { key: 'channelPush', label: 'Push Notification', icon: 'BellIcon', color: '#8B5CF6' },
                  ].map((ch) => (
                    <label key={`ch-${ch.key}`} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted" style={{ borderColor: 'var(--border)' }}>
                      <input type="checkbox" className="w-4 h-4" style={{ accentColor: ch.color }} {...register(ch.key as keyof NoticeFormData)} />
                      <Icon name={ch.icon as Parameters<typeof Icon>[0]['name']} size={16} style={{ color: ch.color } as React.CSSProperties} />
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{ch.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                <div className="flex items-start gap-3">
                  <Icon name="InformationCircleIcon" size={18} style={{ color: 'var(--primary)', flexShrink: 0 } as React.CSSProperties} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Review before publishing</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Once published, the notice will be immediately distributed to all targeted recipients. This action is logged in the audit trail.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Notice Type', value: getValues('type') || '—' },
                  { label: 'Category', value: getValues('category') || '—' },
                  { label: 'Priority', value: getValues('priority') || '—' },
                  { label: 'Reference', value: getValues('refNumber') || '—' },
                  { label: 'Title', value: getValues('title') || '—' },
                  { label: 'Effective Date', value: getValues('effectiveDate') || '—' },
                  { label: 'Expiry Date', value: getValues('expiryDate') || '—' },
                  { label: 'Target Airlines', value: selectedAirlines.length > 0 ? selectedAirlines.join(', ') : '—' },
                  { label: 'Require Acknowledgement', value: getValues('requireAck') ? 'Yes' : 'No' },
                  { label: 'Require Signature', value: getValues('requireSignature') ? 'Yes' : 'No' },
                ].map((row) => (
                  <div key={`review-${row.label}`} className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
                    <span className="text-xs font-semibold text-right max-w-[60%]" style={{ color: 'var(--foreground)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
          >
            <Icon name={step === 0 ? 'XMarkIcon' : 'ChevronLeftIcon'} size={16} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => setStep(step + 1)}
            >
              Continue
              <Icon name="ChevronRightIcon" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? (
                <>
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Icon name="PaperAirplaneIcon" size={16} />
                  Publish Notice
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}