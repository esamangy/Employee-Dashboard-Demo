import { SetupAutoComplete, HideSuggestions } from "../../Modules/Autocomplete Search.js";
import { GoTo } from "../../Navigation.js";

window.addEventListener("load", () => {
    InitializeInfiniteScroll();
    AddEventListenersToReportContainer();
    SetupContextMenuListeners();
    SetupShareMenu();
});

const contextMenu = document.getElementById("file-context-menu");
const overlay = document.getElementById("overlay");

let currentOffset = 0;
let isLoadingReports = false;
let hasMore = true;

const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
        LoadReports();
    }
});

function AddEventListenersToReportContainer() {
    const container = document.getElementById("reportList");
    container.addEventListener("click", (event) => {
        const entry = event.target.closest(".file-entry");
        if (!entry) {
            return;
        }
        if(window.visualViewport.width <= 720) {
            // mobile -> open page
            const btn = event.target.closest(".svg-container");
            if(btn != null) {
                // dont open if we hit the context menu
                return;
            }
            const reportId = Number(entry.dataset.reportId);
            GoTo(`/SalesApp/ReportOverview/${reportId}`);
        } else {
            // desktop -> focus entry
            entry.focus();
        }
        
    });

    container.addEventListener("dblclick", (event) => {
        const entry = event.target.closest(".file-entry");
        if (!entry) {
            return;
        }
        if(entry.id === "reportHeader") {
            return;
        }
        const reportId = Number(entry.dataset.reportId);
        GoTo(`/SalesApp/ReportOverview/${reportId}`);
    });

    container.addEventListener("click", (event) => {
        const btn = event.target.closest(".svg-container");
        const entry = event.target.closest(".file-entry");
        if (!btn || !entry) {
            return;
        }
        const reportId = Number(entry.dataset.reportId);
        OpenFileDotMenu(reportId);
        event.stopPropagation();
    });
}

function GetPageType() {
    const path = window.location.pathname;
    
    let parts = path.split("/");
    
    for(let i = 0; i < parts.length; i++) {
        if(parts[i] === "SalesApp") {
            if(i + 1 < parts.length) {
                return parts[i + 1].toLowerCase();
            }
        }
    }
}

// #region Context Menu Logic

function SetupContextMenuListeners() {
    document.getElementById('openReportBtn').addEventListener("click", () => {
        SalesApp_LoadReport(document.getElementById('file-context-menu').getAttribute('data-reportId'));
    });

    document.getElementById('shareReportBtn').addEventListener("click", () => {
        OpenSharingMenu(document.getElementById('file-context-menu').getAttribute('data-reportId'));
    });

    document.getElementById('renameReportBtn').addEventListener("click", () => {
        SalesApp_RenameReport(document.getElementById('file-context-menu').getAttribute('data-reportId'));
    });

    document.getElementById('deleteReportBtn').addEventListener("click", () => {
        SalesApp_DeleteReport(document.getElementById('file-context-menu').getAttribute('data-reportId'));
    });
}

function OpenFileDotMenu(reportId) {
    contextMenu.setAttribute("data-reportId", reportId);
    let isShared = document.getElementById("file_" + reportId).dataset.isshared === "true";

    contextMenu.classList.add("show");
    overlay.classList.add("clear");

    contextMenu.querySelector("#shareReportBtn").classList.toggle("hide", isShared);
    contextMenu.querySelector("#separatorLine").classList.toggle("hide", isShared);
    contextMenu.querySelector("#renameReportBtn").classList.toggle("hide", isShared);
    contextMenu.querySelector("#deleteReportBtn").classList.toggle("hide", isShared);

    overlay.addEventListener("click", CloseContextMenu);

    PositionContextMenu(reportId);
}

function CloseContextMenu() {
    contextMenu.classList.remove("show");
    overlay.classList.remove("clear");
    overlay.removeEventListener("click", CloseContextMenu);
}

function PositionContextMenu(reportId) {
    contextMenu.style.left = "";
    contextMenu.style.right = "";
    contextMenu.style.top = "";
    contextMenu.style.bottom = "";
    const callingBtn = document.getElementById("context-menu-btn-file_" + reportId);
    //x positioning
    contextMenu.style.right = window.innerWidth - callingBtn.getBoundingClientRect().left + "px";
    //y positioning
    let roomBelow = window.innerHeight - callingBtn.getBoundingClientRect().bottom;
    let below = roomBelow > contextMenu.offsetHeight + 100; // 100px buffer
    if(below) {
        contextMenu.style.top = callingBtn.getBoundingClientRect().bottom + window.scrollY + "px";
    } else {
        contextMenu.style.bottom = window.innerHeight - callingBtn.getBoundingClientRect().top - 50 + window.scrollY + "px";
    }
}

