import { useNavigate } from "@shopify/app-bridge-react";
import { useState, useEffect, useCallback } from "react";
import { useAuthenticatedFetch } from "../hooks";

import {
    LegacyCard,
    Page,
    Layout,
    Loading,
    SkeletonBodyText,
    EmptyState,
    Toast,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { notFoundImage } from "../assets";

import { SyncedProductsList } from "../components";

export default function HomePage() {
    const navigate = useNavigate();
    const fetch = useAuthenticatedFetch();
    const [ refreshing, setRefreshing ] = useState(false);
    const [ deleting, setDeleting ] = useState(false);
    const [ products, setProducts ] = useState([]);
    const loading = refreshing || deleting;

    const emptyToastProps = { content: null };
    const [ toastProps, setToastProps ] = useState(emptyToastProps);

    useEffect(() => {
        refreshProducts();
    }, []);

    // Fetch products from database
    const refreshProducts = useCallback(() => {
        setRefreshing(true);
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
                setRefreshing(false);
                setProducts(products);
            });
    }, [refreshing]);

    // Stop syncing a product
    const stopSync = useCallback((id) => {
        setDeleting(true);
        fetch(`/api/database/delete/${id}`, { method: "DELETE" })
            .then((response) => {
                setToastProps({ content: "Stopped syncing product." })
                refreshProducts();
                setDeleting(false);
            });
    }, [deleting]);

    // Page contents
    const loadingMarkup = loading &&
        <LegacyCard sectioned>
            <Loading />
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
            stopSync={stopSync}
        /> : null;

    const toastMarkup = toastProps.content && !loading && (
        <Toast {...toastProps} onDismiss={() => setToastProps(emptyToastProps)} />
    );

    return (
        <Page fullWidth={!!tableMarkup}>
            <TitleBar
                title="Product Sync"
                primaryAction={{
                    content: "Duplicate and Sync Product",
                    onAction: () => navigate("/sync"),
                }}
                secondaryActions={[
                    {
                        content: "Refresh",
                        onAction: refreshProducts,
                        loading: loading,
                    }
                ]}
            />
                <Layout sectioned>
                    {toastMarkup}
                    {loadingMarkup}
                    {emptyMarkup}
                    {tableMarkup}
                </Layout>
        </Page>
    );
}