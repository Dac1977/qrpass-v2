import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Share,
  Platform,
  Linking,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { supabase, Evento, EventoLink, EventoSolicitud, InvitadoEvento, Contacto } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { nanoid } from 'nanoid/non-secure';

const EVENT_LINK_BASE_URL = process.env.EXPO_PUBLIC_EVENT_LINK_BASE_URL || 'https://barrios.app/evento';

export function DetalleEventoScreen() {
  const route = useRoute<any>();
  const { eventoId } = route.params;
  const [evento, setEvento] = useState<Evento | null>(null);
  const [invitados, setInvitados] = useState<InvitadoEvento[]>([]);
  const [showAgregar, setShowAgregar] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [link, setLink] = useState<EventoLink | null>(null);
  const [solicitudes, setSolicitudes] = useState<EventoSolicitud[]>([]);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState(false);
  const [permiteAcompanantes, setPermiteAcompanantes] = useState(false);
  const [maxAcompanantes, setMaxAcompanantes] = useState('0');
  const [requiereDni, setRequiereDni] = useState(true);
  const [usosPorPersona, setUsosPorPersona] = useState('1');
  const [showContactos, setShowContactos] = useState(false);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [guardandoContactos, setGuardandoContactos] = useState(false);
  const { profile } = useAuthStore();

  const fetchEvento = async () => {
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .eq('id', eventoId)
      .single();
    if (data) setEvento(data);
  };

  const fetchInvitados = async () => {
    const { data } = await supabase
      .from('invitados_evento')
      .select('*')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: true });
    if (data) setInvitados(data);
  };

  const fetchLink = async () => {
    setLoadingLink(true);
    const { data } = await supabase
      .from('evento_links')
      .select('*')
      .eq('evento_id', eventoId)
      .maybeSingle();
    if (data) {
      setLink(data);
      setPermiteAcompanantes(data.permite_acompanantes);
      setMaxAcompanantes(String(data.max_acompanantes));
      setRequiereDni(data.requiere_dni);
      setUsosPorPersona(String(data.usos_por_persona));
    } else {
      setLink(null);
    }
    setLoadingLink(false);
  };

  const fetchSolicitudes = async () => {
    setLoadingSolicitudes(true);
    const { data } = await supabase
      .from('evento_solicitudes')
      .select('*')
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false });
    if (data) setSolicitudes(data as EventoSolicitud[]);
    setLoadingSolicitudes(false);
  };

  useEffect(() => {
    fetchEvento();
    fetchInvitados();
    fetchLink();
    fetchSolicitudes();
  }, [eventoId]);

  const fetchContactos = async () => {
    if (!profile?.id) return;
    setContactosLoading(true);
    const { data } = await supabase
      .from('contactos')
      .select('*')
      .eq('vecino_id', profile.id)
      .order('nombre');
    if (data) setContactos(data);
    setContactosLoading(false);
  };

  const abrirContactos = () => {
    fetchContactos();
    // Pre-select contacts that are already invited
    const dniSet = new Set(invitados.map(i => i.dni));
    const ids = new Set<string>();
    // Don't pre-select any — let the user pick fresh
    setSelectedContactIds(ids);
    setShowContactos(true);
  };

  const toggleContacto = (contacto: Contacto) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contacto.id)) {
        next.delete(contacto.id);
      } else {
        next.add(contacto.id);
      }
      return next;
    });
  };

  const confirmarContactos = async () => {
    const seleccionados = contactos.filter(c => selectedContactIds.has(c.id));
    if (seleccionados.length === 0) {
      setShowContactos(false);
      return;
    }
    // Filter out contacts already invited (by DNI)
    const dniExistentes = new Set(invitados.map(i => i.dni));
    const nuevos = seleccionados.filter(c => !c.dni || !dniExistentes.has(c.dni));
    if (nuevos.length === 0) {
      Alert.alert('Info', 'Todos los contactos seleccionados ya están invitados.');
      setShowContactos(false);
      return;
    }
    setGuardandoContactos(true);
    try {
      const rows = nuevos.map(c => ({
        evento_id: eventoId,
        nombre: c.nombre,
        dni: c.dni || '',
        qr_code: `EVT-${nanoid(20)}`,
        tipo: 'contacto' as const,
      }));
      const { error } = await supabase.from('invitados_evento').insert(rows);
      if (error) throw error;
      setShowContactos(false);
      fetchInvitados();
      Alert.alert('Listo', `Se agregaron ${nuevos.length} invitado${nuevos.length !== 1 ? 's' : ''} desde contactos.`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardandoContactos(false);
    }
  };

  const agregarInvitado = async () => {
    if (!nuevoNombre.trim() || !nuevoDni.trim()) {
      Alert.alert('Error', 'Completá nombre y DNI');
      return;
    }
    if (invitados.some((i) => i.dni === nuevoDni.trim())) {
      Alert.alert('Error', 'Ya existe un invitado con ese DNI');
      return;
    }

    setGuardando(true);
    try {
      const { error } = await supabase.from('invitados_evento').insert({
        evento_id: eventoId,
        nombre: nuevoNombre.trim(),
        dni: nuevoDni.trim(),
        qr_code: `EVT-${nanoid(20)}`,
      });

      if (error) throw error;

      setNuevoNombre('');
      setNuevoDni('');
      setShowAgregar(false);
      fetchInvitados();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarInvitado = (inv: InvitadoEvento) => {
    Alert.alert('Eliminar invitado', `¿Eliminar a ${inv.nombre}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('invitados_evento').delete().eq('id', inv.id);
          fetchInvitados();
        },
      },
    ]);
  };

  const compartirQR = async (inv: InvitadoEvento) => {
    const mensaje = `🎉 ¡Estás invitado!\n\n` +
      `📋 Evento: ${evento?.nombre}\n` +
      `📅 Fecha: ${formatFecha(evento?.fecha_evento || '')}\n` +
      `👤 Invitado: ${inv.nombre}\n` +
      `🆔 DNI: ${inv.dni}\n\n` +
      `🔑 Tu código QR de acceso:\n${inv.qr_code}\n\n` +
      `Mostrá este código en la guardia del barrio para ingresar.`;

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(mensaje);
        Alert.alert('Copiado', 'Mensaje copiado al portapapeles');
      } catch {
        Alert.alert('Compartir', mensaje);
      }
    } else {
      try {
        await Share.share({ message: mensaje });
      } catch {}
    }
  };

  const compartirPorWhatsApp = async (inv: InvitadoEvento) => {
    const mensaje = encodeURIComponent(
      `🎉 ¡Estás invitado!\n\n` +
      `📋 Evento: ${evento?.nombre}\n` +
      `📅 Fecha: ${formatFecha(evento?.fecha_evento || '')}\n` +
      `👤 Invitado: ${inv.nombre}\n` +
      `🆔 DNI: ${inv.dni}\n\n` +
      `🔑 Tu código QR de acceso:\n${inv.qr_code}\n\n` +
      `Mostrá este código en la guardia del barrio para ingresar.`
    );

    const url = `whatsapp://send?text=${mensaje}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'No se pudo abrir WhatsApp');
    }
  };

  const generarLink = async () => {
    if (!evento?.id) return;
    const usos = parseInt(usosPorPersona, 10);
    const acompanantes = parseInt(maxAcompanantes, 10);
    setGenerandoLink(true);
    try {
      const { data, error } = await supabase.rpc('generar_evento_link', {
        p_evento_id: evento.id,
        p_permite_acompanantes: permiteAcompanantes,
        p_max_acompanantes: isNaN(acompanantes) ? 0 : acompanantes,
        p_requiere_dni: requiereDni,
        p_usos_por_persona: isNaN(usos) ? 1 : Math.max(1, usos),
      });
      if (error) throw error;
      setLink(data as EventoLink);
      setConfigModal(false);
      Alert.alert('Link actualizado', 'Compartí el enlace con tus invitados.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo generar el link');
    } finally {
      setGenerandoLink(false);
    }
  };

  const shareLink = async () => {
    if (!link) return;
    const url = `${EVENT_LINK_BASE_URL}/${link.token}`;
    try {
      await Share.share({ message: `Completá tus datos para el evento: ${url}` });
    } catch {}
  };

  const toggleLink = async (habilitado: boolean) => {
    if (!link) return;
    setLoadingLink(true);
    await supabase
      .from('evento_links')
      .update({ habilitado, updated_at: new Date().toISOString() })
      .eq('id', link.id);
    await fetchLink();
  };

  const resolverSolicitud = async (solicitud: EventoSolicitud, estado: 'aceptada' | 'rechazada') => {
    setResolviendo(solicitud.id);
    try {
      const { error } = await supabase.rpc('resolver_evento_solicitud', {
        p_solicitud_id: solicitud.id,
        p_estado: estado,
        p_usos_permitidos: solicitud.usos_permitidos,
      });
      if (error) throw error;
      await Promise.all([fetchSolicitudes(), fetchInvitados()]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la solicitud');
    } finally {
      setResolviendo(null);
    }
  };

  const linkUrl = useMemo(() => (link ? `${EVENT_LINK_BASE_URL}/${link.token}` : ''), [link]);

  const formatFecha = (fecha: string) => {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderInvitado = ({ item }: { item: InvitadoEvento }) => (
    <View style={styles.invitadoCard}>
      <View style={styles.invitadoInfo}>
        <View style={styles.invitadoHeader}>
          <Text style={styles.invNombre} numberOfLines={1}>{item.nombre}</Text>
          {item.usado ? (
            <View style={[styles.estadoBadge, { backgroundColor: '#22c55e' }]}>
              <Text style={styles.estadoText}>✓ Ingresó</Text>
            </View>
          ) : (
            <View style={[styles.estadoBadge, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.estadoText}>Pendiente</Text>
            </View>
          )}
        </View>
        <Text style={styles.invDni}>DNI: {item.dni}</Text>
        {item.fecha_uso && (
          <Text style={styles.invFechaUso}>
            Ingresó: {new Date(item.fecha_uso).toLocaleString('es-AR')}
          </Text>
        )}
      </View>

      <View style={styles.invitadoActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
          onPress={() => compartirPorWhatsApp(item)}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
          onPress={() => compartirQR(item)}
        >
          <Ionicons name="share-outline" size={18} color="#fff" />
        </TouchableOpacity>
        {!item.usado && evento?.activo && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
            onPress={() => eliminarInvitado(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderSolicitud = ({ item }: { item: EventoSolicitud }) => (
    <View style={styles.solicitudCard}>
      <View style={styles.solicitudHeader}>
        <Text style={styles.solicitudNombre} numberOfLines={1}>{item.nombre}</Text>
        <View
          style={[styles.estadoBadge, {
            backgroundColor:
              item.estado === 'aceptada'
                ? '#22c55e'
                : item.estado === 'rechazada'
                  ? '#ef4444'
                  : '#eab308',
          }]}
        >
          <Text style={styles.estadoText}>{item.estado}</Text>
        </View>
      </View>
      {item.dni && <Text style={styles.solicitudDato}>DNI: {item.dni}</Text>}
      {item.telefono && <Text style={styles.solicitudDato}>Tel: {item.telefono}</Text>}
      {item.acompanantes > 0 && (
        <Text style={styles.solicitudDato}>Acompañantes: {item.acompanantes}</Text>
      )}
      <Text style={styles.solicitudQr}>QR: {item.qr_code}</Text>
      {item.estado === 'pendiente' && (
        <View style={styles.solicitudActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#22c55e', flex: 1 }]}
            onPress={() => resolverSolicitud(item, 'aceptada')}
            disabled={resolviendo === item.id}
          >
            {resolviendo === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Aceptar</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ef4444', flex: 1 }]}
            onPress={() => resolverSolicitud(item, 'rechazada')}
            disabled={resolviendo === item.id}
          >
            {resolviendo === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Rechazar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!evento) return null;

  const usados = invitados.filter((i) => i.usado).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={invitados}
        keyExtractor={(item) => item.id}
        renderItem={renderInvitado}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.eventoInfo}>
              <Text style={styles.eventoNombre}>{evento.nombre}</Text>
              <Text style={styles.eventoFecha}>📅 {formatFecha(evento.fecha_evento)}</Text>
              {evento.descripcion && <Text style={styles.eventoDesc}>{evento.descripcion}</Text>}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{invitados.length}</Text>
                  <Text style={styles.statLabel}>Invitados</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: '#22c55e' }]}>{usados}</Text>
                  <Text style={styles.statLabel}>Ingresaron</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: '#3b82f6' }]}>{invitados.length - usados}</Text>
                  <Text style={styles.statLabel}>Pendientes</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🔗 Link público</Text>
                {loadingLink && <ActivityIndicator color="#e94560" />}
              </View>
              {link ? (
                <>
                  <Text style={styles.linkText}>{linkUrl}</Text>
                  <View style={styles.linkBadges}>
                    <Text style={styles.linkBadge}>Usos/persona: {link.usos_por_persona}</Text>
                    <Text style={styles.linkBadge}>
                      Acompañantes: {link.permite_acompanantes ? link.max_acompanantes : 0}
                    </Text>
                    <Text style={styles.linkBadge}>Requiere DNI: {link.requiere_dni ? 'Sí' : 'No'}</Text>
                  </View>
                  <View style={styles.linkActions}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={shareLink}>
                      <Ionicons name="share-social" size={18} color="#e94560" />
                      <Text style={styles.secondaryBtnText}>Compartir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setConfigModal(true)}>
                      <Ionicons name="settings-outline" size={18} color="#e94560" />
                      <Text style={styles.secondaryBtnText}>Configurar</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: link.habilitado ? '#ef4444' : '#22c55e' }]}
                    onPress={() => toggleLink(!link.habilitado)}
                  >
                    <Text style={styles.toggleBtnText}>
                      {link.habilitado ? 'Deshabilitar link' : 'Habilitar link'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setConfigModal(true)}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Generar link público</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📨 Solicitudes ({solicitudes.length})</Text>
                <TouchableOpacity onPress={fetchSolicitudes}>
                  <Ionicons name="refresh" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {loadingSolicitudes ? (
                <ActivityIndicator color="#e94560" style={{ marginVertical: 12 }} />
              ) : solicitudes.length === 0 ? (
                <Text style={styles.emptyText}>Aún no hay solicitudes cargadas.</Text>
              ) : (
                <FlatList
                  data={solicitudes}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSolicitud}
                  scrollEnabled={false}
                />
              )}
            </View>

            {evento.activo && (
              <View style={styles.agregarRow}>
                <TouchableOpacity style={[styles.agregarBtn, { flex: 1 }]} onPress={() => setShowAgregar(true)}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.agregarBtnText}>Manual</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.agregarBtn, { flex: 1, backgroundColor: '#1e40af' }]} onPress={abrirContactos}>
                  <Ionicons name="people" size={18} color="#fff" />
                  <Text style={styles.agregarBtnText}>Desde contactos</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay invitados aún</Text>
        }
      />

      {/* Modal agregar invitado */}
      <Modal visible={showAgregar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar invitado</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor="#64748b"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              autoFocus
            />

            <Text style={styles.label}>DNI *</Text>
            <TextInput
              style={styles.input}
              placeholder="Número de DNI"
              placeholderTextColor="#64748b"
              value={nuevoDni}
              onChangeText={setNuevoDni}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.guardarBtn, guardando && { opacity: 0.5 }]}
              onPress={agregarInvitado}
              disabled={guardando}
            >
              <Text style={styles.guardarBtnText}>
                {guardando ? 'Guardando...' : 'Agregar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelarBtn}
              onPress={() => {
                setShowAgregar(false);
                setNuevoNombre('');
                setNuevoDni('');
              }}
            >
              <Text style={styles.cancelarBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal seleccionar contactos */}
      <Modal visible={showContactos} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar contactos</Text>
            {contactosLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 24 }} />
            ) : contactos.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ color: '#94a3b8', fontSize: 15 }}>No tenés contactos guardados</Text>
              </View>
            ) : (
              <FlatList
                data={contactos}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => {
                  const selected = selectedContactIds.has(item.id);
                  const yaInvitado = item.dni ? invitados.some(i => i.dni === item.dni) : false;
                  return (
                    <TouchableOpacity
                      style={[styles.contactoRow, selected && styles.contactoRowSelected, yaInvitado && { opacity: 0.4 }]}
                      onPress={() => !yaInvitado && toggleContacto(item)}
                      disabled={yaInvitado}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactoNombreText}>{item.nombre}</Text>
                        <Text style={styles.contactoDetalleText}>
                          {yaInvitado ? 'Ya invitado' : [item.dni && `DNI: ${item.dni}`, item.telefono].filter(Boolean).join(' • ') || 'Sin datos'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#334155', flex: 1 }]}
                onPress={() => setShowContactos(false)}
              >
                <Text style={styles.modalActionBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#3b82f6', flex: 1 }]}
                onPress={confirmarContactos}
                disabled={guardandoContactos}
              >
                <Text style={styles.modalActionBtnText}>
                  {guardandoContactos ? 'Agregando...' : `Agregar (${selectedContactIds.size})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal configuración link */}
      <Modal visible={configModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar link</Text>

            <View style={styles.configRow}>
              <Text style={styles.label}>Permitir acompañantes</Text>
              <Switch value={permiteAcompanantes} onValueChange={setPermiteAcompanantes} />
            </View>

            {permiteAcompanantes && (
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={maxAcompanantes}
                onChangeText={setMaxAcompanantes}
                placeholder="Máx. acompañantes"
                placeholderTextColor="#64748b"
              />
            )}

            <View style={styles.configRow}>
              <Text style={styles.label}>Requiere DNI</Text>
              <Switch value={requiereDni} onValueChange={setRequiereDni} />
            </View>

            <Text style={styles.label}>Usos por persona</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={usosPorPersona}
              onChangeText={setUsosPorPersona}
              placeholder="1"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity
              style={[styles.guardarBtn, generandoLink && { opacity: 0.5 }]}
              onPress={generarLink}
              disabled={generandoLink}
            >
              <Text style={styles.guardarBtnText}>
                {generandoLink ? 'Guardando...' : 'Guardar configuración'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelarBtn} onPress={() => setConfigModal(false)}>
              <Text style={styles.cancelarBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  eventoInfo: {
    backgroundColor: '#16213e',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  eventoNombre: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  eventoFecha: { fontSize: 15, color: '#94a3b8', marginTop: 6 },
  eventoDesc: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  agregarRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  agregarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  agregarBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionCard: {
    backgroundColor: '#16213e',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  linkText: { color: '#fff', fontSize: 14, marginBottom: 8 },
  linkBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  linkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    color: '#94a3b8',
    fontSize: 12,
  },
  linkActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 10,
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: '#e94560', fontWeight: '600' },
  toggleBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleBtnText: { color: '#fff', fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  solicitudCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 10,
  },
  solicitudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  solicitudNombre: { color: '#fff', fontSize: 15, fontWeight: '600' },
  solicitudDato: { color: '#94a3b8', marginTop: 4, fontSize: 13 },
  solicitudQr: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
  solicitudActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionText: { color: '#fff', fontWeight: '600' },
  invitadoCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  invitadoInfo: { marginBottom: 10 },
  invitadoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invNombre: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
  estadoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  estadoText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  invDni: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  invFechaUso: { fontSize: 12, color: '#22c55e', marginTop: 4 },
  invitadoActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    paddingTop: 10,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  guardarBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  guardarBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelarBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelarBtnText: { color: '#94a3b8', fontSize: 15 },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  contactoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  contactoRowSelected: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  contactoNombreText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  contactoDetalleText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalActionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalActionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
