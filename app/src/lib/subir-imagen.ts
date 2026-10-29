import * as ImagePicker from 'expo-image-picker';

import type { Id } from '../../convex/_generated/dataModel';

// Abre la galería (o el selector de archivos en la web), sube la imagen elegida a Convex y devuelve su id.
// Devuelve null si la persona cancela.
export async function elegirYSubirImagen(
  generarUrlSubida: () => Promise<string>,
  aspecto: [number, number],
): Promise<Id<'_storage'> | null> {
  const elegida = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: aspecto,
    quality: 0.8,
  });
  if (elegida.canceled || elegida.assets.length === 0) return null;

  const imagen = elegida.assets[0];
  const contenido = await (await fetch(imagen.uri)).blob();
  const url = await generarUrlSubida();
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': imagen.mimeType ?? contenido.type ?? 'image/jpeg' },
    body: contenido,
  });
  if (!respuesta.ok) throw new Error('No se pudo subir la imagen.');
  const { storageId } = (await respuesta.json()) as { storageId: Id<'_storage'> };
  return storageId;
}
