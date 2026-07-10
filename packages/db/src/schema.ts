import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uuid,
  decimal,
  json,
  boolean,
  integer
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "CUSTOMER",
  "SUPPORT_AGENT",
  "OPERATIONS",
  "ADMIN"
]);

export const userTierEnum = pgEnum("user_tier", [
  "STANDARD",
  "VIP",
  "CORPORATE"
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "DRAFT",
  "PAID",
  "FULFILLING",
  "CONFIRMED",
  "PARTIAL_FAIL",
  "CANCELLED",
  "REFUNDED"
]);

export const tripItemTypeEnum = pgEnum("trip_item_type", [
  "FLIGHT",
  "HOTEL",
  "TOUR",
  "CAR"
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
  "REFUNDED"
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED"
]);

export const refundReasonEnum = pgEnum("refund_reason", [
  "TICKETING_FAILED",
  "HOTEL_UNAVAILABLE",
  "USER_CANCELLED",
  "PARTIAL_FULFILLMENT"
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "PENDING",
  "SUCCESS",
  "FAILED"
]);

export const supportChatRoleEnum = pgEnum("support_chat_role", [
  "USER",
  "ASSISTANT",
  "HUMAN_AGENT"
]);

export const chatStatusEnum = pgEnum("chat_status", [
  "ACTIVE",
  "NEEDS_HUMAN",
  "NEEDS_HUMAN_URGENT",
  "RESOLVED"
]);


// ─────────────────────────────────────────────
// USERS & AUTHENTICATION
// ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: userRoleEnum("role").default("CUSTOMER").notNull(),
  tier: userTierEnum("tier").default("STANDARD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  supportChats: many(supportChats),
  travelerProfiles: many(travelers),
}));


// ─────────────────────────────────────────────
// TRAVELERS
// ─────────────────────────────────────────────

export const travelers = pgTable("travelers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  documents: json("documents").default({}).notNull(),
});

export const travelersRelations = relations(travelers, ({ one }) => ({
  user: one(users, {
    fields: [travelers.userId],
    references: [users.id]
  }),
}));


// ─────────────────────────────────────────────
// TRIPS
// ─────────────────────────────────────────────

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: tripStatusEnum("status").default("DRAFT").notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.userId],
    references: [users.id]
  }),
  items: many(tripItems),
  payment: one(payments, {
    fields: [trips.id],
    references: [payments.tripId]
  })
}));


// ─────────────────────────────────────────────
// TRIP ITEMS
// ─────────────────────────────────────────────

export const tripItems = pgTable("trip_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().references(() => trips.id),
  type: tripItemTypeEnum("type").notNull(),
  fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status").default("PENDING").notNull(),
  providerName: text("provider_name").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  metadata: json("metadata").default({}).notNull()
});

export const tripItemsRelations = relations(tripItems, ({ one }) => ({
  trip: one(trips, {
    fields: [tripItems.tripId],
    references: [trips.id]
  })
}));


// ─────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().unique().references(() => trips.id),
  paystackReference: text("paystack_reference").notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  trip: one(trips, {
    fields: [payments.tripId],
    references: [trips.id]
  }),
  refunds: many(refunds)
}));


// ─────────────────────────────────────────────
// REFUNDS
// ─────────────────────────────────────────────

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  reason: refundReasonEnum("reason").notNull(),
  status: refundStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id]
  })
}));


// ─────────────────────────────────────────────
// MARKUP RULES
// ─────────────────────────────────────────────

export const markupRules = pgTable("markup_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vertical: tripItemTypeEnum("vertical"),
  origin: text("origin"),
  destination: text("destination"),
  cabinClass: text("cabin_class"),
  userTier: userTierEnum("user_tier"),
  flatAmount: decimal("flat_amount", { precision: 12, scale: 2 }),
  percentage: decimal("percentage", { precision: 5, scale: 4 }),
  currency: text("currency").default("NGN").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by")
});


// ─────────────────────────────────────────────
// AI SUPPORT CHAT
// ─────────────────────────────────────────────

export const supportChats = pgTable("support_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: supportChatRoleEnum("role").notNull(),
  message: text("message").notNull(),
  status: chatStatusEnum("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const supportChatsRelations = relations(supportChats, ({ one }) => ({
  user: one(users, {
    fields: [supportChats.userId],
    references: [users.id]
  })
}));

// ─────────────────────────────────────────────
// AI CONFIGURATION
// ─────────────────────────────────────────────

export const aiConfigs = pgTable("ai_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentName: text("agent_name").notNull().unique(), // e.g. 'fulfillment-agent', 'support-agent'
  provider: text("provider").default("openrouter").notNull(),
  modelName: text("model_name").notNull(), // e.g. 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet'
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
