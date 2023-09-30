import { SearchDatabase, UpdateDocument } from "./database.js";
import { normalizeProduct } from "./normalizeProduct.js";
import { jsonDiff } from "./jsonDiff.js";
import shopify from "../shopify.js";

const GET_CATEGORY_QUERY = `
    query GetCategory($id: ID!) {
        product(id: $id) {
            id
            productCategory {
                productTaxonomyNode {
                    id
                }
            }
        }
    }
`;

const UPDATE_CATEGORY_MUTATION = `
    mutation UpdateCategory($input: ProductInput!) {
        productUpdate(input: $input) {
            product {
                id
                productCategory {
                    productTaxonomyNode {
                        id
                    }
                }
            }
        }
    }
`;

const priceMultiplier = 0.5;

/**
 * Updates a product
 */
export async function productUpdater(shop, session, payload) {

    const updatedId = payload.id;

    console.log("Searching for product in database...");

    const searchOriginals = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: shop,
        query: { productId: updatedId }
    });

    const searchCopies = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: shop,
        query: { copyId: updatedId }
    });

    console.log("Evaluating search results...");

    // If either has more than 1 result or both have 1 result, there's a duplicate in the database.
    if ((searchOriginals.length > 1 || searchCopies.length > 1) || (searchOriginals.length === 1 && searchCopies.length === 1))
        throw new Error("There are multiple records for this product.");

    // If both have 0 results, we aren't syncing this product.
    if (searchOriginals.length === 0 && searchCopies.length === 0) {
        console.log("This product is not being synced. Ignoring webhook.");
        return;
    }

    // If we synced this product within the last 5 seconds, ignore this webhook.
    if ((searchOriginals[0] || searchCopies[0]).lastSynced > new Date(Date.now() - 10000)) {
        console.log("This product was synced within the last 10 seconds. Ignoring webhook.");
        return;
    }

    // Now we know that either the original or the copy has 1 result.
    
    const isOriginal = searchOriginals.length === 1;
    console.log(isOriginal ? "The updated project is the original." : "The updated product is the copy.")
    const result = isOriginal ? searchOriginals[0] : searchCopies[0];
    const otherId = isOriginal ? result.copyId : result.productId;
    const old_data = result.cachedProductData;

    const old_product = normalizeProduct(old_data);
    const new_product = normalizeProduct(payload);

    console.log("Normalizing product data...");

    // Remove the wholesale tag if it exists (we will add it back later, but only to the copy)
    new_product.tags = new_product.tags.replace(", Wholesale Copy", "");
    new_product.tags = new_product.tags.replace("Wholesale Copy", "");
    
    // If the copy was updated, modify the prices to look like it's the original
    if (!isOriginal) {
        new_product.variants.forEach(variant => {
            variant.price = variant.price / priceMultiplier;
        });
    }

    // Remove images. We can't sync the images or else problems will occur.
    // (images being overwritten)
    // But we still save the images into the database to display in the app.
    const productImages = new_product.images;
    delete old_product.images;
    delete new_product.images;

    // Delete all the IDs so we can compare the objects
    new_product.options.forEach(option => {
        delete option.id;
    });
    new_product.variants.forEach(variant => {
        delete variant.id;
        delete variant.product_id;
    });

    console.log("Calculating differences...");

    // Get what was changed
    const differences = jsonDiff(old_product, new_product);

    // Ensure the differences contain the tags
    if (!differences.tags) differences.tags = new_product.tags;

    // If nothing was changed, ignore this webhook.
    if (differences.length === 0)
        return;

    console.log("Updating products...");

    // Update the original

    const original = new shopify.api.rest.Product({ session: session });
    Object.assign(original, differences);
    if (original.tags?.includes("Wholesale Copy")) original.tags = original.tags.replace(", Wholesale Copy", "").replace("Wholesale Copy", ""); // remove either instance of the tag
    original.id = result.productId;
    await original.save({ update: true });

    // Update the copy

    const copy = new shopify.api.rest.Product({ session: session });
    Object.assign(copy, differences);
    if (differences.tags || !copy.tags?.includes("Wholesale Copy")) copy.tags = new_product.tags.length > 0 ? new_product.tags + ", Wholesale Copy" : "Wholesale Copy";
    if (differences.variants) 
        differences.variants = differences.variants.map(variant => {
            variant.price = variant.price * priceMultiplier;
            delete variant.id;
            delete variant.product_id;
            delete variant.inventory_item_id;
            return variant;
    });
    copy.id = result.copyId;
    await copy.save({ update: true });

    console.log("Updating inventory...");

    // Update inventory

    // First get a list of updated inventory item IDs and quantities.

    const updatedIds = (isOriginal ? original : copy).variants.map(variant => variant.inventory_item_id);
    const updatedQuantities = (isOriginal ? original : copy).variants.map(variant => variant.inventory_quantity || 0);
    const otherIds = (isOriginal ? copy : original).variants.map(variant => variant.inventory_item_id);

    // Now use the InventoryLevel in the REST API to update the quantity of the other inventory items.

    // First we need to add the locations to the inventoryInfo

    const locationsResponse = await shopify.api.rest.Location.all({ session: session });
    const locations = locationsResponse.data.map(location => location.id) || [];
    const inventoryItemsResponse = await shopify.api.rest.InventoryLevel.all({ session: session, location_ids: locations.join(",") });

    const itemsAndLocations = {};
    inventoryItemsResponse.data
        .filter(item => otherIds.includes(item.inventory_item_id))
        .forEach(item => {
            itemsAndLocations[item.inventory_item_id] = item.location_id;
        });

    const queries = updatedIds.map((id, index) => ({
        originalId: id,
        updatedId: otherIds[index],
        locationId: itemsAndLocations[otherIds[index]] || locations[0] || undefined,
        quantity: updatedQuantities[index],
    }));

    // Now call the API

    const levelClient = new shopify.api.rest.InventoryLevel({ session: session });
    queries.forEach(async query => {
        if (!query.locationId) {
            console.log("NO LOCATION ID:");
            console.log(query);
            return
        };
        await levelClient.set({
            body: {
                inventory_item_id: query.updatedId,
                location_id: query.locationId,
                available: query.quantity,
            }
        });
    });

    console.log("Updating categories...");

    // Take the product that was updated, and using GraphQL, ensure both products' categories match
    
    const gqlClient = new shopify.api.clients.Graphql({ session });

    // Get the category

    const categoryResponse = await gqlClient.query({
        data: {
            query: GET_CATEGORY_QUERY,
            variables: {
                id: "gid://shopify/Product/" + updatedId,
            },
        },
    });

    // Update the category for the other product

    const category = categoryResponse.body.data.product.productCategory;
    const categoryInput = category ? { productTaxonomyNodeId: category.productTaxonomyNode.id } : null;

    gqlClient.query({
        data: {
            query: UPDATE_CATEGORY_MUTATION,
            variables: {
                input: {
                    id: "gid://shopify/Product/" + otherId,
                    productCategory: categoryInput,
                }
            },
        },
    });

    console.log("Updating metafields...");

    // Set each product's Counterpart metafield to the other product's ID.

    const original_metafield = new shopify.api.rest.Metafield({ session: session });
    original_metafield.product_id = result.productId;
    original_metafield.namespace = "productsync";
    original_metafield.key = "counterpart";
    original_metafield.value = "gid://shopify/Product/" + result.copyId;
    original_metafield.type = "product_reference";
    original_metafield.save({ update: true });

    const copy_metafield = new shopify.api.rest.Metafield({ session: session });
    copy_metafield.product_id = result.copyId;
    copy_metafield.namespace = "productsync";
    copy_metafield.key = "counterpart";
    copy_metafield.value = "gid://shopify/Product/" + result.productId;
    copy_metafield.type = "product_reference";
    copy_metafield.save({ update: true });
    
    console.log("Updating database...");

    // Put the images back
    new_product.images = productImages || [];

    // Update the cached product data in the database

    await UpdateDocument({
        databaseName: "ProductSync",
        collectionName: shop,
        query: (isOriginal ? { productId: updatedId } : { copyId: updatedId }),
        data: {
            cachedProductData: new_product,
            lastSynced: new Date(), 
        }
    });
}