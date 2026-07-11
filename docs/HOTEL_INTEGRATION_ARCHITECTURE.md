# Master-Trip Hotel Integration Architecture

This document defines the architectural guidelines and data flows for integrating the Master-Trip platform with the Booking.com Demand API (v3.2).

## 1. Core Architecture Pattern
*   **Adapter & Aggregator Pattern**: All external hotel provider APIs (e.g., Booking.com) must be implemented using the Adapter pattern. An Aggregator will manage concurrent requests (via `Promise.allSettled`) to these adapters to ensure the system remains resilient if a specific provider fails.
*   **Data Synchronization**: Use QStash and Hono background workers to poll the `/accommodations/details/changes` endpoint hourly. This allows Master-Trip to incrementally sync inventory (openings, closures, modifications) instead of performing heavy full-database reloads.

## 2. Search & Filtering Flow
*   **Default Sorting**: When location filters (City, Country) are applied, results are natively sorted by Booking.com's `top_picks` (popularity). We will retain this as the default sorting mechanism to maximize conversion. Explicit user sorting (e.g., "Price: Low to High") will override this.
*   **Sidebar Filters**: The Next.js frontend will map its filtering UI directly to the API's supported `filters` object:
    *   **Price**: Maps to `filters.price.minimum` and `filters.price.maximum`. **Requirement**: The frontend must send the selected `currency` parameter alongside price filters.
    *   **Star Rating**: Maps to `filters.rating.stars`.
    *   **Property Type**: Maps to `filters.accommodation_types`.
    *   **Premium Toggles**: Include `sustainability_certification` and `cancellation_type` ("free_cancellation").
*   **Payment Timings**: Master-Trip utilizes a Unified Cart (via Paystack for user checkout, Flutterwave for VCC fulfillment). Therefore, the backend adapter must hardcode the payment filter to `"timing": "pay_online"`. "Pay at the property" is strictly prohibited to maintain the unified checkout flow.

## 3. Occupancy, Children, & Room Allocation
*   **The "No Math" Rule**: The Master-Trip backend must never attempt to calculate child discounts or complex room capacities. The frontend captures exact guest counts and children's ages, passes them to the API, and relies on the API's returned `price.total`. The Markup Engine then applies profit margins on top of this final price.
*   **Smart Room Allocation**: For multi-room bookings, Master-Trip will not force users to manually assign guests to specific rooms during search. We will pass the raw group size and utilize the API's `recommendation` object to automatically present the most cost-effective room allocation package.
*   **UI Badging (Free Stays)**: If the API returns `free_stay: true` for a specific age band (e.g., ages 0-5), the frontend will display a high-converting badge: **"Kids 0-5 stay free!"**. If `children: null` is returned, children are charged adult rates and child-specific messaging is hidden.
*   **Adults-Only Validation**: The backend must not assume a property is "Adults Only" just because `children: null` is returned in a search. The true indicator is fetching the `minimum_guest_age >= 18` from the `/accommodations/details` endpoint.

## 4. Checkout Guardrails & Special Requests
*   **The `occupancy_mismatch` Guardrail**: During the `/orders/preview` step, if the user's group size exceeds the room's maximum capacity, Booking.com will not block the request but will return an `occupancy_mismatch` object. The Master-Trip backend must intercept this: if `occupancy_mismatch` is not null, the checkout is blocked, and a 400 Bad Request is sent to the frontend prompting the user to select larger/more rooms.
*   **Cots and Extra Beds**: On the Hotel Details page, we fetch `/accommodations/details` with `extras: ["rooms"]`. Based on the `policies.cots_and_extra_beds` response, the checkout UI will dynamically offer cot/extra bed requests if infants are present.
*   **Contiguous Rooms**: If a user books multiple rooms, the checkout UI will include a text area for "Special Requests". This maps to the `remarks.special_requests` field in the `/orders/create` payload, allowing users to request adjoining rooms.
*   **Order Expiration**: The `/orders/create` payload must be fulfilled within the strict 15-minute `order_token` window. A visual countdown timer will be implemented on the checkout page.

