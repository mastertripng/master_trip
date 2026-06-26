# Master-Trip: Backend Engineering Roadmap

This document serves as the master checklist for all remaining backend work required to bring the platform to production. The architecture (oRPC + Adapter Pattern + Mastra Workers + Prisma) is fully scaffolded. The remaining work is focused on wiring up the actual third-party integrations and fulfilling the async queues.

---

## Phase 0: Scaffold & Architecture (COMPLETED)
- [x] **Turborepo Setup:** Isolated `api`, `db`, `types`, and `workers` packages.
- [x] **Database Schema:** Unified `Trip` cart, polymorphic `TripItem`s, and `Traveler` decoupling.
- [x] **Adapter Pattern:** Registry and Aggregator factories created for Flights and Hotels.
- [x] **oRPC Routers:** Base search routes and validation schemas built.
- [x] **Dynamic Pricing:** `MarkupRule` engine integrated via PostgreSQL.

---

## Phase 1: Provider API Integrations
*The critical path. We need actual API credentials to finish these.*

### 1. 247 Travels (Flights)
- [ ] **Auth & Sandbox:** Connect to 247 Travels sandbox environment.
- [ ] **Normalize Response:** Implement `normalize()` in `travels247.adapter.ts` to map their raw JSON/XML to our Zod `FlightResult` schema.
- [ ] **Booking Endpoint:** Implement actual PNR generation in the `bookFlight()` method.
- [ ] **Revalidation Endpoint:** Ensure price hasn't jumped before routing user to Paystack.

### 2. Booking.com (Hotels)
- [ ] **Auth & Sandbox:** Connect to Booking.com Affiliate/Connectivity API.
- [ ] **Normalize Response:** Implement `normalize()` in `booking-com.adapter.ts`.
- [ ] **Accumulator Testing:** Verify the B2B bulk room splitter works (e.g., requesting 50 rooms).

### 3. Upstash Redis (Caching)
- [ ] Set `UPSTASH_REDIS_REST_URL` in `.env.local`.
- [ ] Replace `TODO` comments in `routers/flights.ts` and `routers/hotels.ts` with actual Redis `.get()` and `.setex()` calls to cache GDS responses.

---

## Phase 2: Checkout & Payments
*Translating a draft cart into captured funds.*

- [ ] **Cart Creation:** Implement the `createTrip` endpoint in `routers/bookings.ts` to save the drafted items to the database.
- [ ] **Paystack Initialization:** Generate a payment link/reference for the total cart value.
- [ ] **Paystack Webhook Listener:** Create an endpoint to listen for `charge.success`.
- [ ] **Event Emission:** Upon successful payment, update Trip status to `PAID` and fire the `CheckoutComplete` event to QStash.

---

## Phase 3: The API & Fulfillment Server (`apps/workers`)
*The Bun + Hono container deployed to Fly.io for maximum concurrency.*

- [x] **Hono Server Scaffold:** Created Bun+Hono server in `src/server.ts`.
- [ ] **oRPC Mounting:** Mount the `packages/api` router into Hono for live flight searches.
- [ ] **QStash Receiver Endpoint:** Secure the `/webhook/fulfillment` endpoint to only accept valid QStash signatures.
- [ ] **Fulfillment Agent Logic:** Update Mastra agents to dynamically invoke the provider adapters (e.g., `Travels247.bookFlight()`).
- [ ] **Database State Sync:** Update `TripItem` to `CONFIRMED` or `FAILED` as the worker progresses.
- [ ] **Dead Letter Queue (DLQ):** Configure QStash to retry failures 3 times with exponential backoff.
- [ ] **Partial Refunds:** If an item ultimately fails, trigger a Paystack partial refund API call.

---

## Phase 4: AI Support & RAG
*Activating the autonomous customer service layer.*

- [ ] **RAG Database (pgvector):** Enable the `pgvector` extension in Supabase.
- [ ] **Seed Legal Policies:** Ingest Airline Terms of Service, baggage limits, and visa requirements into the vector database.
- [ ] **Mastra Tools:** Equip `supportAgent` with two custom tools:
  1. `getItinerary(userId)` — read the user's booking from Prisma.
  2. `searchPolicy(query)` — run a vector similarity search on airline rules.
- [ ] **Human Escalation:** Implement real-time Supabase WebSockets. If the AI flags a chat as `NEEDS_HUMAN_URGENT` (e.g., VIP user), ping the admin dashboard immediately.

---

## Phase 5: Pre-Launch Polish
- [ ] **Error Tracking:** Connect Sentry to catch runtime oRPC errors.
- [ ] **Analytics:** Connect PostHog to track checkout funnel drop-offs.
- [ ] **Transactional Emails:** Integrate Resend to email the final PDF itineraries and e-tickets to the user once fulfillment succeeds.
