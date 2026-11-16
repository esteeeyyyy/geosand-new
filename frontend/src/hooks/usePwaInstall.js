import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to handle PWA install prompt.
 * Captures the `beforeinstallprompt` event and provides
 * a function to trigger the native install dialog.
 *
 * On iOS/Safari, where `beforeinstallprompt` is not supported,
 * it detects the platform and shows manual instructions instead.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    // On iOS, show the install option since beforeinstallprompt won't fire
    if (isIosDevice) {
      setIsInstallable(true);
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, Samsung, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowIosPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (isIos) {
      setShowIosPrompt(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt, isIos]);

  const dismissIosPrompt = useCallback(() => {
    setShowIosPrompt(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIos,
    showIosPrompt,
    promptInstall,
    dismissIosPrompt,
  };
}
