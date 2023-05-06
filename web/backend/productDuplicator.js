import { InsertDocument, SearchDatabase } from "./database.js";
import shopify from "../shopify.js";

const DUPLICATE_PRODUCT_QUERY = `
    mutation duplicateProduct($id: ID!, $title: String!) {
        productDuplicate(productId: $id, newTitle: $title, includeImages: true) {
            newProduct {
                id
            }
        }
    }
`;

export async function productDuplicator(product, session) {

    const priceMultiplier = 0.5;
    const gqlClient = new shopify.api.clients.Graphql({ session });
    
    var output = { 
        handle: product.handle,
        notes: []
    };
    
    // The product id comes as a string so we need to convert it to the
    // integer found after the last slash in the string

    const productIdString = product.id;
    product.id = parseInt(product.id.split("/").pop(), 10);

    // See if it's already syncing

    const searchResult = await SearchDatabase({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        query: { productId: product.id }
    });
    
    if (searchResult.length > 0)
    throw new Error("This product is already syncing.");

    // Duplicate the product in Shopify

    const duplicateProductResponse = await gqlClient.query({
        data: {
            query: DUPLICATE_PRODUCT_QUERY,
            variables: {
                id: productIdString,
                title: product.title + " (ProductSync Copy)",
            },
        },
    });

    const copyIdString = duplicateProductResponse.body.data.productDuplicate.newProduct.id;
    const copyId = parseInt(copyIdString.split("/").pop(), 10);

    // Update the prices of variants

    const oldDuplicate = await shopify.api.rest.Product.find({ session: session, id: copyId });
    const updatedDuplicate = new shopify.api.rest.Product({ session: session });

    updatedDuplicate.id = copyId;
    updatedDuplicate.variants = oldDuplicate.variants.map((variant) => {
        variant.price = variant.price * priceMultiplier;
        return variant;
    });

    await updatedDuplicate.save();

    // Insert the record in the database

    await InsertDocument({
        databaseName: "ProductSync",
        collectionName: session.shop.split(".")[0],
        data: {
            productId: product.id,
            copyId: copyId,
            priceMultiplier: priceMultiplier,
            cachedProductData: product,
        }
    });

    return output;
}