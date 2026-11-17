"""Stage movable files from the published GitHub Pages artifact."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile


PREVIEW = re.compile(r"models/previews/([a-z0-9/-]+)/preview\.glb")
FIRST_VIEW = re.compile(r"models/first-views/([a-z0-9/-]+)/first-([0-9a-f]{12})\.glb")
JPEG = re.compile(r"previews/renders/([a-z0-9/-]+)/thumb\.jpg")
IMAGE_TAG = re.compile(rb"<(?:img|source|video|link)\b[^>]*>", re.I)
JPEG_URL = re.compile(rb"previews/renders/[a-z0-9/-]+/thumb\.jpg", re.I)


def stage(archive, release, active_first_views, output):
    entries = []
    output.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:") as pages:
        files = {}
        for item in pages:
            if item.isfile():
                key = item.name.removeprefix("./")
                if key in files or PurePosixPath(key).is_absolute() or ".." in PurePosixPath(key).parts:
                    raise ValueError(f"Invalid archive member: {key}")
                files[key] = item
        if sum(item.size for item in files.values()) != release["fileBytes"]:
            raise ValueError("The package size does not match the pinned release")
        image_references = set()
        for key, item in files.items():
            if key.endswith((".html", ".css")):
                data = pages.extractfile(item).read()
                tags = IMAGE_TAG.findall(data) if key.endswith(".html") else [data]
                for tag in tags:
                    image_references.update(match.decode() for match in JPEG_URL.findall(tag))

        first_views = {
            entry["firstView"]["url"].removeprefix("/"): entry["firstView"]
            for entry in active_first_views.values()
        }
        retained = []
        for key, item in files.items():
            preview = PREVIEW.fullmatch(key)
            first = FIRST_VIEW.fullmatch(key)
            jpeg = JPEG.fullmatch(key)
            if not (preview or first or jpeg):
                if key.lower().endswith((".glb", ".gltf", ".usdz")):
                    raise ValueError(f"Unclassified model: {key}")
                continue
            if jpeg and (key in image_references or key[:-4] + ".webp" not in files):
                retained.append(key)
                continue

            data = pages.extractfile(item).read()
            digest = hashlib.sha256(data).hexdigest()
            if preview:
                kind = "preview"
                destination = f"models/previews/{preview[1]}/preview-{digest[:12]}.glb"
            elif first:
                kind = "firstView"
                expected = first_views.get(key)
                if not expected or expected["sha256"] != digest or expected["bytes"] != len(data):
                    raise ValueError(f"The first view does not match its release record: {key}")
                destination = key
            else:
                kind = "jpeg"
                destination = f"previews/renders/{jpeg[1]}/thumb-{digest[:12]}.jpg"

            path = output / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            entries.append({
                "kind": kind,
                "pagesPath": key,
                "key": destination,
                "bytes": len(data),
                "sha256": digest,
            })

    counts = Counter(row["kind"] for row in entries)
    if counts != release["copyCounts"] or len(first_views) != counts["firstView"]:
        raise ValueError(f"Archive contents differ from the pinned inventory: {dict(counts)}")
    if len(set(row["key"] for row in entries)) != len(entries):
        raise ValueError("Destination keys are not unique")
    entries.sort(key=lambda row: (row["kind"] != "firstView", row["kind"] != "jpeg", row["key"]))
    report = {
        "release": release,
        "retainedJpegs": sorted(retained),
        "objectCount": len(entries),
        "objectBytes": sum(row["bytes"] for row in entries),
        "entries": entries,
    }
    (output / "inventory.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f'Staged {report["objectCount"]} objects ({report["objectBytes"]:,} bytes). '
          f'Kept {len(retained)} JPEGs on Pages.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("release", type=Path)
    parser.add_argument("first_views", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    release = json.loads(args.release.read_text())
    if args.archive.stat().st_size != release["tarBytes"]:
        raise ValueError("The archive size does not match the pinned release")
    stage(args.archive, release, json.loads(args.first_views.read_text()), args.output)
