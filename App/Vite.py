import json
from functools import lru_cache
from pathlib import Path

from flask import current_app, url_for
from markupsafe import Markup

@lru_cache(maxsize=1)
def _LoadManifest(manifest_path: str) -> dict:
    path = Path(manifest_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Vite manifest was not found at '{path}'. "
            "Run 'npm run build' before starting Flask in production."
        )

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)

def ViteClient() -> Markup:
    if not current_app.debug:
        return Markup("")

    return Markup(
        '<script type="module" '
        'src="http://localhost:5173/@vite/client"></script>'
    )

def ViteAsset(entry:str ) -> Markup:
    if current_app.debug:
        viteOrigin = "http://localhost:5173"
        return Markup(f'<script type="module" src="{viteOrigin}/src/{entry}"></script>')
    
    manifestPath = Path(
        str(current_app.static_folder),
        "js",
        "dist",
        ".vite",
        "manifest.json" 
        )
    manifest = _LoadManifest(str(manifestPath))

    if entry not in manifest:
        available_entries = ", ".join(manifest.keys())

        raise KeyError(
            f"Vite entry '{entry}' was not found in the manifest. "
            f"Available entries: {available_entries}"
        )
    
    chunk = manifest[entry]
    tags: list[str] = []

    for css_file in chunk.get("css", []):
        css_url = url_for(
            "static",
            filename=f"dist/{css_file}",
        )
        tags.append(
            f'<link rel="stylesheet" href="{css_url}">'
        )

    script_url = url_for(
        "static",
        filename=f"dist/{chunk['file']}",
    )
    tags.append(
        f'<script type="module" src="{script_url}"></script>'
    )

    return Markup("\n".join(tags))