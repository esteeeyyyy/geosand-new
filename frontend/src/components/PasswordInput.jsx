import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({
  className = 'form-input',
  style,
  leadingIcon = null,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;
  const label = visible ? 'Hide password' : 'Show password';

  return (
    <div className="password-input-wrapper">
      {leadingIcon}
      <input
        {...inputProps}
        className={className}
        type={visible ? 'text' : 'password'}
        style={{ ...style, paddingRight: 48 }}
      />
      <button
        type="button"
        className="password-visibility-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        <ToggleIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
