import { useNavigate } from "@shopify/app-bridge-react";
import {
    Card,
    AlphaCard,
    Page,
    Layout,
    TextContainer,
    Image,
    Stack,
    Link,
    Text,
    Loading,
    SkeletonBodyText,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { trophyImage } from "../assets";

import { SyncedProductsList } from "../components";

export default function HomePage() {
    const navigate = useNavigate();

    // Temporary until we start reading the actual products.
    const loading = false;
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
            title: "Product 2",
            id: 3,
            copyTitle: "Product 2 Copy with a really really long title.",
            copyId: 4,
            inventory: 15,
            updated: new Date(),
        }
    ]

    const loadingMarkup = loading && <AlphaCard>
        {/* <Loading /> */}
        <SkeletonBodyText />
    </AlphaCard>

    const tableMarkup = !loading && <SyncedProductsList 
        products={exampleProducts}
        loading={loading}
    />;

    return (
        <Page fullWidth={!!tableMarkup}>
            <TitleBar
                title="Product Sync"
                primaryAction={{
                    content: "Duplicate and Sync Product",
                    onAction: () => console.log("clicked"),
                }}
            />
            <Layout>
                <Layout.Section>
                    {loadingMarkup}
                    {tableMarkup}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