## 5. Centralized Error Handling & Troubleshooting
*   **Standardized Error Structure**: All 4xx and 5xx API errors return a standard JSON structure containing a `request_id` and an `errors` array (with `id` and `message`). The backend adapter must catch these and translate the `errors[0].id` into appropriate Master-Trip UI responses.
*   **Rate Limiting (429)**: Booking.com enforces strict rate limits (e.g., 100 req/min for messaging). The backend must implement exponential backoff (e.g., 1s, 2s, 4s, 8s) for 429 and 5xx errors. Do not retry 4xx client errors.
*   **Pagination Tokens**: Tokens expire after 3 hours. If an `expired_token` or `token_endpoint_mismatch` error is returned, the backend must clear the cached token and re-initiate the search from page 1.
*   **Product Availability Conflicts (409)**: If `/orders/create` returns an `order_unavailable` error (HTTP 409), it means the room sold out between `/search` and checkout. The backend must immediately redirect the user back to the Hotel Details page and trigger a fresh `/availability` request.
*   **VCC Payment Refusals (422)**: Because Master-Trip acts as the Merchant of Record, any `payment_refused_*` error during checkout (e.g., `insufficient_funds`, `invalid_card_number`) means our Flutterwave VCC failed, *not* the user's card. The backend must log a critical alert for the admin and return a generic "Booking system error, our team has been notified" message to the user, as they have already been charged via Paystack.
*   **API Inconsistency (`/search` vs `/availability`)**: The `/search` endpoint might allow an allocation that `/availability` later rejects. This happens when the number of children exceeds the allowed child slots, causing the API to silently price excess children as adults. **Rule**: The `/availability` response is the absolute source of truth. The backend must always cross-check prices and rules here before proceeding to checkout.
*   **Null Recommendations**: If `/search` returns `"recommendation": null` for a family, it likely means the property enforces a strict age restriction (e.g., no toddlers). The frontend should handle this gracefully, perhaps indicating "No suitable rooms for this group size/age."
*   **Preview Blocks on Children**: If `/orders/preview` throws a hard error when children are included, the property is likely strictly Adults-Only (`minimum_guest_age: 18`).
*   **Partial Free Stays**: If `free_stay: true` is returned but the user is still charged, it means the user's group exceeded the band's total allowance (e.g., 1 child stays free, but they brought 2). The backend must not recalculate; always trust `price.total`.

## 6. Pricing, Extra Charges & VCC Fulfillment
*   **Price Display Laws**: The frontend must use `price.book` during search/availability phases to comply with local display laws (e.g., EU VAT rules based on `booker.country`). `price.base` is strictly for internal analytics and must never be the only price shown to a user.
*   **Order Price Changes & Invalid Amounts**: The API may return an `order_price_changed` error during `/orders/create`. If an `invalid amount` error is returned, it means the authorized VCC amount is less than expected (usually due to a price change). In both cases, the backend must silently fetch a new `/orders/preview` token and display the updated price to the user.
*   **Conditional Charges**: Fees labeled as `conditional` (e.g., cleaning fees if not cleaned) or `incalculable` (e.g., water usage) are explicitly excluded from the `total` price. The checkout UI must label these clearly as "Additional charges that might apply at the property".
*   **The VCC "Chargeable Online" Rule**: This is the most critical logic for the Master-Trip unified cart. Master-Trip uses a Virtual Credit Card (VCC) via Flutterwave to fulfill the booking. The amount loaded onto this VCC MUST exactly match the `price.chargeable_online` value from `/orders/preview`. **Master-Trip must only charge the user the `chargeable_online` amount + Master-Trip markup via Paystack.** Any discrepancy between `chargeable_online` and the `total` price represents mandatory fees (like local taxes) that the user must pay directly at the hotel desk upon arrival. The checkout UI must explicitly state: *"You will pay X now. You will owe the property Y upon arrival."*
*   **UI Payment Schedule Display**: The `/orders/preview` response contains a `payment.dates` array. The frontend must parse this array to clearly differentiate between the upfront charge (at booking time) and future on-site charges (taxes, deposits, etc., at check-in). The UI should use the `display` object within the dates array for presentation to the user, while the backend uses the `pay` object for the actual charge calculation.
*   **VCC Payment Payload (`/orders/create`)**: When submitting the order, the payment object must be explicitly flagged as a VCC to bypass SCA (Strong Customer Authentication). We strictly enforce `pay_online_now` and omit any billing/business fields:
    ```json
    "payment": {
      "method": "card",
      "timing": "pay_online_now",
      "include_receipt": true,
      "card": {
        "authentication": { "sca_exemption": "virtual" },
        "cardholder": "Master Trip",
        "cvc": "<FLUTTERWAVE_VCC_CVC>",
        "expiry_date": "<YYYY-MM>",
        "number": "<FLUTTERWAVE_VCC_PAN>"
      }
    }
    ```

