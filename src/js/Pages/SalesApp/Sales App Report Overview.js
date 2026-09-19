import { CalculateTooltipPosition } from "../../Modules/Tooltip Mover.js";
import { DownloadFile, OpenFile, GoTo } from "../../Navigation.js";
import { RenderReport } from "../../Modules/Render Report.js";

document.addEventListener("DOMContentLoaded", async () => {
    await LoadReport();
    LinkObserverToAnchors();
    AddEventListeners();
});

window.addEventListener("resize", SetDimensions);
window.addEventListener("load", SetDimensions);


function SetDimensions() {
    const header = document.querySelector(".header");
	const sideMenu = document.getElementById("reportSideMenu");
    sideMenu.style.top = header.offsetHeight + "px";
    sideMenu.style.height = `calc(${document.documentElement.clientHeight}px - ${header.offsetHeight}px)`;

    const reportOverview = document.getElementById("reportOverviewMainContent");
    reportOverview.style.width = `calc(${document.documentElement.clientWidth}px - ${sideMenu.getBoundingClientRect().width}px)`;
    reportOverview.style.right = 0;
}

function LinkObserverToAnchors() {
    const sections = document.querySelectorAll(".report-overview-section");
    const navLinks = document.querySelectorAll(".side-menu-container a");
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {

                // Remove active class from all links
                navLinks.forEach((link) => {
                    link.classList.remove("active");
                });

                // Find matching link
                const activeLink = document.querySelector(`.side-menu-container a[href="#${entry.target.id}"]`);

                if (activeLink) {
                    activeLink.classList.add("active");
                }
            }
        });
    },{ threshold: 0.5, rootMargin: "-80px 0px 0px 0px" });

    sections.forEach((section) => {
        observer.observe(section);
    });
}

async function LoadReport() {
    const path = window.location.pathname;
    let parts = path.split("/");
    let reportId = Number(parts[parts.length - 1]);

    const reportData = await RenderReport(reportId, "reportSideMenu", "reportContents", "Additional Files");
    TryAddCriticism(reportData);
}

function TryAddCriticism(reportData) {
    if(reportData.meta.Manager_Approval !== "Rejected") {
        return;
    }

    const reasons = reportData.meta.Reject_Reasons;
    const onlyGeneric = Object.keys(reasons).length === 1 && reasons.hasOwnProperty("generic");

    const reportOverview = document.getElementById("reportOverviewMainContent");
    const contents = document.getElementById("reportContents");

    const genericRejectMsgContainer = document.createElement("div");
    genericRejectMsgContainer.classList.add("report-reject-msg");

    let topMsg = "Report has been rejected.";
    if(!onlyGeneric) {
        topMsg += " Criticism is next to the problematic data.";
    }
    if(reasons.generic !== "") {
        topMsg += `\nResponse from your manager: "${reasons.generic}":`
    }

    genericRejectMsgContainer.textContent = topMsg;

    reportOverview.insertBefore(genericRejectMsgContainer, contents);

    //other reasons for rejection
    Object.keys(reportData.meta.Reject_Reasons).filter(key => key !== "generic").forEach((key) => {
        const badData = document.getElementById(key);
        const criticism = document.createElement("span");
        criticism.classList.add("report-criticism");

        const value = reportData.meta.Reject_Reasons[key];
        criticism.textContent = value;
        try{
            badData.append(criticism);
        } catch {
            console.log(key);
            console.log(badData);
        }
    });
}

function EditReport(reportId) {
    localStorage.clear();
    GoTo("/SalesApp/NewReport/" + reportId);
}

function Exit() {
    GoTo("/SalesApp");
}

function AddEventListeners() {
    const fileSection = document.getElementById("Additional Files");
    fileSection.addEventListener("click", HandleFileClicks);

    const path = window.location.pathname;
    let parts = path.split("/");
    let reportId = Number(parts[parts.length - 1]);

    const editBtns = document.querySelectorAll("#editReportBtn");
    editBtns.forEach((btn) => {
        btn.addEventListener("click", () => EditReport(reportId))
    });

    const exitBtns = document.querySelectorAll("#exitReportBtn");
    exitBtns.forEach((btn) => {
        btn.addEventListener("click", Exit)
    });
}

// #region File Handling

function HandleFileClicks(event) {
    let fileEntry = event.target.closest(".open-icon");
    if(fileEntry) {
        let fileId = fileEntry.closest(".file-overview-card").dataset.fileId;
        
        OpenFile(fileId)
    }

    fileEntry = event.target.closest(".download-icon");
    if(fileEntry) {
        let fileId = fileEntry.closest(".file-overview-card").dataset.fileId;
        DownloadFile(fileId)
    }
}
