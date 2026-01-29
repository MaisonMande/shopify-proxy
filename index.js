import express from "express";
import fs from "fs";
import https from "https";

const app = express();
app.use(express.json());

// -------------------------
// CONFIGURATION
// -------------------------
const JETPACK_URL = "https://www.jetpack.tn/apis/mande-DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45/v1/post.php";
const JETPACK_TOKEN = "DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45"; // ثبت التوكن
const LOG_FILE = "log.txt";

// -------------------------
// ANTI-DUPLICATE MEMORY
// -------------------------
// هذه "الذاكرة" بش نسجلو فيها أرقام الكومندات إلي خدمناهم
const processedOrders = new Set();

// -------------------------
// Helper: Logging
// -------------------------
function log(data) {
  const message = `[${new Date().toISOString()}] ${data}\n`;
  console.log(message);
  try {
    fs.appendFileSync(LOG_FILE, message);
  } catch (err) {
    console.error("Error writing to log file:", err);
  }
}

app.get("/", (req, res) => res.send("🚀 Shopify Webhook Server is Running"));

// -------------------------
// SHOPIFY WEBHOOK
// -------------------------
app.post("/shopify", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id;

    // 🛑 1. الحماية القوية: تثبت كان الكومند هذي خدمناها قبل ولا لا
    if (orderId && processedOrders.has(orderId)) {
      console.log(`⚠️ DUPLICATE DETECTED: Order ${orderId} already processed. Ignoring.`);
      return res.status(200).send('Already processed');
    }

    // كان جديدة، نسجلوها في الذاكرة
    if (orderId) {
      processedOrders.add(orderId);
      // نفسخوها من الذاكرة بعد 10 دقايق بش ما نعبيوش الرام
      setTimeout(() => processedOrders.delete(orderId), 10 * 60 * 1000);
    }

    // ✅ 2. نجاوبو Shopify ديراكت
    res.status(200).send('Webhook received');

    // نكملو الخدمة...
    if (!orderId) {
      log("❌ ERROR: Missing order.id - Ignoring.");
      return;
    }

    log(`📦 PROCESSING ORDER: ${orderId}`);

    // ✅ 3. حساب مجموع القطع
    let totalArticles = 0;
    if (order.line_items && Array.isArray(order.line_items)) {
      totalArticles = order.line_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // ✅ 4. اسم المنتج + الكمية
    const productNames = order.line_items?.map(item => `${item.quantity}x ${item.name}`).join(", ") || "Produit";

    // Build Jetpack data
    const data = {
      prix: order.total_price || 0,
      nom: (order.customer?.first_name || "") + " " + (order.customer?.last_name || ""),
      gouvernerat: order.shipping_address?.province || "",
      ville: order.shipping_address?.city || "",
      adresse: order.shipping_address?.address1 || "",
      tel: order.shipping_address?.phone || "",
      tel2: "", 
      designation: productNames,
      nb_article: totalArticles || 1,
      msg: `Order ID: ${orderId}`,
    };

    log(`➡️ SENDING TO JETPACK (Qty: ${totalArticles})...`);

    const postData = new URLSearchParams(data).toString();
    const url = new URL(JETPACK_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": postData.length,
      },
    };

    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        log(`✅ SUCCESS JETPACK: ${body}`);
      });
    });

    request.on("error", (e) => {
      log(`❌ ERROR JETPACK: ${e.message}`);
    });

    request.write(postData);
    request.end();

  } catch (err) {
    log(`❌ SERVER ERROR: ${err.message}`);
    // حتى كان فما ايرور، نجاوبو Shopify بش ما يعاودش يبعث
    if (!res.headersSent) res.status(200).send('Error logged');
  }
});

app.get("/logs", (req, res) => {
  const key = req.query.key;
  if (key !== "MonMotDePasse123") return res.status(403).send("Forbidden");
  try {
    if (fs.existsSync(LOG_FILE)) {
        const logs = fs.readFileSync(LOG_FILE, "utf-8");
        res.type("text/plain").send(logs);
    } else { res.send("No logs yet."); }
  } catch (err) { res.status(500).send("Err: " + err.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
