import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Boton, Cargando, Chip, Encabezado, Pantalla, Tarjeta, estilosComunes } from '@/components/ui/formulario';
import { compartirTexto, urlDe } from '@/lib/compartir';
import { api } from '../../../convex/_generated/api';

export default function AmigosScreen() {
  const datos = useQuery(api.amigos.misAmigos);
  const companeros = useQuery(api.amigos.companeros);
  const enviar = useMutation(api.amigos.enviarSolicitud);
  const responder = useMutation(api.amigos.responder);
  const eliminar = useMutation(api.amigos.eliminar);
  const [aviso, setAviso] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  if (datos === undefined) return <Cargando />;
  if (datos === null) {
    return (
      <Pantalla>
        <Tarjeta>
          <ThemedText>Ingresá desde Mis partidos para ver tus amigos.</ThemedText>
        </Tarjeta>
      </Pantalla>
    );
  }

  async function compartirMiLink() {
    const enlace = urlDe(`/turnos/amigo/${datos!.miId}`);
    const resultado = await compartirTexto(`Agregame en Futbol Crespo para armar partidos: ${enlace}`);
    setAviso(resultado === 'copiado' ? 'Link copiado.' : null);
  }

  return (
    <Pantalla>
      <Encabezado titulo="Amigos" volverA="/turnos" />

      <Tarjeta>
        <ThemedText type="heading" themeColor="primary">
          Tu link de amigo
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Quien lo abra te puede agregar. Tus amigos aparecen para sumarlos rápido a tus partidos.
        </ThemedText>
        <Boton titulo="Compartir mi link" onPress={() => void compartirMiLink()} />
        {aviso && (
          <ThemedText type="small" themeColor="primary">
            {aviso}
          </ThemedText>
        )}
      </Tarjeta>

      {datos.recibidas.length > 0 && (
        <Tarjeta>
          <ThemedText type="heading" themeColor="primary">
            Te quieren agregar
          </ThemedText>
          {datos.recibidas.map((s) => (
            <View key={s.amistadId} style={estilosComunes.fila}>
              <ThemedText style={estilosComunes.flex}>{s.nombre}</ThemedText>
              <Chip texto="Aceptar" activo onPress={() => void responder({ amistadId: s.amistadId, aceptar: true })} />
              <Chip texto="Rechazar" activo={false} onPress={() => void responder({ amistadId: s.amistadId, aceptar: false })} />
            </View>
          ))}
        </Tarjeta>
      )}

      <Tarjeta>
        <ThemedText type="heading" themeColor="primary">
          Mis amigos ({datos.amigos.length})
        </ThemedText>
        {datos.amigos.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Todavía no tenés amigos agregados.
          </ThemedText>
        )}
        {datos.amigos.map((a) => (
          <View key={a.amistadId} style={estilosComunes.fila}>
            <ThemedText style={estilosComunes.flex}>{a.nombre}</ThemedText>
            {eliminando === a.amistadId ? (
              <>
                <Chip texto="No" activo={false} onPress={() => setEliminando(null)} />
                <Chip texto="Sí, eliminar" activo onPress={() => void eliminar({ amistadId: a.amistadId })} />
              </>
            ) : (
              <Pressable onPress={() => setEliminando(a.amistadId)} hitSlop={8}>
                <ThemedText type="small" themeColor="danger">
                  Eliminar
                </ThemedText>
              </Pressable>
            )}
          </View>
        ))}
        {datos.enviadas.map((s) => (
          <View key={s.amistadId} style={estilosComunes.fila}>
            <ThemedText style={estilosComunes.flex} themeColor="textSecondary">
              {s.nombre} · solicitud enviada
            </ThemedText>
            <Pressable onPress={() => void eliminar({ amistadId: s.amistadId })} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancelar
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </Tarjeta>

      {companeros && companeros.length > 0 && (
        <Tarjeta>
          <ThemedText type="heading" themeColor="primary">
            Jugaste con
          </ThemedText>
          <View style={estilosComunes.filaEnvuelta}>
            {companeros.map((c) => (
              <Chip key={c.userId} texto={`+ ${c.nombre}`} activo={false} onPress={() => void enviar({ userId: c.userId })} />
            ))}
          </View>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
