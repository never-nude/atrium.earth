#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

import trimesh

DEFAULT_SOURCE = Path(os.environ.get("SOURCE_ATRIUM_DIR", "/Users/michael/Projects/_active/atrium"))
FEATURED_SLUGS = [
    "michelangelo/david",
    "discobolus",
    "venus-de-milo",
    "laocoon",
    "apollo-belvedere",
    "dying-gaul",
    "michelangelo/bacchus",
    "michelangelo/moses",
    "rodin/the-thinker",
    "capitoline-venus",
    "athena-lemnia",
    "germanicus",
]
SOURCE_OVERRIDES = {
    "michelangelo/david": "michelangelo/david/david_source.stl",
    "americas/stirrup-spout-bottle-mountain-sacrifice-met": "americas/stirrup-spout-bottle-mountain-sacrifice-met/stirrup-spout-bottle-mountain-sacrifice-met_preview.glb",
    "asia/brazier-of-rasulid-sultan-met": "asia/brazier-of-rasulid-sultan-met/brazier-of-rasulid-sultan-met_preview.glb",
    "asia/tile-panel-architectural-niche-met": "asia/tile-panel-architectural-niche-met/tile-panel-architectural-niche-met_preview.glb",
    "egyptian/sarcophagus-of-harkhebit-met": "egyptian/sarcophagus-of-harkhebit-met/sarcophagus-of-harkhebit-met_preview.glb",
    "neoclassical/model-of-the-greek-slave-smithsonian": "neoclassical/model-of-the-greek-slave-smithsonian/greek-slave-smithsonian_preview.glb",
    "baroque/apollo-and-daphne-soldani-after-bernini-cma": "baroque/apollo-and-daphne-soldani-after-bernini-cma/apollo-and-daphne-soldani-after-bernini-cma_preview.glb",
    "baroque/bust-of-louis-xiv-bernini-versailles": "baroque/bust-of-louis-xiv-bernini-versailles/bust-of-louis-xiv-bernini-versailles_preview.glb",
}
DIRECT_COPY_PREVIEWS = {
    "americas/atingting-kon-slit-gong",
    "americas/key-marco-cat",
    "americas/stirrup-spout-bottle-mountain-sacrifice-met",
    "ancestor-figure-sawos",
    "asia/cosmic-buddha",
    "asia/brazier-of-rasulid-sultan-met",
    "asia/tile-panel-architectural-niche-met",
    "asia/ritual-wine-container-fangyi-smithsonian",
    "baroque/anima-dannata-bernini-objaverse",
    "baroque/apollo-and-daphne-soldani-after-bernini-cma",
    "baroque/bust-of-louis-xiv-bernini-versailles",
    "baroque/elephant-and-obelisk-bernini-ferrata-nardese",
    "limestone-head-of-a-bearded-man",
    "neoclassical/model-of-the-greek-slave-smithsonian",
    "sub-saharan-africa/kongo-maternity-figure",
    "sub-saharan-africa/sapi-portuguese-hunting-horn",
    "sub-saharan-africa/seated-figure-middle-niger",
}


def load_catalog(repo_root: Path):
    return json.loads((repo_root / "src/data/catalog.json").read_text())


def as_mesh(loaded):
    if isinstance(loaded, trimesh.Scene):
        meshes = [
            geom
            for geom in loaded.geometry.values()
            if isinstance(geom, trimesh.Trimesh) and len(geom.faces)
        ]
        if not meshes:
            raise ValueError("scene contains no mesh geometry")
        return trimesh.util.concatenate(meshes)
    if isinstance(loaded, trimesh.Trimesh):
        return loaded
    raise ValueError(f"unsupported loaded type: {type(loaded)}")


def simplify(mesh, target_faces: int):
    mesh.remove_unreferenced_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.merge_vertices()
    if len(mesh.faces) <= target_faces:
        return mesh
    return mesh.simplify_quadric_decimation(face_count=target_faces)


def collect_manifest(repo_root: Path, catalog_by_slug):
    preview_root = repo_root / "public/models/previews"
    manifest = {}
    if not preview_root.exists():
        return manifest

    for file_path in preview_root.glob("**/preview.glb"):
        slug = str(file_path.relative_to(preview_root).parent)
        work = catalog_by_slug.get(slug)
        if not work:
            continue
        meta_path = file_path.with_suffix(".json")
        meta = {}
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
        manifest[slug] = {
            "url": f"/models/previews/{slug}/preview.glb",
            "bytes": file_path.stat().st_size,
            "sourceBytes": meta.get("sourceBytes", work["model"]["sizeBytes"]),
            "sourceFormat": work["model"]["format"],
            "faces": meta.get("faces"),
            "sourceFaces": meta.get("sourceFaces"),
        }
    return manifest


def optimize_glb(source_path: Path, output_path: Path, repo_root: Path, source_faces: int, target_faces: int):
    executable = repo_root / "node_modules" / ".bin" / "gltf-transform"
    if not executable.exists():
        raise FileNotFoundError(f"GLB optimizer missing: {executable}; run npm install")

    simplify_ratio = min(1.0, target_faces / source_faces) if source_faces else 1.0
    converted_path = output_path.with_name("preview-metalrough.glb")
    try:
        # Some Sketchfab downloads still use the deprecated spec/gloss extension,
        # which current Three.js loaders no longer render. Normalize materials before
        # simplification so the public preview keeps its diffuse texture.
        subprocess.run(
            [str(executable), "metalrough", str(source_path), str(converted_path)],
            check=True,
        )
        subprocess.run(
            [
                str(executable),
                "optimize",
                str(converted_path),
                str(output_path),
                "--compress",
                "draco",
                "--texture-compress",
                "webp",
                "--texture-size",
                "2048",
                "--simplify",
                "true",
                "--simplify-ratio",
                str(simplify_ratio),
                "--simplify-error",
                "0.005",
            ],
            check=True,
        )
    finally:
        converted_path.unlink(missing_ok=True)


