const NavMethods = {
    SalesAppNewReport,
}

document.addEventListener("DOMContentLoaded", () => {
	LinkNavBtns();
});

function LinkNavBtns() {
    document.querySelectorAll(".nav-btn").forEach((element) => {
        let dest = element.dataset.dest;
        element.addEventListener("click", () => GoTo(dest));
    });

    document.querySelectorAll(".nav-btn-method").forEach((element) => {
        let dest = element.dataset.dest;
        if(dest in NavMethods) {
            element.addEventListener("click", () => NavMethods[dest]());
        }
    });
}

export function GoTo(page) {
    window.location.href = page;
}

function SalesAppNewReport() {
    localStorage.clear();
    GoTo("/SalesApp/NewReport");
}

export function DownloadFile(fileId) {
    const a = document.createElement("a");
    a.href = `/api/files/${fileId}/download`;

    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function OpenFile(fileId) {
    const viewerUrl = `/FileViewer?fileId=${encodeURIComponent(fileId)}`;
    window.open(viewerUrl, "_blank", "noopener");
}