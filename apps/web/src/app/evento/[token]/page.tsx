"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { api } from "@/lib/api";

type EventoLink = {
  id: string;
  eventId: string;
  token: string;
  permiteAcompanantes: boolean;
  maxAcompanantes: number;
  requiereDni: boolean;
  usosPorPersona: number;
  habilitado: boolean;
  event: {
    nombre: string;
    descripcion: string | null;
    fechaEvento: string;
  };
};

type EventoSolicitud = {
  id: string;
  token: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  acompanantes: number;
  estado: "pendiente" | "aceptada" | "rechazada";
  qrCode: string;
  usosPermitidos: number;
  usosActuales: number;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

type Props = {
  params: Promise<{ token: string }>;
};

const STORAGE_KEY_PREFIX = "evento-solicitud-";

export default function EventoPublicoPage({ params }: Props) {
  const router = useRouter();
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkData, setLinkData] = useState<EventoLink | null>(null);
  const [solicitud, setSolicitud] = useState<EventoSolicitud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [acompanantes, setAcompanantes] = useState("0");
  console.log("token", token);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${token}`;

  const loadSolicitud = async (solicitudToken: string) => {
    try {
      const { solicitud } = await api.events.getSolicitud(solicitudToken);
      setSolicitud(solicitud);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al cargar la solicitud");
    }
  };

  const fetchLink = async () => {
    setLoading(true);
    try {
      const link = await api.events.getLink(token);
      setLinkData(link);
      setError(null);
    } catch (err: any) {
      setError(err.message || "No encontramos este enlace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleContinuarSolicitud = async () => {
    if (!storedToken) return;
    await loadSolicitud(storedToken);
  };

  const handleNuevaSolicitud = () => {
    resetSolicitud();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!linkData?.habilitado) {
      setError("Este link no está disponible en este momento.");
      return;
    }
    if (!nombre.trim()) {
      setError("Ingresá tu nombre completo.");
      return;
    }
    if (linkData.requiereDni && !dni.trim()) {
      setError("El organizador requiere DNI.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { solicitud } = await api.events.createSolicitud({
        eventLinkId: linkData.id,
        nombre: nombre.trim(),
        dni: dni.trim() || undefined,
        telefono: telefono.trim() || undefined,
        acompanantes: parseInt(acompanantes, 10) || 0,
      });
      setSolicitud(solicitud);
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, solicitud.token);
      }
      setStoredToken(solicitud.token);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No pudimos enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusInfo = useMemo(() => {
    if (!solicitud) return null;
    switch (solicitud.estado) {
      case "aceptada":
        return {
          title: "✅ ¡Solicitud aceptada!",
          message: "Descargá tu código QR para usarlo el día del evento. Podés guardarlo como imagen para tenerlo offline.",
          color: "#22c55e",
        };
      case "rechazada":
        return {
          title: "❌ Solicitud rechazada",
          message: "El organizador rechazó esta solicitud. Si creés que es un error, comunicate con la persona que te invitó.",
          color: "#ef4444",
        };
      default:
        return {
          title: "⏳ En revisión",
          message: "Tu pedido está pendiente de aprobación. Volvé a abrir este link para conocer el estado.",
          color: "#eab308",
        };
    }
  }, [solicitud]);

  const descargarQR = () => {
    if (!solicitud || solicitud.estado !== "aceptada") return;
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-canvas canvas") || qrRef.current;
    if (!canvas) return;
    const enlace = document.createElement("a");
    enlace.href = canvas.toDataURL("image/png");
    enlace.download = `QR-${solicitud.qrCode}.png`;
    enlace.click();
  };

  const notificarVecino = async (_eventoId: string, _nombreInvitado: string) => {
    // TODO: implementar notificaciones de eventos via nueva API
  };

  const resetSolicitud = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setStoredToken(null);
    setSolicitud(null);
    setNombre("");
    setDni("");
    setTelefono("");
    setAcompanantes("0");
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>Cargando...</div>
      </div>
    );
  }

  if (!linkData) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Link inválido</h1>
          <p style={styles.text}>{error || "No encontramos este enlace."}</p>
          <button style={styles.secondaryButton} onClick={() => router.push("/")}>
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  const evento = linkData.event;
  const puedeEnviar = !!solicitud;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.eventHeader}>
          <div>
            <p style={styles.badge}>Evento privado</p>
            <h1 style={styles.title}>{evento?.nombre || "Evento"}</h1>
            {evento?.descripcion && <p style={styles.text}>{evento.descripcion}</p>}
          </div>
          {evento?.fechaEvento && (
            <div style={styles.eventDateBox}>
              <p style={styles.eventDateLabel}>Fecha</p>
              <p style={styles.eventDateValue}>{new Date(evento.fechaEvento).toLocaleString("es-AR")}</p>
            </div>
          )}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {storedToken && !solicitud && (
          <div style={styles.savedBox}>
            <p style={styles.savedText}>Encontramos una solicitud previa enviada desde este dispositivo.</p>
            <div style={styles.savedActions}>
              <button style={styles.primaryButton} onClick={handleContinuarSolicitud}>
                Ver estado
              </button>
              <button style={styles.secondaryButton} onClick={handleNuevaSolicitud}>
                Registrar a otra persona
              </button>
            </div>
          </div>
        )}

        {!solicitud && !storedToken && (
          <form style={styles.form} onSubmit={handleSubmit}>
            <h2 style={styles.sectionTitle}>Completá tus datos</h2>
            <label style={styles.label}>
              Nombre completo
              <input
                style={styles.input}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María Pérez"
              />
            </label>
            <label style={styles.label}>
              DNI {linkData.requiereDni ? '*' : '(opcional)'}
              <input
                style={styles.input}
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 12345678"
              />
            </label>
            <label style={styles.label}>
              Teléfono (opcional)
              <input
                style={styles.input}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 11 5555-5555"
              />
            </label>
            {linkData.permiteAcompanantes && (
              <label style={styles.label}>
                Cantidad de acompañantes (máx {linkData.maxAcompanantes})
                <input
                  type="number"
                  min={0}
                  max={linkData.maxAcompanantes}
                  style={styles.input}
                  value={acompanantes}
                  onChange={(e) => setAcompanantes(e.target.value)}
                />
              </label>
            )}
            <button disabled={submitting} style={styles.primaryButton}>
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        )}

        {solicitud && statusInfo && (
          <div style={{ ...styles.statusBox, borderColor: statusInfo.color }}>
            <div style={styles.statusHeader}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>{statusInfo.title}</h2>
              <button style={styles.linkButton} onClick={() => loadSolicitud(solicitud.token)}>Actualizar estado</button>
            </div>
            <p style={styles.text}>{statusInfo.message}</p>

            <div style={styles.summaryBox}>
              <p><strong>Nombre:</strong> {solicitud.nombre}</p>
              {solicitud.dni && <p><strong>DNI:</strong> {solicitud.dni}</p>}
              {solicitud.telefono && <p><strong>Teléfono:</strong> {solicitud.telefono}</p>}
              {solicitud.acompanantes > 0 && <p><strong>Acompañantes:</strong> {solicitud.acompanantes}</p>}
            </div>

            {solicitud.estado === "aceptada" && (
              <div style={styles.qrSection}>
                <div id="qr-canvas">
                  <QRCodeCanvas
                    value={solicitud.qrCode}
                    size={200}
                    bgColor="#0b1120"
                    fgColor="#ffffff"
                    includeMargin
                  />
                </div>
                <button style={styles.primaryButton} onClick={descargarQR}>
                  Descargar QR
                </button>
                <p style={styles.note}>Mostrá este QR en la entrada. Es válido solo el día del evento.</p>
              </div>
            )}

            <button style={styles.secondaryButton} onClick={resetSolicitud}>
              {solicitud.estado === "aceptada" ? 'Registrar a otra persona' : 'Cargar datos nuevamente'}
            </button>
          </div>
        )}

        {solicitud && puedeEnviar && (
          <div style={styles.retryBox}>
            <p style={styles.textSmall}>¿Querés registrar a otra persona con este link?</p>
            <button style={styles.linkButton} onClick={resetSolicitud}>
              Nueva solicitud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #1f2947, #0b1120)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    color: "#f8fafc",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "rgba(15,23,42,0.85)",
    borderRadius: 24,
    padding: 32,
    border: "1px solid rgba(148,163,184,0.2)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
  },
  badge: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  title: {
    fontSize: 28,
    margin: "8px 0",
  },
  text: {
    color: "#cbd5f5",
    lineHeight: 1.5,
  },
  textSmall: {
    color: "#94a3b8",
    fontSize: 14,
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  eventDateBox: {
    background: "rgba(15,23,42,0.6)",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(59,130,246,0.4)",
  },
  eventDateLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 4,
  },
  eventDateValue: {
    fontSize: 16,
    fontWeight: 600,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "#94a3b8",
  },
  input: {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.3)",
    background: "rgba(15,23,42,0.7)",
    color: "#fff",
    padding: "12px 14px",
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "14px 16px",
    background: "linear-gradient(120deg,#e94560,#f97316)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "transparent",
    color: "#e2e8f0",
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#60a5fa",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.4)",
    padding: "12px 16px",
    borderRadius: 12,
    color: "#fecaca",
    marginBottom: 16,
  },
  statusBox: {
    marginTop: 24,
    borderRadius: 16,
    border: "1px solid",
    padding: 20,
    background: "rgba(15,23,42,0.7)",
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  summaryBox: {
    background: "rgba(15,23,42,0.5)",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    border: "1px solid rgba(148,163,184,0.2)",
  },
  qrSection: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  note: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  retryBox: {
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  savedBox: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(94,234,212,0.3)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  savedText: {
    color: "#cbd5f5",
    marginBottom: 12,
  },
  savedActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
};
