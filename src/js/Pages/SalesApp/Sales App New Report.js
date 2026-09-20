import { SetupAutoComplete, HideSuggestions } from "../../Modules/Autocomplete Search.js";
import { GetFiles, SetFiles } from "../../Modules/File Input.js";

const form = document.getElementById("salesReport");
const steps = form.querySelectorAll(".form-step");

const submit = document.getElementById("reportSubmit");
const back = document.getElementById("reportBack");
const next = document.getElementById("reportNext");
const exitBtn = document.getElementById("exitBtn");

const progressBar = document.getElementById("reportProgressBar");
const progressPercentText = document.getElementById("reportProgressPercent");
const mainContainer = document.getElementById("new-report-container");

let formDirty = false;
let currentStep = 0;
let saveTimer;

let reportId = null;
let isDraft = true;

let multiEntries = {};

const groupInputRejectionMapping = {
    "account_researched": "preperation_completed",
    "agenda_prepared": "preperation_completed",
    "samples_/_literature_prepared": "preperation_completed",
    "competitive_intelligence_gathered": "preperation_completed",
    "lead_time_sheet_updated": "preperation_completed",
    "customer_history_reviewed": "preperation_completed",

    "key_decision_makers": "decision_makers",
    "contact_info": "decision_makers",
    "key_figure_contact_info": "decision_makers",

    "lead_time_concerns": "concerns_informed_of",
    "pricing_concerns": "concerns_informed_of",
    "warranty_issues": "concerns_informed_of",
    "delivery_or_logistics_issues": "concerns_informed_of",
    "quality_concerns": "concerns_informed_of",
    "need_for_training_or_product_knowledge": "concerns_informed_of",
    "stocking_shortages": "concerns_informed_of",
    "competitor_presence": "concerns_informed_of",
    "other_pain_points": "concerns_informed_of",

    "muncie": "competitors_mentioned",
    "heavy_motions": "competitors_mentioned",
    "parker": "competitors_mentioned",
    "other_competitor": "competitors_mentioned",

    "new_business": "opportunities_identified",
    "cross-reference_opportunity": "opportunities_identified",
    "new_product_line_expansion": "opportunities_identified",
    "stocking_/_consignment": "opportunities_identified",
    "training_opportunity": "opportunities_identified",
    "engineering_/_project_collaboration": "opportunities_identified",
    "referral_received": "opportunities_identified",
    "program_participation": "opportunities_identified",

    "contacts_multi": "decision_makers",
    "referrals_multi": "referrals",

    "permco_school_td": "training_types_requested",
    "virtual_training_td": "training_types_requested",
    "branch_training_td": "training_types_requested",
    "other_training_requested": "training_types_requested",

    "lead_time_orders": "reasons_for_not_ordering",
    "price_orders": "reasons_for_not_ordering",
    "quality_orders": "reasons_for_not_ordering",
    "lost_to_competitor_orders": "reasons_for_not_ordering",
    "budget_timing_orders": "reasons_for_not_ordering",
    "low_demand_orders": "reasons_for_not_ordering",

    "send_to_permco_school_td": "discussed_permco_school",
}

document.addEventListener("DOMContentLoaded", async () => {
    await InitForm();
    AddInputListeners();
});

window.addEventListener('beforeunload', function (event) {
    if(formDirty) {
        event.preventDefault();
        event.returnValue = "";
    }
});

exitBtn.addEventListener("click", Exit)

async function InitForm() {
    await CheckReportId();
    reportId = Number(localStorage.getItem("reportId")) || null;
    
    currentStep = Number(localStorage.getItem("currentFormStep")) || 0;
    if(currentStep < 0 || currentStep >= steps.length) {
        currentStep = 0;
    }

    SetupNavigationControls();
    LinkInputs();
    SetupCustomerAutofill();
    SetupMultiEntries();
    LoadFormDataFromLocal();
    ShowCurrentStep();

    if(!isDraft) {
        let text = exitBtn.querySelector("span");
        text.textContent = "Save and Exit";
    }
}

