// One-off provisioning helper. Run from the deployed LRMobileID application
// directory with its production environment loaded. Never print the secret.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const productId = "prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0";
const url = "https://hpp.lrmobileid.com/api/webhooks/purchases";
const source = "app.lrmobileid.com";
const keyId = "primary";
const command = process.argv[2];

async function main() {
  if (!["check", "create", "reconcile", "enable", "smoke"].includes(command)) throw new Error("Invalid command");
  const root = process.cwd();
  const { pool } = await import(pathToFileURL(resolve(root, "lib/db/index.ts")).href);
  try {
    const { saveOutboundWebhook } = await import(pathToFileURL(resolve(root, "lib/server/outbound-webhooks.ts")).href);
    const product = await pool.query("SELECT id FROM products WHERE id=$1 AND status='ACTIVE'", [productId]);
    if (product.rowCount !== 1) throw new Error("Bundle product is not active");
    const admins = await pool.query('SELECT id FROM "user" WHERE role=$1 LIMIT 1', ["ADMIN"]);
    if (admins.rowCount !== 1) throw new Error("Admin account is missing");
    const endpoints = await pool.query(
      "SELECT id,name,url,format,source,key_id,product_ids,enabled,encrypted_secret FROM outbound_webhook_endpoints WHERE url=$1",
      [url],
    );
    if (endpoints.rowCount > 1) throw new Error("Multiple matching endpoints");

    if (command === "check") {
      console.log(`product=active endpoint_count=${endpoints.rowCount}`);
      return;
    }

    if (command === "create" || command === "reconcile") {
      if (command === "create" && endpoints.rowCount !== 0) throw new Error("Endpoint already exists");
      if (command === "reconcile") {
        const endpoint = endpoints.rows[0];
        if (endpoints.rowCount !== 1 || endpoint.name !== "Kuliner Kit" || endpoint.source !== source ||
            endpoint.key_id !== keyId || JSON.stringify(endpoint.product_ids) !== JSON.stringify([productId])) {
          throw new Error("Existing endpoint does not match expected product");
        }
        const deliveries = await pool.query("SELECT count(*)::integer AS total FROM outbound_webhook_deliveries WHERE endpoint_id=$1", [endpoint.id]);
        if (deliveries.rows[0].total !== 0) throw new Error("Existing endpoint has immutable deliveries");
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 1024) throw new Error("Secret input too large");
        chunks.push(bytes);
      }
      const secret = Buffer.concat(chunks).toString("utf8").trim();
      if (secret.length < 32 || secret.length > 512) throw new Error("Invalid secret length");
      await saveOutboundWebhook({
        ...(command === "reconcile" ? { id: endpoints.rows[0].id } : {}),
        name: command === "reconcile" ? "Kuliner Kit" : "KulinerKit", url, format: "hpp", source, keyId, secret,
        productIds: [productId], enabled: command === "reconcile",
      }, admins.rows[0].id);
      const updated = await pool.query("SELECT encrypted_secret,format,enabled FROM outbound_webhook_endpoints WHERE url=$1", [url]);
      const { decryptJson } = await import(pathToFileURL(resolve(root, "lib/server/crypto.ts")).href);
      const stored = decryptJson(updated.rows[0].encrypted_secret);
      if (stored.secret !== secret || updated.rows[0].format !== "hpp") throw new Error("Stored endpoint verification failed");
      console.log(command === "reconcile" ? "endpoint_reconciled=enabled secret_match=true" : "endpoint_created=disabled secret_match=true");
      return;
    }

    const endpoint = endpoints.rows[0];
    if (command === "smoke") {
      if (!endpoint || endpoint.name !== "Kuliner Kit" || endpoint.format !== "hpp" || endpoint.source !== source ||
          endpoint.key_id !== keyId || JSON.stringify(endpoint.product_ids) !== JSON.stringify([productId]) ||
          endpoint.enabled !== true) throw new Error("Endpoint configuration does not match bundle");
      const { decryptJson } = await import(pathToFileURL(resolve(root, "lib/server/crypto.ts")).href);
      const { sendOutboundWebhook } = await import(pathToFileURL(resolve(root, "lib/server/outbound-webhook-transport.ts")).href);
      const stored = decryptJson(endpoint.encrypted_secret) as { secret: string };
      const result = await sendOutboundWebhook({
        id: "integration-smoke-invalid-body", url, body: "{}", secret: stored.secret, keyId, format: "hpp",
      });
      if (result.status !== 422) throw new Error(`Unexpected receiver status ${result.status}`);
      console.log("sender_smoke=422 signature_accepted=true payload_rejected=true");
      return;
    }
    if (!endpoint || endpoint.name !== "KulinerKit" || endpoint.format !== "hpp" || endpoint.source !== source ||
        endpoint.key_id !== keyId || JSON.stringify(endpoint.product_ids) !== JSON.stringify([productId])) {
      throw new Error("Endpoint configuration does not match bundle");
    }
    if (endpoint.enabled) {
      console.log("endpoint_enabled=already");
      return;
    }
    await saveOutboundWebhook({
      id: endpoint.id, name: "KulinerKit", url, format: "hpp", source, keyId,
      productIds: [productId], enabled: true,
    }, admins.rows[0].id);
    console.log("endpoint_enabled=true");
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Konfigurasi endpoint gagal; nilai secret tidak ditampilkan.");
  process.exitCode = 1;
});
