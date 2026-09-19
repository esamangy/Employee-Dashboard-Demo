import { GoTo } from "../Navigation.js";

document.addEventListener("DOMContentLoaded", () => {
	LoadAppSections();
});

async function LoadAppSections() {
    const promises = [];
    document.querySelectorAll(".app-group").forEach((section) => {
        let group = section.dataset.appGroup;
        promises.push(fetch(`/Dashboard/Apps/${group}`))
    });

    const results = (await Promise.all(
        promises.map(async promise => {
            const response = await promise;
            if (!response.ok) {
                console.error(`Request failed for ${response.url}`);
                return null;
            }
            return response.json();
        })
    )).filter(result => result !== null);

    results.forEach(result => CreateCard(result));

    CreateClickListener();
}

function CreateCard(result) {
    result.apps.forEach((app) => {
        const container = Array.from(document.querySelectorAll(".app-group")).find(element => element.dataset.appGroup === result.page);

        container.innerHTML = "";

        const btn = document.createElement("button");
        btn.classList.add("app-card", "permco-blue-bg", "tooltip");
        btn.dataset.dest = app.dest;

        const span = document.createElement("span");
        span.classList.add("tooltip-text", "centered");
        span.textContent = app.name;

        const img = document.createElement("img");
        img.src = app.image;
        img.alt = app.alt;

        btn.append(span);
        btn.append(img);
        container.append(btn);
    })
}

function CreateClickListener() {
    document.addEventListener("click", TryOpenApp)
}

function TryOpenApp(event) {
    const app = event.target.closest(".app-card");
    if(app === null) {
        return;
    }

    const dest = app.dataset.dest;
    GoTo(dest);
}