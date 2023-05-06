// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import GDPRWebhookHandlers from "./gdpr.js";
import { InsertDocument, SearchDatabase, DeleteDocument } from "./backend/database.js";
import { productDuplicator } from "./backend/productDuplicator.js";
const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "5000", 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  // @ts-ignore
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

// CRUD operations for the database

app.get("/api/database/get", async (_req, res) => {
  let status = 200;
  let error = null;
  let result = [];

  try {
    result = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop.split(".")[0],
      query: {}
    });
  }
  
  catch (e) {
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error, result });
});

app.get("/api/database/get/:id", async (_req, res) => {
  let status = 200;
  let error = null;
  let result = [];

  try {
    result = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop.split(".")[0],
      query: { productId: parseInt(_req.params.id, 10) }
    });
  }
  
  catch (e) {
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error, result });
});

app.delete("/api/database/delete/:id", async (_req, res) => {
  let status = 200;
  let error = null;
  let search;

  try {

    // First search the database and get the id of the duplicate

    search = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop.split(".")[0],
      query: { productId: parseInt(_req.params.id, 10) }
    })
    
    const copyId = search[0].copyId;

    if (!copyId) throw new Error("Could not get copyId.");

    // Then delete the record in the database

    await DeleteDocument({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop.split(".")[0],
      query: { productId: parseInt(_req.params.id, 10) }
    });

    // Finally, delete the duplicate product in Shopify

    await shopify.api.rest.Product.delete({
      session: res.locals.shopify.session,
      id: copyId,
    });
    
  }
  
  catch (e) {
    status = 500;
    error = e.message;
  }
  
  res.status(status).send({ success: status === 200, error, search });
});

app.post("/api/database/insert", async (_req, res) => {
  let status = 200;
  let error = null;
  const product = _req.body.product;
  var result;
  
  try {
    result = await productDuplicator(product, res.locals.shopify.session);
  }

  catch (e) {
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error, result });
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
