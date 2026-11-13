"""Build offline Korean football-name aliases from Wikidata (CC0) and Wikipedia.
Run: python3 scripts/update-player-names.py [--input /path/to/wdqs-results.json]
No Highlightly calls, player IDs or match statistics are imported.
"""
import argparse, collections, datetime, json, pathlib, re, unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--input',type=pathlib.Path,nargs='+');args=parser.parse_args()
if args.input:
    source={'results':{'bindings':[row for path in args.input for row in json.loads(path.read_text())['results']['bindings']]}}
else:
    existing=json.loads((ROOT/'src/data/player-names.ko.json').read_text())
    source={'results':{'bindings':[{'player':{'value':'http://www.wikidata.org/entity/'+p['wikidata']},'ko':{'value':p['ko']},'en':{'value':p['en']}} for p in existing['players'] if p.get('wikidata')]}}
def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',value).lower() if not unicodedata.combining(c) and c.isalnum())
league_source=json.loads((ROOT/'scripts/player-name-leagues.ko.json').read_text())
wiki=json.loads((ROOT/'scripts/player-name-wikipedia.ko.json').read_text())
leagues=collections.defaultdict(set)
for row in league_source['players']:leagues[norm(row['ko'])].update(row['leagues'])
players={}
for binding in source['results']['bindings']:
    if not binding.get('en'): continue
    ko=binding['ko']['value'];en=binding['en']['value'];qid=binding['player']['value'].rsplit('/',1)[1]
    if not re.fullmatch('Q[1-9][0-9]*',qid):raise ValueError('Invalid Wikidata identifier')
    players[(norm(ko),norm(en))]={'ko':ko,'en':en,'wikidata':qid}
for row in wiki:
    key=(norm(row['ko']),norm(row['en']))
    if key not in players:players[key]={'ko':row['ko'],'en':row['en'],'wikipedia':row['path']}
if len(players)<5000:raise ValueError('Incomplete input; keeping existing dictionary')
five=json.loads((ROOT/'scripts/player-name-five-leagues.json').read_text())
for player in five['players']:
    for ko in player['aliases']:
        key=(norm(ko),norm(player['en']))
        if key not in players:players[key]={'ko':ko,'en':player['en'],'source':'five-league-name-snapshot'}
known={key[0] for key in players}
coverage={league:sum(key in known for key,values in leagues.items() if league in values) for league in league_source['categories']}
missing=[row for row in league_source['players'] if norm(row['ko']) not in known]
output={'sources':[{'url':'https://www.wikidata.org','license':'CC0-1.0'},{'url':'https://ko.wikipedia.org','license':'CC BY-SA 4.0'},{'url':'https://open.api.nexon.com/static/fconline/meta/spid.json','usage':'Korean name labels only'},{'url':'https://github.com/Basche14/EAFC26','usage':'English name labels and snapshot league grouping only'}],'fiveLeagueSnapshotCounts':dict(collections.Counter(p['league'] for p in five['players'])),'fiveLeagueMissingAliases':sum(not p['aliases'] for p in five['players']),'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'coverage':coverage,'players':sorted(players.values(),key=lambda p:(p['ko'],p['en']))}
path=ROOT/'src/data/player-names.ko.json';temp=path.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(path)
(ROOT/'scripts/player-name-unresolved.ko.json').write_text(json.dumps(missing,ensure_ascii=False,separators=(',',':'))+'\n')
print('Saved',len(players),'name aliases; league coverage',coverage,'unresolved category entries',len(missing),flush=True)
