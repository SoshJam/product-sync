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

app.get("/api/shop", (_req, res) => {
  res.status(200).send({ success: true, shop: res.locals.shopify.session.shop.split(".")[0] });
});

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
    });
    
    const copyId = search[0].copyId;

    if (!copyId) throw new Error("Could not get copyId.");

    // Then delete the record in the database

    DeleteDocument({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop.split(".")[0],
      query: { productId: parseInt(_req.params.id, 10) }
    });

    // And delete the duplicate product in Shopify

    shopify.api.rest.Product.delete({
      session: res.locals.shopify.session,
      id: copyId,
    });
    
  }
  
  catch (e) {
    status = 500;
    error = e.message;
  }
  
  res.status(status).send({ success: status === 200, error });
});

app.post("/api/database/insert", async (_req, res) => {
  let status = 200;
  let errors = [];
  const products = _req.body.products;
  var results = [];
  
  try {
    // Must use a for loop here because we need to await the result of each call to productDuplicator
    for (let i = 0; i < products.length; i++) {
      results[i] = await productDuplicator(products[i], res.locals.shopify.session);
    }
  }

  catch (e) {
    status = 500;
    errors.push(e.message);
  }

  res.status(status).send({ success: status === 200, errors, results });
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
