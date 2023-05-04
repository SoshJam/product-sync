import { useState, useCallback } from "react"; 
import {
    Layout,
    Card,
    Text,
    Button,
    Thumbnail,
    HorizontalStack,
    VerticalStack,
    PageActions,
} from "@shopify/polaris";
import {
    ContextualSaveBar,
    ResourcePicker,
    useNavigate
} from "@shopify/app-bridge-react";
import { ImageMajor } from "@shopify/polaris-icons";

export function SyncForm() {
    const navigate = useNavigate();

    const [ pickerOpen, setPickerOpen ] = useState(false);
    const togglePicker = useCallback(() => setPickerOpen(!pickerOpen), [pickerOpen]);

    const [ selectedProduct, setSelectedProduct ] = useState(null);

    /* 
        When a product is selected from the resource picker:
        - Set the selected product in state to be the first (and only) product in the selection.
        - Update the form state using the onChange function from the useField hook.
        - Close the resource picker.
    */
    const handleSelection = useCallback(({ selection }) => {
        const [ product ] = selection;
        setSelectedProduct(product);

        togglePicker();
    }, []);

    /*
        TODO: Make this work.

        When the submit button is pressed:
        - Duplicate the product and tag it.
        - Copy the product's ID and information, and store it in the database.
        - Return to the home page.
    */
    function handleSubmit() {
        console.log(selectedProduct);
        navigate("/");
    };

    /*
        These variables are used to display product images, and will be populated when image URLs can be retrieved from the Admin.
    */
    const imageSrc = selectedProduct?.images?.edges?.[0]?.node?.url;
    const originalImageSrc = selectedProduct?.images?.[0]?.originalSrc;
    const altText = selectedProduct?.images?.[0]?.altText || selectedProduct?.title;

    return (
        <>
        <Layout sectioned>
                <Card
                    sectioned
                    title="Product"
                    actions={selectedProduct && [
                        {
                            content: "Change Product",
                            onAction: togglePicker,
                        }
                    ]}
                >
                    <ResourcePicker
                        resourceType="Product"
                        open={pickerOpen}
                        selectMultiple={false}
                        showVariants={false}

                        onSelection={handleSelection}
                        onCancel={togglePicker}
                    />
                    { selectedProduct ? (
                        <HorizontalStack sectioned gap="5">
                            {imageSrc || originalImageSrc ? (
                                <Thumbnail
                                    source={imageSrc || originalImageSrc}
                                    alt={altText}
                                />
                            ) : (
                                <Thumbnail
                                    source={ImageMajor}
                                    color="base"
                                    size="small"
                                />
                            )}
                            <VerticalStack sectioned gap="2">
                                <Text as="p" fontWeight="bold">{selectedProduct.title}</Text>
                                {/* TODO: Format money depending on merchant preferences. */}
                                {
                                    selectedProduct.variants[0]?.price ? (
                                        <Text as="p">
                                            Price: ${selectedProduct.variants[0].price} &bull; Inventory: {selectedProduct.totalInventory}
                                        </Text>
                                    ) : (
                                        <Text as="p">
                                            Inventory: {selectedProduct.totalInventory}
                                        </Text>
                                    )
                                }
                            </VerticalStack>
                        </HorizontalStack>
                            
                    ) : (
                        <Button primary onClick={togglePicker}>Select Product</Button>
                    )}
                </Card>
            </Layout>
            <PageActions
                primaryAction={{
                    content: "Duplicate and Sync",
                    onAction: handleSubmit,
                    disabled: !selectedProduct,
                }}
                secondaryActions={[{
                    content: "Cancel",
                    onAction: () => navigate("/"),
                }]}
            />
        </>
    );
};