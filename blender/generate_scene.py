"""
Blender Python API integration for the AI Creative Studio.

Called headlessly by the pipeline:
    blender --background --python blender/generate_scene.py -- scene.json

scene.json (written by the 3D Artist AI) describes environment, models,
lighting, camera path and simulations. This script builds a procedural
scene, imports GLTF/FBX/OBJ/USD assets when provided, applies physics
simulations, animates the camera and renders an MP4.
"""
import json
import math
import os
import sys

import bpy


def load_spec():
    argv = sys.argv[sys.argv.index("--") + 1:]
    with open(argv[0]) as f:
        return json.load(f)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_environment(spec):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.02, 0.02, 0.05, 1)  # deep cinematic sky

    # Ground plane
    bpy.ops.mesh.primitive_plane_add(size=200)

    # Procedural props if no external models supplied
    models = spec.get("models") or []
    if not models:
        for i in range(8):
            angle = i / 8 * math.tau
            bpy.ops.mesh.primitive_cube_add(
                size=2, location=(math.cos(angle) * 8, math.sin(angle) * 8, 1 + i % 3)
            )
    for m in models:
        path = m.get("file")
        if not path or not os.path.exists(path):
            continue
        ext = os.path.splitext(path)[1].lower()
        if ext in (".gltf", ".glb"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        elif ext == ".obj":
            bpy.ops.wm.obj_import(filepath=path)
        elif ext in (".usd", ".usdc", ".usda", ".usdz"):
            bpy.ops.wm.usd_import(filepath=path)


def build_lighting(spec):
    style = (spec.get("lighting") or "cinematic").lower()
    energy = 3.0 if "dramatic" in style else 1.5
    bpy.ops.object.light_add(type="SUN", location=(10, -10, 20))
    bpy.context.object.data.energy = energy
    bpy.ops.object.light_add(type="AREA", location=(-8, 6, 6))
    bpy.context.object.data.energy = 400


def apply_simulations(spec):
    for sim in spec.get("simulations") or []:
        kind = (sim.get("type") or "").lower()
        if kind in ("smoke", "fire", "fluid"):
            bpy.ops.mesh.primitive_cube_add(size=4, location=(0, 0, 4))
            bpy.ops.object.modifier_add(type="FLUID")
        elif kind in ("cloth",):
            bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 6))
            bpy.ops.object.modifier_add(type="CLOTH")
        elif kind in ("rigid", "rigid_bodies"):
            bpy.ops.rigidbody.world_add()
        elif kind in ("particles", "hair"):
            bpy.ops.mesh.primitive_uv_sphere_add(location=(0, 0, 2))
            bpy.ops.object.particle_system_add()


def animate_camera(spec, frames):
    bpy.ops.object.camera_add(location=(18, -18, 8))
    cam = bpy.context.object
    bpy.context.scene.camera = cam
    path = (spec.get("cameraPath") or "orbit").lower()
    cam.keyframe_insert("location", frame=1)
    if "orbit" in path:
        cam.location = (-18, -18, 8)
    elif "push" in path or "dolly" in path:
        cam.location = (8, -8, 5)
    else:  # crane / rise
        cam.location = (18, -18, 16)
    cam.keyframe_insert("location", frame=frames)
    # Always look at origin
    constraint = cam.constraints.new(type="TRACK_TO")
    empty = bpy.data.objects.new("Target", None)
    bpy.context.collection.objects.link(empty)
    constraint.target = empty


def render(spec, frames):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "SceneEEVEE") else "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.frame_end = frames
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.filepath = spec["output"]
    bpy.ops.render.render(animation=True)


def main():
    spec = load_spec()
    frames = int(spec.get("durationSec", 5) * 24)
    reset_scene()
    build_environment(spec)
    build_lighting(spec)
    apply_simulations(spec)
    animate_camera(spec, frames)
    render(spec, frames)


if __name__ == "__main__":
    main()