//#region Infinite Scroll

function InitializeInfiniteScroll() {
    observer.observe(
        document.getElementById("loadMoreTrigger")
    );

    ToggleNoReports(currentOffset > 0);
}

async function LoadReports() {
    if(isLoadingReports || !hasMore) {
        return;
    }

    isLoadingReports = true;

    const response = await fetch(`/SalesApp/LoadMoreReports?offset=${currentOffset}&pageType=${GetPageType()}`);
    const result = await response.json();

    try{
        result.reports.forEach(report => {
            AddReportToPage(report);
        });
    } catch (e){
        console.error("Error occurred while adding reports to the page.", e);
        isLoadingReports = false;
        return;
    }

    hasMore = result.has_more;
    currentOffset += result.reports.length;

    isLoadingReports = false;

    ToggleNoReports(currentOffset > 0);

    if(document.body.scrollHeight <= window.innerHeight) {
        LoadReports();
    }
}

function ToggleNoReports(hasReports) {
    const header = document.getElementById("reportHeader");
    const noReports = document.getElementById("noReports");

    if(hasReports) {
        header.classList.remove("hidden");
        noReports.classList.add("hidden");
    } else {
        header.classList.add("hidden");
        noReports.classList.remove("hidden");
    }
}

function AddReportToPage(report) {
    const container = document.getElementById("reportList");
    const sentinel = document.getElementById("loadMoreTrigger");
    const row = document.createElement("li");
    row.classList.add("file-entry");
    row.tabIndex = 0;
    row.dataset.reportId = report.id;
    row.dataset.isshared = (report.isShared !== undefined ? report.isShared : false);
    row.id = "file_" + report.id;

    const showWarning = report.warning !== "" ? "show" : null;
    const template = document.getElementById("threeDotIconTemplate");

    const essential = document.createElement("div");
    const nameContainer = document.createElement("div");
    const warning = document.createElement("p")
    const name = document.createElement("p")

    essential.classList.add("essential-content");
    nameContainer.classList.add("horizontal-container");
    warning.classList.add("report-draft-indicator", showWarning);
    warning.textContent = report.warning;
    name.classList.add("report-title");
    name.textContent = report.title;

    nameContainer.append(warning);
    nameContainer.append(name);
    essential.append(nameContainer);

    const input = document.createElement("input");
    input.id = `rename-report-${report.id}`;
    input.classList.add("report-rename-input");
    input.type = "text";
    input.value = report.title;

    essential.append(input);

    const visitedContainer = document.createElement("div");
    const editedContainer = document.createElement("div");
    visitedContainer.classList.add("horizontal-container");
    editedContainer.classList.add("horizontal-container");
    visitedContainer.id = "visitedContainer";

    const visitedLabel = document.createElement("p");
    const editedLabel = document.createElement("p");
    visitedLabel.textContent = "Visited:";
    editedLabel.textContent = "Last Edited:";
    visitedLabel.classList.add("mobile-view", "no-margin", "faded-text");
    editedLabel.classList.add("mobile-view", "no-margin", "faded-text");

    visitedContainer.append(visitedLabel);
    editedContainer.append(editedLabel);

    const visited = document.createElement("p");
    const edited = document.createElement("p");

    visited.classList.add("date-visited");
    visited.textContent = report.date_visited;
    edited.id = "lastEdited";
    edited.textContent = report.last_edited;

    visitedContainer.append(visited);
    editedContainer.append(edited);

    essential.append(visitedContainer);
    essential.append(editedContainer);
    
    row.append(essential);

    const conextMenu = document.createElement("div");
    conextMenu.id = `context-menu-btn-file_${report.id}`;
    conextMenu.classList.add("svg-container");

    const clone = template.content.firstElementChild.cloneNode(true);
    conextMenu.append(clone);
    row.append(conextMenu);

    container.append(row);
}

//#region Sharing Logic

