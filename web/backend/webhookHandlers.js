import { DeliveryMethod } from "@shopify/shopify-api";
import { SearchDatabase, InsertDocument, UpdateDocument, DeleteDocument, DropCollection, GetSession } from "./database.js";
import shopify from "../shopify.js";
import { normalizeProduct } from "./normalizeProduct.js";
import { jsonDiff } from "./jsonDiff.js";

/**
 * I would love to know how these get processed but unfortunately the
 * documentation is lacking.
 */

export default {
    /**
     * Customers can request their data from a store owner. When this happens,
     * Shopify invokes this webhook.
     * 
     * NOTE: We aren't storing any customer data, so this webhook is not necessary.
     *
     * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#customers-data_request
     */
    CUSTOMERS_DATA_REQUEST: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);
        },
    },

    /**
     * Store owners can request that data is deleted on behalf of a customer. When
     * this happens, Shopify invokes this webhook.
     * 
     * NOTE: We aren't storing any customer data, so this webhook is not necessary.
     * 
     * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#customers-redact
     */
    CUSTOMERS_REDACT: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);
        },
    },

    /**
     * 48 hours after a store owner uninstalls the app, Shopify invokes this
     * webhook.
     * 
     * WE MUST:
     * - Delete the product data from the database
     * - Delete the store's session/access token data
     * - MAYBE: Delete the webhooks, but I think Shopify does this automatically
     * 
     * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks#shop-redact
     */
    APP_UNINSTALLED: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);

            // Delete the collection of synced products specific to this store
            await DropCollection({
                databaseName: "ProductSync",
                collectionName: shop
            });

            // Delete the store's session/access token data
            await DeleteDocument({
                databaseName: "ProductSync",
                collectionName: "clients",
                query: { shop: shop }
            });
        },
    },

    /**
     * When a product is updated, Shopify invokes this webhook.
     * 
     * WE MUST:
     * - Determine if the updated product is the original or the copy
     * - Figure out what was actually changed based on the cached product data
     * - Using a REST query, update the other product with the changes
     *     - Then use a GraphQL query to make the copy category match the original
     * - If the copy was updated, update it again to ensure everything is adjusted right.
     * - Update the cached product data in the database.
     */
    PRODUCTS_UPDATE: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);
            const payload = JSON.parse(body);
            
            const priceMultiplier = 0.5;
            const productId = payload.id;

            const session = await GetSession({ shop });

            const searchOriginals = await SearchDatabase({
                databaseName: "ProductSync",
                collectionName: shop,
                query: { productId: productId }
            });

            const searchCopies = await SearchDatabase({
                databaseName: "ProductSync",
                collectionName: shop,
                query: { copyId: productId }
            });

            // If either has more than 1 result or both have 1 result, there's a duplicate in the database.
            if ((searchOriginals.length > 1 || searchCopies.length > 1) || (searchOriginals.length === 1 && searchCopies.length === 1))
                throw new Error("There are multiple records for this product.");

            // If both have 0 results, we aren't syncing this product.
            if (searchOriginals.length === 0 && searchCopies.length === 0)
                return;

            // If we synced this product within the last 5 seconds, ignore this webhook.
            if ((searchOriginals[0] || searchCopies[0]).lastSynced > new Date(Date.now() - 5000))
                return;

            // Now we know that either the original or the copy has 1 result.

            const isOriginal = searchOriginals.length === 1;
            const old_data = isOriginal ? searchOriginals[0].cachedProductData : searchCopies[0].cachedProductData;

            const old_product = normalizeProduct(old_data);
            const new_product = normalizeProduct(payload);
            
            // If the copy was updated, modify the data to look like it's the original
            if (!isOriginal) {
                new_product.tags = new_product.tags.replace(", ProductSync Copy", "");
                new_product.tags = new_product.tags.replace("ProductSync Copy", "");

                new_product.title = new_product.title.replace(" (ProductSync Copy)", "");

                new_product.variants.forEach(variant => {
                    variant.price = variant.price / priceMultiplier;
                });
            }

            // Delete all the IDs so we can compare the objects
            new_product.images.forEach(image => {
                delete image.id;
            });
            new_product.options.forEach(option => {
                delete option.id;
            });
            new_product.variants.forEach(variant => {
                delete variant.id;
                delete variant.productId;
            });

            // Get what was changed
            const differences = jsonDiff(old_product, new_product);

            // Update the original

            const original = new shopify.api.rest.Product({ session: session });
            original.id = (searchOriginals[0] || searchCopies[0]).productId;
            Object.assign(original, differences);
            await original.save({ update: true });

            // Update the copy

            const copy = new shopify.api.rest.Product({ session: session });
            copy.id = (searchOriginals[0] || searchCopies[0]).copyId;
            Object.assign(copy, differences);
            if (differences.title) copy.title = differences.title + " (ProductSync Copy)";
            if (differences.tags) copy.tags = differences.tags.length > 0 ? differences.tags + ", ProductSync Copy" : "ProductSync Copy";
            if (differences.variants) 
                differences.variants = differences.variants.map(variant => {
                    variant.price = variant.price * priceMultiplier;
                    delete variant.id;
                    delete variant.productId;
                    return variant;
                });
            await copy.save({ update: true });

            // Update the cached product data in the database

            await UpdateDocument({
                databaseName: "ProductSync",
                collectionName: shop,
                query: (isOriginal ? { productId: productId } : { copyId: productId }),
                data: {
                    cachedProductData: new_product,
                    lastSynced: new Date(), 
                }
            });
        },
    },

    /**
     * When a product is deleted, Shopify invokes this webhook.
     * 
     * WE MUST:
     * - Delete the record in the database
     * - If this is the original, delete the copy from Shopify
     */
    PRODUCTS_DELETE: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);
            const payload = JSON.parse(body);
            
            const productId = payload.id;

            const session = await GetSession({ shop });

            const searchOriginals = await SearchDatabase({
                databaseName: "ProductSync",
                collectionName: shop,
                query: { productId: productId }
            });

            const searchCopies = await SearchDatabase({
                databaseName: "ProductSync",
                collectionName: shop,
                query: { copyId: productId }
            });

            // If either has more than 1 result or both have 1 result, there's a duplicate in the database.
            if ((searchOriginals.length > 1 || searchCopies.length > 1) || (searchOriginals.length === 1 && searchCopies.length === 1))
                throw new Error("There are multiple records for this product.");

            // If both have 0 results, we aren't syncing this product.
            if (searchOriginals.length === 0 && searchCopies.length === 0)
                return;

            // If we haven't thrown an error or returned, either the original or the copy has 1 result.

            // If the original has 1 result, then the original was deleted and we also must delete the copy.
            if (searchOriginals.length === 1)
                await shopify.api.rest.Product.delete({ session: session, id: searchOriginals[0].copyId});

            // If the copy was deleted, we don't need to delete the original from Shopify.

            // Either way, we must delete the record from the database to stop syncing.
            await DeleteDocument({
                databaseName: "ProductSync",
                collectionName: shop,
                query: (searchOriginals.length === 1 ? { productId: productId } : { copyId: productId })
            });
        },
    },
}