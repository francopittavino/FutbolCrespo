import { useQuery } from 'convex/react';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Campo, Chip, estilosComunes } from '@/components/ui/formulario';
import { Spacing } from '@/constants/theme';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

const MAX_SUGERENCIAS = 6;

// Buscador de clientes del complejo. Si `permitirNuevo`, lo escrito sirve como nombre de alguien nuevo.
export function SelectorCliente({
  complejoId,
  elegido,
  onElegir,
  texto,
  onTexto,
  permitirNuevo = false,
}: {
  complejoId: Id<'complejos'>;
  elegido: Doc<'clientes'> | null;
  onElegir: (cliente: Doc<'clientes'> | null) => void;
  texto: string;
  onTexto: (texto: string) => void;
  permitirNuevo?: boolean;
}) {
  const clientes = useQuery(api.clientes.listar, { complejoId });
  const [enfocado, setEnfocado] = useState(false);

  if (elegido) {
    return (
      <View style={estilosComunes.fila}>
        <ThemedText style={estilosComunes.flex}>
          {elegido.nombre}
          {elegido.telefono ? ` · ${elegido.telefono}` : ''}
        </ThemedText>
        <Chip texto="Cambiar" activo={false} onPress={() => onElegir(null)} />
      </View>
    );
  }

  const busqueda = normalizar(texto);
  const sugerencias = (clientes ?? [])
    .filter((c) => !busqueda || normalizar(c.nombre).includes(busqueda) || c.telefono?.includes(busqueda))
    .slice(0, MAX_SUGERENCIAS);

  return (
    <View style={{ gap: Spacing.two }}>
      <Campo
        etiqueta={permitirNuevo ? 'Cliente (buscá o escribí un nombre nuevo)' : 'Cliente'}
        value={texto}
        onChangeText={onTexto}
        onFocus={() => setEnfocado(true)}
        placeholder="Nombre o teléfono"
      />
      {(enfocado || texto) && sugerencias.length > 0 && (
        <View style={estilosComunes.filaEnvuelta}>
          {sugerencias.map((c) => (
            <Chip key={c._id} texto={c.nombre} activo={false} onPress={() => onElegir(c)} />
          ))}
        </View>
      )}
      {clientes?.length === 0 && !permitirNuevo && (
        <ThemedText type="small" themeColor="textSecondary">
          Todavía no hay clientes. Cargalos en la sección de abajo.
        </ThemedText>
      )}
    </View>
  );
}

// Ignora mayúsculas y tildes al buscar ("jose" encuentra "José").
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
