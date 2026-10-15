"""Render mathematical teaching prose with Chinese-adjacent emphasis."""
from nbconvert.filters.markdown_mistune import IPythonRenderer, MarkdownWithMath

# CommonMark closes emphasis differently when punctuation touches a letter.
# Parse complete paired strong spans so a closing marker cannot become an opener.
# This also permits **术语（English）** immediately followed by Chinese prose.
CJK_STRONG = r"(?<!\*)\*\*(?!\*)(?P<cjk_strong_body>(?=\S)(?:(?!\*\*|\n).)*?[^\s*])\*\*(?!\*)"


def _parse_cjk_strong(inline, match, state):
    child = state.copy()
    child.src = match.group('cjk_strong_body')
    state.append_token({'type': 'strong', 'children': inline.render(child)})
    return match.end()


def markdown_to_html(source):
    parser = MarkdownWithMath(renderer=IPythonRenderer(escape=False, exclude_anchor_links=True))
    parser.inline.register('cjk_strong', CJK_STRONG, _parse_cjk_strong, before='emphasis')
    return parser.render(source)
