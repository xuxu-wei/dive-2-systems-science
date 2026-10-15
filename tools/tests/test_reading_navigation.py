"""Check concept destinations independently of grades and notebook identities."""
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from reading_navigation import reading_sections, attach_reading, bind_questions, decorate_reading
from teaching_markdown import markdown_to_html
from course_content import course_chapters


class Elements(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.ids = []; self.links = []; self.headings = []
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag == 'h2': self.headings.append(attrs.get('id'))


def loaded():
    return json.loads((ROOT / 'web/course/catalog.json').read_text(encoding='utf-8'))


def test_explicit_heading_anchor_renders_as_id_with_inline_bold_and_math():
    html = markdown_to_html('## **状态**与 $x$ {#state-sufficiency}\n\n讲解。')
    assert '<h2 id="state-sufficiency"><strong>状态</strong>与 $x$</h2>' in html
    assert '{#' not in html and 'anchor-link' not in html


@pytest.mark.parametrize('source', [
    '## 概念\n\n正文',
    '## A {#same}\n\n## B {#same}\n',
    '## A {#a}\n\n<!-- practice: unknown, -->',
    '## A {#a}\n\n<!-- explore -->\n<!-- explore -->',
])
def test_bad_source_references_are_rejected(source):
    with pytest.raises(ValueError): reading_sections(source)


def test_every_published_concept_has_a_real_heading_and_every_question_has_one_primary_destination():
    chapters = list(course_chapters(loaded()))
    lessons = [l for c in chapters for l in c['lessons'] if l.get('reading')]
    questions = {q['id']: q for c in chapters for l in c['lessons'] for q in l['questions']}
    expected = {q['id'] for l in lessons for q in l['questions']}
    bound = []
    for lesson in lessons:
        source = (ROOT / lesson['reading']).read_text(encoding='utf-8')
        page = Elements((ROOT / 'web/reading/pages' / (lesson['id'] + '.html')).read_text(encoding='utf-8'))
        concepts = lesson['concepts']
        assert [s['id'] for s in reading_sections(source)] == [c['id'] for c in concepts] == page.headings
        assert len(page.ids) == len(set(page.ids))
        for concept in concepts:
            assert concept['url'] == lesson['reading_url'] + '#' + concept['id']
            for qid in concept['question_ids']:
                question = questions[qid]; bound.append(qid)
                assert question['reading_url'] == concept['url']
                assert question['concept_title'] == concept['title']
                assert question['practice_url'] in page.links
            if concept['explore']:
                assert concept['explore_url'] in page.links
                assert parse_qs(urlsplit(concept['explore_url']).query)['concept'] == [concept['key']]
        assert '<!-- practice:' not in (ROOT / 'web/reading/pages' / (lesson['id'] + '.html')).read_text(encoding='utf-8')
    assert len(bound) == len(set(bound)) == len(expected) == 939
    assert set(bound) == expected


def test_cross_lesson_question_returns_to_the_actual_worked_explanation():
    intro = loaded()['introduction']
    question = next(q for l in intro['lessons'] for q in l['questions'] if q['id'] == 'p00-connections')
    assert question['reading_url'] == '/introduction/read/3/#chain-star-propagation'
    assert question['practice_url'].startswith('/introduction/practice/?question=')


def test_exploration_references_match_implemented_models():
    lessons = {l['id']: l for c in course_chapters(loaded()) for l in c['lessons']}
    for lesson_id in ['P01-C02-S02', 'P01-C03-S01']:
        assert not any(c['explore'] for c in lessons[lesson_id]['concepts'])
    assert {c['id'] for c in lessons['P01-C02-S01']['concepts'] if c['explore']} == {'duration-cumulative-transfer', 'segment-balance'}
    assert all(c['explore'] for c in lessons['P01-C03-S02']['concepts'])


def fixture_chapters():
    lesson = {'id': 'L1', 'number': '1.1.1', 'reading': 'source.md',
              'reading_url': '/chapter/read/1/',
              'questions': [{'id': 'q1', 'slug': 'one', 'title': '核对单位'}]}
    chapter = {'url': '/chapter/', 'visualization': True, 'lessons': [lesson]}
    attach_reading(lesson, chapter, '# 1.1.1 状态\n\n## 信息充分性 {#sufficient}\n\n正文\n\n<!-- practice: q1 -->\n\n<!-- explore -->\n')
    return [chapter]


def test_references_are_derived_without_modifying_question_source():
    chapters = fixture_chapters(); bind_questions(chapters)
    lesson = chapters[0]['lessons'][0]; question = lesson['questions'][0]
    source = '# 1.1.1 状态\n\n## 信息充分性 {#sufficient}\n\n正文\n\n<!-- practice: q1 -->\n\n<!-- explore -->\n'
    decorated = decorate_reading(source, lesson, {'q1': question})
    assert '<nav class="concept-practice"' in decorated
    assert 'href="/chapter/practice/?question=one"' in decorated
    assert 'concept=L1%3Asufficient' in decorated
    assert question['reading_url'] == '/chapter/read/1/#sufficient'


@pytest.mark.parametrize('mode', ['missing', 'unknown', 'duplicate'])
def test_missing_or_ambiguous_question_binding_fails_build(mode):
    chapters = fixture_chapters(); concept = chapters[0]['lessons'][0]['concepts'][0]
    if mode == 'missing': concept['question_ids'] = []
    if mode == 'unknown': concept['question_ids'] = ['q-other']
    if mode == 'duplicate': concept['question_ids'] = ['q1', 'q1']
    with pytest.raises(ValueError): bind_questions(chapters)


def test_presentation_names_do_not_change_existing_addresses():
    course = loaded(); part = course['parts'][0]
    assert part['title'] == '系统的描述与建模'
    assert part['url'] == '/parts/01-看见系统/'
    expected = {
        '1.1': ('系统的描述与测量', '/chapters/01-01-从生理现象提出系统问题/'),
        '1.3': ('反馈回路与延迟', '/chapters/01-03-反馈、延迟与层级/'),
        '1.4': ('模型结构与实验设计', '/chapters/01-04-模型假设与计算实验/'),
    }
    for chapter in part['chapters']:
        if chapter['id'] in expected:
            assert (chapter['title'], chapter['url']) == expected[chapter['id']]
