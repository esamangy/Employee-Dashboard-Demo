import { CalculateTooltipPosition } from "../../Modules/Tooltip Mover.js";
import { RenderReport, RemoveInputPrefix } from "../../Modules/Render Report.js";
import { DownloadFile, OpenFile } from "../../Navigation.js";

const reportList = document.getElementById("reportList");
const reportOverview = document.getElementById("reportOverview");
const listSortDropdown = document.getElementById("listSortDropdown");

const reportListHeader = document.getElementById("reportListHeader");
const noReports = document.getElementById("noReports");
const bucketListsentinel = document.getElementById("loadMoreTrigger")
const reportListSentinel = bucketListsentinel.cloneNode(true);
reportListSentinel.style.height = "5dvh";

const exitReportBtn = document.querySelector(".exit-report");

const additionalFilesSection = document.getElementById("Additional Files");
additionalFilesSection.style.display = "none";

const arrowTemplate = document.getElementById("arrowTemplate");
const pendingTemplate = document.getElementById("pendingTemplate");
const rejectedTemplate = document.getElementById("rejectedTemplate");
const minusTemplate = document.getElementById("minusTemplate");

const REPORTS_TO_LOAD_WHEN_CACHED = 20;

let currentbucketOffset = 0;
let isLoadingReports = false;
let hasMore = true;

let bucketCache = new Map();

let activeBucket = null;
let activeReport = null;
let activeReportId = null;
let rejectReasons = [];

const bucketListObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
        LoadBuckets();
    }
});

