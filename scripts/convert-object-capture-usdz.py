#!/usr/bin/env python3
"""Convert a single-mesh RealityKit Object Capture USDZ into a self-contained GLB.

Lossless for geometry: every triangle, point, vertex normal and UV is copied
unchanged except for (a) an optional uniform scale about the ground-centre and
(b) the V flip required by glTF's top-left texture origin. Texture files are
embedded byte-for-byte (PNG). UsdPreviewSurface -> glTF metallic-roughness:
diffuseColor -> baseColorTexture, normal -> normalTexture, occlusion ->
occlusionTexture, roughness -> roughnessFactor, metallic (default 0) ->
metallicFactor.

usage: scripts/convert-object-capture-usdz.py in.usdz out.glb [--height-m H] [--report report.json]
"""
import argparse, hashlib, io, json, struct, sys, zipfile
import numpy as np
from pxr import Usd, UsdGeom, UsdShade, Gf

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--height-m', type=float, default=None)
ap.add_argument('--report', default=None)
args = ap.parse_args()

stage = Usd.Stage.Open(args.src)
assert UsdGeom.GetStageUpAxis(stage) == 'Y', 'expected Y-up stage'
meshes = [p for p in stage.Traverse() if p.IsA(UsdGeom.Mesh)]
assert len(meshes) == 1, f'expected one mesh, found {len(meshes)}'
prim = meshes[0]
mesh = UsdGeom.Mesh(prim)
world = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
assert Gf.IsClose(world, Gf.Matrix4d(1), 1e-12), 'non-identity mesh transform not handled'
assert (mesh.GetOrientationAttr().Get() or 'rightHanded') == 'rightHanded'

points = np.asarray(mesh.GetPointsAttr().Get(), dtype=np.float32)
normals = np.asarray(mesh.GetNormalsAttr().Get(), dtype=np.float32)
assert mesh.GetNormalsInterpolation() == 'vertex' and len(normals) == len(points)
counts = np.asarray(mesh.GetFaceVertexCountsAttr().Get())
assert (counts == 3).all(), 'triangles only'
fvi = np.asarray(mesh.GetFaceVertexIndicesAttr().Get(), dtype=np.int64)
st_pv = UsdGeom.PrimvarsAPI(mesh).GetPrimvar('st')
assert st_pv.GetInterpolation() == 'faceVarying'
st = np.asarray(st_pv.Get(), dtype=np.float32)
st_idx = np.asarray(st_pv.GetIndices(), dtype=np.int64) if st_pv.IsIndexed() else np.arange(len(fvi))
assert len(st_idx) == len(fvi)

# Unique (point, uv) corners -> glTF vertices; preserves every face exactly.
keys = fvi * (len(st) + 1) + st_idx
uniq, first, inverse = np.unique(keys, return_index=True, return_inverse=True)
v_point = fvi[first]; v_st = st_idx[first]
pos = points[v_point].copy()
nrm = normals[v_point].copy()
uv = st[v_st].copy(); uv[:, 1] = 1.0 - uv[:, 1]
indices = inverse.astype(np.uint32)

src_min, src_max = points.min(0), points.max(0)
scale = 1.0
if args.height_m:
    scale = args.height_m / float(src_max[1] - src_min[1])
    # scale about the ground-plane origin (x/z centred at 0 in Object Capture output)
    pos = (pos * np.float32(scale)).astype(np.float32)
nl = np.linalg.norm(nrm, axis=1, keepdims=True); nl[nl == 0] = 1
nrm = (nrm / nl).astype(np.float32)

# Material
mat = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
surf = mat.ComputeSurfaceSource()[0]
assert surf.GetIdAttr().Get() == 'UsdPreviewSurface'
def tex_path(inp):
    i = surf.GetInput(inp)
    if not i or not i.HasConnectedSource(): return None
    t = UsdShade.Shader(i.GetConnectedSources()[0][0].source.GetPrim())
    f = t.GetInput('file').Get()
    return f.path
def const(inp, default):
    i = surf.GetInput(inp)
    if i and not i.HasConnectedSource() and i.Get() is not None: return float(i.Get())
    return default
zf = zipfile.ZipFile(args.src)
images = {}
for slot in ('diffuseColor', 'normal', 'occlusion'):
    p = tex_path(slot)
    if p: images[slot] = (p, zf.read(p))
roughness = const('roughness', 0.5); metallic = const('metallic', 0.0)

# Build GLB
bin_parts = []; views = []; accessors = []
def add_view(data, target=None):
    off = sum(len(b) for b in bin_parts)
    pad = (-off) % 4
    if pad: bin_parts.append(b'\0' * pad); off += pad
    bin_parts.append(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(arr, ctype, typ, target, minmax=False):
    view = add_view(arr.tobytes(), target)
    a = {'bufferView': view, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accessors.append(a); return len(accessors) - 1
POS = add_acc(pos, 5126, 'VEC3', 34962, True)
NOR = add_acc(nrm, 5126, 'VEC3', 34962)
UV = add_acc(uv, 5126, 'VEC2', 34962)
IDX = add_acc(indices, 5125, 'SCALAR', 34963)
gl_images = []; textures = []
tex_index = {}
for slot, (p, data) in images.items():
    view = add_view(data)
    gl_images.append({'bufferView': view, 'mimeType': 'image/png'})
    textures.append({'sampler': 0, 'source': len(gl_images) - 1})
    tex_index[slot] = len(textures) - 1
material = {'pbrMetallicRoughness': {'metallicFactor': metallic, 'roughnessFactor': roughness}}
if 'diffuseColor' in tex_index: material['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index['diffuseColor']}
if 'normal' in tex_index: material['normalTexture'] = {'index': tex_index['normal']}
if 'occlusion' in tex_index: material['occlusionTexture'] = {'index': tex_index['occlusion']}
binary = b''.join(bin_parts); binary += b'\0' * ((-len(binary)) % 4)
gltf = {
    'asset': {'version': '2.0', 'generator': 'atrium usdz_to_glb.py (pxr)'},
    'scene': 0, 'scenes': [{'name': 'Scene', 'nodes': [0]}],
    'nodes': [{'name': 'ObjectCapture', 'mesh': 0}],
    'meshes': [{'name': 'Mesh', 'primitives': [{'attributes': {'POSITION': POS, 'NORMAL': NOR, 'TEXCOORD_0': UV}, 'indices': IDX, 'material': 0, 'mode': 4}]}],
    'materials': [material],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
    'textures': textures, 'images': gl_images,
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binary)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
open(args.out, 'wb').write(out)

report = {
    'source_sha256': hashlib.sha256(open(args.src, 'rb').read()).hexdigest(),
    'glb_sha256': hashlib.sha256(out).hexdigest(), 'glb_bytes': len(out),
    'triangles': int(len(fvi) // 3), 'source_points': int(len(points)), 'glb_vertices': int(len(pos)),
    'source_bbox_m': [src_min.tolist(), src_max.tolist()],
    'uniform_scale': scale, 'glb_bbox_m': [pos.min(0).tolist(), pos.max(0).tolist()],
    'glb_size_m': (pos.max(0) - pos.min(0)).tolist(),
    'material': {'roughness': roughness, 'metallic': metallic,
                 'textures': {k: {'path': p, 'sha256': hashlib.sha256(d).hexdigest(), 'bytes': len(d)} for k, (p, d) in images.items()}},
}
if args.report: json.dump(report, open(args.report, 'w'), indent=2)
print(json.dumps(report, indent=2))