async function ShareReport() {
    const box = document.getElementById("sharingBox");
    const users = box.querySelectorAll(".selected-option");
    const reportId = document.getElementById("sharingMenu").dataset.reportId;
    let data = [];
    users.forEach(async user => {
        const userId = user.dataset.userId;
        data.push(userId);
    });

    const response = fetch(`/api/JsonData/${reportId}/accessors`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response;

    if(!result.ok) {
        return;
    }

    ClearSharingInput();
}

async function UnshareReport(accessorId) {
    const reportId = document.getElementById("sharingMenu").dataset.reportId;
    
    const response = fetch(`/api/JsonData/${reportId}/accessors`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(accessorId)
    });
    const result = await response;
    FillPeopleWithAccess(reportId, document.getElementById("sharingMenu"));
}

function SetupShareMenu() {
    SetupAutoComplete({
        inputId: "shareReportInput",
        suggestionsContainerId: "suggestionsContainer",
        fetchUrl: "/api/users/searchNameAndEmail",
        renderSuggestions: RenderSuggestions,
    })

    const sharingSubmit = document.getElementById("sharingSubmit");
    sharingSubmit.addEventListener("click", () => CloseSharingMenu(true));
}

function OpenSharingMenu(reportId) {
    CloseContextMenu();
    const sharingMenu = document.getElementById("sharingMenu");
    let reportTitle = document.getElementById("context-menu-btn-file_" + reportId).closest(".file-entry").querySelector(".report-title");

    const sharingTitle = document.getElementById("sharingTitle");
    sharingTitle.textContent = `Share "${reportTitle.textContent}"`;
    sharingMenu.setAttribute("data-report-id", reportId);
    sharingMenu.classList.add("show");

    overlay.classList.add("show");

    overlay.addEventListener("click", CloseSharingMenu);

    FillPeopleWithAccess(reportId, sharingMenu);
    const peopleContainer = sharingMenu.querySelector(".people-container")
    peopleContainer.addEventListener("click", TryRemoveAccess);

    UpdateDoneButton();

    const sharingInput = document.getElementById("shareReportInput");
    sharingInput.focus();

    const container = document.getElementById("suggestionsContainer");
    container.addEventListener("mousedown", AddUser);

    const box = document.getElementById("sharingBox");
    box.addEventListener("click", RemoveUser);
}

function TryRemoveAccess(event) {
    const userEntry = event.target.closest("#removeBtn");
    if(!userEntry) {
        return;
    }

    const accessorId = userEntry.dataset.accessorId;
    UnshareReport(accessorId);
}

function RenderSuggestions(results) {
    const container = document.getElementById("suggestionsContainer");
    let suggestedUserTemplate = document.getElementById("suggestedUserTemplate");

    PositionSuggestedUsersContainer(container);
    container.classList.add("show");
    container.innerHTML = "";

    results.users.forEach(user => {
        const clone = suggestedUserTemplate.content.firstElementChild.cloneNode(true);
        clone.querySelector("#suggestionName").textContent = user.full_name;
        clone.querySelector("#suggestionEmail").textContent = user.email;
        clone.dataset.userId = user.id;
        container.append(clone);
    });
}

function PositionSuggestedUsersContainer(container) {
    const parent = document.getElementById("sharingMenu");
    const box = document.getElementById("sharingBox");

    //position suggestions below the input
    const rect = box.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    container.style.top = rect.top - parentRect.top + rect.height + "px";
    container.style.left = rect.left - parentRect.left + (rect.width / 2) + "px";

    container.style.width = rect.width + "px";
}

function UpdateDoneButton() {
    const sharingMenu = document.getElementById("sharingMenu");
    const doneBtn = sharingMenu.querySelector(".shared-done-btn");
    let box = document.getElementById("sharingBox");
    let users = box.querySelectorAll(".selected-option");
    doneBtn.textContent = users.length > 0 ? "Share" : "Done";
}

function RemoveUser(event) {
    const userEntry = event.target.closest(".selected-option svg");
    if(!userEntry) {
        return;
    }

    userEntry.parentElement.remove();
    UpdateDoneButton();
}

function AddUser(event) {
    const userEntry = event.target.closest(".suggestion-item");
    if(!userEntry) {
        return;
    }

    event.preventDefault();

    let box = document.getElementById("sharingBox");
    let input = document.getElementById("shareReportInput");
    let userTemplate = document.getElementById("selectedUserTemplate");

    const clone = userTemplate.content.firstElementChild.cloneNode(true);
    clone.querySelector("#name").textContent = userEntry.querySelector("#suggestionName").textContent;
    clone.dataset.userId = userEntry.dataset.userId;

    box.insertBefore(clone, input);
    input.value = "";
    HideSuggestions("suggestionsContainer");
    UpdateDoneButton();
}

