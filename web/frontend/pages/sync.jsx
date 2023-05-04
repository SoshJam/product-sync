import { useNavigate } from "@shopify/app-bridge-react";

import {
    Page,
    Layout,
    Card
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";
import { SyncForm } from "../components";

export default function SyncPage() {
    const navigate = useNavigate();
    const breadcrumbs = [{ content: "Product Sync", url: "/" }];

    return (
        <Page narrowWidth>
            <TitleBar
                title="Duplicate and Sync Product"
                breadcrumbs={breadcrumbs}
                primaryAction={null}
            />
            <SyncForm />
        </Page>
    );
}