# Master-Trip Frontend Routing & API Architecture

This document outlines how the Next.js frontend interacts with the Master-Trip backend via oRPC, specifically focusing on user interactions, routing, and data fetching for dynamic searches versus curated promotional packages.

## 1. The Endpoints Overview

The frontend communicates exclusively via the **oRPC React Query client**. The root router exposes the following endpoints:

*   **Flights (`orpc.flights.*`)**:
    *   `.search`: Fetches live/cached flights via the aggregator.
    *   `.revalidate`: Hits the provider directly before checkout to ensure price accuracy.
*   **Hotels (`orpc.hotels.*`)**:
    *   `.search`: Standard hotel inventory search.
    *   `.bulkRooms`: B2B request accumulator for corporate groups.
*   **Tours (`orpc.tours.*`)**:
    *   `.search`: Tour discovery (prioritizing local footprint).
*   **Bookings (`orpc.bookings.*`)**:
    *   `.createTrip`: Initializes an empty `DRAFT` unified cart.
    *   `.confirmCheckout`: Marks trip `PAID` and triggers background fulfillment via QStash.
    *   `.getTrip`: Polls booking status post-checkout.
*   **Support (`orpc.support.*`)**:
    *   `.sendMessage`: Sends messages to the Mastra AI RAG agent.
    *   `.getChatHistory`: Fetches the user's isolated chat logs.

---

## 2. Standard Service Navigation (The Tabs)

When a user interacts with the primary navigation tabs (Flights, Hotels, Tours):

1.  **Client-Side Routing**: The Next.js `<Link>` component pushes a new URL (e.g., `/hotels`) to the browser history. The browser does not perform a full page reload.
2.  **Page Mount**: The React page component for that route (e.g., `apps/web/app/(customer)/hotels/page.tsx`) mounts instantly.
3.  **User Input**: The user is presented with a search form (Destination, Dates, Guests).

---

## 3. Handling Arbitrary / Global Searches

If a user wants to go to any random location globally:

1.  **Autocomplete & Standardization**: The frontend maps the user's text ("Paris", "JFK") to a standard identifier (IATA code, City ID) using a fast local or lightweight API lookup.
2.  **API Execution**: The standardized query is passed to the oRPC hook:
    ```tsx
    const { data, isLoading } = orpc.hotels.search.useQuery({ destinationId: "ch-paris" });
    ```
3.  **Loading State**: While `isLoading` is true, the UI displays skeleton loaders.
4.  **Backend Fan-Out**: The backend `apps/workers` checks Upstash Redis for cached results. On a miss, the **Aggregator** fans out the request to external APIs (e.g., Booking.com, 247 Travels), standardizes the raw response using **Adapters**, applies the **Markup Engine** rules, and returns the final JSON.
5.  **Render**: The frontend replaces skeletons with live, bookable inventory cards.

---

## 4. Handling Promotions and Featured Packages

When dealing with prominent marketing banners (e.g., "Featured Qatar Package" or "Bali Hotel Deal"), the system handles the click in one of two ways:

### Scenario A: Dynamic Pre-filling (The Search Route)
Used when a promotion highlights a specific destination but allows the user to pick dates/options.
1.  **The Click**: The `onClick` event routes the user to the search page, appending search criteria to the URL:
    `router.push('/hotels?destination=qatar&stars=5')`
2.  **The Intercept**: The target page mounts, reads the `useSearchParams()`, and instantly injects "Qatar" into the search form.
3.  **Auto-Execution**: The frontend immediately fires the `orpc.hotels.search` call for those parameters, generating a live list of luxury hotels in Qatar.

### Scenario B: Curated Bundles (The Package Route)
Used for fixed, premium multi-service bundles (e.g., The "Nigeria-Namibia Trade Mission" or "Qatar Premium Holiday").
1.  **The Click**: The user clicks "Book the Qatar Package".
2.  **Direct Action**: Instead of triggering a search, this routes the user to a specific details page (e.g., `/tours/qatar-package`).
3.  **Unified Cart Addition**: Clicking "Add to Trip" instantly creates a cart via `orpc.bookings.createTrip` and adds pre-configured `TripItem` records representing the flight, hotel, and visa assistance simultaneously.
4.  **Checkout**: The user proceeds directly to payment.

