import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TravelExpertReminderRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: TravelExpertReminderRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "Exploraria <noreply@lovable.exploraria.com>",
      to: [email],
      subject: "Continue Your Travel Expert Application on Desktop",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">Complete Your Travel Expert Application</h1>
          
          <p>Hello!</p>
          
          <p>Thank you for your interest in becoming a Travel Expert with Exploraria. To complete your application, please visit our desktop version where you can:</p>
          
          <ul style="margin: 20px 0; padding-left: 20px;">
            <li>Fill out detailed forms</li>
            <li>Upload business documents</li>
            <li>Set up your Stripe Connected Account</li>
            <li>Configure your expert profile</li>
          </ul>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #374151;">Continue on Desktop:</h3>
            <a href="https://lovable.exploraria.com" style="font-size: 18px; color: #2563eb; text-decoration: none; font-weight: bold;">
              https://lovable.exploraria.com
            </a>
          </div>
          
          <p>The onboarding process is optimized for desktop browsers to ensure the best experience when handling forms and file uploads.</p>
          
          <p>We look forward to having you as part of our Travel Expert community!</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            The Exploraria Team
          </p>
        </div>
      `,
    });

    console.log("Travel Expert reminder email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Reminder email sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-travel-expert-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);