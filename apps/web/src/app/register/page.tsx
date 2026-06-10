'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { api, saveToken, saveUser } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [step, setStep] = useState<'codigo' | 'registro'>('codigo');
  const [codigoInvitacion, setCodigoInvitacion] = useState(() => searchParams.get('codigo') ?? '');
  const [barrioInfo, setBarrioInfo] = useState<{ id: string; nombre: string } | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    numero_casa: '',
    telefono: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const doValidarCodigo = async (codigo: string) => {
    setLoading(true);
    setError(null);
    try {
      const { space } = await api.spaces.byCode(codigo.toUpperCase());
      setBarrioInfo({ id: space.id, nombre: space.nombre });
      setStep('registro');
    } catch {
      setError('Código de invitación inválido o inactivo');
    }
    setLoading(false);
  };

  useEffect(() => {
    const codigoParam = searchParams.get('codigo');
    if (codigoParam) doValidarCodigo(codigoParam.toUpperCase());
  }, []);

  const validarCodigo = async (event: FormEvent) => {
    event.preventDefault();
    await doValidarCodigo(codigoInvitacion);
  };

  const registrarVecino = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    try {
      const { token, user } = await api.auth.register({
        email: formData.email,
        password: formData.password,
        nombre: formData.nombre,
        telefono: formData.telefono || undefined,
        codigoInvitacion: codigoInvitacion,
        numeroUnidad: formData.numero_casa || undefined,
      });
      saveToken(token);
      saveUser(user);
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al registrarse');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>✅ Registro Completado</h1>
          <p style={styles.subtitle}>
            Tu solicitud ha sido enviada al administrador del barrio "{barrioInfo?.nombre}".
          </p>
          <p style={styles.message}>
            Una vez que tus datos sean verificados y aprobados, recibirás un email de confirmación
            y podrás acceder al sistema.
          </p>
          <button style={styles.button} onClick={() => router.push('/')}>
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          {step === 'codigo' ? '🏘️ Registro de Vecino' : '📝 Completa tus Datos'}
        </h1>
        <p style={styles.subtitle}>
          {step === 'codigo' 
            ? 'Ingresa el código de invitación de tu barrio'
            : `Te estás registrando en: ${barrioInfo?.nombre}`
          }
        </p>

        {step === 'codigo' ? (
          <form style={styles.form} onSubmit={validarCodigo}>
            <label style={styles.label}>
              Código de Invitación
              <input
                style={styles.input}
                type="text"
                value={codigoInvitacion}
                onChange={(e) => setCodigoInvitacion(e.target.value.toUpperCase())}
                placeholder="Ej: ABC12345"
                required
                maxLength={8}
              />
            </label>

            {error && <p style={styles.error}>{error}</p>}

            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Validando...' : 'Validar Código'}
            </button>
          </form>
        ) : (
          <form style={styles.form} onSubmit={registrarVecino}>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Email
                <input
                  style={styles.input}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </label>

              <label style={styles.label}>
                Contraseña
                <input
                  style={styles.input}
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                />
              </label>

              <label style={styles.label}>
                Confirmar Contraseña
                <input
                  style={styles.input}
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  minLength={6}
                />
              </label>

              <label style={styles.label}>
                Nombre Completo
                <input
                  style={styles.input}
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                />
              </label>

              <label style={styles.label}>
                Número de Casa
                <input
                  style={styles.input}
                  type="text"
                  value={formData.numero_casa}
                  onChange={(e) => setFormData({...formData, numero_casa: e.target.value})}
                  placeholder="Ej: 12A"
                />
              </label>

              <label style={styles.label}>
                Teléfono (opcional)
                <input
                  style={styles.input}
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                  placeholder="Ej: 11 1234-5678"
                />
              </label>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttonGroup}>
              <button 
                style={styles.secondaryButton} 
                type="button" 
                onClick={() => {
                  setStep('codigo');
                  setCodigoInvitacion('');
                  setBarrioInfo(null);
                }}
              >
                Volver
              </button>
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
            </div>
          </form>
        )}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            ¿Ya tienes cuenta? <a href="/" style={styles.link}>Inicia sesión</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#0b1020' }} />}>
      <RegisterForm />
    </Suspense>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0b1020',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: 24,
    padding: '40px',
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 1.6,
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 500,
    minWidth: 0,
  },
  input: {
    borderRadius: 12,
    border: '1px solid #0f3460',
    padding: '12px 16px',
    background: '#0b1534',
    color: '#fff',
    fontSize: 16,
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
    width: '100%',
  },
  button: {
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(120deg, #10b981, #34d399)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 16,
    padding: '14px 24px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  secondaryButton: {
    borderRadius: 14,
    border: '1px solid #0f3460',
    background: 'transparent',
    color: '#94a3b8',
    fontWeight: 600,
    fontSize: 16,
    padding: '14px 24px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  buttonGroup: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
    borderRadius: 8,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: '1px solid #0f3460',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  link: {
    color: '#10b981',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
