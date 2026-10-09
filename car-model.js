// Kenney Car Kit sedan: real mesh rendered once from an elevated rear camera.
// Keep its rendered aspect ratio; do not squash a top-down sprite to fit the road.
export async function loadCarModel() {
  const response = await fetch('./assets/sedan-mesh.json');
  if (!response.ok) throw new Error('Car model could not be loaded');
  const faces = await response.json();
  const angle = 28 * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const project = ([x,y,z]) => {
    const depth = 7 + z*c - (y-.4)*s;
    return [680*x/depth, -680*((y-.4)*c+z*s)/depth, depth];
  };
  const polygons = faces.map(f => ({...f, points:f.p.map(project)}));
  const points = polygons.flatMap(f=>f.points);
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const image=document.createElement('canvas');
  image.width=Math.ceil(maxX-minX+12);image.height=Math.ceil(maxY-minY+12);
  const ctx=image.getContext('2d');
  polygons.sort((a,b)=>b.points.reduce((n,p)=>n+p[2],0)-a.points.reduce((n,p)=>n+p[2],0));
  for(const f of polygons) {
    const light=.68+.32*Math.max(0,f.n[0]*-.4+f.n[1]*.8+f.n[2]*-.45);
    ctx.fillStyle=`rgb(${f.c.map(v=>Math.round(v*light)).join(',')})`;
    ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0]-minX+6,p[1]-minY+6):ctx.moveTo(p[0]-minX+6,p[1]-minY+6));ctx.closePath();ctx.fill();
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.4;ctx.stroke();
  }
  return image;
}
