import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Mail, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EmailTest() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('p8d8pgqrsr@privaterelay.appleid.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  
  const testPasswordResetEmail = async () => {
    if (!email) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      
      if (error) {
        setResult({
          type: 'error',
          message: `Error: ${error.message}`
        });
      } else {
        setResult({
          type: 'success',
          message: 'Password reset email sent successfully! Check your email (including spam folder).'
        });
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const testSignupEmail = async () => {
    if (!email) return;
    
    setLoading(true);
    setResult(null);
    
    try {
      // Use a temporary password for testing
      const { error } = await supabase.auth.signUp({
        email,
        password: 'TempPassword123!',
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          setResult({
            type: 'info',
            message: 'Email already registered. Try the password reset test instead.'
          });
        } else {
          setResult({
            type: 'error',
            message: `Error: ${error.message}`
          });
        }
      } else {
        setResult({
          type: 'success',
          message: 'Signup confirmation email sent successfully! Check your email (including spam folder).'
        });
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Email Delivery Test</h1>
            <p className="text-muted-foreground">
              Test Supabase email delivery to Apple Hide My Email addresses
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <Alert className="mb-6">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <strong>Temporary Testing Page</strong> - This page is for testing email delivery 
            and will be removed after confirming Apple Hide My Email compatibility.
          </AlertDescription>
        </Alert>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Delivery Tests
            </CardTitle>
            <CardDescription>
              Test different types of emails sent by Supabase's infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Test Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address to test"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Default is your Apple Hide My Email address for testing
              </p>
            </div>

            {/* Test Buttons */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Button
                  onClick={testPasswordResetEmail}
                  disabled={loading || !email}
                  className="w-full"
                >
                  {loading ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Test Password Reset Email
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sends a password reset email (safe to test, no account changes)
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={testSignupEmail}
                  disabled={loading || !email}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Test Signup Confirmation Email
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sends a signup confirmation email (creates temporary account)
                </p>
              </div>
            </div>

            {/* Results */}
            {result && (
              <Alert className={`
                ${result.type === 'success' ? 'border-green-200 bg-green-50' : ''}
                ${result.type === 'error' ? 'border-red-200 bg-red-50' : ''}
                ${result.type === 'info' ? 'border-blue-200 bg-blue-50' : ''}
              `}>
                {result.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {result.type === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                {result.type === 'info' && <Clock className="h-4 w-4 text-blue-600" />}
                <AlertDescription className={`
                  ${result.type === 'success' ? 'text-green-800' : ''}
                  ${result.type === 'error' ? 'text-red-800' : ''}
                  ${result.type === 'info' ? 'text-blue-800' : ''}
                `}>
                  {result.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Testing Instructions:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>1. Use your Apple Hide My Email address above</li>
                <li>2. Click either test button to send an email</li>
                <li>3. Check your iCloud email for delivery</li>
                <li>4. Note delivery time and any issues</li>
                <li>5. Check spam folder if email doesn't arrive</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}