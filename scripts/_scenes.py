# ponytail: one-off generator for Part 1 film coverage; the JSON files are the source of truth after this runs.
import json
D='src/scenes/railway-crossing/'
AMB={"ambience":[{"sound":"rain","volume":0.55},{"sound":"night_drone","volume":0.25}],"music":None}
NIGHT={"ambientIntensity":0.7,"fogDensity":0.028,"exposure":1.0,"moon":0.6,"gi":1.0}
PI=3.14159
TAXI=[-1.0,0,24]; AARAV_SEAT=[-1.4,0.05,23.85]; DRIVER_SEAT=[-0.6,0.05,23.85]
def shot(id,type,dur,frm,look,to=None,lookTo=None,fov=34,fovP=50,ease=None,exp=None,eye=None):
    s={"id":id,"type":type,"duration":dur,"from":frm,"lookAt":look,"fov":fov,"fovPortrait":fovP}
    if to: s["to"]=to
    if lookTo: s["lookAtTo"]=lookTo
    if ease: s["ease"]=ease
    if exp: s["exposure"]=exp
    if eye: s["eyeLight"]=eye
    return s
def ent(at,t,vis=True,**k):
    c={"at":at,"action":"entity","target":t,"visible":vis}
    for a,b in k.items(): c["from" if a=="frm" else a]=b
    return c
def light(at,t,m): return {"at":at,"action":"light","target":t,"mode":m}
def sfx(at,s,v,pos=None):
    c={"at":at,"action":"sfx","sound":s,"volume":v}
    if pos: c["position"]=pos
    return c
# Camera life: shots that don't move get a slow creep toward their subject plus a slight arc.
# Deliberate holds (inserts, the split-second capture) stay still.
KEEP_STILL={"the_door","he_turns","her"}
import math
def give_life(sh):
    if sh.get("to") or sh["id"] in KEEP_STILL: return
    f, l = sh["from"], sh["lookAt"]
    d=[l[i]-f[i] for i in range(3)]; n=math.sqrt(sum(x*x for x in d)) or 1
    amt=min(1.4, 0.14*sh["duration"]); side=0.05*sh["duration"]
    sh["to"]=[round(f[0]+d[0]/n*amt + (-d[2]/n)*side,2), round(f[1]+d[1]/n*amt*0.5,2), round(f[2]+d[2]/n*amt + (d[0]/n)*side,2)]
    if sh["type"]=="static": sh["type"]="slow_push"
def scene(id,dur,shots,cues,tech=None,lighting=NIGHT,amb=AMB):
    for sh in shots: give_life(sh)
    tot=sum(s["duration"] for s in shots); assert abs(tot-dur)<1e-6,(id,tot,dur)
    c={"sceneId":id,"environment":"railway-crossing","duration":dur,"shots":shots,"lighting":lighting,"audio":amb,"cues":cues}
    if tech: c["techniques"]=tech
    json.dump(c,open(D+id+'.json','w'),indent=2)
BASE=[light(0,"sodium_far","on"),light(0,"sodium_near","on"),light(0,"gate_tube","dying")]
HIDE=[ent(0,"taxi",False),ent(0,"driver",False)]

scene("p1_car",24.5,[
  shot("headlights","low_angle",8.5,[0.4,0.3,11],[-0.8,0.9,40],fov=36,fovP=52,exp=0.95),
  shot("taxi_wide","slow_push",11,[2.6,2.4,15.5],[-1.0,0.9,24],to=[2.2,2.2,16.6],fov=30,fovP=46,exp=1.2),
  shot("behind_taxi","static",5,[-0.4,1.7,31.5],[-0.9,1.1,12],fov=30,fovP=46,exp=1.3),
],[{"at":0,"action":"fade","to":1,"duration":0.01},{"at":1.5,"action":"fade","to":0,"duration":3},*BASE,
  ent(0,"chudail",position=[0.7,0,-9.5]),
  ent(0,"taxi",position=TAXI,frm=[-1.0,0,75],speed=6.2,rotationY=PI),
  ent(8.5,"aarav",position=AARAV_SEAT,rotationY=PI,anim="sit"),
  ent(8.5,"driver",position=DRIVER_SEAT,rotationY=PI,anim="sit"),
  ent(20.5,"aarav",keep=True,headYaw=-0.35)])

