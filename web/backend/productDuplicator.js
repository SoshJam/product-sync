import { InsertDocument, SearchDatabase } from "./database.js";
import shopify from "../shopify.js";

export async function productDuplicator(product, session) {

    const priceMultiplier = 0.5;
    var output = {};

    // The product id comes as a string so we need to convert it to the
    // integer found after the last slash in the string

    product.id = parseInt(product.id.split("/").pop(), 10);

    // see if it's already syncing
    const searchResult = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        query: { productId: product.id }
    });
    
    if (searchResult.length > 0)
    throw new Error("This product is already syncing.");
    
    output.searchResult = { searchResult, collectionName: session.shop.split(".")[0] };
    
    // Set up the duplicate product

    

    const copy = Object.assign({}, product);

    if (typeof copy.tags === "string")
        if (copy.tags === "")
            copy.tags = "ProductSync Copy";
        else
            copy.tags = [copy.tags, "ProductSync Copy"];
    else
        copy.tags.push("ProductSync Copy");

    copy.handle = `${copy.handle}-productsync-copy`;

    copy.variants.forEach((variant) => {
        variant.price = variant.price * priceMultiplier;
    });

    // Duplicate the product in Shopify

    const copyProduct = new shopify.api.rest.Product({ session: session });

    copyProduct.body_html = copy.body_html;
    copyProduct.handle = copy.handle;
    copyProduct.product_type = copy.product_type || copy.productType; // why is this inconsistent?
    copyProduct.published_scope = copy.published_scope;
    copyProduct.status = copy.status.toLowerCase();
    copyProduct.tags = copy.tags;
    copyProduct.template_suffix = copy.template_suffix;
    copyProduct.title = copy.title + " (ProductSync Copy)";
    copyProduct.vendor = copy.vendor;

    // Variants

    if (copy.options.length > 1 || (copy.options.length === 1 && copy.options[0].name !== "Title")) {
        copyProduct.options = copy.options.map((options) => ({
            name: options.name,
            values: options.values,
        }));

        copyProduct.variants = copy.variants.map((variant) => ({
            option1: (variant.selectedOptions?.length > 0 ? variant.selectedOptions[0].value : variant.option1),
            option2: (variant.selectedOptions?.length > 1 ? variant.selectedOptions[1].value : variant.option2),
            option3: (variant.selectedOptions?.length > 2 ? variant.selectedOptions[2].value : variant.option3),

            price: variant.price * priceMultiplier,

            inventory_quantity: variant.inventoryQuantity,
            inventory_management: variant.inventory_management || "shopify",
            inventory_policy: variant.inventory_policy,
            inventory_item_id: parseInt(variant.inventoryItem.id.split("/").pop(), 10) || undefined,
            sku: variant.sku,
        }));
    }

    await copyProduct.save({ update: true });

    // Add the images

    const images = await shopify.api.rest.Image.all({
        session: session,
        product_id: product.id,
    });

    images.data.forEach(async (image) => {
        const copyImage = new shopify.api.rest.Image({ session: session });

        copyImage.position = image.position;
        copyImage.product_id = copyProduct.id;
        copyImage.variant_ids = image.variant_ids; // Does this cause problems?
        copyImage.src = image.src;
        if (!!image.alt) copyImage.alt = image.alt;
        copyImage.width = image.width;
        copyImage.height = image.height;

        await copyImage.save({ update: true });
    });

    // Add it to any custom collections

    // First get the collections that contain the first product

    const relationships = await shopify.api.rest.Collect.all({ session: session });
    const collectionsToUpdate = relationships.data.map((collect) => ({
                                                    product_id: collect.product_id,
                                                    collection_id: collect.collection_id
                                                }))
                                                .filter((collect) => collect.product_id === product.id)
                                                .map((collect) => collect.collection_id);

    // Then add the duplicate product to those collections

    collectionsToUpdate.forEach(async (collection_id) => {
        const collect = new shopify.api.rest.Collect({ session: session });
        collect.product_id = copyProduct.id;
        collect.collection_id = collection_id;
        await collect.save({ update: true });
    });

    // Insert the record in the database

    await InsertDocument({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        data: {
            productId: product.id,
            copyId: copyProduct.id,
            priceMultiplier: priceMultiplier,
            cachedProductData: product,
        }
    });

    return output;
}