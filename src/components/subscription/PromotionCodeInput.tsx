import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Tag, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PromotionCodeInputProps {
  onPromotionApplied: (promotionCodeId: string, newAmount: number, message: string) => void;
  onPromotionRemoved: () => void;
  originalAmount: number;
  disabled?: boolean;
}

export const PromotionCodeInput: React.FC<PromotionCodeInputProps> = ({
  onPromotionApplied,
  onPromotionRemoved,
  originalAmount,
  disabled = false,
}) => {
  const [promoCode, setPromoCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<{
    message: string;
    newAmount: number;
    promotionCodeId: string;
  } | null>(null);

  const handleApplyCode = async () => {
    if (!promoCode.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke('validate-promo-code', {
        body: { couponCode: promoCode.trim() }
      });

      if (error) throw error;

      if (data.valid) {
        const promoData = {
          message: data.message,
          newAmount: data.newAmount,
          promotionCodeId: data.promotionCodeId,
        };
        
        setAppliedPromo(promoData);
        onPromotionApplied(data.promotionCodeId, data.newAmount, data.message);
        setPromoCode("");
      } else {
        setError(data.message || "Invalid promotion code");
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      setError("Failed to apply promotion code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCode = () => {
    setAppliedPromo(null);
    setError("");
    onPromotionRemoved();
  };

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  if (appliedPromo) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="flex items-center justify-between">
              <span>{appliedPromo.message}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCode}
                disabled={disabled}
                className="text-green-600 hover:text-green-700"
              >
                Remove
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <div className="text-lg font-semibold">
            <span className="line-through text-muted-foreground">
              ${formatAmount(originalAmount)}
            </span>
            {" "}
            <span className="text-green-600">
              ${formatAmount(appliedPromo.newAmount)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">per month</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Have a promotion code?
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter promotion code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            disabled={isLoading || disabled}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApplyCode();
              }
            }}
          />
          <Button
            onClick={handleApplyCode}
            disabled={!promoCode.trim() || isLoading || disabled}
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Apply"
            )}
          </Button>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      
      <div className="text-center">
        <div className="text-lg font-semibold">
          ${formatAmount(originalAmount)}
        </div>
        <p className="text-sm text-muted-foreground">per month</p>
      </div>
    </div>
  );
};