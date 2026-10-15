"""Human-written semantic counterexamples, not expectations from the matcher."""
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from terminology import annotate_text, check_text, TerminologyError


@pytest.mark.parametrize('source,expected', [
    ('重复数和系数组合', '重复数和系数组合'),
    ('复数模态', '复数（complex number）模态（mode）'),
    ('根轨迹与轨迹', '根轨迹（root locus）与轨迹（trajectory）'),
    ('条件期望与期望', '条件期望（conditional expectation）与期望（expectation）'),
    ('全期望公式', '全期望公式（law of total expectation）'),
    ('二阶导数与导数', '二阶导数（second derivative）与导数（derivative）'),
    ('Python 数组', 'Python 数组（array）'),
    ('参数组合', '参数（parameter）组合'),
    ('重采样次数', '重采样（resampling）次数'),
    ('采样率和采样', '采样率（sampling rate）和采样（sampling）'),
    ('滞回与滞后输入', '滞回（hysteresis）与滞后输入（lagged input）'),
    ('滞后项', '滞后项（lagged term）'),
    ('均值场变分推断', '均值场变分推断（mean-field variational inference）'),
    ('自助粒子滤波', '自助粒子滤波（bootstrap particle filter）'),
    ('局部秩序与矩阵的秩', '局部秩序与矩阵（matrix）的秩（rank）'),
    ('周期二值格与周期二轨道', '周期二值格与周期二（period-two cycle）轨道'),
    ('人工测试集合与测试集', '人工测试集合与测试集（test set）'),
    ('观测收敛阶', '观测收敛阶（observed order of convergence）'),
    ('证据/边际似然', '证据/边际似然（evidence or marginal likelihood）'),
    ('系统性重采样', '系统性重采样（systematic resampling）'),
    ('海森矩阵', '海森矩阵（Hessian matrix）'),
    ('收支残差', '收支残差（mass-balance residual）'),
    ('满秩', '满秩（full rank）'),
    ('奇异矩阵', '奇异矩阵（singular matrix）'),
    ('动态模态', '动态模态（dynamic mode）'),
    ('上三角矩阵', '上三角矩阵（upper triangular matrix）'),
    ('自然指数函数', '自然指数函数（natural exponential function）'),
    ('不定积分与定积分', '不定积分（indefinite integral）与定积分（definite integral）'),
])
def test_independent_phrase_cases(source, expected):
    assert annotate_text(source) == expected
    assert annotate_text(expected) == expected
    assert not check_text(expected)[0]


@pytest.mark.parametrize('source,kind', [
    ('重复数（complex number）', 'compound'),
    ('系数组（array）合', 'compound'),
    ('重采样（sampling）', 'translation'),
    ('滞后（hysteresis）输入', 'translation'),
    ('数组（vector）', 'translation'),
    ('条件期望（expectation）', 'translation'),
    ('二阶导数（derivative）', 'translation'),
    ('不定积分（definite integral）', 'translation'),
    ('自然指数函数（logarithm）', 'translation'),
    ('收支残差（loss）', 'translation'),
    ('参数（parameter）（parameter）', 'duplicate'),
    ('数组（array（array））', 'nested'),
    ('数组(array (array))', 'nested'),
    ('滞后', 'ambiguous'),
    ('局部秩（rank）序', 'compound'),
    ('周期二（period-two cycle）值格', 'compound'),
    ('人工测试集（test set）合', 'compound'),
])
def test_bad_annotations_are_rejected_not_certified(source, kind):
    assert kind in {issue.kind for issue in check_text(source)[0]}
    with pytest.raises(TerminologyError):
        annotate_text(source)


def test_explicit_sense_and_conflict_do_not_silently_override():
    assert annotate_text('滞后', senses={'滞后': 'lag'}) == '滞后（lag）'
    assert annotate_text('滞后（lag），再次滞后') == '滞后（lag），再次滞后'
    with pytest.raises(TerminologyError):
        annotate_text('滞后（hysteresis）', senses={'滞后': 'lag'})


def test_correct_manual_variants_and_mathematical_parentheses():
    for text in ['卡尔曼滤波（Kalman filter，KF）', '重要性采样（importance sampling）',
                 '参数（parameter）组合', '负对数似然（likelihood）（去掉与 k 无关的项）',
                 '输出（output）(x−mean)/scale', '所追踪物质总量（tracked amount）（U/T）']:
        assert annotate_text(text) == text
        assert not check_text(text)[0]


def test_literal_content_remains_unchanged_and_does_not_consume_first_use():
    literal = ('# 数组\n\n`数组`\n```python\n参数 = "重复数（complex number）"\n```\n'
               '$数组$ $$参数$$ \\(数组\\) \\[参数\\]\n'
               '[数组](../参数.ipynb) [数组](../folder(test)/参数.ipynb) https://example.com/数组\n')
    assert annotate_text(literal + '数组') == literal + '数组（array）'
    assert not check_text(literal)[0]


