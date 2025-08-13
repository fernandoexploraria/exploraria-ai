import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

export const GeminiAnalysisHelper = () => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const { callGemini, isLoading } = useGeminiAPI();

  const analyzeApplePayCode = async () => {
    const codeToAnalyze = `
export const useApplePurchase = () => {
  const [state, setState] = useState<ApplePurchaseState>({
    isAvailable: false,
    isLoading: true,
    error: null,
    isProcessing: false,
  });

  const { user, session } = useAuth();
  const { toast } = useToast();

  const initializePurchasePlugin = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
        setState(prev => ({ 
          ...prev, 
          isAvailable: false, 
          isLoading: false,
          error: "Apple Pay subscriptions are only available on iOS" 
        }));
        return;
      }

      if (!window.CdvPurchase) {
        setState(prev => ({ 
          ...prev, 
          isAvailable: false, 
          isLoading: false,
          error: "Purchase plugin not available" 
        }));
        return;
      }

      const { store } = window.CdvPurchase;

      store.initialize([
        window.CdvPurchase.Platform?.APPLE_APPSTORE || "APPLE_APPSTORE"
      ]);

      store.register({
        id: "LEXPS0001",
        type: window.CdvPurchase.ProductType?.PAID_SUBSCRIPTION || "PAID_SUBSCRIPTION"
      });

      store.when("product").approved((product: any) => {
        console.log("🍎 Product approved:", product);
        handleTransactionApproved(product);
      });

      store.when("product").finished((product: any) => {
        console.log("🍎 Product finished:", product);
        setState(prev => ({ ...prev, isProcessing: false }));
      });

      store.error((error: any) => {
        console.error("🍎 Purchase error:", error);
        setState(prev => ({ ...prev, isProcessing: false, error: error.message || "Purchase failed" }));
        toast({
          title: "Purchase Error",
          description: error.message || "Failed to complete purchase",
          variant: "destructive"
        });
      });

      store.ready(() => {
        console.log("🍎 Store is ready");
        setState(prev => ({ 
          ...prev, 
          isAvailable: true, 
          isLoading: false,
          error: null 
        }));
      });

      store.refresh();

    } catch (error) {
      console.error("🍎 Failed to initialize purchase plugin:", error);
      setState(prev => ({ 
        ...prev, 
        isAvailable: false, 
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to initialize purchases" 
      }));
    }
  };

  const purchaseSubscription = async () => {
    try {
      if (!state.isAvailable) {
        throw new Error("Apple purchases not available");
      }

      if (!user) {
        throw new Error("Please log in to subscribe");
      }

      if (!window.CdvPurchase) {
        throw new Error("Purchase plugin not available");
      }

      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      console.log("🍎 Initiating purchase for:", "LEXPS0001");
      
      window.CdvPurchase.store.order("LEXPS0001");

    } catch (error) {
      console.error("🍎 Purchase initiation failed:", error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : "Failed to start purchase" 
      }));
      toast({
        title: "Purchase Error",
        description: error instanceof Error ? error.message : "Failed to start purchase",
        variant: "destructive"
      });
    }
  };

  return {
    ...state,
    purchaseSubscription,
  };
};`;

    const prompt = `Analyze this React hook for Apple Pay integration using cordova-plugin-purchase. Look for potential issues, especially around the error "error is not a function" and cordova plugin API usage:

${codeToAnalyze}

What potential issues do you see? Focus on cordova-plugin-purchase API usage patterns and common mistakes.`;

    const systemInstruction = "You are an expert in mobile app development, Cordova plugins, and React hooks. Analyze code for potential issues and provide specific recommendations.";

    const response = await callGemini(prompt, systemInstruction);
    setAnalysis(response);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Gemini Code Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={analyzeApplePayCode} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Apple Pay Code with Gemini'}
        </Button>
        
        {analysis && (
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Gemini's Analysis:</h3>
            <pre className="whitespace-pre-wrap text-sm">{analysis}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};