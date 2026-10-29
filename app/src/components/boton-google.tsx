import { useAuthActions } from '@convex-dev/auth/react';
import { Platform } from 'react-native';

import { Boton } from '@/components/ui/formulario';

// En la web, después de ingresar con Google se vuelve a la misma página (por ejemplo, un link de invitación).
export function BotonGoogle({ titulo = 'Ingresar con Google' }: { titulo?: string }) {
  const { signIn } = useAuthActions();
  function ingresar() {
    void signIn('google', Platform.OS === 'web' ? { redirectTo: window.location.pathname } : undefined);
  }
  return <Boton titulo={titulo} onPress={ingresar} />;
}
