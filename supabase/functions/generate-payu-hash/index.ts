import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PayU Hash Generation Algorithm
// Hash = sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
function generatePayUHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
}): string {
  const { key, txnid, amount, productinfo, firstname, email, salt } = params;

  // PayU hash string format
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;

  // Generate SHA-512 hash
  // Note: In Deno, we'll use the Web Crypto API
  return hashString; // We'll implement SHA-512 below
}

async function sha512(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-512", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

interface PayUHashRequest {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get request body
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
    }: PayUHashRequest = await req.json();

    // Validate required fields
    if (!txnid || !amount || !productinfo || !firstname || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: txnid, amount, productinfo, firstname, email",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get PayU credentials from environment, or use test credentials
    // PayU Test Credentials (for testing without API keys)
    const payuKey = Deno.env.get("PAYU_KEY") || "gtKFFx";
    const payuSalt = Deno.env.get("PAYU_SALT") || "eCwWELxi";
    
    // If using test credentials, log it
    if (!Deno.env.get("PAYU_KEY") || !Deno.env.get("PAYU_SALT")) {
      console.log("Using PayU test credentials (default test account)");
    }

    // Generate PayU hash
    // Hash format: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
    // udf fields are optional and can be empty
    const hashString = `${payuKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${payuSalt}`;
    
    const hash = await sha512(hashString);

    console.log("PayU hash generated successfully for transaction:", txnid);

    return new Response(
      JSON.stringify({
        success: true,
        hash,
        key: payuKey,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating PayU hash:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to generate payment hash",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

