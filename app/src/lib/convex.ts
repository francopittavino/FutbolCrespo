import type { TokenStorage } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// En el celular la sesión se guarda cifrada; en la web Convex Auth usa localStorage.
const almacenamientoSeguro: TokenStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export const almacenamientoSesion = Platform.OS === 'web' ? undefined : almacenamientoSeguro;
