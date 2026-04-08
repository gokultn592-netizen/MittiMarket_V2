import re

with open('backend.cpp', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'#include <mutex>', '', text)
text = re.sub(r'std::mutex\s+\w+;', '', text)
text = re.sub(r'mutable std::mutex\s+\w+;', '', text)
text = re.sub(r'std::lock_guard<std::mutex>\s+\w+\(\w+\);', '', text)

with open('backend.cpp', 'w', encoding='utf-8') as f:
    f.write(text)