const reportListObserver = new IntersectionObserver(entries => {
    if(entries[0].isIntersecting) {
        LoadReportsForBucket(entries[0].target.closest(".bucket"));
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    InitializeInfiniteScroll();
    AddEventListeners();
    CreateRejectSubmitArea();

    exitReportBtn.addEventListener("click", CloseReport);
});

//#region Bucket Infinite Scroll

/*
for report sort value meanings
qn = quarter newest
qo = quarter oldest
ea = employee name a -> z
ez = employee name z -> a
ms = Manager Status pending -> rejected -> accepted
-- = no sort
*/

function InitializeInfiniteScroll() {
    bucketListObserver.observe(
        bucketListsentinel
    );

    reportListObserver.observe(
        reportListSentinel
    );

    ToggleNoReports(currentbucketOffset > 0);

    let keep = new Set([reportListHeader, noReports, bucketListsentinel]);

    listSortDropdown.addEventListener("change", () => {
        for (const child of [...reportList.children]) {
            if (!keep.has(child)) {
                child.remove();
            }
        }

        currentbucketOffset = 0;
        isLoadingReports = false;
        hasMore = true;

        activeReport = null;
        activeReportId = null;

        LoadBuckets();
    });

    reportList.addEventListener("click", HandleListClicks)
}

async function LoadBuckets() {
    if(isLoadingReports || !hasMore) {
        return;
    }

    isLoadingReports = true;

    const params = new URLSearchParams();
    params.append("bucketType", GetSortMethod()[0]);
    params.append("offset", currentbucketOffset);

    const response = await fetch(`/SalesApp/manager_dashboard/buckets?${params}`);
    const result = await response.json();

    try{
        result.buckets.forEach(report => {
            AddBucketToPage(report);
        });
    } catch (e){
        console.error("Error occurred while adding reports to the page.", e);
        isLoadingReports = false;
        return;
    }

    hasMore = result.hasMore;
    currentbucketOffset += result.buckets.length;

    isLoadingReports = false;

    ToggleNoReports(currentbucketOffset > 0);

    if(document.body.scrollHeight <= window.innerHeight) {
        LoadBuckets();
    }
}

function HandleListClicks(event) {
    if(event.target.id === "loadMoreTrigger") {
        return;
    }

    let report = event.target.closest(".report")

    if(report !== null) {
        let reportId = Number(report.dataset.reportId)
        if(report !== activeReport) {
            activeReport?.classList.remove("active");
            report.classList.add("active");
            activeReportId = reportId;
            activeReport = report;
            OpenReport(activeReportId, report);
        }
        
        return;
    }

    let bucket = event.target.closest(".bucket");
    if(bucket === null) {
        return;
    } else if(bucket === activeBucket) {
        activeBucket.classList.remove("active");
        activeBucket = null;
    } else {
        activeBucket?.classList.remove("active");
        bucket.classList.add("active");
        activeBucket = bucket;
        if(bucketCache.has(bucket)) {
            bucketCache.get(bucket).offset = 0;
        }
    }

    LoadActiveBucketsReports();
}

function GetSortMethod() {
    let sortMethod = listSortDropdown.value;
    let parts = sortMethod.split(" ");
    return parts;
}

function ToggleNoReports(hasReports) {
    if(hasReports) {
        noReports.classList.add("hidden");
    } else {
        noReports.classList.remove("hidden");
    }
}

function AddBucketToPage(bucket) {
    const container = document.getElementById("reportList");
    const row = document.createElement("div");
    row.dataset.group = bucket.group;

    row.classList.add("bucket");

    const bucketTopper = document.createElement("div");
    bucketTopper.classList.add("topper");
    
    const bucketName = document.createElement("h2");
    bucketName.textContent = bucket.label;

    bucketTopper.append(bucketName);

    let arrow = arrowTemplate.content.firstElementChild.cloneNode(true);
    bucketTopper.append(arrow);

    row.append(bucketTopper);

    container.insertBefore(row, bucketListsentinel);
}

//#region Bucket Infinite Scroll

async function LoadActiveBucketsReports() {
    let buckets = document.querySelectorAll(".bucket");
    
    buckets.forEach(async (bucket) => {
        if(bucket === activeBucket) {
            // display reports
            LoadReportsForBucket(bucket);
        } else {
            // remove reports
            RemoveReports(bucket);
        }

    });
}

async function LoadReportsForBucket(bucket) {
    let canloadMore = false;
    if(bucketCache.has(bucket)) {
        // cache hit
        let data = bucketCache.get(bucket);
        if(data.offset < data.reports.length) {
            let numAdded = AddReportsToBucket(bucket, data.reports.slice(data.offset, REPORTS_TO_LOAD_WHEN_CACHED));
            data.offset = data.offset + numAdded;
        } else if(data.hasMore) {
            let result = await FetchReportsFor(bucket, data.offset);
            data.reports = data.reports.concat(result.reports);
            data.offset = data.reports.length + 1;
            data.hasMore = result.hasMore
            AddReportsToBucket(bucket, result.reports);
            canloadMore = result.hasMore;
        }
    } else {
        // cache miss
        let result = await FetchReportsFor(bucket, 0); // offset here will always be zero since we haven't loaded any reports for this bucket yet
        bucketCache.set(bucket, {offset: result.reports.length, reports: result.reports, hasMore: result.hasMore});
        
        AddReportsToBucket(bucket, result.reports);
        canloadMore = result.hasMore;
    }

    const rect = reportListSentinel.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

    if(isVisible && canloadMore) {
        LoadReportsForBucket(bucket);
    }
}

function AddReportsToBucket(bucket, reports) {
    let cntr = 0;
    reports.forEach((report) => {
        RenderReportRow(bucket, report);
        cntr ++;
    })

    bucket.append(reportListSentinel);
    return cntr
}

function RenderReportRow(bucket, report) {
    const row = document.createElement("div");
    row.id = `report-${report.id}`;
    row.dataset.reportId = report.id;

    row.classList.add("report");
    if(report.id === activeReportId) {
        row.classList.add("active");
    }

    if(report.status !== "Accepted") {
        const container = document.createElement("div");
        container.classList.add("tooltip");

        let svg = null;
        let tooltipText = "If you see this an error occurred";
        if(report.status === "Pending") {
            svg = pendingTemplate.content.firstElementChild.cloneNode(true);
            tooltipText ="This report is awaiting review";
            row.dataset.isPending = "true";
        } else if(report.status === "Rejected") {
            svg = rejectedTemplate.content.firstElementChild.cloneNode(true);
            tooltipText = "This report has been rejected and is awaiting revisions";
        }

        const tooltip = document.createElement("span");
        tooltip.textContent = tooltipText;
        tooltip.classList.add("tooltip-text");
        container.append(tooltip);
        container.append(svg);

        row.append(container);
        requestAnimationFrame(() => CalculateTooltipPosition(container));
    }

    const title = document.createElement("h3");
    title.style.marginLeft = "8px";
    title.textContent = report.title;

    const date = document.createElement("h3");
    date.classList.add("date");
    date.textContent = report.date_visited;

    row.append(title);
    row.append(date);

    bucket.append(row);
}

async function FetchReportsFor(bucket, offset) {
    const params = new URLSearchParams();
    params.append("bucket", bucket.dataset.group);
    params.append("sortOrder", GetSortMethod()[1]);
    params.append("offset", offset);

    const response = await fetch(`/SalesApp/manager_dashboard/bucket/reports?${params}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const result = await response.json();

    if(!response.ok) {
        alert(`Server Error. Could not load reports for ${bucket.dataset.group}`);
    }

    return result;
}

function RemoveReports(bucket) {
    if (bucket.firstElementChild) {
        bucket.replaceChildren(bucket.firstElementChild);
    }
}

// #endregion
// #region Report Functionality

async function OpenReport(reportId, reportElement) {
    CancelRejection();
    SetupContainer();
    
    const container = document.getElementById("reportDataContainer");
    container.innerHTML = ""; // clear previous report data
    
    const reportData = await RenderReport(reportId, null, "reportDataContainer", "Additional Files");

    HighlightRejectReasonsInOverview(reportData);

    const genInfo = CreateReportGeneralInfo(reportData);

    reportOverview.insertBefore(genInfo, container);

    const controls = reportOverview.querySelector(".controls-container");
    if(reportElement.dataset.isPending === "true") {
        controls.classList.add("show");
    } else {
        controls.classList.remove("show");
    }

    reportOverview.dataset.reportId = reportId;

    document.body.classList.add("viewing-report");
}

function CloseReport() {
    document.body.classList.remove("viewing-report");
    activeReport?.classList.remove("active");
    activeReport = null;
}

function HighlightRejectReasonsInOverview(reportData) {
    const oldMsg = document.querySelector(".report-reject-msg");
    if(oldMsg !== null) {
        oldMsg.remove();
    }

    const reasons = reportData.meta.Reject_Reasons;

    if(reasons === null || reasons === undefined) {
        return;
    }

    const genericRejectMsgContainer = document.createElement("div");
    genericRejectMsgContainer.classList.add("report-reject-msg");
    genericRejectMsgContainer.style.width = "90%";

    let topMsg = "Report has been rejected. ";
    if(reasons.generic && reasons.generic !== "") {
        topMsg += `Manager's Response: "${reasons.generic}":`
    }

    genericRejectMsgContainer.textContent = topMsg;

    reportOverview.insertBefore(genericRejectMsgContainer, reportOverview.querySelector(".controls-container"));

    Object.keys(reasons).filter(key => key !== "generic").forEach((key) => {
        const badData = document.getElementById(key);
        const criticism = document.createElement("span");
        criticism.classList.add("report-criticism");

        const value = reasons[key];
        criticism.textContent = value;
        try{
            badData.append(criticism);
        } catch {
            console.log(key);
            console.log(badData);
        }
    });
}

function CreateReportGeneralInfo(reportData) {
    let genInfo = document.getElementById("genInfo");
    if(genInfo) {
        genInfo.remove();
    }

    genInfo = document.createElement("div");
    genInfo.id = "genInfo";
    genInfo.classList.add("report-overview-section");
    genInfo.style.width = "90%";
    genInfo.style.marginBottom = "32px";

    const sectionLabel = document.createElement("h3");
    sectionLabel.textContent = "Report Information";
    genInfo.append(sectionLabel);

    const mainContainer = document.createElement("div");
    mainContainer.classList.add("report-overview-section-container");

    genInfo.append(mainContainer);

    const nameContainer = document.createElement("label");
    nameContainer.classList.add("report-overview-section-element");
    const nameLabel = document.createElement("span");
    nameLabel.textContent = "Salesman:";
    nameLabel.classList.add("semi-bold");
    nameContainer.append(nameLabel);
    nameContainer.append(document.createTextNode(reportData.owner["full_name"]));

    mainContainer.append(nameContainer);
    return genInfo;
}

function SetupContainer() {
    const starterMessage = document.getElementById("noReportSelected");

    if(!starterMessage) { //this will prevent 'startup' stuff from happening again
        return;
    }
    
    starterMessage.remove();

    reportOverview.classList.add("flex-start");
}

function AddEventListeners() {
    reportOverview.addEventListener("click", HandleFileClicks);

    let approveBtn = document.getElementById("approveReportBtn");
    approveBtn.addEventListener("click", () => {
        let reportId = reportOverview.dataset.reportId;
        ApproveReport(reportId);
    });

    let rejectBtn = document.getElementById("rejectReportBtn");
    rejectBtn.addEventListener("click", () => {
        let reportId = reportOverview.dataset.reportId;
        EnterRejectMode(reportId);
    });
}

function HandleFileClicks(event) {
    let icon = event.target.closest(".open-icon");
    if(icon) {
        let fileId = icon.closest(".file-overview-card").dataset.fileId;
        OpenFile(fileId)
    }

    icon = event.target.closest(".download-icon");
    if(icon) {
        let fileId = icon.closest(".file-overview-card").dataset.fileId;
        DownloadFile(fileId)
    }
}

// #endregion
// #region Report Approval

async function ApproveReport(reportId) {
    const response = await fetch(`/SalesApp/manager_dashboard/report/${reportId}/approve`, {
        method: "Patch",
    });

    const result = await response.json();

    if(!response.ok) {
        alert(`Could not approve report ${reportId}. \nError: ${result.error}`);
        return;
    }

    RedrawReportRow(document.getElementById(`report-${reportId}`), result.report);
    OpenReport(activeReportId, document.getElementById(`report-${reportId}`));
}

function RedrawReportRow(row, report) {
    row.innerHTML = ""; // clear existing content

    if(report.status !== "Accepted") {
        const container = document.createElement("div");
        container.classList.add("tooltip");

        let svg = null;
        let tooltipText = "If you see this an error occurred";
        if(report.status === "Pending") {
            svg = pendingTemplate.content.firstElementChild.cloneNode(true);
            tooltipText ="This report is awaiting review";
            row.dataset.isPending = "true";
        } else if(report.status === "Rejected") {
            svg = rejectedTemplate.content.firstElementChild.cloneNode(true);
            tooltipText = "This report has been rejected and is awaiting revisions";
            row.dataset.isPending = "false";
        }

        const tooltip = document.createElement("span");
        tooltip.textContent = tooltipText;
        tooltip.classList.add("tooltip-text");
        container.append(tooltip);
        container.append(svg);

        row.append(container);
        requestAnimationFrame(() => CalculateTooltipPosition(container));
    } else {
        row.dataset.isPending = "false";
    }

    const title = document.createElement("h3");
    title.textContent = report.title;

    const date = document.createElement("h3");
    date.classList.add("date");
    date.textContent = report.date_visited;

    row.append(title);
    row.append(date);
}

// #endregion
// #region Reject Mode

function CancelRejection() {
    DisableRejectingEffects();
    reportOverview.removeEventListener("click", TryMarkRejectReason);

    const submitArea = document.querySelector(".reject-submit-area");
    submitArea.classList.add("hidden");

    const instructionsBox = document.getElementById("rejectInstructions");
    if(instructionsBox) {
        instructionsBox.remove();
    }

    const controls = reportOverview.querySelector(".controls-container");
    controls.classList.add("show");
}

function EnterRejectMode(reportId) {
    rejectReasons = [];
    CreateRejectInstructions();
    EnableRejectingEffects();
    
    const submitArea = document.querySelector(".reject-submit-area");
    submitArea.classList.remove("hidden");

    const controls = reportOverview.querySelector(".controls-container");
    controls.classList.remove("show");

    reportOverview.addEventListener("click", TryMarkRejectReason);
}

function CreateRejectInstructions() {
    const genInfo = document.getElementById("genInfo");

    const instructionsBox = document.createElement("div");
    instructionsBox.classList.add("warning-box");
    instructionsBox.id = "rejectInstructions";

    const text = document.createElement("p");
    text.textContent = "Please click the text that needs correction. Then, add notes and submit";

    instructionsBox.append(text);

    reportOverview.insertBefore(instructionsBox, genInfo);
}

function EnableRejectingEffects() {
    const rejectables = document.querySelectorAll(".report-overview-section-element");

    rejectables.forEach((element) => {
        const section = element.closest(".report-overview-section");
        if(section.id === "genInfo") {
            return;
        }
        element.classList.add("rejecting");
    });
}

function DisableRejectingEffects() {
    const rejectables = document.querySelectorAll(".report-overview-section-element");

    rejectables.forEach((element) => {
        const section = element.closest(".report-overview-section");
        if(section.id === "genInfo") {
            return;
        }
        element.classList.remove("rejecting");
    });
}

function TryMarkRejectReason(event) {
    let element = event.target.closest(".report-overview-section-element");
    if (!element) {
        return;
    }
    
    element.classList.toggle("reject-reason");
    if(rejectReasons.includes(element)) {
        const index = rejectReasons.indexOf(element);

        if (index !== -1) {
            rejectReasons.splice(index, 1);
        }
    } else {
        rejectReasons.push(element);
    }

    DrawRejectReasons();
}

function CreateRejectSubmitArea() {
    const submitArea = document.createElement("div");
    submitArea.classList.add("vertical-container", "hidden", "reject-submit-area");

    const RejectReasonsContainer = document.createElement("div");
    RejectReasonsContainer.id = "rejectReasonsContainer";
    RejectReasonsContainer.classList.add("reject-reasons");
    const controlsContainer = document.createElement("div");

    const notes = document.createElement("textArea");
    notes.placeholder = "Type general notes for rejection here...";
    notes.id = "notes";

    controlsContainer.classList.add("horizontal-container", "controls-container", "show");
    controlsContainer.style.background = "none";
    const cancel = document.createElement("button");
    cancel.id = "cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", CancelRejection);
    controlsContainer.append(cancel);

    const submit = document.createElement("button");
    submit.classList.add("permco-blue-bg");
    submit.id = "submitRejection";
    submit.textContent = "Submit";
    submit.style.color = "white";
    submit.addEventListener("click", SubmitRejection);
    controlsContainer.append(submit);

    const header = document.createElement("h2");
    header.textContent = "Reasons For Rejection:";

    submitArea.append(header);
    submitArea.append(RejectReasonsContainer);
    reportOverview.addEventListener("click", TryRemoveReason);
    submitArea.append(notes);
    submitArea.append(controlsContainer);

    reportOverview.append(submitArea);
    DrawRejectReasons();
}

