"""Regression coverage for physical connectivity across rendering seams.

Run: python -m unittest discover -s scripts -p test_auto_orient_integrity.py
"""
import unittest

import numpy as np
import trimesh

from auto_orient import integrity


def split_render_vertices(mesh, *, uv=True, normals=True):
    """Give every triangle its own vertices without changing its surface."""
    vertices = mesh.vertices[mesh.faces.reshape(-1)]
    kwargs = {}
    if uv:
        # Every rendering vertex has a distinct UV, including coincident points.
        values = np.arange(len(vertices), dtype=float) / len(vertices)
        kwargs["visual"] = trimesh.visual.texture.TextureVisuals(
            uv=np.column_stack((values, 1.0 - values)),
            material=trimesh.visual.material.PBRMaterial(
                baseColorFactor=[255, 255, 255, 255]))
    if normals:
        kwargs["vertex_normals"] = np.repeat(mesh.face_normals, 3, axis=0)
    return trimesh.Trimesh(
        vertices=vertices,
        faces=np.arange(len(vertices)).reshape(-1, 3),
        process=False,
        **kwargs,
    )


class PhysicalIntegrityTests(unittest.TestCase):
    def test_closed_cube_connected_across_uv_and_normal_seams(self):
        for uv, normals in [(True, False), (False, True), (True, True)]:
            with self.subTest(uv=uv, normals=normals):
                mesh = split_render_vertices(
                    trimesh.creation.box(), uv=uv, normals=normals)
                vertices = mesh.vertices.copy()
                faces = mesh.faces.copy()
                source_uv = mesh.visual.uv.copy() if uv else None
                source_normals = mesh.vertex_normals.copy() if normals else None

                result = integrity(mesh)

                self.assertEqual(result, dict(
                    faces=12, bratio=0.0, ncomp=1, largest_frac=1.0))
                np.testing.assert_array_equal(mesh.vertices, vertices)
                np.testing.assert_array_equal(mesh.faces, faces)
                if uv:
                    np.testing.assert_array_equal(mesh.visual.uv, source_uv)
                if normals:
                    np.testing.assert_array_equal(
                        mesh.vertex_normals, source_normals)

    def test_two_separated_cubes_remain_two_components(self):
        first = trimesh.creation.box()
        second = trimesh.creation.box()
        second.apply_translation([3.0, 0.0, 0.0])
        mesh = split_render_vertices(trimesh.util.concatenate([first, second]))

        self.assertEqual(integrity(mesh), dict(
            faces=24, bratio=0.0, ncomp=2, largest_frac=0.5))

    def test_open_cube_keeps_its_boundary(self):
        mesh = trimesh.creation.box()
        # Remove the two triangles on the +X wall, opening the physical shell.
        mesh.update_faces(mesh.face_normals[:, 0] < 0.5)
        result = integrity(split_render_vertices(mesh))

        self.assertEqual(result["faces"], 10)
        self.assertEqual(result["ncomp"], 1)
        self.assertEqual(result["largest_frac"], 1.0)
        self.assertGreater(result["bratio"], 0.0)


if __name__ == "__main__":
    unittest.main()
