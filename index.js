import express from "express";

const app = express();
app.use(express.json());

app.post("/shopify", (req, res) => {
  console.log("📦 Webhook Received:");
  console.log(req.body);

  res.status(200).json({
    success: true,
    message: "Webhook received successfully",
    data: req.body
  });
});

app.get("/", (req, res) => {
  res.send("🚀 Shopify Webhook Server is Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
