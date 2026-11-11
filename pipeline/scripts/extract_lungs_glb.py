"""
Script: extract_lungs_glb.py
Purpose:
  Extracts the 5 authentic anatomical Lung Lobe meshes (Right Superior, Right Middle,
  Right Inferior, Left Superior, Left Inferior) with baked world coordinates from
  Z-Anatomy's ic-organlar.glb into a lightweight (~200KB) standalone GLB:
    frontend/public/models/z-anatomy/lungs-lobes.glb
"""

import json
import os
import struct
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
SRC_GLB = os.path.join(ROOT_DIR, "frontend", "public", "models", "z-anatomy", "ic-organlar.glb")
OUT_GLB = os.path.join(ROOT_DIR, "frontend", "public", "models", "z-anatomy", "lungs-lobes.glb")

TARGET_LOBES = {
    "Superior lobe of right lung": "BP3D_LUNG_R_SUP",
    "Middle lobe of right lung": "BP3D_LUNG_R_MID",
    "Inferior lobe of right lung": "BP3D_LUNG_R_INF",
    "Superior lobe of left lung": "BP3D_LUNG_L_SUP",
    "Inferior lobe of left lung": "BP3D_LUNG_L_INF",
}


def compute_normals(positions: np.ndarray, indices: np.ndarray) -> np.ndarray:
    normals = np.zeros_like(positions, dtype=np.float32)
    tris = indices.reshape(-1, 3)
    v0 = positions[tris[:, 0]]
    v1 = positions[tris[:, 1]]
    v2 = positions[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    for k in range(3):
        np.add.at(normals, tris[:, k], fn)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms > 1e-8, norms, 1.0)
    return (normals / norms).astype(np.float32)


