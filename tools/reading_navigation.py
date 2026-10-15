"""Bind concepts, practice and exploration without changing question identity."""
from html import escape
import re
from urllib.parse import urlencode

HEADING = re.compile(r'^## (.+?) \{#([a-z][a-z0-9-]*)\}\s*$', re.M)
PRACTICE = re.compile(r'<!-- practice: ([\w-]+(?: [\w-]+)*) -->')
EXPLORE = re.compile(r'<!-- explore -->')


def reading_sections(source):
    headings = list(HEADING.finditer(source))
    if len(headings) != len(re.findall(r'^## ', source, re.M)):
        raise ValueError('Every reading heading needs a stable concept anchor')
    if len({m[2] for m in headings}) != len(headings):
        raise ValueError('Duplicate reading concept anchor')
    sections = []
    for index, match in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(source)
        body = source[match.end():end]
        references = list(PRACTICE.finditer(body))
        if body.count('<!-- practice:') != len(references):
            raise ValueError('Invalid practice reference')
        if len(EXPLORE.findall(body)) > 1:
            raise ValueError('Duplicate exploration reference')
        sections.append({'id': match[2], 'title': match[1],
                         'question_ids': [q for m in references for q in m[1].split()],
                         'explore': bool(EXPLORE.search(body)),
                         'start': match.end(), 'end': end})
    return sections


def attach_reading(lesson, chapter, source):
    title = re.search(r'^# (.+)$', source, re.M)[1]
    prefix = lesson['number'] + ' '
    if not title.startswith(prefix):
        raise ValueError(f'Reading title does not match lesson number: {lesson["id"]}')
    lesson['title'] = title[len(prefix):]
    lesson['concepts'] = []
    for section in reading_sections(source):
        concept = {key: section[key] for key in ['id', 'title', 'question_ids', 'explore']}
        concept['key'] = lesson['id'] + ':' + section['id']
        concept['url'] = lesson['reading_url'] + '#' + section['id']
        if section['explore']:
            if not chapter['visualization']:
                raise ValueError('Exploration reference without an exploration page')
            concept['explore_url'] = chapter['url'] + 'explore/?' + urlencode({'concept': concept['key']})
        lesson['concepts'].append(concept)


def bind_questions(chapters):
    chapters = list(chapters)
    entries = [(chapter, lesson) for chapter in chapters for lesson in chapter['lessons']]
    questions = {q['id']: q for _, lesson in entries for q in lesson['questions']}
    practice = {q['id']: chapter['url'] + 'practice/?' + urlencode({'question': q['slug']})
                for chapter, lesson in entries for q in lesson['questions']}
    expected = {q['id'] for _, lesson in entries if lesson.get('reading') for q in lesson['questions']}
    bound = set()
    for _, lesson in entries:
        for concept in lesson.get('concepts', []):
            for qid in concept['question_ids']:
                if qid not in expected or qid in bound:
                    raise ValueError(f'Unknown or duplicate concept question reference: {qid}')
                questions[qid].update(reading_url=concept['url'], concept_title=concept['title'],
                                      practice_url=practice[qid])
                bound.add(qid)
    if bound != expected:
        raise ValueError(f'Missing concept question references: {sorted(expected - bound)}')


def decorate_reading(source, lesson, questions):
    concepts = {c['id']: c for c in lesson['concepts']}
    for section in reversed(reading_sections(source)):
        body = source[section['start']:section['end']]
        def practice_links(match):
            links = ''.join(f'<li><a href="{escape(questions[qid]["practice_url"], quote=True)}">{escape(questions[qid]["title"])}</a></li>'
                            for qid in match[1].split())
            return '<nav class="concept-practice" aria-label="相关练习"><span>相关练习</span><ul>' + links + '</ul></nav>'
        body = PRACTICE.sub(practice_links, body)
        concept = concepts[section['id']]
        if section['explore']:
            body = EXPLORE.sub('<p class="concept-explore"><a href="' + escape(concept['explore_url'], quote=True)
                               + '">可视化与探索：' + escape(concept['title']) + ' →</a></p>', body)
        source = source[:section['start']] + body + source[section['end']:]
    return source
