import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export const LoginPage = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            navigate('/chat')
        }
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100%',
            background: '#000',
            padding: '2rem'
        }}>
            <div style={{ width: '100%', maxWidth: '360px' }}>
                {/* Logo Section */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        border: '2px solid #fff',
                        margin: '0 auto 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Shield size={28} strokeWidth={1} color="#fff" />
                    </div>
                    <h1 style={{
                        fontSize: '48px',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        margin: 0
                    }}>VANISH.</h1>
                    <p style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: '#666',
                        marginTop: '0.75rem'
                    }}>Secure Access</p>
                </div>

                {/* Form Card */}
                <div style={{
                    background: '#050505',
                    border: '1px solid #111',
                    padding: '2rem'
                }}>
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '9px',
                                fontWeight: 600,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: '#666',
                                marginBottom: '0.5rem'
                            }}>Email</label>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: '#0a0a0a',
                                    border: '1px solid #222',
                                    color: '#fff',
                                    padding: '0.75rem 1rem',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '9px',
                                fontWeight: 600,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: '#666',
                                marginBottom: '0.5rem'
                            }}>Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: '#0a0a0a',
                                    border: '1px solid #222',
                                    color: '#fff',
                                    padding: '0.75rem 1rem',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                background: '#0a0a0a',
                                border: '1px solid #222',
                                color: '#888',
                                fontSize: '10px',
                                textAlign: 'center',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginBottom: '1.25rem'
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                background: '#fff',
                                color: '#000',
                                border: 'none',
                                padding: '1rem',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.2em',
                                cursor: 'pointer',
                                opacity: loading ? 0.5 : 1
                            }}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div style={{
                        borderTop: '1px solid #111',
                        marginTop: '1.5rem',
                        paddingTop: '1.5rem',
                        textAlign: 'center'
                    }}>
                        <Link to="/signup" style={{ textDecoration: 'none' }}>
                            <span style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: '#666'
                            }}>
                                Create Account <span style={{ marginLeft: '0.5rem' }}>→</span>
                            </span>
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <p style={{
                    textAlign: 'center',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#333',
                    marginTop: '2rem'
                }}>Encrypted Connection</p>
            </div>
        </div>
    )
}