scene("p1_car_talk",14,[shot("behind_taxi","slow_push",14,[-0.4,1.7,31.5],[-0.9,1.1,12],to=[-0.7,1.62,28.6],fov=30,fovP=46,exp=1.3)],
 [*BASE,ent(0,"chudail",position=[0.7,0,-9.5]),ent(0,"taxi",position=TAXI,rotationY=PI),
  ent(0,"aarav",position=AARAV_SEAT,rotationY=PI,anim="sit"),ent(0,"driver",position=DRIVER_SEAT,rotationY=PI,anim="sit",headYaw=-0.25)])

scene("p1_road",37,[
  shot("taxi_leaves","static",6.5,[0.7,0.5,15],[-1.3,1.0,24],fov=34,fovP=52),
  shot("follow","track_lateral",6.5,[-0.9,1.85,25.4],[0.3,1.3,-6],to=[-0.6,1.85,18.9]),
  shot("head_turns","static",3.5,[2.9,1.35,16.4],[-0.8,1.3,14.8],fov=30,fovP=44,exp=1.15),
  shot("the_door","static",2.5,[-0.9,1.62,14.6],[-5.9,1.15,5.7],fov=30,fovP=44,exp=1.25),
  shot("over_shoulder","static",2.5,[-0.25,1.95,16.3],[0.35,1.25,-4.6],fov=34,fovP=56,exp=1.35,eye=0.5),
  shot("push","slow_push",15.5,[-0.25,1.95,16.3],[0.35,1.25,-4.6],to=[-0.4,1.92,15.6],fov=32,fovP=52,exp=1.35,eye=0.5),
],[*BASE,ent(0,"driver",False),ent(0,"chudail",position=[0.7,0,-9.5]),
  ent(0,"taxi",position=[-1.0,0,62],frm=TAXI,speed=3.2,rotationY=PI),
  ent(0,"aarav",position=[-1.7,0,23.4],rotationY=PI),
  ent(5.5,"aarav",position=[-0.6,0,14.5],frm=[-1.7,0,23.4],speed=1.0),
  ent(11,"taxi",False),
  sfx(13.0,"tube_tick",0.6,[-5.8,2.36,5.7]),light(13.0,"gate_tube","dying"),
  ent(13.3,"aarav",keep=True,headYaw=1.0),
  ent(17.5,"chudail",position=[0.4,0,-4.6]),
  ent(19.0,"aarav",keep=True,headYaw=0),
  sfx(21.8,"signal",0.28,[30,3,-20])])

AAR=[-0.6,0,14.5]
scene("p1_cross",12.8,[
  shot("toward_her","track_lateral",7,[0.0,1.1,17.4],[0.3,1.4,-4.6],to=[-0.2,1.1,8.3],exp=1.6),
  shot("onto_rails","static",3.5,[3.4,1.3,-0.6],[-0.4,1.0,1.6],fov=30,fovP=46,exp=1.9),
  shot("down_the_track","static",2.3,[-9,1.3,0.9],[-0.4,1.2,1.2],fov=16,fovP=24,exp=2.3,eye=0.6),
],[*BASE,*HIDE,ent(0,"chudail",position=[0.4,0,-4.6]),
  ent(0,"aarav",position=[-0.4,0,1.2],frm=AAR,speed=1.3),
  sfx(9.6,"train_horn",0.95,[-45,3,0])],
 tech=[{"use":"LGT-03","at":4.4,"light":"sodium_far","entity":"chudail"},{"use":"EDT-01","at":12.6}])

DAWN={"ambientIntensity":2.2,"fogDensity":0.022,"exposure":1.0,"moon":1.6,"fogColor":"#5b6672"}
scene("p1_dawn",9,[shot("empty_crossing","static",9,[7,3.2,9],[0,0.7,0],fov=34,fovP=52,exp=1.2)],
 [light(0,"sodium_far","off"),light(0,"sodium_near","off"),light(0,"gate_tube","off"),light(0,"sodium_deep","off"),
  ent(0,"aarav",False),ent(0,"chudail",False),*HIDE,{"at":0,"action":"fade","to":1,"duration":0.01},{"at":0.4,"action":"fade","to":0,"duration":2.5}],
 lighting=DAWN,amb={"ambience":[{"sound":"rain","volume":0.22}],"music":None})

