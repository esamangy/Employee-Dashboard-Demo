import { CalculateTooltipPosition } from "../Modules/Tooltip Mover.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs?raw";

const workerBlob = new Blob(
    [pdfWorkerSource],
    { type: "text/javascript" }
);

const workerUrl = URL.createObjectURL(workerBlob);

const pdfWorker = new Worker(workerUrl, {
    type: "module"
});

pdfWorker.addEventListener("error", event => {
    console.error("PDF worker error:", event);
});

pdfWorker.addEventListener("messageerror", event => {
    console.error("PDF worker message error:", event);
});

pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorker;

export async function RenderReport(reportId, sideMenuId, reportContainerId, fileSectionId) {
    const reportData = await FetchReportData(reportId);

    if(reportContainerId) {
        RenderReportContents(reportData, reportContainerId);
    }

    if(fileSectionId) {
        await RenderFileSection(reportData, fileSectionId);
    }

    if(sideMenuId) {
        RenderSideMenu(reportData, sideMenuId);
    }

    return reportData;
}

async function FetchReportData(reportId) {
    const response = await fetch(`/SalesApp/ReportOverview/data/${reportId}`);
    const data = await response.json();

    if(!response.ok) {
        throw new Error(`Failed to fetch report data: ${response.status} ${response.statusText}`);
    }

    return data;
}

// #region Side Menu

function RenderSideMenu(reportData, sideMenuId) {
    const sideMenu = document.getElementById(sideMenuId);

    const sections = document.querySelectorAll(".report-overview-section");
    sections.forEach(section => {
        if(section.childElementCount <= 0) {
            return;
        }

        const anchor = document.createElement("a");
        anchor.href = `#${section.id}`;
        anchor.classList.add("side-menu-option", "rounded");
        anchor.textContent = NiceifyString(section.id);
        sideMenu.appendChild(anchor);
    });
}

// #endregion
// #region Report Contents

function RenderReportContents(reportData, reportContainerId) {
    const container = document.getElementById(reportContainerId);

    for (const [key, section] of Object.entries(reportData.report)) {
        const sectionElement = document.createElement("section");

        sectionElement.classList.add("report-overview-section");
        sectionElement.id = RemoveInputPrefix(key);

        const label = document.createElement("h3");
        label.textContent = NiceifyString(key);
        sectionElement.appendChild(label);

        const dataContainer = document.createElement("div");
        dataContainer.classList.add("report-overview-section-container");
        
        let hasData = false;
        for (const [subkey, value] of Object.entries(section)) {
            if ((IsAnInput(subkey) && !IsEmptyString(GetInputValue(value, subkey))) || (!IsAnInput(subkey) && !IsEmptyString(value))) {
                const elementLabel = document.createElement("label");
                elementLabel.classList.add("report-overview-section-element");
                elementLabel.id = RemoveInputPrefix(subkey);
                elementLabel.dataset.key = RemoveInputPrefix(subkey);

                const span = document.createElement("span");
                span.classList.add("semi-bold");
                span.textContent = `${NiceifyString(RemoveInputPrefix(subkey))}:`;
                elementLabel.appendChild(span);

                if (!IsAnInput(subkey)) {
                    elementLabel.appendChild(document.createTextNode(value));
                } else {
                    const inputValueSpan = document.createElement("span");
                    inputValueSpan.classList.add("no-white-space-suppression");
                    inputValueSpan.textContent = GetInputValue(value, subkey);
                    elementLabel.appendChild(inputValueSpan);
                }

                dataContainer.appendChild(elementLabel);
                hasData = true;
            }
        }

        if (hasData) {
            sectionElement.appendChild(dataContainer);
            container.appendChild(sectionElement);
        }
    }
}

// #endregion
// #region File Section

async function RenderFileSection(reportData, fileSectionId) {
    let fileIds = reportData.meta["connectedFileIds"];
    
    const fileSection = document.getElementById(fileSectionId);
    fileSection.innerHTML = ""; // clear previous content

    if(!fileIds || fileIds.length <= 0) {
        fileSection.style.display = "none";
        return;
    }

    fileSection.style.display = "flex";

    const filesHeader = document.createElement("h3");
    filesHeader.textContent = "Additional Files";
    fileSection.appendChild(filesHeader);

    const results = await Promise.allSettled(
        fileIds.map(id => LoadFile(id, fileSectionId))
    );

    for (const result of results) {
        if (result.status === "rejected") {
            console.error(result.reason);
        }
    }
}

async function LoadFile(fileId, fileSectionId) {
    const params = new URLSearchParams();
    params.append("id", fileId);

    const metaResponse = await fetch(`/api/files/simple?${params}`);

    if (!metaResponse.ok) {
        throw new Error(`Failed to load file with id: ${fileId}`);
    }

    const meta = await metaResponse.json();

    RenderFile(meta.files[0], fileSectionId);
}

