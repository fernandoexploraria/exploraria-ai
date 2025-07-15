// Test script to verify webhook endpoint is accessible
const webhookUrl = "https://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/stripe-webhook";

console.log("Testing webhook endpoint:", webhookUrl);

fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ test: "direct-test" })
})
.then(response => {
  console.log("✅ Response status:", response.status);
  console.log("✅ Response headers:", Object.fromEntries(response.headers.entries()));
  return response.text();
})
.then(data => {
  console.log("✅ Response body:", data);
  console.log("✅ Webhook endpoint is accessible!");
})
.catch(error => {
  console.error("❌ Error accessing webhook:", error);
});