function DrawRejectReasons() {
    const container = document.getElementById("rejectReasonsContainer");
    container.innerHTML = "";

    let numReasons = 0;
    rejectReasons.forEach((reason) => {
        const row = document.createElement("div");
        row.classList.add("horizontal-container", "reject-row");
        row.dataset.linkedTarget = reason.id;

        const label = document.createElement("p");
        label.textContent = document.getElementById(reason.dataset.key).querySelector("span").textContent;

        const note = document.createElement("input");

        let minus = minusTemplate.content.firstElementChild.cloneNode(true);
        
        row.append(label);
        row.append(note);
        row.append(minus);
        container.append(row);
        numReasons ++;
    });

    if(numReasons <= 0) {
        container.textContent = "No report elements marked. Please mark some elements if you wish to give more constructive criticism";
    }
}

function TryRemoveReason(event) {
    let element = event.target.closest(".remove-reason-btn");
    if (!element) {
        return;
    }

    let row = element.closest(".reject-row");
    let linkedElement = document.getElementById(row.dataset.linkedTarget);

    if(!linkedElement) {
        console.error("couldn't find linked target");
        return;
    }
    
    linkedElement.classList.remove("reject-reason");
    const index = rejectReasons.indexOf(linkedElement);

    if (index !== -1) {
        rejectReasons.splice(index, 1);
    }

    DrawRejectReasons();
}

// #endregion
// #region Reject Report

async function SubmitRejection() {
    const data = CollectRejectData();

    if(data === null) {
        return;
    }

    let reportId = reportOverview.dataset.reportId;
    const response = await fetch(`/SalesApp/manager_dashboard/report/${reportId}/reject`, {
        method: "Patch",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();

    if(!response.ok) {
        alert(`Could not reject report ${reportId}. \nError: ${result.error}`);
        return;
    }

    RedrawReportRow(document.getElementById(`report-${reportId}`), result.report);
    OpenReport(activeReportId, document.getElementById(`report-${reportId}`));
}

function CollectRejectData() {
    let data = {};
    const rows = reportOverview.querySelectorAll(".reject-row");

    for(let i = 0; i < rows.length; i ++) {
        const input = rows[i].querySelector("input");
        const value = input.value;
        
        data[RemoveInputPrefix(rows[i].dataset.linkedTarget)] = value;
    }

    const generic = document.getElementById("notes");
    const value = generic.value;
    
    if(rows.length <= 0) {
        if(value === "" || value === null) {
            generic.setCustomValidity("You need to provide a reason.");
            generic.reportValidity();
            return null;
        } else {
            generic.setCustomValidity("");
        }
    }

    data["generic"] = value;

    return data;
}
