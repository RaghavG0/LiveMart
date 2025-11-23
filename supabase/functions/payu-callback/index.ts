import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha512(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-512", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Verify PayU hash for response
async function verifyPayUHash(params: {
  salt: string;
  status: string;
  firstname: string;
  amount: string;
  txnid: string;
  posted_hash: string;
  key: string;
  productinfo: string;
  email: string;
}): Promise<boolean> {
  const { salt, status, firstname, amount, txnid, posted_hash, key, productinfo, email } = params;

  // PayU response hash format: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const calculatedHash = await sha512(hashString);

  return calculatedHash.toLowerCase() === posted_hash.toLowerCase();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // PayU sends data via POST form
    const formData = await req.formData();
    const payuData: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      payuData[key] = value.toString();
    }

    console.log("PayU callback received:", payuData);

    const {
      txnid,
      status,
      amount,
      productinfo,
      firstname,
      email,
      hash,
      key,
      bank_ref_num,
      payment_source,
    } = payuData;

    // Extract order ID from txnid (format: ORDER_<orderId>_<timestamp>)
    const orderIdMatch = txnid.match(/^ORDER_(.+?)_\d+$/);
    if (!orderIdMatch) {
      throw new Error("Invalid transaction ID format");
    }
    const orderId = orderIdMatch[1];

    // Verify hash
    const payuSalt = Deno.env.get("PAYU_SALT");
    const payuKey = Deno.env.get("PAYU_KEY") || key;

    if (!payuSalt) {
      throw new Error("PayU salt not configured");
    }

    const isValidHash = await verifyPayUHash({
      salt: payuSalt,
      status,
      firstname,
      amount,
      txnid,
      posted_hash: hash || "",
      key: payuKey,
      productinfo,
      email,
    });

    if (!isValidHash) {
      console.error("Invalid PayU hash for transaction:", txnid);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid hash",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update order payment status
    const paymentStatus = status === "success" ? "paid" : "failed";
    
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: paymentStatus,
        status: status === "success" ? "confirmed" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      throw updateError;
    }

    console.log(`Order ${orderId} payment status updated to: ${paymentStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment status updated",
        orderId,
        paymentStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("PayU callback error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to process callback",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