// #region Load remote

async function CheckReportId() {
    const id = mainContainer ? mainContainer.dataset.reportId : null;
    reportId = parseInt(id);
    if(reportId && reportId > 0) {
        const response = await fetch(`/api/JsonData/${reportId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();
        if (!response.ok) {
            alert("could not load report. Return to the home page."); //this will need to change in the future for better user experience
            window.location.href = "/SalesApp";
            return;
        }
        LoadDataIntoLocalStorage(result.data);
        isDraft = result.isDraft;
        localStorage.setItem("reportId", reportId);

        let meta = result.meta;
        if(meta !== null) {
            LoadMetaData(result.meta);
        }
    }
}

function LoadMetaData(meta) {
    LoadRejectReasons(meta["Reject_Reasons"], meta.Manager_Approval);
    LoadFiles(meta["connectedFileIds"]);
}

function LoadRejectReasons(reasons, approval) {
    if(approval !== "Rejected") {
        return;
    }

    AddGenericRejectionMessage(reasons);

    //other reasons for rejection
    Object.keys(reasons).filter(key => key !== "generic").forEach((key) => {
        const localStorageKey = `rejection_${key}`;
        const value = reasons[key];
        
        localStorage.setItem(localStorageKey, value);
    });
}

function AddGenericRejectionMessage(reasons) {
    const genericRejectMsgContainer = document.createElement("div");
    genericRejectMsgContainer.classList.add("report-reject-msg");

    let topMsg = "This report has been rejected. Look for red and fix the identified sections."
    if(reasons.generic && reasons.generic !== "") {
        topMsg += `\nResponse from your manager: "${reasons.generic}":`
    }

    genericRejectMsgContainer.textContent = topMsg;

    const form = document.getElementById("salesReport");

    mainContainer.insertBefore(genericRejectMsgContainer, form);
}

async function LoadFiles(fileIdsToLoad) {
    if(!fileIdsToLoad || fileIdsToLoad === null || fileIdsToLoad.length <= 0) {
        return;
    }

    const params = new URLSearchParams();
    for(const id of fileIdsToLoad) {
        params.append("id", id);
    }

    const response = await fetch(`/api/files/simple?${params}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const result = await response.json()
    SetFiles(result.files);
}

function LoadDataIntoLocalStorage(data) {
    for (const [key, value] of Object.entries(data)) {
        if(key === "date_visited") {
            const dateString = data.date_visited;
    
            const [month, day, year] = dateString.split("-");
    
            localStorage.setItem(`form_${key}`, `${year}-${month}-${day}`);
        } else if(value ==="on") {
            localStorage.setItem(`form_${key}`, "true");
        } else {
            localStorage.setItem(`form_${key}`, value);
        }
    }
}

// #region Event Listeners

function SetupNavigationControls() {
    back.classList.add("active");

    next.addEventListener("click", () => {
        // Validate current step before moving on
        if (!ValidateStep(steps[currentStep])) {
            return;
        }

        // Move forward if not on last step
        if (currentStep < steps.length - 1) {
            currentStep++;
            ShowCurrentStep();
        }

        SaveFormDataLocal();
    });

    back.addEventListener("click", () => {
        // Move backward if not on first step
        if (currentStep > 0) {
            currentStep--;
            ShowCurrentStep();
        }
        SaveFormDataLocal();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!ValidateStep(steps[currentStep])) {
            return;
        }

        try {
            const response = await SaveFinal(true);
            console.log(response);
            const data = await response.json();
            if (!response.ok) {
                alert("Could not submit form.\n" + data.error);
                return
            }
            localStorage.clear();
            window.location.href = "/SalesApp";
        } catch (error) {
            alert("Could not submit form.\n" + error.message);
        }
    });
}

function LinkInputs() {
    LinkRadioGroups();
    LinkCheckboxes();
}

function UpdateProgressBar() {
    const progressPercent = Math.round(
        ((currentStep + 1) / steps.length) * 100
    );

    progressBar.style.width = progressPercent + "%";
    progressPercentText.textContent = progressPercent + "%";
}

function ShowCurrentStep() {
    const steps = form.querySelectorAll(".form-step");
    steps.forEach(step => {
        step.classList.remove("active");
    });

    steps[currentStep].classList.add("active");

    back.classList.remove("invisible");
    next.classList.remove("active");
    submit.classList.remove("active");

    if(currentStep === 0) {
        back.classList.add("invisible");
        next.classList.add("active");
    } else if (currentStep === steps.length - 1) {
        submit.classList.add("active");
    } else {
        next.classList.add("active");
    }

    UpdateProgressBar();
}

function AddInputListeners() {
    form.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
            event.preventDefault();
        }
    });

    form.addEventListener("input", SaveFormDataLocal);
    form.addEventListener("input", SaveOnTimer);

    document.addEventListener("OnFileDeleted", () => {
        Save(false);
    });
}

