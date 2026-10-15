"""Cross-check web teaching, original experiments and local Lab routing."""
import json
import re
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit
from types import SimpleNamespace
import pytest
from systems_science.notebook_lab import NotebookLab
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from build_lessons import DIRECTIVE, render_experiment
from teaching_markdown import markdown_to_html
from course_content import course_chapters
ROOT=Path(__file__).resolve().parents[2]
COURSE=json.loads((ROOT/'web/course/catalog.json').read_text(encoding='utf-8'))
LESSONS=[l for c in course_chapters(COURSE) for l in c['lessons'] if l.get('reading')]


def test_migration_covers_intro_first_twelve_parts_and_keeps_later_lessons_available():
    assert len(LESSONS)==151
    assert {l['chapter_id'].split('.')[0] for l in LESSONS}=={'0','1','2','3','4','5','6','7','8','9','10','11','12'}
    for c in course_chapters(COURSE):
        for l in c['lessons']:
            assert (ROOT/l['path']).is_file()
            assert l['notebook_url']=='/notebook/?id='+l['id']
            assert l['url']==l.get('reading_url',l['notebook_url'])
            assert '/practice/?question=' in l['practice_url']


@pytest.mark.parametrize('lesson',LESSONS,ids=lambda l:l['id'])
def test_web_source_selects_explanatory_figures_without_copying_experiment_code(lesson):
    nb=json.loads((ROOT/lesson['path']).read_text(encoding='utf-8'))
    source=(ROOT/lesson['reading']).read_text(encoding='utf-8')
    assert nb['metadata']['teaching_format']=='experiment'
    assert all(c.get('metadata',{}).get('teaching_role')!='local_service' for c in nb['cells'])
    code={c['id'] for c in nb['cells'] if c['cell_type']=='code'}
    assert {m[0] for m in DIRECTIVE.findall(source)} <= code
    assert source.count('<!-- experiment:') == len(DIRECTIVE.findall(source))
    page=(ROOT/'web/reading/pages'/ (lesson['id']+'.html')).read_text(encoding='utf-8')
    assert '<h1' in page and 'target="_blank"' in page
    assert lesson['notebook_url'] in page and lesson['practice_url'] in page
    assert 'anchor-link' not in page and '**' not in page
    assert 'experiment-output' not in page and 'figure-code' not in page
    if lesson['id'] == 'P04-C04-S03':
        assert 'Decimal' in source and source.count('```python') == 1
    else:
        assert 'class="highlight"' not in page
    assert all('## 练习与参考资料' not in ''.join(c['source']) for c in nb['cells'])
    if lesson['id'].startswith(('P10', 'P11', 'P12')):
        prose = '\n'.join(''.join(c['source']) for c in nb['cells'] if c['cell_type'] == 'markdown')
        returns = re.findall(r'\[返回网页讲解\]\(([^)]+)\)', prose)
        assert len(returns) == 2
        assert all(not any(char.isspace() for char in url) for url in returns)
        assert all(unquote(urlsplit(url).path) == unquote(lesson['reading_url']) for url in returns)



def test_lab_reuses_process_and_opens_unique_workspaces_with_unicode_paths():
    lab=NotebookLab(ROOT);lab.process=SimpleNamespace(poll=lambda:None)
    lab.base_url='http://127.0.0.1:8899';lab.token='test-token'
    path=ROOT/LESSONS[0]['path']
    first,second=lab.open_url(path),lab.open_url(path)
    assert first!=second
    assert unquote(urlsplit(first).path).endswith(path.relative_to(ROOT/'notebooks').as_posix())
    assert '/lab/workspaces/experiment-' in first
    assert urlsplit(first).query=='token=test-token'
    with pytest.raises(ValueError):lab.open_url(ROOT/'README.md')
    with pytest.raises(ValueError):lab.open_url(ROOT/'notebooks/../README.md')


def test_project_kernel_wins_over_environment_defaults(tmp_path, monkeypatch):
    from jupyter_client.kernelspec import KernelSpecManager
    from systems_science import notebook_lab as module
    captured = {}
    real_popen = module.subprocess.Popen
    def launch(*args, **kwargs):
        captured.update(kwargs)
        return SimpleNamespace(poll=lambda: None)
    class Ready:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
    monkeypatch.setattr(module.subprocess, 'Popen', launch)
    monkeypatch.setattr(module, 'urlopen', lambda *a, **k: Ready())
    lab = NotebookLab(tmp_path)
    try:
        lab._open('实验.ipynb')
        monkeypatch.setattr(module.subprocess, 'Popen', real_popen)
        for name in ['JUPYTER_PATH', 'JUPYTER_DATA_DIR', 'JUPYTER_CONFIG_DIR', 'IPYTHONDIR']:
            monkeypatch.setenv(name, captured['env'][name])
        monkeypatch.setenv('JUPYTER_PREFER_ENV_PATH', '1')
        spec = KernelSpecManager().get_kernel_spec('python3')
        assert spec.display_name == 'Python · 动手学系统科学'
        assert spec.argv[0] == sys.executable
        assert spec.env['PYTHONPATH'] == str(tmp_path / 'src')
    finally:
        lab.process = None
        lab.close()


@pytest.mark.parametrize('source,label', [
    ('**系统科学（systems science）**研究相互作用。', '系统科学（systems science）'),
    ('这里的**模型（model）**是问题的表示。', '模型（model）'),
    ('**状态（state）**包含充分信息。', '状态（state）'),
    ('**负反馈（negative feedback）**抵消变化。', '负反馈（negative feedback）'),
])
def test_chinese_adjacent_bold_is_an_actual_strong_element(source, label):
    html = markdown_to_html(source)
    assert f'<strong>{label}</strong>' in html
    assert '**' not in html


def test_bold_extension_preserves_code_math_escapes_and_link_destinations():
    source = r'`**模型（model）**是` $a**b$ \*\*原样\*\* [模型](https://example.org/**x**/是)'
    html = markdown_to_html(source)
    assert '<code>**模型（model）**是</code>' in html
    assert '$a**b$' in html and '**原样**' in html
    assert 'href="https://example.org/**x**/是"' in unquote(html)
    assert '<strong>' not in html


def test_figure_reference_does_not_publish_code_or_neighboring_machine_output(tmp_path):
    import base64
    cell = {'id': 'plot', 'source': 'internal_plot_code()', 'outputs': [
        {'output_type': 'stream', 'name': 'stdout', 'text': 'machine-only output'},
        {'output_type': 'display_data', 'data': {'image/png': base64.b64encode(b'image bytes').decode()}},
    ]}
    html = render_experiment(cell, {'id': 'example', 'title': '解释图'}, tmp_path, 'figure')
    assert '<img ' in html and (tmp_path / 'example-plot-1.png').read_bytes() == b'image bytes'
    assert 'internal_plot_code' not in html and 'machine-only output' not in html
    assert '<pre' not in html and '<details' not in html


def test_bold_does_not_spill_into_the_sentence_between_two_terms():
    source = '**输入（input）**。环境属于输入。**参数（parameter）**决定比例。'
    assert markdown_to_html(source) == '<p><strong>输入（input）</strong>。环境属于输入。<strong>参数（parameter）</strong>决定比例。</p>\n'
