import { DeliveryMethod } from "@shopify/shopify-api";
import { GetSession, DeleteDocument, DropCollection } from "./database.js";

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
    SHOP_REDACT: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);

            // Delete the collection of synced products specific to this store
            await DropCollection({
                databaseName: "ProductSync",
                collectionName: session.shop
            });

            // Delete the store's session/access token data
            await DeleteDocument({
                databaseName: "ProductSync",
                collectionName: "clients",
                query: { shop: session.shop }
            });
        },
    },

    /**
     * When a product is updated, Shopify invokes this webhook.
     */
    PRODUCTS_UPDATE: {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: "/api/webhooks",
        callback: async (topic, shop, body, webhookId) => {
            console.log(`Received webhook: ${topic} - ${webhookId}`);
            const payload = JSON.parse(body);
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