// #region Customer Autofill

function SetupCustomerAutofill() {
    SetupAutoComplete({
        inputId: "customer_visited",
        suggestionsContainerId: "suggestionsContainer",
        fetchUrl: "/api/customers",
        renderSuggestions: RenderSuggestions,
        addedContainerId: "customerBox",
        maxEntries: 1
    })

    const container = document.getElementById("suggestionsContainer");
    container.addEventListener("mousedown", TryAddSelectedCustomer);

    const box = document.getElementById("customerBox");
    box.addEventListener("click", RemoveSelectedUser);
}

function RenderSuggestions(results) {
    const input = document.getElementById("customer_visited");
    if(document.activeElement !== input) {
        return;
    }
    const container = document.getElementById("suggestionsContainer");
    container.classList.add("show");
    
    PositionCustomersContainer(container);
    container.innerHTML = "";
    
    let suggestedUserTemplate = document.getElementById("suggestedCustomerTemplate");
    results.customers.forEach(customer => {
        const clone = suggestedUserTemplate.content.firstElementChild.cloneNode(true);
        clone.querySelector("#suggestionName").textContent = customer.name;
        clone.dataset.customerId = customer.id;
        container.append(clone);
    });
}

function PositionCustomersContainer(container) {
    const box = document.getElementById("customerBox");

    //position suggestions below the input
    const rect = box.getBoundingClientRect();
    container.style.top = rect.bottom + "px"
    container.style.left = rect.left + (rect.width / 2) + "px"

    container.style.width = rect.width + "px";
}

function RemoveSelectedUser(event) {
    const userEntry = event.target.closest(".selected-option svg");
    if(!userEntry) {
        return;
    }

    userEntry.parentElement.remove();
    formDirty = true;
    SaveFormDataLocal()
    SaveOnTimer();
}

function TryAddSelectedCustomer(event) {
    const customerEntry = event.target.closest(".suggestion-item");
    if(!customerEntry) {
        return;
    }

    event.preventDefault();
    AddSelectedCustomer({name: customerEntry.querySelector("#suggestionName").textContent, id: customerEntry.dataset.customerId})
    
    formDirty = true;
    SaveFormDataLocal()
    SaveOnTimer();
}

function AddSelectedCustomer(customer) {
    if(customer === null) {
        console.error("customer object cannot be null");
        return;
    }
    let box = document.getElementById("customerBox");
    let input = document.getElementById("customer_visited");
    let customerTemplate = document.getElementById("selectedCustomerTemplate");

    const clone = customerTemplate.content.firstElementChild.cloneNode(true);
    clone.querySelector("#name").textContent = customer.name;
    clone.dataset.storedValue = customer.id;

    box.insertBefore(clone, input);

    input.value = "";
    HideSuggestions("suggestionsContainer");
}

// #region Form Validation

