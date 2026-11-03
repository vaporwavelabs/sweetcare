import json,sys
src=open('src.html').read(); a=json.load(open('assets.json'))
open('index.html','w').write(src.replace('__ASSETS__', json.dumps(a)))