## 7. Discounts, Bundles & Deals
*   **Target Rates & CUG**: To retrieve target rates (e.g., mobile) and Closed User Group (CUG) rates, the backend must dynamically populate the `booker` object in the `/search` request. If the user is logged into Master-Trip, we must append `"authenticated"` to the `booker.user_groups` array to unlock exclusive logged-in deals.
*   **Bundles & Value Adds**: In v3.2, bundles (e.g., free parking, welcome drinks) are returned automatically. Bundles are non-selectable inclusions. The UI must display them simply as "What's included" beneath the room rate. We must NOT display individual prices for value adds or treat them as interactive add-ons.

## 8. Third-Party Inventory (TPI) Architecture
Booking.com's TPI rates (sourced from bedbanks/wholesalers) offer competitive pricing but come with strict architectural constraints:
*   **Sell vs. Net Rates**: 
    *   **Sell Rates (Commissionable)**: Uses the regular Affiliate ID (AID).
    *   **Net Rates (Non-commissionable)**: Requires a dedicated Net Rates AID. Master-Trip must use `best_available_price` to calculate an appropriate markup without exceeding market rates.
*   **TPI Constraints**: TPI bookings are strictly limited to **1 room per booking**. Furthermore, modifications are NOT supported, and `pay_online_later` is disabled. All TPI bookings must be paid upfront using a VCC (`pay_online_now`), perfectly aligning with Master-Trip's Flutterwave architecture.
*   **Post-Booking Confirmation**: Unlike standard bookings, TPI orders return a `checkin_number` and a `confirmation_number` alongside the standard `pincode`. The UI *must* explicitly surface these TPI-specific numbers on the itinerary/receipt page, as the user will need them at the front desk.

## 9. Post-Booking Messaging (Beta)
Master-Trip integrates the Demand API v3.2 Messaging Pilot to enable two-way communication between guests and properties after a booking is confirmed.
*   **Automated Polling (Worker)**: We must not rely solely on user interaction to fetch messages. An Upstash/QStash worker must call `/messages/latest` every 10 minutes to retrieve new messages from the property. After saving these to the Master-Trip database (linked to the specific `TripItem`), the worker MUST immediately call `/messages/latest/confirm` with the received message IDs to acknowledge receipt and remove them from the queue.
*   **Welcome Messages & Context**: Properties often send automated welcome messages or rejection messages (e.g., denying an extra bed request). The frontend UI must display this conversation history within the user's booking itinerary page. Full history can be synced via the `/messages/conversations` endpoint using the `reservation` and `accommodation` IDs.
*   **Guest-Initiated Messages**: If a user sends a message to the property via the Master-Trip UI (e.g., asking for early check-in), the backend translates this to a `/messages/send` request containing the `reservation` ID, `accommodation` ID, and `content`. Rate limiting (max 100 requests/minute) is handled at the provider adapter level.
*   **Attachments**: Guest file uploads (e.g., ID documents or arrival photos) must be base64-encoded and strictly under 1MB. They must be uploaded to `/messages/attachments/upload` first, and the resulting attachment IDs are then passed in the `attachments` array of the `/messages/send` payload.

## 10. Compliance & Legal Guardrails
*   **Digital Services Act (DSA) Compliance (EEA Users)**: For any search or booking involving a user from the EEA (`booker.country`), the backend must evaluate the property's `host_type` and `trader_verified` status (fetched via `/accommodations/details` with `extras=["description"]`). If the host is `professional` or `unknown`, and `trader_verified` is `false`, the property MUST be strictly excluded from all search and availability results to remain legally compliant. Private hosts (where `trader` fields are null) are exempt from this exclusion.
*   **FTC Fee Transparency (U.S. Users)**: Master-Trip strictly complies with the FTC ban on "drip pricing" by adhering to the "No Math" rule detailed in Section 3. The `price.total` returned by the API intrinsically includes all mandatory fees (resort fees, destination fees). The frontend UI must never replace the prominent total price with a component breakdown.
*   **Fraud Prevention T&C**: To comply with Booking.com's integration rules, the Master-Trip frontend Terms & Conditions checkout checkbox must explicitly state: *"Reservations may be investigated or cancelled if fraudulent."*