// Validate only inputs in the current step
function ValidateStep() {
    const inputs = steps[currentStep].querySelectorAll("input, textarea, select");

    let valid = true;
    for (const input of inputs) {
        let requiredStatus = input.dataset.required;
        
        if(input.disabled || input.closest("[inert]")) {
            continue;
        }

        if(requiredStatus === "true" && !input.value) {
            input.setCustomValidity("This field is required.");
            input.reportValidity();
            valid = false;
            break;
        } else if (requiredStatus === "dependent" && !input.value) {
            let targetId = input.dataset.requiredTarget;
            let targetInput = document.getElementById(targetId);

            if(targetInput && (//targetInput exists
                (targetInput.type === "checkbox" && targetInput.checked) || // if input is checkbox and checked
                (targetInput.type === "radio" && targetInput.checked) || // if input is radio and checked
                (targetInput.type === "text" && targetInput.value))) { // if input is text and has text
                    input.setCustomValidity("This field is required.");
                    input.reportValidity();
                    valid = false;
                    break;
            }
        } else if (requiredStatus === "sibling") {
            let box = input.closest(".selected-option-box");
            let selected = box.querySelector(".selected-option");
            if(selected === null) {
                input.setCustomValidity("This field is required.");
                input.reportValidity();
                valid = false;
                break;
            }
        } else if (requiredStatus === "select-one" && !input.checked) {
            let targetIds = input.dataset.targetIds.split(",").map(id => id.trim());
            let hasValue = false;
            for (const targetId of targetIds) {
                if(document.getElementById(targetId).checked) {
                    hasValue = true;
                    break;
                }
            }

            if(!hasValue) {
                input.setCustomValidity("This field is required.");
                input.reportValidity();
                valid = false;
                break;
            }
        }

        input.setCustomValidity(""); // Clear any previous custom validity message
    }

    return valid;
}

// #region Local Storage Functions

function SaveFormDataLocal() {
    formDirty = true;
    const inputs = form.querySelectorAll("input, textarea, select");

    inputs.forEach(input => {
        if (!input.name) return;

        if (input.type === "checkbox") {
            localStorage.setItem(`form_${input.name}`, input.checked);
        } else if(input.type === "radio") {
            if (input.checked) {
                localStorage.setItem(`form_${input.name}`, input.value);
            }
        } else if(input.dataset.filled === "sibling") {
            let box = input.closest(".selected-option-box");
            let selected = box.querySelector(".selected-option");
            if(selected !== null) {
                localStorage.setItem(`form_${input.name}_${input.dataset.dataType}`, selected.dataset.storedValue);
            } else {
                localStorage.removeItem(`form_${input.name}_${input.dataset.dataType}`);
            }
        } else {
            localStorage.setItem(`form_${input.name}`, input.value);
        }
    });

    localStorage.setItem("currentFormStep", currentStep);
}

function LoadFormDataFromLocal() {
    const inputs = form.querySelectorAll("input, textarea, select");

    inputs.forEach(input => {
        let savedValue = localStorage.getItem(`form_${input.name}`);

        if (savedValue !== null) {
            formDirty = true;
            if (input.type === "checkbox") {
                input.checked = savedValue === "true";

                if(input.dataset.target && input.dataset.target !== null) {
                    let targetIds = input.dataset.target.split(",").map(id => id.trim());
                    UpdateLinkedElements(targetIds, input.checked);
                }
            } else if(input.type === "radio") {
                input.checked = input.value === savedValue;

                if(input.dataset.target !== null && input.dataset.target !== undefined) {
                    let targetIds = input.dataset.target.split(",").map(id => id.trim());
                    UpdateLinkedElements(targetIds, input.checked);
                }
            } else if(input.type === "file") {
                // noop, this is handled elsewhere. We just cant have this function do anything
            } else {
                
                input.value = savedValue;
            }
        } else if(input.dataset.filled === "sibling") {
            let box = input.closest(".selected-option-box");
            savedValue = localStorage.getItem(`form_${input.name}_${input.dataset.dataType}`);
            if(savedValue !== null) {
                LoadCustomer(savedValue) // this is a one, hopefully, so that is why Im am just calling this out straight. if more of this type of loading is necessary then from here on needs changed.
            }
        }

        CheckRejection(input);
    });
}

