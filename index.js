import express from "express";
import fs from "fs";
import https from "https";

const app = express();
app.use(express.json());

// -------------------------
// CONFIGURATION
// -------------------------
const JETPACK_URL = "https://www.jetpack.tn/apis/mande-DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45/v1/post.php";
const JETPACK_TOKEN = "DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45"; 
const LOG_FILE = "log.txt";

const processedOrders = new Set();

function log(data) {
  const message = `[${new Date().toISOString()}] ${data}\n`;
  console.log(message);
  try { fs.appendFileSync(LOG_FILE, message); } catch (e) {}
}

app.get("/", (req, res) => res.send("🚀 Server Running"));

app.post("/shopify", async (req, res) => {
  // 1. جاوب فيسع
  res.status(200).send('Webhook received');

  try {
    const order = req.body;
    const orderId = order.id;

    // ----------------------------------------------------
    // 🛑 FILTER 1: ممنوع مرور الكومندات الفارغة
    // ----------------------------------------------------
    // هذا إلي بش ينحيلك الزوز كومندات الفارغين
    if (!order.shipping_address || !order.shipping_address.address1) {
      log(`⚠️ IGNORED: Order ${orderId} has no shipping address (Empty payload).`);
      return; 
    }

    // ----------------------------------------------------
    // 🛑 FILTER 2: ممنوع التكرار
    // ----------------------------------------------------
    if (orderId && processedOrders.has(orderId)) {
      console.log(`⚠️ DUPLICATE BLOCKED: Order ${orderId}`);
      return;
    }

    // سجل الكومند
    if (orderId) {
      processedOrders.add(orderId);
      setTimeout(() => processedOrders.delete(orderId), 10 * 60 * 1000);
    }

    log(`📦 PROCESSING VALID ORDER: ${orderId}`);

    // حساب الكمية
    let totalArticles = 0;
    if (order.line_items && Array.isArray(order.line_items)) {
      totalArticles = order.line_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    const productNames = order.line_items?.map(item => `${item.quantity}x ${item.name}`).join(", ") || "Produit";

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

    // Send to Jetpack
    const postData = new URLSearchParams(data).toString();
    const url = new URL(JETPACK_URL);
    const options = {
      hostname: url.hostname, path: url.pathname, method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": postData.length,
      },
    };

    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => log(`✅ SENT TO JETPACK: ${body}`));
    });

    request.on("error", (e) => log(`❌ JETPACK ERROR: ${e.message}`));
    request.write(postData);
    request.end();

  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
  }
});

// Logs Viewer
app.get("/logs", (req, res) => {
    if (req.query.key !== "MonMotDePasse123") return res.status(403).send("Forbidden");
    try { res.type("text/plain").send(fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, "utf-8") : "No logs."); } 
    catch (e) { res.status(500).send(e.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
