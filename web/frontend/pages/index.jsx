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

    // Temporary until we start reading the actual products.
    const exampleProducts = [
        {
            image: trophyImage,
            title: "Product 1",
            id: 1,
            copyTitle: "Product 1 Copy with a really really long title.",
            copyId: 2,
            inventory: 10,
            updated: new Date(),
        },
        {
            image: trophyImage,
            title: "Product 2 with a really really long title.",
            id: 3,
            copyTitle: "Product 2 Copy",
            copyId: 4,
            inventory: 15,
            updated: new Date(),
        }
    ];
    //const exampleProducts = [];
    
    /*
    // Get product data
    async function getShopUrl() {
        const response = await fetch("/api/shopurl");
        const json = await response.json();
        return json.shopUrl.split(".")[0];
    }

    
    useEffect(() => {
        fetch("api/shopurl")
            .then((response) => response.json())
            .then((json) => json.shopUrl.split(".")[0])
            .then((shopUrl) => SearchDatabase( {
                databaseName: "ProductSync",
                collectionName: shopUrl,
                query: { },
            }))
            .then((results) => console.log(results));
    }, []);
    */

    // Page contents
    const loadingMarkup = loading &&
        <LegacyCard sectioned>
            <SkeletonBodyText />
        </LegacyCard>;

    const emptyMarkup = !loading && !exampleProducts?.length &&
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

    const tableMarkup = !loading && exampleProducts?.length ? 
        <SyncedProductsList 
            products={exampleProducts}
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