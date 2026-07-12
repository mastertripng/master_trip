CREATE TABLE "travel_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
