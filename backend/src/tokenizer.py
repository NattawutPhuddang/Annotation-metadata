import os
from pythainlp.tokenize import word_tokenize, dict_trie
from pythainlp.corpus import thai_words
from pythainlp.util import Trie

# 1. โหลดคำศัพท์พื้นฐานของไทยมาก่อน
custom_words = set(thai_words())

# 2. อ่านไฟล์ custom_dict.txt ที่เราสร้างไว้
# (หา path ของไฟล์ โดยอิงจากที่อยู่ของไฟล์โค้ดปัจจุบัน)
current_dir = os.path.dirname(os.path.abspath(__file__))
# สมมติว่า custom_dict.txt อยู่นอก folder src หนึ่งชั้น (อยู่ที่ root ของ backend)
dict_path = os.path.join(current_dir, '..', 'custom_dict.txt')

if os.path.exists(dict_path):
    with open(dict_path, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip()
            if word:
                custom_words.add(word)

# 3. สร้าง Trie ใหม่ที่รวมคำศัพท์มาตรฐาน + คำศัพท์ใหม่ของเรา
custom_trie = Trie(custom_words)

def tokenize(text):
    if not text:
        return []
    
    # 4. ส่ง custom_dict เข้าไปในฟังก์ชัน word_tokenize
    # engine='newmm' คือตัวตัดคำมาตรฐานที่รองรับ custom_dict
    return word_tokenize(text, engine='newmm', custom_dict=custom_trie, keep_whitespace=False)