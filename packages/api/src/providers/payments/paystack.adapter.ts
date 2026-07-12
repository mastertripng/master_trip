/**
 * Paystack Payment Adapter
 * 
 * This file isolates all communication with the Paystack API.
 * When we get our production API keys, we only need to update the logic here.
 * No routers (admin, booking) should directly make HTTP requests to Paystack.
 */

export class PaystackAdapter {
  private readonly secretKey: string;
  private readonly baseUrl = "https://api.paystack.co";

  constructor() {
    // Falls back to a mock key in dev so the app doesn't crash
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock";
  }

  /**
   * Verifies that a transaction was actually successful and paid in full.
   * Called by confirmCheckout before marking a trip as PAID.
   */
  async verifyTransaction(reference: string): Promise<{
    success: boolean;
    amount: number;
    currency: string;
    status: string;
  }> {
    if (this.secretKey === "sk_test_mock") {
      console.warn("[PaystackAdapter] Using mock verifyTransaction for ref:", reference);
      return { success: true, amount: 0, currency: "USD", status: "success" }; // Note: In production this returns the actual currency paid
    }

    const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok || !data.status) {
      throw new Error(`Paystack verification failed: ${data.message}`);
    }

    return {
      success: data.data.status === "success",
      amount: data.data.amount / 100, // Paystack returns lowest denomination (kobo/cents), convert to major unit
      currency: data.data.currency,
      status: data.data.status,
    };
  }

  /**
   * Initiates a refund for a captured payment.
   * Note: Paystack requires the original transaction reference or ID.
   */
  async issueRefund(
    paystackReference: string, 
    amountToRefund: number,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    refundId?: string;
    message?: string;
  }> {
    if (this.secretKey === "sk_test_mock") {
      console.warn("[PaystackAdapter] Using mock issueRefund for ref:", paystackReference);
      return { success: true, refundId: `mock_ref_${Date.now()}` };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };

    // Prevent double-refunds on network retries
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch(`${this.baseUrl}/refund`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        transaction: paystackReference,
        amount: amountToRefund * 100, // Convert to lowest denomination (kobo/cents)
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return { success: false, message: data.message };
    }

    return {
      success: true,
      refundId: data.data.id.toString(),
    };
  }
}

// Export a singleton instance to use across routers
export const paystack = new PaystackAdapter();
