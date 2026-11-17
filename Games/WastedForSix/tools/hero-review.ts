import { prims, grounds, lamps, PLACES, BMIN, BMAX } from '../src/city';
import type { Frame } from '../src/world3d-api';
import '../src/lazy/world3d';
const params = new URLSearchParams(location.search);
const look = params.get('look') === '4' ? 4 : 3;
const world = window.__w6world3d!.create({ prims, grounds, lamps, places: PLACES, bmin:BMIN, bmax:BMAX });
document.body.append(world.canvas);
world.canvas.style.cssText = 'width:100%;height:100%;object-fit:contain';
const x = PLACES.home.x, y = PLACES.home.y;
const f:Frame={w:1000,h:740,t:0,dusk:look===4?1:0,look,cam:{x,y,zoom:45,px:x,py:y,a:0,pull:0,k:.62,sp:0},cars:[{id:0,kind:'player',x,y,a:-.6,empty:true}],walker:{x:x+4,y:y-1,a:2.1,step:0},helis:[],hrs:[],picks:[],letters:[],peds:[],pending:[],fx:[]};
let start=performance.now();
function draw(t:number){f.t=(t-start)/1000;f.walker!.step=f.t*5;world.render(f);requestAnimationFrame(draw)}
requestAnimationFrame(draw);
