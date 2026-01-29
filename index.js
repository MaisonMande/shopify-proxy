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
  "DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45"; // ثبت مليح إنو التوكن صحيح

const LOG_FILE = "log.txt";

// -------------------------
// Helper: Logging
// -------------------------
function log(data) {
  const message = `[${new Date().toISOString()}] ${data}\n`;
  console.log(message); // نكتبو في الكونسول متاع Render زادة
  try {
    fs.appendFileSync(LOG_FILE, message);
  } catch (err) {
    console.error("Error writing to log file:", err);
  }
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
  // 1️⃣ أهم تبديل: جاوب Shopify دييييركت (Fire and Forget)
  // هكا Shopify يعرف أنو الـ Webhook وصل، وماعادش يعاود يبعثو (No more retries)
  res.status(200).send('Webhook received');

  // الكود الباقي يكمل يخدم وحدو حتى بعد ما جاوبنا Shopify
  try {
    log("📦 RAW SHOPIFY PAYLOAD RECEIVED");
    
    const order = req.body;

    if (!order.id) {
      log("❌ ERROR: Missing order.id - Ignoring.");
      return; // خرجنا خاطر ما فماش فايدة نكملو، أما ديجا جاوبنا Shopify بـ 200
    }

    // -------------------------
    // Build Jetpack data
    // -------------------------
    const data = {
      prix: order.total_price || 0,
      nom: (order.customer?.first_name || "") + " " + (order.customer?.last_name || ""),
      gouvernerat: order.shipping_address?.province || "",
      ville: order.shipping_address?.city || "",
      adresse: order.shipping_address?.address1 || "",
      tel: order.shipping_address?.phone || "",
      tel2: "", 
      designation: order.line_items?.map(item => item.name).join(", ") || "Produit",
      nb_article: order.line_items?.length || 1,
      msg: `Order ID: ${order.id}`, // نزيدو الـ ID في الميساج بش نعرفو أناهي الكومند
    };

    log(`➡️ SENDING ORDER ${order.id} TO JETPACK...`);

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
        "Authorization": "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": postData.length,
      },
    };

    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        // لهنا معاش نجمو نعملو res.json خاطر ديجا جاوبنا لفوق
        // جيست نقيدو في اللوج شنوة صار
        log(`✅ SUCCESS JETPACK RESPONSE: ${body}`);
      });
    });

    request.on("error", (e) => {
      log(`❌ ERROR SENDING TO JETPACK: ${e.message}`);
    });

    request.write(postData);
    request.end();

  } catch (err) {
    // حتى كان فما غلطة، نكتبوها في اللوج، أما Shopify ديجا خدا الـ OK
    log(`❌ SERVER ERROR: ${err.message}`);
  }
});

// -------------------------
// LOGS VIEW
// -------------------------
app.get("/logs", (req, res) => {
  const key = req.query.key;
  if (key !== "MonMotDePasse123") return res.status(403).send("Forbidden");
  try {
    if (fs.existsSync(LOG_FILE)) {
        const logs = fs.readFileSync(LOG_FILE, "utf-8");
        res.type("text/plain").send(logs);
    } else {
        res.send("No logs yet.");
    }
  } catch (err) {
    res.status(500).send("Cannot read log file: " + err.message);
  }
});

// -------------------------
// START SERVER
// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
