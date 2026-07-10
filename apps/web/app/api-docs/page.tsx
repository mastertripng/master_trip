import React from "react";

export const metadata = {
  title: "API Documentation | Master-Trip",
};

export default function ApiDocsPage() {
  return (
    <main className="h-screen w-full">
      {/* 
        We use the Scalar API Reference via CDN.
        It automatically reads our OpenAPI spec from /api/openapi.json
      */}
      <script
        id="api-reference"
        data-url="/api/openapi.json"
        data-theme="moon"
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
      />
    </main>
  );
}
