import sys
import json
import io

# ตั้งค่า encoding เป็น utf-8 เพื่อป้องกันปัญหาภาษาไทยใน Windows Console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

try:
    from pythainlp import word_tokenize
except ImportError:
    print(json.dumps({"error": "PyThaiNLP not installed. Run 'pip install pythainlp'"}))
    sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        text = sys.argv[1]
        try:
            # ตัดคำและส่งคืนเป็น JSON Array
            tokens = word_tokenize(text, engine="newmm")
            print(json.dumps(tokens))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    else:
        print(json.dumps([]))