import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { FORMATOS, type Formato } from "@/components/compartir/tarjetas";
import { ThemedText } from "@/components/themed-text";
import {
  Boton,
  Chip,
  Tarjeta,
  TextoError,
  estilosComunes,
} from "@/components/ui/formulario";
import { Spacing } from "@/constants/theme";
import { compartirImagen } from "@/lib/imagen-compartir";

export type OpcionImagen = {
  clave: string;
  nombre: string; // lo que dice el chip: "Post", "Historia"…
  formato: Formato;
  archivo: string; // nombre del archivo descargado, sin extensión
  dibujar: (u: number) => ReactNode;
};

// Ancho máximo de la vista previa según el formato, para que una historia no ocupe toda la pantalla.
const ANCHO_PREVIA: Record<Formato, number> = {
  cuadrado: 360,
  vertical: 340,
  historia: 300,
};

// Bloque "Compartí": elegís la imagen, la ves y la mandás a WhatsApp, Instagram, etc.
export function CompartirImagenes({
  titulo = "Compartilo",
  descripcion,
  opciones,
}: {
  titulo?: string;
  descripcion?: string;
  opciones: OpcionImagen[];
}) {
  const vista = useRef<ComponentRef<typeof View>>(null);
  const [clave, setClave] = useState(opciones[0]?.clave);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opcion = opciones.find((o) => o.clave === clave) ?? opciones[0];
  if (!opcion) return null;
  const { ancho, alto } = FORMATOS[opcion.formato];
  const anchoPrevia = Math.min(anchoDisponible, ANCHO_PREVIA[opcion.formato]);

  async function compartir() {
    setGenerando(true);
    setAviso(null);
    setError(null);
    try {
      const resultado = await compartirImagen(
        vista,
        ancho,
        alto,
        opcion!.archivo,
      );
      if (resultado === "descargado")
        setAviso(
          "Imagen descargada. Subila a tus historias o mandala al grupo.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo generar la imagen.",
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        {titulo}
      </ThemedText>
      {descripcion && (
        <ThemedText type="small" themeColor="textSecondary">
          {descripcion}
        </ThemedText>
      )}
      {opciones.length > 1 && (
        <View style={estilosComunes.filaEnvuelta}>
          {opciones.map((o) => (
            <Chip
              key={o.clave}
              texto={o.nombre}
              activo={o.clave === opcion.clave}
              onPress={() => {
                setClave(o.clave);
                setAviso(null);
              }}
            />
          ))}
        </View>
      )}
      <View
        onLayout={(e) => setAnchoDisponible(e.nativeEvent.layout.width)}
        style={styles.previa}
      >
        {anchoPrevia > 0 && (
          <View ref={vista} collapsable={false}>
            {opcion.dibujar(anchoPrevia / ancho)}
          </View>
        )}
      </View>
      <Boton
        titulo="Compartir imagen"
        onPress={compartir}
        cargando={generando}
      />
      {aviso && (
        <ThemedText type="small" themeColor="primary">
          {aviso}
        </ThemedText>
      )}
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  previa: { alignItems: "center", paddingVertical: Spacing.one },
});
