import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, Lock, LogIn, Mail, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { googleLogin as apiGoogleLogin, login as apiLogin } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/PasswordInput';

const dashboardForRole = {
  admin: '/admin/dashboard',
  quarry_operator: '/operator/dashboard',
  quarry_staff: '/staff/dashboard',
  checkpoint_officer: '/checkpoint/dashboard',
};

const getGoogleButtonWidth = () => {
  if (typeof window === 'undefined') return 320;
  return Math.min(320, Math.max(200, window.innerWidth - 88));
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(getGoogleButtonWidth);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    const handleResize = () => setGoogleButtonWidth(getGoogleButtonWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const completeLogin = (response) => {
    const user = response.data.user;
    login(user, response.data.token);
    navigate(dashboardForRole[user.role] || '/');
    toast.success(`Welcome, ${user.name}!`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await apiLogin(email, password);
      completeLogin(response);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential || googleLoading) return;
    setGoogleLoading(true);

    try {
      const response = await apiGoogleLogin(credentialResponse.credential);
      completeLogin(response);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card animate-slideUp">
          <Link to="/" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="login-header">
            <div className="login-logo">
              <MapPin size={28} />
            </div>
            <h1>Geosand</h1>
            <p>Quarry Mapping & Management System</p>
          </div>

          <div className="login-divider">Sign in to your account</div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  style={{ paddingLeft: 40 }}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ paddingLeft: 40 }}
                leadingIcon={<Lock size={18} className="password-leading-icon" aria-hidden="true" />}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || googleLoading}>
              <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="login-divider">or</div>
              <div className="google-login-container" aria-busy={googleLoading}>
                <GoogleLogin
                  key={googleButtonWidth}
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google sign-in was cancelled or could not start.')}
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                  size="large"
                  width={googleButtonWidth}
                />
              </div>
              {googleLoading && <p className="google-login-status">Verifying your Google account...</p>}
            </>
          )}

          <p className="text-xs text-muted text-center" style={{ marginTop: 24 }}>
            Only pre-registered accounts can sign in.<br />
            Contact the administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}
