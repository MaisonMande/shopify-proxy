import express from "express";
import fs from "fs";
import https from "https";

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
// Helper: Logging
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
// SHOPIFY WEBHOOK
// -------------------------
app.post("/shopify", async (req, res) => {
  try {
    log("📦 RAW SHOPIFY PAYLOAD:");
    log(JSON.stringify(req.body, null, 2));

    const order = req.body;

    if (!order.id) {
      log("❌ ERROR: Missing order.id");
      return res.status(400).json({ success: false, error: "Missing order.id" });
    }

    // -------------------------
    // Build Jetpack data (x-www-form-urlencoded)
    // -------------------------
    const data = {
      prix: order.total_price || 0,
      nom: (order.customer?.first_name || "") + " " + (order.customer?.last_name || ""),
      gouvernerat: order.shipping_address?.province || "",
      ville: order.shipping_address?.city || "",
      adresse: order.shipping_address?.address1 || "",
      tel: order.shipping_address?.phone || "",
      tel2: "", // اختياري
      designation: order.line_items?.map(item => item.name).join(", ") || "Produit",
      nb_article: order.line_items?.length || 1,
      msg: "", // أي ملاحظات إضافية
    };

    log("➡️ DATA SENT TO JETPACK:");
    log(JSON.stringify(data, null, 2));

    // -------------------------
    // Send to Jetpack
    // -------------------------
    const postData = new URLSearchParams(data).toString();
    const url = new URL(JETPACK_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization":
          "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": postData.length,
      },
    };

    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        log("⬅️ RESPONSE FROM JETPACK:");
        log(body);
        res.json({
          success: true,
          message: "Order forwarded successfully",
          jetpack_raw: body,
        });
      });
    });

    request.on("error", (e) => {
      log("❌ ERROR SENDING TO JETPACK: " + e.message);
      res.status(500).json({ success: false, error: e.message });
    });

    request.write(postData);
    request.end();
  } catch (err) {
    log("❌ SERVER ERROR: " + err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------
// LOGS VIEW for Free Plan
// -------------------------
app.get("/logs", (req, res) => {
  const key = req.query.key;
  if (key !== "MonMotDePasse123") return res.status(403).send("Forbidden");
  try {
    const logs = fs.readFileSync(LOG_FILE, "utf-8");
    res.type("text/plain").send(logs);
  } catch (err) {
    res.status(500).send("Cannot read log file: " + err.message);
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