scene("p1_turn",32,[
  shot("he_turns","static",3,[-0.2,1.55,19.2],[-0.6,1.35,14.5],fov=30,fovP=44),
  shot("walk_to_us","track_lateral",12,[-0.3,0.6,19.6],[-0.6,0.75,14.5],to=[-0.3,0.6,25.6],lookTo=[-0.6,0.75,21]),
  shot("two_shadows","slow_push",17,[-0.3,0.6,25.6],[-0.6,0.8,21],to=[-0.35,0.62,24.9]),
],[*BASE,*HIDE,ent(0,"chudail",position=[0.4,0,-4.6]),
  ent(0,"aarav",position=AAR,rotationY=PI),
  ent(0.6,"aarav",position=AAR,rotationY=0),
  light(3.4,"gate_tube","off"),sfx(3.4,"tube_tick",0.5,[-5.8,2.36,5.7]),
  ent(4.5,"aarav",position=[-0.6,0,21],frm=AAR,speed=0.62),
  ent(9.5,"chudail",shadowOnly=True,position=[-1.75,0,20.9],frm=[-1.75,0,17.2],speed=0.6)],
 tech=[{"use":"SND-03","at":9.6,"count":13,"hz":1.0,"other":"anklets","lag":0.08,"extra":1,"otherVolume":0.45,"otherFrom":[-1.75,0.1,19],"selfSilent":True,"volume":0}])

scene("p1_look",2.0,[
  shot("he_turns","static",0.8,[-0.45,1.55,23.4],[-0.6,1.4,21],fov=32,fovP=46),
  shot("her","static",1.2,[-0.18,1.72,21.55],[-0.62,1.6,20.35],fov=40,fovP=58,exp=1.6,eye=0.9),
],[*BASE,*HIDE,light(0,"gate_tube","off"),
  ent(0,"aarav",position=[-0.6,0,21],rotationY=PI),
  ent(0,"chudail",shadowOnly=False,position=[-0.62,0,20.35],rotationY=0),
  sfx(0.8,"capture_hit",1),light(0.9,"sodium_near","flicker")],
 tech=[{"use":"EDT-01","at":1.7}])

scene("p1_after",17,[shot("empty_road","slow_push",17,[3.5,5.5,30],[-0.5,0.5,14],to=[3.0,5.2,28.5])],
 [*BASE,light(0,"gate_tube","off"),*HIDE,ent(0,"aarav",False),ent(0,"chudail",False),
  {"at":0,"action":"fade","to":1,"duration":0.01},{"at":0.3,"action":"fade","to":0,"duration":2.5}],
 amb={"ambience":[{"sound":"rain","volume":0.5},{"sound":"night_drone","volume":0.3}],"music":None})

scene("p1_walk_on",20,[
  shot("keep_walking","track_lateral",13,[-0.3,0.6,25.6],[-0.6,0.8,21],to=[-0.3,0.6,33.5],lookTo=[-0.6,0.8,29]),
  shot("alone","static",7,[2.8,4.5,40],[-0.5,0.6,28],fov=34,fovP=50,exp=1.3),
],[*BASE,light(0,"gate_tube","off"),*HIDE,
  ent(0,"aarav",position=[-0.6,0,29.5],frm=[-0.6,0,21],speed=0.66),
  ent(0,"chudail",shadowOnly=True,position=[-1.75,0,20.9]),
  ent(3.5,"chudail",shadowOnly=True,position=[-1.5,0,46],frm=[-1.75,0,20.9],speed=1.5),
  ent(19,"chudail",False)],
 tech=[{"use":"SND-03","at":0.4,"count":16,"hz":1.0,"other":"anklets","lag":0.08,"otherVolume":0.35,"otherFrom":[-1.6,0.1,28],"selfSilent":True,"volume":0}])

scene("p1_end",12,[shot("crane_up","slow_push",12,[0.3,1.6,22],[0,0.8,0],to=[1.5,8.5,30],lookTo=[0,0.5,-4],fov=36,fovP=54,exp=1.3)],
 [*BASE,light(0,"gate_tube","off"),*HIDE,ent(0,"aarav",False),ent(0,"chudail",position=[0.7,0,-9.5]),
  {"at":5.5,"action":"title","visible":True},{"at":8,"action":"fade","to":0.55,"duration":4}])
