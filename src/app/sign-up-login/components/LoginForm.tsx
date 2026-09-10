'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface DemoCredential {
  role: string;
  email: string;
  password: string;
  badge: string;
  badgeColor: string;
}

const demoCredentials: DemoCredential[] = [
  { role: 'Administrator', email: 'admin@meag-aviation.com', password: 'MEAGAdmin#2026', badge: 'Full Control', badgeColor: '#FFB800' },
  { role: 'Dept. Head', email: 'ops.head@meag-aviation.com', password: 'DeptHead#2026', badge: 'Create & Approve', badgeColor: '#0080FF' },
  { role: 'Publisher', email: 'publisher@meag-aviation.com', password: 'Publisher#2026', badge: 'Publish Notices', badgeColor: '#A855F7' },
  { role: 'Airline Mgr', email: 'station.mgr@egyptair.com', password: 'AirMgr#2026', badge: 'Read & Ack', badgeColor: '#00CC60' },
  { role: 'Viewer', email: 'viewer@meag-aviation.com', password: 'Viewer#2026', badge: 'Read Only', badgeColor: '#3A5A78' },
];

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCredential, setActiveCredential] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors }
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', rememberMe: false }
  });

  const autofill = (cred: DemoCredential) => {
    setValue('email', cred.email);
    setValue('password', cred.password);
    setActiveCredential(cred.role);
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Welcome back. Signed in successfully.');
      router.push('/notice-management');
    } catch (err: any) {
      setIsLoading(false);
      setError('email', {
        message: err?.message || 'Invalid credentials — use the demo accounts below to sign in'
      });
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: '#020810',
        backgroundImage: `
          linear-gradient(rgba(255, 184, 0, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 184, 0, 0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }}
    >
      {/* Brand panel — cockpit instrument panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] xl:w-[580px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #040C18 0%, #050E1C 50%, #071020 100%)',
          borderRight: '1px solid rgba(255,184,0,0.1)',
        }}
      >
        {/* Instrument grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,184,0,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,184,0,0.04) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Radial glow */}
        <div
          className="absolute"
          style={{
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(255,184,0,0.05) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Corner brackets */}
        <div className="absolute top-6 left-6 w-8 h-8" style={{ borderTop: '1px solid rgba(255,184,0,0.4)', borderLeft: '1px solid rgba(255,184,0,0.4)' }} />
        <div className="absolute top-6 right-6 w-8 h-8" style={{ borderTop: '1px solid rgba(255,184,0,0.4)', borderRight: '1px solid rgba(255,184,0,0.4)' }} />
        <div className="absolute bottom-6 left-6 w-8 h-8" style={{ borderBottom: '1px solid rgba(255,184,0,0.4)', borderLeft: '1px solid rgba(255,184,0,0.4)' }} />
        <div className="absolute bottom-6 right-6 w-8 h-8" style={{ borderBottom: '1px solid rgba(255,184,0,0.4)', borderRight: '1px solid rgba(255,184,0,0.4)' }} />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.6), transparent)' }} />
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,184,0,0.4), transparent)' }} />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-10">
            <div
              className="relative"
              style={{
                padding: '8px',
                background: 'rgba(255,184,0,0.06)',
                border: '1px solid rgba(255,184,0,0.2)',
                borderRadius: '3px',
                boxShadow: '0 0 20px rgba(255,184,0,0.1)',
              }}
            >
              <AppLogo size={40} />
            </div>
            <div>
              <div
                className="font-black tracking-widest"
                style={{
                  color: 'var(--cockpit-amber)',
                  fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
                  fontSize: '2rem',
                  textShadow: '0 0 20px rgba(255,184,0,0.5), 0 0 40px rgba(255,184,0,0.2)',
                  letterSpacing: '0.2em',
                  lineHeight: 1,
                }}
              >
                MEAG
              </div>
              <p
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.52rem',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginTop: '4px',
                }}
              >
                Middle East Aviation Ground Handling
              </p>
            </div>
          </div>

          {/* System status bar */}
          <div
            className="flex items-center gap-3 px-3 py-2 mb-8"
            style={{
              background: 'rgba(0,255,136,0.04)',
              border: '1px solid rgba(0,255,136,0.1)',
              borderRadius: '2px',
            }}
          >
            <div className="status-dot-green" />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                color: 'var(--cockpit-green)',
                letterSpacing: '0.12em',
                textShadow: '0 0 8px rgba(0,255,136,0.4)',
              }}
            >
              ALL SYSTEMS OPERATIONAL
            </span>
            <div className="flex-1" />
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.5rem',
                color: 'var(--muted-foreground)',
                letterSpacing: '0.06em',
              }}
            >
              v2.6.0
            </span>
          </div>

          {/* Headline */}
          <div className="mb-8">
            <h2
              className="font-bold leading-tight mb-2"
              style={{
                color: 'var(--foreground)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '2rem',
                letterSpacing: '0.04em',
              }}
            >
              Operational
            </h2>
            <h2
              className="font-bold leading-tight mb-4"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '2rem',
                letterSpacing: '0.04em',
                color: 'var(--cockpit-amber)',
                textShadow: '0 0 24px rgba(255,184,0,0.35)',
              }}
            >
              Notices Platform
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: 'var(--secondary-foreground)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '0.9rem',
                letterSpacing: '0.02em',
              }}
            >
              Centralized notice management for airline and airport stakeholders. Mandatory acknowledgement, real-time compliance tracking, and full audit trail for IOSA/ISAGO readiness.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {[
              { icon: 'BoltIcon', label: 'Safety Flash distribution in seconds', sub: 'Email · SMS · WhatsApp · Push', color: '#FF2020' },
              { icon: 'CheckCircleIcon', label: 'Mandatory acknowledgement tracking', sub: 'Per-airline compliance dashboard', color: '#00CC60' },
              { icon: 'ShieldCheckIcon', label: 'Full audit trail', sub: 'IOSA · ISAGO · SMS compliant', color: 'var(--cockpit-amber)' },
              { icon: 'ClockIcon', label: 'Automated escalation', sub: '12h → 24h → 48h escalation chain', color: '#0080FF' },
            ].map((f) => (
              <li key={`feature-${f.icon}`} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `rgba(${f.color === '#FF2020' ? '255,32,32' : f.color === '#00CC60' ? '0,204,96' : f.color === '#0080FF' ? '0,128,255' : '255,184,0'}, 0.08)`,
                    border: `1px solid rgba(${f.color === '#FF2020' ? '255,32,32' : f.color === '#00CC60' ? '0,204,96' : f.color === '#0080FF' ? '0,128,255' : '255,184,0'}, 0.2)`,
                    borderRadius: '2px',
                    color: f.color,
                  }}
                >
                  <Icon name={f.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: 'var(--foreground)',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: '0.85rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {f.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.5rem',
                      color: 'var(--muted-foreground)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {f.sub}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Compliance badges */}
        <div className="relative z-10 flex items-center gap-2 flex-wrap">
          {['IOSA Compliant', 'ISAGO Certified', 'SMS Ready', 'ECAA Approved'].map((badge) => (
            <span
              key={`compliance-${badge}`}
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.5rem',
                padding: '3px 8px',
                background: 'rgba(255,184,0,0.05)',
                border: '1px solid rgba(255,184,0,0.18)',
                borderRadius: '1px',
                color: 'rgba(255,184,0,0.7)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span
              style={{
                color: 'var(--cockpit-amber)',
                fontFamily: "'Orbitron', 'Share Tech Mono', monospace",
                letterSpacing: '0.15em',
                fontSize: '1.4rem',
                fontWeight: 800,
                textShadow: '0 0 12px rgba(255,184,0,0.4)',
              }}
            >
              MEAG
            </span>
          </div>

          {/* Form header */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-1 h-5"
                style={{
                  background: 'linear-gradient(180deg, var(--cockpit-amber) 0%, rgba(255,184,0,0.2) 100%)',
                  borderRadius: '1px',
                  boxShadow: '0 0 6px rgba(255,184,0,0.4)',
                }}
              />
              <h1
                className="text-xl font-bold"
                style={{
                  color: 'var(--foreground)',
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: '1.4rem',
                  letterSpacing: '0.04em',
                }}
              >
                Crew Authentication
              </h1>
            </div>
            <p
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '0.55rem',
                color: 'var(--muted-foreground)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                paddingLeft: '12px',
              }}
            >
              Authorized personnel only · Secure access
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="label-field" htmlFor="email">Work Email Address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input-field"
                placeholder="crew@airline.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' }
                })}
              />
              {errors.email && (
                <p
                  className="mt-1.5 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.55rem',
                    color: 'var(--cockpit-red)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <Icon name="ExclamationCircleIcon" size={11} />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label-field" htmlFor="password">Access Code</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-field pr-10"
                  placeholder="••••••••"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <Icon
                    name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'}
                    size={14}
                    style={{ color: 'var(--muted-foreground)' } as React.CSSProperties}
                  />
                </button>
              </div>
              {errors.password && (
                <p
                  className="mt-1.5 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '0.55rem',
                    color: 'var(--cockpit-red)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <Icon name="ExclamationCircleIcon" size={11} />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                className="w-3.5 h-3.5"
                style={{ accentColor: 'var(--cockpit-amber)' }}
                {...register('rememberMe')}
              />
              <label
                htmlFor="rememberMe"
                className="cursor-pointer"
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.55rem',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Keep session active
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
              style={{ fontSize: '0.75rem', letterSpacing: '0.12em' }}
            >
              {isLoading ? (
                <>
                  <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <Icon name="LockClosedIcon" size={13} />
                  AUTHENTICATE & ENTER
                </>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8">
            <div
              className="flex items-center gap-3 mb-3"
              style={{ borderBottom: '1px solid rgba(255,184,0,0.08)', paddingBottom: '8px' }}
            >
              <div style={{ width: '16px', height: '1px', background: 'rgba(255,184,0,0.3)' }} />
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '0.52rem',
                  color: 'rgba(255,184,0,0.5)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                Demo Access Credentials
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,184,0,0.08)' }} />
            </div>
            <div className="space-y-1.5">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => autofill(cred)}
                  className="w-full flex items-center gap-3 px-3 py-2 transition-all duration-150"
                  style={{
                    background: activeCredential === cred.role
                      ? 'rgba(255,184,0,0.06)'
                      : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${activeCredential === cred.role ? 'rgba(255,184,0,0.2)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '2px',
                    textAlign: 'left',
                    boxShadow: activeCredential === cred.role ? '0 0 8px rgba(255,184,0,0.08)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (activeCredential !== cred.role) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,184,0,0.04)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,184,0,0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCredential !== cred.role) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.04)';
                    }
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: cred.badgeColor, boxShadow: `0 0 4px ${cred.badgeColor}` }}
                  />
                  <span
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: '0.78rem',
                      color: 'var(--foreground)',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      flex: 1,
                    }}
                  >
                    {cred.role}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '0.48rem',
                      padding: '2px 6px',
                      background: `rgba(${cred.badgeColor === '#FFB800' ? '255,184,0' : cred.badgeColor === '#0080FF' ? '0,128,255' : cred.badgeColor === '#00CC60' ? '0,204,96' : '168,85,247'}, 0.08)`,
                      color: cred.badgeColor,
                      border: `1px solid ${cred.badgeColor}30`,
                      borderRadius: '1px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {cred.badge}
                  </span>
                  <Icon
                    name="ArrowRightIcon"
                    size={10}
                    style={{ color: 'var(--muted-foreground)', opacity: 0.5 } as React.CSSProperties}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
