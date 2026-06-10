'use client';
import React, { useEffect } from 'react';
import { getToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { AgenteVentas } from '@/components/AgenteVentas';

export default function LandingPage() {
  const router = useRouter();
  useEffect(() => {
    if (getToken()) router.push('/admin');
  }, [router]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      <Nav router={router} scrollTo={scrollTo} />
      <Hero router={router} scrollTo={scrollTo} />
      <Features />
      <Roles />
      <CTA router={router} />
      <Footer />
      <AgenteVentas />
    </div>
  );
}

function Nav({ router, scrollTo }: any) {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e3a5f', padding: '0 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/logos/qrpasssintextotransparente.png" alt="QRPass" style={{ height: 38, width: 38, objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>QRPass</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <button onClick={() => scrollTo('features')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 15, fontWeight: 500 }}>Funcionalidades</button>
          <button onClick={() => scrollTo('roles')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 15, fontWeight: 500 }}>Roles</button>
          <button onClick={() => router.push('/onboarding')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Registrá tu organización</button>
          <button onClick={() => router.push('/admin')} style={{ background: '#e94560', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Iniciar Sesión</button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ router, scrollTo }: any) {
  const tipos = ['barrio cerrado', 'club deportivo', 'gimnasio', 'coworking', 'evento privado', 'country'];
  const [tipoIdx, setTipoIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTipoIdx((i) => (i + 1) % tipos.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 300 }}>
        <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 800, lineHeight: 1.15, color: '#f1f5f9' }}>
          La plataforma para gestionar<br />
          <span style={{ color: '#e94560', display: 'inline-block', minWidth: 320 }}>tu {tipos[tipoIdx]}</span>
        </h1>
        <p style={{ fontSize: 18, color: '#94a3b8', marginTop: 20, lineHeight: 1.6, maxWidth: 500 }}>
          Controlá accesos, gestioná miembros, cobrá cuotas y comunicarte con tu comunidad. Todo desde un mismo lugar, para cualquier tipo de organización.
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/onboarding')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 32px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Registrá tu organización</button>
          <button onClick={() => scrollTo('features')} style={{ background: 'transparent', color: '#94a3b8', border: '2px solid #1e3a5f', borderRadius: 12, padding: '14px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>Conocer más ↓</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
          {['🏘️ Barrios', '🏋️ Gimnasios', '⛳ Clubes', '🎪 Eventos', '💼 Coworking'].map((tag) => (
            <span key={tag} style={{ fontSize: 12, color: '#64748b', background: '#1e293b', borderRadius: 20, padding: '4px 12px', fontWeight: 500 }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 280, display: 'flex', justifyContent: 'center' }}>
        <MockupCard />
      </div>
    </section>
  );
}

function MockupCard() {
  const stats = [{ n: '124', l: 'Miembros', c: '#3b82f6' }, { n: '47', l: 'Ingresos', c: '#22c55e' }, { n: '12', l: 'Reservas', c: '#8b5cf6' }];
  const items = [
    { dot: '#22c55e', t: 'Nuevo miembro aprobado' },
    { dot: '#3b82f6', t: 'Cuota del mes publicada' },
    { dot: '#f59e0b', t: 'Reclamo respondido' },
  ];
  return (
    <div style={{ background: '#1a1a2e', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', width: '100%', maxWidth: 360, border: '1px solid #0f3460' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />)}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flex: 1, background: '#16213e', borderRadius: 12, padding: 10, textAlign: 'center', border: '1px solid #0f3460' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.n}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.l}</div>
          </div>
        ))}
      </div>
      {items.map((x, i) => (
        <div key={i} style={{ background: '#16213e', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 13, color: '#94a3b8', border: '1px solid #0f3460', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.dot, flexShrink: 0 }} />
          {x.t}
        </div>
      ))}
    </div>
  );
}

function Ico({d,c}:{d:string;c:string}) {
  return <div style={{width:44,height:44,borderRadius:12,backgroundColor:c+'14',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg></div>;
}

function Features() {
  const f = [
    { c:'#e94560', title:'Control de Acceso', desc:'QR digital, validación en tiempo real y registro de ingresos.', d:'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { c:'#22c55e', title:'Expensas Online', desc:'Pagos por MercadoPago o transferencia con seguimiento.', d:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { c:'#8b5cf6', title:'Encuestas', desc:'Votaciones para decisiones comunitarias.', d:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm6 0V9a2 2 0 00-2-2h-2a2 2 0 00-2 2v10m10 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14' },
    { c:'#3b82f6', title:'Amenities', desc:'Reservas de SUM, piscina y quincho por turnos.', d:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { c:'#f59e0b', title:'Cartelera', desc:'Avisos y noticias en tiempo real.', d:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { c:'#06b6d4', title:'Eventos', desc:'Invitaciones individuales o link público.', d:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { c:'#ef4444', title:'Reclamos', desc:'Sistema de reclamos con respuesta directa.', d:'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { c:'#10b981', title:'Delivery', desc:'Códigos temporales para autorizar deliveries.', d:'M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h10zm0 0h4l3 3V11h-7z' },
  ];
  return (
    <section id="features" style={{ padding: '80px 24px', backgroundColor: '#1a1a2e' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>Todo lo que tu organización necesita</h2>
        <p style={{ color: '#64748b', fontSize: 18, marginTop: 12, marginBottom: 48 }}>Plataforma completa para barrios, clubes, gimnasios, eventos y más.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
          {f.map((x, i) => (
            <div key={i} style={{ background: '#16213e', borderRadius: 16, padding: 24, textAlign: 'left', border: '1px solid #0f3460' }}>
              <Ico d={x.d} c={x.c} />
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginTop: 14 }}>{x.title}</h3>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>{x.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const r = [
    { d:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', title: 'Miembro', color: '#3b82f6', items: ['Invitaciones QR', 'Eventos', 'Cuotas y pagos', 'Reservas', 'Encuestas', 'Reclamos'] },
    { d:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', title: 'Control de Acceso', color: '#f59e0b', items: ['Escanear QR', 'Validar visitantes', 'Registrar ingresos', 'Historial en tiempo real'] },
    { d:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', title: 'Administrador', color: '#e94560', items: ['Panel de gestión', 'Aprobar miembros', 'Cuotas y pagos', 'Reservas de espacios', 'Reclamos', 'Estadísticas'] },
  ];
  return (
    <section id="roles" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>Un rol para cada persona</h2>
        <p style={{ color: '#64748b', fontSize: 18, marginTop: 12, marginBottom: 48 }}>Cada integrante de tu organización tiene su experiencia optimizada.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {r.map((x, i) => (
            <div key={i} style={{ background: '#16213e', borderRadius: 16, padding: 28, textAlign: 'left', border: '1px solid #0f3460', borderTop: `3px solid ${x.color}` }}>
              <Ico d={x.d} c={x.color} />
              <h3 style={{ fontSize: 22, fontWeight: 700, marginTop: 14, color: '#f1f5f9' }}>{x.title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                {x.items.map((it, j) => <li key={j} style={{ fontSize: 14, color: '#94a3b8', padding: '5px 0', display: 'flex', gap: 8 }}><span style={{ color: x.color, fontWeight: 700 }}>✓</span>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({ router }: any) {
  return (
    <section id="cta" style={{ padding: '80px 24px', background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>Empezá hoy, gratis</h2>
        <p style={{ color: '#94a3b8', fontSize: 18, marginTop: 16, lineHeight: 1.6 }}>Creá tu organización en minutos, invitá a tus miembros con un link y empezá a gestionar.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/onboarding')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 12, padding: '16px 40px', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Registrá tu organización</button>
          <button onClick={() => router.push('/admin')} style={{ background: 'transparent', color: '#94a3b8', border: '2px solid #0f3460', borderRadius: 12, padding: '16px 40px', fontWeight: 600, fontSize: 17, cursor: 'pointer' }}>Ya tengo cuenta</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '32px 24px', backgroundColor: '#0a0f1e', borderTop: '1px solid #1e3a5f', textAlign: 'center' }}>
      <p style={{ color: '#475569', fontSize: 14 }}>© {new Date().getFullYear()} QRPass. Todos los derechos reservados.</p>
    </footer>
  );
}
