// Utilidades de horario compartidas por el servidor y la app.
// Las horas se guardan como minutos desde la medianoche (20:30 -> 1230).

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

// "20:30" -> 1230. "00:00" como hora de cierre puede escribirse "24:00". Devuelve null si es inválida.
export function aMinutos(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 24 || minutos > 59 || (horas === 24 && minutos > 0)) return null;
  return horas * 60 + minutos;
}

// 1230 -> "20:30". Pasada la medianoche vuelve a empezar (1500 -> "01:00").
export function aHora(minutos: number): string {
  const enElDia = ((minutos % 1440) + 1440) % 1440;
  const h = Math.floor(enElDia / 60);
  const m = enElDia % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatoPrecio(pesos: number): string {
  return `$${pesos.toLocaleString("es-AR")}`;
}

export function seSuperponen(a: { inicio: number; fin: number }, b: { inicio: number; fin: number }): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}
