import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppRouter from './router';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MobilePwaInstallPrompt } from './components/PwaInstallPrompt';

export default function App() {
  const application = (
    <AuthProvider>
      <ConfirmProvider>
        <AppRouter />
        <MobilePwaInstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '8px',
              background: '#1F2937',
              color: '#F9FAFB',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
            error: { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
          }}
        />
      </ConfirmProvider>
    </AuthProvider>
  );

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  return googleClientId
    ? <GoogleOAuthProvider clientId={googleClientId}>{application}</GoogleOAuthProvider>
    : application;
}
