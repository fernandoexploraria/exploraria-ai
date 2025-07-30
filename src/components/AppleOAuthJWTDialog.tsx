import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Loader2, Apple } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AppleOAuthJWTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppleOAuthJWTDialog = ({ open, onOpenChange }: AppleOAuthJWTDialogProps) => {
  const [teamId, setTeamId] = useState("");
  const [servicesId, setServicesId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [generatedJWT, setGeneratedJWT] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jwtInfo, setJwtInfo] = useState<{ expiresAt: string } | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!teamId || !servicesId || !keyId || !privateKey) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-apple-jwt', {
        body: {
          teamId,
          servicesId,
          keyId,
          privateKey,
        },
      });

      if (error) throw error;

      setGeneratedJWT(data.jwt);
      setJwtInfo({ expiresAt: data.expiresAt });
      
      toast({
        title: "JWT Generated Successfully",
        description: "Your Apple OAuth JWT has been generated and is ready to use",
      });
    } catch (error) {
      console.error('Error generating JWT:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate JWT",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyJWT = async () => {
    if (generatedJWT) {
      await navigator.clipboard.writeText(generatedJWT);
      toast({
        title: "Copied to Clipboard",
        description: "JWT copied to clipboard",
      });
    }
  };

  const handleReset = () => {
    setTeamId("");
    setServicesId("");
    setKeyId("");
    setPrivateKey("");
    setGeneratedJWT("");
    setJwtInfo(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Apple className="h-5 w-5" />
            Apple OAuth JWT Generator
          </DialogTitle>
          <DialogDescription>
            Generate a JWT token for Apple OAuth authentication using your Apple Developer credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teamId">Team ID *</Label>
              <Input
                id="teamId"
                placeholder="ABC123DEFG"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="servicesId">Services ID *</Label>
              <Input
                id="servicesId"
                placeholder="com.yourapp.signin"
                value={servicesId}
                onChange={(e) => setServicesId(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="keyId">Key ID *</Label>
            <Input
              id="keyId"
              placeholder="XYZ789ABC1"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="privateKey">Private Key (.p8 file content) *</Label>
            <Textarea
              id="privateKey"
              placeholder="-----BEGIN PRIVATE KEY-----&#10;MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEH...&#10;-----END PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {generatedJWT && (
            <div>
              <Label htmlFor="jwt">Generated JWT</Label>
              <div className="relative">
                <Textarea
                  id="jwt"
                  value={generatedJWT}
                  readOnly
                  rows={8}
                  className="font-mono text-sm pr-12"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={handleCopyJWT}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {jwtInfo && (
                <p className="text-sm text-muted-foreground mt-2">
                  Expires: {new Date(jwtInfo.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate JWT"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};