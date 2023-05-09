import { useState, useEffect } from "react";
import { useAuthenticatedFetch } from "../hooks";

import {
    Card,
    Button,
    IndexTable,
    Thumbnail,
    Link,
    UnstyledLink,
} from "@shopify/polaris";
import {
    CancelMajor,
    ImageMajor
} from '@shopify/polaris-icons';

import dayjs from "dayjs";

export function SyncedProductsList({ products, loading, stopSync }) {
    const [ shopUrl, setShopUrl ] = useState("");
    const fetch = useAuthenticatedFetch();

    useEffect(() => {
        fetch("/api/shop")
            .then((response) => response.json())
            .then((json) => setShopUrl(json.shop.split(".")[0]));
    }, []);

    const productUrl = (id) => `https://admin.shopify.com/store/${shopUrl}/products/${id}`;

    const rowMarkup = products.map(
        ({ image, title, id, copyId, inventory, updated }, index) => 
        <IndexTable.Row
            id={id}
            key={id}
            position={index}
        >
            <IndexTable.Cell>
                <Thumbnail source={image?.originalSrc || ImageMajor} alt={image?.altText || title} size="small" />
            </IndexTable.Cell>

            <IndexTable.Cell>
                <UnstyledLink url={productUrl(id)}>
                    {title}
                </UnstyledLink>
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Link url={productUrl(id)} monochrome>
                    {id}
                </Link>
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Link url={productUrl(copyId)} monochrome>
                    {copyId}
                </Link>
            </IndexTable.Cell>

            <IndexTable.Cell>
                {inventory}
            </IndexTable.Cell>

            <IndexTable.Cell>
                {dayjs(updated).format("MMMM D, YYYY")}
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Button icon={CancelMajor} outline onClick={() => stopSync(id)} />
            </IndexTable.Cell>
        </IndexTable.Row>
    );

    return (
        <Card>
            <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={products.length}
                headings={[
                    { title: "Thumbnail", hidden: true },
                    { title: "Title" },
                    { title: "Original" },
                    { title: "Copy" },
                    { title: "Inventory" },
                    { title: "Last Updated" },
                    { title: "Delete", hidden: true }
                ]}
                selectable={false}
                loading={loading}
            >
                {rowMarkup}
            </IndexTable>
        </Card>
    );
}

/* A function to truncate long strings */
function truncate(str, n) {
    return str.length > n ? str.substr(0, n - 1) + "…" : str;
  }