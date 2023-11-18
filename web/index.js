// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import WebhookHandlers from "./backend/webhookHandlers.js";
import { InsertDocument, SearchDatabase, DeleteDocument } from "./backend/database.js";
import { productDuplicator } from "./backend/productDuplicator.js";
const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "5000", 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling

const saveSession = async (req, res, next) => {
  console.log("[product-sync/INFO] Saving session.");

  const session = res.locals.shopify.session;
  session.isOnline = true;

  // Delete any existing session for this shop
  await DeleteDocument({
    databaseName: "ProductSync",
    collectionName: "clients",
    query: { shop: session.shop }
  });

  // Save the session to the database
  await InsertDocument({
    databaseName: "ProductSync",
    collectionName: "clients",
    data: {
      shop: session.shop,
      session: session,
    }
  });

  return next();
};

const createWebhooks = async (_req, res, next) => {
  console.log("[product-sync/INFO] Creating webhooks...");

  const address = `${process.env.HOST}/api/webhooks`;
  const requiredSubscriptions = [
    "products/update", // When a product/variant is updated or ordered
    "products/delete", // When a product is deleted
    "app/uninstalled", // When the app is uninstalled
  ];

  // First loop through and get the webhooks that are already present
  const existingWebhooksReponse = await shopify.api.rest.Webhook.all({ session: res.locals.shopify.session });
  const existingWebhooks = existingWebhooksReponse.data
    .filter((webhook) => webhook.address == address)
    .map((webhook) => ({ topic: webhook.topic, address: webhook.address, id: webhook.id }));
  const existingSubscriptions = existingWebhooks.map((webhook) => webhook.topic);

  // Then loop through and create the webhooks that are not already present

  requiredSubscriptions.forEach(async (subscription) => {
    if (!existingSubscriptions.includes(subscription)) {
      const webhook = new shopify.api.rest.Webhook({ session: res.locals.shopify.session });
      webhook.topic = subscription;
      webhook.address = address;
      webhook.format = "json";
      webhook.save();
    }
  });

  console.log("[product-sync/INFO]  " + Math.max(0, requiredSubscriptions.length - existingSubscriptions.length) + " webhooks created for address " + address + ".");

  return next();
}
      
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(), // given callback function
  saveSession, // save the session data to the database
  createWebhooks, // create the necessary webhook subscriptions
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  // @ts-ignore - the types are a little off here
  shopify.processWebhooks({ webhookHandlers: WebhookHandlers }),
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

// Everything after this point requires authentication

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

// Webhooks

app.get("/api/create-webhooks", createWebhooks);


// CRUD operations for the database

app.get("/api/database/get", async (_req, res) => {
  let status = 200;
  let error = null;
  let result = [];

  try {
    result = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop,
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
      collectionName: res.locals.shopify.session.shop,
      query: { productId: parseInt(_req.params.id, 10) }
    });
  }
  
  catch (e) {
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error, result });
});

// Endpoint for deleting a product from the database and Shopify

app.delete("/api/database/delete/:id", async (_req, res) => {
  let status = 200;
  let error = null;
  let search;

  try {

    // First search the database and get the id of the duplicate

    search = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop,
      query: { productId: parseInt(_req.params.id, 10) }
    });
    
    const copyId = search[0].copyId;

    if (!copyId) throw new Error("Could not get copyId.");

    // Then delete the record in the database

    DeleteDocument({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop,
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

// Endpoint for deleting ALL products from the database and Shopify

app.delete("/api/database/delete-all", async (_req, res) => {
  let status = 200;
  let error = null;
  let search;

  try {

    // First search the database and get the ids of the duplicates

    search = await SearchDatabase({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop,
      query: {}
    });

    const copyIds = search.map((product) => product.copyId);

    if (!copyIds) throw new Error("Could not get copyIds.");

    // Then delete the records in the database

    DeleteDocument({
      databaseName: "ProductSync",
      collectionName: res.locals.shopify.session.shop,
      query: {}
    });

    // And delete the duplicate products in Shopify

    copyIds.forEach((copyId) => {
      shopify.api.rest.Product.delete({
        session: res.locals.shopify.session,
        id: copyId,
      });
    });

  }

  catch (e) {
    status = 500;
    error = e.message;
  }

  res.status(status).send({ success: status === 200, error });
});

// Endpoint for inserting a product into the database and Shopify

app.post("/api/database/insert", async (_req, res) => {
  let status = 200;
  let errors = [];
  const products = _req.body.products;
  var results = [];
  var failures = [];
  
  try {
    // Must use a for loop here because we need to await the result of each call to productDuplicator
    for (let i = 0; i < products.length; i++) {
      console.log("[product-sync/duplicate/INFO] Duplicating product " + products[i].id.split("/")[4] + " on Shopify..." + (products[i].title? " (" + products[i].title + ")" : ""));
      results[i] = await productDuplicator(products[i], res.locals.shopify.session, (failure) => failures.push(failure));
    }
  }

  catch (e) {
    status = 500;
    errors.push(e.message);
  }

  console.log("[product-sync/duplicate/WARN] " + failures.length + " products failed to duplicate:");
  failures.forEach((failure) => console.log("[product-sync/duplicate/WARN] - " + failure));

  res.status(status).send({ success: status === 200, errors, results });
});

// Misc

app.get("/api/shop", (_req, res) => {
  res.status(200).send({ success: true, shop: res.locals.shopify.session.shop });
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
