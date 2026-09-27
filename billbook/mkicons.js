// Renders PNG icons with zlib only. node mkicons.js
const zlib=require('zlib'),fs=require('fs');
function crc(b){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xFFFFFFFF;for(const x of b)r=t[(r^x)&255]^(r>>>8);return(r^0xFFFFFFFF)>>>0}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])}
function png(size,maskable){
  const S=4,W=size*S,px=new Uint8Array(W*W*3);
  const bg=[244,239,230],ink=[23,21,15],acc=[232,67,15];
  const k=(maskable?0.62:1);const u=v=>(0.5+(v-0.5)*k)*W; // scale content toward center
  const rr=(x,y,x0,y0,x1,y1,r)=>{if(x<x0||x>x1||y<y0||y>y1)return false;const cx=Math.min(Math.max(x,x0+r),x1-r),cy=Math.min(Math.max(y,y0+r),y1-r);return(x-cx)**2+(y-cy)**2<=r*r};
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
    let c=bg;
    if(!maskable&&!rr(x,y,0,0,W,W,W*0.22))c=bg; // (square background; OS masks)
    const fx=x/W,fy=y/W;
    const pg=rr(x,y,u(.234),u(.148),u(.766),u(.852),W*k*.086);
    if(pg){c=ink;
      // folded corner
      const cx0=.766,cy0=.625,cx1=.766,cy1=.852;
      if(fx<=.766&&fy>=.625&&fy<=.852&&fx>=.766-(fy-.625)*0.0+0){}
      if(fx>=(0.5+(.51-.5)*0)&&false){}
      const tx=(fx-.5)/k+.5,ty=(fy-.5)/k+.5;
      if(ty>=.625&&tx<=.766&&tx>=.766-(ty-.625)*1.0*(0.227/0.227)&&ty<=.852&&(tx+ty)>=(.766+.625)+0.0&&tx>=.516&&true)c=acc;
      const line=(x0,y0,x1,h,a)=>{const tx2=tx,ty2=ty;if(tx2>=x0&&tx2<=x1&&ty2>=y0&&ty2<=y0+h){c=a?[112,110,102]:bg}};
      line(.332,.293,.566,.059,false);line(.332,.418,.668,.059,true);line(.332,.543,.508,.059,true);
    }
    const i=(y*W+x)*3;px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];
  }
  const raw=Buffer.alloc(size*(size*3+1));
  for(let y=0;y<size;y++){raw[y*(size*3+1)]=0;for(let x=0;x<size;x++){let r=0,g=0,b=0;for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++){const i=((y*S+sy)*W+x*S+sx)*3;r+=px[i];g+=px[i+1];b+=px[i+2]}const o=y*(size*3+1)+1+x*3;raw[o]=r/16;raw[o+1]=g/16;raw[o+2]=b/16}}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
fs.writeFileSync('icon-192.png',png(192,false));fs.writeFileSync('icon-512.png',png(512,false));fs.writeFileSync('icon-maskable-512.png',png(512,true));