async function FillPeopleWithAccess(reportId, sharingMenu) {
    const container = sharingMenu.querySelector(".people-container")
    let errorMessage = document.getElementById("accessorsError");
    for (const child of [...container.children]) {
        if (child !== errorMessage) {
            child.remove();
        }
    }

    const response = await fetch(`/api/JsonData/${reportId}/accessors`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

    if(!response.ok) {
        ToggleErrorMessageAccessors(true);
        return;
    } else {
        ToggleErrorMessageAccessors(false);
    }
    
    const result = await response.json();
    
    let personTemplate = document.getElementById("sharedPersonTemplate");

    for(let i = 0; i < result.accessors.length; i++) {
        const clone = personTemplate.content.firstElementChild.cloneNode(true);
        clone.querySelector("#name").textContent = result.accessors[i].full_name + (i == 0 ? " (you)" : "");
        clone.querySelector("#email").textContent = result.accessors[i].email;

        if(i == 0) {
            clone.querySelector("#removeBtn").classList.add("hidden");
        } else {
            clone.querySelector("#removeBtn").dataset.accessorId = result.accessors[i].id;
        }

        container.append(clone);
    }
}

function ClearSharingInput() {
    const sharingInput = document.getElementById("shareReportInput");
    sharingInput.value = "";
    const box = document.getElementById("sharingBox");

    for (const child of [...box.children]) {
        if (child !== sharingInput) {
            child.remove();
        }
    }
}

function CloseSharingMenu(share) {
    if(typeof(share) === "boolean" && share) {
        ShareReport();
    }

    overlay.classList.remove("show");
    sharingMenu.classList.remove("show");
    const container = document.getElementById("suggestionsContainer");
    container.innerHTML = "";
    ClearSharingInput();
    
    overlay.removeEventListener("input", CloseSharingMenu);
    container.removeEventListener("mousedown", AddUser);

    const box = document.getElementById("sharingBox");
    box.removeEventListener("click", RemoveUser);
}

function ToggleErrorMessageAccessors(onOff) {
    let element = document.getElementById("accessorsError");
    element.classList.toggle("show", onOff);
}

//#region Rename Logic

function SalesApp_RenameReport(reportId) {
    const fileEntry = document.getElementById("file_" + reportId);
    const title = fileEntry.querySelector(".report-title");
    const input = fileEntry.querySelector(".report-rename-input");
    
    title.classList.add("hidden");
    input.classList.add("show");

    input.focus();
    input.select();

    contextMenu.classList.remove("show");
    overlay.classList.remove("clear");

    input.addEventListener("keydown", async event => {
        if(event.key === "Enter") {
            await FinishRename(fileEntry, input, reportId);
        }

        if(event.key === "Escape") {
            CancelRename(input, title);
        }
    });

    input.addEventListener("blur", async () => {
        await FinishRename(fileEntry, input, reportId);
    });
}

async function FinishRename(fileEntry, input, reportId) {
    const title = fileEntry.querySelector(".report-title");

    const oldTitle = title.textContent.trim();
    const newTitle = input.value.trim();

    if(newTitle === "" || newTitle === oldTitle) {
        CancelRename(input, title);
        return;
    }
    
    const response = await fetch(`/api/JsonData/${reportId}/rename`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            file_name: newTitle
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.error || "Could not rename file");
        input.value = oldName;
        CancelRename(input, title);
        return;
    }

    title.textContent = result.report_name;
    input.value = result.report_name;

    title.classList.remove("hidden");
    input.classList.remove("show");
}

function CancelRename(input, title) {
    input.value = title.textContent.trim();

    title.classList.remove("hidden");
    input.classList.remove("show");
}

//#region Delete Logic

async function SalesApp_DeleteReport(reportId) {
    const confirmed = confirm(
        "Are you sure you want to delete this file?"
    );

    if (!confirmed) {
        return;
    }

    const response = await fetch(`/api/JsonData/${reportId}/delete`, {
        method: "DELETE"
    });

    const result = await response.json();

    if (response.ok) {
        location.reload();
    } else {
        alert(result.error);
    }
}