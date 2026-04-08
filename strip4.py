import re

with open('backend.cpp', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix block structured bindings
text = re.sub(r'for\s*\(\s*const\s+auto&\s*\[\s*([\w]+)\s*,\s*([\w]+)\s*\]\s*:\s*([\w]+)\s*\)\s*\{',
              r'for (const auto& pair : \3) {\n            auto \1 = pair.first;\n            auto \2 = pair.second;', text)

# Fix one-liner push_back
text = re.sub(r'for\s*\(\s*const\s+auto&\s*\[\s*([\w]+)\s*,\s*([\w]+)\s*\]\s*:\s*([\w]+)\s*\)\s*([\w]+)\.push_back\(([\w]+)\);',
              r'for (const auto& pair : \3) { auto \1 = pair.first; auto \2 = pair.second; \4.push_back(\5); }', text)

# Fix one-liner stream
text = re.sub(r'for\s*\(\s*const\s+auto&\s*\[\s*([\w]+)\s*,\s*([\w]+)\s*\]\s*:\s*([\w]+)\s*\)\s*oss\s*<<([^;]+);',
              r'for (const auto& pair : \3) { auto \1 = pair.first; auto \2 = pair.second; oss <<\4; }', text)

with open('backend.cpp', 'w', encoding='utf-8') as f:
    f.write(text)
