// Test script to check if webhook endpoint is accessible
const webhookUrl = "https://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/stripe-webhook";

fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ test: "webhook-test" })
})
.then(response => {
  console.log("Response status:", response.status);
  return response.text();
})
.then(data => {
  console.log("Response body:", data);
})
.catch(error => {
  console.error("Error:", error);
});