def test_part_scope_prevents_splitting_future_long_terms():
    assert annotate_text('重采样', part=5) == '重采样'
    assert annotate_text('重采样', part=6) == '重采样（resampling）'


def test_check_all_occurrences_even_after_correct_first_annotation():
    issues, _ = check_text('数组（array），数组（complex number）')
    assert any(i.kind == 'translation' for i in issues)


def test_failure_does_not_poison_caller_first_use_state():
    seen = set()
    with pytest.raises(TerminologyError):
        annotate_text('数组；滞后', seen=seen)
    assert seen == set()
    assert annotate_text('数组', seen=seen) == '数组（array）'
    assert annotate_text('数组', seen=seen) == '数组'


def test_inequalities_are_not_html_tags_and_links_stay_literal():
    assert annotate_text('x<1 时正定，V>0。', part=4) == 'x<1 时正定（positive definite），V>0。'
    link = '<a href="../数组.ipynb">'
    assert annotate_text(link+'数组</a>') == link+'数组（array）</a>'


def test_overview_preserves_reviewed_text_without_automatic_annotations():
    from build_course import teaching_focus
    source = '- **教学重难点**：重复数、系数组合与自然指数函数按当前语境解释。'
    assert teaching_focus(source, '2.2') == '重复数、系数组合与自然指数函数按当前语境解释。'


@pytest.mark.parametrize('source', [
    '联合分布（joint distribution）描述成对结果。',
    '边缘分布（marginal distribution）由对应方向求和得到。',
    '离散熵（discrete entropy）是信息量的概率平均。',
    '条件互信息（conditional mutual information）按条件分布计算。',
])
def test_part05_compound_annotations_keep_their_full_scientific_meaning(source):
    issues, _ = check_text(source, 5, require_first=False)
    assert issues == []


@pytest.mark.parametrize('source', [
    '居中移动平均（centered moving average）使用前后窗口。',
    '群延迟（group delay）描述相位随频率的变化。',
    '参数可辨识性（parameter identifiability）取决于参数到观测的映射。',
    '信息矩阵（information matrix）累计回归方向的约束。',
])
def test_part06_compound_annotations_do_not_split_into_shorter_terms(source):
    issues, _ = check_text(source, 6, require_first=False)
    assert issues == []


@pytest.mark.parametrize('source', [
    '能观矩阵（observability matrix）按时刻堆叠观测行。',
    '多元高斯分布（multivariate Gaussian distribution）表示联合状态。',
    '自归一化重要性采样（self-normalized importance sampling）形成加权期望。',
    '前向概率（forward probability）合并同末态路径。',
    '平滑增益（smoothing gain）回传相邻状态的信息。',
])
def test_part07_complete_annotations_keep_their_distribution_and_algorithm_meaning(source):
    issues, _ = check_text(source, 7, require_first=False)
    assert issues == []


@pytest.mark.parametrize('source', [
    'Gamma分布（Gamma distribution）采用形状与率参数。',
    '高斯混合模型（Gaussian mixture model）按权重合并分量。',
    '后验预测分布（posterior predictive distribution）平均条件分布。',
    '等尾预测区间（equal-tailed prediction interval）在两尾留下相同概率。',
])
def test_part09_complete_probability_terms_are_not_shorter_annotations(source):
    issues, _ = check_text(source, 9, require_first=False)
    assert issues == []


def test_reviewed_sampling_lag_context_does_not_require_repeated_glosses():
    from check_teaching import check_terms
    text = '按固定滞后截断计算自相关，再比较最大滞后。'
    for unit in ['P09-C02-S02', 'p09-basic-diagnostics', 'overview:9.2']:
        assert check_terms(text, 9, unit=unit, require_first=False)[0] == []
        assert check_terms('滞后（hysteresis）', 9, unit=unit, require_first=False)[0]
    assert check_terms(text, 9, unit='unreviewed', require_first=False)[0]


@pytest.mark.parametrize('source', [
    '能控矩阵（controllability matrix）将输入作用方向排为列。',
    '状态反馈（state feedback）由状态计算输入。',
    '输出反馈（output feedback）由传感器输出形成控制。',
])
def test_part10_complete_control_terms_keep_their_specific_meaning(source):
    issues, _ = check_text(source, 10, require_first=False)
    assert issues == []


def test_reviewed_control_lag_contexts_keep_prose_without_wrong_english():
    from check_teaching import check_terms
    cases = [
        ('p10-second-order-poles', '两个滞后环节串联。'),
        ('p10-bode-margin', '在交叉处增加相位滞后。'),
        ('P10-C02-S02', '纯延迟增加相位滞后。'),
        ('P10-C07-S01', '平滑估计出现滞后。'),
        ('overview:10.2', '串联滞后环节的特征根。'),
    ]
    for unit, source in cases:
        assert check_terms(source, 10, unit=unit, require_first=False)[0] == []
        assert check_terms('滞后（hysteresis）', 10, unit=unit, require_first=False)[0]