def inspect_glb_faces(output_path: Path, repo_root: Path):
    executable = repo_root / "node_modules" / ".bin" / "gltf-transform"
    result = subprocess.run(
        [str(executable), "inspect", str(output_path), "--format", "csv"],
        check=True,
        capture_output=True,
        text=True,
    )
    total = 0
    in_meshes = False
    for line in result.stdout.splitlines():
        if line == " MESHES":
            in_meshes = True
            continue
        if in_meshes and line == " MATERIALS":
            break
        if in_meshes and line[:1].isdigit():
            columns = line.split(",")
            if len(columns) > 4 and columns[2] == "TRIANGLES":
                total += int(columns[4])
    if total <= 0:
        raise ValueError(f"optimizer reported no triangles for {output_path}")
    return total


def export_preview(work, source_root: Path, repo_root: Path, target_faces: int, optimize_source_glb: bool):
    source_rel = SOURCE_OVERRIDES.get(work["slug"], work["model"]["sourcePath"])
    source_path = source_root / source_rel
    output_dir = repo_root / "public/models/previews" / work["slug"]
    output_path = output_dir / "preview.glb"
    meta_path = output_dir / "preview.json"

    if not source_path.exists():
        raise FileNotFoundError(source_path)

    output_dir.mkdir(parents=True, exist_ok=True)
    if source_path.suffix.lower() == ".glb" and work["slug"] in DIRECT_COPY_PREVIEWS:
        source_faces = inspect_glb_faces(source_path, repo_root)
        shutil.copyfile(source_path, output_path)
        meta_path.write_text(
            json.dumps(
                {
                    "slug": work["slug"],
                    "source": source_rel,
                    "sourceBytes": source_path.stat().st_size,
                    "sourceFaces": source_faces,
                    "faces": source_faces,
                    "targetFaces": source_faces,
                    "directCopy": True,
                },
                indent=2,
            )
            + "\n"
        )
        return output_path

    force = "scene" if source_path.suffix.lower() in [".glb", ".gltf"] else "mesh"
    loaded = trimesh.load(source_path, force=force)
    mesh = as_mesh(loaded)
    source_faces = int(len(mesh.faces))

    if source_path.suffix.lower() == ".glb" and optimize_source_glb:
        optimize_glb(source_path, output_path, repo_root, source_faces, target_faces)
        output_faces = inspect_glb_faces(output_path, repo_root)
        meta_path.write_text(
            json.dumps(
                {
                    "slug": work["slug"],
                    "source": source_rel,
                    "sourceBytes": source_path.stat().st_size,
                    "sourceFaces": source_faces,
                    "faces": output_faces,
                    "targetFaces": target_faces,
                    "optimizer": "@gltf-transform/cli",
                    "materialWorkflow": "metallic-roughness",
                    "geometryCompression": "draco",
                    "textureFormat": "webp",
                    "textureMaxSize": 2048,
                },
                indent=2,
            )
            + "\n"
        )
        return output_path

    if source_path.suffix.lower() == ".glb" or work["slug"] in DIRECT_COPY_PREVIEWS:
        shutil.copyfile(source_path, output_path)
        meta_path.write_text(
            json.dumps(
                {
                    "slug": work["slug"],
                    "source": source_rel,
                    "sourceBytes": source_path.stat().st_size,
                    "sourceFaces": source_faces,
                    "faces": source_faces,
                    "targetFaces": source_faces,
                    "directCopy": True,
                },
                indent=2,
            )
            + "\n"
        )
        return output_path

    preview = simplify(mesh, target_faces)
    preview.export(output_path, file_type="glb")
    meta_path.write_text(
        json.dumps(
            {
                "slug": work["slug"],
                "source": source_rel,
                "sourceBytes": source_path.stat().st_size,
                "sourceFaces": source_faces,
                "faces": int(len(preview.faces)),
                "targetFaces": target_faces,
            },
            indent=2,
        )
        + "\n"
    )
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate low-poly GLB previews from the atrium source scans.")
    parser.add_argument("--source", type=Path, default=Path(os.environ.get("SOURCE_ATRIUM_DIR", DEFAULT_SOURCE)))
    parser.add_argument("--limit", type=int, default=12)
    # ~400k faces lands previews near the ~20 MB sweet spot (was 14k, which
    # over-decimated meshes into low quality and shattered imperfect sources).
    parser.add_argument("--target-faces", type=int, default=400000)
    parser.add_argument("--slug", action="append", default=[])
    parser.add_argument(
        "--optimize-source-glb",
        action="store_true",
        help="Use glTF Transform to simplify and compress selected GLB sources instead of copying them verbatim.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    catalog = load_catalog(repo_root)
    catalog_by_slug = {work["slug"]: work for work in catalog}

    selected_slugs = []
    for slug in args.slug or FEATURED_SLUGS:
        if slug in catalog_by_slug and slug not in selected_slugs:
            selected_slugs.append(slug)
    for work in catalog:
        if len(selected_slugs) >= args.limit:
            break
        if work["slug"] not in selected_slugs:
            selected_slugs.append(work["slug"])

    for slug in selected_slugs:
        work = catalog_by_slug[slug]
        try:
            output = export_preview(work, args.source, repo_root, args.target_faces, args.optimize_source_glb)
            print(f"{slug}: {output.relative_to(repo_root)}")
        except Exception as error:
            print(f"{slug}: skipped ({error})")

    manifest = collect_manifest(repo_root, catalog_by_slug)
    (repo_root / "src/data/previews.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(manifest)} preview records")


if __name__ == "__main__":
    main()
