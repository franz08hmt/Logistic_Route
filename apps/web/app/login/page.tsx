'use client';

import { FormEvent, useState } from 'react';

import { useAuth } from '@/context/AuthContext';

const demoAccounts = [
  {
    role: 'ADMIN',
    label: 'Quản trị viên',
    email: 'admin@logiroute.vn',
    password: '123456',
  },
  {
    role: 'DISPATCHER',
    label: 'Điều phối viên',
    email: 'dispatcher@logiroute.vn',
    password: '123456',
  },
  {
    role: 'DRIVER',
    label: 'Tài xế',
    email: 'driver1@logiroute.vn',
    password: '123456',
  },
] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('dispatcher@logiroute.vn');
  const [password, setPassword] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể đăng nhập vào hệ thống.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-labelledby="login-heading">
        <div>
          <span className="login-logo-mark" aria-hidden="true">LR</span>
          <p className="login-brand">LogiRoute VN</p>
        </div>
        <div className="login-visual-copy">
          <span className="eyebrow">Smart logistics platform</span>
          <h1 id="login-heading">Điều phối thông minh.<br />Giao hàng đúng hẹn.</h1>
          <p>
            Quản lý đơn hàng, đội xe và tối ưu lộ trình trên một không gian
            vận hành thống nhất.
          </p>
        </div>
        <div className="login-system-status">
          <span aria-hidden="true" />
          Hệ thống sẵn sàng
        </div>
      </section>

      <section className="login-panel" aria-label="Đăng nhập LogiRoute VN">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="eyebrow">Operations console</span>
            <h2>Chào mừng trở lại</h2>
            <p>Đăng nhập để tiếp tục quản lý hoạt động logistics.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label htmlFor="login-password">
              Mật khẩu
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button
              className="login-submit"
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <span className="login-spinner" aria-hidden="true" />}
              {isSubmitting ? 'Đang xác thực…' : 'Đăng nhập'}
            </button>
          </form>

          <div className="demo-accounts">
            <div className="demo-heading">
              <span>Tài khoản dùng thử</span>
              <small>Bấm để điền nhanh</small>
            </div>
            <div className="demo-account-list">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="demo-account"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError(null);
                  }}
                >
                  <span className={`role-badge role-${account.role.toLowerCase()}`}>
                    {account.role}
                  </span>
                  <span>
                    <strong>{account.label}</strong>
                    <small>{account.email} / 123456</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
