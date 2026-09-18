import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  // Access Cloudflare Edge bindings
  const db = locals.runtime.env.DB;
  const paystackSecret = locals.runtime.env.PAYSTACK_SECRET_KEY;

  // Extract form data from CustomFitForm.astro
  const formData = await request.formData();
  const productId = formData.get('productId')?.toString();
  const fabric = formData.get('fabric')?.toString();
  const chest = formData.get('chest')?.toString();
  const waist = formData.get('waist')?.toString();
  const inseam = formData.get('inseam')?.toString();
  const phone = formData.get('phone')?.toString() || '08000000000'; // Defaulting for now

  if (!productId) {
    return new Response("Missing Product ID", { status: 400 });
  }

  // 1. Verify immutable price from D1 Database
  const product = await db.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first();
  
  if (!product) {
    return new Response("Streetwear piece not found in the lab", { status: 404 });
  }

  // 2. Initialize Paystack Transaction (Amount must be in Kobo)
  const amountInKobo = (product.base_price as number) * 100;
  
  const payload = {
    email: "lab-client@cmyk.ng", 
    amount: amountInKobo,
    callback_url: `https://cmyk-streetwear.pages.dev/admin`, // Redirects to admin floor after payment
    metadata: {
      productId,
      fabricChoice: fabric,
      measurements: { chest, waist, inseam },
      phone
    }
  };

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.status) {
      return new Response("Payment initialization failed", { status: 400 });
    }

    // 3. Redirect customer directly to Paystack's secure checkout
    return Response.redirect(data.data.authorization_url, 303);
    
  } catch (error) {
    return new Response("Edge network error", { status: 500 });
  }
};
