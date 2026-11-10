"""Run after approval to send the English narration to Microsoft speech."""
from pathlib import Path
import sys, json, asyncio, subprocess, wave
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parents[1]/'.video-tools'))
import edge_tts, numpy as np, imageio_ffmpeg
B=P/'build-youthful';B.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
SC=json.loads((P/'narration-energy.json').read_text())
async def main():
 for i,s in enumerate(SC):
  dest=B/f'voice-{i}.mp3'
  await edge_tts.Communicate(s['text'],'en-US-GuyNeural',rate='+12%',pitch='+8Hz').save(str(dest))
  print(f'Voice {i+1}/8 ready',flush=True)
 # Recreate the same music/SFX, then swap only the narration.
 import importlib.util
 spec=importlib.util.spec_from_file_location('energetic',P/'render-energy.py')
 mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 mod.sound()
 sr=24000
 with wave.open(str(P/'build-energy/mix.wav'),'rb') as w:
  mix=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32767
 def decode(path,rate=1):
  cmd=[FF,'-v','error','-i',str(path)]
  if rate>1:cmd+=['-af',f'atempo={rate}']
  return np.frombuffer(subprocess.check_output(cmd+['-f','f32le','-ar',str(sr),'-ac','1','-']),dtype='<f4').copy()
 report=[]
 for i,s in enumerate(SC):
  old=decode(P/'build-energy'/f'voice-{i}.wav');rate=max(1,len(old)/sr/(s['end']-s['start']-.25))
  old=decode(P/'build-energy'/f'voice-{i}.wav',rate)
  old*=.68/max(.01,float(np.max(np.abs(old))))
  start=int((s['start']+.1)*sr);end=min(len(mix),start+len(old))
  indices=np.arange(start,end)
  fade=np.minimum(1,indices/sr)*np.minimum(1,(len(mix)-indices)/sr/1.3)*np.minimum(1,(len(mix)-indices)/sr/.65)
  mix[start:end]-=old[:end-start]*fade
  new=decode(B/f'voice-{i}.mp3');duration=len(new)/sr;rate=max(1,duration/(s['end']-s['start']-.25))
  new=decode(B/f'voice-{i}.mp3',rate);new*=.68/max(.01,float(np.max(np.abs(new))))
  end=min(len(mix),start+len(new));mix[start:end]+=new[:end-start]
  report.append({'scene':i,'seconds':duration,'fit_speed':rate})
 mix=np.clip(mix,-.96,.96)
 with wave.open(str(B/'mix.wav'),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
 subprocess.run([FF,'-y','-v','error','-i',str(P/'Too-Soon-Games-Energetic-EN.mp4'),'-i',str(B/'mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-t','60','-movflags','+faststart',str(P/'Too-Soon-Games-Young-Voice-EN.mp4')],check=True)
 (B/'report.json').write_text(json.dumps(report,indent=2))
 print('Youthful male voice version ready',flush=True)
if __name__=='__main__':asyncio.run(main())