def main():
    with open(SRC_GLB, "rb") as f:
        magic, ver, _ = struct.unpack("<3I", f.read(12))
        assert magic == 0x46546C67
        clen, ctype = struct.unpack("<2I", f.read(8))
        gltf = json.loads(f.read(clen).decode("utf-8"))
        blen, btype = struct.unpack("<2I", f.read(8))
        bdata = f.read(blen)

    nodes = gltf["nodes"]
    meshes = gltf["meshes"]
    accessors = gltf["accessors"]
    bviews = gltf["bufferViews"]

    parents = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parents[c] = i

    def mat_for(i):
        m = np.eye(4, dtype=np.float64)
        n = nodes[i]
        if "matrix" in n:
            m = np.array(n["matrix"], dtype=np.float64).reshape(4, 4).T
        else:
            if "translation" in n:
                m[:3, 3] = n["translation"]
            if "scale" in n:
                m = m @ np.diag(list(n["scale"]) + [1.0])
            if "rotation" in n:
                x, y, z, w = n["rotation"]
                m = m @ np.array(
                    [
                        [1 - 2 * y * y - 2 * z * z, 2 * x * y - 2 * z * w, 2 * x * z + 2 * y * w, 0],
                        [2 * x * y + 2 * z * w, 1 - 2 * x * x - 2 * z * z, 2 * y * z - 2 * x * w, 0],
                        [2 * x * z - 2 * y * w, 2 * y * z + 2 * x * w, 1 - 2 * x * x - 2 * y * y, 0],
                        [0, 0, 0, 1],
                    ],
                    dtype=np.float64,
                )
        return (mat_for(parents[i]) @ m) if i in parents else m

    def read_acc(acc_idx):
        acc = accessors[acc_idx]
        bv = bviews[acc["bufferView"]]
        off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        cnt = acc["count"]
        ctype = acc["componentType"]
        tp = acc["type"]
        ncmp = {"SCALAR": 1, "VEC3": 3, "VEC2": 2}[tp]
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5122: np.int16}[ctype]
        stride = bv.get("byteStride", ncmp * np.dtype(dt).itemsize)
        return (
            np.frombuffer(bdata, dtype=np.uint8, count=cnt * stride, offset=off)
            .reshape(cnt, stride)[:, : ncmp * np.dtype(dt).itemsize]
            .copy()
            .view(dt)
            .reshape(cnt, ncmp)
        )

    out_bin = bytearray()
    out_buffer_views = []
    out_accessors = []
    out_meshes = []
    out_nodes = []

    def append_bytes(raw: bytes, target: int | None = None) -> int:
        while len(out_bin) % 4 != 0:
            out_bin.append(0)
        offset = len(out_bin)
        out_bin.extend(raw)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw)}
        if target is not None:
            bv["target"] = target
        out_buffer_views.append(bv)
        return len(out_buffer_views) - 1

    extracted = []
    for ni, n in enumerate(nodes):
        nm = n.get("name", "")
        if nm in TARGET_LOBES and "mesh" in n:
            part_id = TARGET_LOBES[nm]
            prim = meshes[n["mesh"]]["primitives"][0]
            pos = read_acc(prim["attributes"]["POSITION"]).astype(np.float64)
            idx = read_acc(prim["indices"]).astype(np.uint32).reshape(-1)
            wm = mat_for(ni)
            wpos = (wm @ np.hstack([pos, np.ones((len(pos), 1))]).T).T[:, :3].astype(np.float32)
            wnorm = compute_normals(wpos, idx)

            bv_pos = append_bytes(wpos.tobytes(), 34962)
            bv_norm = append_bytes(wnorm.tobytes(), 34962)
            bv_idx = append_bytes(idx.tobytes(), 34963)

            acc_pos = len(out_accessors)
            out_accessors.append(
                {
                    "bufferView": bv_pos,
                    "componentType": 5126,
                    "count": len(wpos),
                    "type": "VEC3",
                    "min": wpos.min(0).tolist(),
                    "max": wpos.max(0).tolist(),
                }
            )
            acc_norm = len(out_accessors)
            out_accessors.append(
                {
                    "bufferView": bv_norm,
                    "componentType": 5126,
                    "count": len(wnorm),
                    "type": "VEC3",
                }
            )
            acc_idx = len(out_accessors)
            out_accessors.append(
                {
                    "bufferView": bv_idx,
                    "componentType": 5125,
                    "count": len(idx),
                    "type": "SCALAR",
                }
            )

            mesh_idx = len(out_meshes)
            out_meshes.append(
                {
                    "name": part_id,
                    "primitives": [
                        {
                            "attributes": {"POSITION": acc_pos, "NORMAL": acc_norm},
                            "indices": acc_idx,
                        }
                    ],
                }
            )
            node_idx = len(out_nodes)
            out_nodes.append({"name": part_id, "mesh": mesh_idx})
            extracted.append((nm, part_id, len(wpos), len(idx) // 3))

    assert len(extracted) == 5, f"Expected 5 lung lobes, got {len(extracted)}"

    while len(out_bin) % 4 != 0:
        out_bin.append(0)

    out_gltf = {
        "asset": {"version": "2.0", "generator": "Homman Lungs Extractor (Z-Anatomy CC-BY-SA 4.0)"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(out_nodes)))}],
        "nodes": out_nodes,
        "meshes": out_meshes,
        "accessors": out_accessors,
        "bufferViews": out_buffer_views,
        "buffers": [{"byteLength": len(out_bin)}],
    }

    json_bytes = json.dumps(out_gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_len = 12 + 8 + len(json_bytes) + 8 + len(out_bin)
    with open(OUT_GLB, "wb") as out:
        out.write(struct.pack("<3I", 0x46546C67, 2, total_len))
        out.write(struct.pack("<2I", len(json_bytes), 0x4E4F534A))
        out.write(json_bytes)
        out.write(struct.pack("<2I", len(out_bin), 0x004E4942))
        out.write(out_bin)

    print(f"[OK] Extracted 5 lung lobes to {OUT_GLB} ({total_len/1024:.1f} KB):")
    for row in extracted:
        print(" ", row)


if __name__ == "__main__":
    main()
