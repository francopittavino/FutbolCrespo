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

// Fechas "YYYY-MM-DD" en hora de Argentina (UTC-3 fijo, sin horario de verano).
const OFFSET_ARGENTINA_MS = -3 * 60 * 60 * 1000;

export function hoyEnArgentina(ahora: number = Date.now()): string {
  return new Date(ahora + OFFSET_ARGENTINA_MS).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemanaDe(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function esFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(new Date(`${fecha}T00:00:00Z`).getTime());
}

// Momento exacto (timestamp) en que empieza un turno. `minutos` puede pasar de 1440 (después de medianoche).
export function inicioDelTurno(fecha: string, minutos: number): number {
  return new Date(`${fecha}T00:00:00Z`).getTime() - OFFSET_ARGENTINA_MS + minutos * 60 * 1000;
}

// "Hoy", "Mañana" o "Vie 31/10".
export function etiquetaFecha(fecha: string, hoy: string = hoyEnArgentina()): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  const [, mes, dia] = fecha.split("-");
  return `${DIAS_CORTOS[diaSemanaDe(fecha)]} ${dia}/${mes}`;
}
