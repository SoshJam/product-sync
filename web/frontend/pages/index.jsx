import { useNavigate } from "@shopify/app-bridge-react";
import { useState, useEffect } from "react";
import { useAuthenticatedFetch } from "@shopify/app-bridge-react";

import {
    LegacyCard,
    Page,
    Layout,
    Text,
    Loading,
    SkeletonBodyText,
    EmptyState
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { notFoundImage, trophyImage } from "../assets";

import { SyncedProductsList } from "../components";

export default function HomePage() {
    const navigate = useNavigate();
    const fetch = useAuthenticatedFetch();
    const [ loading, setLoading ] = useState(true);
    const [ products, setProducts ] = useState([]);

    // Retrieve and display synced products
    useEffect(() => {
        fetch("/api/database/get")
            .then((response) => response.json())
            .then((json) => json.result.map((product) => ({
                image: product.cachedProductData.images[0],
                title: product.cachedProductData.title,
                id: product.productId,
                copyId: product.copyId,
                inventory: product.cachedProductData.totalInventory,
                updated: Date.parse(product.lastModified),
            })))
            .then((products) => {
                setLoading(false);
                setProducts(products);
            });
    }, []);

    // Page contents
    const loadingMarkup = loading &&
        <LegacyCard sectioned>
            <SkeletonBodyText />
        </LegacyCard>;

    const emptyMarkup = !loading && !products?.length &&
        <LegacyCard sectioned>
            <EmptyState
                heading="No synced products"
                action={{
                    content: "Duplicate and Sync Product", 
                    onAction: () => navigate("/sync"),
                }}
                image={notFoundImage}
            >
                <p>Click the button to start syncing data between products.</p>
            </EmptyState>
        </LegacyCard>;

    const tableMarkup = !loading && products?.length ? 
        <SyncedProductsList 
            products={products}
            loading={loading}
        /> : null;

    return (
        <Page fullWidth={!!tableMarkup}>
            <TitleBar
                title="Product Sync"
                primaryAction={{
                    content: "Duplicate and Sync Product",
                    onAction: () => navigate("/sync"),
                }}
            />
                <Layout sectioned>
                    {loadingMarkup}
                    {emptyMarkup}
                    {tableMarkup}
                </Layout>
        </Page>
    );
}