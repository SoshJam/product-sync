import { useNavigate } from "@shopify/app-bridge-react";

import {
    Card,
    Icon,
    IndexTable,
    Stack,
    TextStyle,
    Thumbnail,
    Link
} from "@shopify/polaris";
import {
    CancelMajor
} from '@shopify/polaris-icons';

import dayjs from "dayjs";

export function SyncedProductsList({ products, loading }) {
    const navigate = useNavigate();

    const rowMarkup = products.map(
        ({ image, title, id, copyTitle, copyId, inventory, updated }, index) => 
        <IndexTable.Row
            id={id}
            key={id}
            position={index}
        >
            <IndexTable.Cell>
                <Thumbnail source={image} alt={title} size="small" />
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Link url={`/products/${id}`} monochrome>
                    {truncate(title, 25)}
                </Link>
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Link url={`/products/${copyId}`} monochrome>
                    {truncate(copyTitle, 25)}
                </Link>
            </IndexTable.Cell>

            <IndexTable.Cell>
                {inventory}
            </IndexTable.Cell>

            <IndexTable.Cell>
                {dayjs(updated).format("MMMM D, YYYY")}
            </IndexTable.Cell>

            <IndexTable.Cell>
                <Icon
                    source={CancelMajor}
                    color="base"
                />
            </IndexTable.Cell>
        </IndexTable.Row>
    )

    return (
        <Card>
            <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={products.length}
                headings={[
                    { title: "Thumbnail", hidden: true },
                    { title: "Product" },
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