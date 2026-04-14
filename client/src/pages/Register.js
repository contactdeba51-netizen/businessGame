import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { register } = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎲 Monopoly</h1>
        <h2 style={styles.subtitle}>Create Account</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={styles.link}>
          Already have an account?{' '}
          <Link to="/login" style={styles.linkText}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3c5e',
  },
  card: {
    backgroundColor: '#fff',
    padding: '40px',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  title: { fontSize: '2.5rem', color: '#1a3c5e', marginBottom: '8px' },
  subtitle: { fontSize: '1.5rem', color: '#555', marginBottom: '24px' },
  error: {
    backgroundColor: '#fdf0f0',
    color: '#8b1a1a',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '0.9rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: {
    padding: '14px',
    borderRadius: '8px',
    border: '2px solid #b8d4ea',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    padding: '14px',
    backgroundColor: '#1a3c5e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  link: { marginTop: '20px', color: '#555', fontSize: '0.9rem' },
  linkText: { color: '#1a3c5e', fontWeight: 'bold', textDecoration: 'none' },
};

export default Register;