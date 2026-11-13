"""Refresh public name labels only. No game ratings or real-world stats are imported.
Refresh within 30 days of using NEXON metadata; see its official API notice.
Run this, then `python3 scripts/update-player-names.py` to rebuild the offline index.
"""
import collections, csv, datetime, io, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
KO='https://open.api.nexon.com/static/fconline/meta/spid.json'
EN='https://raw.githubusercontent.com/Basche14/EAFC26/main/ea_fc26_players.csv'
def download(url):return subprocess.check_output(['curl','-fsSL','--max-time','55',url]).decode('utf-8-sig')
names=collections.defaultdict(set)
for row in json.loads(download(KO)):names[int(row['id'])%1000000].add(row['name'])
leagues={'Premier League':'epl','Bundesliga':'bundesliga','Serie A Enilive':'serie-a','LALIGA EA SPORTS':'la-liga',"Ligue 1 McDonald's":'ligue-1'}
players=[]
for row in csv.DictReader(io.StringIO(download(EN))):
    if row['leagueName'] not in leagues:continue
    english=row['commonName'].strip() or ' '.join(filter(None,[row['firstName'].strip(),row['lastName'].strip()]))
    players.append({'sourceId':int(row['id']),'en':english,'aliases':sorted(names[int(row['id'])]),'league':leagues[row['leagueName']]})
if len(players)<2000 or any(not p['aliases'] for p in players):raise ValueError('Incomplete snapshot; existing file preserved')
output={'sources':[KO,'https://github.com/Basche14/EAFC26/blob/main/ea_fc26_players.csv'],'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'FC26 dataset snapshot; not a verified 2026/27 squad list','players':players}
path=ROOT/'scripts/player-name-five-leagues.json';temp=path.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(path)
print('Updated name labels for',len(players),'players')
