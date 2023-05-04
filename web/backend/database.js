require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

function createClient() {
    const connectionUri = process.env.CONNECTION_STRING;
    const clientOptions = {
        useNewUrlParser: true,
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    };
    return new MongoClient(connectionUri, clientOptions);
};

async function InsertDocument( { databaseName, collectionName, data } ) {

    data.lastModified = new Date();

    const client = createClient();
    try {
        await client.connect();

        const database = client.db(databaseName);
        const collection = database.collection(collectionName);

        const result = await collection.insertOne(data);
        return result;
    }
    
    catch (error) {
        console.log(error);
    }
    
    finally {
        await client.close();
    }
}

async function SearchDatabase( { databaseName, collectionName, query } ) {
    const client = createClient();
    try {
        await client.connect();

        const database = client.db(databaseName);
        const collection = database.collection(collectionName);

        const results = [];
        const cursor = await collection.find(query);
        for await (const doc of cursor) {
            results.push(doc);
        }
        return results;
    }
    
    catch (error) {
        console.log(error);
    }
    
    finally {
        await client.close();
    }
}

async function UpdateDocument( { databaseName, collectionName, query, data } ) {
        
    const command = {
        $set: data,
        $currentDate: { lastModified: true },
    }

    const client = createClient();
    try {
        await client.connect();

        const database = client.db(databaseName);
        const collection = database.collection(collectionName);

        const result = await collection.updateOne(query, command);
        return result;
    }

    catch (error) {
        console.log(error);
    }

    finally {
        await client.close();
    }
}

async function DeleteDocument( { databaseName, collectionName, query } ) {
    const client = createClient();
    try {
        await client.connect();

        const database = client.db(databaseName);
        const collection = database.collection(collectionName);

        const result = await collection.deleteOne(query);
        return result;
    }

    catch (error) {
        console.log(error);
    }

    finally {
        await client.close();
    }
}

module.exports = {
    InsertDocument,
    SearchDatabase,
    UpdateDocument,
    DeleteDocument,
}