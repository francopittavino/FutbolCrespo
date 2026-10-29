// Celulares de Argentina en WhatsApp: 549 + característica + número, sin 0 ni 15.
export function enlaceWhatsapp(numero: string): string {
  let digitos = numero.replace(/\D/g, '');
  if (digitos.startsWith('549')) return `https://wa.me/${digitos}`;
  if (digitos.startsWith('54')) digitos = digitos.slice(2);
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  return `https://wa.me/549${digitos}`;
}
