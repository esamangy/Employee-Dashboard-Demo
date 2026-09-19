//#region New Version
/**
 * @typedef {Object} SuggestionConfig
 * @property {string} inputId
 * @property {string} suggestionsContainerId
 * @property {string} fetchUrl
 * @property {(suggestions: unknown[], input: HTMLInputElement) => void} renderSuggestions
 * @property {number} [minLength = 2]
 * @property {string} [addedContainerId = ""]
 * @property {number} [maxEntries = -1]
 */

/**
 * @param {SetupConfig} config
 */
export function SetupAutoComplete(config) {
    if (!config || typeof config !== "object") {
        throw new TypeError("A configuration object is required.");
    }

    const {
        inputId,
        suggestionsContainerId,
        fetchUrl,
        renderSuggestions,
        minLength = 2,
        addedContainerId = "",
        maxEntries = -1,
        onBlur
    } = config;

    const input = document.getElementById(inputId);

    input.addEventListener("input", async (event) => {
        
        const query = input.value.trim();
        if(query.length < minLength) {
            HideSuggestions(suggestionsContainerId);
            return;
        }

        const response = await fetch(AddArgsToUrl(fetchUrl, input), {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            },
        });
        
        const results = await response.json();
        renderSuggestions(results);
    });

    input.addEventListener("keydown", (event) => {
        if(event.key === "Escape") {
            HideSuggestions(suggestionsContainerId);
        }
    });

    input.addEventListener("blur", (event) => {
        HideSuggestions(suggestionsContainerId);
    });

    if(maxEntries < 0) {
        return;
    }

    if(maxEntries >= 0 && addedContainerId === "") {
        console.error("Max entries has been used but the associated container has not been assigned. Please assign to \'addedContainerId\' in the config");
        return;
    }
    const addedBox = document.getElementById(addedContainerId);

    const observer = new MutationObserver((mutations) => {
        if(addedBox.querySelectorAll(".selected-option").length >= maxEntries) {
            input.hidden = true;
        } else {
            input.hidden = false;
        }
    });

    observer.observe(addedBox, {childList: true});

    window.addEventListener('beforeunload', function (event) {
        observer.disconnect();
    });
}

export function HideSuggestions(containerId) {
    const container = document.getElementById(containerId);
    container.classList.remove("show");
    container.innerHTML = "";
}

function AddArgsToUrl(url, input) {
    const chars = input.value.trim();
    return url + `?chars=${chars}`
}