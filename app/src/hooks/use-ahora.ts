import { useEffect, useState } from 'react';

// Hora actual que se actualiza sola, para que los turnos pasados desaparezcan sin recargar.
export function useAhora(cadaMs = 60_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
