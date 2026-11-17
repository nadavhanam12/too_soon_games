"""Art-direction comparison, not an in-engine performance benchmark. Blender 4.0."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'assets-src'/'models'
random.seed(27)
def rgb(h):
    return tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))
def mat(name,h,rough=.8,metal=0,emit=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb(h),1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if emit: bs.inputs['Emission Color'].default_value=(*rgb(h),1); bs.inputs['Emission Strength'].default_value=emit
    return m
def texture(m,filename,tile=None,repeat=1):
    nodes=m.node_tree.nodes; links=m.node_tree.links; bs=nodes.get('Principled BSDF')
    image=bpy.data.images.load(str(OUT/'textures'/filename),check_existing=True)
    tex=nodes.new('ShaderNodeTexImage'); tex.image=image; tex.interpolation='Linear'
    uv=nodes.new('ShaderNodeTexCoord'); mapping=nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=repeat
    links.new(uv.outputs['UV'],mapping.inputs[0])
    if tile is not None:
        mapping.inputs[3].default_value=.48
        offset=nodes.new('ShaderNodeVectorMath'); offset.operation='ADD'; offset.inputs[1].default_value=(.01+(tile%2)*.5,.01+(1-tile//2)*.5,0)
        links.new(mapping.outputs[0],offset.inputs[0]); links.new(offset.outputs[0],tex.inputs['Vector'])
    else: links.new(mapping.outputs[0],tex.inputs['Vector'])
    mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=.6; mix.inputs[1].default_value=bs.inputs['Base Color'].default_value
    links.new(tex.outputs['Color'],mix.inputs[2]); links.new(mix.outputs[0],bs.inputs['Base Color'])
def box(n,p,s,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.name=n; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
    # Full-face UVs. Runtime implementation should reuse atlas UVs in merged meshes.
    uv=o.data.uv_layers.active
    if uv:
        for poly in o.data.polygons:
            axes=(1,2) if abs(poly.normal.x)>.5 else (0,2) if abs(poly.normal.y)>.5 else (0,1)
            for li in poly.loop_indices:
                co=o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv=(co[axes[0]]/s[axes[0]]+.5,co[axes[1]]/s[axes[1]]+.5)
    if bevel:
        mod=o.modifiers.new('edge','BEVEL'); mod.width=bevel; mod.segments=1
    return o
def rod(n,a,b,r,m,vertices=7):
    a,b=Vector(a),Vector(b); bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r*.85,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.name=n; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); o.data.materials.append(m); return o
def text(label,p,size,m):
    bpy.ops.object.text_add(location=p,rotation=(math.pi/2,0,0)); o=bpy.context.object
    o.data.body=label; o.data.align_x='CENTER'; o.data.size=size; o.data.extrude=.003; o.data.materials.append(m)
def area(p,power,h,size,target):
    bpy.ops.object.light_add(type='AREA',location=p); o=bpy.context.object; o.data.energy=power; o.data.color=rgb(h); o.data.shape='DISK'; o.data.size=size
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for look in (3,4):
    random.seed(27)
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'nice-city-hero.blend'))
    hi=look==4
    for o in list(bpy.context.scene.objects):
        if o.get('part') in ('torso','head','legL','legR','calfL','calfR','armL','armR'):
            o.location.x+=4.4; o.location.y-=3.8
    if hi:
        for name,rough,metal in [('paint',.22,.38),('trim',.19,.75),('rim',.24,.6),('glass',.2,.3)]:
            bs=bpy.data.materials[name].node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
        bs=bpy.data.materials['paint'].node_tree.nodes.get('Principled BSDF'); bs.inputs['Coat Weight'].default_value=.6
    asphalt=mat('asphalt','343746' if hi else '555c61',.43 if hi else .94)
    sidewalk=mat('sidewalk','8e8594' if hi else '9caaa9')
    texture(asphalt,'asphalt.png',repeat=38)
    texture(sidewalk,'pavement.png',repeat=12)
    paint=mat('road paint','eddbae'); dark=mat('frames','293642'); brick=mat('home terracotta','a96064' if hi else '9e8981')
    window=mat('window','ffca83' if hi else '638290',.4,emit=1.4 if hi else 0)
    teal=mat('teal sign','36d4d0' if hi else '669a9c',emit=2 if hi else 0)
    pink=mat('pink sign','fa4aa0' if hi else 'a78391',emit=2 if hi else 0)
    leaf=mat('palm fronds','245e57' if hi else '4c7065'); bark=mat('palm trunk','725854')
    cream=mat('cream facade','d2a994' if hi else 'bcc3b9'); trim=mat('architectural trim','d9cbc0')
    box('city floor',(0,15,-.14),(150,160,.25),asphalt)
    for x in (-8,8):
        box('raised pavement',(x,18,.03),(6,110,.24),sidewalk)
        box('curb',(x+ (2.9 if x<0 else -2.9),18,.06),(.16,110,.33),trim)
        for y in range(-15,65,3): box('paving joint',(x,y,.155),(5.8,.025,.012),dark)
    for y in range(-14,90,5): box('centre dash',(-1.9,y,.003),(.14,2.1,.016),paint)
    for y in (-6,-5.2,-4.4,-3.6): box('crosswalk',(0,y,.005),(9,.4,.015),trim)
    # Low-rise neighbourhood meets a denser skyline. All repeated details are simple meshes.
    for side in (-1,1):
        for j in range(5):
            x=side*12.3; y=13+j*13; height=7+random.random()*9
            facade=mat(f'facade {side} {j}',random.choice(['9b899c','71949a','c3ab96','89909e','b69a9d']))
            texture(facade,'facade-atlas.png',tile=j%4)
            box('city block',(x,y,height/2),(9,10,height),facade)
            box('roof cornice',(x,y,height),(9.4,10.4,.3),trim)
            for z in range(3,int(height),2):
                for yy in (-3,0,3):
                    xx=x-side*4.53
                    box('window recess',(xx,y+yy,z),(.05,1.35,1.18),dark)
                    box('window pane',(xx-side*.035,y+yy,z),(.04,1.12,.96),window if random.random()>.22 else dark)
                    if hi: box('window sill',(xx-side*.07,y+yy,z-.58),(.22,1.5,.10),trim)
            if hi:
                box('floor band',(x,y,2.1),(9.1,10.1,.15),trim)
                for z in range(4,int(height),3):
                    box('balcony slab',(x-side*4.9,y,z),(.95,6.5,.14),trim)
                    for yy in (-3,-1.5,0,1.5,3): rod('balcony rail',(x-side*5.3,y+yy,z),(x-side*5.3,y+yy,z+.65),.025,dark)
                    rod('balcony handrail',(x-side*5.3,y-3,z+.65),(x-side*5.3,y+3,z+.65),.035,dark)
                for yy in (-3,3): box('ground shop inset',(x-side*4.56,y+yy,1.1),(.08,2.3,1.7),dark)
                box('neon rooftop edge',(x,y,height+.18),(9.45,10.45,.055),teal if j%2 else pink)
    # The destination home, readable behind the person.
    texture(brick,'facade-atlas.png',tile=1)
    texture(cream,'facade-atlas.png',tile=0)
    box('home',(9,1,2),(6,7,4),brick)
    box('home fascia',(9,1,4.03),(6.5,7.5,.25),trim)
    box('front door',(8,-2.54,1.25),(1.2,.09,2.5),dark)
    for x in (6.7,10.6):
        box('home window frame',(x,-2.55,2),(1.4,.1,1.6),trim)
        box('home window',(x,-2.62,2),(1.2,.03,1.4),window)
    box('porch step',(8,-3.1,.15),(2,1,.3),sidewalk)
    # Corner shop across the street, richer only in Look 4.
    box('corner shop',(-10,1,2.6),(8,8,5.2),cream)
    box('shop fascia',(-10,-3.06,3.8),(7.6,.16,.9),dark)
    text('NICE MART',(-10,-3.17,3.53),.62,teal)
    for x in (-12.3,-10,-7.7): box('shopfront',(x,-3.08,1.7),(1.9,.08,2.2),window)
    if hi:
        awning=box('shop canopy',(-10,-3.8,3.1),(8,1.4,.17),pink); awning.rotation_euler.x=.12
        for x in (-13.5,-6.5): rod('canopy support',(x,-4.2,.2),(x,-4.2,3),.055,dark)
        for x,y in [(5.6,9),(-5.8,6),(5.8,26)]:
            box('litter bin',(x,y,.55),(.55,.55,1.1),teal,.06)
        for y in (9,24):
            box('bench seat',(6.7,y,.58),(.7,2,.16),bark)
            box('bench back',(7,y,1.02),(.12,2,.72),bark)
            for dy in (-.7,.7): rod('bench legs',(6.5,y+dy,.1),(6.5,y+dy,.58),.06,dark)
    for x,y in [(-6.2,9),(6.5,13),(-6.2,30),(6.5,36)]:
        rod('palm trunk',(x,y,.15),(x+.4,y,8),.19,bark)
        for k in range(7):
            a=k*math.tau/7
            # Curved tapering fronds, opaque geometry: no alpha sorting/overdraw.
            verts=[]
            for j in range(6):
                t=j/5; dist=t*2.8; width=math.sin(t*math.pi)*.36+.015
                z=8+.55*math.sin(t*math.pi)-1.05*t*t
                cx=x+.4+math.cos(a)*dist; cy=y+math.sin(a)*dist
                verts.extend([(cx-math.sin(a)*width,cy+math.cos(a)*width,z),(cx,cy,z+.07),(cx+math.sin(a)*width,cy-math.cos(a)*width,z)])
            faces=[]
            for j in range(5):
                for side in range(2): faces.append((j*3+side,(j+1)*3+side,(j+1)*3+side+1,j*3+side+1))
            mesh=bpy.data.meshes.new('curved palm frond'); mesh.from_pydata(verts,[],faces); mesh.update()
            o=bpy.data.objects.new('curved palm frond',mesh); bpy.context.collection.objects.link(o); mesh.materials.append(leaf)
    for x,y in [(-5.7,-.5),(5.7,17),(-5.7,36)]:
        rod('lamp post',(x,y,.1),(x,y,6),.065,dark)
        rod('lamp arm',(x,y,6),(x-math.copysign(1,x),y,6),.06,dark)
        box('street light',(x-math.copysign(1,x),y,5.94),(.55,.3,.1),window)
        if hi: area((x-math.copysign(1,x),y,5.8),130,'ffbf78',2,(x,y,0))
    world=bpy.context.scene.world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb('956a9d' if hi else 'b8c9cc'),1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45 if hi else .7
    bpy.ops.object.light_add(type='SUN',rotation=(.55,-.4,-.9) if hi else (.4,-.2,.3)); sun=bpy.context.object
    sun.data.energy=2.3 if hi else 1.5; sun.data.color=rgb('ffa26d' if hi else 'e5eeeb'); sun.data.angle=.12
    area((2,-5,14),2100,'b5cfff' if hi else 'e0edf2',12,(0,2,0))
    if hi:
        area((-8,-1,5),650,'ff56bc',5,(0,0,1)); area((7,4,5),750,'6dd8ff',5,(0,0,1))
    bpy.ops.object.camera_add(location=(15,-21,12)); cam=bpy.context.object
    cam.rotation_euler=(Vector((0,9,2))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.lens=43
    scene=bpy.context.scene; scene.camera=cam; scene.render.engine='BLENDER_EEVEE'; scene.eevee.use_gtao=True
    scene.eevee.use_ssr=hi; scene.eevee.use_bloom=hi; scene.eevee.bloom_intensity=.10; scene.eevee.bloom_threshold=1.6
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=1600; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
    scene.render.filepath=str(OUT/f'street-look{look}-v2.png')
    # Packed textures make the editable .blend self-contained.
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'nice-city-street-look{look}-v2.blend'))
    bpy.ops.render.render(write_still=True)
