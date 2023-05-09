import { Session } from "@shopify/shopify-api";
import { InsertDocument, SearchDatabase, UpdateDocument, DeleteDocument, DropCollection } from "./database.js";
import shopify from "../shopify.js";

/**
 * When a product is updated:
 * - Update the record in the database.
 * - Update the counterpart in Shopify.
 *      - Make sure to change the price and tags.
 * 
 * @param {number | undefined} productId - The ID of the product that was updated.
 * @param {Session} session - The authenticated Shopify session.
 */
export async function ProductUpdate( productId, session ) {
    if (!productId) return;
}

/**
 * When a product is deleted:
 * - If it's a copy, delete the record from the database.
 * - If it's the original, delete the record from the database and delete the copy from Shopify.
 * 
 * @param {number | undefined} productId - The ID of the product that was deleted.
 * @param {Session} session - The authenticated Shopify session.
 */
export async function ProductDelete( productId, session ) {
    if (!productId) return;

    const searchOriginals = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        query: { productId: productId }
    });

    const searchCopies = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        query: { copyId: productId }
    });

    // if either has more than 1 result,
    // or if both have 1 result,
    // there's a problem
    if ((searchOriginals.length > 1 || searchCopies.length > 1) ||
        (searchOriginals.length === 1 && searchCopies.length === 1))
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
        collectionName: session.shop.split(".")[0],
        query: (searchOriginals.length === 1 ? { productId: productId } : { copyId: productId })
    });
}

/**
 * (Mandatory webhook)
 * When the app is uninstalled, we must delete the data from the database.
 * 
 * @param {Session} session - The authenticated Shopify session.
 */
export async function AppUninstalled( session ) {
    await DropCollection({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0]
    });
}

/**
 * There are two more mandatory webhooks, but we are not storing any customer data
 * so we don't need to implement them.
 */