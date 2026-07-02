import express from "express";
import fs from "fs";
import https from "https";

const app = express();
app.use(express.json());

// -------------------------
// CONFIGURATION
// -------------------------
// 
const JETPACK_ADD_URL = "https://jetpack.tn/apis-v2/add_order.php";
const JETPACK_TRACK_URL = "https://jetpack.tn/apis-v2/track_order.php";

// 
const JETPACK_ADD_TOKEN = "groupegratitextile-900TNW5BQPGXQZKQUWLK5K7YVY9VKSEZ";       // 
const JETPACK_TRACK_TOKEN = "groupegratitextile-etat-900TNW5BQPGXQZKQUWLK5K7YVY9VKSEZ";  // 

const LOG_FILE = "log.txt";
const LOG_PASSWORD = "MonMotDePasse123"; // Mot de passe pour voir les logs

const processedOrders = new Set();

// Fonction Helper pour les logs
function log(data) {
  const message = `[${new Date().toISOString()}] ${data}\n`;
  console.log(message.trim());
  try { fs.appendFileSync(LOG_FILE, message); } catch (e) { console.error("Log file error:", e); }
}

// Helper générique pour appeler l'API Jetpack (POST x-www-form-urlencoded + X-Api-Key)
function callJetpackAPI(targetUrl, token, dataObj) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(dataObj).toString();
    const url = new URL(targetUrl);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "X-Api-Key": token,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ statusCode: response.statusCode, json });
        } catch (e) {
          resolve({ statusCode: response.statusCode, raw: body });
        }
      });
    });

    request.on("error", (e) => reject(e));
    request.write(postData);
    request.end();
  });
}

app.get("/", (req, res) => res.send("🚀 Server Running & Ready"));

// -------------------------
// WEBHOOK SHOPIFY -> AJOUT COMMANDE JETPACK
// -------------------------
app.post("/shopify", async (req, res) => {
  // 1. Réponse immédiate pour que Shopify ne réessaye pas (Timeout prevention)
  res.status(200).send("Webhook received");

  try {
    const order = req.body;
    const orderId = order.id;

    // ----------------------------------------------------
    // 🛑 FILTER 1: Vérification Adresse (Pas d'adresse = Pas de livraison)
    // ----------------------------------------------------
    if (!order.shipping_address || !order.shipping_address.address1) {
      log(`⚠️ IGNORED: Order ${orderId} - Pas d'adresse de livraison.`);
      return;
    }

    // ----------------------------------------------------
    // 🛑 FILTER 2: Anti-Doublons (Deduplication)
    // ----------------------------------------------------
    if (orderId && processedOrders.has(orderId)) {
      console.log(`⚠️ DUPLICATE BLOCKED: Order ${orderId} déjà traitée.`);
      return;
    }

    if (orderId) {
      processedOrders.add(orderId);
      setTimeout(() => processedOrders.delete(orderId), 10 * 60 * 1000);
    }

    log(`📦 PROCESSING VALID ORDER: ${orderId}`);

    // Calcul du nombre total d'articles
    let totalArticles = 0;
    if (order.line_items && Array.isArray(order.line_items)) {
      totalArticles = order.line_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // Formatage de la liste des produits
    const productNames = order.line_items?.map(item => `${item.quantity}x ${item.name}`).join(", ") || "Produit Divers";

    // Récupération des champs Shopify
    const firstName = order.customer?.first_name || order.shipping_address?.first_name || "";
    const lastName = order.customer?.last_name || order.shipping_address?.last_name || "";

    // ----------------------------------------------------
    // 🛠️ MAPPAGE DESTINATION (province -> gouvernerat, sinon ville)
    // ----------------------------------------------------
    const provinceShopify = order.shipping_address?.province || "";
    const cityShopify = order.shipping_address?.city || "";

    const data = {
      nom: `${firstName} ${lastName}`.trim(),
      tel: order.shipping_address?.phone || order.customer?.phone || "",
      tel2: "",
      adresse: `${order.shipping_address?.address1} ${order.shipping_address?.address2 || ""}`.trim(),
      ville: cityShopify,
      gouvernerat: provinceShopify ? provinceShopify : cityShopify,
      prix: order.total_price || 0,
      designation: productNames,
      article: "",
      nb_article: totalArticles || 1,
      echange: 0,
      nb_echange: "",
      fragile: 0,
      ouvrir: 0,
      msg: `Order ID: ${orderId}`,
    };

    const result = await callJetpackAPI(JETPACK_ADD_URL, JETPACK_ADD_TOKEN, data);

    if (result.json && result.json.status === 1) {
      log(`✅ SENT TO JETPACK SUCCESS - Order ${orderId} -> Code à barre: ${result.json.status_message}`);
    } else {
      log(`⚠️ JETPACK ERROR (${result.statusCode}) - Order ${orderId}: ${JSON.stringify(result.json || result.raw)}`);
    }

  } catch (err) {
    log(`❌ CRITICAL ERROR: ${err.message}`);
  }
});

// -------------------------
// TRACK ORDER (suivi de commandes existantes)
// GET /track?codes=723788116090,723788116091
// -------------------------
app.get("/track", async (req, res) => {
  try {
    const codes = req.query.codes;
    if (!codes) return res.status(400).json({ status: 0, status_message: "Parametre codes manquant" });

    const result = await callJetpackAPI(JETPACK_TRACK_URL, JETPACK_TRACK_TOKEN, { codes });
    log(`🔍 TRACK REQUEST: ${codes}`);
    res.status(result.statusCode || 200).json(result.json || result.raw);
  } catch (err) {
    log(`❌ TRACK ERROR: ${err.message}`);
    res.status(500).json({ status: 0, status_message: err.message });
  }
});

// -------------------------
// Logs Viewer (Sécurisé un minimum)
// -------------------------
app.get("/logs", (req, res) => {
  if (req.query.key !== LOG_PASSWORD) return res.status(403).send("⛔ Accès Interdit");

  try {
    if (fs.existsSync(LOG_FILE)) {
      const logs = fs.readFileSync(LOG_FILE, "utf-8");
      res.type("text/plain").send(logs);
    } else {
      res.send("Aucun log pour le moment.");
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
