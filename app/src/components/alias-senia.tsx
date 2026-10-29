import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip, estilosComunes } from '@/components/ui/formulario';
import { Spacing } from '@/constants/theme';
import { formatoPrecio } from '../../convex/lib/horas';

// Datos para transferir la seña al complejo (mientras no esté integrado Mercado Pago).
export function AliasSenia({ monto, alias, conWhatsapp }: { monto: number; alias?: string; conWhatsapp: boolean }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!alias) return;
    await Clipboard.setStringAsync(alias);
    setCopiado(true);
  }

  return (
    <View style={styles.contenedor}>
      <ThemedText type="small">
        Este complejo pide una seña de <ThemedText type="smallBold">{formatoPrecio(monto)}</ThemedText>.
      </ThemedText>
      {alias ? (
        <>
          <View style={estilosComunes.fila}>
            <ThemedText type="small" style={estilosComunes.flex}>
              Transferila al alias <ThemedText type="smallBold">{alias}</ThemedText>
            </ThemedText>
            <Chip texto={copiado ? 'Copiado ✓' : 'Copiar'} activo={copiado} onPress={() => void copiar()} />
          </View>
          {conWhatsapp && (
            <ThemedText type="small" themeColor="textSecondary">
              Después mandale el comprobante al complejo por WhatsApp.
            </ThemedText>
          )}
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Consultá con el complejo cómo abonarla.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: Spacing.one },
});
