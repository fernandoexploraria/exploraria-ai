-- Create payments table to track comprehensive payment information
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  tour_id UUID NOT NULL REFERENCES public.generated_tours(id) ON DELETE CASCADE,
  tour_guide_id TEXT NOT NULL,
  tourist_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  platform_fee_amount NUMERIC(10,2) NOT NULL,
  tour_guide_payout_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requires_payment_method',
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments table
CREATE POLICY "Users can view their own payments as tourists" 
ON public.payments 
FOR SELECT 
USING (auth.uid() = tourist_user_id);

CREATE POLICY "Users can view payments for their tours as guides" 
ON public.payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.generated_tours 
  WHERE id = payments.tour_id 
  AND user_id = auth.uid()
));

CREATE POLICY "System can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update payments" 
ON public.payments 
FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_tour_id ON public.payments(tour_id);
CREATE INDEX idx_payments_tourist_user_id ON public.payments(tourist_user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_payments_updated_at();