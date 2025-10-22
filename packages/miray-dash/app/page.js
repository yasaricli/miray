'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConnectionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    host: 'localhost',
    port: '7779',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store connection info in sessionStorage
        sessionStorage.setItem('miray_connection', JSON.stringify(formData));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="connection-page">
      <div className="connection-card">
        <div className="text-center mb-4">
          <h1 className="logo-text">MIRAY</h1>
          <p className="text-muted">Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="host" className="form-label">
              Server Host
            </label>
            <input
              type="text"
              className="form-control"
              id="host"
              name="host"
              value={formData.host}
              onChange={handleChange}
              required
              placeholder="localhost"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="port" className="form-label">
              Port
            </label>
            <input
              type="number"
              className="form-control"
              id="port"
              name="port"
              value={formData.port}
              onChange={handleChange}
              required
              placeholder="7779"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="username" className="form-label">
              Username <span className="text-muted">(optional)</span>
            </label>
            <input
              type="text"
              className="form-control"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="admin"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label">
              Password <span className="text-muted">(optional)</span>
            </label>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        <div className="text-center mt-4">
          <small className="text-muted">
            MIRAY Dashboard v1.0.0
          </small>
        </div>
      </div>
    </div>
  );
}
