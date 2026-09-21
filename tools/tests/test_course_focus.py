import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_course import teaching_focus


def test_overview_uses_student_focus_instead_of_verification_answers():
    source = ('- **核验与反馈**：E2 两段末应为 7 U、11 U；检查判题记录。\n'
              '- **教学重难点**：流率乘以时长得到累计量，内部转移在整体收支中相消。\n')
    assert teaching_focus(source, '1.2') == '流率乘以时长得到累计量，内部转移在整体收支中相消。'


@pytest.mark.parametrize('source', [
    '- **核验与反馈**：应为 7 U、11 U。\n',
    '- **教学重难点**：   \n- **核验与反馈**：程序通过。\n',
])
def test_missing_student_focus_fails_without_maintenance_fallback(source):
    with pytest.raises(ValueError, match='1.2 缺少面向学生的教学重难点'):
        teaching_focus(source, '1.2')