async function RenderFile(meta, fileSectionId) {
    const fileList = document.getElementById(fileSectionId);
    const row = document.createElement("div");
    row.classList.add("file-overview-card", "horizontal-container");
    row.dataset.fileId = meta.id;

    if(meta.type === "Image") {
        const container = document.createElement("div");
        container.classList.add("img-overlay-container");
        container.style.flexShrink = "0";
        const img = document.createElement("img");

        const blobResponse = await fetch(`/api/files/${meta.id}/content`);
        const blob = await blobResponse.blob();

        img.src = URL.createObjectURL(blob);
        img.style.height = "100%";
        img.style.aspectRatio = "1 / 1";
        

        let overlayTemplate = document.getElementById("fileOverlayTemplate");
        
        container.append(img);
        container.append(overlayTemplate.content.firstElementChild.cloneNode(true));
        row.append(container);
    } else if (meta.type === "Pdf") {
        const container = document.createElement("div");
        container.classList.add("img-overlay-container");
        container.style.flexShrink = "0";

        const blobResponse = await fetch(`/api/files/${meta.id}/content`, {
            headers: {
                "Content-Type": "application/pdf"
            },
        });
        const blob = await blobResponse.blob();

        let url = URL.createObjectURL(blob);
        RenderPdfPreview(container, url);
        
        row.append(container);
    } else {
        const thumb = document.createElement("div");
        thumb.textContent = "This file type has not been implemented yet. Please contact Me to add support";
        thumb.style.marginRight = "16px";
        row.append(thumb);
    }

    const textContainer = document.createElement("div");
    textContainer.classList.add("file-info-container");

    const fileName = document.createElement("p");
    fileName.textContent = meta.name;
    fileName.style.overflowWrap = "anywhere";
    const fileSize = document.createElement("p");
    fileSize.classList.add("file-size");
    fileSize.textContent = meta.size

    textContainer.append(fileName);
    textContainer.append(fileSize);

    row.append(textContainer);

    const downloadBtn = document.createElement("btn");
    let downloadTemplate = document.getElementById("downloadTemplate");
    downloadBtn.append(downloadTemplate.content.firstElementChild.cloneNode(true));
    
    row.append(downloadBtn);
    const tooltip = downloadBtn.querySelector(".tooltip");
    requestAnimationFrame(() => CalculateTooltipPosition(tooltip));

    fileList.append(row);
}

// #endregion
// #region Helper

function IsAnInput(value) {
    /*
    c_ = group of checkboxes
    a_ = this is an array of values
    l_ = the values of this is an array of values that should be linked together
    s_ = the value for this is actual a subvalue
    */
    if(typeof value !== "string") {
        return false;
    }

    if(value.startsWith("c_") || value.startsWith("a_") || value.startsWith("l_") || value.startsWith("s_")) {
        return true;
    }
    return false
}

function NiceifyString(value) {
    RemoveInputPrefix(value);
    return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function IsEmptyString(value) {
    return value === null || value === undefined || value === "";
}

export function RemoveInputPrefix(value) {
    if(IsAnInput(value)) {
        return value.substring(2);
    }
    return value;
}

function GetInputValue(data, key){
    if(key.startsWith("c_")) {
        let finalString = "";
        for (const [subkey, value] of Object.entries(data)) {
            if(IsAnInput(subkey)) {
                finalString += GetInputValue(value, subkey) + ", ";
            } else {
                if(value) {
                    finalString += NiceifyString(subkey) + ", ";
                }
            }
        }
        return finalString.slice(0, -2); // remove the last comma and space
    } else if(key.startsWith("a_")) {
        let finalString = "";
        for (const value of Object.values(data)) {
            finalString += value + ", ";
        }
        return finalString.slice(0, -2); // remove the last comma and space
    } else if(key.startsWith("l_")) {
        const itemSeparator = "  |  ";

        let finalString = "\n";
        for (const row of Object.values(data)) {
            for (const value of Object.values(row)) {
                finalString += value + itemSeparator;
            }

            finalString = finalString.slice(0, -itemSeparator.length);
            finalString += "\n";
        }
        return finalString.slice(0, -1);
    } else if(key.startsWith("s_")) {
        return data;
    } else {
        console.log(data);
        return str(data)
    }
}

// #endregion
//#region Pdf Render

async function RenderPdfPreview(container, pdfUrl) {
    container.replaceChildren();
    container.classList.add("pdf-preview");

    const loadingElement = document.createElement("div");
    loadingElement.className = "pdf-preview__status";
    loadingElement.textContent = "Loading preview…";

    container.appendChild(loadingElement);

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: pdfUrl
        });

        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);


        const unscaledViewport = page.getViewport({
            scale: 1
        });

        const availableHeight = container.clientHeight || 300;
        const scale = availableHeight / unscaledViewport.height;

        const viewport = page.getViewport({
            scale
        });

        const canvas = document.createElement("canvas");
        canvas.className = "pdf-preview__canvas";

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Could not create canvas context.");
        }

        // Makes the PDF look sharp on high-DPI screens.
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale === 1
                ? undefined
                : [outputScale, 0, 0, outputScale, 0, 0]
        }).promise;;
        container.replaceChildren(canvas);

        const pageCount = document.createElement("span");
        pageCount.className = "pdf-preview__page-count";
        pageCount.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}`;
        container.appendChild(pageCount);

        let overlayTemplate = document.getElementById("fileOverlayTemplate");
        container.append(overlayTemplate.content.firstElementChild.cloneNode(true));
    } catch (error) {
        console.error("PDF preview failed:", error);

        const errorElement = document.createElement("div");
        errorElement.className = "pdf-preview__status pdf-preview__status--error";
        errorElement.textContent = "Preview unavailable";

        container.replaceChildren(errorElement);
    }
}