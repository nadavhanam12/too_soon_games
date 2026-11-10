from pathlib import Path
import sys,json,asyncio
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P.parents[1]/'.video-tools'))
import edge_tts
async def main():
 (P/'build').mkdir(exist_ok=True)
 for i,s in enumerate(json.loads((P/'narration.json').read_text())):
  await edge_tts.Communicate(s['text'],'en-US-GuyNeural',rate='+12%',pitch='+8Hz').save(str(P/'build'/f'voice-{i}.mp3'))
  print(f'Voice {i+1}/8',flush=True)
if __name__=='__main__':asyncio.run(main())
