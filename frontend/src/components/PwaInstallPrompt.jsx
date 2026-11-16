import { useEffect, useState } from 'react';
import { Download, X, Share, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const MOBILE_INSTALL_DISMISSED_KEY = 'geosand:pwa-native-install-dismissed-v2';

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches
    || /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
};

/**
 * App-level mobile install prompt. Browsers do not allow the native PWA
 * dialog to open without a user gesture, so this modal provides the gesture
 * through its Install button. On Android, the modal waits until that native
 * prompt is ready instead of showing a manual browser-menu guide. iOS still
 * receives Add to Home Screen instructions because it has no native event.
 */
export function MobilePwaInstallPrompt() {
  const { isInstallable, isInstalled, isIos, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isInstalled || (!isIos && !isInstallable)) {
      return undefined;
    }
    if (window.sessionStorage.getItem(MOBILE_INSTALL_DISMISSED_KEY) === 'true') return undefined;

    const timer = window.setTimeout(() => setVisible(true), 100);
    return () => window.clearTimeout(timer);
  }, [isInstalled, isInstallable, isIos]);

  const dismiss = () => {
    window.sessionStorage.setItem(MOBILE_INSTALL_DISMISSED_KEY, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (isInstallable && !isIos) {
      await promptInstall();
    }
    dismiss();
  };

  if (!visible || isInstalled) return null;

  const showManualSteps = isIos;

  return (
    <div className="pwa-ios-overlay" role="presentation" onClick={dismiss}>
      <div
        className="pwa-ios-modal pwa-mobile-install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-install-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="pwa-ios-close" onClick={dismiss} aria-label="Close install prompt">
          <X size={20} />
        </button>
        <div className="pwa-ios-icon">
          <Download size={32} />
        </div>
        <h3 id="mobile-install-title">Install Geosand</h3>
        <p>Add Geosand to your home screen for faster access and a full-screen app experience.</p>

        {showManualSteps ? (
          <div className="pwa-ios-steps">
            <div className="pwa-ios-step">
              <span className="pwa-ios-step-num">1</span>
              <span>
                Tap the <strong>Share</strong> <Share size={16} className="pwa-inline-icon" /> button
              </span>
            </div>
            <div className="pwa-ios-step">
              <span className="pwa-ios-step-num">2</span>
              <span>Tap <strong>Add to Home Screen</strong></span>
            </div>
            <div className="pwa-ios-step">
              <span className="pwa-ios-step-num">3</span>
              <span>Tap <strong>Add</strong> or <strong>Install</strong> to confirm</span>
            </div>
          </div>
        ) : (
          <div className="pwa-install-benefits">
            <span><CheckCircle2 size={17} /> Launch directly from your home screen</span>
            <span><CheckCircle2 size={17} /> Use a clean, full-screen app window</span>
            <span><CheckCircle2 size={17} /> Keep saved map resources available offline</span>
          </div>
        )}

        <div className="pwa-mobile-install-actions">
          <button type="button" className="btn btn-secondary" onClick={dismiss}>Not now</button>
          <button type="button" className="btn btn-primary" onClick={install}>
            <Download size={17} /> {showManualSteps ? 'Got it' : 'Install app'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PWA Install Button — renders an install button in navigation bars.
 * On Android/Chrome it triggers the native install dialog.
 * On iOS it shows manual instructions.
 */
export function PwaInstallButton({ variant = 'default' }) {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();

  if (isInstalled || !isInstallable) return null;

  if (variant === 'sidebar') {
    return (
      <button
        className="sidebar-link pwa-install-sidebar-btn"
        onClick={promptInstall}
        title="Install App"
      >
        <Download className="link-icon" size={20} />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <button className="btn btn-primary btn-sm pwa-install-btn" onClick={promptInstall}>
      <Download size={16} />
      Install App
    </button>
  );
}

/**
 * iOS Install Instructions Modal.
 * Place this once at the app root level.
 */
export function IosInstallModal() {
  const { showIosPrompt, dismissIosPrompt, isIos, isInstalled } = usePwaInstall();

  if (!isIos || isInstalled || !showIosPrompt) return null;

  return (
    <div className="pwa-ios-overlay" onClick={dismissIosPrompt}>
      <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pwa-ios-close" onClick={dismissIosPrompt}>
          <X size={20} />
        </button>
        <div className="pwa-ios-icon">
          <Download size={32} />
        </div>
        <h3>Install Geosand</h3>
        <p>Add this app to your home screen for a better experience.</p>
        <div className="pwa-ios-steps">
          <div className="pwa-ios-step">
            <span className="pwa-ios-step-num">1</span>
            <span>
              Tap the <strong>Share</strong> button
              <Share size={16} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
            </span>
          </div>
          <div className="pwa-ios-step">
            <span className="pwa-ios-step-num">2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
          </div>
          <div className="pwa-ios-step">
            <span className="pwa-ios-step-num">3</span>
            <span>Tap <strong>"Add"</strong> to confirm</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={dismissIosPrompt} style={{ width: '100%', marginTop: 8 }}>
          Got it
        </button>
      </div>
    </div>
  );
}
