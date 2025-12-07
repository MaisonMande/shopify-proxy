import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// -------------------------
// CONFIGURATION
// -------------------------
const JETPACK_URL =
  "https://www.jetpack.tn/apis/mande-DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45/v1/post.php";

const JETPACK_TOKEN =
  "DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45";

const LOG_FILE = "log.txt";

// -------------------------
// HELPER: Logging
// -------------------------
function log(data) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${data}\n`);
}

// -------------------------
// ROOT TEST
// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 Shopify Webhook Server is Running");
});

// -------------------------
// SHOPIFY WEBHOOK ENDPOINT
// -------------------------
app.post("/shopify", async (req, res) => {
  try {
    log("📦 RAW SHOPIFY PAYLOAD:");
    log(JSON.stringify(req.body, null, 2));

    const order = req.body;

    // Validate payload
    if (!order.id) {
      log("❌ ERROR: Missing order.id");
      return res.status(400).json({ success: false, error: "Missing order.id" });
    }

    // Prepare Jetpack data
    const data = {
      ref: order.id,
      nom:
        (order.customer?.first_name || "") +
        " " +
        (order.customer?.last_name || ""),
      address: order.shipping_address?.address1 || "",
      gouvernorat: order.shipping_address?.province || "",
      delegation: order.shipping_address?.city || "",
      localite: order.shipping_address?.city || "",
      phone: order.shipping_address?.phone || "",
      cod: order.total_price || 0,
    };

    log("➡️ DATA SENT TO JETPACK:");
    log(JSON.stringify(data, null, 2));

    // Send to Jetpack
    const jetpackResponse = await fetch(JETPACK_URL, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ code: JSON.stringify(data) }),
    });

    const jetpackText = await jetpackResponse.text();

    log("⬅️ RESPONSE FROM JETPACK:");
    log(jetpackText);

    return res.json({
      success: true,
      message: "Order forwarded successfully",
      jetpack_raw: jetpackText,
    });
  } catch (err) {
    log("❌ SERVER ERROR: " + err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------
// START SERVER
// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("🚀 Server started on port " + PORT);
  console.log(`Server running on port ${PORT}`);
});
