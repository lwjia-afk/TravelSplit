import { Stack } from 'expo-router';
import { StoreProvider } from '../src/store';
import { LanguageProvider } from '../src/LanguageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <StoreProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </StoreProvider>
    </LanguageProvider>
  );
}
