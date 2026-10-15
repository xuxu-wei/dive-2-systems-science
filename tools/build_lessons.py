"""Build web teaching from Markdown and the experiment's code and results."""
import base64
from html import escape
import json
from pathlib import Path
import re
from teaching_markdown import markdown_to_html
from reading_navigation import decorate_reading
from pygments import highlight
from pygments.lexers import PythonLexer
from pygments.formatters import HtmlFormatter
from course_content import course_chapters
ROOT = Path(__file__).resolve().parents[1]
DIRECTIVE = re.compile(r'<!-- experiment: ([\w-]+) (figure|code) -->')
def text(value):
    return ''.join(value) if isinstance(value, list) else value

def render_experiment(cell, lesson, assets, mode="figure"):
    parts = ['<section class="experiment-example">']
    if mode == 'code':
        parts.append(highlight(text(cell['source']), PythonLexer(), HtmlFormatter()))
    figures = 0
    for index, output in enumerate(cell.get('outputs', [])):
        if output.get('output_type') == 'error':
            raise ValueError(f'{lesson["id"]}: failed code output {cell["id"]}')
        data = output.get('data', {})
        if mode == 'figure' and 'image/png' not in data:
            continue
        if 'image/png' in data:
            figures += 1
            name = f'{lesson["id"]}-{cell["id"]}-{index}.png'
            (assets / name).write_bytes(base64.b64decode(text(data['image/png'])))
            parts.append(f'<figure><img src="/web/reading/assets/{name}" alt="{escape(lesson["title"])}：实验结果图" loading="lazy"></figure>')
        elif 'text/markdown' in data:
            parts.append('<div class="experiment-output">' + markdown_to_html(text(data['text/markdown'])) + '</div>')
        elif output.get('output_type') == 'stream':
            if output.get('name') == 'stdout':
                parts.append('<pre class="experiment-output">' + escape(text(output['text'])) + '</pre>')
        elif 'text/plain' in data and mode == 'code':
            plain = text(data['text/plain'])
            if not plain.startswith(('<Figure ', '<Axes:', '<matplotlib.')):
                parts.append('<pre class="experiment-output">' + escape(plain) + '</pre>')
    if mode == 'figure' and not figures:
        raise ValueError(f'{lesson["id"]}: no figure in cell {cell["id"]}')
    parts.append('</section>')
    return '\n'.join(parts)

def build(root=ROOT):
    course = json.loads((root / 'web/course/catalog.json').read_text(encoding='utf-8'))
    lessons = [(c,l) for c in course_chapters(course) for l in c['lessons'] if l.get('reading')]
    questions = {q['id']: q for c in course_chapters(course) for l in c['lessons'] for q in l['questions']}
    dest = root / 'web/reading/pages';dest.mkdir(parents=True,exist_ok=True)
    assets = root / 'web/reading/assets';assets.mkdir(parents=True,exist_ok=True)
    for index, (chapter, lesson) in enumerate(lessons):
        nb = json.loads((root / lesson['path']).read_text(encoding='utf-8'))
        cells = {c['id']:c for c in nb['cells'] if c['cell_type']=='code'}
        source = decorate_reading((root / lesson['reading']).read_text(encoding='utf-8'), lesson, questions)
        if source.count('<!-- experiment:') != len(DIRECTIVE.findall(source)):
            raise ValueError(f'{lesson["id"]}: choose figure or code for each experiment reference')
        sections=[];cursor=0
        for match in DIRECTIVE.finditer(source):
            sections.append(markdown_to_html(source[cursor:match.start()]))
            sections.append(render_experiment(cells[match[1]],lesson,assets, match[2]))
            cursor=match.end()
        sections.append(markdown_to_html(source[cursor:]))
        body='\n'.join(sections)
        body=re.sub(r'<a class="anchor-link"[^>]*>(?:¶|&#182;)</a>', '', body)
        actions=f'<a class="button primary" href="{lesson["notebook_url"]}" target="_blank" rel="noopener">打开 JupyterLab 实验 ↗</a><a class="button" href="{lesson["practice_url"]}">本节练习 · {len(lesson["questions"])} 题</a>'
        if chapter.get('visualization'):
            actions+=f'<a class="button" href="{chapter["url"]}explore/">可视化与探索</a>'
        adjacent=[]
        if index>0:
            prev=lessons[index-1][1];adjacent.append(f'<a href="{prev["reading_url"]}">← {escape(prev["number"])} {escape(prev["title"])}</a>')
        if index+1<len(lessons):
            nxt=lessons[index+1][1];adjacent.append(f'<a href="{nxt["reading_url"]}">{escape(nxt["number"])} {escape(nxt["title"])} →</a>')
        else:
            part_number = int(lesson['chapter_id'].split('.')[0])
            following = next((p for p in course['parts'] if int(p['id']) > part_number), None)
            if following:
                adjacent.append(f'<a href="{following["url"]}">继续：第 {following["id"]} 篇 {escape(following["title"])} →</a>')
        html=f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(lesson['number'])} {escape(lesson['title'])} · 动手学系统科学</title>
<link rel="stylesheet" href="/web/shared/theme.css"><link rel="stylesheet" href="/web/shared/course-shell.css">
<link rel="stylesheet" href="/web/reading/style.css"><link rel="stylesheet" href="/web/vendor/katex/katex.min.css">
<script defer src="/web/vendor/katex/katex.min.js"></script><script defer src="/web/vendor/katex/contrib/auto-render.min.js"></script>
</head><body class="reading-page"><main id="main" data-lesson="{lesson['id']}">
<div id="loading-note" class="notice" role="status" hidden></div>
<div class="reading-actions">{actions}</div>
<div class="reading-layout"><article id="lesson-content">{body}
<nav class="lesson-neighbors" aria-label="前后小节">{''.join(adjacent)}</nav></article>
<aside class="reading-toc" aria-label="本节内容"><p>本节内容</p><nav id="lesson-toc"></nav></aside></div>
</main><script src="/web/shared/boot.js"></script><script type="module" src="/web/reading/app.mjs" data-main></script></body></html>"""
        (dest / (lesson['id']+'.html')).write_text(html,encoding='utf-8',newline='\n')
    (root/'web/reading/code.css').write_text(HtmlFormatter(style='monokai').get_style_defs('.highlight'),encoding='utf-8')
    print(f'Web lessons: {len(lessons)}; experiment code and results linked by cell ID.')
    return lessons

if __name__=='__main__':
    from build_course import build as build_course
    build_course()
    build()