function CheckRejection(input) {
    let savedValue;
    let storageKey = `rejection_${input.name}`;

    if(groupInputRejectionMapping[input.name]) {
        storageKey = `rejection_${groupInputRejectionMapping[input.name]}`;
    } else if(input.closest(".multi-entry-container") !== null) {
        const multi = input.closest(".multi-entry-container")
        storageKey = `rejection_${groupInputRejectionMapping[`${multi.id}_multi`]}`;
    }

    savedValue = localStorage.getItem(storageKey);
    
    if(savedValue !== null) {
        if (input.type === "checkbox") {
            const label = document.getElementById(`${groupInputRejectionMapping[input.name]}_label`)
            if(label !== null) {
                AddCriticism(label, savedValue);
            }
        } else if(input.type === "radio") {
            const label = document.getElementById(`${input.name}_label`)
            if(label !== null) {
                AddCriticism(label, savedValue);
            }
        } else if(input.type === "file") {
            // noop, this is handled elsewhere. We just cant have this function do anything
        } else if (input.dataset.filled === "sibling") {
            const desiredElement = input.closest(".selected-option-box");
            desiredElement.classList.add("reject-bg");
            AddCriticism(input.labels[0], savedValue);
        } else if (input.closest(".multi-entry-container") !== null) {
            const multi = input.closest(".multi-entry-container");
            const label = document.getElementById(`${groupInputRejectionMapping[`${multi.id}_multi`]}_label`)
            if(label !== null) {
                AddCriticism(label, savedValue);
            }
        } else {
            input.classList.add("reject-bg");
            AddCriticism(input.labels[0], savedValue);
        }
    }
}

function AddCriticism(label, text) {
    if (label.querySelector(".report-criticism") !== null) {
        return;
    }

    const span = document.createElement("span");
    span.classList.add("report-criticism");
    span.textContent = `${text}`;

    label.append(span);
}

