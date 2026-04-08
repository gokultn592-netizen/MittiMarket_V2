import os, re
dir_path = r"d:\Tamilmani Works"
for file in os.listdir(dir_path):
    path = os.path.join(dir_path, file)
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        orig = content
        if file.endswith(".html"):
            content = re.sub(r'<!--[\s\S]*?-->', '', content)
        elif file.endswith(".css"):
            content = re.sub(r'/\*[\s\S]*?\*/', '', content)
        elif file.endswith(".js"):
            # Strip block comments
            content = re.sub(r'/\*[\s\S]*?\*/', '', content)
            # Strip JS line comments but preserve URLs. 
            # We match // and everything till end of line, ONLY if not immediately following a colon
            content = re.sub(r'(?<!:)//.*', '', content)
        elif file.endswith(".cpp"):
            content = re.sub(r'/\*[\s\S]*?\*/', '', content)
            content = re.sub(r'//.*', '', content)
            
        if content != orig:
            # remove blank lines optionally
            content = "\n".join([line for line in content.split("\n") if line.strip() != ""])
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print("Stripped:", file)
