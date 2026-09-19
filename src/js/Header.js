document.addEventListener("DOMContentLoaded", () => {
	const header = document.querySelector(".header");
	const overlay = document.getElementById("overlay");
    LinkNavOptions(header, overlay);
	LoadUserProfile();
});

function LinkNavOptions(header, overlay) {
	const navOptions = document.querySelectorAll(".nav-option");
	navOptions.forEach((option) => {
		const menuId = option.dataset.menu;
		const menu = document.getElementById(menuId);
		if (!menu) return;
		menu.style.top = header.offsetHeight + "px";
		option.addEventListener("click", function (event) {
			event.stopPropagation();
			menu.classList.toggle("show");
			overlay.classList.toggle("show");

			overlay.addEventListener("click", function () {
				menu.classList.remove("show");
				overlay.classList.remove("show");
			});
		});
	});
}

async function LoadUserProfile() {
	const response = await fetch(`/api/user`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
    });

	const result = await response.json();

	const headerUserName = document.getElementById("headerUserName");
	if(result.full_name !== null) {
		headerUserName.textContent = result.full_name;
	} else {
		headerUserName.textContent = result.first_name + " " + result.last_name;
	}

	let headerUserMenu = headerUserName.closest(".header-menu-container");
	headerUserMenu.style.right = "0px";
}

