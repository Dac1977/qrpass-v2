import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase, Encuesta, Voto } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export function EncuestasScreen() {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selecciones, setSelecciones] = useState<Record<string, number[]>>({});
  const { profile } = useAuthStore();

  const fetchEncuestas = async () => {
    if (!profile?.barrio_id) return;
    const { data } = await supabase
      .from('encuestas')
      .select('*')
      .eq('barrio_id', profile.barrio_id)
      .eq('activa', true)
      .order('created_at', { ascending: false });
    if (data) setEncuestas(data);
  };

  const fetchVotos = async () => {
    if (!profile?.barrio_id || !profile?.id) return;
    const { data } = await supabase
      .from('votos')
      .select('*')
      .eq('vecino_id', profile.id);
    if (data) setVotos(data);
  };

  useFocusEffect(
    useCallback(() => {
      fetchEncuestas();
      fetchVotos();
    }, [profile?.barrio_id, profile?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEncuestas(), fetchVotos()]);
    setRefreshing(false);
  };

  const yaVotoEncuesta = (encuestaId: string) => votos.some((v) => v.encuesta_id === encuestaId);

  const toggleSeleccion = (encuesta: Encuesta, opcionIndex: number, bloqueado: boolean) => {
    if (bloqueado) return;
    setSelecciones((prev) => {
      const actuales = prev[encuesta.id] || [];
      let nuevas: number[];
      if (encuesta.multiple) {
        nuevas = actuales.includes(opcionIndex)
          ? actuales.filter((i) => i !== opcionIndex)
          : [...actuales, opcionIndex];
      } else {
        if (actuales.length === 1 && actuales[0] === opcionIndex) {
          nuevas = [];
        } else {
          nuevas = [opcionIndex];
        }
      }
      return { ...prev, [encuesta.id]: nuevas };
    });
  };

  const confirmarVoto = async (encuesta: Encuesta) => {
    if (!profile?.id) return;
    if (yaVotoEncuesta(encuesta.id)) return;

    const seleccion = selecciones[encuesta.id] || [];
    if (seleccion.length === 0) {
      Alert.alert('Elegí una opción', 'Seleccioná al menos una opción antes de enviar.');
      return;
    }

    const payload = seleccion.map((opcionIndex) => ({
      encuesta_id: encuesta.id,
      vecino_id: profile.id,
      opcion_index: opcionIndex,
      numero_casa: profile.numero_casa ?? null,
    }));

    const { error } = await supabase.from('votos').insert(payload);

    if (error) {
      Alert.alert('Error', 'No se pudo registrar tu voto');
    } else {
      Alert.alert('¡Gracias!', 'Tu voto fue registrado.');
      setSelecciones((prev) => ({ ...prev, [encuesta.id]: [] }));
      fetchVotos();
    }
  };

  const getVotosPorEncuesta = (encuestaId: string) => {
    return votos.filter((v) => v.encuesta_id === encuestaId);
  };

  const getTotalVotosPorOpcion = (encuestaId: string, opcionIndex: number) => {
    // Contamos todos los votos, pero solo sabemos los nuestros (por RLS)
    // Para mostrar resultados completos necesitaríamos una función RPC
    // Por ahora mostramos si YO voté
    return votos.filter(
      (v) => v.encuesta_id === encuestaId && v.opcion_index === opcionIndex
    ).length;
  };

  const isCerrada = (encuesta: Encuesta) => {
    if (!encuesta.fecha_cierre) return false;
    return new Date(encuesta.fecha_cierre) < new Date();
  };

  const renderEncuesta = ({ item }: { item: Encuesta }) => {
    const opciones = Array.isArray(item.opciones) ? item.opciones : [];
    const misVotos = getVotosPorEncuesta(item.id);
    const cerrada = isCerrada(item);
    const bloqueado = cerrada || misVotos.length > 0;
    const seleccionPendiente = selecciones[item.id] || [];

    return (
      <View style={styles.encuestaCard}>
        <Text style={styles.encuestaTitulo}>{item.titulo}</Text>
        {item.descripcion && (
          <Text style={styles.encuestaDesc}>{item.descripcion}</Text>
        )}

        {cerrada && (
          <View style={styles.cerradaBadge}>
            <Text style={styles.cerradaText}>🔒 Votación cerrada</Text>
          </View>
        )}

        {item.multiple && !cerrada && (
          <Text style={styles.multipleHint}>Podés elegir varias opciones</Text>
        )}

        <View style={styles.opcionesContainer}>
          {opciones.map((opcion: string, index: number) => {
            const votado = misVotos.some((v) => v.opcion_index === index);
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.opcionBtn,
                  (votado || (!bloqueado && seleccionPendiente.includes(index))) && styles.opcionVotada,
                  bloqueado && styles.opcionBloqueada,
                ]}
                onPress={() => toggleSeleccion(item, index, bloqueado)}
                disabled={bloqueado}
              >
                <View style={styles.opcionContent}>
                  <View style={[styles.radio, (votado || (!bloqueado && seleccionPendiente.includes(index))) && styles.radioVotado]}>
                    {(votado || (!bloqueado && seleccionPendiente.includes(index))) && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={[styles.opcionText, (votado || (!bloqueado && seleccionPendiente.includes(index))) && styles.opcionTextVotada]}>
                    {opcion}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {!bloqueado && !cerrada ? (
          <TouchableOpacity
            style={[styles.confirmarBtn, (seleccionPendiente.length === 0) && { opacity: 0.4 }]}
            onPress={() => confirmarVoto(item)}
            disabled={seleccionPendiente.length === 0}
          >
            <Text style={styles.confirmarBtnText}>Aceptar voto</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.votoEnviadoBadge}>
            <Ionicons name="lock-closed" size={14} color="#22c55e" />
            <Text style={styles.votoEnviadoText}>{cerrada ? 'Encuesta cerrada' : 'Ya enviaste tu voto'}</Text>
          </View>
        )}

        {item.fecha_cierre && (
          <Text style={styles.fechaCierre}>
            {cerrada ? 'Cerró' : 'Cierra'}: {new Date(item.fecha_cierre).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Encuestas</Text>

      <FlatList
        data={encuestas}
        keyExtractor={(item) => item.id}
        renderItem={renderEncuesta}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay encuestas activas</Text>
            <Text style={styles.emptySubtext}>Las encuestas las crea la administración del barrio</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', padding: 20, paddingBottom: 8 },
  list: { padding: 16 },
  encuestaCard: {
    backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#0f3460',
  },
  encuestaTitulo: { fontSize: 18, fontWeight: '700', color: '#fff' },
  encuestaDesc: { fontSize: 14, color: '#94a3b8', marginTop: 6 },
  cerradaBadge: {
    backgroundColor: '#374151', borderRadius: 8, padding: 8, marginTop: 10, alignItems: 'center',
  },
  cerradaText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  multipleHint: { fontSize: 12, color: '#3b82f6', marginTop: 8 },
  opcionesContainer: { marginTop: 14, gap: 8 },
  opcionBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#0f3460',
  },
  opcionVotada: { borderColor: '#e94560', backgroundColor: 'rgba(233,69,96,0.1)' },
  opcionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#475569',
    alignItems: 'center', justifyContent: 'center',
  },
  radioVotado: { backgroundColor: '#e94560', borderColor: '#e94560' },
  opcionText: { fontSize: 15, color: '#e2e8f0', flex: 1 },
  opcionTextVotada: { color: '#fff', fontWeight: '600' },
  opcionBloqueada: { opacity: 0.7 },
  confirmarBtn: {
    marginTop: 16,
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmarBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  votoEnviadoBadge: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 10,
    padding: 10,
  },
  votoEnviadoText: { color: '#22c55e', fontWeight: '600' },
  fechaCierre: { fontSize: 12, color: '#64748b', marginTop: 12, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});