---

## 5. The Unified Cart Advantage

The Master-Trip architecture relies on a **Unified Trip Cart** schema (`Trip` containing polymorphic `TripItem` models).

Because of this, the frontend allows the user to mix and match. A user can follow a promotional link to dynamically search for a flight to Qatar, add it to their cart, and then perform an arbitrary search for a Hotel in Qatar and add that to the exact same cart. 

The checkout process happens exactly once (via Paystack), and the `apps/workers` backend asynchronously handles fulfilling both the flight API and the hotel API in the background.

---

## 6. The End-to-End Promotions Lifecycle (No-Code Flow)

This outlines how a new promotion goes from creation by the operations team to a paid booking by a customer, requiring **zero code changes** from developers.

### Phase 1: Creation (The Operations Team)
1.  **Log In:** An admin logs into the secure `apps/admin` dashboard (protected by WorkOS/Cloudflare).
2.  **Fill the Form:** They navigate to the "Promotions" tab and click "Create New". They interact with a simple, non-technical UI:
    *   *Title:* "Weekend in Dubai"
    *   *Image:* Uploads a photo of the Burj Khalifa.
    *   *Service Type:* Selects "Hotels" from a dropdown.
    *   *Destination:* Types "Dubai" and selects "Dubai, UAE" from a smart dropdown.
3.  **Publish:** They click **"Save & Publish"**. 
4.  **Backend Translation:** The admin dashboard automatically translates those simple inputs into the exact database records and routing URLs (`/hotels?destination=dubai`) required by the system, saving it directly to the Supabase database.

### Phase 2: Display (The Customer Arrives)
1.  **Visit Site:** The customer visits the public website (`apps/web`).
2.  **Auto-Fetch:** As the homepage loads, the Next.js frontend automatically queries the database for currently active promotions.
3.  **Dynamic Render:** The frontend instantly renders a  card displaying the "Weekend in Dubai" promotion using the uploaded image and title. 

### Phase 3: Action (The Customer Books)
1.  **The Click:** The customer clicks the "Weekend in Dubai" card.
2.  **The Invisible Route:** The Next.js router seamlessly transitions the user to the Hotels Search page, invisibly passing the "Dubai" parameters.
3.  **The Live Search:** The search page immediately fires an `oRPC` request to the `apps/workers` backend.
4.  **Aggregator Fires:** The backend fetches live hotel availability for Dubai from external APIs (like Booking.com), applies profit markup, and returns the prices to the user's screen.
5.  **Checkout & Fulfillment:** The user adds the selection to their Unified Cart, checks out via Paystack, and QStash triggers the background AI worker to secure the official reservation.

---

## 7. Handling Dates, Times, and Flight Constraints

A destination alone is insufficient for travel; it is bound by time, duration, and routing. The Master-Trip Admin Dashboard handles this flexibly without requiring ops to understand URL parameters.

### Approach 1: The "Open Date" Default (Optimized for Conversion)
*Used for 95% of standard promotions (e.g., "Explore Bali", "Luxury Qatar").*
*   **Admin Creation:** The admin selects the destination but leaves the "Dates" field empty.
*   **User Experience:** When clicked, the user is routed to the search page. The destination is pre-filled, but the UI immediately opens a calendar prompting the user: *"When would you like to travel?"*
*   **Why it's best:** This provides maximum flexibility, significantly reducing cart abandonment while keeping the promotion "evergreen" (never expires). If the user searches for flights, they can manually toggle "Round-Trip" and input their preferred duration.

### Approach 2: The "Fixed Date" Exception (Event-Based)
*Used strictly for scheduled group events (e.g., "Nigeria-Namibia Trade Mission 2026").*
*   **Admin Creation:** The admin toggles "Fixed Dates" and selects specific start and end dates from a calendar widget. For flights, they select "Round-Trip".
*   **Backend Translation:** The dashboard generates a highly specific URL: `/tours?destination=namibia&checkIn=2026-10-10&checkOut=2026-10-15&type=roundtrip`.
*   **User Experience:** The user bypasses the calendar selection entirely. The system instantly searches for that exact locked timeframe.
