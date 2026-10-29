import html2canvas from 'html2canvas';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export type ResultadoImagen = 'compartido' | 'descargado' | 'cancelado';

// En la web la vista es un elemento HTML: se dibuja en un canvas al tamaño final y se comparte
// como archivo (celulares) o se descarga (computadoras).
export async function compartirImagen(
  vista: RefObject<ComponentRef<typeof View> | null>,
  ancho: number,
  alto: number,
  nombre: string,
): Promise<ResultadoImagen> {
  const elemento = vista.current as unknown as HTMLElement | null;
  if (!elemento) throw new Error('No se pudo generar la imagen.');
  await document.fonts.ready;
  const canvas = await html2canvas(elemento, {
    scale: ancho / elemento.offsetWidth,
    width: elemento.offsetWidth,
    height: elemento.offsetWidth * (alto / ancho),
    backgroundColor: null,
    useCORS: true,
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen.');
  const archivo = new File([blob], `${nombre}.png`, { type: 'image/png' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return 'compartido';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
      // Si el navegador no deja compartir, se descarga.
    }
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'descargado';
}
