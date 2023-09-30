const convertWeightUnit = (weightUnit) => {
    switch (weightUnit) {
        case "pounds":
            return "lb";
        case "kilograms":
            return "kg";
        case "grams":
            return "g";
        case "ounces":
            return "oz";
        default:
            return weightUnit;
    }
};

/**
 * Given a product, return a normalized version of it according to the schema
 * that is outlined in the Shopify API documentation.
 * 
 * https://shopify.dev/docs/api/admin-rest/2023-07/resources/product#resource-object
 * 
 * @param product The product data that will be normalized
 * @returns       The normalized product data
 */
export function normalizeProduct( product ) {
    const normalized = {};

    // Go through line by line for the top-level properties

    normalized.body_html = product.body_html || product.descrptionHtml || product.bodyHtml;
    normalized.handle = product.handle;
    normalized.id = product.id ? (typeof(product.id) == "number" ? product.id : parseInt(product.id.split("/").pop(), 10)) : undefined;
    normalized.product_type = product.product_type || product.productType || '';
    normalized.published_scope = product.published_scope || product.publishedScope || "web";
    normalized.status = product.status.toLowerCase();
    normalized.template_suffix = product.template_suffix || product.templateSuffix || '';
    normalized.title = product.title;
    normalized.vendor = product.vendor;

    // normalized.images = product.images.map((image) => ({
    //     id: image.id ? (typeof(image.id) == "number" ? image.id : parseInt(image.id.split("/").pop(), 10)) : undefined,
    //     product_id: image.product_id,
    //     position: image.position,
    //     created_at: image.created_at,
    //     updated_at: image.updated_at,
    //     width: image.width,
    //     height: image.height,
    //     src: image.src,
    //     variant_ids: image.variant_ids,
    // }));

    normalized.options = product.options.map((option) => ({
        id: option.id ? (typeof(option.id) == "number" ? option.id : parseInt(option.id.split("/").pop(), 10)) : undefined,
        name: option.name,
        position: option.position,
        values: option.values,
    }));
    
    normalized.tags = typeof(product.tags) == "string" ? product.tags : product.tags.join(", ");

    normalized.variants = product.variants.map((variant) => ({
        barcode: variant.barcode,
        compare_at_price: variant.compare_at_price || variant.compareAtPrice,
        fulfillment_service: variant.fulfillment_service || variant.fulfillmentService.type.toLowerCase(),
        grams: variant.grams,
        weight: variant.weight,
        weight_unit: convertWeightUnit((variant.weight_unit || variant.weightUnit).toLowerCase()),
        id: variant.id ? (typeof(variant.id) == "number" ? variant.id : parseInt(variant.id.split("/").pop(), 10)) : undefined,
        inventory_item_id: variant.inventory_item_id || (variant.inventoryItem?.id ? parseInt(variant.inventoryItem.id.split("/").pop(), 10) : undefined) || undefined,
        inventory_management: (variant.inventory_management || variant.inventoryManagement).toLowerCase(),
        inventory_policy: (variant.inventory_policy || variant.inventoryPolicy).toLowerCase(),
        inventory_quantity: variant.inventory_quantity || variant.inventoryQuantity,
        option1: variant.option1 || variant.selectedOptions?.[0]?.value,
        option2: variant.option2 || variant.selectedOptions?.[1]?.value,
        option3: variant.option3 || variant.selectedOptions?.[2]?.value,
        position: variant.position,
        price: typeof(variant.price) == "number" ? variant.price : parseFloat(variant.price),
        product_id: variant.product_id ? (typeof(variant.product_id) == "number" ? variant.product_id : parseInt(variant.product_id.split("/").pop(), 10)) : undefined,
        requires_shipping: variant.requires_shipping || variant.requiresShipping,
        sku: variant.sku,
        taxable: variant.taxable,
        title: variant.title,
    }));

    return normalized;
}