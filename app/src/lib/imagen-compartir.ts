import * as Sharing from "expo-sharing";
import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

export type ResultadoImagen = "compartido" | "descargado" | "cancelado";

// Saca una foto de la vista (en el tamaño final, p. ej. 1080 × 1920) y abre el menú de compartir del celular.
export async function compartirImagen(
  vista: RefObject<ComponentRef<typeof View> | null>,
  ancho: number,
  alto: number,
  _nombre: string,
): Promise<ResultadoImagen> {
  const uri = await captureRef(vista, {
    format: "png",
    width: ancho,
    height: alto,
    result: "tmpfile",
  });
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Este celular no permite compartir imágenes.");
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Compartir imagen",
  });
  return "compartido";
}
