"""Archive supplied originals and encode WebP without cropping or resizing."""
from pathlib import Path
from hashlib import sha256
import json
import shutil
from PIL import Image

root = Path(__file__).resolve().parents[3]
report = Path(__file__).resolve().parent
source = Path.home() / 'Downloads'
names = ['luiza-opening', 'trust-coffee', 'family-profile', 'mei-office',
         'testimonial-main-reserved', 'testimonial-mei-reserved',
         'testimonial-company-reserved', 'luiza-about-editorial',
         'family-quote', 'luiza-portrait']
rows = []
(report / 'originals').mkdir(exist_ok=True)
for index, name in enumerate(names, 1):
    matches = list(source.glob(f'Imagem do ChatGPT 31 de out. de 2026, 12_50_*-{index}.png'))
    if len(matches) != 1:
        raise ValueError(f'Expected one original for {index}: {matches}')
    original = matches[0]
    archive = report / 'originals' / f'{name}.png'
    shutil.copyfile(original, archive)
    image = Image.open(original)
    used = 'reserved' not in name
    target = root / 'public' / 'images' / 'home' / f'{name}.webp' if used else None
    if target:
        image.save(target, 'WEBP', quality=92, method=6)
    rows.append(dict(number=index, supplied=original.name, width=image.width,
                     height=image.height, sha256=sha256(original.read_bytes()).hexdigest(),
                     original=archive.relative_to(root).as_posix(),
                     used=used, asset=target.relative_to(root).as_posix() if target else None))
(report / 'assets.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
