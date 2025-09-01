import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, Copy, Check, AlertCircle, QrCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import QRCode from 'qrcode';

const TwoFactorSetup = ({ userId, onComplete }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    checkTwoFactorStatus();
  }, []);

  const checkTwoFactorStatus = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setIsEnabled(data.enabled);
    } catch (error) {
      console.error('Failed to check 2FA status:', error);
    }
  };

  const generateTwoFactorSecret = async () => {
    try {
      const response = await fetch('/api/auth/2fa/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setSecretKey(data.secret);
      setBackupCodes(data.backupCodes);
      
      // Generate QR code
      const otpAuthUrl = `otpauth://totp/AI Job Chommie:${data.email}?secret=${data.secret}&issuer=AI Job Chommie`;
      const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
      setQrCodeUrl(qrDataUrl);
      
      setShowSetup(true);
    } catch (error) {
      console.error('Failed to generate 2FA secret:', error);
      toast.error('Failed to generate 2FA secret');
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          token: verificationCode,
          secret: secretKey
        })
      });

      if (response.ok) {
        setIsEnabled(true);
        setShowSetup(false);
        setShowBackupCodes(true);
        toast.success('Two-factor authentication enabled successfully!');
        
        if (onComplete) {
          onComplete();
        }
      } else {
        toast.error('Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      toast.error('Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  const disableTwoFactor = async () => {
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setIsEnabled(false);
        toast.success('Two-factor authentication disabled');
      }
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      toast.error('Failed to disable 2FA');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(''), 2000);
    toast.success('Copied to clipboard');
  };

  const downloadBackupCodes = () => {
    const content = `AI Job Chommie - Backup Codes\n${'-'.repeat(30)}\n\nSave these codes in a secure place.\nEach code can only be used once.\n\n${backupCodes.join('\n')}\n\n${'-'.repeat(30)}\nGenerated: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-job-chommie-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEnabled ? (
            <div className="space-y-4">
              <Alert>
                <Check className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Two-factor authentication is <strong>enabled</strong> for your account.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBackupCodes(true)}>
                  View Backup Codes
                </Button>
                <Button variant="destructive" onClick={disableTwoFactor}>
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication is not enabled. Enable it to secure your account.
                </AlertDescription>
              </Alert>
              
              <Button onClick={generateTwoFactorSecret}>
                <Shield className="h-4 w-4 mr-2" />
                Enable Two-Factor Authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Follow these steps to enable 2FA on your account
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Step 1: Install App */}
            <div>
              <h3 className="font-semibold mb-2">Step 1: Install Authenticator App</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Install an authenticator app on your phone. We recommend:
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Google Authenticator</Button>
                <Button variant="outline" size="sm">Microsoft Authenticator</Button>
                <Button variant="outline" size="sm">Authy</Button>
              </div>
            </div>

            {/* Step 2: Scan QR Code */}
            <div>
              <h3 className="font-semibold mb-2">Step 2: Scan QR Code</h3>
              <div className="flex gap-4">
                {qrCodeUrl && (
                  <div className="border rounded p-4 bg-white">
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-3">
                    Scan this QR code with your authenticator app, or enter the key manually:
                  </p>
                  <div className="space-y-2">
                    <Label>Manual Entry Key</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={secretKey} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(secretKey, 'secret')}
                      >
                        {copiedCode === 'secret' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Verify */}
            <div>
              <h3 className="font-semibold mb-2">Step 3: Verify Setup</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Enter the 6-digit code from your authenticator app:
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="font-mono text-lg tracking-wider"
                />
                <Button 
                  onClick={verifyAndEnable}
                  disabled={isVerifying || verificationCode.length !== 6}
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetup(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup Recovery Codes</DialogTitle>
            <DialogDescription>
              Save these codes in a secure place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Store these codes securely. You'll need them if you lose access to your authenticator app.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
            {backupCodes.map((code, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 p-2 bg-background rounded"
              >
                <span>{code}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(code, `code-${index}`)}
                >
                  {copiedCode === `code-${index}` ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={downloadBackupCodes}>
              Download Codes
            </Button>
            <Button onClick={() => setShowBackupCodes(false)}>
              I've Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorSetup;
