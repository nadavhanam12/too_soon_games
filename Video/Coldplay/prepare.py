from pathlib import Path
import sys, json, asyncio, re, html
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.video-tools'))
import requests, edge_tts
OUT = Path(__file__).resolve().parent
BUILD = OUT / 'build'
BUILD.mkdir(exist_ok=True)
scenes = [
  [0,7,'00:00','האינטרנט מצא על מה לדבר','יש רגעים שהאינטרנט פשוט לא משחרר. אוספים אירועים חמים, והפעם: המצלמה בהופעה של קולדפליי.'],
  [7,15,'02:00','רגע… יש פה משחק','עוברים יחד על המועמדים, כל אחד מהמקום שלו. בוחרים סיפור מוכר, מצחיק, שאפשר להפוך למשחק.'],
  [15,23,'05:00','בונים יחד. מכל מקום.','מכינים יחד אב טיפוס. המטרה פשוטה: לברוח מהמצלמה לפני שעולים למסך. בודקים בטלפון ומשפרים.'],
  [23,30,'08:00','צריך כוס יותר גדולה','מנסים להתחבא מאחורי כוס. לא עבד. עוד ניסיון! ובמקביל, מכינים את הרגע המצחיק לקליפ.'],
  [30,38,'12:00','הסיפור עוד חם. המשחק באוויר.','מעלים את המשחק, מפיצים קליפים וקישור בקהילות ובעמודי הומור. נכנסים ישר למשחק, ומשתפים תוצאה עם חברים.'],
  [38,48,'24:00','זה כבר יצא מהקבוצה שלנו','ככה נראית ההצלחה שאנחנו מכוונים אליה: מיליון צפיות בתוכן, עשרים אלף כניסות למשחק, בתוך יממה מהאירוע.'],
  [48,56,'48:00','מהרגע הוויראלי — לכתבה עלינו','ותוך יומיים, גם המשחק שלנו הופך לכתבה. מתראיינים מרחוק. רק רגע, אתה על מיוט!'],
  [56,60,'48:01','נמצא האירוע הבא','ומחר? לאינטרנט בטוח יהיה עוד רעיון בשבילנו.']
]
(OUT/'scenes.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf-8')
async def speech():
    for i,s in enumerate(scenes):
        dest = BUILD/f'voice-{i}.mp3'
        if not dest.exists() or dest.stat().st_size == 0:
            await edge_tts.Communicate(s[4], 'he-IL-AvriNeural', rate='+5%').save(str(dest))
        print('Narration',i,flush=True)
def photo():
    url='https://www.goodmorningamerica.com/living/story/woman-center-viral-kiss-cam-moment-coldplay-concert-128515934'
    imgurl='https://s.abcnews.com/images/GMA/coldplay-ht-jt-250718_1752850017182_hpMain_4x5_608.jpg'
    img=requests.get(imgurl,timeout=40); img.raise_for_status()
    (OUT/'event-source.jpg').write_bytes(img.content)
    (OUT/'sources.json').write_text(json.dumps({'article':url,'image':imgurl,'context':'Coldplay audience-camera incident, July 2025. Actual editorial reference; all game traction and TV coverage are fictional success scenarios.'},indent=2),encoding='utf-8')
    print('Editorial reference downloaded',flush=True)
if __name__=='__main__':
    if '--photo' in sys.argv: photo()
    else: asyncio.run(speech())
