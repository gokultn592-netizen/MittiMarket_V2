import os
import re

def strip_all():
    directory = r'd:\\Tamilmani Works'
    for root, dirs, files in os.walk(directory):
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                orig = content
                
                if file.endswith('.html'):
                    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
                elif file.endswith('.css'):
                    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                elif file.endswith('.js') or file.endswith('.cpp'):
                    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                    # Use negative lookbehind to avoid matching URLs
                    content = re.sub(r'(?<!:)//.*', '', content)
                    
                if content != orig:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Cleaned {file}")
            except Exception as e:
                pass

strip_all()
