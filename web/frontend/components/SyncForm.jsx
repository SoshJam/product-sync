import { useState, useCallback } from "react"; 
import {
    Layout,
    LegacyCard,
    Text,
    Button,
    Thumbnail,
    HorizontalStack,
    VerticalStack,
    PageActions,
    Modal,
} from "@shopify/polaris";
import {
    ContextualSaveBar,
    ResourcePicker,
    useNavigate
} from "@shopify/app-bridge-react";
import { ImageMajor } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../hooks";

export function SyncForm() {
    const navigate = useNavigate();
    const fetch = useAuthenticatedFetch();

    const [ pickerOpen, setPickerOpen ] = useState(false);

    const [ loading, setLoading ] = useState(false);

    const [ selectedProducts, setSelectedProducts ] = useState([]);

    /* 
        When a product is selected from the resource picker:
        - Set the selected product in state to be the first (and only) product in the selection.
        - Update the form state using the onChange function from the useField hook.
        - Close the resource picker.
    */
    const handleSelection = useCallback(({ selection }) => {
        setSelectedProducts(selection);

        setPickerOpen(false);
    }, []);

    /*
        TODO: Make this work.

        When the submit button is pressed:
        - Duplicate the product and tag it.
        - Copy the product's ID and information, and store it in the database.
        - Return to the home page.
    */
    function handleSubmit() {
        setLoading(true);

        fetch("/api/database/insert", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                products: selectedProducts,
            }), 
        })
            .then((response) => response.json())
            .then((json) => {
                console.log(json);
                setLoading(false);
                navigate("/");
            });
    };
    
    return (
        <>
        <Layout sectioned>
                <LegacyCard
                    sectioned
                    title="Product"
                    actions={selectedProducts.length && [
                        {
                            content: "Change Product",
                            onAction: () => setPickerOpen(true),
                        }
                    ]}
                >
                    <ResourcePicker
                        resourceType="Product"
                        open={pickerOpen}
                        selectMultiple={true}
                        showVariants={false}

                        onSelection={handleSelection}
                        onCancel={() => setPickerOpen(false)}
                    />
                    { selectedProducts.length ? (
                        <VerticalStack sectioned gap="5">
                            { selectedProducts.slice(0, 5).map((product) => {
                                const imageSrc = product.images?.[0]?.originalSrc;
                                const altText = product.images?.[0]?.altText || product.title;

                                return (
                                    <HorizontalStack sectioned gap="5">
                                        {imageSrc ? (
                                            <Thumbnail
                                                source={imageSrc}
                                                alt={altText}
                                                size="medium"
                                            />
                                        ) : (
                                            <Thumbnail
                                                source={ImageMajor}
                                                color="base"
                                                size="medium"
                                            />
                                        )}
                                        <VerticalStack sectioned gap="2">
                                            <Text as="p" fontWeight="bold">{product.title}</Text>
                                            {/* TODO: Format money depending on merchant preferences. */}
                                            {
                                                product.variants[0]?.price ? (
                                                    <Text as="p">
                                                        Price: ${product.variants[0].price} &bull; Inventory: {product.totalInventory}
                                                    </Text>
                                                ) : (
                                                    <Text as="p">
                                                        Inventory: {product.totalInventory}
                                                    </Text>
                                                )
                                            }
                                        </VerticalStack>
                                    </HorizontalStack>
                                );
                            }) }
                            { selectedProducts.length > 5 && <Text>+ {selectedProducts.length - 5} more...</Text>}
                        </VerticalStack>
                    ) : (
                        <Button primary onClick={() => setPickerOpen(true)}>Select Product</Button>
                    )}
                </LegacyCard>
            </Layout>
            <PageActions
                primaryAction={{
                    content: "Duplicate and Sync",
                    onAction: handleSubmit,
                    disabled: selectedProducts.length === 0,
                    loading: loading,
                }}
                secondaryActions={[{
                    content: "Cancel",
                    onAction: () => navigate("/"),
                    disabled: loading,
                }]}
            />
            <Modal
                open={loading}
                onClose={null}
                title="Syncing Products"
                primaryAction={{
                    content: "Close",
                    onAction: null,
                    loading: loading,
                }}
                sectioned
            >
                <Text as="p">Syncing {selectedProducts.length} products. This may take a while...</Text>
            </Modal>
        </>
    );
};