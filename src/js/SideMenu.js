window.addEventListener("load", () => {
    SetDimensions();
});

window.addEventListener("resize", SetDimensions);

function SetDimensions() {
    const header = document.querySelector(".header");
	const sideMenu = document.querySelector(".side-menu-container");
    sideMenu.style.top = header.offsetHeight + "px";
    sideMenu.style.height = `calc(${window.innerHeight}px - ${header.offsetHeight}px)`;

    const remainder = document.querySelector(".side-menu-remainder");
    if(remainder === null) return;
    if(document.documentElement.clientWidth > 720) {
        remainder.style.width = `calc(${document.documentElement.clientWidth}px - ${sideMenu.getBoundingClientRect().width}px)`;
        remainder.style.height = `calc(${window.innerHeight}px - ${header.offsetHeight}px)`;
    } else {
        remainder.style.width = "100%";
    }
}