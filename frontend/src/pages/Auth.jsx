import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

export function LoginPage() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      nav('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-6">Login</h1>
        {error && <div className="text-red-400 mb-4">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <input className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <div className="relative">
            <input 
              className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg text-white" 
              placeholder="Password" 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <div className="text-gray-300 mt-4">No account? <Link to="/signup" className="text-cyan-400">Sign up</Link></div>
      </div>
    </div>
  )
}

export function SignupPage() {
  const nav = useNavigate()
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signup(email, password)
      nav('/login')
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-6">Create account</h1>
        {error && <div className="text-red-400 mb-4">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <input className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <div className="relative">
            <input 
              className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg text-white" 
              placeholder="Password" 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button disabled={loading} className="w-full bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 rounded-lg">{loading ? 'Creating...' : 'Sign up'}</button>
        </form>
        <div className="text-gray-300 mt-4">Have an account? <Link to="/login" className="text-cyan-400">Login</Link></div>
      </div>
    </div>
  )
}

