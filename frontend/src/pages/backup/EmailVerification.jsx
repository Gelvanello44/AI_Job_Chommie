import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mail,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Shield,
  Zap,
  AlertTriangle,
  Send,
  Timer
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const EMAIL_VERIFICATION_STATES = {
  PENDING: 'pending',
  SENT: 'sent',
  VERIFIED: 'verified',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  RESENDING: 'resending'
}

export default function EmailVerification() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [state, setState] = useState(EMAIL_VERIFICATION_STATES.PENDING)
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const [canResend, setCanResend] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Get token and email from URL params (from registration flow)
  const token = searchParams.get('token')
  const emailParam = searchParams.get('email')
  
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
    
    // If token is present, automatically attempt verification
    if (token) {
      handleTokenVerification(token)
    } else if (emailParam) {
      setState(EMAIL_VERIFICATION_STATES.SENT)
      startCountdown()
    }
  }, [token, emailParam])
  
  useEffect(() => {
    let interval = null
    
    if (state === EMAIL_VERIFICATION_STATES.SENT && timeLeft > 0) {
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
  
  const startCountdown = () => {
    setTimeLeft(300) // 5 minutes
    setCanResend(false)
  }
  
  const handleTokenVerification = async (verificationToken) => {
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call to verify token
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate different outcomes based on token
      if (verificationToken === 'expired') {
        setState(EMAIL_VERIFICATION_STATES.EXPIRED)
      } else if (verificationToken === 'invalid') {
        setState(EMAIL_VERIFICATION_STATES.INVALID)
      } else {
        setState(EMAIL_VERIFICATION_STATES.VERIFIED)
        // Redirect to dashboard after successful verification
        setTimeout(() => {
          navigate('/dashboard')
        }, 3000)
      }
    } catch (error) {
      setError('Verification failed. Please try again.')
      setState(EMAIL_VERIFICATION_STATES.INVALID)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleManualVerification = async (e) => {
    e.preventDefault()
    if (!verificationCode) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate verification
      if (verificationCode === '123456') {
        setState(EMAIL_VERIFICATION_STATES.VERIFIED)
        setTimeout(() => {
          navigate('/dashboard')
        }, 3000)
      } else {
        setError('Invalid verification code. Please check and try again.')
      }
    } catch (error) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleResendEmail = async () => {
    if (!canResend || resendCooldown > 0) return
    
    setState(EMAIL_VERIFICATION_STATES.RESENDING)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setState(EMAIL_VERIFICATION_STATES.SENT)
      startCountdown()
      setResendCooldown(60) // 1 minute cooldown
    } catch (error) {
      setError('Failed to resend email. Please try again.')
      setState(EMAIL_VERIFICATION_STATES.SENT)
    }
  }
  
  const handleSendInitialEmail = async (e) => {
    e.preventDefault()
    if (!email) return
    
    setIsLoading(true)
    setError('')
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setState(EMAIL_VERIFICATION_STATES.SENT)
      startCountdown()
    } catch (error) {
      setError('Failed to send verification email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  const renderPendingState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Verify Your Email</CardTitle>
        <CardDescription className="text-gray-300">
          Enter your email address to receive a verification link
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSendInitialEmail} className="space-y-4">
          <div>
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
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Verification Email
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
  
  const renderSentState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
        <CardDescription className="text-gray-300">
          We've sent a verification link to <span className="text-cyan-400 font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-300 mb-4">
            <Timer className="h-4 w-4" />
            <span>Link expires in {formatTime(timeLeft)}</span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((300 - timeLeft) / 300) * 100}%` }}
            />
          </div>
        </div>
        
        <div className="bg-black/20 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-2">Manual Verification</h4>
          <p className="text-gray-400 text-sm mb-3">
            Enter the 6-digit code from the email:
          </p>
          <form onSubmit={handleManualVerification} className="space-y-3">
            <Input
              type="text"
              placeholder="123456"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder-gray-400 text-center text-lg tracking-widest"
              maxLength={6}
            />
            <Button 
              type="submit"
              size="sm" 
              className="w-full"
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Verify Code
            </Button>
          </form>
        </div>
        
        {error && (
          <Alert className="bg-red-500/10 border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="text-center space-y-2">
          <p className="text-gray-400 text-sm">Didn't receive the email?</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={!canResend || resendCooldown > 0 || state === EMAIL_VERIFICATION_STATES.RESENDING}
            className="text-cyan-400 border-cyan-400/30"
          >
            {state === EMAIL_VERIFICATION_STATES.RESENDING ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Resending...
              </>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend Email
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  
  const renderVerifiedState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Email Verified!</CardTitle>
        <CardDescription className="text-gray-300">
          Your email has been successfully verified
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
            <Shield className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm">Account Security Enhanced</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg">
            <Zap className="h-5 w-5 text-blue-400" />
            <span className="text-blue-400 text-sm">Full Platform Access Enabled</span>
          </div>
        </div>
        
        <div className="text-gray-300 text-sm">
          Redirecting to your dashboard in a few seconds...
        </div>
        
        <Button 
          onClick={() => navigate('/dashboard')}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
        >
          <Zap className="h-4 w-4 mr-2" />
          Continue to Dashboard
        </Button>
      </CardContent>
    </Card>
  )
  
  const renderExpiredState = () => (
    <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl text-white">Link Expired</CardTitle>
        <CardDescription className="text-gray-300">
          The verification link has expired
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <Alert className="bg-orange-500/10 border-orange-500/20">
          <Clock className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-400">
            Verification links expire after 5 minutes for security reasons.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button 
            onClick={handleResendEmail}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
            disabled={state === EMAIL_VERIFICATION_STATES.RESENDING}
          >
            {state === EMAIL_VERIFICATION_STATES.RESENDING ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending New Link...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send New Verification Link
              </>
            )}
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
        <CardTitle className="text-2xl text-white">Invalid Link</CardTitle>
        <CardDescription className="text-gray-300">
          The verification link is invalid or has already been used
        </CardDescription>
      </CardHeader>
      
      <CardContent className="text-center space-y-6">
        <Alert className="bg-red-500/10 border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-400">
            This verification link is no longer valid.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-3">
          <Button 
            onClick={handleResendEmail}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
          >
            <Send className="h-4 w-4 mr-2" />
            Request New Verification Link
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/register')}
            className="w-full text-gray-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Registration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
  
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {state === EMAIL_VERIFICATION_STATES.PENDING && renderPendingState()}
        {state === EMAIL_VERIFICATION_STATES.SENT && renderSentState()}
        {state === EMAIL_VERIFICATION_STATES.VERIFIED && renderVerifiedState()}
        {state === EMAIL_VERIFICATION_STATES.EXPIRED && renderExpiredState()}
        {state === EMAIL_VERIFICATION_STATES.INVALID && renderInvalidState()}
        {state === EMAIL_VERIFICATION_STATES.RESENDING && renderSentState()}
        
        {/* Help Section */}
        <Card className="mt-8 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Why verify your email?
            </h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Secure your account from unauthorized access</li>
              <li>• Receive important job alerts and updates</li>
              <li>• Enable password recovery if needed</li>
              <li>• Access all premium platform features</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
