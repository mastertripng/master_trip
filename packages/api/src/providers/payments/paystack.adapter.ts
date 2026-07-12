// Remove top-level import to avoid Turbopack module evaluation crashes
// We will dynamically require it inside the adapter when needed.

/**
 * Paystack Payment Adapter (Refactored using Node SDK)
 * 
 * This isolates all communication with the Paystack API using the paystack-api SDK.
 */

export class PaystackAdapter {
  private readonly secretKey: string;
  private client: any | null = null; // Instantiated lazily

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock";
  }

  private getClient() {
    if (!this.client) {
      // Lazy initialization to avoid Next.js build-time CJS/ESM interop crashes
      const paystackModule = require("paystack-api");
      const Paystack = typeof paystackModule === "function" ? paystackModule : (paystackModule.default || paystackModule);
      this.client = Paystack(this.secretKey);
    }
    return this.client;
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

    try {
      const client = this.getClient();
      const response = await client.transaction.verify({ reference });

      return {
        success: response.data.status === "success",
        amount: response.data.amount / 100, // SDK returns kobo/cents, convert to major unit
        currency: response.data.currency,
        status: response.data.status,
      };
    } catch (error: any) {
      throw new Error(`Paystack SDK verification failed: ${error.message}`);
    }
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

    try {
      // NOTE: Most Node SDKs don't natively expose custom header injection (like Idempotency-Key)
      // If strict idempotency is required and the SDK blocks it, we can fallback to fetch for this specific endpoint.
      // Paystack's official API for refund creation handles the 'transaction' reference.
      
      const client = this.getClient();
      const response = await client.refund.create({
        transaction: paystackReference,
        amount: amountToRefund * 100, // Convert to kobo/cents
      });

      return {
        success: true,
        refundId: response.data.id.toString(),
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

// Export a singleton instance to use across routers
export const paystack = new PaystackAdapter();
