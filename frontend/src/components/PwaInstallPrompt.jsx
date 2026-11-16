import { Download, X, Share, MoreVertical } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

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
