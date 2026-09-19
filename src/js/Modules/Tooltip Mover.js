document.addEventListener("DOMContentLoaded", () => {
    CalculateAllTooltipPositions();
});

window.addEventListener("resize", CalculateAllTooltipPositions);

export function CalculateAllTooltipPositions() {
    const tooltips = document.querySelectorAll(".tooltip");
    tooltips.forEach((tooltip) => CalculateTooltipPosition(tooltip));
}

export function CalculateTooltipPosition(tooltip){
    const windowWidth1Percent = window.innerWidth * 0.01;
    const hintBox = tooltip.querySelector(".tooltip-text");
    if (!hintBox) return;
    
    // Reset positioning. need to do this to handle window resizing
    hintBox.style.left = "";
    hintBox.style.right = "";
    hintBox.style.top = "";
    hintBox.style.bottom = "";

    if(hintBox.classList.contains("centered")) {
        hintBox.style.top = (tooltip.offsetHeight / 2) + "px";
    } else {
        hintBox.style.top = tooltip.offsetHeight + 5 + "px"; // 5 px gap
    }

    const rect = hintBox.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    if (rect.left < (windowWidth1Percent * 2)) {
        hintBox.style.left = (windowWidth1Percent * 2) - tooltip.offsetLeft + "px";
    } else if (rect.right > window.visualViewport.width - (windowWidth1Percent * 2)) {
        hintBox.style.right = -(window.visualViewport.width - tooltipRect.right) + (windowWidth1Percent * 2) + "px";
    }
}