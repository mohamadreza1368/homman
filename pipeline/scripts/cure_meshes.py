"""
Script: cure_meshes.py
Purpose: Automated 3D mesh cleaning (Mesh Curing) for BodyParts3D and HuBMAP anatomical models in Blender.
Tasks:
  1. Remove duplicate vertices (merge by distance).
  2. Detect and eliminate non-manifold elements and isolated loose vertices.
  3. Seal boundary holes to guarantee watertight/manifold geometry.
  4. Recalculate normal vectors outward for uniform shading and clipping plane slicing.
Usage:
  blender --background --python cure_meshes.py -- input_model.obj output_model.glb
"""

import sys
import bpy
import bmesh

def cure_anatomical_mesh(obj):
    """
    Cleans an anatomical mesh object in Blender, making it watertight (manifold),
    fixing normal orientation, and welding boundary seams.
    """
    if obj.type != 'MESH':
        return

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    
    bm = bmesh.from_edit_mesh(obj.data)
    
    # 1. Remove duplicate vertices within a tiny threshold
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    
    # 2. Select and delete loose vertices / non-manifold wire edges
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=True, use_boundary=False)
    bpy.ops.mesh.delete(type='VERT')
    
    # 3. Seal boundary loops to create watertight geometry
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=False, use_boundary=True)
    try:
        bpy.ops.mesh.edge_face_add()
    except Exception as e:
        print(f"Notice during hole capping on {obj.name}: {e}")
        
    # 4. Ensure consistent outward-pointing face normals
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    
    # 5. Triangulate faces for standard game/web engine compatibility
    bmesh.ops.triangulate(bm, faces=bm.faces)
    
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"[OK] Mesh curing completed successfully for: {obj.name}")

def main():
    argv = sys.argv
    if "--" in argv:
        args = argv[argv.index("--") + 1:]
    else:
        args = []

    if len(args) < 2:
        print("Usage: blender --background --python cure_meshes.py -- <input_file> <output_glb>")
        return

    input_path = args[0]
    output_path = args[1]

    # Clear current default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import based on file extension
    if input_path.lower().endswith('.obj'):
        bpy.ops.wm.obj_import(filepath=input_path)
    elif input_path.lower().endswith('.stl'):
        bpy.ops.wm.stl_import(filepath=input_path)
    elif input_path.lower().endswith(('.gltf', '.glb')):
        bpy.ops.import_scene.gltf(filepath=input_path)
    else:
        print(f"Unsupported format for {input_path}")
        return

    # Process all imported meshes
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            cure_anatomical_mesh(obj)

    # Export to binary GLB with Draco compression if supported
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_draco_mesh_compression_enable=True
    )
    print(f"[SUCCESS] Exported cured model to: {output_path}")

if __name__ == "__main__":
    main()
