// import { Save } from "../Pages/SalesApp/Sales App New Report.js";

const actualFileInput = document.getElementById("filesInput");
const visuals = document.querySelector(".file-input");
const uploadedFilesContainer = document.getElementById("uploadedFiles");

const OnFileDeleted = new Event("OnFileDeleted");

let addedFiles = []

document.addEventListener("DOMContentLoaded", async () => {
    AddListeners();
    UpdateFileListVisuals();
});

function AddListeners() {
    visuals.addEventListener("click", () => {
        actualFileInput.click();
    });

    visuals.addEventListener("dragover", event => {
        event.preventDefault();

        visuals.classList.add("dragging");
    });

    visuals.addEventListener("dragleave", event => {
        visuals.classList.remove("dragging");
    });

    visuals.addEventListener("drop", event => {
        event.preventDefault();
        visuals.classList.remove("dragging");
        const droppedFiles = Array.from(event.dataTransfer.files);
        AddFiles(droppedFiles);
    });

    actualFileInput.addEventListener("change", () => AddFiles(Array.from(actualFileInput.files)));

    uploadedFilesContainer.addEventListener("click", TryRemoveFile);
}

function UpdateFileListVisuals() {
    uploadedFilesContainer.innerHTML = "";
    let deleteTemplate = document.getElementById("deleteIcon");
    let warningTemplate = document.getElementById("warningIcon");
    let checkmarkTemplate = document.getElementById("uploadedIcon");
    

    document.getElementById("uploadedFilesLabel").hidden = addedFiles.length <= 0;

    for(let i = 0; i < addedFiles.length; i ++) {
        const row = document.createElement("div");
        row.classList.add("uploaded-file")
        row.classList.add("horizontal-container")
        const p = document.createElement("p");
        p.textContent = addedFiles[i].file.name;
        row.append(p);
        row.dataset.fileIndex = i;
        const deleteIcon = deleteTemplate.content.firstElementChild.cloneNode(true);
        deleteIcon.id = "delete";
        
        if(addedFiles[i].uploaded) {
            const checkmarkIcon = checkmarkTemplate.content.firstElementChild.cloneNode(true);
            checkmarkIcon.id = "uploaded";
            row.append(checkmarkIcon);
        } else {
            const warningIcon = warningTemplate.content.firstElementChild.cloneNode(true);
            row.append(warningIcon);
        }
        row.append(deleteIcon);
        uploadedFilesContainer.append(row);
    }

    actualFileInput.value = null;
}

function AddFiles(files) {
    addedFiles = addedFiles.concat(
        files.map(file => ({
            file: file,
            uploaded: false
        }))
    );
    UpdateFileListVisuals();
}

function TryRemoveFile(event) {
    const deleteIcon = event.target.closest(".uploaded-file svg");
    if(!deleteIcon) {
        return;
    }

    const row = deleteIcon.closest(".uploaded-file");
    let targetIndex = Number(row.dataset.fileIndex);

    if(addedFiles[targetIndex].uploaded) {
        //delete remove file
        if(confirm("By removing this file, you are deleting it from the report permanently")) {
            DeleteFile(addedFiles[targetIndex].file.id);
        } else {
            return;
        }
    }

    addedFiles.splice(targetIndex, 1);
    UpdateFileListVisuals();
    actualFileInput.dispatchEvent(new Event("input", {bubbles: true}));
}

async function DeleteFile(id) {
    const response = await fetch(`/api/files/${id}/delete`, {
        method: "DELETE"
    });

    const result = await response.json();

    if (response.ok) {
        UpdateFileListVisuals();
        document.dispatchEvent(OnFileDeleted);
        // Save();
    } else {
        alert(result.error);
    }
}

export function GetFiles() {
    return addedFiles;
}

export function SetFiles(files) {
    addedFiles = files.map(f => ({file: f, uploaded: true}));
    UpdateFileListVisuals();
}