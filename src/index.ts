import { Client, Database, Models } from "node-appwrite";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.APPWRITE_HOSTNAME || !process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY || !process.env.APPWRITE_IS_SELF_SIGNED || !process.env.APPWRITE_COLLECTION_ID) {
    console.error("Please configure our .env fie first");
    process.exit();
}

const client = new Client();
const database = new Database(client);

client
    .setEndpoint(process.env.APPWRITE_HOSTNAME)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY)
    .setSelfSigned(process.env.APPWRITE_IS_SELF_SIGNED === 'yes');

const collectionId = process.env.APPWRITE_COLLECTION_ID;

(async () => {
    console.log("Downloading all documents ...");

    const allDocuments: Models.Document[] = [];
    const cursorMagazine: string[] = [];
    let wasPageEmpty = false;
    let isFirstLoad = true;

    while (!wasPageEmpty) {
        let chunkResponse: Models.DocumentList<Models.Document> | null = null;

        while (isFirstLoad || (chunkResponse === null && cursorMagazine.length > 0)) {
            isFirstLoad = false;

            const lastCursor = cursorMagazine[cursorMagazine.length - 1] || undefined;

            try {
                chunkResponse = await database.listDocuments(collectionId, undefined, 100, undefined, lastCursor, "after");
            } catch (err: any) {
                const isCursorMissingError = err.response.code === 400 && err.response.message === `Document '${lastCursor}' for the 'cursor' value not found.`;

                if (!isCursorMissingError) {
                    throw err;
                }

                cursorMagazine.pop();
            }
        }

        if (!chunkResponse) {
            // There is no change this happens 😅 You would need to delete 100 documents during seconds request, or 200 during third, or 300 during fourth...
            throw new Error("All documents we had so far were removed. We cannot properly continue the loop");
        }

        const chunkDocuments = chunkResponse.documents;
        allDocuments.push(...chunkDocuments);

        const chunkIds = chunkResponse.documents.map((document) => document.$id);
        cursorMagazine.push(...chunkIds);

        wasPageEmpty = chunkDocuments.length <= 0;
    }

    console.log("Downloaded ", allDocuments.length, "documents");
    console.log("You can do whatever you need with the documents");
    console.log("Also please consider after each chunk of documents separatelly to prevent filling up your whole RAM");
    console.log("You could also agregate documents and only store data you need to use as little RAM as possible");
})().catch((err) => {
    console.error(err);
    console.error("Could not get all documents");
    process.exit();
})