async function LoadCustomer(customer_id) {
    if(customer_id < 0 || customer_id === null) {
        return;
    }
    const response = await fetch(`/api/customers/${Number(customer_id)}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if(!response.ok) {
        console.error("Could not load customer");
        return;
    }

    let result = await response.json();
    AddSelectedCustomer({name:result.customer.name, id: result.customer.id})
}

//#region Exit and Saving logic

async function Exit() {
    try {
        clearTimeout(saveTimer);

        if(await !CheckIfEmptyAndDelete()){
            //if not empty, save it
            const response = await Save(false);

            if (!response.ok) {
                throw new Error("Save failed");
            }
        }

        formDirty = false;
        localStorage.clear();
        window.location.href = "/SalesApp/Home"
    } catch (error) {
        alert("Could not save.\n" + error.message);
    }
}

function GetFormData() {
    let datum = Object.fromEntries(new FormData(form).entries().filter(([key, value]) => value !== null && value !== "" && !(value instanceof File)));
    if(localStorage.getItem("form_customer_visited_id") !== null) {
        datum["customer_visited_id"] = localStorage.getItem("form_customer_visited_id");
    }
    return datum;
}

async function CheckIfEmptyAndDelete() {
    // check to see if the user has left while the form is empty. this should only run if the user added something to the form, deleted it, then left.
    // need to check if it is in fact empty, and delete the entry in the database if it is
    if(reportId === null) { // if there is no report id, then we never saved it so there shouldn't be anything to delete
        return false;
    }
    let keys = Object.keys(GetFormData());
    if(keys.length === 1 && keys[0] === "date_of_visit") {
        const response = await fetch(`/api/JsonData/${reportId}/delete`, {
            method: "DELETE"
        });

        const result = await response.json();
        return result.ok;
    }
    return false;
}

function SaveOnTimer() {
    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        Save(false);
    }, 800);
}

export function Save(submitted) {
    if(isDraft) {
        return SaveDraft();
    } else {
        return SaveFinal(submitted);
    }
}

async function SaveDraft() {
    if (!formDirty) {
        return Promise.resolve({ ok: true });
    }

    let response = null;
    if(reportId !== null && reportId > 0) {
        response = await SaveJson(`/SalesApp/NewReport/save-draft/${reportId}`);
    } else {
        response = await SaveJson("/SalesApp/NewReport/save-draft");

        const result = await response.json();
        if (response.ok) {
            reportId = Number(result.report_id);
            localStorage.setItem("reportId", reportId);
        }
    }
    formDirty = false;
    return response;
}

async function SaveFinal(submitted) {
    const files = GetFiles();
    const filesToAdd = files.filter(file => !file.uploaded).map(f => f.file);
    const filesAlreadyAdded = files.filter(file => file.uploaded).map(f => f.file);

    let response = null;
    let meta = {"connectedFileIds": []};
    if(filesToAdd.length > 0) {
        response = await SaveFiles("/api/files/upload", filesToAdd);
        if(!response.ok) {
            alert("Could not upload files. Please try again.")
            return;
        }

        let result = await response.json();
        meta = {"connectedFileIds": result["fileIds"]};
    }

    meta.connectedFileIds = meta.connectedFileIds.concat(filesAlreadyAdded.map(f => f.id));

    if(reportId !== null && reportId > 0) {
        response = await SaveJson(`/SalesApp/NewReport/save-final/${reportId}`, meta, submitted);
    } else { // this should rarely happen but as a safeguard its here
        response = await SaveJson("/SalesApp/NewReport/save-final", meta, submitted);
    }

    formDirty = false;
    return response;
}

async function SaveJson(targetUrl, meta = null, submitted = false) {
    let body = { form: GetFormData()}
    if(meta !== null){
        body.meta = meta;
    }
    body.submitted = submitted
    
    let response = await fetch(targetUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)

    });

    console.log(response);

    return response;
}

async function SaveFiles(targetUrl, files) {
    let data = new FormData();
    for(const file of files) {
        data.append("files", file);
    }

    const response = await fetch(targetUrl, {
        method: "POST",
        body: data,
    });

    return response;
}

//#region Linking Logic

function LinkCheckboxes() {
    document.querySelectorAll(".linked-checkbox").forEach(checkbox => {
        let targetIds = checkbox.dataset.target.split(",").map(id => id.trim());

        function updateTargets() {
            targetIds.forEach(targetId => {
                let element = document.getElementById(targetId);
                if (!element) return;
                ToggleElement(element, checkbox.checked);
            });
        }
        checkbox.addEventListener("change", updateTargets);
        updateTargets();
    });
}

function LinkRadioGroups() {
    document.querySelectorAll(".linked-radio-controller").forEach(radioGroup => {
        radioGroup.addEventListener("change", updateTargetEvent);

        function updateTargetEvent(event) {
            let selectedRadio = event.target;
            
            updateTarget(selectedRadio.closest(".linked-radio-controller"));
            SaveFormDataLocal();
        }

        function updateTarget(radioGroup) {
            let radios = radioGroup.querySelectorAll("input[type='radio']");
            let linkedElements = [];
            radios.forEach(radio => {
                let targetIds = radio.dataset.target.split(",").map(id => id.trim());
                targetIds.forEach(targetId => {
                    let element = document.getElementById(targetId);
                    if (!element) return;
                    
                    if(element.classList.contains("linked-checkbox")) {
                        linkedElements.push(...element.dataset.target.split(",").map(id => id.trim()));
                    }

                    if(linkedElements.includes(element.id)) {
                        return;
                    }
                    ToggleElement(element, radio.checked);
                });
            });
        }
        updateTarget(radioGroup);
    });
}



function UpdateLinkedElements(targetIds, onOff) {
    targetIds.forEach(targetId => {
        let element = document.getElementById(targetId);
        ToggleElement(element, onOff);
    });
}

function ToggleElement(element, onOff) {
    if(element == null) return;

    // console.log(onOff);

    if(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.disabled = !onOff;

        if(element.type === "checkbox" || element.type === "radio") {
            element.checked = false;
        } else {
            if (onOff) {
                element.value = "";
            }
        }

        element.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    } else if(element.classList.contains("multi-entry-container")) {
        if(onOff) {
            element.classList.remove("disabled");
        } else {
            element.classList.add("disabled");
        }
        element.inert = !onOff;
        element.disabled = !onOff;
    } else {
        if(onOff) {
            element.classList.remove("disabled");
        } else {
            element.classList.add("disabled");
        }
    }
}

//#endregion
//#region Multi Entries

function SetupMultiEntries() {
    const multiEntriesElements = document.querySelectorAll(".multi-entry-container");

    function RemoveMultiEntry(multi, btn) {
        console.log(multiEntries);
        const index = btn.closest(".multi-entry").dataset.index;

        multiEntries[multi.id][index].remove();
        multiEntries[multi.id].splice(index, 1);

        const numEntries = multiEntries[multi.id].length;

        if(multiEntries[multi.id].length <= 0) {
            const entryTemplate = document.getElementById(multi.dataset.entryTemplate);
            CreateEntry(multi, entryTemplate);
        }

        let cntr = 0;
        multiEntries[multi.id].forEach((entry) => {
            entry.id = multi.id + "_" + cntr;
            entry.dataset.index = cntr;

            const inputs = entry.querySelectorAll("input");

            inputs.forEach((input) => {
                const parent = input.parentElement;
                const label = parent.querySelector("label");

                let inputName = multi.dataset.inputPrefix +"_" + label.textContent.replace(/[: ]/g, "_") + cntr;
                input.name = inputName;
                input.id = inputName;
                label.htmlFor = inputName;

                input.dataset.required = multi.dataset.alwaysRequired ? multi.dataset.alwaysRequired === "true" : numEntries > 1;
            });

            cntr ++;
        })
    }

    function CreateEntry(multi, template) {
        const clone = template.content.firstElementChild.cloneNode(true);
        const numEntries = multiEntries[multi.id].length;
        clone.id = multi.id + "_" + numEntries;
        clone.dataset.index = numEntries;

        let inputs = clone.querySelectorAll("input");

        inputs.forEach((input) => {
            const parent = input.parentElement;
            const label = parent.querySelector("label");

            let inputName = multi.dataset.inputPrefix +"_" + label.textContent.replace(/[: ]/g, "_").toLowerCase() + numEntries;
            input.name = inputName;
            input.id = inputName;
            label.htmlFor = inputName;
        });

        const addBtn = multi.querySelector(".add-entry");
        multi.insertBefore(clone, addBtn);

        const removeBtn = clone.querySelector(".remove-entry");
        removeBtn.addEventListener("click", () => RemoveMultiEntry(multi, removeBtn));

        multiEntries[multi.id].push(clone);

        //update requiredness
        inputs = multi.querySelectorAll("input");
        inputs.forEach((input) => {
            input.dataset.required = multi.dataset.alwaysRequired ? multi.dataset.alwaysRequired === "true" : numEntries > 0;
        });
    }

    multiEntriesElements.forEach((multi) => {
        multiEntries[multi.id] = [];
        const entryTemplate = document.getElementById(multi.dataset.entryTemplate);

        let largest = Math.max(0, ...Object.keys(localStorage)
                .filter(key => key.includes(multi.dataset.inputPrefix))
                .map(str => str.match(/_(\d+)$/))
                .filter(match => match !== null)
                .map(match => Number(match[1]))
        );

        for (let i = 0; i <= largest; i++) {
            CreateEntry(multi, entryTemplate);
        }

        const addBtn = multi.querySelector(".add-entry");
        addBtn.addEventListener("click", () => CreateEntry(multi, entryTemplate));
    });
}