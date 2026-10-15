"""Validate real anchors without mistaking mathematical application for links."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_teaching import check_page_routes, html_links, markdown_links
from teaching_markdown import markdown_to_html


def test_math_and_code_do_not_create_links():
    source = r"""$$
[\mathcal K(\alpha g+\beta h)](s)
$$

$[g](s)$

`[inline](fake-inline/)`

```python
[code](fake-code/)
```

[正文](/chapters/14-03-Koopman%20表示与有限字典/read/1/)
"""
    route = '/chapters/14-03-Koopman 表示与有限字典/read/1/'
    destinations = markdown_links(source)
    assert len(destinations) == 1
    assert destinations[0].startswith('/chapters/14-03-Koopman%20')
    check_page_routes(markdown_to_html(source), {route})


def test_real_html_and_markdown_anchors_are_collected():
    html = markdown_to_html('[练习](/practice/?question=example&view=answer)')
    html += '<a href="http://127.0.0.1:8000/notebook/?id=example">实验</a>'
    assert html_links(html) == [
        '/practice/?question=example&view=answer',
        'http://127.0.0.1:8000/notebook/?id=example',
    ]
    check_page_routes(html, {'/practice/', '/notebook/'})


@pytest.mark.parametrize('destination', [
    '/missing/',
    'http://127.0.0.1:8000/missing/',
])
def test_real_missing_routes_still_fail(destination):
    html = markdown_to_html(f'[失效入口]({destination})')
    with pytest.raises(AssertionError, match='missing'):
        check_page_routes(html, {'/catalog/'})


def test_external_links_and_local_fragments_are_not_page_routes():
    html = markdown_to_html('[参考](https://example.org/paper) [段落](#definition)')
    assert len(html_links(html)) == 2
    check_page_routes(html, set())
