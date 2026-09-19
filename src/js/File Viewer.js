const viewer = document.getElementById("viewer");
const fileId = new URLSearchParams(window.location.search).get("fileId");


document.addEventListener("DOMContentLoaded", () => {
    if(fileId === null) {
        ErrorCloseViewer("Could not load file");
    }

    LoadFile(fileId);
});

async function LoadFile(fileId) {
    const params = new URLSearchParams();
    params.append("id", fileId);

    const metaPromise = fetch(`/api/files/simple?${params}`);
    const blobPromise = fetch(`/api/files/${fileId}/content`, {method: "GET"});

    const [metaResponse, blobResponse] = await Promise.all([
        metaPromise,
        blobPromise
    ]);

    if (!metaResponse.ok || !blobResponse.ok) {
        throw new Error(`Failed to load file with id: ${fileId}`);
    }

    const [meta, blob] = await Promise.all([
        metaResponse.json(),
        blobResponse.blob()
    ]);

    const objectUrl = URL.createObjectURL(blob);
    document.title = `Permco File Viewer - ${meta.files[0].name}`
    RenderFile(meta.files[0], objectUrl);
}

function RenderFile(meta, objectUrl) {
    const type = meta.type;

    let element;

    if(type === "Pdf") {
        window.location.href = `/api/files/${encodeURIComponent(fileId)}/content`
        return;
    } else if(type === "Image") {
        element = document.createElement("img");
        element.src = objectUrl;
        element.alt = meta.name;
    } else if (mimeType.startsWith("video/")) {
        element = document.createElement("video");
        element.src = objectUrl;
        element.controls = true;
    }else {
        ErrorCloseViewer("This file type cannot be previewed.");
    }

    viewer.replaceChildren(element);
}

function ErrorCloseViewer(message = "An error occured") {
    alert(message);

    window.close();

    // Fallback if the browser didn't close the tab.
    setTimeout(() => {
        if (!window.closed) {
            window.location.replace("/SalesApp");
        }
    }, 100);
}