"""Look 4 art variant. Blender -b --python tools/preview_hero_look4.py.
Separate editable presentation; does not replace the game's approved Look 3 model.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets-src'/'models'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'nice-city-hero.blend'))
def color(h):
    return tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))
def surface(name,h,roughness,metal=0):
    m=bpy.data.materials[name]; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color(h),1)
    bs.inputs['Roughness'].default_value=roughness; bs.inputs['Metallic'].default_value=metal
    return bs
paint=surface('paint','ee164f',.20,.48)
paint.inputs['Coat Weight'].default_value=.65; paint.inputs['Coat Roughness'].default_value=.15
surface('trim','f1e9ff',.17,.85); surface('rim','d5dfed',.22,.70)
surface('glass','285d79',.17,.42); surface('seat','a86644',.66)
surface('shirt','438eab',.72); surface('tie','b83969',.54)
surface('pants','292b40',.76)
for name,h,strength in [('red','ff1647',2.5),('white','ffe7b2',1.2)]:
    if name=='white': continue # racing stripes stay paint, not luminous
    bs=surface(name,h,.3); bs.inputs['Emission Color'].default_value=(*color(h),1); bs.inputs['Emission Strength'].default_value=strength
def emissive(name,h,strength):
    m=bpy.data.materials.new(name); m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color(h),1); bs.inputs['Emission Color'].default_value=(*color(h),1); bs.inputs['Emission Strength'].default_value=strength
    return m
neon=emissive('Look4 cyan sill accents','29d5e1',2.0)
head=emissive('Look4 warm headlights','ffe5aa',2.5)
for o in bpy.context.scene.objects:
    if o.name.startswith('headlamp'): o.data.materials.clear(); o.data.materials.append(head)
    if o.type=='MESH' and o.get('part') in ('body','driver','torso'):
        # Very small edge highlights without a subdivision surface.
        mod=o.modifiers.new('Look4 highlight bevel','BEVEL'); mod.width=.018; mod.segments=2
    if o.get('part') in ('torso','head','legL','legR','calfL','calfR','armL','armR'): o.location.x+=2.8
for x in (-1.11,1.11):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.1,.48)); o=bpy.context.object
    o.name='Look4 subtle cyan sill'; o.scale=(.018,1.03,.016); o.data.materials.append(neon)
world=bpy.context.scene.world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(*color('713e72'),1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
floor=bpy.data.materials.new('Look4 dusk asphalt'); floor.use_nodes=True
bs=floor.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color('242338'),1); bs.inputs['Roughness'].default_value=.34; bs.inputs['Metallic'].default_value=.15
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.03)); bpy.context.object.data.materials.append(floor)
def light(name,p,power,size,h,target=(0,0,1)):
    bpy.ops.object.light_add(type='AREA',location=p); o=bpy.context.object; o.name=name
    o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color(h)
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
light('sunset orange rim',(-5,-4,5),1600,5,'ff9864')
light('cool sky fill',(3,5,7),2200,6,'b9d9ff')
light('pink city reflection',(0,-4,4),1000,4,'ff55c7')
light('cyan shop window',(5,1,3),650,3,'5de9ff')
bpy.ops.object.camera_add(location=(9,11,7)); cam=bpy.context.object
cam.rotation_euler=(Vector((.8,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=9.8
scene=bpy.context.scene; scene.camera=cam; scene.render.engine='BLENDER_EEVEE'
scene.eevee.use_gtao=True; scene.eevee.use_ssr=True; scene.eevee.use_bloom=True
scene.eevee.bloom_intensity=.12; scene.eevee.bloom_threshold=1.5
scene.view_settings.view_transform='AgX'
scene.render.resolution_x=1500; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'hero-look4-v2-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'nice-city-hero-look4-v2.blend'))
bpy.ops.render.render(write_still=True)
