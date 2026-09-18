import type { APIRoute } from 'astro';

// Edge-compatible HMAC SHA-512 verification
async function verifySignature(text: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' }, 
    false, 
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === signature;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const secret = locals.runtime.env.PAYSTACK_SECRET_KEY;
  
  const signature = request.headers.get('x-paystack-signature');
  const bodyText = await request.text();
  
  // 1. Block unauthorized requests immediately
  if (!signature || !(await verifySignature(bodyText, signature, secret))) {
    return new Response('Unauthorized Lab Access', { status: 401 });
  }

  const event = JSON.parse(bodyText);

  // 2. Process successful payments
  if (event.event === 'charge.success') {
    const { reference, customer, metadata } = event.data;
    
    try {
      // 3. Insert verified bespoke order into D1
      await db.prepare(`
        INSERT INTO bespoke_orders (
          id, customer_name, phone, product_id, fabric_choice, 
          measurements, delivery_location, payment_reference, status
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'LAB_PROCESSING')
      `).bind(
        crypto.randomUUID(),
        customer.email.split('@')[0], // Extract name from email
        metadata.phone || 'N/A',
        metadata.productId,
        metadata.fabricChoice || 'Standard',
        JSON.stringify(metadata.measurements || {}),
        'Abuja Central', // Default routing for CMYK orders
        reference
      ).run();
    } catch (e) {
      console.error("D1 Insert Error", e);
      // Return 200 so Paystack doesn't retry, but log the error
      return new Response("Webhook received, DB insert failed", { status: 200 });
    }
  }

  // 4. Always return 200 OK to Paystack
  return new Response('OK', { status: 200 });
};
