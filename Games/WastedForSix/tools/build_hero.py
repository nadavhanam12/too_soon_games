"""Blender 4: reproducible mobile hero. Run blender -b --python tools/build_hero.py.
Author in game coordinates (Y up, nose -Z), convert to Blender Z up at creation.
No textures, external assets, armature evaluation or runtime modifiers required.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets-src' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version=0  # generated outputs only; does not save user preferences
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def v(p): return Vector((p[0], -p[2], p[1]))
def rgb(h):
    return tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))
palette = {'paint':'c81e3c','trim':'d9ded8','dark':'20242e','seat':'ac7950','rubber':'191b20','rim':'9aa8b0','white':'eee7cf','red':'e9263c','glass':'769caa','shirt':'577f9d','skin':'d2a07c','hair':'342c29','pants':'373b49','tie':'803b46','sole':'24252b','stubble':'92725f','fold':'416781'}
mats={}
for name,h in palette.items():
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb(h),1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color
    bs.inputs['Roughness'].default_value=.32 if name in ('paint','rim','trim','glass') else .83
    bs.inputs['Metallic'].default_value=.55 if name in ('rim','trim') else .12 if name=='paint' else 0
    mats[name]=m
parts={}
def finish(o,name,mat,part,bevel=0):
    o.name=name; o.data.materials.append(mats[mat]); o['part']=part
    if bevel:
        mod=o.modifiers.new('small manufactured edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.setdefault(part,[]).append(o)
    return o
def box(name,p,s,mat,part='body',b=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(p)); o=bpy.context.object
    o.scale=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,part,b)
def ell(name,p,s,mat,part):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=v(p)); o=bpy.context.object
    o.scale=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,part)
def rod(name,a,b,r,mat,part,segments=8):
    a,b=v(a),v(b); bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=r,radius2=r*.92,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return finish(o,name,mat,part)
def mesh_part(name,verts,faces,mat,part):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata([v(p) for p in verts],[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    return finish(o,name,mat,part)
def tuft(name,p,s,part):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=v(p)); o=bpy.context.object
    o.scale=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,'hair',part)
def hull(name,rings,mat,part='body'):
    # octagonal cross sections, no hidden coplanar boxes; sculpted shoulder line
    verts=[]
    for z,w,lo,hi in rings:
        for x,y in [(-w*.86,lo),(w*.86,lo),(w,lo+.13),(w,hi-.09),(w*.86,hi),(-w*.86,hi),(-w,hi-.09),(-w,lo+.13)]: verts.append(v((x,y,z)))
    faces=[tuple(reversed(range(8)))]
    for j in range(len(rings)-1):
        for i in range(8): faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i))
    faces.append(tuple(range((len(rings)-1)*8,len(rings)*8)))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); return finish(o,name,mat,part)

shell=hull('tapered lower shell',[(-2.55,.97,.40,.83),(-2.18,1.13,.37,1.0),(-.7,1.12,.37,1.04),(1.5,1.16,.37,1.06),(2.5,1.03,.43,.99)],'paint')
# Real wheel openings instead of tires intersecting a solid rectangular sill.
for z in (-1.65,1.6):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.555,depth=3.2,location=v((0,.5,z)),rotation=(0,math.pi/2,0))
    cutter=bpy.context.object
    mod=shell.modifiers.new('wheel arch cutout','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.context.view_layer.objects.active=shell; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    for x in (-1.145,1.145):
        verts=[]
        for j in range(11):
            a=j*math.pi/10
            for r in (.555,.61): verts.append((x,.5+math.sin(a)*r,z+math.cos(a)*r))
        # Both sides explicitly wound outward; no double-sided material needed.
        faces=[(j*2,j*2+1,j*2+3,j*2+2) if x>0 else (j*2+2,j*2+3,j*2+1,j*2) for j in range(10)]
        mesh_part('sculpted arch lip',verts,faces,'paint','body')
# Leave an actual opening behind the separately hinged driver's door.
bpy.ops.mesh.primitive_cube_add(size=1,location=v((-1.15,.93,.17)))
cutter=bpy.context.object; cutter.scale=(.5,1.65,.60)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mod=shell.modifiers.new('driver door opening','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
bpy.context.view_layer.objects.active=shell; bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
box('hinged door panel',(-1.105,.91,.17),(.15,.49,1.65),'paint','door',b=.025)
box('door inner lining',(-1.015,.96,.17),(.025,.35,1.5),'seat','door',b=.015)
hull('long sculpted bonnet',[(-2.5,.96,.8,.89),(-1.9,1.07,.83,1.12),(-.67,1.02,.86,1.19)],'paint')
hull('short rear deck',[(1.26,1.08,.84,1.18),(2.18,1.12,.84,1.16),(2.5,1.02,.8,.99)],'paint')
box('cockpit well',(0,1.045,.32),(1.86,.08,1.84),'dark',b=.03)
for x in (-1.08,1.08):
    panel='door' if x<0 else 'body'
    box('door shoulder',(x,1.08,.17),(.19,.21,1.65),'paint',panel,b=.05)
    if x<0:
        box('door brightwork',(x*1.04,.72,.17),(.025,.045,1.65),'trim',panel)
        for z in (-1.5,1.72): box('body brightwork',(x*1.04,.65,z),(.025,.045,.85),'trim')
    else: box('side brightwork',(x*1.04,.65,.06),(.025,.045,4.1),'trim')
    box('door handle',(x*1.05,1.09,.7),(.04,.05,.22),'trim',panel,b=.015)
    box('mirror housing',(x*1.18,1.3,-.62),(.23,.14,.3),'paint',panel,b=.04)
    box('mirror face',(x*1.18,1.31,-.46),(.16,.08,.015),'glass',panel)
for x in (-.48,.48):
    box('bucket cushion',(x,1.13,.52),(.69,.18,.73),'seat',b=.07)
    box('bucket back',(x,1.4,.96),(.68,.61,.18),'seat',b=.07)
    box('headrest',(x,1.77,1),(.38,.22,.16),'seat',b=.055)
    for dx in (-.21,.21): box('seat stitched bolster',(x+dx,1.42,.855),(.04,.43,.025),'dark')
box('dashboard',(0,1.27,-.55),(1.86,.28,.23),'dark',b=.04)
for x in (-.58,-.38):
    ell('instrument dial',(x,1.37,-.418),(.075,.075,.012),'rim','body')
box('dashboard instrument hood',(-.48,1.45,-.5),(.5,.07,.25),'dark',b=.025)
for x in (-.8,.75): box('dash vent',(x,1.33,-.42),(.18,.09,.018),'rim')
box('centre console',(0,1.18,.26),(.19,.19,1.1),'dark',b=.03)
rod('gear stick',(.02,1.27,.13),(.02,1.48,.1),.025,'trim','body')
ell('gear knob',(.02,1.49,.1),(.055,.055,.055),'dark','body')
for x in (-.3,.3):
    box('bonnet ivory stripe',(x,1.135,-1.6),(.22,.012,.62),'white')
    box('rear ivory stripe',(x,1.183,1.7),(.22,.012,.75),'white')
for z in (-2.56,2.54):
    box('bumper',(0,.64,z),(2.06,.13,.13),'trim',b=.03)
    box('grille' if z<0 else 'rear valance',(0,.84,z),(1.78,.2,.025),'dark',b=.02)
    for x in (-.77,-.49,.49,.77): box('headlamp' if z<0 else 'tail lamp',(x,.87,z+(-.02 if z<0 else .02)),(.23,.15,.04),'white' if z<0 else 'red',b=.035)
    box('license plate',(0,.75,z+(-.025 if z<0 else .025)),(.42,.14,.03),'white')
for x in (-.65,.65): rod('exhaust',(x,.46,2.38),(x,.46,2.65),.09,'rim','body')
box('rear deck spoiler lip',(0,1.2,2.21),(2.02,.065,.22),'paint',b=.025)
for x in (-.87,-.58,-.29,.29,.58,.87):
    box('front grille slat',(x,.84,-2.587),(.025,.16,.015),'rim')
for x in (-1.13,1.13):
    box('door shut line',(x,.87,.97),(.012,.29,.016),'dark')
    for z in (-.82,-.68,-.54): box('fender vent',(x,.91,z),(.015,.10,.055),'dark')
# Raked windshield, separate opaque tinted surface avoids transparent sorting and overdraw.
ws=box('windshield',(0,1.55,-.65),(1.83,.57,.025),'glass','glass'); ws.rotation_euler.x=math.radians(-24)
for x in (-.95,.95): rod('windshield pillar',(x,1.27,-.78),(x,1.86,-.52),.035,'trim','body')
rod('windshield header',(-.97,1.86,-.52),(.97,1.86,-.52),.035,'trim','body')
rod('steering column',(-.48,1.28,-.46),(-.48,1.49,-.22),.035,'dark','body')
bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=4,location=v((-.48,1.5,-.22)),major_radius=.19,minor_radius=.025)
o=bpy.context.object; o.rotation_euler.x=math.radians(60); finish(o,'steering rim','dark','steering')
for x in (-.16,.16): rod('steering spoke',(-.48,1.5,-.22),(-.48+x,1.5,-.22),.018,'rim','steering',4)
for i,(x,z) in enumerate([(-1.13,-1.65),(1.13,-1.65),(-1.13,1.6),(1.13,1.6)]):
    part=f'wheel{i}'; rod('tire',(x-.18,.5,z),(x+.18,.5,z),.49,'rubber',part,16)
    side=-1 if x<0 else 1
    rod('alloy rim',(x+side*.17,.5,z),(x+side*.2,.5,z),.32,'rim',part,12)
    rod('hub',(x+side*.2,.5,z),(x+side*.22,.5,z),.11,'dark',part,10)
    for a in range(5):
        t=a*math.tau/5
        rod('wheel spoke',(x+side*.225,.5+math.sin(t)*.10,z+math.cos(t)*.10),(x+side*.225,.5+math.sin(t)*.29,z+math.cos(t)*.29),.035,'trim',part,4)

def person(seated=False):
    base='driver' if seated else 'torso'
    # Same tired office worker in both poses; pivoted rigid limbs keep animation cheap.
    offset=Vector((-.48,1.12,.48)) if seated else Vector((0,0,0))
    scale=.92 if seated else 1
    def P(p): return tuple(Vector(p)*scale+offset)
    section=base
    def B(n,p,s,m,part=None,b=.02): return box(n,P(p),tuple(t*scale for t in s),m,part or section,b*scale)
    def E(n,p,s,m,part=None): return ell(n,P(p),tuple(t*scale for t in s),m,part or section)
    def R(n,a,b,r,m,part=None): return rod(n,P(a),P(b),r*scale,m,part or section)
    # Standing head height 2.48; seated hips translated down relative to torso.
    drop=.85 if seated else 0
    # Tapered waist/shoulders, with a slight shirt hem rather than a box torso.
    verts=[]
    for y,w,d in [(.99,.29,.18),(1.31,.32,.19),(1.64,.39,.19),(1.76,.27,.16)]:
        for x,z in [(-w,-d),(w,-d),(w,d),(-w,d)]: verts.append(P((x,y-drop,z)))
    faces=[(3,2,1,0),(12,13,14,15)]
    for j in range(3):
        for i in range(4): faces.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
    mesh_part('tailored shirt',verts,faces,'shirt',base)
    B('belt',(0,.98-drop,0),(.63,.08,.38),'dark')
    B('belt buckle',(0,.98-drop,-.202),(.1,.065,.025),'rim')
    section='driverHead' if seated else 'head'
    R('neck',(0,1.72-drop,0),(0,1.9-drop,0),.115,'skin')
    E('face',(0,2.085-drop,-.015),(.245,.30,.225),'skin')
    E('hair cap',(0,2.25-drop,.055),(.26,.17,.22),'hair')
    for p,s in [((-.12,2.35-drop,-.06),(.15,.12,.17)),((.04,2.38-drop,-.035),(.16,.11,.17)),((.17,2.27-drop,-.08),(.10,.12,.13))]:
        tuft('swept hair',P(p),tuple(t*scale for t in s),section)
    B('sideburn L',(-.215,2.14-drop,-.03),(.05,.14,.14),'hair',b=.012)
    B('sideburn R',(.215,2.14-drop,-.03),(.05,.14,.14),'hair',b=.012)
    for x in (-.21,.21): E('ear',(x,2.08-drop,0),(.065,.09,.07),'skin')
    E('nose',(0,2.075-drop,-.228),(.052,.075,.055),'skin')
    for x in (-.095,.095):
        B('eye socket',(x,2.14-drop,-.218),(.09,.065,.02),'stubble',b=.009)
        B('eye white',(x,2.14-drop,-.231),(.073,.034,.012),'white',b=0)
        B('pupil',(x,2.14-drop,-.241),(.028,.03,.009),'dark',b=0)
        B('brow',(x,2.19-drop,-.218),(.10,.025,.025),'hair',b=.008)
    B('stubble chin',(0,1.96-drop,-.184),(.19,.09,.03),'stubble',b=.025)
    B('tired mouth',(0,1.99-drop,-.209),(.115,.018,.012),'hair',b=0)
    section=base
    for x in (-.11,.11):
        o=B('open collar',(x,1.72-drop,-.21),(.16,.16,.035),'white'); o.rotation_euler.y= x*2
    B('tie knot',(0,1.63-drop,-.221),(.095,.10,.035),'tie',b=.025)
    mesh_part('pointed loosened tie',[P(p) for p in [(-.034,1.59-drop,-.224),(.034,1.59-drop,-.224),(.062,1.19-drop,-.224),(0,1.12-drop,-.224),(-.062,1.19-drop,-.224)]],[(4,3,2,1,0)],'tie',base)
    B('shirt pocket',(.21,1.45-drop,-.205),(.16,.16,.025),'shirt')
    B('pocket seam',(.21,1.52-drop,-.222),(.15,.014,.012),'fold',b=0)
    for x in (-.21,.21): B('shirt fold',(x,1.15-drop,-.196),(.025,.20,.014),'fold',b=0)
    for side in (-1,1):
        x=side*.43; part=('driverArmL' if side<0 else 'driverArmR') if seated else ('armL' if side<0 else 'armR')
        R('rolled sleeve',(side*.35,1.64-drop,0),(x,1.29-drop,-.025),.135,'shirt',part)
        end=(side*.30,1.19-drop,-.80) if seated else (side*.45,.92,-.07)
        R('forearm',(x,1.27-drop,-.03),end,.092,'skin',part)
        E('hand',end,(.105,.13,.10),'skin',part)
        part=base if seated else ('legL' if side<0 else 'legR')
        hip=(side*.18,.96-drop,0); knee=(side*.18,.12,-.4) if seated else (side*.18,.50,0)
        ankle=(side*.18,-.42,-.67) if seated else (side*.18,.13,0)
        R('trouser thigh',hip,knee,.16,'pants',part)
        if not seated: part='calfL' if side<0 else 'calfR'
        R('trouser shin',knee,ankle,.125,'pants',part)
        B('shoe',(ankle[0],ankle[1]-.04,ankle[2]-.08),(.26,.18,.43),'sole',part,b=.045)
        B('shoe sole',(ankle[0],ankle[1]-.12,ankle[2]-.08),(.27,.035,.44),'dark',part,b=.012)
person(True); person(False)

# Compact indexed vertex-colour meshes, merged by animated part, not by object/material.
# One shared StandardMaterial in the browser; glass gets a separate material.
pivots={'wheel0':(-1.13,.5,-1.65),'wheel1':(1.13,.5,-1.65),'wheel2':(-1.13,.5,1.6),'wheel3':(1.13,.5,1.6),'legL':(-.18,.96,0),'legR':(.18,.96,0),'armL':(-.35,1.64,0),'armR':(.35,1.64,0)}
pivots.update({'door':(-1.105,.93,-.655),'steering':(-.48,1.5,-.22),'head':(0,1.8,0),
    'calfL':(-.18,.50,0),'calfR':(.18,.50,0),'driverHead':(-.48,1.994,.48),
    'driverArmL':(-.802,1.8468,.48),'driverArmR':(-.158,1.8468,.48)})
data={}; stats={}
bpy.context.view_layer.update()
for part,objects in parts.items():
    pos=[]; colors=[]; indices=[]; lookup={}; pivot=pivots.get(part,(0,0,0))
    for o in objects:
        mesh=o.data; mesh.calc_loop_triangles(); col=o.data.materials[0].diffuse_color[:3]
        for tri in mesh.loop_triangles:
            for vi in tri.vertices:
                p=o.matrix_world @ mesh.vertices[vi].co
                point=(p.x-pivot[0],p.z-pivot[1],-p.y-pivot[2])
                key=tuple(round(t,4) for t in (*point,*col))
                if key not in lookup:
                    lookup[key]=len(pos)//3; pos.extend(key[:3]); colors.extend(key[3:])
                indices.append(lookup[key])
    data[part]={'p':pos,'c':colors,'i':indices,'pivot':pivot}; stats[part]=len(indices)//3
car_triangles=sum(n for k,n in stats.items() if k in ('body','glass','door','steering') or k.startswith(('wheel','driver')))
walker_triangles=sum(stats[k] for k in ('torso','head','armL','armR','legL','legR','calfL','calfR'))
assert car_triangles <= 6000, f'Hero car exceeds mobile mesh budget: {car_triangles}'
assert walker_triangles <= 2000, f'Walker exceeds mobile mesh budget: {walker_triangles}'
target=ROOT/'src'/'models'/'hero-data.json'; target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(data,separators=(',',':')))
(OUT/'hero-stats.json').write_text(json.dumps(stats,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'nice-city-hero.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'nice-city-hero.glb'),export_format='GLB')
print('HERO_TRIANGLES',stats)

# Review render in the real palette, with a standing counterpart beside the roadster.
for part,objects in parts.items():
    if part in ('torso','head','legL','legR','calfL','calfR','armL','armR'):
        for o in objects: o.location.x+=2.8
world=bpy.context.scene.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.45,.5,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.03)); o=bpy.context.object; o.data.materials.append(mats['dark'])
for p,power,size in [((1,-4,8),1800,7),((-5,3,5),1200,6)]:
    bpy.ops.object.light_add(type='AREA',location=p); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK'; o.data.size=size
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(9,-11,8)); cam=bpy.context.object
cam.rotation_euler=(Vector((.8,0,1))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=10
scene=bpy.context.scene; scene.camera=cam; scene.render.engine='BLENDER_EEVEE'; scene.eevee.use_gtao=True
scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'hero-preview.png'); bpy.ops.render.render(write_still=True)
cam.location=(9,11,7); cam.rotation_euler=(Vector((.8,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/'hero-v2-front.png'); bpy.ops.render.render(write_still=True)
