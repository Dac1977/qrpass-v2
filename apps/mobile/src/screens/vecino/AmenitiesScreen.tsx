import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { supabase, Amenity, Reserva } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function AmenitiesScreen() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [misReservas, setMisReservas] = useState<(Reserva & { amenity_nombre?: string })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showReservar, setShowReservar] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [fechaDate, setFechaDate] = useState<Date | null>(null);
  const [horaInicioDate, setHoraInicioDate] = useState<Date | null>(null);
  const [horaFinDate, setHoraFinDate] = useState<Date | null>(null);
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [showHoraInicioPicker, setShowHoraInicioPicker] = useState(false);
  const [showHoraFinPicker, setShowHoraFinPicker] = useState(false);
  const [notas, setNotas] = useState('');
  const [fechaISOSeleccionada, setFechaISOSeleccionada] = useState<string | null>(null);
  const [turnoSeleccionadoId, setTurnoSeleccionadoId] = useState<string | null>(null);
  const [reservasTurnoDia, setReservasTurnoDia] = useState<Reserva[]>([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tab, setTab] = useState<'amenities' | 'reservas'>('amenities');
  const [showDisponibilidad, setShowDisponibilidad] = useState(false);
  const [amenityDisponibilidad, setAmenityDisponibilidad] = useState<Amenity | null>(null);
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [reservasCalendario, setReservasCalendario] = useState<Record<string, Reserva[]>>({});
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const { profile } = useAuthStore();

  const fetchAmenities = async () => {
    if (!profile?.barrio_id) return;
    const { data } = await supabase
      .from('amenities')
      .select('*')
      .eq('barrio_id', profile.barrio_id)
      .eq('activo', true)
      .order('nombre');
    if (data) setAmenities(data);
  };

  const fetchMisReservas = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('reservas')
      .select('*, amenities(nombre)')
      .eq('vecino_id', profile.id)
      .order('fecha', { ascending: false })
      .limit(30);
    if (data) {
      setMisReservas(
        data.map((r: any) => ({
          ...r,
          amenity_nombre: r.amenities?.nombre,
        }))
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAmenities();
      fetchMisReservas();
    }, [profile?.barrio_id, profile?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAmenities(), fetchMisReservas()]);
    setRefreshing(false);
  };

  const formatFechaKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const normalizarHora = (hora: string) => hora.slice(0, 5);
  const buildDateWithTime = (base: Date, time: string) => {
    const [h, m] = normalizarHora(time).split(':');
    const nueva = new Date(base);
    nueva.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return nueva;
  };

  const obtenerDiasMes = (mesBase: Date) => {
    const year = mesBase.getFullYear();
    const month = mesBase.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    // Fill leading blanks
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(new Date(year, month, -firstDay.getDay() + i + 1));
    }
    // Fill actual month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    // Fill trailing blanks to complete weeks (42 cells)
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }
    return days;
  };

  const diasCalendario = useMemo(() => obtenerDiasMes(mesVisible), [mesVisible]);

  const abrirDisponibilidad = async (amenity: Amenity) => {
    setAmenityDisponibilidad(amenity);
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    setMesVisible(inicioMes);
    setDiaSeleccionado(hoy);
    setShowDisponibilidad(true);
    await cargarReservasMes(amenity.id, inicioMes);
  };

  const cargarReservasMes = async (amenityId: string, mesBase: Date) => {
    setLoadingDisponibilidad(true);
    const inicio = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1);
    const fin = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0);
    const { data } = await supabase
      .from('reservas')
      .select('*')
      .eq('amenity_id', amenityId)
      .gte('fecha', formatFechaKey(inicio))
      .lte('fecha', formatFechaKey(fin))
      .in('estado', ['confirmada', 'pendiente']);
    const agrupadas: Record<string, Reserva[]> = {};
    (data || []).forEach((reserva) => {
      if (!agrupadas[reserva.fecha]) agrupadas[reserva.fecha] = [];
      agrupadas[reserva.fecha].push(reserva);
    });
    Object.keys(agrupadas).forEach((fecha) => {
      agrupadas[fecha].sort((a, b) => (a.hora_inicio > b.hora_inicio ? 1 : -1));
    });
    setReservasCalendario(agrupadas);
    setLoadingDisponibilidad(false);
  };

  const cambiarMes = async (delta: number) => {
    if (!amenityDisponibilidad) return;
    const nuevoMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + delta, 1);
    setMesVisible(nuevoMes);
    setDiaSeleccionado(null);
    await cargarReservasMes(amenityDisponibilidad.id, nuevoMes);
  };

  const reservasSeleccionadas = diaSeleccionado
    ? reservasCalendario[formatFechaKey(diaSeleccionado)] || []
    : [];

  const abrirReserva = (amenity: Amenity, fechaPrefijada?: Date) => {
    if (fechaPrefijada && !esFechaReservable(fechaPrefijada)) {
      Alert.alert('Fecha no disponible', 'Solo podés reservar con al menos un día de anticipación.');
      return;
    }
    setSelectedAmenity(amenity);
    const baseFecha = fechaPrefijada ? new Date(fechaPrefijada) : null;
    setFechaDate(baseFecha);
    setFechaISOSeleccionada(baseFecha ? formatFechaKey(baseFecha) : null);
    const defaultInicio = baseFecha ? new Date(baseFecha) : new Date();
    const [h, m] = (amenity.hora_apertura?.slice(0, 5) || '08:00').split(':');
    defaultInicio.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    setHoraInicioDate(defaultInicio);
    setHoraFinDate(baseFecha ? new Date(baseFecha) : null);
    setNotas('');
    setTurnoSeleccionadoId(null);
    setReservasTurnoDia([]);
    setShowReservar(true);
  };

  const formatFechaDisplay = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatHoraDisplay = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatHoraISO = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const esFechaReservable = (fecha: Date) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const objetivo = new Date(fecha);
    objetivo.setHours(0, 0, 0, 0);
    const diffMs = objetivo.getTime() - hoy.getTime();
    const unDiaMs = 24 * 60 * 60 * 1000;
    return diffMs >= unDiaMs;
  };
  const obtenerManana = () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    return manana;
  };

  const onFechaChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowFechaPicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (!esFechaReservable(selectedDate)) {
        Alert.alert('Fecha no disponible', 'Solo podés reservar con al menos un día de anticipación.');
        setFechaDate(null);
        setFechaISOSeleccionada(null);
        return;
      }
      setFechaDate(selectedDate);
      const fechaKey = formatFechaKey(selectedDate);
      setFechaISOSeleccionada(fechaKey);
      setTurnoSeleccionadoId(null);
    }
  };
  const onHoraInicioChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowHoraInicioPicker(Platform.OS === 'ios');
    if (selectedDate) setHoraInicioDate(selectedDate);
  };
  const onHoraFinChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowHoraFinPicker(Platform.OS === 'ios');
    if (selectedDate) setHoraFinDate(selectedDate);
  };

  const crearReserva = async () => {
    if (!fechaDate || !horaInicioDate || !horaFinDate || !selectedAmenity || !profile) {
      Alert.alert('Error', 'Completá fecha, hora inicio y hora fin');
      return;
    }

    if (!esFechaReservable(fechaDate)) {
      Alert.alert('Fecha no disponible', 'Solo podés reservar con al menos un día de anticipación.');
      return;
    }

    const fechaISO = formatFechaKey(fechaDate);
    const tieneTurnos = Array.isArray(selectedAmenity.turnos_config) && selectedAmenity.turnos_config.length > 0;
    if (tieneTurnos && !turnoSeleccionadoId) {
      Alert.alert('Elegí un turno', 'Seleccioná uno de los turnos disponibles para continuar.');
      return;
    }
    const horaInicio = formatHoraISO(horaInicioDate);
    const horaFin = formatHoraISO(horaFinDate);

    setGuardando(true);
    try {
      // Verificar disponibilidad
      const { data: existentes } = await supabase
        .from('reservas')
        .select('*')
        .eq('amenity_id', selectedAmenity.id)
        .eq('fecha', fechaISO)
        .in('estado', ['confirmada', 'pendiente']);

      const horaInicioStr = horaInicio;
      const horaFinStr = horaFin;
      const conflicto = existentes?.some((r) => {
        return horaInicioStr < r.hora_fin && horaFinStr > r.hora_inicio;
      });

      if (conflicto) {
        Alert.alert('No disponible', 'Ya hay una reserva en ese horario');
        setGuardando(false);
        return;
      }

      const { error } = await supabase.from('reservas').insert({
        amenity_id: selectedAmenity.id,
        vecino_id: profile.id,
        barrio_id: profile.barrio_id,
        fecha: fechaISO,
        hora_inicio: horaInicioStr,
        hora_fin: horaFinStr,
        estado: selectedAmenity.requiere_aprobacion ? 'pendiente' : 'confirmada',
        notas: notas.trim() || null,
      });

      if (error) throw error;

      setShowReservar(false);
      fetchMisReservas();
      Alert.alert(
        '¡Reserva creada!',
        selectedAmenity.requiere_aprobacion
          ? 'Tu reserva está pendiente de aprobación del admin.'
          : 'Tu reserva fue confirmada.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    const cargarTurnosDia = async () => {
      if (!selectedAmenity?.id || !fechaISOSeleccionada) {
        setReservasTurnoDia([]);
        return;
      }
      const tieneTurnos = Array.isArray(selectedAmenity.turnos_config) && selectedAmenity.turnos_config.length > 0;
      if (!tieneTurnos) {
        setReservasTurnoDia([]);
        return;
      }
      setCargandoTurnos(true);
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('amenity_id', selectedAmenity.id)
        .eq('fecha', fechaISOSeleccionada)
        .in('estado', ['confirmada', 'pendiente']);
      if (!error && data) {
        setReservasTurnoDia(data);
      } else {
        setReservasTurnoDia([]);
      }
      setCargandoTurnos(false);
    };

    cargarTurnosDia();
  }, [selectedAmenity?.id, fechaISOSeleccionada]);

  const cancelarReserva = (reserva: Reserva) => {
    Alert.alert('Cancelar reserva', '¿Querés cancelar esta reserva?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id', reserva.id);
          fetchMisReservas();
        },
      },
    ]);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'confirmada': return '#22c55e';
      case 'pendiente': return '#eab308';
      case 'cancelada': return '#6b7280';
      case 'rechazada': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const puedeCancelarReserva = (reserva: Reserva) => {
    if (!reserva.fecha) return false;
    const [yearStr, monthStr, dayStr] = reserva.fecha.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return false;
    const fechaReserva = new Date(year, month - 1, day);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaReserva.setHours(0, 0, 0, 0);
    const diffMs = fechaReserva.getTime() - hoy.getTime();
    const unDiaMs = 24 * 60 * 60 * 1000;
    return diffMs >= unDiaMs;
  };

  const renderAmenity = ({ item }: { item: Amenity }) => (
    <View style={styles.amenityCard}>
      <View style={styles.amenityHeader}>
        <Text style={styles.amenityNombre}>{item.nombre}</Text>
        {item.capacidad && (
          <Text style={styles.amenityCapacidad}>👥 {item.capacidad}</Text>
        )}
      </View>
      {item.descripcion && (
        <Text style={styles.amenityDesc}>{item.descripcion}</Text>
      )}
      <View style={styles.amenityInfo}>
        <Text style={styles.amenityHorario}>
          🕐 {item.hora_apertura?.slice(0, 5)} - {item.hora_cierre?.slice(0, 5)}
        </Text>
        <Text style={styles.amenityDias}>
          {item.dias_disponibles?.map((d) => DIAS[d])?.join(', ')}
        </Text>
      </View>
      {item.requiere_aprobacion && (
        <Text style={styles.requiereAprobacion}>⚠️ Requiere aprobación del admin</Text>
      )}
      <View style={styles.amenityActions}>
        <TouchableOpacity style={styles.availabilityBtn} onPress={() => abrirDisponibilidad(item)}>
          <Ionicons name="calendar-outline" size={16} color="#e94560" />
          <Text style={styles.availabilityBtnText}>Ver disponibilidad</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReserva = ({ item }: { item: Reserva & { amenity_nombre?: string } }) => {
    const permiteCancelar = puedeCancelarReserva(item);
    const esCancelable = item.estado === 'confirmada' || item.estado === 'pendiente';
    return (
      <View style={styles.reservaCard}>
        <View style={styles.reservaHeader}>
          <Text style={styles.reservaNombre}>{item.amenity_nombre}</Text>
          <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) }]}>
            <Text style={styles.estadoText}>{item.estado}</Text>
          </View>
        </View>
        <Text style={styles.reservaFecha}>
          📅 {item.fecha} • 🕐 {item.hora_inicio?.slice(0, 5)} - {item.hora_fin?.slice(0, 5)}
        </Text>
        {item.notas && <Text style={styles.reservaNotas}>{item.notas}</Text>}
        {esCancelable && permiteCancelar && (
          <TouchableOpacity style={styles.cancelarBtn} onPress={() => cancelarReserva(item)}>
            <Text style={styles.cancelarBtnText}>Cancelar reserva</Text>
          </TouchableOpacity>
        )}
        {esCancelable && !permiteCancelar && (
          <Text style={styles.cancelarHint}>Solo podés cancelar hasta el día anterior.</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Amenities</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'amenities' && styles.tabActivo]}
          onPress={() => setTab('amenities')}
        >
          <Text style={[styles.tabText, tab === 'amenities' && styles.tabTextoActivo]}>
            Disponibles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'reservas' && styles.tabActivo]}
          onPress={() => setTab('reservas')}
        >
          <Text style={[styles.tabText, tab === 'reservas' && styles.tabTextoActivo]}>
            Mis Reservas
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'amenities' ? (
        <FlatList
          data={amenities}
          keyExtractor={(item) => item.id}
          renderItem={renderAmenity}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏊</Text>
              <Text style={styles.emptyText}>No hay amenities configurados</Text>
              <Text style={styles.emptySubtext}>El admin puede agregarlos desde el panel web</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={misReservas}
          keyExtractor={(item) => item.id}
          renderItem={renderReserva}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No tenés reservas</Text>
            </View>
          }
        />
      )}

      {/* Modal reservar */}
      <Modal visible={showReservar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Reservar {selectedAmenity?.nombre}</Text>

            <Text style={styles.label}>Fecha *</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowFechaPicker(true)}>
              <Ionicons name="calendar" size={18} color="#94a3b8" />
              <Text style={[styles.pickerBtnText, fechaDate && { color: '#fff' }]}>
                {fechaDate ? formatFechaDisplay(fechaDate) : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
            {showFechaPicker && (
              <DateTimePicker
                value={fechaDate && esFechaReservable(fechaDate) ? fechaDate : obtenerManana()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onFechaChange}
                minimumDate={obtenerManana()}
              />
            )}

            {selectedAmenity?.turnos_config?.length ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Turnos disponibles</Text>
                {!fechaDate && <Text style={styles.turnosHint}>Seleccioná una fecha para ver los turnos.</Text>}
                {fechaDate && cargandoTurnos && <ActivityIndicator color="#e94560" style={{ marginVertical: 12 }} />}
                {fechaDate && !cargandoTurnos && (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {selectedAmenity.turnos_config
                      .slice()
                      .sort((a, b) => (a.hora_inicio > b.hora_inicio ? 1 : -1))
                      .map((turno) => {
                        const ocupado = reservasTurnoDia.some(
                          (reserva) =>
                            normalizarHora(reserva.hora_inicio) === normalizarHora(turno.hora_inicio) &&
                            normalizarHora(reserva.hora_fin) === normalizarHora(turno.hora_fin)
                        );
                        const seleccionado = turnoSeleccionadoId === turno.id;
                        return (
                          <TouchableOpacity
                            key={turno.id}
                            style={[
                              styles.turnoItem,
                              ocupado && styles.turnoItemOcupado,
                              seleccionado && styles.turnoItemSeleccionado,
                            ]}
                            disabled={ocupado}
                            onPress={() => {
                              if (!fechaDate) return;
                              setTurnoSeleccionadoId(turno.id);
                              setHoraInicioDate(buildDateWithTime(fechaDate, turno.hora_inicio));
                              setHoraFinDate(buildDateWithTime(fechaDate, turno.hora_fin));
                            }}
                          >
                            <View>
                              <Text style={styles.turnoHora}>{normalizarHora(turno.hora_inicio)} - {normalizarHora(turno.hora_fin)}</Text>
                              {turno.etiqueta ? <Text style={styles.turnoEtiqueta}>{turno.etiqueta}</Text> : null}
                            </View>
                            <Text style={[styles.turnoEstado, ocupado && { color: '#f87171' }]}>
                              {ocupado ? 'Ocupado' : seleccionado ? 'Seleccionado' : 'Disponible'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    {selectedAmenity.turnos_config.length === 0 && (
                      <Text style={styles.turnosHint}>No hay turnos configurados para este amenity.</Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Desde *</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowHoraInicioPicker(true)}>
                    <Ionicons name="time" size={18} color="#94a3b8" />
                    <Text style={[styles.pickerBtnText, horaInicioDate && { color: '#fff' }]}>
                      {horaInicioDate ? formatHoraDisplay(horaInicioDate) : 'HH:MM'}
                    </Text>
                  </TouchableOpacity>
                  {showHoraInicioPicker && (
                    <DateTimePicker
                      value={horaInicioDate || new Date()}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onHoraInicioChange}
                      is24Hour={true}
                    />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Hasta *</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowHoraFinPicker(true)}>
                    <Ionicons name="time" size={18} color="#94a3b8" />
                    <Text style={[styles.pickerBtnText, horaFinDate && { color: '#fff' }]}>
                      {horaFinDate ? formatHoraDisplay(horaFinDate) : 'HH:MM'}
                    </Text>
                  </TouchableOpacity>
                  {showHoraFinPicker && (
                    <DateTimePicker
                      value={horaFinDate || new Date()}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onHoraFinChange}
                      is24Hour={true}
                    />
                  )}
                </View>
              </View>
            )}

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Cumpleaños infantil"
              placeholderTextColor="#64748b"
              value={notas}
              onChangeText={setNotas}
            />

            <TouchableOpacity
              style={[styles.guardarBtn, guardando && { opacity: 0.5 }]}
              onPress={crearReserva}
              disabled={guardando}
            >
              <Text style={styles.guardarBtnText}>{guardando ? 'Reservando...' : 'Confirmar reserva'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cerrarBtn} onPress={() => setShowReservar(false)}>
              <Text style={styles.cerrarBtnText}>Cancelar</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal disponibilidad */}
      <Modal visible={showDisponibilidad} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}> 
            <Text style={styles.modalTitle}>Disponibilidad {amenityDisponibilidad?.nombre}</Text>
            <View style={styles.calHeader}>
              <TouchableOpacity style={styles.diaArrow} onPress={() => cambiarMes(-1)}>
                <Ionicons name="chevron-back" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calMes}>{mesVisible.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity style={styles.diaArrow} onPress={() => cambiarMes(1)}>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingDisponibilidad ? (
              <ActivityIndicator color="#e94560" style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.weekRow}>
                  {DIAS.map((dia) => (
                    <Text key={dia} style={styles.weekDay}>{dia}</Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {diasCalendario.map((dia, idx) => {
                    const esMesActual = dia.getMonth() === mesVisible.getMonth();
                    const clave = formatFechaKey(dia);
                    const tieneReservas = (reservasCalendario[clave] || []).length > 0;
                    const seleccionado = diaSeleccionado && formatFechaKey(diaSeleccionado) === clave;
                    return (
                      <TouchableOpacity
                        key={`${clave}-${idx}`}
                        style={[
                          styles.calendarCell,
                          !esMesActual && styles.calendarCellMuted,
                          seleccionado && styles.calendarCellSelected,
                        ]}
                        onPress={() => {
                          if (!esMesActual) return;
                          const fechaLimpiada = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
                          setDiaSeleccionado(fechaLimpiada);
                          if (!esFechaReservable(fechaLimpiada)) {
                            Alert.alert('Fecha no disponible', 'Solo podés reservar con al menos un día de anticipación.');
                            return;
                          }
                          if (amenityDisponibilidad) {
                            setShowDisponibilidad(false);
                            setTimeout(() => abrirReserva(amenityDisponibilidad, fechaLimpiada), 0);
                          }
                        }}
                      >
                        <Text style={styles.calendarCellText}>{dia.getDate()}</Text>
                        {tieneReservas && <View style={styles.calendarDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.disponibilidadDiaLabel}>
                  {diaSeleccionado
                    ? `Reservas para ${formatFechaDisplay(diaSeleccionado)}`
                    : 'Seleccioná un día para ver sus reservas'}
                </Text>

                {diaSeleccionado && reservasSeleccionadas.length === 0 && (
                  <View style={styles.disponibilidadEmpty}>
                    <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
                    <Text style={styles.disponibilidadEmptyText}>No hay reservas para este día</Text>
                  </View>
                )}

                {diaSeleccionado && reservasSeleccionadas.length > 0 && (
                  <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ paddingBottom: 12 }}>
                    {reservasSeleccionadas.map((reserva) => (
                      <View key={reserva.id} style={styles.slotCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.slotHora}>{reserva.hora_inicio?.slice(0, 5)} - {reserva.hora_fin?.slice(0, 5)}</Text>
                          <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(reserva.estado) }]}>
                            <Text style={styles.estadoText}>{reserva.estado}</Text>
                          </View>
                        </View>
                        {reserva.notas && <Text style={styles.slotNotas}>{reserva.notas}</Text>}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity style={styles.cerrarBtn} onPress={() => setShowDisponibilidad(false)}>
              <Text style={styles.cerrarBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1120',
    paddingHorizontal: 20,
    paddingTop: 52,
  },
  title: { fontSize: 28, color: '#fff', fontWeight: '700', marginBottom: 18 },
  tabs: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.12)',
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActivo: {
    backgroundColor: '#e94560',
  },
  tabText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  tabTextoActivo: { color: '#fff' },
  list: { paddingBottom: 40 },
  amenityCard: {
    backgroundColor: '#16213e',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  amenityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amenityNombre: { fontSize: 18, fontWeight: '700', color: '#fff' },
  amenityCapacidad: { color: '#94a3b8', fontWeight: '600' },
  amenityDesc: { color: '#94a3b8', lineHeight: 20, marginBottom: 8 },
  amenityInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  amenityHorario: { color: '#e2e8f0', fontWeight: '600' },
  amenityDias: { color: '#94a3b8', fontSize: 13 },
  requiereAprobacion: {
    color: '#fcd34d',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  amenityActions: {
    marginTop: 14,
    flexDirection: 'column',
    gap: 8,
  },
  availabilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e94560',
    paddingVertical: 10,
    gap: 6,
  },
  availabilityBtnText: { color: '#e94560', fontWeight: '600', fontSize: 14 },
  reservarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
    gap: 6,
  },
  reservarBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  reservaCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  reservaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reservaNombre: { fontSize: 16, fontWeight: '600', color: '#fff' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  estadoText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  reservaFecha: { fontSize: 14, color: '#94a3b8', marginTop: 6 },
  reservaNotas: { fontSize: 13, color: '#64748b', marginTop: 4 },
  cancelarBtn: { marginTop: 10, alignItems: 'center' },
  cancelarBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  cancelarHint: { color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
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
  row: { flexDirection: 'row' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 8,
  },
  pickerBtnText: { fontSize: 15, color: '#64748b' },
  guardarBtn: { backgroundColor: '#e94560', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  guardarBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cerrarBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cerrarBtnText: { color: '#94a3b8', fontSize: 15 },
  disponibilidadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  diaArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calMes: { color: '#fff', fontWeight: '700', fontSize: 18, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  calendarCellMuted: { opacity: 0.3 },
  calendarCellSelected: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    borderRadius: 10,
  },
  calendarCellText: { color: '#fff', fontWeight: '600' },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e94560',
    position: 'absolute',
    bottom: 6,
  },
  disponibilidadDiaLabel: { color: '#fff', fontWeight: '600', marginTop: 12, marginBottom: 8 },
  disponibilidadEmpty: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  disponibilidadEmptyText: { color: '#94a3b8' },
  slotCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 10,
  },
  slotHora: { color: '#fff', fontWeight: '600', fontSize: 15 },
  slotNotas: { color: '#94a3b8', marginTop: 6 },
  turnoHora: { color: '#e2e8f0', fontWeight: '600', fontSize: 15 },
  turnoEtiqueta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  turnoEstado: { fontSize: 12, color: '#bbf7d0', fontWeight: '700' },
  turnoItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  turnoItemOcupado: {
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(127,29,29,0.25)',
  },
  turnoItemSeleccionado: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  turnosHint: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
});
