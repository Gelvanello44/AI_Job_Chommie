import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Shield,
  Key,
  Timer
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const RESET_STATES = {
  REQUEST: 'request',
  SENT: 'sent', 
  RESET: 'reset',
  SUCCESS: 'success',
  EXPIRED: 'expired',
  INVALID: 'invalid'
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [state, setState] = useState(RESET_STATES.REQUEST)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 minutes
  const [canResend, setCanResend] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  
  // Get token from URL params
  const token = searchParams.get('token')
  const emailParam = searchParams.get('email')
  
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
    
    // If token is present, show password reset form
    if (token) {
      validateToken(token)
    }
  }, [token, emailParam])
  
  useEffect(() => {
    let interval = null
    
    if (state === RESET_STATES.SENT && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            setCanResend(true)
            return 0
          }
          return prevTime - 1
        })
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state, timeLeft])
  
  useEffect(() => {
    let resendInterval = null
    
    if (resendCooldown > 0) {
      resendInterval = setInterval(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
    }
    
    return () => {
      if (resendInterval) clearInterval(resendInterval)
    }
  }, [resendCooldown])
  
  const validateToken = async (resetToken) => {
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call to validate token
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate different token states
      if (resetToken === 'expired') {
        setState(RESET_STATES.EXPIRED)
      } else if (resetToken === 'invalid') {
        setState(RESET_STATES.INVALID)
      } else {
        setState(RESET_STATES.RESET)
        setTimeLeft(900) // 15 minutes to complete reset
      }
    } catch (error) {
      setError('Failed to validate reset token')
      setState(RESET_STATES.INVALID)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleRequestReset = async (e) => {
    e.preventDefault()
    if (!email) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setState(RESET_STATES.SENT)
      setTimeLeft(900) // 15 minutes
      setCanResend(false)
    } catch (error) {
      setError('Failed to send reset email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handlePasswordReset = async (e) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setState(RESET_STATES.SUCCESS)
    } catch (error) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleResendEmail = async () => {
    if (resendCooldown > 0) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setTimeLeft(900)
      setCanResend(false)
      setResendCooldown(60) // 1 minute cooldown
    } catch (error) {
      setError('Failed to resend email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  const getPasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++
    if (password.match(/\d/)) strength++
    if (password.match(/[^a-zA-Z\d]/)) strength++
    
    if (strength <= 1) return { level: 'weak', color: 'bg-red-500', text: 'Weak' }
    if (strength <= 2) return { level: 'medium', color: 'bg-yellow-500', text: 'Medium' }
    if (strength <= 3) return { level: 'good', color: 'bg-blue-500', text: 'Good' }
    return { level: 'strong', color: 'bg-green-500', text: 'Strong' }
  }
  
  const renderRequestState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Reset Your Password</CardTitle>
        <CardDescription className="text-gray-300">
          Enter your email address and we'll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 mb-2 block">Email Address</label>
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              required
            />
          </div>
          
          {error && (
            <Alert className="bg-red-500/10 border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending Reset Link...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Reset Link
              </>
            )}
          </Button>
          
          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/login')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
  
  const renderSentState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
        <CardDescription className="text-gray-300">
          We've sent a password reset link to <span className="text-cyan-400 font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-300 mb-4">
            <Timer className="h-4 w-4" />
            <span>Link expires in {formatTime(timeLeft)}</span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((900 - timeLeft) / 900) * 100}%` }}
            />
          </div>
        </div>
        
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Mail className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-400">
            <div className="font-medium mb-1">Didn't receive the email?</div>
            <div className="text-sm">Check your spam folder or try resending the link.</div>
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleResendEmail}
            disabled={!canResend || resendCooldown > 0 || isLoading}
            className="text-cyan-400 border-cyan-400/30"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Resending...
              </>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend Reset Link
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  
  const renderResetState = () => {
    const passwordStrength = getPasswordStrength(newPassword)
    
    return (
      <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Set New Password</CardTitle>
          <CardDescription className="text-gray-300">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 mb-2 block">New Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {newPassword && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Password Strength</span>
                    <span className={passwordStrength.level === 'strong' ? 'text-green-400' : passwordStrength.level === 'good' ? 'text-blue-400' : passwordStrength.level === 'medium' ? 'text-yellow-400' : 'text-red-400'}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div className={`${passwordStrength.color} h-1 rounded-full transition-all duration-300`} style={{ width: `${(Object.keys(RESET_STATES).indexOf(passwordStrength.level) + 1) * 25}%` }} />
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm text-gray-300 mb-2 block">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-gray-400 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="bg-black/20 p-3 rounded-lg">
              <h4 className="text-white font-medium text-sm mb-2">Password Requirements:</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-400' : ''}`}>
                  <CheckCircle className="h-3 w-3" />
                  At least 8 characters long
                </li>
                <li className={`flex items-center gap-2 ${newPassword.match(/[a-z]/) && newPassword.match(/[A-Z]/) ? 'text-green-400' : ''}`}>
                  <CheckCircle className="h-3 w-3" />
                  Upper and lowercase letters
                </li>
                <li className={`flex items-center gap-2 ${newPassword.match(/\d/) ? 'text-green-400' : ''}`}>
                  <CheckCircle className="h-3 w-3" />
                  At least one number
                </li>
                <li className={`flex items-center gap-2 ${newPassword.match(/[^a-zA-Z\d]/) ? 'text-green-400' : ''}`}>
                  <CheckCircle className="h-3 w-3" />
                  Special character (!@#$%^&*)
                </li>
              </ul>
            </div>
            
            {error && (
              <Alert className="bg-red-500/10 border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="text-center text-gray-400 text-sm flex items-center justify-center gap-1">
              <Timer className="h-4 w-4" />
              Session expires in {formatTime(timeLeft)}
            </div>
            
            <Button 
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }
  
  const renderSuccessState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Password Updated!</CardTitle>
        <CardDescription className="text-gray-300">
          Your password has been successfully updated
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
            <Shield className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm">Your account is now secure</span>
          </div>
        </div>
        
        <Button 
          onClick={() => navigate('/login')}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
        >
          <Lock className="h-4 w-4 mr-2" />
          Sign In with New Password
        </Button>
      </CardContent>
    </Card>
  )
  
  const renderExpiredState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Timer className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Reset Link Expired</CardTitle>
        <CardDescription className="text-gray-300">
          This password reset link has expired
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <Alert className="bg-orange-500/10 border-orange-500/20">
          <Timer className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-400">
            Reset links expire after 15 minutes for security reasons.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button 
            onClick={() => setState(RESET_STATES.REQUEST)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
          >
            <Send className="h-4 w-4 mr-2" />
            Request New Reset Link
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/login')}
            className="w-full text-gray-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  
  const renderInvalidState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Invalid Reset Link</CardTitle>
        <CardDescription className="text-gray-300">
          This password reset link is invalid or has already been used
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <Alert className="bg-red-500/10 border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            This reset link is no longer valid.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button 
            onClick={() => setState(RESET_STATES.REQUEST)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
          >
            <Send className="h-4 w-4 mr-2" />
            Request New Reset Link
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/login')}
            className="w-full text-gray-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {state === RESET_STATES.REQUEST && renderRequestState()}
        {state === RESET_STATES.SENT && renderSentState()}
        {state === RESET_STATES.RESET && renderResetState()}
        {state === RESET_STATES.SUCCESS && renderSuccessState()}
        {state === RESET_STATES.EXPIRED && renderExpiredState()}
        {state === RESET_STATES.INVALID && renderInvalidState()}
        
        {/* Security Notice */}
        <Card className="mt-8 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Tips
            </h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Use a unique password you haven't used elsewhere</li>
              <li>• Include a mix of letters, numbers, and symbols</li>
              <li>• Reset links expire after 15 minutes for security</li>
              <li>• Never share your password with anyone</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
